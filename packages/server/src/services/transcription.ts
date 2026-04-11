import { AssemblyAI } from "assemblyai";

export interface Utterance {
  speaker: "Doctor" | "Patient";
  text: string;
  start: number; // seconds
  end: number;
}

export interface TranscriptResult {
  utterances: Utterance[];
  plainText: string;
}

export class TranscriptionService {
  private client: AssemblyAI;

  constructor(apiKey: string) {
    this.client = new AssemblyAI({ apiKey });
  }

  async transcribe(audioFilePath: string): Promise<TranscriptResult> {
    const transcript = await this.client.transcripts.transcribe({
      audio: audioFilePath,
      speaker_labels: true,
      speech_models: ["universal-2"],
    });

    if (transcript.status === "error") {
      throw new Error(`Transcription failed: ${transcript.error}`);
    }

    const utterances = transcript.utterances ?? [];

    // Determine doctor/patient mapping: first speaker = Doctor heuristic
    const firstSpeaker = utterances[0]?.speaker ?? "A";
    const mapSpeaker = (label: string): "Doctor" | "Patient" =>
      label === firstSpeaker ? "Doctor" : "Patient";

    const mapped: Utterance[] = utterances.map((u) => ({
      speaker: mapSpeaker(u.speaker),
      text: u.text,
      start: u.start / 1000, // ms → seconds
      end: u.end / 1000,
    }));

    const plainText = mapped
      .map((u) => `${u.speaker}: ${u.text}`)
      .join("\n\n");

    return { utterances: mapped, plainText };
  }
}

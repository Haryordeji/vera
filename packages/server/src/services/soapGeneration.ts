import OpenAI from "openai";

export const SOAP_SYSTEM_PROMPT = `You are a medical scribe AI assistant. Given a transcript of a physician-patient encounter with speaker labels, generate a structured SOAP note.

Output a JSON object with exactly four keys: "subjective", "objective", "assessment", "plan".

Guidelines:
- Subjective: Chief complaint, history of present illness (HPI), review of systems as reported BY THE PATIENT. Use the patient's own language where clinically relevant.
- Objective: Any physical exam findings, vitals, or observations mentioned BY THE PHYSICIAN during the encounter. If none are explicitly stated, write "No objective findings documented in this encounter."
- Assessment: The physician's clinical impression or differential diagnosis as discussed in the encounter.
- Plan: Treatment plan, medications, follow-up instructions, referrals, or next steps as stated by the physician.

Do not hallucinate findings not present in the transcript.
Do not infer diagnoses beyond what the physician explicitly discussed.
Respond ONLY with the JSON object, no additional text.`;

export interface SoapContent {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
}

export class SoapGenerationService {
  private client: OpenAI;
  private model: string;

  constructor() {
    this.client = new OpenAI({
      apiKey: process.env.LLM_API_KEY ?? "placeholder",
      baseURL: process.env.LLM_BASE_URL ?? "https://api.deepseek.com",
    });
    this.model = process.env.LLM_MODEL ?? "deepseek-chat";
  }

  async generate(transcript: string): Promise<SoapContent> {
    const attemptGenerate = async (): Promise<SoapContent> => {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          { role: "system", content: SOAP_SYSTEM_PROMPT },
          {
            role: "user",
            content: `Generate a SOAP note from the following physician-patient encounter transcript:\n\n${transcript}`,
          },
        ],
        response_format: { type: "json_object" },
      });

      const content = response.choices[0]?.message?.content ?? "";
      const parsed = JSON.parse(content) as Record<string, unknown>;

      if (
        typeof parsed.subjective !== "string" ||
        typeof parsed.objective !== "string" ||
        typeof parsed.assessment !== "string" ||
        typeof parsed.plan !== "string"
      ) {
        throw new SyntaxError("LLM response missing required SOAP fields");
      }

      return {
        subjective: parsed.subjective,
        objective: parsed.objective,
        assessment: parsed.assessment,
        plan: parsed.plan,
      };
    };

    try {
      return await attemptGenerate();
    } catch (err) {
      // Retry once on JSON parse / field validation failures
      if (err instanceof SyntaxError) {
        try {
          return await attemptGenerate();
        } catch (retryErr) {
          throw new Error(
            `SOAP generation failed after retry: ${
              retryErr instanceof Error ? retryErr.message : String(retryErr)
            }`
          );
        }
      }
      throw err;
    }
  }
}

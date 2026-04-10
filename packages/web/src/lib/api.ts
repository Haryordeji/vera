/**
 * Thin fetch wrapper that attaches the Clerk Bearer token to every request.
 *
 * Usage (inside a React component):
 *   const api = useApi();
 *   const sessions = await api.get<Session[]>("/sessions");
 *   const session = await api.post<Session>("/sessions", { patientId });
 */
import { useCallback } from "react";
import { useAuth } from "@clerk/clerk-react";

const BASE = "/api";

export function useApi() {
  const { getToken } = useAuth();

  const request = useCallback(
    async <T>(path: string, options: RequestInit = {}): Promise<T> => {
      const token = await getToken();
      const res = await fetch(`${BASE}${path}`, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(options.headers ?? {}),
        },
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`API ${res.status}: ${body}`);
      }
      return res.json() as Promise<T>;
    },
    [getToken]
  );

  const get = useCallback(
    <T>(path: string) => request<T>(path),
    [request]
  );

  const post = useCallback(
    <T>(path: string, body?: unknown) =>
      request<T>(path, {
        method: "POST",
        body: body !== undefined ? JSON.stringify(body) : undefined,
      }),
    [request]
  );

  const put = useCallback(
    <T>(path: string, body?: unknown) =>
      request<T>(path, {
        method: "PUT",
        body: body !== undefined ? JSON.stringify(body) : undefined,
      }),
    [request]
  );

  return { get, post, put };
}

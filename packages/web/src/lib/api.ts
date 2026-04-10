/**
 * Thin fetch wrapper that attaches the Clerk Bearer token to every request.
 * Usage (inside a React component or hook):
 *
 *   const api = useApi();
 *   const physician = await api.post<Physician>("/auth/sync");
 */
import { useAuth } from "@clerk/clerk-react";

const BASE = "/api";

export function useApi() {
  const { getToken } = useAuth();

  async function request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
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
  }

  return {
    get: <T>(path: string) => request<T>(path),
    post: <T>(path: string, body?: unknown) =>
      request<T>(path, {
        method: "POST",
        body: body !== undefined ? JSON.stringify(body) : undefined,
      }),
    put: <T>(path: string, body?: unknown) =>
      request<T>(path, {
        method: "PUT",
        body: body !== undefined ? JSON.stringify(body) : undefined,
      }),
  };
}

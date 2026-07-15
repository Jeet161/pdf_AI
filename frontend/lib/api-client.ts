// Central place for talking to the FastAPI backend.
// Every future feature (upload, summary, chat, pdf tools) will add
// functions here instead of scattering fetch() calls across components.

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export async function checkBackendHealth() {
  const res = await fetch(`${API_BASE_URL}/health`, { cache: "no-store" });

  if (!res.ok) {
    throw new Error(`Backend health check failed: ${res.status}`);
  }

  return res.json() as Promise<{ status: string; service: string }>;
}

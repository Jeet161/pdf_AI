import "server-only";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const INTERNAL_API_SECRET = process.env.INTERNAL_API_SECRET ?? "";

/**
 * Builds the two headers FastAPI requires on every protected endpoint:
 * - X-Internal-Secret: proves this request came from our own server
 * - X-User-Id: the Better Auth user id, already verified by the caller
 *
 * IMPORTANT: only call this after you've already confirmed a valid
 * session yourself (e.g. via auth.api.getSession). This function does
 * not check auth - it just builds trusted headers for a user you've
 * already authenticated.
 */
export function backendAuthHeaders(userId: string): HeadersInit {
  return {
    "X-Internal-Secret": INTERNAL_API_SECRET,
    "X-User-Id": userId,
  };
}

export const BACKEND_URL = API_BASE_URL;

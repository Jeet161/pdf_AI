import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";

// This single file handles every auth endpoint Better Auth needs:
// /api/auth/sign-up/email, /api/auth/sign-in/email, /api/auth/sign-out,
// /api/auth/get-session, etc.
export const { GET, POST } = toNextJsHandler(auth);

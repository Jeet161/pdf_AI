import { createAuthClient } from "better-auth/react";

// Used from Client Components to sign up, sign in, sign out,
// and read the current session (e.g. authClient.useSession()).
export const authClient = createAuthClient({
  baseURL: "https://pdf-ai-psi.vercel.app",
});

import { createAuthClient } from "better-auth/react";

// Used from Client Components to sign up, sign in, sign out,
// and read the current session (e.g. authClient.useSession()).
export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
});

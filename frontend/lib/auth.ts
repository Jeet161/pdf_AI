import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { Pool } from "pg";

// Build the list of trusted origins from env vars so nothing is hard-coded.
const trustedOrigins = ["http://localhost:3000"];
if (process.env.BETTER_AUTH_URL) trustedOrigins.push(process.env.BETTER_AUTH_URL);
if (process.env.NEXT_PUBLIC_APP_URL) trustedOrigins.push(process.env.NEXT_PUBLIC_APP_URL);

export const auth = betterAuth({
  database: new Pool({
    connectionString: process.env.DATABASE_URL,
  }),

  emailAndPassword: {
    enabled: true,
  },

  trustedOrigins,

  plugins: [nextCookies()],
});
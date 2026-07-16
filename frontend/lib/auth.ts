import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { Pool } from "pg";

export const auth = betterAuth({
  database: new Pool({
    connectionString: process.env.DATABASE_URL,
  }),

  emailAndPassword: {
    enabled: true,
  },

trustedOrigins: [
  "http://localhost:3000",
  "https://pdf-ai-psi.vercel.app",
],

  plugins: [nextCookies()],
});
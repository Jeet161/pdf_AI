import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { Pool } from "pg";

// Better Auth manages its own tables (user, session, account, verification)
// directly in our Postgres database via this connection pool.
// No separate ORM (Prisma/Drizzle) is needed for this simple setup.
export const auth = betterAuth({
  database: new Pool({
    connectionString: process.env.DATABASE_URL,
  }),

  emailAndPassword: {
    enabled: true,
  },

  // Required so that server actions / route handlers can correctly set
  // the session cookie using Next.js's own cookies() API.
  plugins: [nextCookies()],
});

import { betterAuth } from 'better-auth';
import { nextCookies } from 'better-auth/next-js';
import { Pool } from 'pg';

/** One pool per function instance; Fluid Compute reuses it across requests. */
export const db = new Pool({ connectionString: process.env.DATABASE_URL, max: 5 });

const google = process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
  ? { clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET }
  : null;

export const hasGoogle = !!google;

/**
 * Accounts are optional: guests play exactly as before, a signed-in player also gets
 * history and stats. Sessions and users live in the same Postgres as the games.
 */
export const auth = betterAuth({
  appName: 'Слепой, Глухой, Немой',
  database: db,
  baseURL: {
    // The production domain, this deployment's own URLs, and local dev.
    allowedHosts: [
      process.env.VERCEL_PROJECT_PRODUCTION_URL,
      process.env.VERCEL_BRANCH_URL,
      process.env.VERCEL_URL,
      'localhost:*',
    ].filter((h): h is string => !!h),
  },
  emailAndPassword: { enabled: true, minPasswordLength: 6 },
  socialProviders: google ? { google } : {},
  plugins: [nextCookies()],
});

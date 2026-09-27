import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { Pool } from "pg";

const baseURL = process.env.BETTER_AUTH_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined) || process.env.V0_RUNTIME_URL || "http://localhost:3000";
const trustedOrigins = ["http://localhost:3000", baseURL, process.env.V0_DEV_APP_URL, process.env.V0_BUILD_URL, process.env.V0_SANDBOX_URL].filter(Boolean) as string[];

export const auth = betterAuth({
  database: new Pool({ connectionString: process.env.DATABASE_URL }),
  baseURL,
  trustedOrigins,
  emailAndPassword: { enabled: true },
  advanced: process.env.NODE_ENV === "development" ? { defaultCookieAttributes: { sameSite: "none", secure: true } } : undefined,
  plugins: [nextCookies()],
});

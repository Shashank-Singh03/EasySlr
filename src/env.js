import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  /**
   * Server-side environment variables. Validated at startup so the app fails fast and loud
   * instead of misbehaving on a missing/invalid value at request time.
   */
  server: {
    // Required in every environment. NextAuth uses it to sign JWT session tokens; an empty or
    // missing secret silently breaks auth, so we never make it optional.
    AUTH_SECRET: z.string().min(1),
    DATABASE_URL: z.string().url(),
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
  },

  /**
   * Client-side environment variables. Must be prefixed with `NEXT_PUBLIC_`.
   */
  client: {},

  /**
   * Destructured manually because Next.js edge/client runtimes can't read `process.env` as an object.
   */
  runtimeEnv: {
    AUTH_SECRET: process.env.AUTH_SECRET,
    DATABASE_URL: process.env.DATABASE_URL,
    NODE_ENV: process.env.NODE_ENV,
  },
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});

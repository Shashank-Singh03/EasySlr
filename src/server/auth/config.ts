import { type DefaultSession, type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { z } from "zod";

import { db } from "~/server/db";

/**
 * Module augmentation so `session.user.id` is typed everywhere.
 *
 * @see https://authjs.dev/getting-started/typescript
 */
declare module "next-auth" {
  interface Session extends DefaultSession {
    user: {
      id: string;
    } & DefaultSession["user"];
  }
}

/**
 * Auth strategy: Credentials provider + JWT sessions.
 *
 * Why Credentials (not Discord/OAuth): this is a self-contained take-home that a reviewer must be
 * able to run and demo with zero external setup. Seeded demo users + email/password is the lowest-
 * friction path. See /docs/adr/backend/0006-auth-credentials-jwt for the full tradeoff (notably:
 * Credentials *requires* JWT sessions, so the JWT can outlive a revoked membership — we mitigate by
 * re-checking project membership on every authorized tRPC call rather than trusting the token).
 */
const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const authConfig = {
  session: { strategy: "jwt" },
  // Trust the host header in self-hosted/preview environments (no Vercel-injected URL).
  trustHost: true,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      /**
       * Returns the user on success, or `null` on any failure. We deliberately never reveal
       * whether the email exists vs. the password is wrong — same `null` for both.
       */
      authorize: async (raw) => {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;

        const user = await db.user.findUnique({ where: { email } });
        if (!user) return null;
        if (!user.active) return null; // deactivated users cannot sign in

        const passwordMatches = await compare(password, user.password);
        if (!passwordMatches) return null;

        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  ],
  callbacks: {
    // Persist the user id onto the token at sign-in.
    jwt: ({ token, user }) => {
      if (user) token.id = user.id;
      return token;
    },
    // Expose the user id on the session (read from the token under the JWT strategy).
    session: ({ session, token }) => ({
      ...session,
      user: {
        ...session.user,
        id: token.id as string,
      },
    }),
  },
} satisfies NextAuthConfig;

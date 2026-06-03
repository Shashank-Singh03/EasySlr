import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";

/**
 * Liveness endpoint. Useful for deploy smoke-tests and load-balancer health checks, and it keeps
 * the root router non-empty (the tRPC hydration helpers require at least one procedure).
 */
export const healthRouter = createTRPCRouter({
  ping: publicProcedure.query(() => ({
    ok: true,
    time: new Date().toISOString(),
  })),
});

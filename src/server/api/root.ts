import { healthRouter } from "~/server/api/routers/health";
import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";

/**
 * Primary tRPC router. Feature routers (org, project, import, article, review, export) are
 * registered here as they are built.
 */
export const appRouter = createTRPCRouter({
  health: healthRouter,
  // org: orgRouter,
  // project: projectRouter,
  // import: importRouter,
  // article: articleRouter,
  // review: reviewRouter,
});

// Exported type used by the typed client.
export type AppRouter = typeof appRouter;

/**
 * Server-side caller factory (used by tests and React Server Components).
 */
export const createCaller = createCallerFactory(appRouter);

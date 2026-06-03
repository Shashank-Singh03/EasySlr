import { articleRouter } from "~/server/api/routers/article";
import { exportRouter } from "~/server/api/routers/export";
import { healthRouter } from "~/server/api/routers/health";
import { importRouter } from "~/server/api/routers/import";
import { orgRouter } from "~/server/api/routers/org";
import { projectRouter } from "~/server/api/routers/project";
import { reviewRouter } from "~/server/api/routers/review";
import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";

/**
 * Primary tRPC router. Each feature router owns one slice of the domain; authorization is enforced
 * by the procedure each one builds on (see ~/server/api/trpc.ts).
 */
export const appRouter = createTRPCRouter({
  health: healthRouter,
  org: orgRouter,
  project: projectRouter,
  import: importRouter,
  article: articleRouter,
  review: reviewRouter,
  export: exportRouter,
});

export type AppRouter = typeof appRouter;

/** Server-side caller factory (used by React Server Components and tests). */
export const createCaller = createCallerFactory(appRouter);

import { z } from "zod";

import {
  createTRPCRouter,
  orgProcedure,
  projectProcedure,
} from "~/server/api/trpc";

export const projectRouter = createTRPCRouter({
  /** Projects in an org the caller can see (org membership enforced by orgProcedure). */
  listByOrg: orgProcedure
    .input(z.object({ orgId: z.string() }))
    .query(({ ctx }) =>
      ctx.db.project.findMany({
        where: { orgId: ctx.org.id },
        orderBy: { createdAt: "desc" },
        include: { _count: { select: { articles: true } } },
      }),
    ),

  /** A single project the caller is a member of. */
  get: projectProcedure
    .input(z.object({ projectId: z.string() }))
    .query(({ ctx }) => ctx.project),

  /** Create a project in an org and make the creator its OWNER. */
  create: orgProcedure
    .input(z.object({ orgId: z.string(), name: z.string().min(1).max(160) }))
    .mutation(({ ctx, input }) =>
      ctx.db.$transaction(async (tx) => {
        const project = await tx.project.create({
          data: { name: input.name, orgId: ctx.org.id },
        });
        await tx.projectMembership.create({
          data: {
            userId: ctx.session.user.id,
            projectId: project.id,
            role: "OWNER",
          },
        });
        return project;
      }),
    ),
});

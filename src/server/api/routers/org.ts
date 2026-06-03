import { z } from "zod";

import { slugify } from "~/lib/slug";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

export const orgRouter = createTRPCRouter({
  /** Organizations the signed-in user belongs to (the org picker). */
  listMine: protectedProcedure.query(({ ctx }) =>
    ctx.db.organization.findMany({
      where: { members: { some: { userId: ctx.session.user.id } } },
      orderBy: { name: "asc" },
    }),
  ),

  /** Create an organization and make the creator its first member, atomically. */
  create: protectedProcedure
    .input(z.object({ name: z.string().min(1).max(120) }))
    .mutation(({ ctx, input }) =>
      ctx.db.$transaction(async (tx) => {
        const org = await tx.organization.create({
          data: { name: input.name, slug: slugify(input.name) },
        });
        await tx.organizationMembership.create({
          data: { userId: ctx.session.user.id, orgId: org.id },
        });
        return org;
      }),
    ),
});

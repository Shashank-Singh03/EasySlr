import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  articleProcedure,
  createTRPCRouter,
  projectProcedure,
} from "~/server/api/trpc";
import { assertCanWrite } from "~/server/services/access";
import { Decision } from "../../../../generated/prisma";

/** Fields a reviewer can set. All optional — only provided keys are changed. */
const reviewPatch = {
  decision: z.nativeEnum(Decision).optional(),
  exclusionReason: z.string().max(500).nullable().optional(),
  priority: z.number().int().min(1).max(5).nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
  labels: z.array(z.string().max(60)).max(50).optional(),
};

export const reviewRouter = createTRPCRouter({
  /**
   * Upsert the review for one article. Optimistic concurrency: if `expectedUpdatedAt` is provided
   * and no longer matches, we reject with CONFLICT rather than silently clobbering a co-reviewer's
   * change (see /docs/adr/database/0004).
   */
  update: articleProcedure
    .input(
      z.object({
        articleId: z.string(),
        expectedUpdatedAt: z.date().nullable().optional(),
        ...reviewPatch,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      assertCanWrite(ctx.projectRole);

      const existing = await ctx.db.review.findUnique({
        where: { articleId: ctx.article.id },
      });

      if (
        existing &&
        input.expectedUpdatedAt !== undefined &&
        input.expectedUpdatedAt !== null &&
        existing.updatedAt.getTime() !== input.expectedUpdatedAt.getTime()
      ) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "This article was updated by someone else. Reload and try again.",
        });
      }

      const patch = pickDefined(input);

      return ctx.db.review.upsert({
        where: { articleId: ctx.article.id },
        update: patch,
        create: {
          articleId: ctx.article.id,
          reviewerId: ctx.session.user.id,
          decision: input.decision ?? Decision.UNREVIEWED,
          exclusionReason: input.exclusionReason ?? null,
          priority: input.priority ?? null,
          notes: input.notes ?? null,
          labels: input.labels ?? [],
        },
      });
    }),

  /**
   * Apply the same patch to many articles at once. Every id is re-verified to belong to this
   * project before anything is written (no smuggling foreign ids through a bulk call).
   */
  bulkUpdate: projectProcedure
    .input(
      z.object({
        projectId: z.string(),
        articleIds: z.array(z.string()).min(1).max(500),
        ...reviewPatch,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      assertCanWrite(ctx.projectRole);

      const inProject = await ctx.db.article.count({
        where: { id: { in: input.articleIds }, projectId: ctx.project.id },
      });
      if (inProject !== input.articleIds.length) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Some selected articles are not in this project",
        });
      }

      const patch = pickDefined(input);
      await ctx.db.$transaction(
        input.articleIds.map((articleId) =>
          ctx.db.review.upsert({
            where: { articleId },
            update: patch,
            create: {
              articleId,
              reviewerId: ctx.session.user.id,
              decision: input.decision ?? Decision.UNREVIEWED,
              exclusionReason: input.exclusionReason ?? null,
              priority: input.priority ?? null,
              notes: input.notes ?? null,
              labels: input.labels ?? [],
            },
          }),
        ),
      );

      return { updated: input.articleIds.length };
    }),
});

/** Keep only the review-patch keys that were actually provided. */
function pickDefined(input: {
  decision?: Decision;
  exclusionReason?: string | null;
  priority?: number | null;
  notes?: string | null;
  labels?: string[];
}) {
  const patch: {
    decision?: Decision;
    exclusionReason?: string | null;
    priority?: number | null;
    notes?: string | null;
    labels?: string[];
  } = {};
  if (input.decision !== undefined) patch.decision = input.decision;
  if (input.exclusionReason !== undefined) patch.exclusionReason = input.exclusionReason;
  if (input.priority !== undefined) patch.priority = input.priority;
  if (input.notes !== undefined) patch.notes = input.notes;
  if (input.labels !== undefined) patch.labels = input.labels;
  return patch;
}

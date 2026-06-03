import { z } from "zod";

import { toCsv } from "~/lib/csv";
import { createTRPCRouter, projectProcedure } from "~/server/api/trpc";
import { Decision, type Prisma } from "../../../../generated/prisma";

export const exportRouter = createTRPCRouter({
  /**
   * Export a project's articles (optionally filtered by decision) as CSV. Returns the text so the
   * client can trigger a download; fine at this scale (a route handler that streams is the seam for
   * very large exports).
   */
  reviewedCsv: projectProcedure
    .input(z.object({ projectId: z.string(), decision: z.nativeEnum(Decision).optional() }))
    .query(async ({ ctx, input }) => {
      const where: Prisma.ArticleWhereInput = { projectId: ctx.project.id };
      if (input.decision) where.review = { decision: input.decision };

      const articles = await ctx.db.article.findMany({
        where,
        include: { review: true },
        orderBy: { createdAt: "desc" },
      });

      const headers = [
        "PMID",
        "Title",
        "First Author",
        "Journal",
        "Year",
        "DOI",
        "Decision",
        "Exclusion Reason",
        "Priority",
        "Labels",
        "Notes",
      ];
      const rows = articles.map((a) => [
        a.pmid,
        a.title,
        a.firstAuthor,
        a.journal,
        a.year,
        a.doi,
        a.review?.decision ?? Decision.UNREVIEWED,
        a.review?.exclusionReason,
        a.review?.priority,
        a.review?.labels ?? [],
        a.review?.notes,
      ]);

      return {
        filename: `easyslr-export-${new Date().toISOString().slice(0, 10)}.csv`,
        csv: toCsv(headers, rows),
      };
    }),
});

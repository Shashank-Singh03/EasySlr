import { z } from "zod";

import {
  articleProcedure,
  createTRPCRouter,
  projectProcedure,
} from "~/server/api/trpc";
import { Decision, type Prisma } from "../../../../generated/prisma";

const SORTABLE = ["createdAt", "year", "title"] as const;

const listInput = z.object({
  projectId: z.string(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(25),
  search: z.string().trim().max(200).optional(),
  decision: z.nativeEnum(Decision).optional(),
  flaggedOnly: z.boolean().optional(),
  sort: z.enum(SORTABLE).default("createdAt"),
  sortDir: z.enum(["asc", "desc"]).default("desc"),
});

export const articleRouter = createTRPCRouter({
  /**
   * Paginated, sorted, filtered, searched — all server-side (see /docs/adr/frontend/0005). The
   * client never holds the whole dataset. Filters combine with AND.
   */
  list: projectProcedure.input(listInput).query(async ({ ctx, input }) => {
    const conditions: Prisma.ArticleWhereInput[] = [{ projectId: ctx.project.id }];

    if (input.search) {
      conditions.push({
        OR: [
          { title: { contains: input.search, mode: "insensitive" } },
          { authors: { contains: input.search, mode: "insensitive" } },
        ],
      });
    }

    if (input.flaggedOnly) {
      conditions.push({ OR: [{ suspectYear: true }, { possibleDupDoi: true }] });
    }

    if (input.decision) {
      // An article with no Review row counts as UNREVIEWED.
      conditions.push(
        input.decision === Decision.UNREVIEWED
          ? { OR: [{ review: { is: null } }, { review: { decision: Decision.UNREVIEWED } }] }
          : { review: { decision: input.decision } },
      );
    }

    const where: Prisma.ArticleWhereInput = { AND: conditions };
    const orderBy: Prisma.ArticleOrderByWithRelationInput =
      input.sort === "year"
        ? { year: { sort: input.sortDir, nulls: "last" } }
        : { [input.sort]: input.sortDir };

    const [rows, total] = await Promise.all([
      ctx.db.article.findMany({
        where,
        include: { review: true },
        orderBy,
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
      }),
      ctx.db.article.count({ where }),
    ]);

    return { rows, total, page: input.page, pageSize: input.pageSize };
  }),

  /** One article with its review (the detail drawer). */
  get: articleProcedure
    .input(z.object({ articleId: z.string() }))
    .query(({ ctx }) =>
      ctx.db.article.findUnique({
        where: { id: ctx.article.id },
        include: { review: true },
      }),
    ),
});

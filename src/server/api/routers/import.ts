import { createHash } from "node:crypto";

import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { createTRPCRouter, projectProcedure } from "~/server/api/trpc";
import { assertIsOwner } from "~/server/services/access";
import {
  ImportFileError,
  runImportPipeline,
  type ExistingKeys,
  type RowOutcome,
} from "~/server/services/import";
import { type PrismaClient } from "../../../../generated/prisma";

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB — see /docs/adr/backend/0002

const processInput = z.object({
  projectId: z.string(),
  filename: z.string().min(1).max(255),
  /** The uploaded .xlsx bytes, base64-encoded (tRPC/JSON can't carry a File directly). */
  contentBase64: z.string().min(1),
  /** true = preview only (no writes); false = commit. */
  dryRun: z.boolean(),
});

type ImportRow = Extract<RowOutcome, { status: "import" }>;

export const importRouter = createTRPCRouter({
  /**
   * Single import entry point. `dryRun: true` previews; `dryRun: false` commits. Both run the same
   * pure pipeline server-side, so they can't disagree (see /docs/adr/backend/0002). Import is
   * owner-only.
   */
  process: projectProcedure.input(processInput).mutation(async ({ ctx, input }) => {
    assertIsOwner(ctx.projectRole);

    const buffer = decodeUpload(input.contentBase64);
    const existing = await loadExistingKeys(ctx.db, ctx.project.id);

    let preview;
    try {
      preview = await runImportPipeline(buffer, existing);
    } catch (error) {
      // File-level problems (not a workbook, missing columns, …) are user errors, not crashes.
      if (error instanceof ImportFileError) {
        throw new TRPCError({ code: "BAD_REQUEST", message: error.message, cause: error });
      }
      throw error;
    }

    if (input.dryRun) {
      return { committed: false as const, summary: preview.summary, rows: preview.rows };
    }

    const importRows = preview.rows.filter(
      (row): row is ImportRow => row.status === "import",
    );
    const errors = preview.rows
      .filter((row) => row.status !== "import")
      .map((row) =>
        row.status === "reject"
          ? { rowNumber: row.rowNumber, type: row.status, code: row.code, message: row.message }
          : { rowNumber: row.rowNumber, type: row.status, code: row.code, message: row.message },
      );

    // Single transaction: record provenance, bulk-insert (skipDuplicates is the race-safe PMID
    // guard), then store the real imported count.
    const result = await ctx.db.$transaction(async (tx) => {
      const batch = await tx.importBatch.create({
        data: {
          projectId: ctx.project.id,
          uploadedById: ctx.session.user.id,
          filename: input.filename,
          fileHash: sha256(buffer),
          totalRows: preview.summary.total,
          importedCount: 0,
          duplicateCount: preview.summary.duplicates,
          rejectedCount: preview.summary.rejected,
          flaggedCount: preview.summary.flagged,
          errors,
        },
      });

      const created = await tx.article.createMany({
        data: importRows.map((row) => ({
          projectId: ctx.project.id,
          importBatchId: batch.id,
          ...row.article,
        })),
        skipDuplicates: true,
      });

      await tx.importBatch.update({
        where: { id: batch.id },
        data: { importedCount: created.count },
      });

      return { batchId: batch.id, importedCount: created.count };
    });

    return {
      committed: true as const,
      batchId: result.batchId,
      summary: { ...preview.summary, willImport: result.importedCount },
    };
  }),

  /** List import batches for a project (provenance / undo surface). */
  listBatches: projectProcedure
    .input(z.object({ projectId: z.string() }))
    .query(({ ctx }) =>
      ctx.db.importBatch.findMany({
        where: { projectId: ctx.project.id },
        orderBy: { createdAt: "desc" },
      }),
    ),

  /**
   * Undo an import: delete the batch's articles (their reviews cascade). Guarded — refuses if any
   * of those articles already have a review decision, unless `force` is set.
   */
  undo: projectProcedure
    .input(z.object({ projectId: z.string(), batchId: z.string(), force: z.boolean().default(false) }))
    .mutation(async ({ ctx, input }) => {
      assertIsOwner(ctx.projectRole);

      const batch = await ctx.db.importBatch.findFirst({
        where: { id: input.batchId, projectId: ctx.project.id },
      });
      if (!batch) throw new TRPCError({ code: "NOT_FOUND", message: "Import batch not found" });

      const reviewedCount = await ctx.db.review.count({
        where: { article: { importBatchId: batch.id }, decision: { not: "UNREVIEWED" } },
      });
      if (reviewedCount > 0 && !input.force) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `${reviewedCount} article(s) in this import already have review decisions. Confirm to delete anyway.`,
        });
      }

      const deleted = await ctx.db.article.deleteMany({
        where: { importBatchId: batch.id, projectId: ctx.project.id },
      });
      await ctx.db.importBatch.delete({ where: { id: batch.id } });
      return { deleted: deleted.count };
    }),
});

function decodeUpload(base64: string): Buffer {
  const buffer = Buffer.from(base64, "base64");
  if (buffer.byteLength === 0) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "The uploaded file is empty" });
  }
  if (buffer.byteLength > MAX_UPLOAD_BYTES) {
    throw new TRPCError({
      code: "PAYLOAD_TOO_LARGE",
      message: `File exceeds the ${MAX_UPLOAD_BYTES / (1024 * 1024)} MB limit`,
    });
  }
  return buffer;
}

function sha256(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

async function loadExistingKeys(
  db: PrismaClient,
  projectId: string,
): Promise<ExistingKeys> {
  const rows = await db.article.findMany({
    where: { projectId },
    select: { pmid: true, doi: true },
  });
  return {
    pmids: new Set(rows.flatMap((r) => (r.pmid ? [r.pmid] : []))),
    dois: new Set(rows.flatMap((r) => (r.doi ? [r.doi] : []))),
  };
}

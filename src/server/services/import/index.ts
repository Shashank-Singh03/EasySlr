import { classifyRows } from "./classify";
import { normalizeRow } from "./normalize";
import { parseWorkbook } from "./parse";
import { type ExistingKeys, type ImportPreview, type RowOutcome } from "./types";

export { ImportFileError } from "./mapHeaders";
export type { ImportFileErrorCode } from "./mapHeaders";
export type {
  ArticleInput,
  ImportPreview,
  ImportSummary,
  RowOutcome,
} from "./types";

/**
 * Run the full import pipeline over an uploaded workbook: parse → normalize → classify/dedup.
 *
 * This function performs NO writes. It is the single source of truth for both "preview" (show the
 * user what will happen) and "commit" (the writer re-runs this and persists the `import` rows) — so
 * the two can never disagree. See /docs/adr/backend/0002.
 *
 * @throws ImportFileError for file-level problems (not a workbook, missing required columns, …).
 */
export async function runImportPipeline(
  buffer: Buffer,
  existing: ExistingKeys,
): Promise<ImportPreview> {
  const { rawRows } = await parseWorkbook(buffer);
  const normalized = rawRows.map(normalizeRow);
  return classifyRows(normalized, existing);
}

/** The article rows that should actually be written, extracted from a classified preview. */
export function articlesToCreate(preview: ImportPreview): RowOutcome[] {
  return preview.rows.filter((row) => row.status === "import");
}

import { ARTICLE_FIELDS, type ArticleField } from "./types";

/**
 * File-level import failures — distinct from per-row problems. These mean "we couldn't even read
 * the file as a valid article export," and the UI surfaces them differently (one banner, not a
 * row-by-row table). See /docs/adr/backend/0002.
 */
export type ImportFileErrorCode =
  | "NOT_A_WORKBOOK"
  | "NO_SHEET"
  | "EMPTY_SHEET"
  | "MISSING_REQUIRED_COLUMNS";

export class ImportFileError extends Error {
  constructor(
    public readonly code: ImportFileErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ImportFileError";
  }
}

/** field → 1-based column index (1-based to match exceljs `row.getCell`). */
export type ColumnMap = Partial<Record<ArticleField, number>>;

/**
 * Accepted header spellings per field, lowercased. Matching is case-insensitive and
 * whitespace-trimmed, so "Journal/Book", " journal/book ", and "JOURNAL/BOOK" all map to `journal`.
 * This is what lets us accept reordered/renamed columns instead of assuming fixed positions.
 */
const HEADER_SYNONYMS: Record<ArticleField, string[]> = {
  pmid: ["pmid"],
  title: ["title"],
  authors: ["authors", "author"],
  citation: ["citation"],
  firstAuthor: ["first author"],
  journal: ["journal/book", "journal", "book"],
  year: ["publication year", "year", "pub year"],
  createDate: ["create date", "created date"],
  pmcid: ["pmcid", "pmc id"],
  nihmsId: ["nihms id", "nihmsid"],
  doi: ["doi"],
};

/**
 * Map a header row to canonical fields. Throws `ImportFileError("MISSING_REQUIRED_COLUMNS")` when
 * the file can't support a meaningful import: we require a Title column and at least one identifier
 * column (PMID or DOI). Extra/unknown columns are ignored.
 */
export function mapHeaders(headerCells: (string | null)[]): ColumnMap {
  const normalized = headerCells.map((c) => (c ?? "").toString().trim().toLowerCase());

  const map: ColumnMap = {};
  for (const field of ARTICLE_FIELDS) {
    const index = normalized.findIndex((h) => HEADER_SYNONYMS[field].includes(h));
    if (index !== -1) map[field] = index + 1;
  }

  const missing: string[] = [];
  if (map.title === undefined) missing.push("Title");
  if (map.pmid === undefined && map.doi === undefined) missing.push("PMID or DOI");

  if (missing.length > 0) {
    throw new ImportFileError(
      "MISSING_REQUIRED_COLUMNS",
      `Missing required column(s): ${missing.join(", ")}`,
    );
  }

  return map;
}

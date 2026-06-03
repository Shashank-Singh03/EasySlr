/**
 * Shared types for the import pipeline. These describe the data as it flows:
 *   raw cells → normalized row → classified outcome (import | reject | duplicate).
 *
 * The pipeline is intentionally framework-free (no tRPC, no Prisma, no React) so it can be
 * unit-tested against the real sample file. See /docs/adr/backend/0002 and /docs/adr/database/0001.
 */

export const ARTICLE_FIELDS = [
  "pmid",
  "title",
  "authors",
  "citation",
  "firstAuthor",
  "journal",
  "year",
  "createDate",
  "pmcid",
  "nihmsId",
  "doi",
] as const;

export type ArticleField = (typeof ARTICLE_FIELDS)[number];

/** A spreadsheet cell coerced to a primitive (exceljs can yield string | number | Date | objects). */
export type CellValue = string | number | null;

/** One spreadsheet row, keyed by canonical field. `rowNumber` is 1-based (header is row 1). */
export type RawRow = {
  rowNumber: number;
  cells: Partial<Record<ArticleField, CellValue>>;
};

/** A row after normalization (trimmed, DOI/PMID cleaned, year coerced). */
export type NormalizedRow = {
  rowNumber: number;
  pmid: string | null;
  doi: string | null;
  title: string | null;
  authors: string | null;
  firstAuthor: string | null;
  journal: string | null;
  citation: string | null;
  year: number | null;
  /** Original year text, kept only when the value was present but unusable (for a visible badge). */
  rawYear: string | null;
  pmcid: string | null;
  nihmsId: string | null;
  createDate: string | null;
  /** Set when a year value was present but didn't parse to a plausible integer. */
  suspectYear: boolean;
};

/** The persistable article shape produced for rows that will be imported. */
export type ArticleInput = {
  pmid: string | null;
  doi: string | null;
  title: string;
  authors: string | null;
  firstAuthor: string | null;
  journal: string | null;
  citation: string | null;
  year: number | null;
  rawYear: string | null;
  pmcid: string | null;
  nihmsId: string | null;
  createDate: string | null;
  suspectYear: boolean;
  possibleDupDoi: boolean;
};

export type RejectionCode = "MISSING_TITLE" | "MISSING_IDENTIFIER";
export type DuplicateCode =
  | "DUPLICATE_PMID_IN_FILE"
  | "DUPLICATE_PMID_IN_PROJECT";

/** The outcome of classifying a single row. */
export type RowOutcome =
  | {
      rowNumber: number;
      status: "import";
      article: ArticleInput;
      flags: { suspectYear: boolean; possibleDupDoi: boolean };
    }
  | {
      rowNumber: number;
      status: "reject";
      code: RejectionCode;
      message: string;
      title: string | null;
    }
  | {
      rowNumber: number;
      status: "duplicate";
      code: DuplicateCode;
      message: string;
      pmid: string | null;
      title: string | null;
    };

export type ImportSummary = {
  total: number;
  willImport: number;
  flagged: number;
  rejected: number;
  duplicates: number;
};

export type ImportPreview = {
  rows: RowOutcome[];
  summary: ImportSummary;
};

/** Existing PMIDs/DOIs already in the target project, used for cross-import dedup. */
export type ExistingKeys = {
  pmids: Set<string>;
  dois: Set<string>;
};

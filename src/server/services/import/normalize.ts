import { type CellValue, type NormalizedRow, type RawRow } from "./types";

/**
 * Normalization runs BEFORE validation so that cosmetically-messy-but-valid rows survive. For
 * example, the sample file's `" 38910023 "` (padded PMID) and `" DOI:10.1000/NQ.2024.010 "`
 * (prefixed, mixed-case DOI) become valid identifiers here rather than being rejected downstream.
 */

const MIN_PLAUSIBLE_YEAR = 1800;
const maxPlausibleYear = () => new Date().getFullYear() + 1;

/** Trim to a non-empty string, or null. */
function toText(value: CellValue | undefined): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text.length === 0 ? null : text;
}

/** PMIDs are digit strings; strip any internal/edge whitespace. */
function toPmid(value: CellValue | undefined): string | null {
  const text = toText(value);
  return text === null ? null : text.replace(/\s+/g, "");
}

/** DOIs: drop a leading "doi:" prefix, then lowercase (DOIs are case-insensitive). */
function toDoi(value: CellValue | undefined): string | null {
  const text = toText(value);
  if (text === null) return null;
  const stripped = text.replace(/^doi:\s*/i, "").trim().toLowerCase();
  return stripped.length === 0 ? null : stripped;
}

/**
 * Coerce a year cell to a plausible integer. Returns `{ year, suspect }`:
 *  - empty cell          → { null, suspect: false }  (simply absent)
 *  - unparseable / range → { null, suspect: true }   (present but unusable → flag, don't reject)
 *
 * Year is non-critical metadata, so a bad value never rejects an otherwise-valid article — but we
 * flag it (suspectYear) and keep the original text so the table can show it. See /docs/adr/database/0001.
 */
function toYear(value: CellValue | undefined): { year: number | null; suspect: boolean } {
  if (value === null || value === undefined || String(value).trim() === "") {
    return { year: null, suspect: false };
  }
  const parsed = typeof value === "number" ? value : Number(String(value).trim());
  const isPlausible =
    Number.isInteger(parsed) &&
    parsed >= MIN_PLAUSIBLE_YEAR &&
    parsed <= maxPlausibleYear();
  return isPlausible ? { year: parsed, suspect: false } : { year: null, suspect: true };
}

export function normalizeRow(raw: RawRow): NormalizedRow {
  const c = raw.cells;
  const { year, suspect } = toYear(c.year);

  return {
    rowNumber: raw.rowNumber,
    pmid: toPmid(c.pmid),
    doi: toDoi(c.doi),
    title: toText(c.title),
    authors: toText(c.authors),
    firstAuthor: toText(c.firstAuthor),
    journal: toText(c.journal),
    citation: toText(c.citation),
    year,
    rawYear: suspect ? toText(c.year) : null,
    pmcid: toText(c.pmcid),
    nihmsId: toText(c.nihmsId),
    createDate: toText(c.createDate),
    suspectYear: suspect,
  };
}

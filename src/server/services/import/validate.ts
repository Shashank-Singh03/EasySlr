import {
  type ArticleInput,
  type NormalizedRow,
  type RejectionCode,
} from "./types";

export type ValidationResult =
  | { ok: true; article: ArticleInput }
  | { ok: false; code: RejectionCode; message: string };

/**
 * A row is importable only if it has a Title AND at least one identifier (PMID or DOI). Rationale:
 * an article with no title can't be reviewed, and one with no identifier can't be deduplicated or
 * cited. Everything else (e.g. a bad year) is salvaged and flagged, not rejected.
 *
 * Note the sample file confirms this rule's value: row 4 (blank title) is correctly rejected, while
 * row 22 (blank PMID but present DOI + title) is correctly kept.
 */
export function validateRow(row: NormalizedRow): ValidationResult {
  if (row.title === null) {
    return { ok: false, code: "MISSING_TITLE", message: "Row is missing a title" };
  }
  if (row.pmid === null && row.doi === null) {
    return {
      ok: false,
      code: "MISSING_IDENTIFIER",
      message: "Row has neither a PMID nor a DOI",
    };
  }

  return {
    ok: true,
    article: {
      pmid: row.pmid,
      doi: row.doi,
      title: row.title,
      authors: row.authors,
      firstAuthor: row.firstAuthor,
      journal: row.journal,
      citation: row.citation,
      year: row.year,
      rawYear: row.rawYear,
      pmcid: row.pmcid,
      nihmsId: row.nihmsId,
      createDate: row.createDate,
      suspectYear: row.suspectYear,
      possibleDupDoi: false, // decided during dedup/classification
    },
  };
}

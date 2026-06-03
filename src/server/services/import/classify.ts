import { validateRow } from "./validate";
import {
  type ExistingKeys,
  type ImportPreview,
  type NormalizedRow,
  type RowOutcome,
} from "./types";

/**
 * Classify normalized rows into import / reject / duplicate, applying the dedup policy from
 * /docs/adr/database/0001:
 *   - PMID exact match (earlier in this file, or already in the project) is a HARD skip → "duplicate".
 *   - DOI collision (in-file or in-project) is a SOFT flag → still imported, with `possibleDupDoi`.
 *
 * Rows are processed in file order, so the first occurrence of a PMID wins and later ones are the
 * duplicates. The `existing` sets let a second import dedup against what a first import already wrote.
 */
export function classifyRows(
  rows: NormalizedRow[],
  existing: ExistingKeys,
): ImportPreview {
  const seenPmids = new Set<string>();
  const seenDois = new Set<string>();
  const outcomes: RowOutcome[] = [];

  for (const row of rows) {
    const validation = validateRow(row);
    if (!validation.ok) {
      outcomes.push({
        rowNumber: row.rowNumber,
        status: "reject",
        code: validation.code,
        message: validation.message,
        title: row.title,
      });
      continue;
    }

    const article = validation.article;

    // Hard dedup on PMID.
    if (article.pmid !== null) {
      if (seenPmids.has(article.pmid)) {
        outcomes.push({
          rowNumber: row.rowNumber,
          status: "duplicate",
          code: "DUPLICATE_PMID_IN_FILE",
          message: `PMID ${article.pmid} already appears earlier in this file`,
          pmid: article.pmid,
          title: article.title,
        });
        continue;
      }
      if (existing.pmids.has(article.pmid)) {
        outcomes.push({
          rowNumber: row.rowNumber,
          status: "duplicate",
          code: "DUPLICATE_PMID_IN_PROJECT",
          message: `PMID ${article.pmid} is already in this project`,
          pmid: article.pmid,
          title: article.title,
        });
        continue;
      }
      seenPmids.add(article.pmid);
    }

    // Soft flag on DOI — never blocks the import.
    if (article.doi !== null) {
      if (seenDois.has(article.doi) || existing.dois.has(article.doi)) {
        article.possibleDupDoi = true;
      }
      seenDois.add(article.doi);
    }

    outcomes.push({
      rowNumber: row.rowNumber,
      status: "import",
      article,
      flags: {
        suspectYear: article.suspectYear,
        possibleDupDoi: article.possibleDupDoi,
      },
    });
  }

  return { rows: outcomes, summary: summarize(rows.length, outcomes) };
}

function summarize(total: number, outcomes: RowOutcome[]): ImportPreview["summary"] {
  const imports = outcomes.filter((o) => o.status === "import");
  return {
    total,
    willImport: imports.length,
    flagged: imports.filter(
      (o) => o.status === "import" && (o.flags.suspectYear || o.flags.possibleDupDoi),
    ).length,
    rejected: outcomes.filter((o) => o.status === "reject").length,
    duplicates: outcomes.filter((o) => o.status === "duplicate").length,
  };
}

import { readFileSync } from "node:fs";

import { beforeAll, describe, expect, it } from "vitest";

import {
  runImportPipeline,
  type ImportPreview,
  type RowOutcome,
} from "../src/server/services/import";

/**
 * End-to-end pipeline test against the REAL sample file. The sample is effectively a validation
 * harness: each odd row is a deliberate edge case. This test asserts every one lands in the right
 * bucket — it's the single highest-value proof of the import behaviour. Spreadsheet row numbers are
 * 1-based with the header on row 1, so the first data row is row 2.
 */
describe("import pipeline · real sample_article_import.xlsx", () => {
  let preview: ImportPreview;

  beforeAll(async () => {
    const buffer = readFileSync(
      new URL("./fixtures/sample_article_import.xlsx", import.meta.url),
    );
    preview = await runImportPipeline(buffer, {
      pmids: new Set(),
      dois: new Set(),
    });
  });

  const byRow = (rowNumber: number): RowOutcome => {
    const outcome = preview.rows.find((r) => r.rowNumber === rowNumber);
    if (!outcome) throw new Error(`No outcome for row ${rowNumber}`);
    return outcome;
  };

  const importRow = (rowNumber: number) => {
    const outcome = byRow(rowNumber);
    expect(outcome.status, `row ${rowNumber} should import`).toBe("import");
    if (outcome.status !== "import") throw new Error("unreachable");
    return outcome;
  };

  it("rejects a row with a blank title (row 5)", () => {
    const outcome = byRow(5); // PMID 38910004, blank Title
    expect(outcome.status).toBe("reject");
    if (outcome.status !== "reject") throw new Error("unreachable");
    expect(outcome.code).toBe("MISSING_TITLE");
  });

  it("imports but flags a row whose DOI collides with an earlier row's DOI (row 6)", () => {
    // Row 6 (PMID 38910005) shares row 2's DOI but has a different PMID → a distinct article we keep.
    const outcome = importRow(6);
    expect(outcome.flags.possibleDupDoi).toBe(true);
  });

  it("imports a non-numeric year as null + suspectYear, preserving the original (row 7)", () => {
    const outcome = importRow(7); // year cell = "Twenty twenty"
    expect(outcome.flags.suspectYear).toBe(true);
    expect(outcome.article.year).toBeNull();
    expect(outcome.article.rawYear).toBe("Twenty twenty");
  });

  it("hard-skips the second occurrence of a duplicate PMID (row 18)", () => {
    const outcome = byRow(18); // PMID 38910016, same as row 17
    expect(outcome.status).toBe("duplicate");
    if (outcome.status !== "duplicate") throw new Error("unreachable");
    expect(outcome.code).toBe("DUPLICATE_PMID_IN_FILE");
  });

  it("keeps a row that has no PMID but a valid DOI + title (row 22)", () => {
    const outcome = importRow(22);
    expect(outcome.article.pmid).toBeNull();
    expect(outcome.article.doi).not.toBeNull();
  });

  it("imports a future year as null + suspectYear (row 23)", () => {
    const outcome = importRow(23); // year = 2035
    expect(outcome.flags.suspectYear).toBe(true);
    expect(outcome.article.year).toBeNull();
    expect(outcome.article.rawYear).toBe("2035");
  });

  it("normalizes whitespace and DOI casing/prefix into a valid row (row 24)", () => {
    const outcome = importRow(24);
    expect(outcome.article.pmid).toBe("38910023"); // " 38910023 " → trimmed
    expect(outcome.article.doi).toBe("10.1000/nq.2024.010"); // " DOI:10.1000/NQ.2024.010 " → cleaned
  });

  it("produces the expected summary counts", () => {
    expect(preview.summary).toEqual({
      total: 25,
      willImport: 23,
      flagged: 3, // row 6 (DOI), row 7 + row 23 (year)
      rejected: 1, // row 4
      duplicates: 1, // row 18
    });
  });
});

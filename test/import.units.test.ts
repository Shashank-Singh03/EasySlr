import { describe, expect, it } from "vitest";

import { classifyRows } from "../src/server/services/import/classify";
import {
  ImportFileError,
  mapHeaders,
} from "../src/server/services/import/mapHeaders";
import { normalizeRow } from "../src/server/services/import/normalize";
import { type NormalizedRow } from "../src/server/services/import/types";
import { validateRow } from "../src/server/services/import/validate";

/** Build a NormalizedRow with sensible defaults; override only what a test cares about. */
function row(overrides: Partial<NormalizedRow>): NormalizedRow {
  return {
    rowNumber: 2,
    pmid: null,
    doi: null,
    title: "A title",
    authors: null,
    firstAuthor: null,
    journal: null,
    citation: null,
    year: null,
    rawYear: null,
    pmcid: null,
    nihmsId: null,
    createDate: null,
    suspectYear: false,
    ...overrides,
  };
}

describe("normalizeRow", () => {
  it("trims a padded PMID and strips/lowercases a prefixed DOI", () => {
    const result = normalizeRow({
      rowNumber: 2,
      cells: { pmid: " 38910023 ", doi: " DOI:10.1000/NQ.2024.010 ", title: "X" },
    });
    expect(result.pmid).toBe("38910023");
    expect(result.doi).toBe("10.1000/nq.2024.010");
  });

  it("keeps a plausible numeric year and flags nothing", () => {
    const result = normalizeRow({ rowNumber: 2, cells: { year: 2024, title: "X" } });
    expect(result.year).toBe(2024);
    expect(result.suspectYear).toBe(false);
    expect(result.rawYear).toBeNull();
  });

  it("nulls a non-numeric year, flags it, and preserves the original text", () => {
    const result = normalizeRow({
      rowNumber: 2,
      cells: { year: "Twenty twenty", title: "X" },
    });
    expect(result.year).toBeNull();
    expect(result.suspectYear).toBe(true);
    expect(result.rawYear).toBe("Twenty twenty");
  });

  it("nulls and flags a future/out-of-range year", () => {
    const result = normalizeRow({ rowNumber: 2, cells: { year: 2035, title: "X" } });
    expect(result.year).toBeNull();
    expect(result.suspectYear).toBe(true);
  });
});

describe("validateRow", () => {
  it("rejects a missing title", () => {
    const result = validateRow(row({ title: null }));
    expect(result).toMatchObject({ ok: false, code: "MISSING_TITLE" });
  });

  it("rejects a row with neither PMID nor DOI", () => {
    const result = validateRow(row({ pmid: null, doi: null }));
    expect(result).toMatchObject({ ok: false, code: "MISSING_IDENTIFIER" });
  });

  it("accepts a row with a title and at least one identifier", () => {
    const result = validateRow(row({ pmid: "12345" }));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.article.pmid).toBe("12345");
  });
});

describe("mapHeaders", () => {
  it("maps known synonyms case-insensitively (Journal/Book → journal)", () => {
    const map = mapHeaders(["PMID", "Title", "Journal/Book", "DOI"]);
    expect(map).toMatchObject({ pmid: 1, title: 2, journal: 3, doi: 4 });
  });

  it("throws when the Title column is missing", () => {
    expect(() => mapHeaders(["PMID", "Authors"])).toThrow(ImportFileError);
  });

  it("throws when neither PMID nor DOI column is present", () => {
    try {
      mapHeaders(["Title", "Authors"]);
      throw new Error("expected mapHeaders to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(ImportFileError);
      expect((error as ImportFileError).code).toBe("MISSING_REQUIRED_COLUMNS");
    }
  });
});

describe("classifyRows · dedup against existing project data", () => {
  it("treats an existing PMID as an in-project duplicate", () => {
    const result = classifyRows([row({ rowNumber: 2, pmid: "999" })], {
      pmids: new Set(["999"]),
      dois: new Set(),
    });
    expect(result.rows[0]).toMatchObject({
      status: "duplicate",
      code: "DUPLICATE_PMID_IN_PROJECT",
    });
  });

  it("flags (not drops) a row whose DOI already exists in the project", () => {
    const result = classifyRows([row({ rowNumber: 2, doi: "10.1/x" })], {
      pmids: new Set(),
      dois: new Set(["10.1/x"]),
    });
    const outcome = result.rows[0]!;
    expect(outcome.status).toBe("import");
    if (outcome.status === "import") expect(outcome.flags.possibleDupDoi).toBe(true);
  });

  it("hard-skips a duplicate PMID within the same file (first wins)", () => {
    const result = classifyRows(
      [row({ rowNumber: 2, pmid: "5" }), row({ rowNumber: 3, pmid: "5" })],
      { pmids: new Set(), dois: new Set() },
    );
    expect(result.rows[0]!.status).toBe("import");
    expect(result.rows[1]).toMatchObject({
      status: "duplicate",
      code: "DUPLICATE_PMID_IN_FILE",
    });
  });
});

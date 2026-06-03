import ExcelJS from "exceljs";

import { ImportFileError, mapHeaders, type ColumnMap } from "./mapHeaders";
import { ARTICLE_FIELDS, type CellValue, type RawRow } from "./types";

/**
 * Parse an .xlsx buffer into raw rows keyed by canonical field.
 *
 * We load the whole workbook into memory (not the streaming reader). For the assignment's scale —
 * and behind the import upload size cap — this is the simpler, correct choice; streaming + a
 * background worker is the documented seam for large files (see /docs/adr/backend/0002). The first
 * worksheet is used; only the columns present in the header are read; fully-blank rows are skipped.
 */
export async function parseWorkbook(
  buffer: Buffer,
): Promise<{ columnMap: ColumnMap; rawRows: RawRow[] }> {
  const workbook = new ExcelJS.Workbook();

  try {
    // exceljs resolves a different `Buffer` generic than Node 24 exposes, so the types don't line
    // up even though the value is correct at runtime. Cast to exceljs's own expected parameter type.
    type LoadInput = Parameters<typeof workbook.xlsx.load>[0];
    await workbook.xlsx.load(buffer as unknown as LoadInput);
  } catch {
    throw new ImportFileError(
      "NOT_A_WORKBOOK",
      "The file could not be read as an .xlsx workbook",
    );
  }

  const sheet = workbook.worksheets[0];
  if (!sheet) throw new ImportFileError("NO_SHEET", "The workbook has no sheets");
  if (sheet.rowCount < 1) {
    throw new ImportFileError("EMPTY_SHEET", "The sheet has no rows");
  }

  const columnMap = mapHeaders(readHeader(sheet)); // throws on missing required columns

  const rawRows: RawRow[] = [];
  for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber++) {
    const row = sheet.getRow(rowNumber);
    const cells: RawRow["cells"] = {};
    let hasAnyValue = false;

    for (const field of ARTICLE_FIELDS) {
      const column = columnMap[field];
      if (column === undefined) continue;
      const value = cellToPrimitive(row.getCell(column).value);
      cells[field] = value;
      if (value !== null && String(value).trim() !== "") hasAnyValue = true;
    }

    if (hasAnyValue) rawRows.push({ rowNumber, cells });
  }

  return { columnMap, rawRows };
}

function readHeader(sheet: ExcelJS.Worksheet): (string | null)[] {
  const headerCells: (string | null)[] = [];
  sheet.getRow(1).eachCell({ includeEmpty: true }, (cell, column) => {
    const value = cellToPrimitive(cell.value);
    headerCells[column - 1] = value === null ? null : String(value);
  });
  return headerCells;
}

/**
 * exceljs cell values can be string | number | boolean | Date | rich-text | hyperlink | formula
 * objects. Reduce them all to a string/number/null so the rest of the pipeline sees plain data.
 */
function cellToPrimitive(value: ExcelJS.CellValue): CellValue {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value;
  if (typeof value === "number") return value;
  if (typeof value === "boolean") return value ? "true" : "false";
  if (value instanceof Date) return value.toISOString().slice(0, 10);

  if (typeof value === "object") {
    // Hyperlink cell: { text, hyperlink }
    if ("text" in value && typeof value.text === "string") return value.text;
    // Formula cell: { formula, result }
    if ("result" in value) return cellToPrimitive(value.result ?? null);
    // Rich text cell: { richText: [{ text }, ...] }
    if ("richText" in value && Array.isArray(value.richText)) {
      return value.richText.map((part) => part.text).join("");
    }
  }

  // Unknown cell shape (e.g. an error value like { error: '#REF!' }) — treat as empty.
  return null;
}

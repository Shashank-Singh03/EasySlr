/** Minimal, correct CSV serialization (RFC-4180 quoting). Kept tiny on purpose. */

type CsvCell = string | number | boolean | null | undefined | readonly string[];

function escapeCell(value: CsvCell): string {
  if (value === null || value === undefined) return "";
  const text = Array.isArray(value) ? value.join("; ") : String(value);
  // Quote if the value contains a comma, quote, or newline; double any embedded quotes.
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function toCsv(headers: string[], rows: CsvCell[][]): string {
  const lines = [headers, ...rows].map((row) => row.map(escapeCell).join(","));
  return lines.join("\r\n");
}

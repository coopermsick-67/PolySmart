export interface CsvColumn<T> {
  header: string;
  value: (row: T, index: number) => string | number | null;
}

/** Escapes a single CSV field per RFC 4180 — quotes it if it contains a comma, quote, or newline. */
function escapeCsvField(value: string | number | null): string {
  if (value === null) return "";
  const str = String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function buildCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const header = columns.map((c) => escapeCsvField(c.header)).join(",");
  const lines = rows.map((row, index) => columns.map((c) => escapeCsvField(c.value(row, index))).join(","));
  return [header, ...lines].join("\r\n");
}

/** Triggers a browser download of CSV text as a file. Client-side only. */
export function downloadCsv(filename: string, csvContent: string): void {
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

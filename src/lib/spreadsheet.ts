import * as XLSX from "xlsx";

export type SpreadsheetTable = {
  headers: string[];
  rows: string[][];
  sheetName: string;
};

function normalizeCell(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return String(value);
}

export function workbookToTable(workbook: XLSX.WorkBook): SpreadsheetTable {
  const sheetName = workbook.SheetNames[0] ?? "Sheet1";
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    return { headers: [], rows: [], sheetName };
  }

  const matrix = XLSX.utils.sheet_to_json<(string | number | boolean | null)[]>(sheet, {
    header: 1,
    defval: "",
    raw: false,
  });

  if (matrix.length === 0) {
    return { headers: [], rows: [], sheetName };
  }

  const [headerRow, ...dataRows] = matrix;
  const headers = (headerRow ?? []).map(normalizeCell);
  const rows = dataRows
    .map((row) => headers.map((_, index) => normalizeCell(row?.[index])))
    .filter((row) => row.some((cell) => cell.trim() !== ""));

  return { headers, rows, sheetName };
}

export function parseSpreadsheetBuffer(data: ArrayBuffer, filenameHint = ""): SpreadsheetTable {
  const lower = filenameHint.toLowerCase();
  const isCsv = lower.endsWith(".csv");
  const workbook = XLSX.read(data, {
    type: "array",
    raw: false,
    ...(isCsv ? { codepage: 65001 } : {}),
  });
  return workbookToTable(workbook);
}

export async function fetchSpreadsheetTable(path: string): Promise<SpreadsheetTable> {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Failed to load dataset (${response.status})`);
  }
  const buffer = await response.arrayBuffer();
  return parseSpreadsheetBuffer(buffer, path);
}

export function downloadTableAsCsv(table: SpreadsheetTable, filename: string) {
  const sheet = XLSX.utils.aoa_to_sheet([table.headers, ...table.rows]);
  const csv = XLSX.utils.sheet_to_csv(sheet);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  triggerDownload(blob, filename.endsWith(".csv") ? filename : `${filename}.csv`);
}

export function downloadTableAsXlsx(table: SpreadsheetTable, filename: string) {
  const sheet = XLSX.utils.aoa_to_sheet([table.headers, ...table.rows]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, table.sheetName.slice(0, 31) || "Data");
  const base = filename.replace(/\.(csv|xlsx|xls)$/i, "");
  XLSX.writeFile(workbook, `${base}.xlsx`, { compression: true });
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function isSupportedSpreadsheetFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return name.endsWith(".csv") || name.endsWith(".xlsx") || name.endsWith(".xls");
}

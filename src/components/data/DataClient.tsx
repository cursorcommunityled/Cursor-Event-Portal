"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Database,
  Download,
  FileSpreadsheet,
  Loader2,
  Upload,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { HACKATHON_DATASETS, type HackathonDataset } from "@/lib/hackathon-datasets";
import {
  downloadTableAsCsv,
  downloadTableAsXlsx,
  fetchSpreadsheetTable,
  isSupportedSpreadsheetFile,
  parseSpreadsheetBuffer,
  type SpreadsheetTable,
} from "@/lib/spreadsheet";

const PREVIEW_ROW_LIMIT = 12;

export function DataClient() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedId, setSelectedId] = useState(HACKATHON_DATASETS[0]?.id ?? "");
  const [table, setTable] = useState<SpreadsheetTable | null>(null);
  const [activeTitle, setActiveTitle] = useState(HACKATHON_DATASETS[0]?.title ?? "Dataset");
  const [activeFilename, setActiveFilename] = useState(HACKATHON_DATASETS[0]?.filename ?? "dataset");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedDataset = useMemo(
    () => HACKATHON_DATASETS.find((dataset) => dataset.id === selectedId) ?? null,
    [selectedId]
  );

  const loadDataset = useCallback(async (dataset: HackathonDataset) => {
    setLoading(true);
    setError(null);
    try {
      const next = await fetchSpreadsheetTable(dataset.path);
      setTable(next);
      setActiveTitle(dataset.title);
      setActiveFilename(dataset.filename);
      setSelectedId(dataset.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load dataset");
      setTable(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const first = HACKATHON_DATASETS[0];
    if (first) void loadDataset(first);
  }, [loadDataset]);

  const handleLocalFile = useCallback(async (file: File | null) => {
    if (!file) return;
    if (!isSupportedSpreadsheetFile(file)) {
      setError("Please upload a .csv or .xlsx file");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const buffer = await file.arrayBuffer();
      const next = parseSpreadsheetBuffer(buffer, file.name);
      setTable(next);
      setActiveTitle(file.name);
      setActiveFilename(file.name.replace(/\.(csv|xlsx|xls)$/i, ""));
      setSelectedId("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not parse spreadsheet");
      setTable(null);
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, []);

  const previewRows = table?.rows.slice(0, PREVIEW_ROW_LIMIT) ?? [];

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-white/10 bg-black/40 p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <p className="text-[10px] uppercase tracking-[0.35em] text-gray-500 font-bold">
              Build with real-shaped data
            </p>
            <p className="text-sm text-gray-400 max-w-2xl leading-relaxed">
              Anonymized financial datasets for tonight&apos;s builds. All IDs and names are synthetic —
              use them freely for demos, models, and product prototypes. Download as CSV or XLSX.
            </p>
          </div>
          <label className="inline-flex cursor-pointer items-center gap-2 self-start rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-xs font-bold uppercase tracking-[0.18em] text-gray-200 transition hover:bg-white/10">
            <Upload className="h-3.5 w-3.5" />
            Open CSV / XLSX
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
              className="hidden"
              onChange={(event) => void handleLocalFile(event.target.files?.[0] ?? null)}
            />
          </label>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {HACKATHON_DATASETS.map((dataset) => {
          const active = dataset.id === selectedId;
          return (
            <button
              key={dataset.id}
              type="button"
              onClick={() => void loadDataset(dataset)}
              className={cn(
                "rounded-2xl border p-4 text-left transition",
                active
                  ? "border-white/40 bg-white/10"
                  : "border-white/10 bg-black/30 hover:border-white/20 hover:bg-white/5"
              )}
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-black/40">
                  <Database className="h-4 w-4 text-gray-300" />
                </div>
                <div className="min-w-0 space-y-1">
                  <p className="text-sm font-semibold text-white">{dataset.title}</p>
                  <p className="text-xs text-gray-500 leading-relaxed">{dataset.description}</p>
                  <p className="pt-1 text-[10px] uppercase tracking-[0.2em] text-gray-600 font-bold">
                    {dataset.rows} rows · {dataset.columns.length} cols
                  </p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="rounded-2xl border border-white/10 bg-black/40 overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-white/10 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">{activeTitle}</p>
            <p className="text-[10px] uppercase tracking-[0.2em] text-gray-600 font-bold mt-1">
              {table
                ? `${table.rows.length} rows · ${table.headers.length} columns · preview ${Math.min(PREVIEW_ROW_LIMIT, table.rows.length)}`
                : "Select a dataset"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={!table || loading}
              onClick={() => table && downloadTableAsCsv(table, activeFilename)}
              className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white text-black px-3 py-2 text-[11px] font-bold uppercase tracking-[0.15em] disabled:opacity-40"
            >
              <Download className="h-3.5 w-3.5" />
              CSV
            </button>
            <button
              type="button"
              disabled={!table || loading}
              onClick={() => table && downloadTableAsXlsx(table, activeFilename)}
              className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-[11px] font-bold uppercase tracking-[0.15em] text-white disabled:opacity-40"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              XLSX
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 px-5 py-16 text-sm text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading spreadsheet…
          </div>
        ) : error ? (
          <div className="px-5 py-12 text-sm text-red-300">{error}</div>
        ) : !table || table.headers.length === 0 ? (
          <div className="px-5 py-12 text-sm text-gray-500">No rows to preview.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-xs">
              <thead className="bg-white/5 text-[10px] uppercase tracking-[0.16em] text-gray-500">
                <tr>
                  {table.headers.map((header) => (
                    <th key={header} className="whitespace-nowrap px-4 py-3 font-bold">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row, rowIndex) => (
                  <tr key={rowIndex} className="border-t border-white/5 text-gray-300">
                    {row.map((cell, cellIndex) => (
                      <td key={`${rowIndex}-${cellIndex}`} className="whitespace-nowrap px-4 py-2.5">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedDataset && (
        <p className="text-xs text-gray-600 leading-relaxed">
          Tip: join <span className="text-gray-400">{selectedDataset.filename}.csv</span> to other
          datasets on <span className="text-gray-400">employee_id</span> for richer prototypes.
        </p>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";

import { api, type RouterOutputs } from "~/trpc/react";

type ProcessResult = RouterOutputs["import"]["process"];
type Preview = Extract<ProcessResult, { committed: false }>;

/** Read a File as base64 (without the data: prefix). FileReader avoids stack limits on large files. */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1] ?? "");
    reader.onerror = () => reject(new Error("Could not read the file"));
    reader.readAsDataURL(file);
  });
}

function describe(row: Preview["rows"][number]): string {
  if (row.status === "import") return row.article.title;
  if (row.status === "reject") return `${row.title ?? "(no title)"} — ${row.message}`;
  return `${row.title ?? row.pmid ?? "(row)"} — ${row.message}`;
}

const STATUS_STYLES: Record<string, string> = {
  import: "bg-green-100 text-green-800",
  reject: "bg-red-100 text-red-800",
  duplicate: "bg-slate-200 text-slate-700",
};

export function ImportDialog({
  projectId,
  onClose,
  onImported,
}: {
  projectId: string;
  onClose: () => void;
  onImported: () => void;
}) {
  const [filename, setFilename] = useState<string | null>(null);
  const [contentBase64, setContentBase64] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);

  const process = api.import.process.useMutation();

  async function onFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setPreview(null);
    const base64 = await fileToBase64(file);
    setFilename(file.name);
    setContentBase64(base64);
    const result = await process.mutateAsync({
      projectId,
      filename: file.name,
      contentBase64: base64,
      dryRun: true,
    });
    if (!result.committed) setPreview(result);
  }

  async function confirm() {
    if (!filename || !contentBase64) return;
    await process.mutateAsync({ projectId, filename, contentBase64, dryRun: false });
    onImported();
  }

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <h2 className="font-semibold text-slate-900">Import articles</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            ✕
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto px-5 py-4">
          <label className="block text-sm text-slate-600">
            Upload a PubMed-style .xlsx export (max 5 MB):
            <input
              type="file"
              accept=".xlsx"
              onChange={onFile}
              className="mt-2 block w-full text-sm text-slate-700 file:mr-3 file:rounded-md file:border-0 file:bg-slate-900 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-slate-700"
            />
          </label>

          {process.isPending && <p className="text-sm text-slate-500">Reading file…</p>}

          {process.error && (
            <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {process.error.message}
            </p>
          )}

          {preview && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2 text-sm">
                <Stat label="Will import" value={preview.summary.willImport} tone="green" />
                <Stat label="Flagged" value={preview.summary.flagged} tone="violet" />
                <Stat label="Duplicates" value={preview.summary.duplicates} tone="slate" />
                <Stat label="Rejected" value={preview.summary.rejected} tone="red" />
              </div>

              <div className="max-h-64 overflow-y-auto rounded-lg border border-slate-200">
                <table className="w-full text-left text-sm">
                  <thead className="sticky top-0 bg-slate-50 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-3 py-2">Row</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Detail</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {preview.rows.map((row) => (
                      <tr key={row.rowNumber}>
                        <td className="px-3 py-1.5 text-slate-400">{row.rowNumber}</td>
                        <td className="px-3 py-1.5">
                          <span
                            className={`rounded px-1.5 py-0.5 text-xs font-medium ${STATUS_STYLES[row.status]}`}
                          >
                            {row.status}
                          </span>
                        </td>
                        <td className="px-3 py-1.5 text-slate-700">{describe(row)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-3">
          <button
            onClick={onClose}
            className="rounded-md px-4 py-2 text-sm text-slate-600 hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            onClick={confirm}
            disabled={!preview || preview.summary.willImport === 0 || process.isPending}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:opacity-50"
          >
            Import {preview ? preview.summary.willImport : 0} articles
          </button>
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "green" | "violet" | "slate" | "red";
}) {
  const styles = {
    green: "bg-green-50 text-green-800 ring-green-200",
    violet: "bg-violet-50 text-violet-800 ring-violet-200",
    slate: "bg-slate-50 text-slate-700 ring-slate-200",
    red: "bg-red-50 text-red-800 ring-red-200",
  }[tone];
  return (
    <span className={`rounded-md px-2.5 py-1 font-medium ring-1 ${styles}`}>
      {value} {label}
    </span>
  );
}

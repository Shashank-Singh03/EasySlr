"use client";

import { keepPreviousData } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { DecisionBadge, FlagBadges } from "~/components/badges";
import { DECISIONS, DECISION_LABELS, type Decision } from "~/lib/review";
import { api } from "~/trpc/react";

import { ImportDialog } from "./import-dialog";
import { ReviewDrawer } from "./review-drawer";

type SortField = "createdAt" | "year" | "title";

const PAGE_SIZE = 25;

export function Workspace({
  projectId,
  projectName,
  role,
}: {
  projectId: string;
  projectName: string;
  role: "OWNER" | "REVIEWER" | "VIEWER";
}) {
  const canWrite = role !== "VIEWER";
  const isOwner = role === "OWNER";
  const utils = api.useUtils();

  // --- table state ---
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [decision, setDecision] = useState<"" | Decision>("");
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const [sort, setSort] = useState<SortField>("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openArticleId, setOpenArticleId] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  // Debounce the search box; any filter change resets to page 1.
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const list = api.article.list.useQuery(
    {
      projectId,
      page,
      pageSize: PAGE_SIZE,
      search: search || undefined,
      decision: decision || undefined,
      flaggedOnly: flaggedOnly || undefined,
      sort,
      sortDir,
    },
    { placeholderData: keepPreviousData },
  );

  const bulk = api.review.bulkUpdate.useMutation({
    onSuccess: () => {
      setSelected(new Set());
      void utils.article.list.invalidate();
    },
  });

  const undo = api.import.undo.useMutation();

  function toggleSort(field: SortField) {
    if (sort === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSort(field);
      setSortDir(field === "title" ? "asc" : "desc");
    }
    setPage(1);
  }

  function resetFiltersAndReload() {
    setSearchInput("");
    setSearch("");
    setDecision("");
    setFlaggedOnly(false);
    setPage(1);
  }

  async function exportCsv() {
    const result = await utils.export.reviewedCsv.fetch({ projectId });
    const url = URL.createObjectURL(new Blob([result.csv], { type: "text/csv" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = result.filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function undoLastImport() {
    const batches = await utils.import.listBatches.fetch({ projectId });
    const latest = batches[0];
    if (!latest) return;
    try {
      await undo.mutateAsync({ projectId, batchId: latest.id });
    } catch (error) {
      // The guard fires when some imported articles already have decisions.
      if (error instanceof Error && error.message.includes("review decisions")) {
        if (window.confirm(`${error.message}\n\nDelete anyway?`)) {
          await undo.mutateAsync({ projectId, batchId: latest.id, force: true });
        } else {
          return;
        }
      } else {
        throw error;
      }
    }
    void utils.article.list.invalidate();
  }

  const rows = list.data?.rows ?? [];
  const total = list.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasFilters = Boolean(search || decision || flaggedOnly);
  const allOnPageSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));

  function toggleRow(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search title or authors…"
          className="w-64 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
        />
        <select
          value={decision}
          onChange={(e) => {
            setDecision(e.target.value as "" | Decision);
            setPage(1);
          }}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">All decisions</option>
          {DECISIONS.map((d) => (
            <option key={d} value={d}>
              {DECISION_LABELS[d]}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={flaggedOnly}
            onChange={(e) => {
              setFlaggedOnly(e.target.checked);
              setPage(1);
            }}
          />
          Flagged only
        </label>

        <div className="ml-auto flex gap-2">
          <button
            onClick={exportCsv}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Export CSV
          </button>
          {isOwner && (
            <>
              <button
                onClick={undoLastImport}
                disabled={undo.isPending}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Undo last import
              </button>
              <button
                onClick={() => setImportOpen(true)}
                className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700"
              >
                Import
              </button>
            </>
          )}
        </div>
      </div>

      {/* Bulk actions */}
      {canWrite && selected.size > 0 && (
        <div className="flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm text-white">
          <span>{selected.size} selected</span>
          <span className="text-slate-400">·</span>
          <span>Set decision:</span>
          {(["INCLUDE", "EXCLUDE", "MAYBE"] as const).map((d) => (
            <button
              key={d}
              onClick={() =>
                bulk.mutate({ projectId, articleIds: [...selected], decision: d })
              }
              className="rounded bg-white/10 px-2 py-1 hover:bg-white/20"
            >
              {DECISION_LABELS[d]}
            </button>
          ))}
          <button onClick={() => setSelected(new Set())} className="ml-auto text-slate-300 hover:text-white">
            Clear
          </button>
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              {canWrite && (
                <th className="w-10 px-3 py-2">
                  <input
                    type="checkbox"
                    checked={allOnPageSelected}
                    onChange={(e) =>
                      setSelected((prev) => {
                        const next = new Set(prev);
                        rows.forEach((r) =>
                          e.target.checked ? next.add(r.id) : next.delete(r.id),
                        );
                        return next;
                      })
                    }
                  />
                </th>
              )}
              <SortHeader label="Title" active={sort === "title"} dir={sortDir} onClick={() => toggleSort("title")} />
              <SortHeader label="Year" active={sort === "year"} dir={sortDir} onClick={() => toggleSort("year")} />
              <th className="px-3 py-2">Journal</th>
              <th className="px-3 py-2">Decision</th>
              <th className="px-3 py-2">Flags</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {list.isLoading &&
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i}>
                  <td colSpan={6} className="px-3 py-3">
                    <div className="h-4 w-full animate-pulse rounded bg-slate-100" />
                  </td>
                </tr>
              ))}

            {!list.isLoading &&
              rows.map((row) => (
                <tr
                  key={row.id}
                  onClick={() => setOpenArticleId(row.id)}
                  className="cursor-pointer hover:bg-slate-50"
                >
                  {canWrite && (
                    <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selected.has(row.id)}
                        onChange={() => toggleRow(row.id)}
                      />
                    </td>
                  )}
                  <td className="px-3 py-2 font-medium text-slate-900">{row.title}</td>
                  <td className="px-3 py-2 text-slate-600">
                    {row.year ??
                      (row.rawYear ? (
                        <span className="text-amber-700 line-through">{row.rawYear}</span>
                      ) : (
                        "—"
                      ))}
                  </td>
                  <td className="px-3 py-2 text-slate-600">{row.journal ?? "—"}</td>
                  <td className="px-3 py-2">
                    <DecisionBadge decision={row.review?.decision ?? "UNREVIEWED"} />
                  </td>
                  <td className="px-3 py-2">
                    <FlagBadges suspectYear={row.suspectYear} possibleDupDoi={row.possibleDupDoi} />
                  </td>
                </tr>
              ))}
          </tbody>
        </table>

        {list.error && (
          <div className="px-4 py-10 text-center text-sm text-red-600">
            {list.error.message}{" "}
            <button onClick={() => void list.refetch()} className="underline">
              Retry
            </button>
          </div>
        )}

        {!list.isLoading && !list.error && rows.length === 0 && (
          <div className="px-4 py-12 text-center text-sm text-slate-500">
            {hasFilters ? (
              <>
                No articles match these filters.{" "}
                <button onClick={resetFiltersAndReload} className="underline">
                  Clear filters
                </button>
              </>
            ) : isOwner ? (
              <>
                No articles yet.{" "}
                <button onClick={() => setImportOpen(true)} className="underline">
                  Import from an Excel file
                </button>{" "}
                to begin.
              </>
            ) : (
              "No articles yet."
            )}
          </div>
        )}
      </div>

      {/* Pagination */}
      {total > 0 && (
        <div className="flex items-center justify-between text-sm text-slate-500">
          <span>
            {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="rounded-md border border-slate-300 px-3 py-1.5 hover:bg-slate-50 disabled:opacity-40"
            >
              Previous
            </button>
            <span className="px-2 py-1.5">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="rounded-md border border-slate-300 px-3 py-1.5 hover:bg-slate-50 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {openArticleId && (
        <ReviewDrawer
          articleId={openArticleId}
          canWrite={canWrite}
          onClose={() => setOpenArticleId(null)}
          onSaved={() => void utils.article.list.invalidate()}
        />
      )}

      {importOpen && (
        <ImportDialog
          projectId={projectId}
          onClose={() => setImportOpen(false)}
          onImported={() => {
            setImportOpen(false);
            void utils.article.list.invalidate();
          }}
        />
      )}

      <p className="sr-only">{projectName}</p>
    </div>
  );
}

function SortHeader({
  label,
  active,
  dir,
  onClick,
}: {
  label: string;
  active: boolean;
  dir: "asc" | "desc";
  onClick: () => void;
}) {
  return (
    <th className="px-3 py-2">
      <button onClick={onClick} className="flex items-center gap-1 hover:text-slate-900">
        {label}
        {active && <span>{dir === "asc" ? "▲" : "▼"}</span>}
      </button>
    </th>
  );
}

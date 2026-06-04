"use client";

import { useEffect, useState } from "react";

import { DecisionBadge } from "~/components/badges";
import {
  DECISIONS,
  DECISION_LABELS,
  EXCLUSION_REASONS,
  type Decision,
} from "~/lib/review";
import { api } from "~/trpc/react";

export function ReviewDrawer({
  articleId,
  canWrite,
  onClose,
  onSaved,
}: {
  articleId: string;
  canWrite: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const article = api.article.get.useQuery({ articleId });
  const update = api.review.update.useMutation({
    onSuccess: () => {
      void article.refetch();
      onSaved();
    },
  });

  const [decision, setDecision] = useState<Decision>("UNREVIEWED");
  const [exclusionReason, setExclusionReason] = useState("");
  const [priority, setPriority] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [labels, setLabels] = useState("");

  // Re-seed the form whenever a different article loads.
  const data = article.data;
  useEffect(() => {
    if (!data) return;
    setDecision(data.review?.decision ?? "UNREVIEWED");
    setExclusionReason(data.review?.exclusionReason ?? "");
    setPriority(data.review?.priority ? String(data.review.priority) : "");
    setNotes(data.review?.notes ?? "");
    setLabels((data.review?.labels ?? []).join(", "));
  }, [data]);

  function save() {
    if (!data) return;
    update.mutate({
      articleId,
      expectedUpdatedAt: data.review?.updatedAt ?? null,
      decision,
      exclusionReason: decision === "EXCLUDE" ? exclusionReason || null : null,
      priority: priority ? Number(priority) : null,
      notes: notes || null,
      labels: labels
        .split(",")
        .map((l) => l.trim())
        .filter(Boolean),
    });
  }

  return (
    <aside className="fixed inset-y-0 right-0 z-10 flex w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-xl">
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
        <h2 className="font-semibold text-slate-900">Article</h2>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
          ✕
        </button>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
        {article.isLoading && <p className="text-sm text-slate-500">Loading…</p>}
        {article.error && (
          <p role="alert" className="text-sm text-red-600">
            {article.error.message}
          </p>
        )}

        {data && (
          <>
            <div>
              <h3 className="font-medium text-slate-900">{data.title}</h3>
              <dl className="mt-2 space-y-1 text-sm text-slate-600">
                <Field label="Authors" value={data.authors} />
                <Field label="Journal" value={data.journal} />
                <Field
                  label="Year"
                  value={
                    data.year !== null
                      ? String(data.year)
                      : data.rawYear
                        ? `${data.rawYear} (unparsed)`
                        : "—"
                  }
                />
                <Field label="PMID" value={data.pmid} />
                <Field label="DOI" value={data.doi} />
              </dl>
            </div>

            <hr className="border-slate-200" />

            {!canWrite ? (
              <div className="space-y-2 text-sm">
                <p className="text-slate-500">You have read-only access.</p>
                <DecisionBadge decision={data.review?.decision ?? "UNREVIEWED"} />
                {data.review?.notes && <p className="text-slate-700">{data.review.notes}</p>}
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <p className="mb-1 text-sm font-medium text-slate-700">Decision</p>
                  <div className="flex flex-wrap gap-2">
                    {DECISIONS.map((d) => (
                      <button
                        key={d}
                        onClick={() => setDecision(d)}
                        className={`rounded-md border px-3 py-1.5 text-sm ${
                          decision === d
                            ? "border-slate-900 bg-slate-900 text-white"
                            : "border-slate-300 text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        {DECISION_LABELS[d]}
                      </button>
                    ))}
                  </div>
                </div>

                {decision === "EXCLUDE" && (
                  <label className="block text-sm font-medium text-slate-700">
                    Exclusion reason
                    <input
                      list="exclusion-reasons"
                      value={exclusionReason}
                      onChange={(e) => setExclusionReason(e.target.value)}
                      className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    />
                    <datalist id="exclusion-reasons">
                      {EXCLUSION_REASONS.map((r) => (
                        <option key={r} value={r} />
                      ))}
                    </datalist>
                  </label>
                )}

                <label className="block text-sm font-medium text-slate-700">
                  Priority
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  >
                    <option value="">None</option>
                    {[1, 2, 3, 4, 5].map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block text-sm font-medium text-slate-700">
                  Labels (comma-separated)
                  <input
                    value={labels}
                    onChange={(e) => setLabels(e.target.value)}
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>

                <label className="block text-sm font-medium text-slate-700">
                  Notes
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>

                {update.error && (
                  <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                    {update.error.message}
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {canWrite && data && (
        <div className="border-t border-slate-200 px-5 py-3">
          <button
            onClick={save}
            disabled={update.isPending}
            className="w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:opacity-50"
          >
            {update.isPending ? "Saving…" : "Save review"}
          </button>
        </div>
      )}
    </aside>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex gap-2">
      <dt className="w-20 shrink-0 text-slate-400">{label}</dt>
      <dd className="break-words text-slate-700">{value ?? "—"}</dd>
    </div>
  );
}

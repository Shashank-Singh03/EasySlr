import { DECISION_LABELS, DECISION_STYLES, type Decision } from "~/lib/review";

export function DecisionBadge({ decision }: { decision: Decision }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${DECISION_STYLES[decision]}`}
    >
      {DECISION_LABELS[decision]}
    </span>
  );
}

/** Data-quality badges shown on a row (see /docs/adr/database/0001). */
export function FlagBadges({
  suspectYear,
  possibleDupDoi,
}: {
  suspectYear: boolean;
  possibleDupDoi: boolean;
}) {
  if (!suspectYear && !possibleDupDoi) return null;
  return (
    <span className="inline-flex flex-wrap gap-1">
      {suspectYear && (
        <span
          title="The publication year couldn't be parsed and was left blank"
          className="inline-flex rounded bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium text-amber-700 ring-1 ring-amber-200"
        >
          suspect year
        </span>
      )}
      {possibleDupDoi && (
        <span
          title="Another article shares this DOI — review to confirm it isn't a duplicate"
          className="inline-flex rounded bg-violet-50 px-1.5 py-0.5 text-[11px] font-medium text-violet-700 ring-1 ring-violet-200"
        >
          possible dup DOI
        </span>
      )}
    </span>
  );
}

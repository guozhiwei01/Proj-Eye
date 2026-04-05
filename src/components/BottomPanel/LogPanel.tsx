import { useMemo, useState } from "react";
import { localizeErrorMessage, useI18n } from "../../lib/i18n";
import { hasAnomalySignal } from "../../lib/detector";
import { useWorkspaceStore } from "../../store/workspace";
import type { AlertItem, Project } from "../../types/models";

interface LogPanelProps {
  project: Project;
  alert: AlertItem | null;
}

export default function LogPanel({ project, alert }: LogPanelProps) {
  const { locale, t } = useI18n();
  const refreshLogs = useWorkspaceStore((state) => state.refreshLogs);
  const allLogs = useWorkspaceStore((state) => state.logs);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const logs = useMemo(
    () => allLogs.filter((entry) => entry.projectId === project.id).map((entry) => entry.line),
    [allLogs, project.id],
  );

  const lines = logs.length
    ? logs
    : [
        t("logs.waiting"),
        alert ? `[WARN] ${alert.description}` : t("logs.noSignal"),
      ];

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-semibold text-[var(--text0)]">{t("logs.title")}</p>
        <p className="mt-1 text-sm text-[var(--text1)]">{t("logs.description")}</p>
        <div className="mt-3">
          <button
            type="button"
            onClick={() => {
              setBusy(true);
              setError(null);
              void refreshLogs(project.id)
                .catch((nextError) => {
                  setError(localizeErrorMessage(locale, nextError, "logs.refreshError"));
                })
                .finally(() => setBusy(false));
            }}
            className="rounded-full border border-[var(--border)] px-4 py-2 text-xs uppercase tracking-[0.18em] text-[var(--text1)]"
          >
            {busy ? t("logs.refreshing") : t("logs.refresh")}
          </button>
        </div>
        {error ? <p className="mt-3 text-sm text-[var(--red)]">{error}</p> : null}
      </div>

      <div className="rounded-[1.5rem] border border-[var(--border)] bg-[var(--bg1)] p-4">
        <p className="text-xs uppercase tracking-[0.22em] text-[var(--text2)]">
          {project.logSources[0]?.label ?? t("logs.unknownSource")}
        </p>
        <div className="mt-4 space-y-2 font-mono text-sm">
          {lines.map((line, index) => (
            <div
              key={`${line}-${index}`}
              className={hasAnomalySignal(line) ? "text-[var(--red)]" : "text-[var(--text1)]"}
            >
              {line}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

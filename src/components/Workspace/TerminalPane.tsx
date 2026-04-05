import { useI18n } from "../../lib/i18n";
import type { AlertItem, HealthMetrics, Project, SessionSummary } from "../../types/models";

interface TerminalPaneProps {
  project: Project;
  alert: AlertItem | null;
  session: SessionSummary | null;
  metrics: HealthMetrics;
  commandDraft: string;
  commandError: string | null;
  commandBusy: boolean;
  onCommandChange: (value: string) => void;
  onCommandRun: () => void;
}

export default function TerminalPane({
  project,
  alert,
  session,
  metrics,
  commandDraft,
  commandError,
  commandBusy,
  onCommandChange,
  onCommandRun,
}: TerminalPaneProps) {
  const { t } = useI18n();

  const lines =
    session && session.transcript.length > 0
      ? session.transcript
      : [`cd ${project.rootPath}`, t("workspace.awaitingSession")];

  return (
    <div className="rounded-[2rem] border border-[var(--border)] bg-[linear-gradient(180deg,var(--bg1),var(--bg0))] p-4 shadow-[0_18px_90px_rgba(0,0,0,0.2)]">
      <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-[var(--red)]" />
          <span className="h-3 w-3 rounded-full bg-[var(--yellow)]" />
          <span className="h-3 w-3 rounded-full bg-[var(--accent)]" />
        </div>
        <p className="text-xs uppercase tracking-[0.24em] text-[var(--text2)]">
          {t("workspace.metrics", {
            cpu: metrics.cpu,
            memory: metrics.memory,
            logs: metrics.logRate,
          })}
        </p>
      </div>

      <pre className="mt-4 overflow-x-auto text-sm leading-7 text-[var(--text1)]">
        {lines.map((line, index) => (
          <div
            key={`${line}-${index}`}
            className={/error|exception|timeout/i.test(line) ? "text-[var(--red)]" : undefined}
          >
            {line}
          </div>
        ))}
      </pre>

      {alert ? (
        <p className="mt-4 rounded-2xl border border-[var(--red)] bg-[rgba(239,71,111,0.08)] px-4 py-3 text-sm text-[var(--text0)]">
          {alert.title}: {alert.description}
        </p>
      ) : null}

      <form
        onSubmit={(event) => {
          event.preventDefault();
          onCommandRun();
        }}
        className="mt-4 rounded-[1.5rem] border border-[var(--border)] bg-[var(--bg0)]/80 p-3"
      >
        <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] pb-3">
          <p className="text-xs uppercase tracking-[0.22em] text-[var(--text2)]">
            {session ? t("workspace.cwd", { cwd: session.cwd }) : t("workspace.remoteCommand")}
          </p>
          <button
            type="submit"
            disabled={!session || commandBusy}
            className="rounded-full border border-[var(--accent)] px-4 py-2 text-xs uppercase tracking-[0.18em] text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {commandBusy ? t("workspace.running") : t("workspace.run")}
          </button>
        </div>

        <input
          value={commandDraft}
          onChange={(event) => onCommandChange(event.currentTarget.value)}
          disabled={!session || commandBusy}
          placeholder={t("workspace.commandPlaceholder")}
          className="mt-3 w-full rounded-2xl border border-[var(--border)] bg-[var(--bg1)] px-4 py-3 font-mono text-sm text-[var(--text0)] outline-none disabled:cursor-not-allowed disabled:opacity-60"
        />
        {commandError ? <p className="mt-3 text-sm text-[var(--red)]">{commandError}</p> : null}
      </form>
    </div>
  );
}

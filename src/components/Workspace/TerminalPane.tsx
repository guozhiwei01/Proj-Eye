import { useI18n } from "../../lib/i18n";
import type { AlertItem, HealthMetrics, Project, SessionSummary } from "../../types/models";

const ERROR_RE = /error|exception|timeout/i;

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
    <div className="flex h-full flex-col rounded-[10px] border border-white/8 bg-[#101010]">
      <div className="flex items-center justify-between border-b border-white/8 px-4 py-3">
        <div className="flex items-center gap-2" role="presentation" aria-hidden="true">
          <span className="h-3 w-3 rounded-full bg-[var(--red)]" />
          <span className="h-3 w-3 rounded-full bg-[var(--yellow)]" />
          <span className="h-3 w-3 rounded-full bg-[var(--accent)]" />
        </div>
        <p className="text-[10px] uppercase tracking-[0.18em] text-white/40">
          {t("workspace.metrics", {
            cpu: metrics.cpu,
            memory: metrics.memory,
            logs: metrics.logRate,
          })}
        </p>
      </div>

      <pre
        aria-label={t("workspace.remoteCommand")}
        aria-live="polite"
        aria-atomic="false"
        className="min-h-0 flex-1 overflow-auto px-4 py-4 font-mono text-[15px] leading-7 text-white/82"
      >
        {lines.map((line, index) => (
          <div
            key={index}
            className={ERROR_RE.test(line) ? "text-[var(--red)]" : undefined}
          >
            {line}
          </div>
        ))}
      </pre>

      {alert ? (
        <p className="mx-4 mb-4 rounded-md border border-[var(--red)]/50 bg-[rgba(239,71,111,0.08)] px-4 py-3 text-sm text-white">
          {alert.title}: {alert.description}
        </p>
      ) : null}

      <form
        onSubmit={(event) => {
          event.preventDefault();
          onCommandRun();
        }}
        className="border-t border-white/8 bg-[#151515] px-4 py-3"
      >
        <div className="flex items-center justify-between gap-3">
          <p className="text-[10px] uppercase tracking-[0.18em] text-white/40">
            {session ? t("workspace.cwd", { cwd: session.cwd }) : t("workspace.remoteCommand")}
          </p>
          <button
            type="submit"
            disabled={!session || commandBusy}
            className="rounded-md border border-white/10 bg-black/20 px-3 py-1.5 text-[10px] uppercase tracking-[0.18em] text-white/74 transition hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {commandBusy ? t("workspace.running") : t("workspace.run")}
          </button>
        </div>

        <label htmlFor="terminal-command-input" className="sr-only">
          {t("workspace.commandPlaceholder")}
        </label>
        <input
          id="terminal-command-input"
          value={commandDraft}
          onChange={(event) => onCommandChange(event.currentTarget.value)}
          disabled={!session || commandBusy}
          placeholder={t("workspace.commandPlaceholder")}
          autoComplete="off"
          spellCheck={false}
          className="mt-3 w-full rounded-md border border-white/10 bg-[#0f0f10] px-3 py-2.5 font-mono text-sm text-white outline-none transition focus:border-white/20 disabled:cursor-not-allowed disabled:opacity-60"
        />
        {commandError ? <p className="mt-3 text-sm text-[var(--red)]">{commandError}</p> : null}
      </form>
    </div>
  );
}

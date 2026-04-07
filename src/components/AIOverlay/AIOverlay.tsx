import { startTransition, useState } from "react";
import { useI18n } from "../../lib/i18n";
import { useAiStore } from "../../store/ai";
import { usePanelsStore } from "../../store/panels";
import { AIStatus, type AlertItem, type DatabaseResource, type Project, type Server } from "../../types/models";
import CommandConfirm from "./CommandConfirm";
import ContextSummary from "./ContextSummary";
import ConversationArea from "./ConversationArea";

const EMPTY_MESSAGES = [] as const;

interface AIOverlayProps {
  project: Project;
  server: Server;
  databases: DatabaseResource[];
  alert: AlertItem | null;
}

export default function AIOverlay({ project, server, databases, alert }: AIOverlayProps) {
  const { t } = useI18n();
  const [prompt, setPrompt] = useState("");
  const isAiOpen = usePanelsStore((state) => state.isAiOpen);
  const toggleAiOverlay = usePanelsStore((state) => state.toggleAiOverlay);
  const projectMessages = useAiStore((state) => state.messagesByProject[project.id]);
  const suggestion = useAiStore((state) => state.suggestionsByProject[project.id] ?? null);
  const status = useAiStore((state) => state.statusByProject[project.id] ?? AIStatus.Ready);
  const analyze = useAiStore((state) => state.analyze);
  const sendFollowup = useAiStore((state) => state.sendFollowup);
  const confirmSuggestion = useAiStore((state) => state.confirmSuggestion);
  const messages = projectMessages ?? EMPTY_MESSAGES;
  const isBusy = status === AIStatus.Analyzing;

  async function handleSendPrompt(): Promise<void> {
    const nextPrompt = prompt.trim();
    if (!nextPrompt || isBusy) {
      return;
    }

    await sendFollowup(
      project.id,
      project.name,
      databases.map((database) => `${database.name}:${database.type}`),
      nextPrompt,
    );
    startTransition(() => setPrompt(""));
  }

  return (
    <aside
      aria-label={t("ai.heading")}
      className={`w-full shrink-0 transition-[opacity,transform] duration-300 xl:w-[360px] ${
        isAiOpen ? "translate-x-0 opacity-100" : "pointer-events-none xl:w-0 xl:translate-x-4 xl:opacity-0"
      }`}
    >
      <div className="flex h-full flex-col gap-4 rounded-[2rem] border border-[var(--border)] bg-[linear-gradient(180deg,var(--bg1),var(--bg2))] p-4 shadow-[0_18px_80px_rgba(0,0,0,0.22)]">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-[var(--accent2)]">{t("ai.overlay")}</p>
            <h3 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--text0)]">{t("ai.heading")}</h3>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              aria-label={t("ai.analyze")}
              onClick={() =>
                void analyze(
                  project.id,
                  project.name,
                  databases.map((database) => `${database.name}:${database.type}`),
                )
              }
              disabled={isBusy}
              className="rounded-full border border-[var(--accent)] px-3 py-2 text-xs uppercase tracking-[0.18em] text-[var(--accent)] transition hover:bg-[var(--accent)]/10"
            >
              {t("ai.analyze")}
            </button>
            <button
              type="button"
              aria-label={t("ai.close")}
              onClick={toggleAiOverlay}
              className="rounded-full border border-[var(--border)] px-3 py-2 text-xs uppercase tracking-[0.18em] text-[var(--text1)] transition hover:border-[var(--border2)]"
            >
              {t("ai.close")}
            </button>
          </div>
        </div>

        <ContextSummary project={project} server={server} databases={databases} alert={alert} />
        <ConversationArea messages={messages} status={status} />
        <section className="rounded-[1.5rem] border border-[var(--border)] bg-[var(--bg1)] p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs uppercase tracking-[0.22em] text-[var(--text2)]">{t("ai.followUp")}</p>
            <span className="text-[11px] text-[var(--text2)]">{t("ai.sendHint")}</span>
          </div>

          <form
            className="mt-3"
            onSubmit={(event) => {
              event.preventDefault();
              void handleSendPrompt();
            }}
          >
            <textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void handleSendPrompt();
                }
              }}
              placeholder={t("ai.askPlaceholder")}
              rows={3}
              className="w-full resize-none rounded-2xl border border-[var(--border)] bg-[var(--bg0)] px-4 py-3 text-sm leading-6 text-[var(--text0)] outline-none transition placeholder:text-[var(--text2)] focus:border-[var(--accent2)]"
            />
            <div className="mt-3 flex justify-end">
              <button
                type="submit"
                disabled={isBusy || !prompt.trim()}
                className="rounded-full border border-[var(--accent)] px-4 py-2 text-xs uppercase tracking-[0.18em] text-[var(--accent)] transition hover:bg-[var(--accent)]/10 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isBusy ? t("ai.sending") : t("ai.send")}
              </button>
            </div>
          </form>
        </section>
        <CommandConfirm suggestion={suggestion} busy={isBusy} onConfirm={() => void confirmSuggestion(project.id)} />
      </div>
    </aside>
  );
}

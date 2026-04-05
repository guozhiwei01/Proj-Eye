import { useI18n } from "../../lib/i18n";
import { useAiStore } from "../../store/ai";
import { usePanelsStore } from "../../store/panels";
import type { AlertItem, DatabaseResource, Project, Server } from "../../types/models";
import CommandConfirm from "./CommandConfirm";
import ContextSummary from "./ContextSummary";
import ConversationArea from "./ConversationArea";

interface AIOverlayProps {
  project: Project;
  server: Server;
  databases: DatabaseResource[];
  alert: AlertItem | null;
}

export default function AIOverlay({ project, server, databases, alert }: AIOverlayProps) {
  const { t } = useI18n();
  const isAiOpen = usePanelsStore((state) => state.isAiOpen);
  const toggleAiOverlay = usePanelsStore((state) => state.toggleAiOverlay);
  const messages = useAiStore((state) => state.messagesByProject[project.id] ?? []);
  const suggestion = useAiStore((state) => state.suggestionsByProject[project.id] ?? null);
  const status = useAiStore((state) => state.status);
  const analyze = useAiStore((state) => state.analyze);
  const confirmSuggestion = useAiStore((state) => state.confirmSuggestion);

  return (
    <aside
      className={`w-full shrink-0 transition-all duration-300 xl:w-[360px] ${
        isAiOpen ? "translate-x-0 opacity-100" : "pointer-events-none xl:w-0 xl:translate-x-6 xl:opacity-0"
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
              onClick={() =>
                void analyze(
                  project.id,
                  project.name,
                  databases.map((database) => `${database.name}:${database.type}`),
                )
              }
              className="rounded-full border border-[var(--accent)] px-3 py-2 text-xs uppercase tracking-[0.18em] text-[var(--accent)]"
            >
              {t("ai.analyze")}
            </button>
            <button
              type="button"
              onClick={toggleAiOverlay}
              className="rounded-full border border-[var(--border)] px-3 py-2 text-xs uppercase tracking-[0.18em] text-[var(--text1)]"
            >
              {t("ai.close")}
            </button>
          </div>
        </div>

        <ContextSummary project={project} server={server} databases={databases} alert={alert} />
        <ConversationArea messages={messages} status={status} />
        <CommandConfirm suggestion={suggestion} onConfirm={() => void confirmSuggestion(project.id)} />
      </div>
    </aside>
  );
}

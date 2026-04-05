import { useI18n } from "../../lib/i18n";
import type { AlertItem, DatabaseResource, Project, Server } from "../../types/models";
import Badge from "../shared/Badge";

interface ContextSummaryProps {
  project: Project;
  server: Server;
  databases: DatabaseResource[];
  alert: AlertItem | null;
}

export default function ContextSummary({ project, server, databases, alert }: ContextSummaryProps) {
  const { t } = useI18n();

  return (
    <section className="rounded-[1.5rem] border border-[var(--border)] bg-[var(--bg1)] p-4">
      <p className="text-xs uppercase tracking-[0.22em] text-[var(--text2)]">{t("ai.contextSummary")}</p>
      <div className="mt-3 space-y-3 text-sm text-[var(--text1)]">
        <div>
          <p className="font-medium text-[var(--text0)]">{project.name}</p>
          <p className="mt-1">
            {server.username}@{server.host}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {databases.map((database) => (
            <Badge key={database.id} tone="info">
              {database.name}
            </Badge>
          ))}
        </div>
        <div className="rounded-2xl border border-[var(--border)] px-3 py-3">
          <p className="text-xs uppercase tracking-[0.18em] text-[var(--text2)]">{t("ai.currentSignal")}</p>
          <p className="mt-2">{alert?.description ?? t("ai.waitingSignal")}</p>
        </div>
      </div>
    </section>
  );
}

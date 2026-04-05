import { useI18n } from "../../lib/i18n";
import type { AppHealthSnapshot, DatabaseResource, Project, Server } from "../../types/models";
import Badge from "../shared/Badge";
import StatusDot from "../shared/StatusDot";

interface WorkspaceHeaderProps {
  project: Project;
  server: Server;
  databases: DatabaseResource[];
  backendHealth: AppHealthSnapshot | null;
  backendError: string | null;
}

export default function WorkspaceHeader({
  project,
  server,
  databases,
  backendHealth,
  backendError,
}: WorkspaceHeaderProps) {
  const { t } = useI18n();

  return (
    <header className="rounded-[2rem] border border-[var(--border)] bg-[linear-gradient(135deg,var(--bg1),var(--bg2))] px-6 py-5 shadow-[0_12px_60px_rgba(0,0,0,0.18)]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <StatusDot status={project.health} />
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-[var(--accent)]">{t("workspace.title")}</p>
              <h2 className="text-3xl font-semibold tracking-tight text-[var(--text0)]">{project.name}</h2>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge tone="info">{server.host}</Badge>
            <Badge>{project.rootPath}</Badge>
            {databases.map((database) => (
              <Badge key={database.id} tone="accent">
                {database.name}
              </Badge>
            ))}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-[1.5rem] border border-[var(--border)] bg-[var(--bg0)]/50 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.24em] text-[var(--text2)]">{t("workspace.serverContext")}</p>
            <p className="mt-2 text-sm text-[var(--text0)]">{server.name}</p>
            <p className="mt-1 text-sm text-[var(--text1)]">
              {server.username}@{server.host}:{server.port}
            </p>
          </div>

          <div className="rounded-[1.5rem] border border-[var(--border)] bg-[var(--bg0)]/50 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.24em] text-[var(--text2)]">{t("workspace.tauriBridge")}</p>
            <p className="mt-2 text-sm text-[var(--text0)]">
              {backendError ? t("workspace.frontendPreview") : backendHealth?.stage ?? t("workspace.connecting")}
            </p>
            <p className="mt-1 text-sm text-[var(--text1)]">
              {backendError ? backendError : `${backendHealth?.app ?? "Proj-Eye"} / v${backendHealth?.version ?? "0.1.0"}`}
            </p>
          </div>
        </div>
      </div>
    </header>
  );
}

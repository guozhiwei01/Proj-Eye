import { environmentLabel, useI18n } from "../../lib/i18n";
import { Environment, ProjectHealth, type Project } from "../../types/models";
import Badge from "../shared/Badge";
import StatusDot from "../shared/StatusDot";

interface ProjectItemProps {
  project: Project;
  active: boolean;
  onSelect: (projectId: string) => void;
}

function resolveEnvironmentTone(project: Project) {
  switch (project.environment) {
    case Environment.Production:
      return project.health === ProjectHealth.Error ? "danger" : "warning";
    case Environment.Staging:
      return "info";
    default:
      return "neutral";
  }
}

export default function ProjectItem({ project, active, onSelect }: ProjectItemProps) {
  const { locale, t } = useI18n();

  return (
    <button
      type="button"
      onClick={() => onSelect(project.id)}
      className={`w-full rounded-3xl border px-4 py-4 text-left transition ${
        active
          ? "border-[var(--accent)] bg-[var(--bg3)] shadow-[0_16px_60px_rgba(0,0,0,0.18)]"
          : "border-[var(--border)] bg-[var(--bg2)] hover:border-[var(--border2)] hover:bg-[var(--bg3)]"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <StatusDot status={project.health} />
            <p className="text-sm font-semibold text-[var(--text0)]">{project.name}</p>
          </div>
          <p className="mt-1 text-xs uppercase tracking-[0.18em] text-[var(--text2)]">{project.rootPath}</p>
        </div>
        <Badge tone={resolveEnvironmentTone(project)}>{environmentLabel(locale, project.environment)}</Badge>
      </div>

      <div className="mt-4">
        <p className="text-xs leading-5 text-[var(--text1)]">{project.recentIssue ?? t("project.noIncident")}</p>
      </div>
    </button>
  );
}

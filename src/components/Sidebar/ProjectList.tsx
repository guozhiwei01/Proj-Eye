import { useI18n } from "../../lib/i18n";
import type { Project } from "../../types/models";
import EmptyState from "../shared/EmptyState";
import ProjectItem from "./ProjectItem";

interface ProjectListProps {
  title: string;
  projects: Project[];
  activeProjectId: string;
  onSelect: (projectId: string) => void;
  emptyDescription: string;
}

export default function ProjectList({
  title,
  projects,
  activeProjectId,
  onSelect,
  emptyDescription,
}: ProjectListProps) {
  const { t } = useI18n();

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs uppercase tracking-[0.22em] text-[var(--text2)]">{title}</h3>
        <span className="text-xs text-[var(--text2)]">{projects.length}</span>
      </div>

      {projects.length === 0 ? (
        <EmptyState title={t("sidebar.emptyTitle")} description={emptyDescription} />
      ) : (
        <div className="space-y-3">
          {projects.map((project) => (
            <ProjectItem
              key={project.id}
              project={project}
              active={project.id === activeProjectId}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </section>
  );
}

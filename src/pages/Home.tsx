import { useEffect, useMemo } from "react";
import Workbench from "../components/Workbench/Workbench";
import { useI18n } from "../lib/i18n";
import { useAppStore } from "../store/app";
import { useWorkspaceStore } from "../store/workspace";
import { AlertLevel, FilterMode, type AlertItem, type Locale, type Project } from "../types/models";

const ANOMALY_RE = /error|warn|exception|timeout/i;
const ERROR_RE = /error|exception|timeout/i;

function filterProjects(projects: Project[], searchQuery: string, filterMode: string) {
  const normalizedQuery = searchQuery.toLowerCase().trim();

  return projects.filter((project) => {
    const matchesSearch =
      normalizedQuery.length === 0 ||
      project.name.toLowerCase().includes(normalizedQuery) ||
      project.tags.some((tag) => tag.toLowerCase().includes(normalizedQuery)) ||
      project.recentIssue?.toLowerCase().includes(normalizedQuery);

    if (!matchesSearch) {
      return false;
    }

    switch (filterMode) {
      case FilterMode.Alerting:
        return Boolean(project.recentIssue);
      case FilterMode.Production:
      case FilterMode.Staging:
      case FilterMode.Development:
        return project.environment === filterMode;
      default:
        return true;
    }
  });
}

function buildAlert(project: Project, logLines: string[], locale: Locale): AlertItem | null {
  const recentError = logLines.find((line) => ANOMALY_RE.test(line));
  if (!recentError && !project.recentIssue) {
    return null;
  }

  return {
    id: `${project.id}-alert`,
    projectId: project.id,
    level: ERROR_RE.test(recentError ?? project.recentIssue ?? "")
      ? AlertLevel.Error
      : AlertLevel.Warning,
    title:
      project.recentIssue ??
      (locale === "zh-CN" ? "\u6700\u8fd1\u65e5\u5fd7\u51fa\u73b0\u5f02\u5e38\u4fe1\u53f7" : "Anomaly detected in recent logs"),
    description:
      recentError ??
      project.recentIssue ??
      (locale === "zh-CN"
        ? "\u6700\u8fd1\u65e5\u5fd7\u5305\u542b warning / error \u6807\u8bb0\u3002"
        : "Recent log lines contain warning markers."),
    source: project.logSources[0]?.label ?? "runtime",
    createdAt: Date.now(),
  };
}

export default function Home() {
  const { locale } = useI18n();
  const config = useAppStore((state) => state.config);
  const searchQuery = useAppStore((state) => state.searchQuery);
  const filterMode = useAppStore((state) => state.filterMode);
  const activeProjectId = useAppStore((state) => state.activeProjectId);
  const health = useAppStore((state) => state.health);
  const healthError = useAppStore((state) => state.healthError);
  const hydrateProject = useWorkspaceStore((state) => state.hydrateProject);
  const logs = useWorkspaceStore((state) => state.logs);

  const filteredProjects = useMemo(
    () => filterProjects(config.projects, searchQuery, filterMode),
    [config.projects, searchQuery, filterMode],
  );

  const activeProject =
    filteredProjects.find((project) => project.id === activeProjectId) ??
    config.projects.find((project) => project.id === activeProjectId) ??
    filteredProjects[0] ??
    config.projects[0] ??
    null;

  useEffect(() => {
    if (!activeProject) {
      return;
    }

    void hydrateProject(activeProject.id);
  }, [activeProject, hydrateProject]);

  const activeServer = useMemo(
    () =>
      activeProject
        ? config.servers.find((server) => server.id === activeProject.serverId) ?? null
        : null,
    [activeProject, config.servers],
  );

  const activeDatabases = useMemo(
    () =>
      activeProject
        ? config.databases.filter((database) => activeProject.databaseIds.includes(database.id))
        : [],
    [activeProject, config.databases],
  );

  const activeLogs = useMemo(
    () =>
      activeProject
        ? logs.filter((entry) => entry.projectId === activeProject.id).map((entry) => entry.line)
        : [],
    [activeProject, logs],
  );

  const activeAlert = useMemo(
    () => (activeProject ? buildAlert(activeProject, activeLogs, locale) : null),
    [activeProject, activeLogs, locale],
  );

  return (
    <Workbench
      projects={filteredProjects}
      activeProject={activeProject}
      activeServer={activeServer}
      activeDatabases={activeDatabases}
      alert={activeAlert}
      backendHealth={health}
      backendError={healthError}
    />
  );
}

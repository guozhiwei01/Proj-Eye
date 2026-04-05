import { useEffect, useMemo } from "react";
import AIOverlay from "../components/AIOverlay/AIOverlay";
import BottomPanel from "../components/BottomPanel/BottomPanel";
import Sidebar from "../components/Sidebar/Sidebar";
import Workspace from "../components/Workspace/Workspace";
import { useI18n } from "../lib/i18n";
import CreateProject from "./CreateProject";
import Settings from "./Settings";
import { useAppStore } from "../store/app";
import { useWorkspaceStore } from "../store/workspace";
import { AlertLevel, AppView, FilterMode, type AlertItem, type Locale, type Project } from "../types/models";

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
      (locale === "zh-CN" ? "最近日志中检测到异常信号" : "Anomaly detected in recent logs"),
    description:
      recentError ??
      project.recentIssue ??
      (locale === "zh-CN"
        ? "最近日志包含 warning / error 标记。"
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
  const activeView = useAppStore((state) => state.activeView);
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
    if (activeView !== AppView.Workspace || !activeProject) {
      return;
    }

    void hydrateProject(activeProject.id);
  }, [activeProject, activeView, hydrateProject]);

  const activeServer = useMemo(
    () => activeProject ? config.servers.find((server) => server.id === activeProject.serverId) ?? null : null,
    [activeProject, config.servers],
  );
  const activeDatabases = useMemo(
    () => activeProject ? config.databases.filter((db) => activeProject.databaseIds.includes(db.id)) : [],
    [activeProject, config.databases],
  );
  const activeLogs = useMemo(
    () => activeProject ? logs.filter((e) => e.projectId === activeProject.id).map((e) => e.line) : [],
    [activeProject, logs],
  );
  const activeAlert = useMemo(
    () => activeProject ? buildAlert(activeProject, activeLogs, locale) : null,
    [activeProject, activeLogs, locale],
  );

  let content = null;

  if (activeView === AppView.Manage || config.projects.length === 0) {
    content = <CreateProject />;
  } else if (activeView === AppView.Settings) {
    content = <Settings />;
  } else if (activeProject && activeServer) {
    content = (
      <>
        <Workspace
          project={activeProject}
          server={activeServer}
          databases={activeDatabases}
          alert={activeAlert}
          backendHealth={health}
          backendError={healthError}
        />
        <BottomPanel project={activeProject} databases={activeDatabases} alert={activeAlert} />
      </>
    );
  } else {
    content = <CreateProject />;
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-[1820px] flex-col gap-4 p-4 xl:flex-row xl:items-start">
      <Sidebar projects={filteredProjects} activeProjectId={activeProject?.id ?? ""} />
      <div className="min-w-0 flex-1 space-y-4">{content}</div>
      {activeView === AppView.Workspace && activeProject && activeServer ? (
        <AIOverlay
          project={activeProject}
          server={activeServer}
          databases={activeDatabases}
          alert={activeAlert}
        />
      ) : null}
    </main>
  );
}

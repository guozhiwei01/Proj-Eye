import { startTransition, useEffect, useMemo, useState, type ReactNode } from "react";
import CommandConfirm from "../AIOverlay/CommandConfirm";
import ConversationArea from "../AIOverlay/ConversationArea";
import FilterBar from "../Sidebar/FilterBar";
import SearchBar from "../Sidebar/SearchBar";
import EmptyState from "../shared/EmptyState";
import Badge from "../shared/Badge";
import StatusDot from "../shared/StatusDot";
import TerminalPane from "../Workspace/TerminalPane";
import TerminalTabs from "../Workspace/TerminalTabs";
import { databaseTypeLabel, localizeErrorMessage, useI18n } from "../../lib/i18n";
import { hasAnomalySignal } from "../../lib/detector";
import {
  buildProjectFolderTree,
  collectExpandedFolderIds,
  getProjectManagerPath,
  managerPathLabel,
  type ProjectFolderNode,
} from "../../lib/project-manager";
import { useAiStore } from "../../store/ai";
import { useAppStore } from "../../store/app";
import { useWorkspaceStore } from "../../store/workspace";
import {
  AIStatus,
  DatabaseType,
  type AIMessage,
  type AlertItem,
  type AppHealthSnapshot,
  type DatabaseResource,
  type LogChunk,
  type Project,
  type Server,
} from "../../types/models";
import ManagementDialogs, { type WorkbenchDialogState } from "./ManagementDialogs";

interface WorkbenchProps {
  projects: Project[];
  activeProject: Project | null;
  activeServer: Server | null;
  activeDatabases: DatabaseResource[];
  alert: AlertItem | null;
  backendHealth: AppHealthSnapshot | null;
  backendError: string | null;
}

type ResourceSectionKey = "server" | "database" | "logs" | "provider";

const EMPTY_MESSAGES: AIMessage[] = [];
const EMPTY_LOGS: LogChunk[] = [];

function workbenchText(locale: string) {
  if (locale === "zh-CN") {
    return {
      projectManager: "项目管理器",
      aiConsole: "AI 对话",
      terminal: "终端",
      resources: "关联资源",
      newProject: "新建项目",
      newServer: "新建服务器",
      newDatabase: "新建数据库",
      newProvider: "新建 Provider",
      settings: "设置",
      emptyProjectTitle: "还没有可用项目",
      emptyProjectDescription: "先在左侧项目树里新建项目，或者先绑定服务器和数据库。",
      project: "项目",
      resourceServer: "服务器",
      resourceDatabase: "数据库",
      resourceLogs: "日志",
      resourceProvider: "AI 路由",
      activeSignal: "当前信号",
      askPlaceholder: "围绕当前项目、日志、命令继续追问...",
      send: "发送",
      analyzing: "分析中...",
      sendHint: "Enter 发送，Shift+Enter 换行",
      query: "只读查询",
      runQuery: "执行",
      refreshLogs: "刷新",
      noDatabases: "当前项目还没有绑定数据库。",
      noLogs: "日志还没有推送，可以先刷新一次。",
      treeHint: "最后一级一定是项目叶子节点，支持多级分组。",
      providerHint: "这里管理当前工作台使用的 Provider。",
      databaseResult: "查询结果",
      close: "收起",
      selectedDetails: "当前选中",
      noSelection: "未选择项目",
    };
  }

  return {
    projectManager: "Project Manager",
    aiConsole: "AI Console",
    terminal: "Terminal",
    resources: "Resources",
    newProject: "New project",
    newServer: "New server",
    newDatabase: "New database",
    newProvider: "New provider",
    settings: "Settings",
    emptyProjectTitle: "No active project yet",
    emptyProjectDescription: "Create a project in the tree first, or bind a server and database.",
    project: "Project",
    resourceServer: "Server",
    resourceDatabase: "Database",
    resourceLogs: "Logs",
    resourceProvider: "AI routes",
    activeSignal: "Current signal",
    askPlaceholder: "Ask about the current project, logs, or command next...",
    send: "Send",
    analyzing: "Analyzing...",
    sendHint: "Enter sends, Shift+Enter adds a line",
    query: "Readonly query",
    runQuery: "Run",
    refreshLogs: "Refresh",
    noDatabases: "This project does not have any databases bound yet.",
    noLogs: "No logs have been streamed yet. Refresh first.",
    treeHint: "Leaf nodes are always projects. Multi-level grouping is supported.",
    providerHint: "Manage providers available to the workbench here.",
    databaseResult: "Query results",
    close: "Close",
    selectedDetails: "Selected",
    noSelection: "No active project",
  };
}

function WindowDots() {
  return (
    <div className="flex items-center gap-1.5" aria-hidden="true">
      <span className="h-2.5 w-2.5 rounded-full bg-white/55" />
      <span className="h-2.5 w-2.5 rounded-full bg-white/30" />
      <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
    </div>
  );
}

function ActionButton({
  label,
  onClick,
  fullWidth = false,
  primary = false,
}: {
  label: string;
  onClick: () => void;
  fullWidth?: boolean;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center justify-center rounded-md border px-3 py-2 text-[11px] font-medium uppercase tracking-[0.16em] transition ${
        fullWidth ? "w-full" : ""
      } ${
        primary
          ? "border-[var(--accent)] bg-black/18 text-[var(--accent)] hover:bg-[var(--accent)]/10"
          : "border-white/10 bg-black/10 text-white/78 hover:border-white/20 hover:bg-black/18"
      }`}
    >
      {label}
    </button>
  );
}

function RailGlyph({ kind }: { kind: ResourceSectionKey | "settings" }) {
  if (kind === "server") {
    return (
      <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6">
        <rect x="3.5" y="4" width="13" height="5" rx="1.3" />
        <rect x="3.5" y="11" width="13" height="5" rx="1.3" />
        <circle cx="6.5" cy="6.5" r="0.8" fill="currentColor" stroke="none" />
        <circle cx="6.5" cy="13.5" r="0.8" fill="currentColor" stroke="none" />
      </svg>
    );
  }

  if (kind === "database") {
    return (
      <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.4">
        <ellipse cx="10" cy="5.2" rx="5.8" ry="2.4" />
        <path d="M4.2 5.2v6.1c0 1.3 2.6 2.4 5.8 2.4s5.8-1.1 5.8-2.4V5.2" />
        <path d="M4.2 8.2c0 1.3 2.6 2.4 5.8 2.4s5.8-1.1 5.8-2.4" />
      </svg>
    );
  }

  if (kind === "logs") {
    return (
      <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6">
        <path d="M5 4.5h10M5 8.5h10M5 12.5h10M5 16.5h6" />
      </svg>
    );
  }

  if (kind === "provider") {
    return (
      <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6">
        <path d="M10 3.8v12.4M3.8 10h12.4" />
        <circle cx="10" cy="10" r="5.8" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6">
      <circle cx="10" cy="10" r="3.1" />
      <path d="M10 2.5v2.1M10 15.4v2.1M17.5 10h-2.1M4.6 10H2.5M15.4 4.6l-1.4 1.4M6 14l-1.4 1.4M15.4 15.4 14 14M6 6 4.6 4.6" />
    </svg>
  );
}

function RailIconButton({
  label,
  icon,
  active,
  disabled,
  onClick,
}: {
  label: string;
  icon: ReactNode;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`flex h-[64px] w-[54px] flex-col items-center justify-center gap-1 rounded-md border text-[10px] uppercase tracking-[0.12em] transition ${
        active
          ? "border-[var(--accent)] bg-[#181818] text-[var(--accent)]"
          : "border-transparent bg-transparent text-white/58 hover:border-white/10 hover:bg-black/18 hover:text-white/84"
      } disabled:cursor-not-allowed disabled:opacity-35`}
    >
      <span>{icon}</span>
      <span>{label}</span>
    </button>
  );
}

function DrawerShell({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="absolute inset-y-0 right-full z-20 flex w-[340px] flex-col border-l border-r border-white/8 bg-[#1b1b1d] shadow-[-20px_0_50px_rgba(0,0,0,0.35)]">
      <div className="border-b border-white/8 px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-white/40">Proj-Eye</p>
            <h3 className="mt-1 text-sm font-semibold text-white">{title}</h3>
            <p className="mt-1 text-xs text-white/46">{subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-white/10 px-2.5 py-1.5 text-[10px] uppercase tracking-[0.18em] text-white/60 transition hover:border-white/20 hover:text-white"
          >
            Close
          </button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
    </div>
  );
}

function ProjectManagerPanel({
  projects,
  activeProject,
  onOpenDialog,
}: {
  projects: Project[];
  activeProject: Project | null;
  onOpenDialog: (dialog: WorkbenchDialogState) => void;
}) {
  const { locale } = useI18n();
  const copy = workbenchText(locale);
  const config = useAppStore((state) => state.config);
  const searchQuery = useAppStore((state) => state.searchQuery);
  const filterMode = useAppStore((state) => state.filterMode);
  const setSearchQuery = useAppStore((state) => state.setSearchQuery);
  const setFilterMode = useAppStore((state) => state.setFilterMode);
  const setActiveProjectId = useAppStore((state) => state.setActiveProjectId);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ root: true });
  const tree = useMemo(() => buildProjectFolderTree(projects), [projects]);
  const projectFlowHint =
    locale === "zh-CN"
      ? "服务器和数据库会在新建项目流程里一起绑定"
      : "Servers and databases are bound inside the project flow.";

  useEffect(() => {
    if (!activeProject) {
      return;
    }

    const ids = collectExpandedFolderIds(getProjectManagerPath(activeProject));
    if (ids.length === 0) {
      return;
    }

    setExpanded((state) => {
      const next = { ...state };
      ids.forEach((id) => {
        next[id] = true;
      });
      return next;
    });
  }, [activeProject]);

  const toggleFolder = (folderId: string) => {
    setExpanded((state) => ({
      ...state,
      [folderId]: !state[folderId],
    }));
  };

  const renderProjectRow = (project: Project, depth: number) => {
    const active = activeProject?.id === project.id;

    return (
      <div
        key={project.id}
        className={`group flex items-center gap-2 rounded-md border px-2 py-2 transition ${
          active
            ? "border-[var(--accent)]/30 bg-[#1a1a1a] shadow-[inset_3px_0_0_var(--accent)]"
            : "border-transparent hover:bg-black/14"
        }`}
        style={{ marginLeft: `${depth * 14}px` }}
      >
        <StatusDot status={project.health} />
        <button type="button" onClick={() => setActiveProjectId(project.id)} className="min-w-0 flex-1 text-left">
          <p className="truncate text-sm font-medium text-white">{project.name}</p>
          <p className="truncate text-[11px] text-white/42">{project.rootPath}</p>
        </button>
        <button
          type="button"
          onClick={() => onOpenDialog({ kind: "project", entityId: project.id })}
          className="rounded-md border border-white/10 px-2 py-1 text-[10px] uppercase tracking-[0.16em] text-white/58 opacity-0 transition group-hover:opacity-100 hover:border-white/20 hover:text-white"
        >
          Edit
        </button>
      </div>
    );
  };

  const renderFolder = (folder: ProjectFolderNode, depth: number): ReactNode => {
    const isExpanded = expanded[folder.id] ?? true;

    return (
      <div key={folder.id} className="space-y-1">
        <div
          className="group flex items-center gap-2 rounded-md px-2 py-1.5 transition hover:bg-black/14"
          style={{ marginLeft: `${depth * 14}px` }}
        >
          <button
            type="button"
            onClick={() => toggleFolder(folder.id)}
            className="h-5 w-5 rounded-sm text-xs text-white/60 transition hover:bg-white/10 hover:text-white"
          >
            {isExpanded ? "▾" : "▸"}
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white/94">{folder.name}</p>
          </div>
          <span className="text-[10px] uppercase tracking-[0.14em] text-white/35">{folder.projectCount}</span>
          <button
            type="button"
            onClick={() => onOpenDialog({ kind: "project", initialPath: folder.path })}
            className="rounded-sm border border-white/10 px-1.5 py-0.5 text-[10px] text-white/58 opacity-0 transition group-hover:opacity-100 hover:border-white/20 hover:text-white"
          >
            +
          </button>
        </div>
        {isExpanded ? (
          <div className="space-y-1">
            {folder.folders.map((child) => renderFolder(child, depth + 1))}
            {folder.projects.map((project) => renderProjectRow(project, depth + 1))}
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <section className="flex min-h-[28rem] flex-col border-r border-white/8 bg-[#4a4a4a] lg:min-h-screen">
      <div className="border-b border-white/10 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <WindowDots />
            <div>
              <p className="text-[11px] uppercase tracking-[0.22em] text-white/45">Proj-Eye</p>
              <h2 className="text-sm font-semibold text-white">{copy.projectManager}</h2>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onOpenDialog({ kind: "settings" })}
            className="rounded-md border border-white/10 px-2.5 py-1.5 text-[10px] uppercase tracking-[0.16em] text-white/62 transition hover:border-white/20 hover:text-white"
          >
            {copy.settings}
          </button>
        </div>
        <p className="mt-3 text-xs text-white/55">{copy.treeHint}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Badge tone="info">{config.projects.length} {copy.project}</Badge>
          <Badge tone="accent">{config.servers.length} {copy.resourceServer}</Badge>
          <Badge tone="warning">{config.databases.length} {copy.resourceDatabase}</Badge>
        </div>
      </div>

      <div className="border-b border-white/8 px-3 py-3">
        <SearchBar value={searchQuery} onChange={setSearchQuery} />
        <div className="mt-3">
          <FilterBar activeFilter={filterMode} onChange={setFilterMode} />
        </div>
        <div className="mt-3">
          <ActionButton
            label={copy.newProject}
            onClick={() => onOpenDialog({ kind: "project" })}
            fullWidth
            primary
          />
          <div className="mt-2 flex items-center justify-between gap-3 text-[11px] text-white/44">
            <span>{projectFlowHint}</span>
            <button
              type="button"
              onClick={() => onOpenDialog({ kind: "provider" })}
              className="rounded-md border border-white/10 px-2.5 py-1.5 text-[10px] uppercase tracking-[0.16em] text-white/62 transition hover:border-white/20 hover:text-white"
            >
              {copy.newProvider}
            </button>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-3">
        {projects.length === 0 ? (
          <EmptyState title={copy.emptyProjectTitle} description={copy.emptyProjectDescription} />
        ) : (
          <div className="space-y-1.5">
            {tree.projects.map((project) => renderProjectRow(project, 0))}
            {tree.folders.map((folder) => renderFolder(folder, 0))}
          </div>
        )}
      </div>

      <div className="border-t border-white/10 bg-black/10 px-3 py-3">
        <p className="text-[11px] uppercase tracking-[0.18em] text-white/42">{copy.selectedDetails}</p>
        {activeProject ? (
          <div className="mt-2 grid grid-cols-[70px_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-xs">
            <span className="text-white/42">Name</span>
            <span className="truncate text-white/90">{activeProject.name}</span>
            <span className="text-white/42">Path</span>
            <span className="truncate text-white/72">{managerPathLabel(getProjectManagerPath(activeProject))}</span>
            <span className="text-white/42">Root</span>
            <span className="truncate text-white/72">{activeProject.rootPath}</span>
            <span className="text-white/42">Issue</span>
            <span className="truncate text-white/72">{activeProject.recentIssue ?? "-"}</span>
          </div>
        ) : (
          <p className="mt-2 text-xs text-white/56">{copy.noSelection}</p>
        )}
      </div>
    </section>
  );
}

function AiDock({
  activeProject,
  activeServer,
  activeDatabases,
  alert,
}: {
  activeProject: Project | null;
  activeServer: Server | null;
  activeDatabases: DatabaseResource[];
  alert: AlertItem | null;
}) {
  const { locale, t } = useI18n();
  const copy = workbenchText(locale);
  const [prompt, setPrompt] = useState("");
  const activeProjectId = activeProject?.id ?? null;
  const messagesByProject = useAiStore((state) => state.messagesByProject);
  const suggestionsByProject = useAiStore((state) => state.suggestionsByProject);
  const statusByProject = useAiStore((state) => state.statusByProject);
  const analyze = useAiStore((state) => state.analyze);
  const sendFollowup = useAiStore((state) => state.sendFollowup);
  const confirmSuggestion = useAiStore((state) => state.confirmSuggestion);
  const messages = activeProjectId ? messagesByProject[activeProjectId] ?? EMPTY_MESSAGES : EMPTY_MESSAGES;
  const suggestion = activeProjectId ? suggestionsByProject[activeProjectId] ?? null : null;
  const status = activeProjectId ? statusByProject[activeProjectId] ?? AIStatus.Ready : AIStatus.Ready;
  const isBusy = status === AIStatus.Analyzing;

  const handleSend = async () => {
    if (!activeProject || !activeServer) {
      return;
    }

    const nextPrompt = prompt.trim();
    if (!nextPrompt || isBusy) {
      return;
    }

    await sendFollowup(
      activeProject.id,
      activeProject.name,
      activeDatabases.map((database) => `${database.name}:${database.type}`),
      nextPrompt,
    );
    startTransition(() => setPrompt(""));
  };

  return (
    <section className="flex min-h-[28rem] flex-col border-r border-white/8 bg-[#1d1d20] p-2 lg:min-h-screen">
      <div className="mb-2 flex items-center gap-2 px-1 text-[11px] text-white/54">
        <WindowDots />
        <span className="rounded-md border border-white/8 bg-black/18 px-2 py-1">Balanced</span>
        <span className="truncate rounded-md border border-white/8 bg-black/12 px-2 py-1">
          {activeProject?.name ?? copy.aiConsole}
        </span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col rounded-[12px] border border-white/8 bg-[#1f1f22]">
        <div className="border-b border-white/8 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-2.5 w-2.5 rounded-full bg-[var(--accent)]" />
                <h2 className="truncate text-[15px] font-semibold text-white">Proj-Eye AI</h2>
              </div>
              <p className="mt-1 truncate text-xs text-white/50">
                {activeProject && activeServer
                  ? `${activeProject.name} · ${activeServer.username}@${activeServer.host}`
                  : copy.emptyProjectDescription}
              </p>
            </div>
            {activeProject && activeServer ? (
              <button
                type="button"
                onClick={() =>
                  void analyze(
                    activeProject.id,
                    activeProject.name,
                    activeDatabases.map((database) => `${database.name}:${database.type}`),
                  )
                }
                disabled={isBusy}
                className="rounded-md border border-white/10 bg-black/18 px-3 py-2 text-[10px] uppercase tracking-[0.18em] text-white/74 transition hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-60"
              >
                {isBusy ? copy.analyzing : t("ai.analyze")}
              </button>
            ) : null}
          </div>

          {activeProject ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge tone="info">{managerPathLabel(getProjectManagerPath(activeProject))}</Badge>
              {activeDatabases.map((database) => (
                <Badge key={database.id} tone="accent">
                  {database.name}
                </Badge>
              ))}
            </div>
          ) : null}
        </div>

        {!activeProject || !activeServer ? (
          <div className="p-4">
            <EmptyState title={copy.emptyProjectTitle} description={copy.emptyProjectDescription} />
          </div>
        ) : (
          <>
            <div className="border-b border-white/8 bg-black/12 px-4 py-2 text-xs text-white/62">
              <span className="mr-2 text-[var(--accent)]">{copy.activeSignal}</span>
              {alert?.description ?? t("ai.waitingSignal")}
            </div>

            <div className="min-h-0 flex-1 p-3">
              <ConversationArea messages={messages} status={status} />
            </div>

            {suggestion ? (
              <div className="border-t border-white/8 p-3">
                <CommandConfirm
                  suggestion={suggestion}
                  onConfirm={() => {
                    if (activeProject) {
                      void confirmSuggestion(activeProject.id);
                    }
                  }}
                />
              </div>
            ) : null}

            <form
              className="border-t border-white/8 bg-[#232327] p-3"
              onSubmit={(event) => {
                event.preventDefault();
                void handleSend();
              }}
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-[11px] uppercase tracking-[0.16em] text-white/42">{copy.aiConsole}</p>
                <span className="text-[11px] text-white/38">{copy.sendHint}</span>
              </div>
              <textarea
                value={prompt}
                onChange={(event) => setPrompt(event.currentTarget.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void handleSend();
                  }
                }}
                placeholder={copy.askPlaceholder}
                rows={3}
                className="mt-3 w-full resize-none rounded-md border border-white/10 bg-[#19191b] px-3 py-3 text-sm leading-6 text-white outline-none placeholder:text-white/28 focus:border-white/20"
              />
              <div className="mt-3 flex justify-end">
                <button
                  type="submit"
                  disabled={isBusy || !prompt.trim()}
                  className="rounded-md border border-white/10 bg-black/20 px-4 py-2 text-[10px] uppercase tracking-[0.18em] text-white/78 transition hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-60"
                >
                  {copy.send}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </section>
  );
}

function TerminalColumn(_: {
  activeProject: Project | null;
  activeServer: Server | null;
  activeDatabases: DatabaseResource[];
  alert: AlertItem | null;
  backendHealth: AppHealthSnapshot | null;
  backendError: string | null;
}) {
  const { locale } = useI18n();
  const copy = workbenchText(locale);
  const allTabs = useWorkspaceStore((state) => state.terminalTabs);
  const sessions = useWorkspaceStore((state) => state.sessions);
  const metrics = useWorkspaceStore((state) => state.metrics);
  const commandDrafts = useWorkspaceStore((state) => state.commandDrafts);
  const commandErrors = useWorkspaceStore((state) => state.commandErrors);
  const commandBusy = useWorkspaceStore((state) => state.commandBusy);
  const setActiveTab = useWorkspaceStore((state) => state.setActiveTab);
  const addTab = useWorkspaceStore((state) => state.addTab);
  const setCommandDraft = useWorkspaceStore((state) => state.setCommandDraft);
  const executeCommand = useWorkspaceStore((state) => state.executeCommand);

  const { activeProject, activeServer, activeDatabases, alert, backendHealth, backendError } = _;

  if (!activeProject || !activeServer) {
    return (
      <section className="flex min-h-[28rem] flex-col bg-[#101010] lg:min-h-screen">
        <div className="border-b border-white/8 bg-[#161616] px-3 py-2">
          <div className="flex items-center gap-3">
            <WindowDots />
            <span className="text-sm font-medium text-white">{copy.terminal}</span>
          </div>
        </div>
        <div className="p-4">
          <EmptyState title={copy.emptyProjectTitle} description={copy.emptyProjectDescription} />
        </div>
      </section>
    );
  }

  const terminalTabs = allTabs.filter((tab) => tab.projectId === activeProject.id);
  const activeTab = terminalTabs.find((tab) => tab.active) ?? terminalTabs[0];
  const activeSession = sessions.find((session) => session.id === activeTab?.sessionId) ?? null;

  return (
    <section className="flex min-h-[28rem] flex-col bg-[#101010] lg:min-h-screen">
      <div className="border-b border-white/8 bg-[#171717] px-3 py-2">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <TerminalTabs
              tabs={terminalTabs}
              onSelect={setActiveTab}
              onCreateTab={() => {
                void addTab(activeProject.id);
              }}
            />
          </div>
          <div className="hidden items-center gap-2 xl:flex">
            <Badge tone="info">{activeServer.host}</Badge>
            {activeDatabases.slice(0, 2).map((database) => (
              <Badge key={database.id} tone="accent">
                {database.name}
              </Badge>
            ))}
            <span className="text-[11px] text-white/46">
              {backendError ? backendError : `${backendHealth?.stage ?? "ready"} / ${backendHealth?.app ?? "Proj-Eye"}`}
            </span>
          </div>
        </div>
      </div>

      {alert ? (
        <div className="border-b border-[#6a2d38] bg-[#25161a] px-4 py-2 text-xs text-[#f2b7c3]">
          <span className="font-medium">{alert.title}</span>
          <span className="ml-2 text-[#c48d99]">{alert.description}</span>
        </div>
      ) : null}

      <div className="min-h-0 flex-1 p-2">
        <TerminalPane
          project={activeProject}
          alert={alert}
          session={activeSession}
          metrics={metrics}
          commandDraft={activeSession ? commandDrafts[activeSession.id] ?? "" : ""}
          commandError={activeSession ? commandErrors[activeSession.id] ?? null : null}
          commandBusy={activeSession ? Boolean(commandBusy[activeSession.id]) : false}
          onCommandChange={(value) => {
            if (activeSession) {
              setCommandDraft(activeSession.id, value);
            }
          }}
          onCommandRun={() => {
            if (activeSession) {
              void executeCommand(activeSession.id);
            }
          }}
        />
      </div>
    </section>
  );
}

function ResourceRail(_: {
  activeProject: Project | null;
  activeServer: Server | null;
  activeDatabases: DatabaseResource[];
  onOpenDialog: (dialog: WorkbenchDialogState) => void;
}) {
  const { locale, t } = useI18n();
  const copy = workbenchText(locale);
  const config = useAppStore((state) => state.config);
  const refreshLogs = useWorkspaceStore((state) => state.refreshLogs);
  const allLogs = useWorkspaceStore((state) => state.logs);
  const queryDrafts = useWorkspaceStore((state) => state.queryDrafts);
  const queryResults = useWorkspaceStore((state) => state.queryResults);
  const queryErrors = useWorkspaceStore((state) => state.queryErrors);
  const setQueryDraft = useWorkspaceStore((state) => state.setQueryDraft);
  const executeQuery = useWorkspaceStore((state) => state.executeQuery);
  const activeProjectId = _.activeProject?.id ?? null;
  const [activeSection, setActiveSection] = useState<ResourceSectionKey | null>("server");
  const [activeDatabaseId, setActiveDatabaseId] = useState("");
  const [logBusy, setLogBusy] = useState(false);
  const [logError, setLogError] = useState<string | null>(null);

  useEffect(() => {
    if (!_.activeDatabases.some((database) => database.id === activeDatabaseId)) {
      setActiveDatabaseId(_.activeDatabases[0]?.id ?? "");
    }
  }, [_.activeDatabases, activeDatabaseId]);

  const logs = useMemo(
    () => (activeProjectId ? allLogs.filter((entry) => entry.projectId === activeProjectId) : EMPTY_LOGS),
    [activeProjectId, allLogs],
  );

  const activeDatabase = _.activeDatabases.find((database) => database.id === activeDatabaseId) ?? null;
  const statement = activeDatabaseId ? queryDrafts[activeDatabaseId] ?? "" : "";
  const queryResult = activeDatabaseId ? queryResults[activeDatabaseId] : null;
  const queryError = activeDatabaseId ? queryErrors[activeDatabaseId] : null;

  const sectionTitle =
    activeSection === "server"
      ? copy.resourceServer
      : activeSection === "database"
        ? copy.resourceDatabase
        : activeSection === "logs"
          ? copy.resourceLogs
          : copy.resourceProvider;

  const sectionSubtitle =
    activeSection === "server"
      ? (_.activeServer ? `${_.activeServer.username}@${_.activeServer.host}:${_.activeServer.port}` : copy.emptyProjectDescription)
      : activeSection === "database"
        ? copy.query
        : activeSection === "logs"
          ? (_.activeProject?.logSources[0]?.label ?? t("logs.unknownSource"))
          : copy.providerHint;

  return (
    <section className="relative flex min-h-[28rem] overflow-visible border-l border-white/8 bg-[#2c2c2c] lg:min-h-screen">
      {activeSection && _.activeProject && _.activeServer ? (
        <DrawerShell title={sectionTitle} subtitle={sectionSubtitle} onClose={() => setActiveSection(null)}>
          {activeSection === "server" ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-white/8 bg-black/18 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-white">{_.activeServer.host}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.16em] text-white/42">
                      {_.activeServer.username}@{_.activeServer.host}:{_.activeServer.port}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => _.onOpenDialog({ kind: "server", entityId: _.activeServer!.id })}
                    className="rounded-md border border-white/10 px-3 py-1.5 text-[10px] uppercase tracking-[0.18em] text-white/64 transition hover:border-white/20 hover:text-white"
                  >
                    Edit
                  </button>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge tone="info">{_.activeServer.group}</Badge>
                  <Badge tone="accent">{_.activeServer.osType}</Badge>
                </div>
              </div>

              <div className="rounded-lg border border-white/8 bg-black/18 p-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-white/42">{copy.project}</p>
                <p className="mt-2 text-sm font-medium text-white">{_.activeProject.name}</p>
                <p className="mt-1 text-xs text-white/46">{_.activeProject.rootPath}</p>
              </div>
            </div>
          ) : null}

          {activeSection === "database" ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div className="text-[11px] uppercase tracking-[0.16em] text-white/40">{copy.resourceDatabase}</div>
                <button
                  type="button"
                  onClick={() => _.onOpenDialog({ kind: "database" })}
                  className="rounded-md border border-white/10 px-3 py-1.5 text-[10px] uppercase tracking-[0.18em] text-white/64 transition hover:border-white/20 hover:text-white"
                >
                  +
                </button>
              </div>

              {_.activeDatabases.length === 0 ? (
                <p className="text-sm text-white/56">{copy.noDatabases}</p>
              ) : (
                <>
                  <div className="flex flex-wrap gap-2">
                    {_.activeDatabases.map((database) => (
                      <button
                        key={database.id}
                        type="button"
                        onClick={() => setActiveDatabaseId(database.id)}
                        className={`rounded-md border px-3 py-1.5 text-[10px] uppercase tracking-[0.16em] ${
                          activeDatabaseId === database.id
                            ? "border-[var(--accent)] bg-black/25 text-[var(--accent)]"
                            : "border-white/10 bg-black/12 text-white/62 hover:border-white/20 hover:text-white"
                        }`}
                      >
                        {database.name}
                      </button>
                    ))}
                  </div>

                  <textarea
                    value={statement}
                    onChange={(event) => {
                      if (activeDatabaseId) {
                        setQueryDraft(activeDatabaseId, event.currentTarget.value);
                      }
                    }}
                    rows={6}
                    placeholder={
                      activeDatabase?.type === DatabaseType.Redis
                        ? t("database.placeholder.redis")
                        : activeDatabase?.type === DatabaseType.Postgresql
                          ? t("database.placeholder.postgres")
                          : t("database.placeholder.mysql")
                    }
                    disabled={!activeDatabaseId || activeDatabase?.type === DatabaseType.Postgresql}
                    className="w-full rounded-md border border-white/10 bg-[#121214] px-3 py-3 font-mono text-sm text-white outline-none disabled:opacity-50"
                  />

                  <div className="flex items-center justify-between gap-3">
                    <div className="text-[11px] uppercase tracking-[0.16em] text-white/42">
                      {activeDatabase
                        ? `${databaseTypeLabel(locale, activeDatabase.type)} / ${activeDatabase.host}:${activeDatabase.port}`
                        : ""}
                    </div>
                    <div className="flex gap-2">
                      {activeDatabase ? (
                        <button
                          type="button"
                          onClick={() => _.onOpenDialog({ kind: "database", entityId: activeDatabase.id })}
                          className="rounded-md border border-white/10 px-3 py-1.5 text-[10px] uppercase tracking-[0.18em] text-white/64 transition hover:border-white/20 hover:text-white"
                        >
                          Edit
                        </button>
                      ) : null}
                      <button
                        type="button"
                        disabled={!activeDatabaseId || activeDatabase?.type === DatabaseType.Postgresql}
                        onClick={() => {
                          if (activeDatabaseId) {
                            void executeQuery(activeDatabaseId);
                          }
                        }}
                        className="rounded-md border border-white/10 bg-black/18 px-3 py-1.5 text-[10px] uppercase tracking-[0.18em] text-white/78 transition hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-50"
                      >
                        {copy.runQuery}
                      </button>
                    </div>
                  </div>

                  <div className="rounded-lg border border-white/8 bg-black/18 p-4">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-white/42">{copy.databaseResult}</p>
                    {queryError ? <p className="mt-2 text-sm text-[var(--red)]">{queryError}</p> : null}
                    {queryResult?.notice ? <p className="mt-2 text-sm text-white/66">{queryResult.notice}</p> : null}
                    {queryResult && queryResult.columns.length > 0 ? (
                      <div className="mt-3 overflow-x-auto">
                        <table className="min-w-full text-left text-sm text-white/76">
                          <thead>
                            <tr className="border-b border-white/10 text-white">
                              {queryResult.columns.map((column) => (
                                <th key={column} className="px-2 py-2 font-medium">{column}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {queryResult.rows.map((row, index) => (
                              <tr key={`${index}-${queryResult.databaseId}`} className="border-b border-white/6">
                                {queryResult.columns.map((column) => (
                                  <td key={`${index}-${column}`} className="px-2 py-2">{String(row[column] ?? "")}</td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : null}
                  </div>
                </>
              )}
            </div>
          ) : null}

          {activeSection === "logs" ? (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-white">{copy.resourceLogs}</p>
                  <p className="mt-1 text-xs text-white/42">{_.activeProject.logSources[0]?.label ?? t("logs.unknownSource")}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setLogBusy(true);
                    setLogError(null);
                    void refreshLogs(_.activeProject!.id)
                      .catch((error) => setLogError(localizeErrorMessage(locale, error, "logs.refreshError")))
                      .finally(() => setLogBusy(false));
                  }}
                  className="rounded-md border border-white/10 px-3 py-1.5 text-[10px] uppercase tracking-[0.18em] text-white/64 transition hover:border-white/20 hover:text-white"
                >
                  {logBusy ? "..." : copy.refreshLogs}
                </button>
              </div>
              {logError ? <p className="text-sm text-[var(--red)]">{logError}</p> : null}
              <div className="space-y-2 rounded-lg border border-white/8 bg-[#121214] p-4 font-mono text-sm">
                {(logs.length > 0 ? logs.slice(-14).map((entry) => entry.line) : [copy.noLogs]).map((line, index) => (
                  <div key={`${line}-${index}`} className={hasAnomalySignal(line) ? "text-[var(--red)]" : "text-white/76"}>
                    {line}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {activeSection === "provider" ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs text-white/48">{copy.providerHint}</div>
                <button
                  type="button"
                  onClick={() => _.onOpenDialog({ kind: "provider" })}
                  className="rounded-md border border-white/10 px-3 py-1.5 text-[10px] uppercase tracking-[0.18em] text-white/64 transition hover:border-white/20 hover:text-white"
                >
                  +
                </button>
              </div>
              {config.providers.map((provider) => (
                <div key={provider.id} className="rounded-lg border border-white/8 bg-black/18 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-white">{provider.name}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.16em] text-white/42">
                        {provider.type} / {provider.model}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => _.onOpenDialog({ kind: "provider", entityId: provider.id })}
                      className="rounded-md border border-white/10 px-3 py-1.5 text-[10px] uppercase tracking-[0.18em] text-white/64 transition hover:border-white/20 hover:text-white"
                    >
                      Edit
                    </button>
                  </div>
                  <div className="mt-3">
                    <Badge tone={provider.enabled ? "accent" : "neutral"}>
                      {provider.enabled ? t("status.enabled") : t("status.disabled")}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </DrawerShell>
      ) : null}

      <div className="flex w-[74px] flex-col items-center justify-between py-3">
        <div className="flex flex-col items-center gap-2">
          <RailIconButton
            label={copy.resourceServer}
            icon={<RailGlyph kind="server" />}
            active={activeSection === "server"}
            disabled={!_.activeProject || !_.activeServer}
            onClick={() => setActiveSection((state) => (state === "server" ? null : "server"))}
          />
          <RailIconButton
            label={copy.resourceDatabase}
            icon={<RailGlyph kind="database" />}
            active={activeSection === "database"}
            disabled={!_.activeProject || !_.activeServer}
            onClick={() => setActiveSection((state) => (state === "database" ? null : "database"))}
          />
          <RailIconButton
            label={copy.resourceLogs}
            icon={<RailGlyph kind="logs" />}
            active={activeSection === "logs"}
            disabled={!_.activeProject || !_.activeServer}
            onClick={() => setActiveSection((state) => (state === "logs" ? null : "logs"))}
          />
          <RailIconButton
            label={copy.resourceProvider}
            icon={<RailGlyph kind="provider" />}
            active={activeSection === "provider"}
            disabled={!_.activeProject || !_.activeServer}
            onClick={() => setActiveSection((state) => (state === "provider" ? null : "provider"))}
          />
        </div>

        <div className="flex flex-col items-center gap-2">
          <RailIconButton
            label={copy.settings}
            icon={<RailGlyph kind="settings" />}
            active={false}
            onClick={() => _.onOpenDialog({ kind: "settings" })}
          />
        </div>
      </div>
    </section>
  );
}

export default function Workbench({
  projects,
  activeProject,
  activeServer,
  activeDatabases,
  alert,
  backendHealth,
  backendError,
}: WorkbenchProps) {
  const [dialog, setDialog] = useState<WorkbenchDialogState>({ kind: null });

  return (
    <>
      <main className="grid min-h-screen grid-cols-1 bg-[#181818] lg:grid-cols-[330px_380px_minmax(0,1fr)_74px]">
        <ProjectManagerPanel
          projects={projects}
          activeProject={activeProject}
          onOpenDialog={(nextDialog) => setDialog(nextDialog)}
        />
        <AiDock
          activeProject={activeProject}
          activeServer={activeServer}
          activeDatabases={activeDatabases}
          alert={alert}
        />
        <TerminalColumn
          activeProject={activeProject}
          activeServer={activeServer}
          activeDatabases={activeDatabases}
          alert={alert}
          backendHealth={backendHealth}
          backendError={backendError}
        />
        <ResourceRail
          activeProject={activeProject}
          activeServer={activeServer}
          activeDatabases={activeDatabases}
          onOpenDialog={(nextDialog) => setDialog(nextDialog)}
        />
      </main>
      <ManagementDialogs dialog={dialog} onClose={() => setDialog({ kind: null })} />
    </>
  );
}

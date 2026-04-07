import { useCallback } from "react";
import { usePanelsStore } from "../../store/panels";
import { useWorkspaceStore } from "../../store/workspace";
import {
  BottomPanelKey,
  type AlertItem,
  type AppHealthSnapshot,
  type DatabaseResource,
  type Project,
  type Server,
} from "../../types/models";
import AlertStrip from "./AlertStrip";
import ShortcutBar from "./ShortcutBar";
import TerminalPane from "./TerminalPane";
import TerminalTabs from "./TerminalTabs";
import WorkspaceHeader from "./WorkspaceHeader";

interface WorkspaceProps {
  project: Project;
  server: Server;
  databases: DatabaseResource[];
  alert: AlertItem | null;
  backendHealth: AppHealthSnapshot | null;
  backendError: string | null;
}

export default function Workspace({
  project,
  server,
  databases,
  alert,
  backendHealth,
  backendError,
}: WorkspaceProps) {
  const allTabs = useWorkspaceStore((state) => state.terminalTabs);
  const sessions = useWorkspaceStore((state) => state.sessions);
  const terminalBuffers = useWorkspaceStore((state) => state.terminalBuffers);
  const setActiveTab = useWorkspaceStore((state) => state.setActiveTab);
  const addTab = useWorkspaceStore((state) => state.addTab);
  const closeTab = useWorkspaceStore((state) => state.closeTab);
  const writeTerminalInput = useWorkspaceStore((state) => state.writeTerminalInput);
  const resizeTerminal = useWorkspaceStore((state) => state.resizeTerminal);
  const reconnectSession = useWorkspaceStore((state) => state.reconnectSession);
  const toggleBottomPanel = usePanelsStore((state) => state.toggleBottomPanel);
  const toggleAiOverlay = usePanelsStore((state) => state.toggleAiOverlay);
  const setAiOverlay = usePanelsStore((state) => state.setAiOverlay);

  const terminalTabs = allTabs.filter((tab) => tab.projectId === project.id);
  const activeTab = terminalTabs.find((tab) => tab.active) ?? terminalTabs[0];
  const activeSession = sessions.find((session) => session.id === activeTab?.sessionId) ?? null;

  const createNewTab = useCallback(() => {
    void addTab(project.id);
  }, [addTab, project.id]);

  return (
    <section className="space-y-4">
      <WorkspaceHeader
        project={project}
        server={server}
        databases={databases}
        backendHealth={backendHealth}
        backendError={backendError}
      />
      <AlertStrip alert={alert} onInvestigate={() => setAiOverlay(true)} />
      <div className="space-y-3 rounded-[2rem] border border-[var(--border)] bg-[var(--bg2)]/60 p-4">
        <div className="box-border h-[30px] min-h-[30px] max-h-[30px] overflow-hidden rounded-[0.625rem] border border-white/8 bg-[#17191c]">
          <TerminalTabs
            tabs={terminalTabs}
            projectName={project.name}
            onSelect={setActiveTab}
            onCloseTab={(tabId) => {
              void closeTab(tabId);
            }}
          />
        </div>
        <TerminalPane
          project={project}
          session={activeSession}
          terminalBuffer={activeSession ? terminalBuffers[activeSession.id] ?? "" : ""}
          onInput={(data) => {
            if (activeSession) {
              void writeTerminalInput(activeSession.id, data);
            }
          }}
          onResize={(cols, rows) => {
            if (activeSession) {
              void resizeTerminal(activeSession.id, cols, rows);
            }
          }}
          onReconnect={() => {
            if (activeSession) {
              void reconnectSession(activeSession.id);
            }
          }}
        />
      </div>
      <ShortcutBar
        onToggleAi={toggleAiOverlay}
        onToggleLogs={() => toggleBottomPanel(BottomPanelKey.Logs)}
        onToggleDatabase={() => toggleBottomPanel(BottomPanelKey.Database)}
        onCreateTab={createNewTab}
      />
    </section>
  );
}

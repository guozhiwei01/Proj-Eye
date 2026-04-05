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
  const metrics = useWorkspaceStore((state) => state.metrics);
  const commandDrafts = useWorkspaceStore((state) => state.commandDrafts);
  const commandErrors = useWorkspaceStore((state) => state.commandErrors);
  const commandBusy = useWorkspaceStore((state) => state.commandBusy);
  const setActiveTab = useWorkspaceStore((state) => state.setActiveTab);
  const addTab = useWorkspaceStore((state) => state.addTab);
  const setCommandDraft = useWorkspaceStore((state) => state.setCommandDraft);
  const executeCommand = useWorkspaceStore((state) => state.executeCommand);
  const toggleBottomPanel = usePanelsStore((state) => state.toggleBottomPanel);
  const toggleAiOverlay = usePanelsStore((state) => state.toggleAiOverlay);
  const setAiOverlay = usePanelsStore((state) => state.setAiOverlay);

  const terminalTabs = allTabs.filter((tab) => tab.projectId === project.id);
  const activeTab = terminalTabs.find((tab) => tab.active) ?? terminalTabs[0];
  const activeSession = sessions.find((session) => session.id === activeTab?.sessionId) ?? null;

  const createNewTab = () => {
    void addTab(project.id);
  };

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
        <TerminalTabs tabs={terminalTabs} onSelect={setActiveTab} onCreateTab={createNewTab} />
        <TerminalPane
          project={project}
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
      <ShortcutBar
        onToggleAi={toggleAiOverlay}
        onToggleLogs={() => toggleBottomPanel(BottomPanelKey.Logs)}
        onToggleDatabase={() => toggleBottomPanel(BottomPanelKey.Database)}
        onCreateTab={createNewTab}
      />
    </section>
  );
}

import { useI18n } from "../../lib/i18n";
import { usePanelsStore, panelOrder } from "../../store/panels";
import { BottomPanelKey, type AlertItem, type DatabaseResource, type Project, type Server } from "../../types/models";
import CronPanel from "./CronPanel";
import DatabasePanel from "./DatabasePanel";
import LogPanel from "./LogPanel";
import SFTPPanel from "../SFTP/SFTPPanel";

interface BottomPanelProps {
  project: Project;
  server: Server;
  databases: DatabaseResource[];
  alert: AlertItem | null;
}

export default function BottomPanel({ project, server, databases, alert }: BottomPanelProps) {
  const { t } = useI18n();
  const activeBottomPanel = usePanelsStore((state) => state.activeBottomPanel);
  const toggleBottomPanel = usePanelsStore((state) => state.toggleBottomPanel);

  if (!activeBottomPanel) {
    return null;
  }

  const panelLabels = {
    [BottomPanelKey.Logs]: t("bottom.logs"),
    [BottomPanelKey.Database]: t("bottom.database"),
    [BottomPanelKey.Cron]: t("bottom.cron"),
    [BottomPanelKey.SFTP]: t("bottom.sftp"),
  };

  return (
    <section className="rounded-[2rem] border border-[var(--border)] bg-[linear-gradient(180deg,var(--bg1),var(--bg2))] p-5 shadow-[0_18px_80px_rgba(0,0,0,0.22)]">
      <div className="flex flex-wrap items-center gap-2 border-b border-[var(--border)] pb-4">
        {panelOrder.map((panel) => (
          <button
            key={panel}
            type="button"
            onClick={() => toggleBottomPanel(panel)}
            className={`rounded-full border px-4 py-2 text-xs font-medium uppercase tracking-[0.18em] ${
              activeBottomPanel === panel
                ? "border-[var(--accent)] bg-[var(--bg3)] text-[var(--accent)]"
                : "border-[var(--border)] text-[var(--text1)]"
            }`}
          >
            {panelLabels[panel]}
          </button>
        ))}
      </div>

      <div className="mt-5">
        {activeBottomPanel === BottomPanelKey.Logs && <LogPanel project={project} alert={alert} />}
        {activeBottomPanel === BottomPanelKey.Database && <DatabasePanel databases={databases} />}
        {activeBottomPanel === BottomPanelKey.Cron && <CronPanel project={project} />}
        {activeBottomPanel === BottomPanelKey.SFTP && <SFTPPanel server={server} />}
      </div>
    </section>
  );
}

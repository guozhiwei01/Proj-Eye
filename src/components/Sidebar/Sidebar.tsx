import {
  secureStoreMessage,
  secureStoreStateLabel,
  secureStoreStrategyLabel,
  themeLabel,
  useI18n,
} from "../../lib/i18n";
import { useAppStore } from "../../store/app";
import {
  AppView,
  ManagementSection,
  ProjectHealth,
  ThemeMode,
  type Project,
} from "../../types/models";
import Badge from "../shared/Badge";
import FilterBar from "./FilterBar";
import ProjectList from "./ProjectList";
import SearchBar from "./SearchBar";

interface SidebarProps {
  projects: Project[];
  activeProjectId: string;
}

const themeOptions = [ThemeMode.Teal, ThemeMode.Amber, ThemeMode.Blue] as const;

export default function Sidebar({ projects, activeProjectId }: SidebarProps) {
  const { locale, t } = useI18n();
  const searchQuery = useAppStore((state) => state.searchQuery);
  const filterMode = useAppStore((state) => state.filterMode);
  const theme = useAppStore((state) => state.theme);
  const activeView = useAppStore((state) => state.activeView);
  const secureStatus = useAppStore((state) => state.secureStatus);
  const config = useAppStore((state) => state.config);
  const setTheme = useAppStore((state) => state.setTheme);
  const setSearchQuery = useAppStore((state) => state.setSearchQuery);
  const setFilterMode = useAppStore((state) => state.setFilterMode);
  const setActiveProjectId = useAppStore((state) => state.setActiveProjectId);
  const setActiveView = useAppStore((state) => state.setActiveView);
  const setManagementSection = useAppStore((state) => state.setManagementSection);

  const alertingProjects = projects.filter((project) => project.health !== ProjectHealth.Healthy);
  const recentProjects = [...projects]
    .sort((left, right) => right.lastAccessedAt - left.lastAccessedAt)
    .slice(0, 3);

  return (
    <aside className="w-full shrink-0 rounded-[2rem] border border-[var(--border)] bg-[linear-gradient(180deg,var(--bg1),var(--bg2))] p-4 shadow-[0_18px_80px_rgba(0,0,0,0.22)] xl:w-[318px]">
      <div className="flex h-full flex-col gap-4">
        <div className="rounded-[1.5rem] border border-[var(--border)] bg-[var(--bg0)]/60 px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-[var(--accent)]">{t("sidebar.tag")}</p>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--text0)]">{t("sidebar.heading")}</h1>
            </div>
            <button
              type="button"
              aria-label={t("sidebar.new")}
              onClick={() => setManagementSection(ManagementSection.Projects)}
              className="rounded-2xl border border-[var(--border2)] px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text1)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
            >
              {t("sidebar.new")}
            </button>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Badge tone="accent">{t("sidebar.servers", { count: config.servers.length })}</Badge>
            <Badge tone="info">{t("sidebar.databases", { count: config.databases.length })}</Badge>
            <Badge tone="warning">{t("sidebar.alerts", { count: alertingProjects.length })}</Badge>
          </div>
        </div>

        <nav aria-label={t("sidebar.heading")} className="grid grid-cols-3 gap-2">
          <button
            type="button"
            aria-label={t("sidebar.workspace")}
            aria-pressed={activeView === AppView.Workspace}
            onClick={() => setActiveView(AppView.Workspace)}
            className={`rounded-2xl border px-3 py-2 text-xs uppercase tracking-[0.18em] transition ${
              activeView === AppView.Workspace
                ? "border-[var(--accent)] bg-[var(--bg3)] text-[var(--accent)]"
                : "border-[var(--border)] text-[var(--text1)] hover:border-[var(--border2)]"
            }`}
          >
            {t("sidebar.workspace")}
          </button>
          <button
            type="button"
            aria-label={t("sidebar.manage")}
            aria-pressed={activeView === AppView.Manage}
            onClick={() => setManagementSection(ManagementSection.Projects)}
            className={`rounded-2xl border px-3 py-2 text-xs uppercase tracking-[0.18em] transition ${
              activeView === AppView.Manage
                ? "border-[var(--accent2)] bg-[var(--bg3)] text-[var(--accent2)]"
                : "border-[var(--border)] text-[var(--text1)] hover:border-[var(--border2)]"
            }`}
          >
            {t("sidebar.manage")}
          </button>
          <button
            type="button"
            aria-label={t("sidebar.settings")}
            aria-pressed={activeView === AppView.Settings}
            onClick={() => setActiveView(AppView.Settings)}
            className={`rounded-2xl border px-3 py-2 text-xs uppercase tracking-[0.18em] transition ${
              activeView === AppView.Settings
                ? "border-[var(--blue)] bg-[var(--bg3)] text-[var(--blue)]"
                : "border-[var(--border)] text-[var(--text1)] hover:border-[var(--border2)]"
            }`}
          >
            {t("sidebar.settings")}
          </button>
        </nav>

        <SearchBar value={searchQuery} onChange={setSearchQuery} />
        <FilterBar activeFilter={filterMode} onChange={setFilterMode} />

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
          <ProjectList
            title={t("sidebar.alerting")}
            projects={alertingProjects}
            activeProjectId={activeProjectId}
            onSelect={setActiveProjectId}
            emptyDescription={t("sidebar.empty.alerting")}
          />
          <ProjectList
            title={t("sidebar.recent")}
            projects={recentProjects}
            activeProjectId={activeProjectId}
            onSelect={setActiveProjectId}
            emptyDescription={t("sidebar.empty.recent")}
          />
          <ProjectList
            title={t("sidebar.allProjects")}
            projects={projects}
            activeProjectId={activeProjectId}
            onSelect={setActiveProjectId}
            emptyDescription={t("sidebar.empty.allProjects")}
          />
        </div>

        <div className="space-y-4 rounded-[1.5rem] border border-[var(--border)] bg-[var(--bg0)]/50 px-4 py-4">
          <div>
            <p className="text-sm font-semibold text-[var(--text0)]">{t("sidebar.theme")}</p>
            <p className="mt-1 text-xs text-[var(--text1)]">{t("sidebar.themeDescription")}</p>
          </div>

          <div className="flex gap-2">
            {themeOptions.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => void setTheme(option)}
                className={`rounded-full border px-3 py-1.5 text-xs uppercase tracking-[0.18em] ${
                  theme === option
                    ? "border-[var(--accent)] bg-[var(--bg3)] text-[var(--accent)]"
                    : "border-[var(--border)] text-[var(--text1)]"
                }`}
              >
                {themeLabel(locale, option)}
              </button>
            ))}
          </div>

          <div className="rounded-2xl border border-[var(--border)] px-3 py-3">
            <p className="text-xs uppercase tracking-[0.18em] text-[var(--text2)]">{t("sidebar.secureStore")}</p>
            <p className="mt-2 text-sm text-[var(--text1)]">
              {secureStoreStrategyLabel(locale, secureStatus.strategy)} /{" "}
              {secureStoreStateLabel(locale, secureStatus.strategy, secureStatus.locked)}
            </p>
            <p className="mt-1 text-xs text-[var(--text2)]">{secureStoreMessage(locale, secureStatus)}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}

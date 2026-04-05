import DatabaseSection from "../components/Management/DatabaseSection";
import ProjectSection from "../components/Management/ProjectSection";
import ProviderSection from "../components/Management/ProviderSection";
import ServerSection from "../components/Management/ServerSection";
import { managementSectionLabel, useI18n } from "../lib/i18n";
import { useAppStore } from "../store/app";
import { ManagementSection } from "../types/models";

export default function CreateProject() {
  const { locale, t } = useI18n();
  const managementSection = useAppStore((state) => state.managementSection);
  const setManagementSection = useAppStore((state) => state.setManagementSection);

  const sections = [
    { key: ManagementSection.Projects, label: managementSectionLabel(locale, ManagementSection.Projects) },
    { key: ManagementSection.Servers, label: managementSectionLabel(locale, ManagementSection.Servers) },
    { key: ManagementSection.Databases, label: managementSectionLabel(locale, ManagementSection.Databases) },
    { key: ManagementSection.Providers, label: managementSectionLabel(locale, ManagementSection.Providers) },
  ] as const;

  return (
    <section className="space-y-4">
      <div className="rounded-[2rem] border border-[var(--border)] bg-[linear-gradient(135deg,var(--bg1),var(--bg2))] px-6 py-6 shadow-[0_12px_60px_rgba(0,0,0,0.18)]">
        <p className="text-xs uppercase tracking-[0.28em] text-[var(--accent2)]">{t("createProject.tag")}</p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--text0)]">
          {t("createProject.heading")}
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--text1)]">
          {t("createProject.description")}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {sections.map((section) => (
          <button
            key={section.key}
            type="button"
            onClick={() => setManagementSection(section.key)}
            className={`rounded-full border px-4 py-2 text-xs uppercase tracking-[0.18em] ${
              managementSection === section.key
                ? "border-[var(--accent)] bg-[var(--bg3)] text-[var(--accent)]"
                : "border-[var(--border)] text-[var(--text1)]"
            }`}
          >
            {section.label}
          </button>
        ))}
      </div>

      {managementSection === ManagementSection.Servers ? <ServerSection /> : null}
      {managementSection === ManagementSection.Databases ? <DatabaseSection /> : null}
      {managementSection === ManagementSection.Projects ? <ProjectSection /> : null}
      {managementSection === ManagementSection.Providers ? <ProviderSection /> : null}
    </section>
  );
}

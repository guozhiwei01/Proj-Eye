import { useI18n } from "../../lib/i18n";
import type { Project } from "../../types/models";
import Badge from "../shared/Badge";

interface CronPanelProps {
  project: Project;
}

export default function CronPanel({ project }: CronPanelProps) {
  const { t } = useI18n();

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-semibold text-[var(--text0)]">{t("cron.title")}</p>
        <p className="mt-1 text-sm text-[var(--text1)]">{t("cron.description")}</p>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between rounded-[1.4rem] border border-[var(--border)] bg-[var(--bg1)] px-4 py-4">
          <div>
            <p className="text-sm font-medium text-[var(--text0)]">{t("cron.reconcile", { project: project.name })}</p>
            <p className="mt-1 text-xs uppercase tracking-[0.18em] text-[var(--text2)]">*/5 * * * *</p>
          </div>
          <Badge tone="accent">{t("cron.success")}</Badge>
        </div>
        <div className="flex items-center justify-between rounded-[1.4rem] border border-[var(--border)] bg-[var(--bg1)] px-4 py-4">
          <div>
            <p className="text-sm font-medium text-[var(--text0)]">{t("cron.cleanup")}</p>
            <p className="mt-1 text-xs uppercase tracking-[0.18em] text-[var(--text2)]">0 * * * *</p>
          </div>
          <Badge tone="warning">{t("cron.delayed")}</Badge>
        </div>
      </div>
    </div>
  );
}

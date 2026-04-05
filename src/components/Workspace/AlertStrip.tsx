import { useI18n } from "../../lib/i18n";
import type { AlertItem } from "../../types/models";

interface AlertStripProps {
  alert: AlertItem | null;
  onInvestigate: () => void;
}

export default function AlertStrip({ alert, onInvestigate }: AlertStripProps) {
  const { t } = useI18n();

  if (!alert) {
    return null;
  }

  return (
    <section className="rounded-[1.6rem] border border-[var(--red)] bg-[linear-gradient(135deg,rgba(239,71,111,0.12),rgba(255,255,255,0.02))] px-5 py-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-[var(--red)]">{t("workspace.alertStrip")}</p>
          <p className="mt-2 text-lg font-semibold text-[var(--text0)]">{alert.title}</p>
          <p className="mt-1 text-sm text-[var(--text1)]">{alert.description}</p>
        </div>

        <button
          type="button"
          onClick={onInvestigate}
          className="rounded-full border border-[var(--red)] px-4 py-2 text-sm font-medium text-[var(--text0)] transition hover:bg-[var(--bg3)]"
        >
          {t("workspace.startTriage")}
        </button>
      </div>
    </section>
  );
}

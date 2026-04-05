import { useI18n } from "../../lib/i18n";
import type { TerminalTab } from "../../types/models";

interface TerminalTabsProps {
  tabs: TerminalTab[];
  onSelect: (tabId: string) => void;
  onCreateTab: () => void;
}

export default function TerminalTabs({ tabs, onSelect, onCreateTab }: TerminalTabsProps) {
  const { t } = useI18n();

  return (
    <div className="flex flex-wrap items-center gap-2">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onSelect(tab.id)}
          className={`rounded-full border px-4 py-2 text-xs font-medium uppercase tracking-[0.18em] ${
            tab.active
              ? "border-[var(--accent)] bg-[var(--bg3)] text-[var(--accent)]"
              : "border-[var(--border)] bg-[var(--bg2)] text-[var(--text1)]"
          }`}
        >
          {tab.title}
        </button>
      ))}

      <button
        type="button"
        onClick={onCreateTab}
        className="rounded-full border border-dashed border-[var(--border2)] px-3 py-2 text-xs uppercase tracking-[0.18em] text-[var(--text1)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
      >
        {t("workspace.newTab")}
      </button>
    </div>
  );
}

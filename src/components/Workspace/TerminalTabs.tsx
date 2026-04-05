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
    <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onSelect(tab.id)}
          className={`min-w-[88px] rounded-t-md border border-b-0 px-4 py-2 text-[11px] font-medium tracking-[0.1em] ${
            tab.active
              ? "border-[#2a7fff] bg-[#202020] text-white shadow-[inset_0_2px_0_#2a7fff]"
              : "border-white/10 bg-[#121212] text-white/56 hover:text-white/82"
          }`}
        >
          {tab.title}
        </button>
      ))}

      <button
        type="button"
        onClick={onCreateTab}
        className="rounded-md border border-white/10 bg-[#121212] px-3 py-2 text-[11px] uppercase tracking-[0.16em] text-white/58 transition hover:border-white/20 hover:text-white"
      >
        + {t("workspace.newTab")}
      </button>
    </div>
  );
}

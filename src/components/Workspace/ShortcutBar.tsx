import { useI18n } from "../../lib/i18n";
import { useAppStore } from "../../store/app";

interface ShortcutBarProps {
  onToggleAi: () => void;
  onToggleLogs: () => void;
  onToggleDatabase: () => void;
  onToggleSFTP: () => void;
  onCreateTab: () => void;
}

export default function ShortcutBar({
  onToggleAi,
  onToggleLogs,
  onToggleDatabase,
  onToggleSFTP,
  onCreateTab,
}: ShortcutBarProps) {
  const { t } = useI18n();
  const shortcutModifier = useAppStore((state) => state.config.settings.shortcutModifier);
  const modifierLabel = shortcutModifier === "meta" ? "Cmd" : "Ctrl";
  const shortcuts = [
    { label: t("shortcut.ai"), hotkey: `${modifierLabel}+K` },
    { label: t("shortcut.logs"), hotkey: `${modifierLabel}+L` },
    { label: t("shortcut.database"), hotkey: `${modifierLabel}+D` },
    { label: t("shortcut.sftp"), hotkey: `${modifierLabel}+F` },
    { label: t("shortcut.search"), hotkey: `${modifierLabel}+P` },
    { label: t("shortcut.newTab"), hotkey: `${modifierLabel}+T` },
  ] as const;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-[1.5rem] border border-[var(--border)] bg-[var(--bg1)]/80 px-4 py-3">
      <div className="flex flex-wrap gap-2">
        {shortcuts.map((shortcut) => (
          <div
            key={shortcut.hotkey}
            className="rounded-full border border-[var(--border)] px-3 py-1.5 text-xs uppercase tracking-[0.18em] text-[var(--text1)]"
          >
            {shortcut.label} / {shortcut.hotkey}
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          aria-label={t("shortcut.toggleAi")}
          onClick={onToggleAi}
          className="rounded-full border border-[var(--border)] px-4 py-2 text-xs uppercase tracking-[0.18em] text-[var(--text1)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
        >
          {t("shortcut.toggleAi")}
        </button>
        <button
          type="button"
          aria-label={t("shortcut.openLogs")}
          onClick={onToggleLogs}
          className="rounded-full border border-[var(--border)] px-4 py-2 text-xs uppercase tracking-[0.18em] text-[var(--text1)] transition-colors hover:border-[var(--yellow)] hover:text-[var(--yellow)]"
        >
          {t("shortcut.openLogs")}
        </button>
        <button
          type="button"
          aria-label={t("shortcut.openDatabase")}
          onClick={onToggleDatabase}
          className="rounded-full border border-[var(--border)] px-4 py-2 text-xs uppercase tracking-[0.18em] text-[var(--text1)] transition-colors hover:border-[var(--blue)] hover:text-[var(--blue)]"
        >
          {t("shortcut.openDatabase")}
        </button>
        <button
          type="button"
          aria-label={t("shortcut.openSFTP")}
          onClick={onToggleSFTP}
          className="rounded-full border border-[var(--border)] px-4 py-2 text-xs uppercase tracking-[0.18em] text-[var(--text1)] transition-colors hover:border-[var(--green)] hover:text-[var(--green)]"
        >
          {t("shortcut.openSFTP")}
        </button>
        <button
          type="button"
          aria-label={t("shortcut.newTerminal")}
          onClick={onCreateTab}
          className="rounded-full border border-[var(--border)] px-4 py-2 text-xs uppercase tracking-[0.18em] text-[var(--text1)] transition-colors hover:border-[var(--accent2)] hover:text-[var(--accent2)]"
        >
          {t("shortcut.newTerminal")}
        </button>
      </div>
    </div>
  );
}

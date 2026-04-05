import { useI18n } from "../../lib/i18n";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
}

export default function SearchBar({ value, onChange }: SearchBarProps) {
  const { t } = useI18n();

  return (
    <label className="flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--bg2)] px-4 py-3">
      <span className="text-xs uppercase tracking-[0.24em] text-[var(--text2)]">{t("sidebar.searchLabel")}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
        placeholder={t("sidebar.searchPlaceholder")}
        className="w-full bg-transparent text-sm text-[var(--text0)] outline-none placeholder:text-[var(--text2)]"
      />
    </label>
  );
}

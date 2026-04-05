import { useI18n } from "../../lib/i18n";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
}

export default function SearchBar({ value, onChange }: SearchBarProps) {
  const { t } = useI18n();

  return (
    <label className="flex items-center gap-2 rounded-md border border-white/10 bg-black/12 px-3 py-2">
      <span className="text-[10px] uppercase tracking-[0.18em] text-white/42">{t("sidebar.searchLabel")}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
        placeholder={t("sidebar.searchPlaceholder")}
        className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/26"
      />
    </label>
  );
}

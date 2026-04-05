import { filterLabel, useI18n } from "../../lib/i18n";
import { FilterMode, type FilterMode as FilterModeValue } from "../../types/models";

const filters: Array<{ value: FilterModeValue }> = [
  { value: FilterMode.All },
  { value: FilterMode.Alerting },
  { value: FilterMode.Production },
  { value: FilterMode.Staging },
  { value: FilterMode.Development },
];

interface FilterBarProps {
  activeFilter: FilterModeValue;
  onChange: (value: FilterModeValue) => void;
}

export default function FilterBar({ activeFilter, onChange }: FilterBarProps) {
  const { locale } = useI18n();

  return (
    <div className="flex flex-wrap gap-2">
      {filters.map((filter) => {
        const active = activeFilter === filter.value;

        return (
          <button
            key={filter.value}
            type="button"
            onClick={() => onChange(filter.value)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium uppercase tracking-[0.14em] transition ${
              active
                ? "border-[var(--accent)] bg-[var(--bg3)] text-[var(--accent)]"
                : "border-[var(--border)] bg-[var(--bg2)] text-[var(--text1)] hover:border-[var(--border2)]"
            }`}
          >
            {filterLabel(locale, filter.value)}
          </button>
        );
      })}
    </div>
  );
}

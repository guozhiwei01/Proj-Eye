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
            className={`rounded-md border px-2.5 py-1.5 text-[10px] font-medium uppercase tracking-[0.16em] transition ${
              active
                ? "border-[var(--accent)] bg-black/22 text-[var(--accent)]"
                : "border-white/10 bg-black/12 text-white/58 hover:border-white/20 hover:text-white"
            }`}
          >
            {filterLabel(locale, filter.value)}
          </button>
        );
      })}
    </div>
  );
}

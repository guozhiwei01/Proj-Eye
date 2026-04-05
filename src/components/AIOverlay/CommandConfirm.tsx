import { commandRiskLabel, useI18n } from "../../lib/i18n";
import { CommandRisk, type AiCommandSuggestion } from "../../types/models";

interface CommandConfirmProps {
  suggestion: AiCommandSuggestion | null;
  onConfirm: () => void;
}

export default function CommandConfirm({ suggestion, onConfirm }: CommandConfirmProps) {
  const { locale, t } = useI18n();

  return (
    <section className="rounded-[10px] border border-white/8 bg-[#18181a] p-4">
      <p className="text-[10px] uppercase tracking-[0.18em] text-white/42">{t("ai.commandConfirm")}</p>

      {suggestion ? (
        <>
          <div className="mt-3 rounded-md border border-white/8 bg-[#111113] p-4">
            <p className="font-mono text-sm text-white/76">{suggestion.command}</p>
          </div>
          <p className="mt-3 text-sm text-white/68">{suggestion.reason}</p>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={onConfirm}
              disabled={suggestion.blocked}
              className="rounded-md border border-white/10 bg-black/18 px-3 py-2 text-[10px] uppercase tracking-[0.18em] text-white/76 transition hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {t("ai.confirm")}
            </button>
            <button
              type="button"
              className={`rounded-md border px-3 py-2 text-[10px] uppercase tracking-[0.18em] ${
                suggestion.risk === CommandRisk.Blocked
                  ? "border-[var(--red)] text-[var(--red)]"
                  : "border-white/10 text-white/58"
              }`}
            >
              {commandRiskLabel(locale, suggestion.risk)}
            </button>
          </div>
        </>
      ) : (
        <p className="mt-3 text-sm text-white/56">{t("ai.emptySuggestion")}</p>
      )}
    </section>
  );
}

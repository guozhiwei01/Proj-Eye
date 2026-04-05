import { commandRiskLabel, useI18n } from "../../lib/i18n";
import { CommandRisk, type AiCommandSuggestion } from "../../types/models";

interface CommandConfirmProps {
  suggestion: AiCommandSuggestion | null;
  onConfirm: () => void;
}

export default function CommandConfirm({ suggestion, onConfirm }: CommandConfirmProps) {
  const { locale, t } = useI18n();

  return (
    <section className="rounded-[1.5rem] border border-[var(--border)] bg-[var(--bg1)] p-4">
      <p className="text-xs uppercase tracking-[0.22em] text-[var(--text2)]">{t("ai.commandConfirm")}</p>

      {suggestion ? (
        <>
          <div className="mt-3 rounded-2xl border border-[var(--border)] bg-[var(--bg0)] p-4">
            <p className="font-mono text-sm text-[var(--text1)]">{suggestion.command}</p>
          </div>
          <p className="mt-3 text-sm text-[var(--text1)]">{suggestion.reason}</p>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={onConfirm}
              disabled={suggestion.blocked}
              className="rounded-full border border-[var(--accent)] px-4 py-2 text-xs uppercase tracking-[0.18em] text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {t("ai.confirm")}
            </button>
            <button
              type="button"
              className={`rounded-full border px-4 py-2 text-xs uppercase tracking-[0.18em] ${
                suggestion.risk === CommandRisk.Blocked
                  ? "border-[var(--red)] text-[var(--red)]"
                  : "border-[var(--border)] text-[var(--text1)]"
              }`}
            >
              {commandRiskLabel(locale, suggestion.risk)}
            </button>
          </div>
        </>
      ) : (
        <p className="mt-3 text-sm text-[var(--text1)]">{t("ai.emptySuggestion")}</p>
      )}
    </section>
  );
}

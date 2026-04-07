import { commandRiskLabel, useI18n } from "../../lib/i18n";
import { CommandRisk, type AiCommandSuggestion } from "../../types/models";

interface CommandConfirmProps {
  suggestion: AiCommandSuggestion | null;
  busy?: boolean;
  onConfirm: () => void;
}

export default function CommandConfirm({ suggestion, busy = false, onConfirm }: CommandConfirmProps) {
  const { locale, t } = useI18n();

  return (
    <section className="rounded-[18px] bg-black/12 px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] uppercase tracking-[0.22em] text-[#9a917f]">{t("ai.commandConfirm")}</p>
        {suggestion ? (
          <span
            className={`rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.16em] ${
              suggestion.risk === CommandRisk.Blocked
                ? "bg-[var(--red)]/10 text-[var(--red)]"
                : "bg-white/[0.04] text-white/42"
            }`}
          >
            {commandRiskLabel(locale, suggestion.risk)}
          </span>
        ) : null}
      </div>

      {suggestion ? (
        <>
          <div className="mt-4 rounded-[14px] bg-[#121317] px-4 py-3.5">
            <p className="font-mono text-[13px] leading-6 text-white/82">{suggestion.command}</p>
          </div>
          <p className="mt-4 text-[13px] leading-6 text-white/52">{suggestion.reason}</p>
          <div className="mt-5 flex justify-end">
            <button
              type="button"
              onClick={onConfirm}
              disabled={suggestion.blocked || busy}
              className="inline-flex items-center rounded-full bg-[#2a2e34] px-4 py-2 text-[12px] font-medium text-white/84 transition hover:text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? t("ai.sending") : t("ai.confirm")}
            </button>
          </div>
        </>
      ) : (
        <p className="mt-4 text-[13px] leading-6 text-white/42">{t("ai.emptySuggestion")}</p>
      )}
    </section>
  );
}

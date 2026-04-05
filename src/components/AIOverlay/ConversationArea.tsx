import { aiStatusLabel, useI18n } from "../../lib/i18n";
import { AIStatus, type AIMessage, type AIStatus as AIStatusValue } from "../../types/models";

interface ConversationAreaProps {
  messages: AIMessage[];
  status: AIStatusValue;
}

export default function ConversationArea({ messages, status }: ConversationAreaProps) {
  const { locale, t } = useI18n();

  return (
    <section className="rounded-[1.5rem] border border-[var(--border)] bg-[var(--bg1)] p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-[0.22em] text-[var(--text2)]">{t("ai.conversation")}</p>
        <span
          className={`rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.18em] ${
            status === AIStatus.Error
              ? "border border-[var(--red)] text-[var(--red)]"
              : status === AIStatus.Analyzing
                ? "border border-[var(--yellow)] text-[var(--yellow)]"
                : "border border-[var(--accent)] text-[var(--accent)]"
          }`}
        >
          {aiStatusLabel(locale, status)}
        </span>
      </div>

      <div className="mt-4 space-y-3">
        {messages.length === 0 ? (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg0)] px-4 py-3 text-sm text-[var(--text1)]">
            {t("ai.noAnalysis")}
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`rounded-2xl px-4 py-3 text-sm leading-6 ${
                message.speaker === "assistant"
                  ? "bg-[var(--bg3)] text-[var(--text0)]"
                  : message.speaker === "user"
                    ? "border border-[var(--accent2)] bg-[var(--bg0)] text-[var(--text0)]"
                    : "border border-[var(--border)] bg-[var(--bg0)] text-[var(--text1)]"
              }`}
            >
              {message.content}
            </div>
          ))
        )}
      </div>
    </section>
  );
}

import { aiStatusLabel, useI18n } from "../../lib/i18n";
import { AIStatus, type AIMessage, type AIStatus as AIStatusValue } from "../../types/models";

interface ConversationAreaProps {
  messages: AIMessage[];
  status: AIStatusValue;
}

export default function ConversationArea({ messages, status }: ConversationAreaProps) {
  const { locale, t } = useI18n();

  return (
    <section className="flex h-full flex-col rounded-[10px] border border-white/8 bg-[#18181a]">
      <div className="flex items-center justify-between border-b border-white/8 px-4 py-3">
        <p className="text-[10px] uppercase tracking-[0.18em] text-white/42">{t("ai.conversation")}</p>
        <span
          className={`rounded-md border px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] ${
            status === AIStatus.Error
              ? "border-[var(--red)] text-[var(--red)]"
              : status === AIStatus.Analyzing
                ? "border-[var(--yellow)] text-[var(--yellow)]"
                : "border-[var(--accent)] text-[var(--accent)]"
          }`}
        >
          {aiStatusLabel(locale, status)}
        </span>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3">
        {messages.length === 0 ? (
          <div className="rounded-md border border-white/8 bg-[#111113] px-4 py-3 text-sm text-white/58">
            {t("ai.noAnalysis")}
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`rounded-md px-4 py-3 text-sm leading-6 ${
                message.speaker === "assistant"
                  ? "bg-[#202024] text-white"
                  : message.speaker === "user"
                    ? "border border-white/10 bg-[#111113] text-white"
                    : "border border-white/8 bg-[#141416] text-white/68"
              }`}
            >
              <p className="mb-2 text-[10px] uppercase tracking-[0.18em] text-white/38">
                {message.speaker === "assistant"
                  ? t("ai.assistant")
                  : message.speaker === "user"
                    ? t("ai.user")
                    : t("ai.system")}
              </p>
              {message.content}
            </div>
          ))
        )}
      </div>
    </section>
  );
}

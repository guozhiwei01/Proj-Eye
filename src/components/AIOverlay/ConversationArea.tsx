import { useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "../../lib/i18n";
import { AIStatus, type AIMessage, type AIStatus as AIStatusValue } from "../../types/models";

interface ConversationAreaProps {
  messages: AIMessage[];
  status?: AIStatusValue;
}

function extractDisplayText(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) {
    return "";
  }

  const tryParse = (candidate: string): string | null => {
    try {
      const parsed = JSON.parse(candidate) as unknown;
      if (typeof parsed === "string") {
        return parsed.trim() || null;
      }
      if (parsed && typeof parsed === "object") {
        for (const key of ["answer", "analysis", "summary"] as const) {
          const value = (parsed as Record<string, unknown>)[key];
          if (typeof value === "string" && value.trim()) {
            return value.trim();
          }
        }
      }
    } catch {
      return null;
    }

    return null;
  };

  const unfenced = trimmed.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
  const direct = tryParse(unfenced);
  if (direct) {
    return direct;
  }

  const embedded = unfenced.match(/\{[\s\S]*\}/);
  if (embedded) {
    const parsed = tryParse(embedded[0]);
    if (parsed) {
      return parsed;
    }
  }

  return trimmed;
}

export default function ConversationArea({ messages, status = AIStatus.Ready }: ConversationAreaProps) {
  const { locale, t } = useI18n();
  const viewportRef = useRef<HTMLDivElement>(null);
  const animatedIdsRef = useRef<Set<string>>(new Set());
  const [animatedId, setAnimatedId] = useState<string | null>(null);
  const [animatedContent, setAnimatedContent] = useState("");

  const normalizedMessages = useMemo(
    () =>
      messages.map((message) => ({
        ...message,
        displayContent: extractDisplayText(message.content),
      })),
    [messages],
  );

  useEffect(() => {
    const target = [...normalizedMessages].reverse().find((message) => message.speaker !== "user");
    if (!target) {
      return;
    }

    if (animatedIdsRef.current.has(target.id) || target.speaker === "system") {
      setAnimatedId(target.id);
      setAnimatedContent(target.displayContent);
      return;
    }

    const fullText = target.displayContent;
    if (!fullText) {
      animatedIdsRef.current.add(target.id);
      setAnimatedId(target.id);
      setAnimatedContent("");
      return;
    }

    setAnimatedId(target.id);
    setAnimatedContent("");

    let index = 0;
    const step = fullText.length > 260 ? 6 : fullText.length > 140 ? 4 : 2;
    const timer = window.setInterval(() => {
      index = Math.min(fullText.length, index + step);
      setAnimatedContent(fullText.slice(0, index));
      if (index >= fullText.length) {
        animatedIdsRef.current.add(target.id);
        window.clearInterval(timer);
      }
    }, 18);

    return () => window.clearInterval(timer);
  }, [normalizedMessages]);

  useEffect(() => {
    const node = viewportRef.current;
    if (!node) {
      return;
    }

    node.scrollTo({
      top: node.scrollHeight,
      behavior: status === AIStatus.Analyzing ? "auto" : "smooth",
    });
  }, [normalizedMessages.length, animatedContent, status]);

  const thinkingLabel = locale === "zh-CN" ? "正在生成回复" : "Generating response";

  return (
    <section className="flex h-full flex-col overflow-hidden rounded-[20px] bg-[#1b1c1f] shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
      <div ref={viewportRef} className="min-h-0 flex-1 overflow-y-auto px-3.5 py-3.5">
        {normalizedMessages.length === 0 ? (
          <div className="max-w-[86%] px-1 pt-1">
            <p className="text-[15px] font-semibold tracking-tight text-[#efe5d0]">{t("ai.noAnalysis")}</p>
            <p className="mt-2 text-[12px] leading-5 text-white/42">{t("ai.askPlaceholder")}</p>
          </div>
        ) : (
          <div className="space-y-4 pb-2">
            {normalizedMessages.map((message) => {
              const isUser = message.speaker === "user";
              const isAssistant = message.speaker === "assistant";
              const content = message.id === animatedId ? animatedContent : message.displayContent;

              return (
                <article key={message.id} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[92%] ${
                      isUser
                        ? "rounded-[15px] bg-[#25282d] px-3.5 py-2.5 text-white"
                        : isAssistant
                          ? "px-1 py-0.5 text-[#f3efe4]"
                          : "rounded-[13px] bg-black/12 px-3 py-2 text-white/60"
                    }`}
                  >
                    <p
                      className={`whitespace-pre-wrap break-words ${
                        isAssistant
                          ? "text-[14px] font-medium leading-6"
                          : message.speaker === "system"
                            ? "text-[12px] leading-5"
                            : "text-[13px] leading-5.5"
                      }`}
                    >
                      {content}
                    </p>
                  </div>
                </article>
              );
            })}

            {status === AIStatus.Analyzing ? (
              <article className="flex justify-start">
                <div className="rounded-[13px] bg-black/12 px-3 py-2.5 text-white/44">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--accent)] [animation-delay:-0.2s]" />
                    <span className="inline-flex h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--accent)] [animation-delay:-0.1s]" />
                    <span className="inline-flex h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--accent)]" />
                    <span className="text-[11px]">{thinkingLabel}</span>
                  </div>
                </div>
              </article>
            ) : null}
          </div>
        )}
      </div>
    </section>
  );
}

import { useState } from "react";
import { providerTypeLabel, useI18n } from "../../lib/i18n";
import { inspectCredentialRef } from "../../lib/backend";
import { useAppStore } from "../../store/app";
import { ProviderType, type ProviderDraft } from "../../types/models";
import Badge from "../shared/Badge";

function emptyProviderDraft(): ProviderDraft {
  return {
    name: "",
    type: ProviderType.OpenAI,
    model: "",
    baseUrl: "",
    enabled: true,
  };
}

export default function ProviderSection() {
  const { locale, t } = useI18n();
  const config = useAppStore((state) => state.config);
  const saveProvider = useAppStore((state) => state.saveProvider);
  const deleteProvider = useAppStore((state) => state.deleteProvider);
  const [draft, setDraft] = useState<ProviderDraft>(emptyProviderDraft);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const hydrate = async (providerId: string) => {
    const provider = config.providers.find((item) => item.id === providerId);
    if (!provider) {
      return;
    }
    const hasCredential = await inspectCredentialRef(provider.apiKeyRef);
    setDraft({
      id: provider.id,
      name: provider.name,
      type: provider.type,
      model: provider.model,
      baseUrl: provider.baseUrl,
      enabled: provider.enabled,
      apiKeyRef: provider.apiKeyRef,
      apiKeyValue: hasCredential ? "" : undefined,
    });
  };

  const run = async (action: () => Promise<void>) => {
    setMessage(null);
    setError(null);
    try {
      await action();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : t("management.providerError"));
    }
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <div className="space-y-3 rounded-[2rem] border border-[var(--border)] bg-[var(--bg2)]/70 p-5">
        {message ? <p className="text-sm text-[var(--accent)]">{message}</p> : null}
        {error ? <p className="text-sm text-[var(--red)]">{error}</p> : null}
        {config.providers.map((provider) => (
          <div key={provider.id} className="rounded-2xl border border-[var(--border)] bg-[var(--bg1)] px-4 py-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-[var(--text0)]">{provider.name}</p>
                <p className="mt-1 text-xs uppercase tracking-[0.18em] text-[var(--text2)]">
                  {providerTypeLabel(locale, provider.type)} / {provider.model}
                </p>
              </div>
              <Badge tone={provider.enabled ? "accent" : "neutral"}>
                {provider.enabled ? t("status.enabled") : t("status.disabled")}
              </Badge>
            </div>

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => void hydrate(provider.id)}
                className="rounded-full border border-[var(--border)] px-3 py-2 text-xs uppercase tracking-[0.18em] text-[var(--text1)]"
              >
                {t("management.edit")}
              </button>
              <button
                type="button"
                onClick={() =>
                  void run(async () => {
                    await deleteProvider(provider.id);
                    setMessage(t("management.providerDeleted"));
                  })
                }
                className="rounded-full border border-[var(--red)] px-3 py-2 text-xs uppercase tracking-[0.18em] text-[var(--red)]"
              >
                {t("management.delete")}
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-4 rounded-[2rem] border border-[var(--border)] bg-[var(--bg2)]/70 p-5">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium text-[var(--text0)]">{t("management.name")}</span>
            <input
              value={draft.name}
              onChange={(event) => setDraft((state) => ({ ...state, name: event.currentTarget.value }))}
              className="mt-2 w-full rounded-2xl border border-[var(--border)] bg-[var(--bg1)] px-4 py-3 text-sm text-[var(--text0)] outline-none"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-[var(--text0)]">{t("management.providerType")}</span>
            <select
              value={draft.type}
              onChange={(event) =>
                setDraft((state) => ({ ...state, type: event.currentTarget.value as ProviderDraft["type"] }))
              }
              className="mt-2 w-full rounded-2xl border border-[var(--border)] bg-[var(--bg1)] px-4 py-3 text-sm text-[var(--text0)] outline-none"
            >
              <option value={ProviderType.OpenAI}>{providerTypeLabel(locale, ProviderType.OpenAI)}</option>
              <option value={ProviderType.Anthropic}>{providerTypeLabel(locale, ProviderType.Anthropic)}</option>
              <option value={ProviderType.Gemini}>{providerTypeLabel(locale, ProviderType.Gemini)}</option>
            </select>
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium text-[var(--text0)]">{t("management.model")}</span>
            <input
              value={draft.model}
              onChange={(event) => setDraft((state) => ({ ...state, model: event.currentTarget.value }))}
              className="mt-2 w-full rounded-2xl border border-[var(--border)] bg-[var(--bg1)] px-4 py-3 text-sm text-[var(--text0)] outline-none"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-[var(--text0)]">{t("management.baseUrl")}</span>
            <input
              value={draft.baseUrl ?? ""}
              onChange={(event) => setDraft((state) => ({ ...state, baseUrl: event.currentTarget.value }))}
              className="mt-2 w-full rounded-2xl border border-[var(--border)] bg-[var(--bg1)] px-4 py-3 text-sm text-[var(--text0)] outline-none"
              placeholder={t("management.baseUrlPlaceholder")}
            />
          </label>
        </div>

        <label className="block">
          <span className="text-sm font-medium text-[var(--text0)]">{t("management.apiKey")}</span>
          <input
            value={draft.apiKeyValue ?? ""}
            onChange={(event) => setDraft((state) => ({ ...state, apiKeyValue: event.currentTarget.value }))}
            className="mt-2 w-full rounded-2xl border border-[var(--border)] bg-[var(--bg1)] px-4 py-3 text-sm text-[var(--text0)] outline-none"
            placeholder={t("management.keepApiKey")}
          />
        </label>

        <label className="flex items-center gap-3 text-sm text-[var(--text1)]">
          <input
            type="checkbox"
            checked={draft.enabled}
            onChange={(event) => setDraft((state) => ({ ...state, enabled: event.currentTarget.checked }))}
          />
          {t("management.providerEnabled")}
        </label>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() =>
              void run(async () => {
                const saved = await saveProvider(draft);
                setDraft(emptyProviderDraft());
                setMessage(t("management.providerSaved", { name: saved.name }));
              })
            }
            className="rounded-full border border-[var(--accent)] px-5 py-3 text-sm font-medium text-[var(--accent)]"
          >
            {t("management.saveProvider")}
          </button>
          <button
            type="button"
            onClick={() => setDraft(emptyProviderDraft())}
            className="rounded-full border border-[var(--border)] px-5 py-3 text-sm text-[var(--text1)]"
          >
            {t("management.reset")}
          </button>
        </div>
      </div>
    </div>
  );
}

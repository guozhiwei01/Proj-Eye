import { useMemo, useState } from "react";
import Badge from "../components/shared/Badge";
import { validateProvider } from "../lib/backend";
import { secureStoreMessage, themeLabel, useI18n } from "../lib/i18n";
import { useAppStore } from "../store/app";
import { Locale, SecureStoreStrategy, ThemeMode } from "../types/models";

const themeOptions = [ThemeMode.Teal, ThemeMode.Amber, ThemeMode.Blue] as const;

export default function Settings() {
  const { locale, t } = useI18n();
  const config = useAppStore((state) => state.config);
  const secureStatus = useAppStore((state) => state.secureStatus);
  const lockVault = useAppStore((state) => state.lockVault);
  const saveSettings = useAppStore((state) => state.saveSettings);
  const [providerMessage, setProviderMessage] = useState<string | null>(null);
  const [providerBusy, setProviderBusy] = useState<string | null>(null);
  const [draft, setDraft] = useState(() => config.settings);

  const providerOptions = useMemo(
    () => config.providers.filter((provider) => provider.enabled),
    [config.providers],
  );

  const persist = async () => {
    await saveSettings(draft);
  };

  const handleValidate = async (providerId: string) => {
    setProviderBusy(providerId);
    try {
      const result = await validateProvider(providerId);
      const provider = config.providers.find((item) => item.id === providerId);
      if (!provider) {
        setProviderMessage(result.message);
        return;
      }
      setProviderMessage(
        result.ok
          ? t("settings.providers.valid", { name: provider.name })
          : t("settings.providers.missingKey", { name: provider.name }),
      );
    } finally {
      setProviderBusy(null);
    }
  };

  return (
    <section className="space-y-4">
      <div className="rounded-[2rem] border border-[var(--border)] bg-[linear-gradient(135deg,var(--bg1),var(--bg2))] px-6 py-6 shadow-[0_12px_60px_rgba(0,0,0,0.18)]">
        <p className="text-xs uppercase tracking-[0.28em] text-[var(--accent)]">{t("settings.title")}</p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--text0)]">
          {t("settings.heading")}
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--text1)]">{t("settings.description")}</p>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <div className="space-y-4 rounded-[2rem] border border-[var(--border)] bg-[var(--bg2)]/70 p-5">
          <div>
            <p className="text-sm font-semibold text-[var(--text0)]">{t("settings.theme")}</p>
            <div className="mt-3 flex gap-2">
              {themeOptions.map((theme) => (
                <button
                  key={theme}
                  type="button"
                  onClick={() => setDraft((state) => ({ ...state, theme }))}
                  className={`rounded-full border px-4 py-2 text-xs uppercase tracking-[0.18em] ${
                    draft.theme === theme
                      ? "border-[var(--accent)] bg-[var(--bg3)] text-[var(--accent)]"
                      : "border-[var(--border)] text-[var(--text1)]"
                  }`}
                >
                  {themeLabel(locale, theme)}
                </button>
              ))}
            </div>
          </div>

          <label className="block">
            <span className="text-sm font-medium text-[var(--text0)]">{t("settings.locale")}</span>
            <select
              value={draft.locale}
              onChange={(event) =>
                setDraft((state) => ({
                  ...state,
                  locale: event.currentTarget.value as "zh-CN" | "en-US",
                }))
              }
              className="mt-2 w-full rounded-2xl border border-[var(--border)] bg-[var(--bg1)] px-4 py-3 text-sm text-[var(--text0)] outline-none"
            >
              <option value={Locale.ZhCN}>{t("settings.locale.zh-CN")}</option>
              <option value={Locale.EnUS}>{t("settings.locale.en-US")}</option>
            </select>
          </label>

          <label className="block">
            <span className="text-sm font-medium text-[var(--text0)]">{t("settings.shortcutModifier")}</span>
            <select
              value={draft.shortcutModifier}
              onChange={(event) =>
                setDraft((state) => ({
                  ...state,
                  shortcutModifier: event.currentTarget.value as "meta" | "ctrl",
                }))
              }
              className="mt-2 w-full rounded-2xl border border-[var(--border)] bg-[var(--bg1)] px-4 py-3 text-sm text-[var(--text0)] outline-none"
            >
              <option value="meta">{t("settings.shortcut.meta")}</option>
              <option value="ctrl">{t("settings.shortcut.ctrl")}</option>
            </select>
          </label>

          <label className="block">
            <span className="text-sm font-medium text-[var(--text0)]">{t("settings.defaultProvider")}</span>
            <select
              value={draft.defaultAiProviderId ?? ""}
              onChange={(event) =>
                setDraft((state) => ({
                  ...state,
                  defaultAiProviderId: event.currentTarget.value || null,
                }))
              }
              className="mt-2 w-full rounded-2xl border border-[var(--border)] bg-[var(--bg1)] px-4 py-3 text-sm text-[var(--text0)] outline-none"
            >
              <option value="">{t("settings.noDefaultProvider")}</option>
              {providerOptions.map((provider) => (
                <option key={provider.id} value={provider.id}>
                  {provider.name} / {provider.model}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-sm font-medium text-[var(--text0)]">{t("settings.preferredModel")}</span>
            <input
              value={draft.preferredModel}
              onChange={(event) =>
                setDraft((state) => ({
                  ...state,
                  preferredModel: event.currentTarget.value,
                }))
              }
              className="mt-2 w-full rounded-2xl border border-[var(--border)] bg-[var(--bg1)] px-4 py-3 text-sm text-[var(--text0)] outline-none"
              placeholder={t("settings.preferredModelPlaceholder")}
            />
          </label>

          <button
            type="button"
            onClick={() => void persist()}
            className="rounded-full border border-[var(--accent)] px-5 py-3 text-sm font-medium text-[var(--accent)]"
          >
            {t("settings.save")}
          </button>
        </div>

        <div className="space-y-4 rounded-[2rem] border border-[var(--border)] bg-[var(--bg2)]/70 p-5">
          <div>
            <p className="text-sm font-semibold text-[var(--text0)]">{t("settings.providers")}</p>
            <div className="mt-3 space-y-3">
              {config.providers.length === 0 ? (
                <p className="text-sm text-[var(--text1)]">{t("settings.providers.empty")}</p>
              ) : (
                config.providers.map((provider) => (
                  <div
                    key={provider.id}
                    className="rounded-2xl border border-[var(--border)] bg-[var(--bg1)] px-4 py-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-[var(--text0)]">{provider.name}</p>
                        <p className="mt-1 text-xs uppercase tracking-[0.18em] text-[var(--text2)]">
                          {provider.type} / {provider.model}
                        </p>
                      </div>
                      <Badge tone={provider.enabled ? "accent" : "neutral"}>
                        {provider.enabled ? t("status.enabled") : t("status.disabled")}
                      </Badge>
                    </div>

                    <button
                      type="button"
                      onClick={() => void handleValidate(provider.id)}
                      className="mt-4 rounded-full border border-[var(--border)] px-4 py-2 text-xs uppercase tracking-[0.18em] text-[var(--text1)]"
                    >
                      {providerBusy === provider.id ? t("settings.providers.checking") : t("settings.providers.validate")}
                    </button>
                  </div>
                ))
              )}
            </div>

            {providerMessage ? <p className="mt-4 text-sm text-[var(--text1)]">{providerMessage}</p> : null}
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg1)] px-4 py-4">
            <p className="text-sm font-semibold text-[var(--text0)]">{t("settings.secureStore")}</p>
            <p className="mt-2 text-sm text-[var(--text1)]">
              {secureStatus.strategy === SecureStoreStrategy.Keyring
                ? t("settings.secureStore.keyring")
                : t("settings.secureStore.fallback")}
            </p>
            <p className="mt-3 text-xs uppercase tracking-[0.18em] text-[var(--text2)]">
              {secureStoreMessage(locale, secureStatus)}
            </p>
            {secureStatus.strategy === SecureStoreStrategy.FallbackVault ? (
              <button
                type="button"
                onClick={() => void lockVault()}
                className="mt-4 rounded-full border border-[var(--yellow)] px-4 py-2 text-xs uppercase tracking-[0.18em] text-[var(--yellow)]"
              >
                {t("settings.secureStore.lock")}
              </button>
            ) : (
              <div className="mt-4">
                <Badge tone="info">{t("settings.secureStore.ready")}</Badge>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

import { useEffect, useState } from "react";
import { validateProvider } from "../../../lib/backend";
import {
  localizeErrorMessage,
  secureStoreMessage,
  themeLabel,
  useI18n,
} from "../../../lib/i18n";
import { useAppStore } from "../../../store/app";
import Badge from "../../shared/Badge";
import Modal from "../../shared/Modal";
import { Locale, SecureStoreStrategy, ThemeMode } from "../../../types/models";
import { FieldLabel, modalPanelClass, workbenchCopy } from "./common";
import ProviderDialog from "./ProviderDialog";

const themeOptions = [ThemeMode.Teal, ThemeMode.Amber, ThemeMode.Blue] as const;

interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
}

export default function SettingsDialog({ open, onClose }: SettingsDialogProps) {
  const { locale, t } = useI18n();
  const copy = workbenchCopy(locale);
  const config = useAppStore((state) => state.config);
  const secureStatus = useAppStore((state) => state.secureStatus);
  const lockVault = useAppStore((state) => state.lockVault);
  const saveSettings = useAppStore((state) => state.saveSettings);
  const deleteProvider = useAppStore((state) => state.deleteProvider);

  const [draft, setDraft] = useState(() => config.settings);
  const [providerDialogOpen, setProviderDialogOpen] = useState(false);
  const [editingProviderId, setEditingProviderId] = useState<string | undefined>();
  const [validating, setValidating] = useState<string | null>(null);
  const [validateMsg, setValidateMsg] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setDraft(config.settings);
      setValidateMsg(null);
      setDeleteError(null);
    }
  }, [config.settings, open]);

  useEffect(() => {
    if (!open) {
      setProviderDialogOpen(false);
      setEditingProviderId(undefined);
    }
  }, [open]);

  const openNewProvider = () => {
    setEditingProviderId(undefined);
    setProviderDialogOpen(true);
  };

  const openEditProvider = (id: string) => {
    setEditingProviderId(id);
    setProviderDialogOpen(true);
  };

  const handleDeleteProvider = async (id: string) => {
    setDeleteError(null);
    try {
      await deleteProvider(id);
      // clear default if it was this provider
      if (draft.defaultAiProviderId === id) {
        setDraft((s) => ({ ...s, defaultAiProviderId: null }));
      }
    } catch (err) {
      setDeleteError(localizeErrorMessage(locale, err, "management.providerError"));
    }
  };

  const handleValidate = async (id: string) => {
    setValidating(id);
    setValidateMsg(null);
    try {
      const result = await validateProvider(id);
      const provider = config.providers.find((p) => p.id === id);
      setValidateMsg(
        result.ok
          ? t("settings.providers.valid", { name: provider?.name ?? id })
          : t("settings.providers.missingKey", { name: provider?.name ?? id }),
      );
    } finally {
      setValidating(null);
    }
  };

  const handleSubmit = async () => {
    await saveSettings(draft);
    onClose();
  };

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title={copy.settingsTitle}
        description={copy.settingsDesc}
        maxWidthClassName="max-w-5xl"
        footer={
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-[var(--border)] px-4 py-2 text-sm text-[var(--text1)]"
            >
              {copy.cancel}
            </button>
            <button
              type="button"
              onClick={() => void handleSubmit()}
              className="rounded-full border border-[var(--accent)] px-5 py-2.5 text-sm font-medium text-[var(--accent)]"
            >
              {copy.saveClose}
            </button>
          </div>
        }
      >
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          {/* ── Left: general settings ── */}
          <div className="space-y-4">
            <div className={modalPanelClass}>
              <p className="text-sm font-semibold text-[var(--text0)]">{t("settings.theme")}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {themeOptions.map((theme) => (
                  <button
                    key={theme}
                    type="button"
                    onClick={() => setDraft((s) => ({ ...s, theme }))}
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

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <label className="block">
                  <FieldLabel>{t("settings.locale")}</FieldLabel>
                  <select
                    value={draft.locale}
                    onChange={(event) => {
                      const value = event.currentTarget.value as "zh-CN" | "en-US";
                      setDraft((s) => ({ ...s, locale: value }));
                    }}
                    className="mt-2 w-full rounded-2xl border border-[var(--border)] bg-[var(--bg0)] px-4 py-3 text-sm text-[var(--text0)] outline-none"
                  >
                    <option value={Locale.ZhCN}>{t("settings.locale.zh-CN")}</option>
                    <option value={Locale.EnUS}>{t("settings.locale.en-US")}</option>
                  </select>
                </label>

                <label className="block">
                  <FieldLabel>{t("settings.shortcutModifier")}</FieldLabel>
                  <select
                    value={draft.shortcutModifier}
                    onChange={(event) => {
                      const value = event.currentTarget.value as "meta" | "ctrl";
                      setDraft((s) => ({ ...s, shortcutModifier: value }));
                    }}
                    className="mt-2 w-full rounded-2xl border border-[var(--border)] bg-[var(--bg0)] px-4 py-3 text-sm text-[var(--text0)] outline-none"
                  >
                    <option value="meta">{t("settings.shortcut.meta")}</option>
                    <option value="ctrl">{t("settings.shortcut.ctrl")}</option>
                  </select>
                </label>
              </div>

              <label className="mt-4 block">
                <FieldLabel>{t("settings.defaultProvider")}</FieldLabel>
                <select
                  value={draft.defaultAiProviderId ?? ""}
                  onChange={(event) => {
                    const value = event.currentTarget.value || null;
                    setDraft((s) => ({ ...s, defaultAiProviderId: value }));
                  }}
                  className="mt-2 w-full rounded-2xl border border-[var(--border)] bg-[var(--bg0)] px-4 py-3 text-sm text-[var(--text0)] outline-none"
                >
                  <option value="">{t("settings.noDefaultProvider")}</option>
                  {config.providers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} / {p.model}{p.enabled ? "" : " (disabled)"}
                    </option>
                  ))}
                </select>
              </label>

              <label className="mt-4 block">
                <FieldLabel>{t("settings.preferredModel")}</FieldLabel>
                <input
                  value={draft.preferredModel}
                  onChange={(event) => {
                    const value = event.currentTarget.value;
                    setDraft((s) => ({ ...s, preferredModel: value }));
                  }}
                  placeholder={t("settings.preferredModelPlaceholder")}
                  className="mt-2 w-full rounded-2xl border border-[var(--border)] bg-[var(--bg0)] px-4 py-3 text-sm text-[var(--text0)] outline-none placeholder:text-[var(--text2)]"
                />
              </label>
            </div>

            <div className={modalPanelClass}>
              <p className="text-sm font-semibold text-[var(--text0)]">{copy.secureStatus}</p>
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

          {/* ── Right: AI Provider CRUD ── */}
          <div className={modalPanelClass}>
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-[var(--text0)]">{t("settings.providers")}</p>
              <button
                type="button"
                onClick={openNewProvider}
                className="rounded-full border border-[var(--accent)] px-3.5 py-1.5 text-xs text-[var(--accent)] transition hover:bg-[var(--accent)]/10"
              >
                + {copy.newProvider ?? (locale === "zh-CN" ? "新建" : "New")}
              </button>
            </div>

            {deleteError ? (
              <p className="mt-3 text-sm text-[var(--red)]">{deleteError}</p>
            ) : null}
            {validateMsg ? (
              <p className="mt-3 text-sm text-[var(--text1)]">{validateMsg}</p>
            ) : null}

            <div className="mt-3 space-y-3">
              {config.providers.length === 0 ? (
                <p className="text-sm text-[var(--text1)]">{t("settings.providers.empty")}</p>
              ) : (
                config.providers.map((provider) => (
                  <div
                    key={provider.id}
                    className="rounded-2xl border border-[var(--border)] bg-[var(--bg0)]/55 px-4 py-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-[var(--text0)]">{provider.name}</p>
                        <p className="mt-1 text-xs uppercase tracking-[0.16em] text-[var(--text2)]">
                          {provider.type} / {provider.model}
                        </p>
                      </div>
                      <Badge tone={provider.enabled ? "accent" : "neutral"}>
                        {provider.enabled ? t("status.enabled") : t("status.disabled")}
                      </Badge>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => openEditProvider(provider.id)}
                        className="rounded-full border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--text1)] transition hover:border-[var(--border2)] hover:text-[var(--text0)]"
                      >
                        {locale === "zh-CN" ? "编辑" : "Edit"}
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleValidate(provider.id)}
                        disabled={validating === provider.id}
                        className="rounded-full border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--text1)] transition hover:border-[var(--border2)] hover:text-[var(--text0)] disabled:opacity-50"
                      >
                        {validating === provider.id
                          ? t("settings.providers.checking")
                          : t("settings.providers.validate")}
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDeleteProvider(provider.id)}
                        className="rounded-full border border-[var(--red)]/40 px-3 py-1.5 text-xs text-[var(--red)] transition hover:border-[var(--red)] hover:bg-[var(--red)]/8"
                      >
                        {locale === "zh-CN" ? "删除" : "Delete"}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </Modal>

      <ProviderDialog
        open={providerDialogOpen}
        entityId={editingProviderId}
        onClose={() => {
          setProviderDialogOpen(false);
          setEditingProviderId(undefined);
        }}
      />
    </>
  );
}

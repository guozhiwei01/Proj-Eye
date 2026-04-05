import { useEffect, useState } from "react";
import { inspectCredentialRef } from "../../../lib/backend";
import {
  localizeErrorMessage,
  providerTypeLabel,
  useI18n,
} from "../../../lib/i18n";
import { useAppStore } from "../../../store/app";
import Badge from "../../shared/Badge";
import Modal from "../../shared/Modal";
import { ProviderType, type ProviderDraft } from "../../../types/models";
import { FieldLabel, modalPanelClass, workbenchCopy } from "./common";

function emptyProviderDraft(): ProviderDraft {
  return {
    name: "",
    type: ProviderType.OpenAI,
    model: "",
    baseUrl: "",
    enabled: true,
  };
}

interface ProviderDialogProps {
  open: boolean;
  entityId?: string;
  onClose: () => void;
}

export default function ProviderDialog({ open, entityId, onClose }: ProviderDialogProps) {
  const { locale, t } = useI18n();
  const copy = workbenchCopy(locale);
  const config = useAppStore((state) => state.config);
  const saveProvider = useAppStore((state) => state.saveProvider);
  const [draft, setDraft] = useState<ProviderDraft>(emptyProviderDraft);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    if (!entityId) {
      setDraft(emptyProviderDraft());
      setError(null);
      return;
    }

    const provider = config.providers.find((item) => item.id === entityId);
    if (!provider) {
      return;
    }

    void inspectCredentialRef(provider.apiKeyRef).then((hasCredential) => {
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
      setError(null);
    });
  }, [config.providers, entityId, open]);

  const handleSubmit = async () => {
    setError(null);

    try {
      await saveProvider(draft);
      onClose();
    } catch (nextError) {
      setError(localizeErrorMessage(locale, nextError, "management.providerError"));
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={entityId ? copy.providerTitleEdit : copy.providerTitleNew}
      description={copy.providerDesc}
      maxWidthClassName="max-w-4xl"
      footer={
        <div className="flex items-center justify-between gap-3">
          <div>{error ? <p className="text-sm text-[var(--red)]">{error}</p> : null}</div>
          <div className="flex gap-2">
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
        </div>
      }
    >
      <div className="grid gap-5 lg:grid-cols-[minmax(0,0.88fr)_minmax(0,1.12fr)]">
        <div className={modalPanelClass}>
          <p className="text-[11px] uppercase tracking-[0.28em] text-[var(--accent2)]">{copy.overview}</p>
          <h3 className="mt-3 text-2xl font-semibold text-[var(--text0)]">
            {draft.name || (entityId ? t("management.name") : copy.providerTitleNew)}
          </h3>
          <div className="mt-4 flex flex-wrap gap-2">
            <Badge tone="accent">{providerTypeLabel(locale, draft.type)}</Badge>
            <Badge tone={draft.enabled ? "info" : "neutral"}>
              {draft.enabled ? t("status.enabled") : t("status.disabled")}
            </Badge>
          </div>
          <div className="mt-5 rounded-[1.4rem] border border-[var(--border)] bg-[var(--bg0)]/55 p-4">
            <p className="text-[11px] uppercase tracking-[0.22em] text-[var(--text2)]">{t("management.model")}</p>
            <p className="mt-2 text-sm text-[var(--text0)]">{draft.model || "model"}</p>
            <p className="mt-2 text-xs text-[var(--text1)]">{draft.baseUrl || "Managed endpoint"}</p>
          </div>
          <div className="mt-4">
            <p className="text-[11px] uppercase tracking-[0.22em] text-[var(--text2)]">
              {copy.providersReady}
            </p>
            <p className="mt-2 text-sm text-[var(--text1)]">
              {config.providers.filter((provider) => provider.enabled).length}
            </p>
          </div>
        </div>

        <div className="grid gap-4">
          <div className={modalPanelClass}>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <FieldLabel>{t("management.name")}</FieldLabel>
                <input
                  value={draft.name}
                  onChange={(event) =>
                    setDraft((state) => ({
                      ...state,
                      name: event.currentTarget.value,
                    }))
                  }
                  className="mt-2 w-full rounded-2xl border border-[var(--border)] bg-[var(--bg0)] px-4 py-3 text-sm text-[var(--text0)] outline-none"
                />
              </label>

              <label className="block">
                <FieldLabel>{t("management.providerType")}</FieldLabel>
                <select
                  value={draft.type}
                  onChange={(event) =>
                    setDraft((state) => ({
                      ...state,
                      type: event.currentTarget.value as ProviderDraft["type"],
                    }))
                  }
                  className="mt-2 w-full rounded-2xl border border-[var(--border)] bg-[var(--bg0)] px-4 py-3 text-sm text-[var(--text0)] outline-none"
                >
                  <option value={ProviderType.OpenAI}>{providerTypeLabel(locale, ProviderType.OpenAI)}</option>
                  <option value={ProviderType.Anthropic}>
                    {providerTypeLabel(locale, ProviderType.Anthropic)}
                  </option>
                  <option value={ProviderType.Gemini}>{providerTypeLabel(locale, ProviderType.Gemini)}</option>
                  <option value={ProviderType.Ollama}>{providerTypeLabel(locale, ProviderType.Ollama)}</option>
                </select>
              </label>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="block">
                <FieldLabel>{t("management.model")}</FieldLabel>
                <input
                  value={draft.model}
                  onChange={(event) =>
                    setDraft((state) => ({
                      ...state,
                      model: event.currentTarget.value,
                    }))
                  }
                  className="mt-2 w-full rounded-2xl border border-[var(--border)] bg-[var(--bg0)] px-4 py-3 text-sm text-[var(--text0)] outline-none"
                />
              </label>

              <label className="block">
                <FieldLabel>{t("management.baseUrl")}</FieldLabel>
                <input
                  value={draft.baseUrl ?? ""}
                  onChange={(event) =>
                    setDraft((state) => ({
                      ...state,
                      baseUrl: event.currentTarget.value,
                    }))
                  }
                  placeholder={t("management.baseUrlPlaceholder")}
                  className="mt-2 w-full rounded-2xl border border-[var(--border)] bg-[var(--bg0)] px-4 py-3 text-sm text-[var(--text0)] outline-none placeholder:text-[var(--text2)]"
                />
              </label>
            </div>

            <label className="mt-4 block">
              <FieldLabel>{t("management.apiKey")}</FieldLabel>
              <input
                value={draft.apiKeyValue ?? ""}
                onChange={(event) =>
                  setDraft((state) => ({
                    ...state,
                    apiKeyValue: event.currentTarget.value,
                  }))
                }
                placeholder={t("management.keepApiKey")}
                className="mt-2 w-full rounded-2xl border border-[var(--border)] bg-[var(--bg0)] px-4 py-3 text-sm text-[var(--text0)] outline-none placeholder:text-[var(--text2)]"
              />
            </label>

            <label className="mt-4 flex items-center gap-3 text-sm text-[var(--text1)]">
              <input
                type="checkbox"
                checked={draft.enabled}
                onChange={(event) =>
                  setDraft((state) => ({
                    ...state,
                    enabled: event.currentTarget.checked,
                  }))
                }
              />
              {t("management.providerEnabled")}
            </label>
          </div>
        </div>
      </div>
    </Modal>
  );
}

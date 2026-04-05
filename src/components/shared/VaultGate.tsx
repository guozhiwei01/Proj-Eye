import { useState } from "react";
import { secureStoreMessage, useI18n } from "../../lib/i18n";
import { useAppStore } from "../../store/app";

export default function VaultGate() {
  const { locale, t } = useI18n();
  const secureStatus = useAppStore((state) => state.secureStatus);
  const initializeVault = useAppStore((state) => state.initializeVault);
  const unlockVault = useAppStore((state) => state.unlockVault);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const requiresSetup = !secureStatus.initialized;

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      if (requiresSetup) {
        await initializeVault(password);
      } else {
        await unlockVault(password);
      }
      setPassword("");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : t("vault.error"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl items-center justify-center p-6">
      <div className="w-full rounded-[2rem] border border-[var(--border)] bg-[linear-gradient(180deg,var(--bg1),var(--bg2))] p-8 shadow-[0_20px_100px_rgba(0,0,0,0.28)]">
        <p className="text-xs uppercase tracking-[0.28em] text-[var(--accent)]">{t("vault.title")}</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--text0)]">
          {requiresSetup ? t("vault.createHeading") : t("vault.unlockHeading")}
        </h1>
        <p className="mt-3 text-sm leading-7 text-[var(--text1)]">{secureStoreMessage(locale, secureStatus)}</p>

        <label className="mt-6 block">
          <span className="text-sm font-medium text-[var(--text0)]">{t("vault.password")}</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.currentTarget.value)}
            className="mt-2 w-full rounded-2xl border border-[var(--border)] bg-[var(--bg0)] px-4 py-3 text-sm text-[var(--text0)] outline-none placeholder:text-[var(--text2)]"
            placeholder={requiresSetup ? t("vault.createPlaceholder") : t("vault.unlockPlaceholder")}
          />
        </label>

        {error ? <p className="mt-4 text-sm text-[var(--red)]">{error}</p> : null}

        <button
          type="button"
          onClick={() => void submit()}
          disabled={busy || password.trim().length === 0}
          className="mt-6 rounded-full border border-[var(--accent)] px-5 py-3 text-sm font-medium text-[var(--accent)] transition disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? t("vault.working") : requiresSetup ? t("vault.create") : t("vault.unlock")}
        </button>
      </div>
    </div>
  );
}

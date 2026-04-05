import { useEffect } from "react";
import Home from "./pages/Home";
import VaultGate from "./components/shared/VaultGate";
import { useI18n } from "./lib/i18n";
import { ensureRuntimeListeners } from "./lib/runtime-events";
import { useAppStore } from "./store/app";
import { SecureStoreStrategy } from "./types/models";

function App() {
  const theme = useAppStore((state) => state.theme);
  const locale = useAppStore((state) => state.config.settings.locale);
  const initialized = useAppStore((state) => state.initialized);
  const bootstrapping = useAppStore((state) => state.bootstrapping);
  const secureStatus = useAppStore((state) => state.secureStatus);
  const initialize = useAppStore((state) => state.initialize);
  const { t } = useI18n();

  useEffect(() => {
    void initialize();
  }, [initialize]);

  useEffect(() => {
    let dispose: (() => void) | undefined;

    void ensureRuntimeListeners().then((unlisten) => {
      dispose = unlisten;
    });

    return () => {
      dispose?.();
    };
  }, []);

  useEffect(() => {
    if (locale) {
      document.documentElement.lang = locale;
    }
  }, [locale]);

  const requiresVaultGate =
    initialized &&
    secureStatus.strategy === SecureStoreStrategy.FallbackVault &&
    (!secureStatus.initialized || secureStatus.locked);

  return (
    <div data-theme={theme} className="min-h-screen bg-[var(--bg0)] text-[var(--text0)]">
      {bootstrapping ? (
        <div className="flex min-h-screen items-center justify-center text-sm text-[var(--text1)]">
          {t("app.bootstrapping")}
        </div>
      ) : requiresVaultGate ? (
        <VaultGate />
      ) : (
        <Home />
      )}
    </div>
  );
}

export default App;

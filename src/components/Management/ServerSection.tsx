import { useState } from "react";
import { authTypeLabel, osTypeLabel, useI18n } from "../../lib/i18n";
import { inspectCredentialRef } from "../../lib/backend";
import { useAppStore } from "../../store/app";
import { AuthType, OSType, type ServerDraft } from "../../types/models";
import Badge from "../shared/Badge";

function emptyServerDraft(): ServerDraft {
  return {
    name: "",
    host: "",
    port: 22,
    username: "",
    authType: AuthType.PrivateKey,
    group: "production",
    osType: OSType.Linux,
  };
}

export default function ServerSection() {
  const { locale, t } = useI18n();
  const config = useAppStore((state) => state.config);
  const saveServer = useAppStore((state) => state.saveServer);
  const deleteServer = useAppStore((state) => state.deleteServer);
  const [draft, setDraft] = useState<ServerDraft>(emptyServerDraft);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const hydrate = async (serverId: string) => {
    const server = config.servers.find((item) => item.id === serverId);
    if (!server) {
      return;
    }
    const hasCredential = await inspectCredentialRef(server.credentialRef);
    setDraft({
      id: server.id,
      name: server.name,
      host: server.host,
      port: server.port,
      username: server.username,
      authType: server.authType,
      group: server.group,
      osType: server.osType,
      credentialRef: server.credentialRef,
      credentialValue: hasCredential ? "" : undefined,
    });
  };

  const run = async (action: () => Promise<void>) => {
    setMessage(null);
    setError(null);
    try {
      await action();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : t("management.serverError"));
    }
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <div className="space-y-3 rounded-[2rem] border border-[var(--border)] bg-[var(--bg2)]/70 p-5">
        {message ? <p className="text-sm text-[var(--accent)]">{message}</p> : null}
        {error ? <p className="text-sm text-[var(--red)]">{error}</p> : null}
        {config.servers.map((server) => (
          <div key={server.id} className="rounded-2xl border border-[var(--border)] bg-[var(--bg1)] px-4 py-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-[var(--text0)]">{server.name}</p>
                <p className="mt-1 text-xs uppercase tracking-[0.18em] text-[var(--text2)]">
                  {server.username}@{server.host}:{server.port}
                </p>
              </div>
              <Badge tone="info">{authTypeLabel(locale, server.authType)}</Badge>
            </div>

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => void hydrate(server.id)}
                className="rounded-full border border-[var(--border)] px-3 py-2 text-xs uppercase tracking-[0.18em] text-[var(--text1)]"
              >
                {t("management.edit")}
              </button>
              <button
                type="button"
                onClick={() =>
                  void run(async () => {
                    await deleteServer(server.id);
                    setMessage(t("management.serverDeleted"));
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
        <label className="block">
          <span className="text-sm font-medium text-[var(--text0)]">{t("management.name")}</span>
          <input
            value={draft.name}
            onChange={(event) => setDraft((state) => ({ ...state, name: event.currentTarget.value }))}
            className="mt-2 w-full rounded-2xl border border-[var(--border)] bg-[var(--bg1)] px-4 py-3 text-sm text-[var(--text0)] outline-none"
          />
        </label>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium text-[var(--text0)]">{t("management.host")}</span>
            <input
              value={draft.host}
              onChange={(event) => setDraft((state) => ({ ...state, host: event.currentTarget.value }))}
              className="mt-2 w-full rounded-2xl border border-[var(--border)] bg-[var(--bg1)] px-4 py-3 text-sm text-[var(--text0)] outline-none"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-[var(--text0)]">{t("management.port")}</span>
            <input
              type="number"
              value={draft.port}
              onChange={(event) => setDraft((state) => ({ ...state, port: Number(event.currentTarget.value) }))}
              className="mt-2 w-full rounded-2xl border border-[var(--border)] bg-[var(--bg1)] px-4 py-3 text-sm text-[var(--text0)] outline-none"
            />
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium text-[var(--text0)]">{t("management.username")}</span>
            <input
              value={draft.username}
              onChange={(event) => setDraft((state) => ({ ...state, username: event.currentTarget.value }))}
              className="mt-2 w-full rounded-2xl border border-[var(--border)] bg-[var(--bg1)] px-4 py-3 text-sm text-[var(--text0)] outline-none"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-[var(--text0)]">{t("management.group")}</span>
            <input
              value={draft.group}
              onChange={(event) => setDraft((state) => ({ ...state, group: event.currentTarget.value }))}
              className="mt-2 w-full rounded-2xl border border-[var(--border)] bg-[var(--bg1)] px-4 py-3 text-sm text-[var(--text0)] outline-none"
            />
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium text-[var(--text0)]">{t("management.authType")}</span>
            <select
              value={draft.authType}
              onChange={(event) =>
                setDraft((state) => ({ ...state, authType: event.currentTarget.value as ServerDraft["authType"] }))
              }
              className="mt-2 w-full rounded-2xl border border-[var(--border)] bg-[var(--bg1)] px-4 py-3 text-sm text-[var(--text0)] outline-none"
            >
              <option value={AuthType.Password}>{authTypeLabel(locale, AuthType.Password)}</option>
              <option value={AuthType.PrivateKey}>{authTypeLabel(locale, AuthType.PrivateKey)}</option>
              <option value={AuthType.Agent}>{authTypeLabel(locale, AuthType.Agent)}</option>
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-medium text-[var(--text0)]">{t("management.osType")}</span>
            <select
              value={draft.osType}
              onChange={(event) =>
                setDraft((state) => ({ ...state, osType: event.currentTarget.value as ServerDraft["osType"] }))
              }
              className="mt-2 w-full rounded-2xl border border-[var(--border)] bg-[var(--bg1)] px-4 py-3 text-sm text-[var(--text0)] outline-none"
            >
              <option value={OSType.Linux}>{osTypeLabel(locale, OSType.Linux)}</option>
              <option value={OSType.Macos}>{osTypeLabel(locale, OSType.Macos)}</option>
              <option value={OSType.Windows}>{osTypeLabel(locale, OSType.Windows)}</option>
            </select>
          </label>
        </div>

        {draft.authType !== AuthType.Agent ? (
          <label className="block">
            <span className="text-sm font-medium text-[var(--text0)]">
              {draft.authType === AuthType.PrivateKey ? t("management.privateKey") : t("management.password")}
            </span>
            <textarea
              value={draft.credentialValue ?? ""}
              onChange={(event) => setDraft((state) => ({ ...state, credentialValue: event.currentTarget.value }))}
              rows={4}
              className="mt-2 w-full rounded-2xl border border-[var(--border)] bg-[var(--bg1)] px-4 py-3 text-sm text-[var(--text0)] outline-none"
              placeholder={t("management.keepSecret")}
            />
          </label>
        ) : null}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() =>
              void run(async () => {
                const saved = await saveServer(draft);
                setDraft(emptyServerDraft());
                setMessage(t("management.serverSaved", { name: saved.name }));
              })
            }
            className="rounded-full border border-[var(--accent)] px-5 py-3 text-sm font-medium text-[var(--accent)]"
          >
            {t("management.saveServer")}
          </button>
          <button
            type="button"
            onClick={() => setDraft(emptyServerDraft())}
            className="rounded-full border border-[var(--border)] px-5 py-3 text-sm text-[var(--text1)]"
          >
            {t("management.reset")}
          </button>
        </div>
      </div>
    </div>
  );
}

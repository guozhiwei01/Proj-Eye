import { useEffect, useMemo, useState } from "react";
import { inspectCredentialRef } from "../../../lib/backend";
import {
  authTypeLabel,
  localizeErrorMessage,
  osTypeLabel,
  useI18n,
} from "../../../lib/i18n";
import { getProjectManagerPath, managerPathLabel } from "../../../lib/project-manager";
import { useAppStore } from "../../../store/app";
import Badge from "../../shared/Badge";
import Modal from "../../shared/Modal";
import { AuthType, OSType, type Server, type ServerDraft } from "../../../types/models";
import { FieldLabel, modalPanelClass, workbenchCopy } from "./common";

function emptyServerDraft(): ServerDraft {
  return {
    name: "",
    host: "",
    port: 22,
    username: "",
    authType: AuthType.Password,
    group: "production",
    osType: OSType.Linux,
  };
}

interface ServerDialogProps {
  open: boolean;
  entityId?: string;
  initialDraft?: Partial<ServerDraft>;
  onSaved?: (server: Server) => void;
  onClose: () => void;
}

export default function ServerDialog({
  open,
  entityId,
  initialDraft,
  onSaved,
  onClose,
}: ServerDialogProps) {
  const { locale, t } = useI18n();
  const copy = workbenchCopy(locale);
  const config = useAppStore((state) => state.config);
  const saveServer = useAppStore((state) => state.saveServer);
  const [draft, setDraft] = useState<ServerDraft>(emptyServerDraft);
  const [error, setError] = useState<string | null>(null);
  const relatedProjects = useMemo(
    () => config.projects.filter((project) => project.serverId === entityId),
    [config.projects, entityId],
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    if (!entityId) {
      setDraft({
        ...emptyServerDraft(),
        ...initialDraft,
      });
      setError(null);
      return;
    }

    const server = config.servers.find((item) => item.id === entityId);
    if (!server) {
      return;
    }

    void inspectCredentialRef(server.credentialRef).then((hasCredential) => {
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
      setError(null);
    });
  }, [config.servers, entityId, initialDraft, open]);

  const handleSubmit = async () => {
    setError(null);

    try {
      const saved = await saveServer(draft);
      onSaved?.(saved);
      onClose();
    } catch (nextError) {
      setError(localizeErrorMessage(locale, nextError, "management.serverError"));
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={entityId ? copy.serverTitleEdit : copy.serverTitleNew}
      description={copy.serverDesc}
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
            {draft.name || (entityId ? t("management.name") : copy.serverTitleNew)}
          </h3>
          <div className="mt-4 flex flex-wrap gap-2">
            <Badge tone="accent">{authTypeLabel(locale, draft.authType)}</Badge>
            <Badge tone="info">{osTypeLabel(locale, draft.osType)}</Badge>
            <Badge>{draft.group || "default"}</Badge>
          </div>
          <div className="mt-5 rounded-[1.4rem] border border-[var(--border)] bg-[var(--bg0)]/55 p-4">
            <p className="text-[11px] uppercase tracking-[0.22em] text-[var(--text2)]">
              {t("management.host")}
            </p>
            <p className="mt-2 text-sm text-[var(--text0)]">
              {draft.username || "user"}@{draft.host || "host"}:{draft.port}
            </p>
          </div>
          <div className="mt-4">
            <p className="text-[11px] uppercase tracking-[0.22em] text-[var(--text2)]">{copy.attachCount}</p>
            <div className="mt-3 space-y-2">
              {relatedProjects.length === 0 ? (
                <p className="text-sm text-[var(--text1)]">{t("sidebar.empty.allProjects")}</p>
              ) : (
                relatedProjects.map((project) => (
                  <div
                    key={project.id}
                    className="rounded-2xl border border-[var(--border)] bg-[var(--bg0)]/45 px-4 py-3 text-sm text-[var(--text1)]"
                  >
                    <p className="font-medium text-[var(--text0)]">{project.name}</p>
                    <p className="mt-1">{managerPathLabel(getProjectManagerPath(project))}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="grid gap-4">
          <div className={modalPanelClass}>
            <label className="block">
              <FieldLabel>{t("management.name")}</FieldLabel>
              <input
                value={draft.name}
                onChange={(event) => {
                  const value = event.currentTarget.value;
                  setDraft((state) => ({ ...state, name: value }));
                }}
                className="mt-2 w-full rounded-2xl border border-[var(--border)] bg-[var(--bg0)] px-4 py-3 text-sm text-[var(--text0)] outline-none"
              />
            </label>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="block">
                <FieldLabel>{t("management.host")}</FieldLabel>
                <input
                  value={draft.host}
                  onChange={(event) => {
                    const value = event.currentTarget.value;
                    setDraft((state) => ({ ...state, host: value }));
                  }}
                  className="mt-2 w-full rounded-2xl border border-[var(--border)] bg-[var(--bg0)] px-4 py-3 text-sm text-[var(--text0)] outline-none"
                />
              </label>

              <label className="block">
                <FieldLabel>{t("management.port")}</FieldLabel>
                <input
                  type="number"
                  value={draft.port}
                  onChange={(event) => {
                    const value = Number(event.currentTarget.value);
                    setDraft((state) => ({ ...state, port: value }));
                  }}
                  className="mt-2 w-full rounded-2xl border border-[var(--border)] bg-[var(--bg0)] px-4 py-3 text-sm text-[var(--text0)] outline-none"
                />
              </label>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="block">
                <FieldLabel>{t("management.username")}</FieldLabel>
                <input
                  value={draft.username}
                  onChange={(event) => {
                    const value = event.currentTarget.value;
                    setDraft((state) => ({ ...state, username: value }));
                  }}
                  className="mt-2 w-full rounded-2xl border border-[var(--border)] bg-[var(--bg0)] px-4 py-3 text-sm text-[var(--text0)] outline-none"
                />
              </label>

              <label className="block">
                <FieldLabel>{t("management.group")}</FieldLabel>
                <input
                  value={draft.group}
                  onChange={(event) => {
                    const value = event.currentTarget.value;
                    setDraft((state) => ({ ...state, group: value }));
                  }}
                  className="mt-2 w-full rounded-2xl border border-[var(--border)] bg-[var(--bg0)] px-4 py-3 text-sm text-[var(--text0)] outline-none"
                />
              </label>
            </div>
          </div>

          <div className={modalPanelClass}>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <FieldLabel>{t("management.authType")}</FieldLabel>
                <select
                  value={draft.authType}
                  onChange={(event) => {
                    const value = event.currentTarget.value as ServerDraft["authType"];
                    setDraft((state) => ({ ...state, authType: value }));
                  }}
                  className="mt-2 w-full rounded-2xl border border-[var(--border)] bg-[var(--bg0)] px-4 py-3 text-sm text-[var(--text0)] outline-none"
                >
                  <option value={AuthType.Password}>{authTypeLabel(locale, AuthType.Password)}</option>
                  <option value={AuthType.PrivateKey}>{authTypeLabel(locale, AuthType.PrivateKey)}</option>
                  <option value={AuthType.Agent}>{authTypeLabel(locale, AuthType.Agent)}</option>
                </select>
              </label>

              <label className="block">
                <FieldLabel>{t("management.osType")}</FieldLabel>
                <select
                  value={draft.osType}
                  onChange={(event) => {
                    const value = event.currentTarget.value as ServerDraft["osType"];
                    setDraft((state) => ({ ...state, osType: value }));
                  }}
                  className="mt-2 w-full rounded-2xl border border-[var(--border)] bg-[var(--bg0)] px-4 py-3 text-sm text-[var(--text0)] outline-none"
                >
                  <option value={OSType.Linux}>{osTypeLabel(locale, OSType.Linux)}</option>
                  <option value={OSType.Macos}>{osTypeLabel(locale, OSType.Macos)}</option>
                  <option value={OSType.Windows}>{osTypeLabel(locale, OSType.Windows)}</option>
                </select>
              </label>
            </div>

            {draft.authType !== AuthType.Agent ? (
              <label className="mt-4 block">
                <FieldLabel>
                  {draft.authType === AuthType.PrivateKey ? t("management.privateKey") : t("management.password")}
                </FieldLabel>
                <textarea
                  rows={5}
                  value={draft.credentialValue ?? ""}
                  onChange={(event) => {
                    const value = event.currentTarget.value;
                    setDraft((state) => ({ ...state, credentialValue: value }));
                  }}
                  placeholder={t("management.keepSecret")}
                  className="mt-2 w-full rounded-2xl border border-[var(--border)] bg-[var(--bg0)] px-4 py-3 text-sm text-[var(--text0)] outline-none placeholder:text-[var(--text2)]"
                />
              </label>
            ) : null}
          </div>
        </div>
      </div>
    </Modal>
  );
}

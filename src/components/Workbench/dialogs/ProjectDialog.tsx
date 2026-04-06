import { useEffect, useMemo, useState } from "react";
import {
  deployTypeLabel,
  environmentLabel,
  localizeErrorMessage,
  logSourceTypeLabel,
  useI18n,
} from "../../../lib/i18n";
import {
  getProjectManagerPath,
  normalizeManagerPathInput,
  setProjectManagerPath,
} from "../../../lib/project-manager";
import { useAppStore } from "../../../store/app";
import Modal from "../../shared/Modal";
import DatabaseDialog from "./DatabaseDialog";
import ServerDialog from "./ServerDialog";
import {
  DeployType,
  Environment,
  LogSourceType,
  type DatabaseDraft,
  type ServerDraft,
  type ProjectDraft,
} from "../../../types/models";
import { FieldLabel, modalPanelClass, workbenchCopy } from "./common";

function emptyProjectDraft(initialPath: string[] = []): ProjectDraft {
  return {
    name: "",
    serverId: "",
    rootPath: "",
    environment: Environment.Production,
    databaseIds: [],
    deployType: DeployType.Pm2,
    logSources: [
      {
        id: crypto.randomUUID(),
        type: LogSourceType.File,
        value: "",
        label: "",
      },
    ],
    healthCheckCommand: "",
    tags: [],
    extra: setProjectManagerPath(undefined, initialPath),
  };
}

function updatePrimaryLog(
  logSources: ProjectDraft["logSources"],
  patch: Partial<ProjectDraft["logSources"][number]>,
): ProjectDraft["logSources"] {
  const current = logSources[0] ?? {
    id: crypto.randomUUID(),
    type: LogSourceType.File,
    value: "",
    label: "",
  };

  return [
    {
      ...current,
      ...patch,
    },
  ];
}

interface ProjectDialogProps {
  open: boolean;
  entityId?: string;
  initialPath?: string[];
  onClose: () => void;
}

export default function ProjectDialog({
  open,
  entityId,
  initialPath,
  onClose,
}: ProjectDialogProps) {
  const { locale, t } = useI18n();
  const copy = workbenchCopy(locale);
  const config = useAppStore((state) => state.config);
  const saveProject = useAppStore((state) => state.saveProject);
  const [draft, setDraft] = useState<ProjectDraft>(() => emptyProjectDraft(initialPath));
  const [pathInput, setPathInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [serverDialogOpen, setServerDialogOpen] = useState(false);
  const [databaseDialogOpen, setDatabaseDialogOpen] = useState(false);
  const tagText = useMemo(() => draft.tags.join(", "), [draft.tags]);
  const selectedServer = config.servers.find((server) => server.id === draft.serverId) ?? null;
  const pathSegments = normalizeManagerPathInput(pathInput);
  const nameRequiredMessage = locale === "zh-CN" ? "请先填写项目名称。" : "Enter a project name first.";
  const serverRequiredMessage =
    locale === "zh-CN" ? "请先选择或新建服务器。" : "Select or create a server first.";
  const serverDraftSeed: Partial<ServerDraft> = useMemo(
    () => ({
      group: draft.environment,
    }),
    [draft.environment],
  );
  const databaseDraftSeed: Partial<DatabaseDraft> = useMemo(
    () => ({
      group: draft.environment,
      host: selectedServer?.host ?? "",
    }),
    [draft.environment, selectedServer],
  );
  const addLinkClass =
    "mt-2 inline-block text-xs text-[var(--accent)] hover:underline cursor-pointer";

  useEffect(() => {
    if (!open) {
      return;
    }

    if (entityId) {
      const project = config.projects.find((item) => item.id === entityId);
      if (!project) {
        return;
      }

      setDraft({
        id: project.id,
        name: project.name,
        serverId: project.serverId,
        rootPath: project.rootPath,
        environment: project.environment,
        databaseIds: project.databaseIds,
        deployType: project.deployType,
        logSources: project.logSources,
        healthCheckCommand: project.healthCheckCommand,
        tags: project.tags,
        extra: project.extra,
      });
      setPathInput(getProjectManagerPath(project).join(" / "));
      setError(null);
      return;
    }

    const nextDraft = emptyProjectDraft(initialPath ?? []);
    setDraft(nextDraft);
    setPathInput(getProjectManagerPath(nextDraft).join(" / "));
    setError(null);
  }, [config.projects, entityId, initialPath, open]);

  useEffect(() => {
    if (!open) {
      setServerDialogOpen(false);
      setDatabaseDialogOpen(false);
    }
  }, [open]);

  const handleSubmit = async () => {
    setError(null);

    if (!draft.name.trim()) {
      setError(nameRequiredMessage);
      return;
    }

    if (!draft.serverId) {
      setError(serverRequiredMessage);
      return;
    }

    try {
      await saveProject({
        ...draft,
        name: draft.name.trim(),
        extra: setProjectManagerPath(draft.extra, pathSegments),
      });
      onClose();
    } catch (nextError) {
      setError(localizeErrorMessage(locale, nextError, "management.projectError"));
    }
  };

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title={entityId ? copy.projectTitleEdit : copy.projectTitleNew}
        description={copy.projectDesc}
        footer={
          <div className="flex items-center justify-between gap-3">
            <div>{error ? <p className="text-sm text-[var(--red)]">{error}</p> : null}</div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-full border border-[var(--border)] px-4 py-2 text-sm text-[var(--text1)] transition hover:border-[var(--border2)] hover:text-[var(--text0)]"
              >
                {copy.cancel}
              </button>
              <button
                type="button"
                onClick={() => void handleSubmit()}
                className="rounded-full border border-[var(--accent)] px-5 py-2.5 text-sm font-medium text-[var(--accent)] transition hover:bg-[var(--accent)]/10"
              >
                {copy.saveClose}
              </button>
            </div>
          </div>
        }
      >
        <div className="space-y-4">
          <div className={modalPanelClass}>
            <label className="block">
              <FieldLabel>{t("management.projectName")}</FieldLabel>
              <input
                value={draft.name}
                onChange={(event) => {
                  const value = event.currentTarget.value;
                  setDraft((state) => ({ ...state, name: value }));
                }}
                className="mt-2 w-full rounded-2xl border border-[var(--border)] bg-[var(--bg0)] px-4 py-3 text-sm text-[var(--text0)] outline-none transition focus:border-[var(--accent)]"
              />
            </label>

            <label className="mt-4 block">
              <FieldLabel>{copy.hierarchyPath}</FieldLabel>
              <input
                value={pathInput}
                onChange={(event) => setPathInput(event.currentTarget.value)}
                placeholder={copy.hierarchyPlaceholder}
                className="mt-2 w-full rounded-2xl border border-[var(--border)] bg-[var(--bg0)] px-4 py-3 text-sm text-[var(--text0)] outline-none transition placeholder:text-[var(--text2)] focus:border-[var(--accent)]"
              />
              <p className="mt-1.5 text-xs text-[var(--text2)]">{copy.hierarchyHint}</p>
            </label>

            <label className="mt-4 block">
              <FieldLabel>{t("management.server")}</FieldLabel>
              {config.servers.length === 0 ? (
                <button
                  type="button"
                  onClick={() => setServerDialogOpen(true)}
                  className={addLinkClass}
                >
                  + {copy.newServer}
                </button>
              ) : (
                <>
                  <select
                    value={draft.serverId}
                    onChange={(event) => {
                      const value = event.currentTarget.value;
                      setDraft((state) => ({ ...state, serverId: value }));
                    }}
                    className="mt-2 w-full rounded-2xl border border-[var(--border)] bg-[var(--bg0)] px-4 py-3 text-sm text-[var(--text0)] outline-none"
                  >
                    <option value="">{t("management.selectServer")}</option>
                    {config.servers.map((server) => (
                      <option key={server.id} value={server.id}>
                        {server.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setServerDialogOpen(true)}
                    className={addLinkClass}
                  >
                    + {copy.newServer}
                  </button>
                </>
              )}
            </label>

            <label className="mt-4 block">
              <FieldLabel>{t("management.rootPath")}</FieldLabel>
              <input
                value={draft.rootPath}
                onChange={(event) => {
                  const value = event.currentTarget.value;
                  setDraft((state) => ({ ...state, rootPath: value }));
                }}
                className="mt-2 w-full rounded-2xl border border-[var(--border)] bg-[var(--bg0)] px-4 py-3 text-sm text-[var(--text0)] outline-none transition focus:border-[var(--accent)]"
              />
            </label>
          </div>

          <div className={modalPanelClass}>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <FieldLabel>{t("management.environment")}</FieldLabel>
                <select
                  value={draft.environment}
                  onChange={(event) => {
                    const value = event.currentTarget.value as ProjectDraft["environment"];
                    setDraft((state) => ({ ...state, environment: value }));
                  }}
                  className="mt-2 w-full rounded-2xl border border-[var(--border)] bg-[var(--bg0)] px-4 py-3 text-sm text-[var(--text0)] outline-none"
                >
                  <option value={Environment.Production}>{environmentLabel(locale, Environment.Production)}</option>
                  <option value={Environment.Staging}>{environmentLabel(locale, Environment.Staging)}</option>
                  <option value={Environment.Development}>{environmentLabel(locale, Environment.Development)}</option>
                </select>
              </label>

              <label className="block">
                <FieldLabel>{t("management.deployType")}</FieldLabel>
                <select
                  value={draft.deployType}
                  onChange={(event) => {
                    const value = event.currentTarget.value as ProjectDraft["deployType"];
                    setDraft((state) => ({ ...state, deployType: value }));
                  }}
                  className="mt-2 w-full rounded-2xl border border-[var(--border)] bg-[var(--bg0)] px-4 py-3 text-sm text-[var(--text0)] outline-none"
                >
                  <option value={DeployType.Pm2}>{deployTypeLabel(locale, DeployType.Pm2)}</option>
                  <option value={DeployType.Docker}>{deployTypeLabel(locale, DeployType.Docker)}</option>
                  <option value={DeployType.Systemd}>{deployTypeLabel(locale, DeployType.Systemd)}</option>
                  <option value={DeployType.PhpFpm}>{deployTypeLabel(locale, DeployType.PhpFpm)}</option>
                  <option value={DeployType.Custom}>{deployTypeLabel(locale, DeployType.Custom)}</option>
                </select>
              </label>
            </div>

            <div className="mt-4">
              <FieldLabel>{t("management.databases")}</FieldLabel>
              {config.databases.length === 0 ? (
                <button
                  type="button"
                  onClick={() => setDatabaseDialogOpen(true)}
                  className={addLinkClass}
                >
                  + {copy.newDatabase}
                </button>
              ) : (
                <>
                  <div className="mt-2 grid gap-2 md:grid-cols-2">
                    {config.databases.map((database) => (
                      <label
                        key={database.id}
                        className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm ${
                          draft.databaseIds.includes(database.id)
                            ? "border-[var(--accent)] bg-[var(--bg0)] text-[var(--text0)]"
                            : "border-[var(--border)] bg-[var(--bg0)]/55 text-[var(--text1)]"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={draft.databaseIds.includes(database.id)}
                          onChange={(event) => {
                            const checked = event.currentTarget.checked;
                            setDraft((state) => ({
                              ...state,
                              databaseIds: checked
                                ? [...state.databaseIds, database.id]
                                : state.databaseIds.filter((item) => item !== database.id),
                            }));
                          }}
                        />
                        <span className="flex-1">{database.name}</span>
                        <span className="text-[10px] uppercase tracking-[0.16em] text-[var(--text2)]">
                          {database.type}
                        </span>
                      </label>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => setDatabaseDialogOpen(true)}
                    className={addLinkClass}
                  >
                    + {copy.newDatabase}
                  </button>
                </>
              )}
            </div>
          </div>

          <div className={modalPanelClass}>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <FieldLabel>{t("management.primaryLogType")}</FieldLabel>
                <select
                  value={draft.logSources[0]?.type ?? LogSourceType.File}
                  onChange={(event) => {
                    const value = event.currentTarget.value as ProjectDraft["logSources"][number]["type"];
                    setDraft((state) => ({
                      ...state,
                      logSources: updatePrimaryLog(state.logSources, { type: value }),
                    }));
                  }}
                  className="mt-2 w-full rounded-2xl border border-[var(--border)] bg-[var(--bg0)] px-4 py-3 text-sm text-[var(--text0)] outline-none"
                >
                  <option value={LogSourceType.File}>{logSourceTypeLabel(locale, LogSourceType.File)}</option>
                  <option value={LogSourceType.Command}>{logSourceTypeLabel(locale, LogSourceType.Command)}</option>
                  <option value={LogSourceType.Docker}>{logSourceTypeLabel(locale, LogSourceType.Docker)}</option>
                  <option value={LogSourceType.Pm2}>{logSourceTypeLabel(locale, LogSourceType.Pm2)}</option>
                  <option value={LogSourceType.Journald}>{logSourceTypeLabel(locale, LogSourceType.Journald)}</option>
                </select>
              </label>

              <label className="block">
                <FieldLabel>{t("management.primaryLogLabel")}</FieldLabel>
                <input
                  value={draft.logSources[0]?.label ?? ""}
                  onChange={(event) => {
                    const value = event.currentTarget.value;
                    setDraft((state) => ({
                      ...state,
                      logSources: updatePrimaryLog(state.logSources, { label: value }),
                    }));
                  }}
                  className="mt-2 w-full rounded-2xl border border-[var(--border)] bg-[var(--bg0)] px-4 py-3 text-sm text-[var(--text0)] outline-none transition focus:border-[var(--accent)]"
                />
              </label>
            </div>

            <label className="mt-4 block">
              <FieldLabel>{t("management.primaryLogValue")}</FieldLabel>
              <input
                value={draft.logSources[0]?.value ?? ""}
                onChange={(event) => {
                  const value = event.currentTarget.value;
                  setDraft((state) => ({
                    ...state,
                    logSources: updatePrimaryLog(state.logSources, { value }),
                  }));
                }}
                className="mt-2 w-full rounded-2xl border border-[var(--border)] bg-[var(--bg0)] px-4 py-3 text-sm text-[var(--text0)] outline-none transition focus:border-[var(--accent)]"
              />
            </label>

            <label className="mt-4 block">
              <FieldLabel>{t("management.healthCheck")}</FieldLabel>
              <input
                value={draft.healthCheckCommand ?? ""}
                onChange={(event) => {
                  const value = event.currentTarget.value;
                  setDraft((state) => ({ ...state, healthCheckCommand: value }));
                }}
                className="mt-2 w-full rounded-2xl border border-[var(--border)] bg-[var(--bg0)] px-4 py-3 text-sm text-[var(--text0)] outline-none transition focus:border-[var(--accent)]"
              />
            </label>

            <label className="mt-4 block">
              <FieldLabel>{t("management.tags")}</FieldLabel>
              <input
                value={tagText}
                onChange={(event) => {
                  const value = event.currentTarget.value;
                  setDraft((state) => ({
                    ...state,
                    tags: value.split(",").map((tag) => tag.trim()).filter(Boolean),
                  }));
                }}
                placeholder={t("management.projectTagsPlaceholder")}
                className="mt-2 w-full rounded-2xl border border-[var(--border)] bg-[var(--bg0)] px-4 py-3 text-sm text-[var(--text0)] outline-none transition placeholder:text-[var(--text2)] focus:border-[var(--accent)]"
              />
            </label>
          </div>
        </div>
      </Modal>
      <ServerDialog
        open={serverDialogOpen}
        initialDraft={serverDraftSeed}
        onSaved={(server) => {
          setDraft((state) => ({
            ...state,
            serverId: server.id,
          }));
          setServerDialogOpen(false);
        }}
        onClose={() => setServerDialogOpen(false)}
      />
      <DatabaseDialog
        open={databaseDialogOpen}
        initialDraft={databaseDraftSeed}
        onSaved={(database) => {
          setDraft((state) => ({
            ...state,
            databaseIds: state.databaseIds.includes(database.id)
              ? state.databaseIds
              : [...state.databaseIds, database.id],
          }));
          setDatabaseDialogOpen(false);
        }}
        onClose={() => setDatabaseDialogOpen(false)}
      />
    </>
  );
}

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
  managerPathLabel,
  normalizeManagerPathInput,
  setProjectManagerPath,
} from "../../../lib/project-manager";
import { useAppStore } from "../../../store/app";
import Badge from "../../shared/Badge";
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
  const [serverMode, setServerMode] = useState<"select" | "create">("select");
  const [databaseMode, setDatabaseMode] = useState<"select" | "create">("select");
  const tagText = useMemo(() => draft.tags.join(", "), [draft.tags]);
  const selectedServer = config.servers.find((server) => server.id === draft.serverId) ?? null;
  const selectedDatabases = useMemo(
    () => config.databases.filter((database) => draft.databaseIds.includes(database.id)),
    [config.databases, draft.databaseIds],
  );
  const pathSegments = normalizeManagerPathInput(pathInput);
  const chooseDatabaseLabel = locale === "zh-CN" ? "\u9009\u62e9\u6570\u636e\u5e93" : "Choose databases";
  const nameRequiredMessage = locale === "zh-CN" ? "请先填写项目名称。" : "Enter a project name first.";
  const serverRequiredMessage =
    locale === "zh-CN" ? "请先选择或新建服务器。" : "Select or create a server first.";
  const serverAssistText =
    locale === "zh-CN"
      ? "项目必须绑定服务器。没有现成服务器时，可以在这里直接新建。"
      : "Projects must bind to a server. Create one here if none exists yet.";
  const databaseAssistText =
    locale === "zh-CN"
      ? "数据库可以先选已有的，也可以在当前流程里直接补建。"
      : "Choose existing databases or create one inline in this flow.";
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
  const modeButtonClass = (active: boolean) =>
    `rounded-full border px-3.5 py-1.5 text-xs font-medium tracking-[0.14em] transition ${
      active
        ? "border-[var(--accent)] bg-[var(--accent)]/12 text-[var(--accent)]"
        : "border-[var(--border)] bg-[var(--bg0)]/45 text-[var(--text1)] hover:border-[var(--border2)] hover:text-[var(--text0)]"
    }`;

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
      setServerMode("select");
      setDatabaseMode("select");
      return;
    }

    const nextDraft = emptyProjectDraft(initialPath ?? []);
    setDraft(nextDraft);
    setPathInput(getProjectManagerPath(nextDraft).join(" / "));
    setError(null);
    setServerMode(config.servers.length === 0 ? "create" : "select");
    setDatabaseMode(config.databases.length === 0 ? "create" : "select");
  }, [config.databases.length, config.projects, config.servers.length, entityId, initialPath, open]);

  useEffect(() => {
    if (!open) {
      setServerDialogOpen(false);
      setDatabaseDialogOpen(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open || entityId) {
      return;
    }

    if (config.servers.length === 0 && !draft.serverId) {
      setServerMode("create");
    }

    if (config.databases.length === 0 && draft.databaseIds.length === 0) {
      setDatabaseMode("create");
    }
  }, [config.databases.length, config.servers.length, draft.databaseIds.length, draft.serverId, entityId, open]);

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
        <div className="grid gap-5 xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
        <div className="space-y-5">
          <div className={modalPanelClass}>
            <p className="text-[11px] uppercase tracking-[0.28em] text-[var(--accent2)]">{copy.overview}</p>
            <h3 className="mt-3 text-2xl font-semibold text-[var(--text0)]">
              {draft.name || (entityId ? t("management.projectName") : copy.projectTitleNew)}
            </h3>
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge tone="info">{selectedServer?.name ?? t("management.selectServer")}</Badge>
              <Badge tone="accent">{environmentLabel(locale, draft.environment)}</Badge>
              <Badge tone="warning">{deployTypeLabel(locale, draft.deployType)}</Badge>
              {selectedDatabases.slice(0, 2).map((database) => (
                <Badge key={database.id}>{database.name}</Badge>
              ))}
            </div>
            <div className="mt-5 rounded-[1.4rem] border border-[var(--border)] bg-[var(--bg0)]/55 p-4">
              <p className="text-[11px] uppercase tracking-[0.22em] text-[var(--text2)]">{copy.pathPreview}</p>
              <p className="mt-2 text-sm text-[var(--text0)]">{managerPathLabel(pathSegments)}</p>
              <p className="mt-2 text-xs text-[var(--text1)]">{copy.hierarchyHint}</p>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-[1.25rem] border border-[var(--border)] bg-[var(--bg0)]/45 p-4">
                <p className="text-[11px] uppercase tracking-[0.22em] text-[var(--text2)]">{copy.attachCount}</p>
                <p className="mt-2 text-lg font-semibold text-[var(--text0)]">{draft.databaseIds.length}</p>
                <p className="text-sm text-[var(--text1)]">{t("management.databases")}</p>
              </div>
              <div className="rounded-[1.25rem] border border-[var(--border)] bg-[var(--bg0)]/45 p-4">
                <p className="text-[11px] uppercase tracking-[0.22em] text-[var(--text2)]">{copy.queryReadonly}</p>
                <p className="mt-2 text-lg font-semibold text-[var(--text0)]">
                  {draft.logSources[0]?.type ?? LogSourceType.File}
                </p>
                <p className="text-sm text-[var(--text1)]">{t("management.primaryLogType")}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-4">
          <div className={modalPanelClass}>
            <label className="block">
              <FieldLabel>{t("management.projectName")}</FieldLabel>
              <input
                value={draft.name}
                onChange={(event) =>
                  setDraft((state) => ({
                    ...state,
                    name: event.currentTarget.value,
                  }))
                }
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
              <p className="mt-2 text-xs text-[var(--text1)]">{copy.hierarchyHint}</p>
            </label>

            <div className="mt-4 rounded-[1.25rem] border border-[var(--border)] bg-[var(--bg0)]/45 p-4">
              <div className="flex items-center justify-between gap-3">
                <FieldLabel>{t("management.server")}</FieldLabel>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setServerMode("select")}
                    className={modeButtonClass(serverMode === "select")}
                  >
                    {t("management.selectServer")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setServerMode("create")}
                    className={modeButtonClass(serverMode === "create")}
                  >
                    {copy.newServer}
                  </button>
                </div>
              </div>

              {serverMode === "create" ? (
                <div className="mt-3 rounded-[1rem] border border-dashed border-[var(--border2)] bg-[var(--bg0)] px-4 py-4">
                  <p className="text-sm font-medium text-[var(--text0)]">{copy.newServer}</p>
                  <p className="mt-2 text-sm leading-6 text-[var(--text1)]">{serverAssistText}</p>
                  <button
                    type="button"
                    onClick={() => setServerDialogOpen(true)}
                    className="mt-4 rounded-md border border-[var(--accent)] px-3 py-2 text-xs uppercase tracking-[0.16em] text-[var(--accent)] transition hover:bg-[var(--accent)]/10"
                  >
                    {copy.newServer}
                  </button>
                </div>
              ) : config.servers.length === 0 ? (
                <div className="mt-3 rounded-[1rem] border border-dashed border-[var(--border2)] bg-[var(--bg0)] px-4 py-4">
                  <p className="text-sm font-medium text-[var(--text0)]">{t("management.selectServer")}</p>
                  <p className="mt-2 text-sm leading-6 text-[var(--text1)]">{serverAssistText}</p>
                  <button
                    type="button"
                    onClick={() => setServerMode("create")}
                    className="mt-4 rounded-md border border-[var(--accent)] px-3 py-2 text-xs uppercase tracking-[0.16em] text-[var(--accent)] transition hover:bg-[var(--accent)]/10"
                  >
                    {copy.newServer}
                  </button>
                </div>
              ) : (
                <>
                  <div className="mt-3">
                    <select
                      value={draft.serverId}
                      onChange={(event) =>
                        setDraft((state) => ({
                          ...state,
                          serverId: event.currentTarget.value,
                        }))
                      }
                      className="min-w-0 flex-1 rounded-2xl border border-[var(--border)] bg-[var(--bg0)] px-4 py-3 text-sm text-[var(--text0)] outline-none"
                    >
                      <option value="">{t("management.selectServer")}</option>
                      {config.servers.map((server) => (
                        <option key={server.id} value={server.id}>
                          {server.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <p className="mt-2 text-xs text-[var(--text1)]">{serverAssistText}</p>
                  {selectedServer ? (
                    <div className="mt-3 rounded-[1rem] border border-[var(--border)] bg-[var(--bg0)] px-4 py-3">
                      <p className="text-sm font-medium text-[var(--text0)]">{selectedServer.name}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.16em] text-[var(--text2)]">
                        {selectedServer.username}@{selectedServer.host}:{selectedServer.port}
                      </p>
                    </div>
                  ) : null}
                </>
              )}
            </div>

            <label className="mt-4 block">
              <FieldLabel>{t("management.rootPath")}</FieldLabel>
              <input
                value={draft.rootPath}
                onChange={(event) =>
                  setDraft((state) => ({
                    ...state,
                    rootPath: event.currentTarget.value,
                  }))
                }
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
                  onChange={(event) =>
                    setDraft((state) => ({
                      ...state,
                      environment: event.currentTarget.value as ProjectDraft["environment"],
                    }))
                  }
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
                  onChange={(event) =>
                    setDraft((state) => ({
                      ...state,
                      deployType: event.currentTarget.value as ProjectDraft["deployType"],
                    }))
                  }
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
              <div className="flex items-center justify-between gap-3">
                <FieldLabel>{t("management.databases")}</FieldLabel>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setDatabaseMode("select")}
                    className={modeButtonClass(databaseMode === "select")}
                  >
                    {chooseDatabaseLabel}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDatabaseMode("create")}
                    className={modeButtonClass(databaseMode === "create")}
                  >
                    {copy.newDatabase}
                  </button>
                </div>
              </div>
              {databaseMode === "create" ? (
                <div className="mt-3 rounded-[1rem] border border-dashed border-[var(--border2)] bg-[var(--bg0)] px-4 py-4">
                  <p className="text-sm font-medium text-[var(--text0)]">{copy.newDatabase}</p>
                  <p className="mt-2 text-sm leading-6 text-[var(--text1)]">{databaseAssistText}</p>
                  <button
                    type="button"
                    onClick={() => setDatabaseDialogOpen(true)}
                    className="mt-4 rounded-md border border-[var(--accent)] px-3 py-2 text-xs uppercase tracking-[0.16em] text-[var(--accent)] transition hover:bg-[var(--accent)]/10"
                  >
                    {copy.newDatabase}
                  </button>
                </div>
              ) : config.databases.length === 0 ? (
                <div className="mt-3 rounded-[1rem] border border-dashed border-[var(--border2)] bg-[var(--bg0)] px-4 py-4">
                  <p className="text-sm font-medium text-[var(--text0)]">{chooseDatabaseLabel}</p>
                  <p className="mt-2 text-sm leading-6 text-[var(--text1)]">{databaseAssistText}</p>
                  <button
                    type="button"
                    onClick={() => setDatabaseMode("create")}
                    className="mt-4 rounded-md border border-[var(--accent)] px-3 py-2 text-xs uppercase tracking-[0.16em] text-[var(--accent)] transition hover:bg-[var(--accent)]/10"
                  >
                    {copy.newDatabase}
                  </button>
                </div>
              ) : (
                <>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {selectedDatabases.map((database) => (
                      <Badge key={database.id} tone="accent">
                        {database.name}
                      </Badge>
                    ))}
                    {selectedDatabases.length === 0 ? (
                      <span className="text-xs text-[var(--text1)]">{databaseAssistText}</span>
                    ) : null}
                  </div>
                  <div className="mt-3 grid gap-2 md:grid-cols-2">
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
                          onChange={(event) =>
                            setDraft((state) => ({
                              ...state,
                              databaseIds: event.currentTarget.checked
                                ? [...state.databaseIds, database.id]
                                : state.databaseIds.filter((item) => item !== database.id),
                            }))
                          }
                        />
                        <span className="flex-1">{database.name}</span>
                        <span className="text-[10px] uppercase tracking-[0.16em] text-[var(--text2)]">
                          {database.type}
                        </span>
                      </label>
                    ))}
                  </div>
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
                  onChange={(event) =>
                    setDraft((state) => ({
                      ...state,
                      logSources: updatePrimaryLog(state.logSources, {
                        type: event.currentTarget.value as ProjectDraft["logSources"][number]["type"],
                      }),
                    }))
                  }
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
                  onChange={(event) =>
                    setDraft((state) => ({
                      ...state,
                      logSources: updatePrimaryLog(state.logSources, {
                        label: event.currentTarget.value,
                      }),
                    }))
                  }
                  className="mt-2 w-full rounded-2xl border border-[var(--border)] bg-[var(--bg0)] px-4 py-3 text-sm text-[var(--text0)] outline-none transition focus:border-[var(--accent)]"
                />
              </label>
            </div>

            <label className="mt-4 block">
              <FieldLabel>{t("management.primaryLogValue")}</FieldLabel>
              <input
                value={draft.logSources[0]?.value ?? ""}
                onChange={(event) =>
                  setDraft((state) => ({
                    ...state,
                    logSources: updatePrimaryLog(state.logSources, {
                      value: event.currentTarget.value,
                    }),
                  }))
                }
                className="mt-2 w-full rounded-2xl border border-[var(--border)] bg-[var(--bg0)] px-4 py-3 text-sm text-[var(--text0)] outline-none transition focus:border-[var(--accent)]"
              />
            </label>

            <label className="mt-4 block">
              <FieldLabel>{t("management.healthCheck")}</FieldLabel>
              <input
                value={draft.healthCheckCommand ?? ""}
                onChange={(event) =>
                  setDraft((state) => ({
                    ...state,
                    healthCheckCommand: event.currentTarget.value,
                  }))
                }
                className="mt-2 w-full rounded-2xl border border-[var(--border)] bg-[var(--bg0)] px-4 py-3 text-sm text-[var(--text0)] outline-none transition focus:border-[var(--accent)]"
              />
            </label>

            <label className="mt-4 block">
              <FieldLabel>{t("management.tags")}</FieldLabel>
              <input
                value={tagText}
                onChange={(event) =>
                  setDraft((state) => ({
                    ...state,
                    tags: event.currentTarget.value
                      .split(",")
                      .map((tag) => tag.trim())
                      .filter(Boolean),
                  }))
                }
                placeholder={t("management.projectTagsPlaceholder")}
                className="mt-2 w-full rounded-2xl border border-[var(--border)] bg-[var(--bg0)] px-4 py-3 text-sm text-[var(--text0)] outline-none transition placeholder:text-[var(--text2)] focus:border-[var(--accent)]"
              />
            </label>
          </div>
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
          setServerMode("select");
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
          setDatabaseMode("select");
          setDatabaseDialogOpen(false);
        }}
        onClose={() => setDatabaseDialogOpen(false)}
      />
    </>
  );
}

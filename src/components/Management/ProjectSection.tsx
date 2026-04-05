import { useMemo, useState } from "react";
import {
  deployTypeLabel,
  environmentLabel,
  localizeErrorMessage,
  logSourceTypeLabel,
  useI18n,
} from "../../lib/i18n";
import { useAppStore } from "../../store/app";
import {
  DeployType,
  Environment,
  LogSourceType,
  type LogSource,
  type ProjectDraft,
} from "../../types/models";
import Badge from "../shared/Badge";

function emptyProjectDraft(): ProjectDraft {
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
  };
}

function updatePrimaryLog(logSources: LogSource[], patch: Partial<LogSource>): LogSource[] {
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

export default function ProjectSection() {
  const { locale, t } = useI18n();
  const config = useAppStore((state) => state.config);
  const saveProject = useAppStore((state) => state.saveProject);
  const deleteProject = useAppStore((state) => state.deleteProject);
  const [draft, setDraft] = useState<ProjectDraft>(emptyProjectDraft);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const tagText = useMemo(() => draft.tags.join(", "), [draft.tags]);

  const hydrate = (projectId: string) => {
    const project = config.projects.find((item) => item.id === projectId);
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
    });
  };

  const run = async (action: () => Promise<void>) => {
    setMessage(null);
    setError(null);
    try {
      await action();
    } catch (nextError) {
      setError(localizeErrorMessage(locale, nextError, "management.projectError"));
    }
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <div className="space-y-3 rounded-[2rem] border border-[var(--border)] bg-[var(--bg2)]/70 p-5">
        {message ? <p className="text-sm text-[var(--accent)]">{message}</p> : null}
        {error ? <p className="text-sm text-[var(--red)]">{error}</p> : null}
        {config.projects.map((project) => (
          <div key={project.id} className="rounded-2xl border border-[var(--border)] bg-[var(--bg1)] px-4 py-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-[var(--text0)]">{project.name}</p>
                <p className="mt-1 text-xs uppercase tracking-[0.18em] text-[var(--text2)]">
                  {project.rootPath}
                </p>
              </div>
              <Badge tone="accent">{environmentLabel(locale, project.environment)}</Badge>
            </div>

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => hydrate(project.id)}
                className="rounded-full border border-[var(--border)] px-3 py-2 text-xs uppercase tracking-[0.18em] text-[var(--text1)]"
              >
                {t("management.edit")}
              </button>
              <button
                type="button"
                onClick={() =>
                  void run(async () => {
                    await deleteProject(project.id);
                    setMessage(t("management.projectDeleted"));
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
          <span className="text-sm font-medium text-[var(--text0)]">{t("management.projectName")}</span>
          <input
            value={draft.name}
            onChange={(event) => { const v = event.currentTarget.value; setDraft((state) => ({ ...state, name: v })); }}
            className="mt-2 w-full rounded-2xl border border-[var(--border)] bg-[var(--bg1)] px-4 py-3 text-sm text-[var(--text0)] outline-none"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-[var(--text0)]">{t("management.server")}</span>
          <select
            value={draft.serverId}
            onChange={(event) => { const v = event.currentTarget.value; setDraft((state) => ({ ...state, serverId: v })); }}
            className="mt-2 w-full rounded-2xl border border-[var(--border)] bg-[var(--bg1)] px-4 py-3 text-sm text-[var(--text0)] outline-none"
          >
            <option value="">{t("management.selectServer")}</option>
            {config.servers.map((server) => (
              <option key={server.id} value={server.id}>
                {server.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-sm font-medium text-[var(--text0)]">{t("management.rootPath")}</span>
          <input
            value={draft.rootPath}
            onChange={(event) => { const v = event.currentTarget.value; setDraft((state) => ({ ...state, rootPath: v })); }}
            className="mt-2 w-full rounded-2xl border border-[var(--border)] bg-[var(--bg1)] px-4 py-3 text-sm text-[var(--text0)] outline-none"
          />
        </label>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium text-[var(--text0)]">{t("management.environment")}</span>
            <select
              value={draft.environment}
              onChange={(event) => { const v = event.currentTarget.value as ProjectDraft["environment"]; setDraft((state) => ({ ...state, environment: v })); }}
              className="mt-2 w-full rounded-2xl border border-[var(--border)] bg-[var(--bg1)] px-4 py-3 text-sm text-[var(--text0)] outline-none"
            >
              <option value={Environment.Production}>{environmentLabel(locale, Environment.Production)}</option>
              <option value={Environment.Staging}>{environmentLabel(locale, Environment.Staging)}</option>
              <option value={Environment.Development}>{environmentLabel(locale, Environment.Development)}</option>
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-medium text-[var(--text0)]">{t("management.deployType")}</span>
            <select
              value={draft.deployType}
              onChange={(event) => { const v = event.currentTarget.value as ProjectDraft["deployType"]; setDraft((state) => ({ ...state, deployType: v })); }}
              className="mt-2 w-full rounded-2xl border border-[var(--border)] bg-[var(--bg1)] px-4 py-3 text-sm text-[var(--text0)] outline-none"
            >
              <option value={DeployType.Pm2}>{deployTypeLabel(locale, DeployType.Pm2)}</option>
              <option value={DeployType.Docker}>{deployTypeLabel(locale, DeployType.Docker)}</option>
              <option value={DeployType.Systemd}>{deployTypeLabel(locale, DeployType.Systemd)}</option>
              <option value={DeployType.PhpFpm}>{deployTypeLabel(locale, DeployType.PhpFpm)}</option>
              <option value={DeployType.Custom}>{deployTypeLabel(locale, DeployType.Custom)}</option>
            </select>
          </label>
        </div>

        <div>
          <span className="text-sm font-medium text-[var(--text0)]">{t("management.databases")}</span>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {config.databases.map((database) => (
              <label
                key={database.id}
                className="flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--bg1)] px-4 py-3 text-sm text-[var(--text1)]"
              >
                <input
                  type="checkbox"
                  checked={draft.databaseIds.includes(database.id)}
                  onChange={(event) => { const v = event.currentTarget.checked; setDraft((state) => ({ ...state, databaseIds: v ? [...state.databaseIds, database.id] : state.databaseIds.filter((item) => item !== database.id) })); }}
                />
                {database.name}
              </label>
            ))}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium text-[var(--text0)]">{t("management.primaryLogType")}</span>
            <select
              value={draft.logSources[0]?.type ?? LogSourceType.File}
              onChange={(event) => { const v = event.currentTarget.value as LogSource["type"]; setDraft((state) => ({ ...state, logSources: updatePrimaryLog(state.logSources, { type: v }) })); }}
              className="mt-2 w-full rounded-2xl border border-[var(--border)] bg-[var(--bg1)] px-4 py-3 text-sm text-[var(--text0)] outline-none"
            >
              <option value={LogSourceType.File}>{logSourceTypeLabel(locale, LogSourceType.File)}</option>
              <option value={LogSourceType.Command}>{logSourceTypeLabel(locale, LogSourceType.Command)}</option>
              <option value={LogSourceType.Docker}>{logSourceTypeLabel(locale, LogSourceType.Docker)}</option>
              <option value={LogSourceType.Pm2}>{logSourceTypeLabel(locale, LogSourceType.Pm2)}</option>
              <option value={LogSourceType.Journald}>{logSourceTypeLabel(locale, LogSourceType.Journald)}</option>
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-medium text-[var(--text0)]">{t("management.primaryLogLabel")}</span>
            <input
              value={draft.logSources[0]?.label ?? ""}
              onChange={(event) => { const v = event.currentTarget.value; setDraft((state) => ({ ...state, logSources: updatePrimaryLog(state.logSources, { label: v }) })); }}
              className="mt-2 w-full rounded-2xl border border-[var(--border)] bg-[var(--bg1)] px-4 py-3 text-sm text-[var(--text0)] outline-none"
            />
          </label>
        </div>

        <label className="block">
          <span className="text-sm font-medium text-[var(--text0)]">{t("management.primaryLogValue")}</span>
          <input
            value={draft.logSources[0]?.value ?? ""}
            onChange={(event) => { const v = event.currentTarget.value; setDraft((state) => ({ ...state, logSources: updatePrimaryLog(state.logSources, { value: v }) })); }}
            className="mt-2 w-full rounded-2xl border border-[var(--border)] bg-[var(--bg1)] px-4 py-3 text-sm text-[var(--text0)] outline-none"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-[var(--text0)]">{t("management.healthCheck")}</span>
          <input
            value={draft.healthCheckCommand ?? ""}
            onChange={(event) => { const v = event.currentTarget.value; setDraft((state) => ({ ...state, healthCheckCommand: v })); }}
            className="mt-2 w-full rounded-2xl border border-[var(--border)] bg-[var(--bg1)] px-4 py-3 text-sm text-[var(--text0)] outline-none"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-[var(--text0)]">{t("management.tags")}</span>
          <input
            value={tagText}
            onChange={(event) => { const v = event.currentTarget.value; setDraft((state) => ({ ...state, tags: v.split(",").map((tag) => tag.trim()).filter(Boolean) })); }}
            className="mt-2 w-full rounded-2xl border border-[var(--border)] bg-[var(--bg1)] px-4 py-3 text-sm text-[var(--text0)] outline-none"
            placeholder={t("management.projectTagsPlaceholder")}
          />
        </label>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() =>
              void run(async () => {
                const saved = await saveProject(draft);
                setDraft(emptyProjectDraft());
                setMessage(t("management.projectSaved", { name: saved.name }));
              })
            }
            className="rounded-full border border-[var(--accent)] px-5 py-3 text-sm font-medium text-[var(--accent)]"
          >
            {t("management.saveProject")}
          </button>
          <button
            type="button"
            onClick={() => setDraft(emptyProjectDraft())}
            className="rounded-full border border-[var(--border)] px-5 py-3 text-sm text-[var(--text1)]"
          >
            {t("management.reset")}
          </button>
        </div>
      </div>
    </div>
  );
}

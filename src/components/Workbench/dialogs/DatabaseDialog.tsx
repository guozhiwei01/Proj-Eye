import { useEffect, useMemo, useState } from "react";
import { inspectCredentialRef } from "../../../lib/backend";
import {
  databaseTypeLabel,
  localizeErrorMessage,
  useI18n,
} from "../../../lib/i18n";
import { getProjectManagerPath, managerPathLabel } from "../../../lib/project-manager";
import { useAppStore } from "../../../store/app";
import Badge from "../../shared/Badge";
import Modal from "../../shared/Modal";
import { DatabaseType, type DatabaseDraft, type DatabaseResource } from "../../../types/models";
import { FieldLabel, modalPanelClass, workbenchCopy } from "./common";

function emptyDatabaseDraft(): DatabaseDraft {
  return {
    name: "",
    type: DatabaseType.Mysql,
    host: "",
    port: 3306,
    username: "",
    readonlyMode: true,
    group: "production",
    tags: [],
  };
}

interface DatabaseDialogProps {
  open: boolean;
  entityId?: string;
  initialDraft?: Partial<DatabaseDraft>;
  onSaved?: (database: DatabaseResource) => void;
  onClose: () => void;
}

export default function DatabaseDialog({
  open,
  entityId,
  initialDraft,
  onSaved,
  onClose,
}: DatabaseDialogProps) {
  const { locale, t } = useI18n();
  const copy = workbenchCopy(locale);
  const config = useAppStore((state) => state.config);
  const saveDatabase = useAppStore((state) => state.saveDatabase);
  const [draft, setDraft] = useState<DatabaseDraft>(emptyDatabaseDraft);
  const [error, setError] = useState<string | null>(null);
  const tagText = useMemo(() => draft.tags.join(", "), [draft.tags]);
  const boundProjects = useMemo(
    () => config.projects.filter((project) => project.databaseIds.includes(entityId ?? "")),
    [config.projects, entityId],
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    if (!entityId) {
      setDraft({
        ...emptyDatabaseDraft(),
        ...initialDraft,
      });
      setError(null);
      return;
    }

    const database = config.databases.find((item) => item.id === entityId);
    if (!database) {
      return;
    }

    void inspectCredentialRef(database.credentialRef).then((hasCredential) => {
      setDraft({
        id: database.id,
        name: database.name,
        type: database.type,
        host: database.host,
        port: database.port,
        username: database.username,
        defaultDatabase: database.defaultDatabase,
        dbNumber: database.dbNumber,
        readonlyMode: database.readonlyMode,
        group: database.group,
        tags: database.tags,
        credentialRef: database.credentialRef,
        credentialValue: hasCredential ? "" : undefined,
      });
      setError(null);
    });
  }, [config.databases, entityId, initialDraft, open]);

  const handleSubmit = async () => {
    setError(null);

    try {
      const saved = await saveDatabase(draft);
      onSaved?.(saved);
      onClose();
    } catch (nextError) {
      setError(localizeErrorMessage(locale, nextError, "management.databaseError"));
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={entityId ? copy.databaseTitleEdit : copy.databaseTitleNew}
      description={copy.databaseDesc}
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
            {draft.name || (entityId ? t("management.name") : copy.databaseTitleNew)}
          </h3>
          <div className="mt-4 flex flex-wrap gap-2">
            <Badge tone="accent">{databaseTypeLabel(locale, draft.type)}</Badge>
            <Badge tone={draft.readonlyMode ? "info" : "warning"}>
              {draft.readonlyMode ? copy.queryReadonly : copy.optional}
            </Badge>
            <Badge>{draft.group || "default"}</Badge>
          </div>
          <div className="mt-5 rounded-[1.4rem] border border-[var(--border)] bg-[var(--bg0)]/55 p-4">
            <p className="text-[11px] uppercase tracking-[0.22em] text-[var(--text2)]">
              {t("management.defaultDatabase")}
            </p>
            <p className="mt-2 text-sm text-[var(--text0)]">
              {draft.defaultDatabase || `${draft.host || "host"}:${draft.port}`}
            </p>
          </div>
          <div className="mt-4">
            <p className="text-[11px] uppercase tracking-[0.22em] text-[var(--text2)]">{copy.attachCount}</p>
            <div className="mt-3 space-y-2">
              {boundProjects.length === 0 ? (
                <p className="text-sm text-[var(--text1)]">{t("sidebar.empty.recent")}</p>
              ) : (
                boundProjects.map((project) => (
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
                <FieldLabel>{t("management.databaseType")}</FieldLabel>
                <select
                  value={draft.type}
                  onChange={(event) =>
                    setDraft((state) => ({
                      ...state,
                      type: event.currentTarget.value as DatabaseDraft["type"],
                    }))
                  }
                  className="mt-2 w-full rounded-2xl border border-[var(--border)] bg-[var(--bg0)] px-4 py-3 text-sm text-[var(--text0)] outline-none"
                >
                  <option value={DatabaseType.Mysql}>{databaseTypeLabel(locale, DatabaseType.Mysql)}</option>
                  <option value={DatabaseType.Redis}>{databaseTypeLabel(locale, DatabaseType.Redis)}</option>
                  <option value={DatabaseType.Postgresql}>
                    {databaseTypeLabel(locale, DatabaseType.Postgresql)}
                  </option>
                </select>
              </label>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="block">
                <FieldLabel>{t("management.host")}</FieldLabel>
                <input
                  value={draft.host}
                  onChange={(event) =>
                    setDraft((state) => ({
                      ...state,
                      host: event.currentTarget.value,
                    }))
                  }
                  className="mt-2 w-full rounded-2xl border border-[var(--border)] bg-[var(--bg0)] px-4 py-3 text-sm text-[var(--text0)] outline-none"
                />
              </label>

              <label className="block">
                <FieldLabel>{t("management.port")}</FieldLabel>
                <input
                  type="number"
                  value={draft.port}
                  onChange={(event) =>
                    setDraft((state) => ({
                      ...state,
                      port: Number(event.currentTarget.value),
                    }))
                  }
                  className="mt-2 w-full rounded-2xl border border-[var(--border)] bg-[var(--bg0)] px-4 py-3 text-sm text-[var(--text0)] outline-none"
                />
              </label>
            </div>
          </div>

          <div className={modalPanelClass}>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <FieldLabel>{t("management.username")}</FieldLabel>
                <input
                  value={draft.username ?? ""}
                  onChange={(event) =>
                    setDraft((state) => ({
                      ...state,
                      username: event.currentTarget.value,
                    }))
                  }
                  className="mt-2 w-full rounded-2xl border border-[var(--border)] bg-[var(--bg0)] px-4 py-3 text-sm text-[var(--text0)] outline-none"
                />
              </label>

              <label className="block">
                <FieldLabel>{t("management.group")}</FieldLabel>
                <input
                  value={draft.group}
                  onChange={(event) =>
                    setDraft((state) => ({
                      ...state,
                      group: event.currentTarget.value,
                    }))
                  }
                  className="mt-2 w-full rounded-2xl border border-[var(--border)] bg-[var(--bg0)] px-4 py-3 text-sm text-[var(--text0)] outline-none"
                />
              </label>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="block">
                <FieldLabel>{t("management.defaultDatabase")}</FieldLabel>
                <input
                  value={draft.defaultDatabase ?? ""}
                  onChange={(event) =>
                    setDraft((state) => ({
                      ...state,
                      defaultDatabase: event.currentTarget.value,
                    }))
                  }
                  className="mt-2 w-full rounded-2xl border border-[var(--border)] bg-[var(--bg0)] px-4 py-3 text-sm text-[var(--text0)] outline-none"
                />
              </label>

              <label className="block">
                <FieldLabel>{t("management.redisDbNumber")}</FieldLabel>
                <input
                  type="number"
                  value={draft.dbNumber ?? 0}
                  onChange={(event) =>
                    setDraft((state) => ({
                      ...state,
                      dbNumber: Number(event.currentTarget.value),
                    }))
                  }
                  className="mt-2 w-full rounded-2xl border border-[var(--border)] bg-[var(--bg0)] px-4 py-3 text-sm text-[var(--text0)] outline-none"
                />
              </label>
            </div>

            <label className="mt-4 block">
              <FieldLabel>{t("management.credential")}</FieldLabel>
              <input
                value={draft.credentialValue ?? ""}
                onChange={(event) =>
                  setDraft((state) => ({
                    ...state,
                    credentialValue: event.currentTarget.value,
                  }))
                }
                placeholder={t("management.keepPassword")}
                className="mt-2 w-full rounded-2xl border border-[var(--border)] bg-[var(--bg0)] px-4 py-3 text-sm text-[var(--text0)] outline-none placeholder:text-[var(--text2)]"
              />
            </label>

            <label className="mt-4 flex items-center gap-3 text-sm text-[var(--text1)]">
              <input
                type="checkbox"
                checked={draft.readonlyMode}
                onChange={(event) =>
                  setDraft((state) => ({
                    ...state,
                    readonlyMode: event.currentTarget.checked,
                  }))
                }
              />
              {t("management.readonlyMode")}
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
                placeholder={t("management.tagsPlaceholder")}
                className="mt-2 w-full rounded-2xl border border-[var(--border)] bg-[var(--bg0)] px-4 py-3 text-sm text-[var(--text0)] outline-none placeholder:text-[var(--text2)]"
              />
            </label>

            {draft.type === DatabaseType.Postgresql ? (
              <p className="mt-3 text-sm text-[var(--yellow)]">{t("management.postgresNotice")}</p>
            ) : null}
          </div>
        </div>
      </div>
    </Modal>
  );
}

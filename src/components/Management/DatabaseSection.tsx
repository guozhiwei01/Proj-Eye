import { useMemo, useState } from "react";
import { databaseTypeLabel, useI18n } from "../../lib/i18n";
import { inspectCredentialRef } from "../../lib/backend";
import { useAppStore } from "../../store/app";
import { DatabaseType, type DatabaseDraft } from "../../types/models";
import Badge from "../shared/Badge";

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

export default function DatabaseSection() {
  const { locale, t } = useI18n();
  const config = useAppStore((state) => state.config);
  const saveDatabase = useAppStore((state) => state.saveDatabase);
  const deleteDatabase = useAppStore((state) => state.deleteDatabase);
  const [draft, setDraft] = useState<DatabaseDraft>(emptyDatabaseDraft);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const tagText = useMemo(() => draft.tags.join(", "), [draft.tags]);

  const hydrate = async (databaseId: string) => {
    const database = config.databases.find((item) => item.id === databaseId);
    if (!database) {
      return;
    }
    const hasCredential = await inspectCredentialRef(database.credentialRef);
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
  };

  const run = async (action: () => Promise<void>) => {
    setMessage(null);
    setError(null);
    try {
      await action();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : t("management.databaseError"));
    }
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <div className="space-y-3 rounded-[2rem] border border-[var(--border)] bg-[var(--bg2)]/70 p-5">
        {message ? <p className="text-sm text-[var(--accent)]">{message}</p> : null}
        {error ? <p className="text-sm text-[var(--red)]">{error}</p> : null}
        {config.databases.map((database) => (
          <div key={database.id} className="rounded-2xl border border-[var(--border)] bg-[var(--bg1)] px-4 py-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-[var(--text0)]">{database.name}</p>
                <p className="mt-1 text-xs uppercase tracking-[0.18em] text-[var(--text2)]">
                  {databaseTypeLabel(locale, database.type)} / {database.host}:{database.port}
                </p>
              </div>
              <Badge tone={database.type === DatabaseType.Postgresql ? "warning" : "accent"}>
                {databaseTypeLabel(locale, database.type)}
              </Badge>
            </div>

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => void hydrate(database.id)}
                className="rounded-full border border-[var(--border)] px-3 py-2 text-xs uppercase tracking-[0.18em] text-[var(--text1)]"
              >
                {t("management.edit")}
              </button>
              <button
                type="button"
                onClick={() =>
                  void run(async () => {
                    await deleteDatabase(database.id);
                    setMessage(t("management.databaseDeleted"));
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
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium text-[var(--text0)]">{t("management.name")}</span>
            <input
              value={draft.name}
              onChange={(event) => { const v = event.currentTarget.value; setDraft((state) => ({ ...state, name: v })); }}
              className="mt-2 w-full rounded-2xl border border-[var(--border)] bg-[var(--bg1)] px-4 py-3 text-sm text-[var(--text0)] outline-none"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-[var(--text0)]">{t("management.databaseType")}</span>
            <select
              value={draft.type}
              onChange={(event) => { const v = event.currentTarget.value as DatabaseDraft["type"]; setDraft((state) => ({ ...state, type: v })); }}
              className="mt-2 w-full rounded-2xl border border-[var(--border)] bg-[var(--bg1)] px-4 py-3 text-sm text-[var(--text0)] outline-none"
            >
              <option value={DatabaseType.Mysql}>{databaseTypeLabel(locale, DatabaseType.Mysql)}</option>
              <option value={DatabaseType.Redis}>{databaseTypeLabel(locale, DatabaseType.Redis)}</option>
              <option value={DatabaseType.Postgresql}>{databaseTypeLabel(locale, DatabaseType.Postgresql)}</option>
            </select>
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium text-[var(--text0)]">{t("management.host")}</span>
            <input
              value={draft.host}
              onChange={(event) => { const v = event.currentTarget.value; setDraft((state) => ({ ...state, host: v })); }}
              className="mt-2 w-full rounded-2xl border border-[var(--border)] bg-[var(--bg1)] px-4 py-3 text-sm text-[var(--text0)] outline-none"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-[var(--text0)]">{t("management.port")}</span>
            <input
              type="number"
              value={draft.port}
              onChange={(event) => { const v = Number(event.currentTarget.value); setDraft((state) => ({ ...state, port: v })); }}
              className="mt-2 w-full rounded-2xl border border-[var(--border)] bg-[var(--bg1)] px-4 py-3 text-sm text-[var(--text0)] outline-none"
            />
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium text-[var(--text0)]">{t("management.username")}</span>
            <input
              value={draft.username ?? ""}
              onChange={(event) => { const v = event.currentTarget.value; setDraft((state) => ({ ...state, username: v })); }}
              className="mt-2 w-full rounded-2xl border border-[var(--border)] bg-[var(--bg1)] px-4 py-3 text-sm text-[var(--text0)] outline-none"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-[var(--text0)]">{t("management.group")}</span>
            <input
              value={draft.group}
              onChange={(event) => { const v = event.currentTarget.value; setDraft((state) => ({ ...state, group: v })); }}
              className="mt-2 w-full rounded-2xl border border-[var(--border)] bg-[var(--bg1)] px-4 py-3 text-sm text-[var(--text0)] outline-none"
            />
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium text-[var(--text0)]">{t("management.defaultDatabase")}</span>
            <input
              value={draft.defaultDatabase ?? ""}
              onChange={(event) => { const v = event.currentTarget.value; setDraft((state) => ({ ...state, defaultDatabase: v })); }}
              className="mt-2 w-full rounded-2xl border border-[var(--border)] bg-[var(--bg1)] px-4 py-3 text-sm text-[var(--text0)] outline-none"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-[var(--text0)]">{t("management.redisDbNumber")}</span>
            <input
              type="number"
              value={draft.dbNumber ?? 0}
              onChange={(event) => { const v = Number(event.currentTarget.value); setDraft((state) => ({ ...state, dbNumber: v })); }}
              className="mt-2 w-full rounded-2xl border border-[var(--border)] bg-[var(--bg1)] px-4 py-3 text-sm text-[var(--text0)] outline-none"
            />
          </label>
        </div>

        <label className="block">
          <span className="text-sm font-medium text-[var(--text0)]">{t("management.credential")}</span>
          <input
            value={draft.credentialValue ?? ""}
            onChange={(event) => { const v = event.currentTarget.value; setDraft((state) => ({ ...state, credentialValue: v })); }}
            className="mt-2 w-full rounded-2xl border border-[var(--border)] bg-[var(--bg1)] px-4 py-3 text-sm text-[var(--text0)] outline-none"
            placeholder={t("management.keepPassword")}
          />
        </label>

        <label className="flex items-center gap-3 text-sm text-[var(--text1)]">
          <input
            type="checkbox"
            checked={draft.readonlyMode}
            onChange={(event) => { const v = event.currentTarget.checked; setDraft((state) => ({ ...state, readonlyMode: v })); }}
          />
          {t("management.readonlyMode")}
        </label>

        <label className="block">
          <span className="text-sm font-medium text-[var(--text0)]">{t("management.tags")}</span>
          <input
            value={tagText}
            onChange={(event) => { const v = event.currentTarget.value; setDraft((state) => ({ ...state, tags: v.split(",").map((tag) => tag.trim()).filter(Boolean) })); }}
            className="mt-2 w-full rounded-2xl border border-[var(--border)] bg-[var(--bg1)] px-4 py-3 text-sm text-[var(--text0)] outline-none"
            placeholder={t("management.tagsPlaceholder")}
          />
        </label>

        {draft.type === DatabaseType.Postgresql ? (
          <p className="text-sm text-[var(--yellow)]">{t("management.postgresNotice")}</p>
        ) : null}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() =>
              void run(async () => {
                const saved = await saveDatabase(draft);
                setDraft(emptyDatabaseDraft());
                setMessage(t("management.databaseSaved", { name: saved.name }));
              })
            }
            className="rounded-full border border-[var(--accent)] px-5 py-3 text-sm font-medium text-[var(--accent)]"
          >
            {t("management.saveDatabase")}
          </button>
          <button
            type="button"
            onClick={() => setDraft(emptyDatabaseDraft())}
            className="rounded-full border border-[var(--border)] px-5 py-3 text-sm text-[var(--text1)]"
          >
            {t("management.reset")}
          </button>
        </div>
      </div>
    </div>
  );
}

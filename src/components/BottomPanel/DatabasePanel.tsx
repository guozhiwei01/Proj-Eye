import { useEffect, useState } from "react";
import { databaseTypeLabel, useI18n } from "../../lib/i18n";
import { useWorkspaceStore } from "../../store/workspace";
import { DatabaseType, type DatabaseResource } from "../../types/models";
import Badge from "../shared/Badge";

interface DatabasePanelProps {
  databases: DatabaseResource[];
}

export default function DatabasePanel({ databases }: DatabasePanelProps) {
  const { locale, t } = useI18n();
  const queryDrafts = useWorkspaceStore((state) => state.queryDrafts);
  const queryResults = useWorkspaceStore((state) => state.queryResults);
  const queryErrors = useWorkspaceStore((state) => state.queryErrors);
  const setQueryDraft = useWorkspaceStore((state) => state.setQueryDraft);
  const executeQuery = useWorkspaceStore((state) => state.executeQuery);
  const [activeDatabaseId, setActiveDatabaseId] = useState(databases[0]?.id ?? "");

  useEffect(() => {
    if (!databases.some((database) => database.id === activeDatabaseId)) {
      setActiveDatabaseId(databases[0]?.id ?? "");
    }
  }, [activeDatabaseId, databases]);

  const activeDatabase = databases.find((database) => database.id === activeDatabaseId) ?? null;
  const statement = activeDatabaseId ? queryDrafts[activeDatabaseId] ?? "" : "";
  const result = activeDatabaseId ? queryResults[activeDatabaseId] : null;
  const error = activeDatabaseId ? queryErrors[activeDatabaseId] : null;

  const placeholder =
    activeDatabase?.type === DatabaseType.Redis
      ? t("database.placeholder.redis")
      : activeDatabase?.type === DatabaseType.Postgresql
        ? t("database.placeholder.postgres")
        : t("database.placeholder.mysql");

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-semibold text-[var(--text0)]">{t("database.title")}</p>
        <p className="mt-1 text-sm text-[var(--text1)]">{t("database.description")}</p>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div className="rounded-[1.5rem] border border-[var(--border)] bg-[var(--bg1)] p-4">
          <label className="block">
            <span className="text-xs uppercase tracking-[0.22em] text-[var(--text2)]">{t("database.boundResource")}</span>
            <select
              value={activeDatabaseId}
              onChange={(event) => setActiveDatabaseId(event.currentTarget.value)}
              className="mt-3 w-full rounded-2xl border border-[var(--border)] bg-[var(--bg0)] px-4 py-3 text-sm text-[var(--text0)] outline-none"
            >
              {databases.map((database) => (
                <option key={database.id} value={database.id}>
                  {database.name} / {databaseTypeLabel(locale, database.type)}
                </option>
              ))}
            </select>
          </label>

          <textarea
            value={statement}
            onChange={(event) => setQueryDraft(activeDatabaseId, event.currentTarget.value)}
            rows={7}
            disabled={!activeDatabaseId || activeDatabase?.type === DatabaseType.Postgresql}
            className="mt-4 w-full rounded-2xl border border-[var(--border)] bg-[var(--bg0)] px-4 py-4 font-mono text-sm text-[var(--text1)] outline-none disabled:opacity-60"
            placeholder={placeholder}
          />

          <div className="mt-4 flex items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              {databases.map((database) => (
                <Badge key={database.id} tone={database.id === activeDatabaseId ? "accent" : "neutral"}>
                  {database.name}
                </Badge>
              ))}
            </div>
            <button
              type="button"
              disabled={!activeDatabaseId || activeDatabase?.type === DatabaseType.Postgresql}
              onClick={() => void executeQuery(activeDatabaseId)}
              className="rounded-full border border-[var(--accent)] px-4 py-2 text-xs uppercase tracking-[0.18em] text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {t("database.run")}
            </button>
          </div>
        </div>

        <div className="rounded-[1.5rem] border border-[var(--border)] bg-[var(--bg1)] p-4">
          <p className="text-xs uppercase tracking-[0.22em] text-[var(--text2)]">{t("database.results")}</p>
          {error ? <p className="mt-3 text-sm text-[var(--red)]">{error}</p> : null}
          {result?.notice ? <p className="mt-3 text-sm text-[var(--text1)]">{result.notice}</p> : null}

          {result && result.columns.length > 0 ? (
            <div className="mt-4 overflow-x-auto rounded-2xl border border-[var(--border)]">
              <table className="min-w-full border-collapse text-left text-sm text-[var(--text1)]">
                <thead className="bg-[var(--bg0)] text-[var(--text0)]">
                  <tr>
                    {result.columns.map((column) => (
                      <th key={column} className="px-4 py-3 font-medium">
                        {column}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((row, index) => (
                    <tr key={`${index}-${result.databaseId}`} className="border-t border-[var(--border)]">
                      {result.columns.map((column) => (
                        <td key={`${index}-${column}`} className="px-4 py-3">
                          {String(row[column] ?? "")}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="mt-4 text-sm text-[var(--text1)]">
              {activeDatabase?.type === DatabaseType.Postgresql
                ? t("database.postgresDisabled")
                : t("database.safePrompt")}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

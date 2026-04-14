import { useMemo, useState } from "react";
import { localizeErrorMessage, useI18n } from "../../lib/i18n";
import { hasAnomalySignal } from "../../lib/detector";
import { useWorkspaceStore } from "../../store/workspace";
import type { AlertItem, Project } from "../../types/models";
import { useLogsConnection } from "../../hooks/useLogsConnection";
import { ConnectionState } from "../../types/connection";

interface EnhancedLogPanelProps {
  project: Project;
  alert: AlertItem | null;
  isActive?: boolean;
}

/**
 * EnhancedLogPanel - Logs panel with ConnectionRuntime integration
 *
 * This component extends the original LogPanel with:
 * - ConnectionRuntime integration via useLogsConnection hook
 * - Workspace node registration for logs
 * - Connection state synchronization
 * - Active log sources tracking
 */
export default function EnhancedLogPanel({
  project,
  alert,
  isActive = true
}: EnhancedLogPanelProps) {
  const { locale, t } = useI18n();
  const refreshLogs = useWorkspaceStore((state) => state.refreshLogs);
  const allLogs = useWorkspaceStore((state) => state.logs);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const logs = useMemo(
    () => allLogs.filter((entry) => entry.projectId === project.id),
    [allLogs, project.id],
  );

  // NEW: Integrate with ConnectionRuntime
  const {
    nodeId,
    connectionState,
    isHealthy,
    recordLogActivity,
    getActiveLogSources,
  } = useLogsConnection({
    projectId: project.id,
    logSources: project.logSources || [],
    logs,
    isActive,
  });

  const lines = logs.length
    ? logs.map((entry) => entry.line)
    : [
        t("logs.waiting"),
        alert ? `[WARN] ${alert.description}` : t("logs.noSignal"),
      ];

  // NEW: Enhanced refresh with activity tracking
  const handleRefresh = async () => {
    setBusy(true);
    setError(null);

    try {
      await refreshLogs(project.id);

      // Record successful log fetch
      if (project.logSources?.[0]?.id) {
        await recordLogActivity(project.logSources[0].id);
      }
    } catch (nextError) {
      setError(localizeErrorMessage(locale, nextError, "logs.refreshError"));
    } finally {
      setBusy(false);
    }
  };

  // NEW: Get connection state label
  const getConnectionStateLabel = () => {
    switch (connectionState) {
      case ConnectionState.Connecting:
        return locale === "zh-CN" ? "连接中" : "Connecting";
      case ConnectionState.Active:
        return locale === "zh-CN" ? "已连接" : "Connected";
      case ConnectionState.Reconnecting:
        return locale === "zh-CN" ? "重连中" : "Reconnecting";
      case ConnectionState.Failed:
        return locale === "zh-CN" ? "连接失败" : "Failed";
      case ConnectionState.Closed:
        return locale === "zh-CN" ? "已关闭" : "Closed";
      default:
        return locale === "zh-CN" ? "空闲" : "Idle";
    }
  };

  // NEW: Get active sources count
  const activeSourcesCount = getActiveLogSources().length;

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-[var(--text0)]">{t("logs.title")}</p>
            <p className="mt-1 text-sm text-[var(--text1)]">{t("logs.description")}</p>
          </div>

          {/* NEW: Connection status indicator */}
          {nodeId && (
            <div className="flex items-center gap-2 text-xs text-[var(--text2)]">
              <div className="flex items-center gap-1.5">
                <div
                  className={`h-2 w-2 rounded-full ${
                    connectionState === ConnectionState.Active
                      ? isHealthy
                        ? "bg-green-500"
                        : "bg-yellow-500"
                      : connectionState === ConnectionState.Failed
                      ? "bg-red-500"
                      : "bg-gray-500"
                  }`}
                />
                <span>{getConnectionStateLabel()}</span>
              </div>
              {activeSourcesCount > 0 && (
                <span className="text-[var(--text2)]">
                  {activeSourcesCount} {locale === "zh-CN" ? "个活跃源" : "active sources"}
                </span>
              )}
            </div>
          )}
        </div>

        <div className="mt-3">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={busy || connectionState === ConnectionState.Failed}
            className="rounded-full border border-[var(--border)] px-4 py-2 text-xs uppercase tracking-[0.18em] text-[var(--text1)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy ? t("logs.refreshing") : t("logs.refresh")}
          </button>
        </div>
        {error ? <p className="mt-3 text-sm text-[var(--red)]">{error}</p> : null}
      </div>

      <div className="rounded-[1.5rem] border border-[var(--border)] bg-[var(--bg1)] p-4">
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-[0.22em] text-[var(--text2)]">
            {project.logSources[0]?.label ?? t("logs.unknownSource")}
          </p>

          {/* NEW: Show node ID for debugging */}
          {nodeId && (
            <span className="text-[10px] text-[var(--text2)] opacity-50">
              Node: {nodeId.slice(0, 8)}
            </span>
          )}
        </div>

        <div className="mt-4 space-y-2 font-mono text-sm">
          {lines.map((line, index) => (
            <div
              key={`${line}-${index}`}
              className={hasAnomalySignal(line) ? "text-[var(--red)]" : "text-[var(--text1)]"}
            >
              {line}
            </div>
          ))}
        </div>

        {/* NEW: Show log count */}
        {logs.length > 0 && (
          <div className="mt-4 pt-4 border-t border-[var(--border)] text-xs text-[var(--text2)]">
            {logs.length} {locale === "zh-CN" ? "条日志" : "log entries"}
          </div>
        )}
      </div>
    </div>
  );
}

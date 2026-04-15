/**
 * AI Context Builder - Unified context collection for AI analysis
 *
 * This module provides a centralized way to collect and structure context
 * from various sources (terminal, logs, database, anomalies) for AI analysis.
 */

import type { AiContextPack, LogChunk, SessionSummary } from "../types/models";
import { useWorkspaceStore } from "../store/workspace";
import { useAppStore } from "../store/app";

const TERMINAL_CONTEXT_LINE_COUNT = 30;
const COMMAND_OUTPUT_LINE_COUNT = 160;
const LOG_CONTEXT_COUNT = 10;
const ANOMALY_DETECTION_KEYWORDS = [
  "error",
  "exception",
  "fatal",
  "failed",
  "timeout",
  "refused",
  "denied",
  "critical",
  "panic",
  "segfault",
];

/**
 * Enhanced context bundle with additional metadata
 */
export interface ProjectContextBundle extends AiContextPack {
  // Core fields (from AiContextPack)
  projectId: string;
  projectName: string;
  terminalSnippet: string[];
  commandOutputSnippet?: string[];
  logSnippet: string[];
  databaseSummary: string[];
  traceId?: string;

  // Enhanced fields
  anomalySummary: string[];
  recentCommands: string[];
  currentWorkingDirectory?: string;
  connectionState: string;
  logErrorCount: number;
  logWarningCount: number;
  hasActiveSession: boolean;
  contextCollectedAt: number;
}

/**
 * Options for context building
 */
export interface ContextBuildOptions {
  // Session-specific context
  sessionId?: string;
  transcriptStartIndex?: number;
  bufferStartLength?: number;

  // Context scope
  includeAnomalies?: boolean;
  includeRecentCommands?: boolean;
  maxLogLines?: number;
  maxTerminalLines?: number;

  // Trace ID for debugging
  traceId?: string;
}

/**
 * Strip terminal control sequences and artifacts
 */
function stripTerminalArtifacts(text: string): string {
  return text
    .replace(/\x1b\[[0-9;]*[a-zA-Z]/g, "") // ANSI escape codes
    .replace(/\x1b\][0-9];[^\x07]*\x07/g, "") // OSC sequences
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");
}

/**
 * Extract clean lines from terminal buffer
 */
function extractBufferLines(
  buffer: string,
  startLength?: number,
  maxLines: number = COMMAND_OUTPUT_LINE_COUNT,
): string[] {
  if (!buffer) return [];

  const source = typeof startLength === "number" && startLength >= 0
    ? buffer.slice(startLength)
    : buffer;

  const cleaned = stripTerminalArtifacts(source);
  const lines = cleaned
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0);

  return lines.slice(-maxLines);
}

/**
 * Extract lines from session transcript
 */
function extractTranscriptLines(
  session: SessionSummary | null,
  startIndex?: number,
  maxLines: number = COMMAND_OUTPUT_LINE_COUNT,
): string[] {
  if (!session || session.transcript.length === 0) return [];

  const start = typeof startIndex === "number" && startIndex >= 0
    ? startIndex
    : 0;

  return session.transcript
    .slice(start)
    .slice(-maxLines)
    .map((line: string) => line.trimEnd())
    .filter((line: string) => line.trim().length > 0);
}

/**
 * Detect anomalies in log lines
 */
function detectAnomalies(logs: LogChunk[]): string[] {
  const anomalies: string[] = [];
  const seen = new Set<string>();

  for (const log of logs) {
    const normalized = log.line.toLowerCase();
    const hasKeyword = ANOMALY_DETECTION_KEYWORDS.some((keyword) =>
      normalized.includes(keyword)
    );

    if (hasKeyword && !seen.has(log.line)) {
      anomalies.push(`[${log.level}] ${log.line}`);
      seen.add(log.line);
    }
  }

  return anomalies;
}

/**
 * Extract recent commands from terminal transcript
 */
function extractRecentCommands(session: SessionSummary | null): string[] {
  if (!session || session.transcript.length === 0) return [];

  const commands: string[] = [];
  const promptPattern = /[$#>]\s*(.+)$/;

  for (const line of session.transcript.slice(-20)) {
    const match = line.match(promptPattern);
    if (match && match[1]) {
      const cmd = match[1].trim();
      if (cmd && !cmd.startsWith("__PROJ_EYE_")) {
        commands.push(cmd);
      }
    }
  }

  return commands.slice(-5);
}

/**
 * Count log levels
 */
function countLogLevels(logs: LogChunk[]): { errors: number; warnings: number } {
  let errors = 0;
  let warnings = 0;

  for (const log of logs) {
    if (log.level === "error") errors++;
    else if (log.level === "warning") warnings++;
  }

  return { errors, warnings };
}

/**
 * Build comprehensive project context for AI analysis
 */
export function buildProjectContext(
  projectId: string,
  options: ContextBuildOptions = {},
): ProjectContextBundle {
  const workspace = useWorkspaceStore.getState();
  const appState = useAppStore.getState();

  // Get project details
  const project = appState.config.projects.find((p: any) => p.id === projectId);
  const projectName = project?.name ?? "Unknown Project";

  // Get database summary
  const databaseSummary = project
    ? appState.config.databases
        .filter((db: any) => project.databaseIds.includes(db.id))
        .map((db: any) => `${db.name}:${db.type}`)
    : [];

  // Get active session
  const activeTab = workspace.terminalTabs.find(
    (tab: any) => tab.projectId === projectId && tab.active
  );
  const resolvedSessionId = options.sessionId ?? activeTab?.sessionId;
  const session = workspace.sessions.find((s: any) => s.id === resolvedSessionId) ?? null;

  // Get terminal context
  const buffer = resolvedSessionId ? workspace.terminalBuffers[resolvedSessionId] ?? "" : "";
  const commandBufferLines = extractBufferLines(
    buffer,
    options.bufferStartLength,
    options.maxTerminalLines ?? COMMAND_OUTPUT_LINE_COUNT,
  );
  const commandTranscriptLines = extractTranscriptLines(
    session,
    options.transcriptStartIndex,
    options.maxTerminalLines ?? COMMAND_OUTPUT_LINE_COUNT,
  );
  const commandOutputSnippet = commandBufferLines.length > 0
    ? commandBufferLines
    : commandTranscriptLines;

  const recentBufferLines = extractBufferLines(
    buffer,
    undefined,
    options.maxTerminalLines ?? TERMINAL_CONTEXT_LINE_COUNT,
  );
  const recentTranscriptLines = extractTranscriptLines(
    session,
    undefined,
    options.maxTerminalLines ?? TERMINAL_CONTEXT_LINE_COUNT,
  );
  const terminalSnippet = recentBufferLines.length > 0
    ? recentBufferLines
    : recentTranscriptLines;

  // Get log context
  const projectLogs = workspace.logs.filter((log: any) => log.projectId === projectId);
  const recentLogs = projectLogs.slice(-(options.maxLogLines ?? LOG_CONTEXT_COUNT));
  const logSnippet = recentLogs.map((log: any) => log.line);

  // Enhanced context
  const anomalySummary = options.includeAnomalies !== false
    ? detectAnomalies(recentLogs)
    : [];
  const recentCommands = options.includeRecentCommands !== false
    ? extractRecentCommands(session)
    : [];
  const { errors: logErrorCount, warnings: logWarningCount } = countLogLevels(projectLogs);

  return {
    // Core fields
    projectId,
    projectName,
    terminalSnippet,
    commandOutputSnippet: commandOutputSnippet.length > 0 ? commandOutputSnippet : undefined,
    logSnippet,
    databaseSummary,
    traceId: options.traceId,

    // Enhanced fields
    anomalySummary,
    recentCommands,
    currentWorkingDirectory: session?.cwd,
    connectionState: workspace.connectionState,
    logErrorCount,
    logWarningCount,
    hasActiveSession: session !== null,
    contextCollectedAt: Date.now(),
  };
}

/**
 * Build context for command execution analysis
 */
export function buildCommandContext(
  projectId: string,
  sessionId: string,
  transcriptStartIndex: number,
  bufferStartLength: number,
): ProjectContextBundle {
  return buildProjectContext(projectId, {
    sessionId,
    transcriptStartIndex,
    bufferStartLength,
    includeAnomalies: true,
    includeRecentCommands: true,
  });
}

/**
 * Build context for general project analysis
 */
export function buildAnalysisContext(projectId: string): ProjectContextBundle {
  return buildProjectContext(projectId, {
    includeAnomalies: true,
    includeRecentCommands: true,
    maxLogLines: 20,
  });
}

/**
 * Convert ProjectContextBundle to legacy AiContextPack format
 */
export function toLegacyContextPack(bundle: ProjectContextBundle): AiContextPack {
  return {
    projectId: bundle.projectId,
    projectName: bundle.projectName,
    terminalSnippet: bundle.terminalSnippet,
    commandOutputSnippet: bundle.commandOutputSnippet,
    logSnippet: bundle.logSnippet,
    databaseSummary: bundle.databaseSummary,
    traceId: bundle.traceId,
  };
}

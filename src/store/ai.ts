import { create } from "zustand";
import { analyzeProject, appendTimingLog, confirmSuggestedCommand, sendAiFollowup } from "../lib/backend";
import { localizeErrorMessage, translate } from "../lib/i18n";
import { useAppStore } from "./app";
import { useWorkspaceStore } from "./workspace";
import {
  AIStatus,
  type AIMessage,
  type AIStatus as AIStatusValue,
  type AiCommandSuggestion,
  type AiContextPack,
  type Locale,
  type SessionSummary,
  WorkspaceConnectionState,
} from "../types/models";

const TERMINAL_CONTEXT_LINE_COUNT = 30;
const COMMAND_OUTPUT_LINE_COUNT = 160;
const COMMAND_SETTLE_IDLE_MS = 350;
const COMMAND_SETTLE_MAX_WAIT_MS = 4000;
const COMMAND_NO_OUTPUT_WAIT_MS = 600;
const AUTO_REVIEW_HISTORY_COUNT = 4;

interface AIState {
  statusByProject: Record<string, AIStatusValue>;
  messagesByProject: Record<string, AIMessage[]>;
  suggestionsByProject: Record<string, AiCommandSuggestion | null>;
  historyByProject: Record<string, AIConversationEntry[]>;
  confirmedCommandsByProject: Record<string, ConfirmedCommandContext | null>;
  setStatus: (projectId: string, status: AIStatusValue) => void;
  analyze: (projectId: string, projectName: string, databaseSummary: string[]) => Promise<void>;
  sendFollowup: (
    projectId: string,
    projectName: string,
    databaseSummary: string[],
    prompt: string,
  ) => Promise<void>;
  confirmSuggestion: (projectId: string) => Promise<void>;
  startNewConversation: (projectId: string) => void;
  restoreConversation: (projectId: string, conversationId: string) => void;
}

interface AIConversationEntry {
  id: string;
  title: string;
  preview: string;
  updatedAt: number;
  messages: AIMessage[];
  suggestion: AiCommandSuggestion | null;
}

interface ConfirmedCommandContext {
  traceId: string;
  sessionId: string;
  command: string;
  transcriptStartIndex: number;
  bufferStartLength: number;
  confirmedAt: number;
  awaitingReview: boolean;
}

interface QuickCommandReview {
  message: string;
  suggestion?: AiCommandSuggestion | null;
}

function nowMs(): number {
  return Date.now();
}

function elapsedMs(startMs: number): number {
  return Math.max(0, nowMs() - startMs);
}

function logTiming(entry: Record<string, unknown>): void {
  void appendTimingLog({
    source: "frontend",
    ...entry,
  }).catch(() => {
    // Diagnostics logging must never block or break the main interaction flow.
  });
}

function extractAiAnswer(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) {
    return "";
  }

  const tryParse = (candidate: string): string | null => {
    try {
      const parsed = JSON.parse(candidate) as unknown;
      if (typeof parsed === "string") {
        return parsed.trim() || null;
      }
      if (parsed && typeof parsed === "object") {
        for (const key of ["answer", "analysis", "summary"] as const) {
          const value = (parsed as Record<string, unknown>)[key];
          if (typeof value === "string" && value.trim()) {
            return value.trim();
          }
        }
      }
    } catch {
      return null;
    }

    return null;
  };

  const unfenced = trimmed.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
  const parsedDirect = tryParse(unfenced);
  if (parsedDirect) {
    return parsedDirect;
  }

  const jsonMatch = unfenced.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    const parsedEmbedded = tryParse(jsonMatch[0]);
    if (parsedEmbedded) {
      return parsedEmbedded;
    }
  }

  return trimmed;
}

function normalizeAiMessages(messages: AIMessage[]): AIMessage[] {
  return messages.map((message) =>
    message.speaker === "assistant"
      ? {
          ...message,
          content: extractAiAnswer(message.content),
        }
      : message,
  );
}

function summarizeConversation(messages: AIMessage[], locale: Locale): Pick<AIConversationEntry, "title" | "preview"> {
  const firstUser = messages.find((message) => message.speaker === "user")?.content;
  const firstAssistant = messages.find((message) => message.speaker === "assistant")?.content;
  const fallback = locale === "zh-CN" ? "未命名对话" : "Untitled conversation";
  const seed = (firstUser ?? firstAssistant ?? fallback).replace(/\s+/g, " ").trim() || fallback;
  const previewSeed = (firstAssistant ?? firstUser ?? fallback).replace(/\s+/g, " ").trim() || fallback;

  return {
    title: seed.slice(0, 24),
    preview: previewSeed.slice(0, 64),
  };
}

function buildConversationEntry(
  messages: AIMessage[],
  suggestion: AiCommandSuggestion | null,
  locale: Locale,
): AIConversationEntry {
  const summary = summarizeConversation(messages, locale);

  return {
    id: crypto.randomUUID(),
    title: summary.title,
    preview: summary.preview,
    updatedAt: Date.now(),
    messages,
    suggestion,
  };
}

function takeTail<T>(items: T[], count: number): T[] {
  return count > 0 && items.length > count ? items.slice(items.length - count) : items;
}

function extractTranscriptLines(
  session: SessionSummary | null,
  transcriptStartIndex?: number,
): string[] {
  if (!session) {
    return [];
  }

  const source =
    typeof transcriptStartIndex === "number" && transcriptStartIndex >= 0
      ? session.transcript.slice(transcriptStartIndex)
      : session.transcript;

  return source.filter((line) => line.trim().length > 0);
}

function stripTerminalArtifacts(text: string): string {
  return text
    .replace(/\u001b\][^\u0007]*(?:\u0007|\u001b\\)/g, "")
    .replace(/\u001b\[[0-9;?]*[ -/]*[@-~]/g, "")
    .replace(/\u001b[@-_]/g, "")
    .replace(/\u0007/g, "")
    .replace(/\u001b/g, "");
}

function extractBufferLines(buffer: string, bufferStartLength?: number): string[] {
  if (!buffer) {
    return [];
  }

  const source =
    typeof bufferStartLength === "number" && bufferStartLength >= 0
      ? buffer.slice(bufferStartLength)
      : buffer;

  const cleaned = stripTerminalArtifacts(source);
  const lines = cleaned
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0);

  return lines;
}

function buildContext(
  projectId: string,
  projectName: string,
  databaseSummary: string[],
  options?: { sessionId?: string; transcriptStartIndex?: number; bufferStartLength?: number },
): AiContextPack {
  const workspace = useWorkspaceStore.getState();
  const activeTab = workspace.terminalTabs.find((tab) => tab.projectId === projectId && tab.active);
  const resolvedSessionId = options?.sessionId ?? activeTab?.sessionId;
  const session = workspace.sessions.find((item) => item.id === resolvedSessionId) ?? null;
  const buffer = resolvedSessionId ? workspace.terminalBuffers[resolvedSessionId] ?? "" : "";
  const logs = workspace.logs
    .filter((item) => item.projectId === projectId)
    .slice(-5)
    .map((item) => item.line);
  const commandBufferLines = extractBufferLines(buffer, options?.bufferStartLength);
  const commandTranscriptLines = extractTranscriptLines(session, options?.transcriptStartIndex);
  const commandOutputLines = commandBufferLines.length > 0 ? commandBufferLines : commandTranscriptLines;
  const recentBufferLines = extractBufferLines(buffer);
  const recentTranscriptLines = extractTranscriptLines(session);
  const recentTerminal =
    commandOutputLines.length > 0
      ? commandOutputLines
      : recentBufferLines.length > 0
        ? recentBufferLines
        : recentTranscriptLines;

  return {
    projectId,
    projectName,
    terminalSnippet: takeTail(recentTerminal, TERMINAL_CONTEXT_LINE_COUNT),
    commandOutputSnippet: takeTail(commandOutputLines, COMMAND_OUTPUT_LINE_COUNT),
    logSnippet: logs,
    databaseSummary,
  };
}

function currentLocale(): Locale {
  return useAppStore.getState().config.settings.locale;
}

function currentProjectDetails(projectId: string): { projectName: string; databaseSummary: string[] } | null {
  const config = useAppStore.getState().config;
  const project = config.projects.find((item) => item.id === projectId);
  if (!project) {
    return null;
  }

  return {
    projectName: project.name,
    databaseSummary: config.databases
      .filter((database) => project.databaseIds.includes(database.id))
      .map((database) => `${database.name}:${database.type}`),
  };
}

function errorMessage(error: unknown, locale: Locale, fallbackKey: string): string {
  const localized = localizeErrorMessage(locale, error);
  return localized === "Unknown error" ? translate(locale, fallbackKey) : localized;
}

function appendSystemMessage(projectId: string, content: string): void {
  useAiStore.setState((state) => ({
    messagesByProject: {
      ...state.messagesByProject,
      [projectId]: [
        ...(state.messagesByProject[projectId] ?? []),
        {
          id: crypto.randomUUID(),
          speaker: "system",
          content,
          createdAt: Date.now(),
        },
      ],
    },
  }));
}

function isAcknowledgementPrompt(prompt: string): boolean {
  const normalized = prompt.trim().toLowerCase();
  return /^(好了|好|收到|行|继续|执行了|执行完了|完成了|ok|okay|done|finished|go on|next)$/i.test(normalized);
}

function commandPendingMessage(locale: Locale, command: string): string {
  return locale === "zh-CN"
    ? `已确认执行命令：${command}\n正在等待终端输出并自动分析结果。`
    : `Confirmed command: ${command}\nWaiting for terminal output and preparing an automatic analysis.`;
}

function autoReviewPrompt(locale: Locale, command: string): string {
  return locale === "zh-CN"
    ? `上一条建议命令已经执行完成：${command}\n请严格基于最新终端输出总结当前服务器运行状态、异常点和证据；如果还不能下结论，明确说明缺少什么，并给出下一条最安全的只读排查命令。`
    : `The previously suggested command has finished running: ${command}\nAnalyze the latest terminal output only. Summarize the current server state, notable anomalies, and supporting evidence. If the result is still inconclusive, say what is missing and provide the next safest readonly inspection command.`;
}

function extractPromptLine(buffer: string): string {
  const cleaned = stripTerminalArtifacts(buffer)
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");
  const segments = cleaned.split("\n");
  return (segments[segments.length - 1] ?? "").trimEnd();
}

function looksLikeShellPrompt(line: string): boolean {
  const trimmed = line.trimEnd();
  return /^[^\s@]+@[^\s:]+:.*[#$]\s?$/.test(trimmed);
}

function toNumber(value: string | undefined): number | null {
  if (!value) {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function buildQuickCommandReview(locale: Locale, command: string, lines: string[]): QuickCommandReview | null {
  const joined = lines.join("\n");
  const normalizedCommand = command.toLowerCase();

  if (/\bnc\b/.test(normalizedCommand) && /\bsucceeded\b/i.test(joined)) {
    return {
      message:
        locale === "zh-CN"
          ? "快速判断：目标端口已连通，TCP 握手成功。SSH 的 22 端口当前是开放的，问题不在端口封禁。下一步更应该看 SSH 登录阶段本身，例如认证、密钥、banner、shell 启动或服务端策略。"
          : "Quick read: the target TCP port is reachable and the handshake succeeded. SSH port 22 is open, so the issue is beyond basic port reachability.",
    };
  }

  if (/\bping\b/.test(normalizedCommand)) {
    const stats = joined.match(/(\d+)\s+packets transmitted,\s+(\d+)\s+received,\s+([\d.]+)% packet loss/i);
    const rtt = joined.match(/rtt min\/avg\/max\/mdev = ([\d.]+)\/([\d.]+)\/([\d.]+)\/([\d.]+) ms/i);
    if (stats) {
      const loss = stats[3];
      const avg = rtt?.[2];
      return {
        message:
          locale === "zh-CN"
            ? `快速判断：主机网络连通，丢包 ${loss}%${avg ? `，平均延迟 ${avg} ms` : ""}。如果 SSH 仍异常，优先排查 22 端口服务状态、认证链路或防火墙策略。`
            : `Quick read: the host is reachable with ${loss}% packet loss${avg ? ` and ~${avg} ms average latency` : ""}. If SSH is still failing, inspect the SSH service and auth path next.`,
      };
    }
  }

  if (/\buptime\b|\bfree\b|\bdf\b/.test(normalizedCommand)) {
    const uptimeMatch = joined.match(/up\s+(.+?),\s+\d+\s+users?,\s+load average:\s*([\d.]+),\s*([\d.]+),\s*([\d.]+)/i);
    const memLine = lines.find((line) => line.trimStart().startsWith("Mem:"));
    const swapLine = lines.find((line) => line.trimStart().startsWith("Swap:"));
    const rootLine = lines.find((line) => /\s\/$/.test(line.trim()));

    const memParts = memLine?.trim().split(/\s+/);
    const swapParts = swapLine?.trim().split(/\s+/);
    const rootParts = rootLine?.trim().split(/\s+/);

    const load1 = toNumber(uptimeMatch?.[2]);
    const load15 = toNumber(uptimeMatch?.[4]);
    const memUsed = memParts?.[2];
    const memAvailable = memParts?.[6];
    const swapUsed = swapParts?.[2];
    const swapTotal = swapParts?.[1];
    const rootUsed = rootParts?.[2];
    const rootTotal = rootParts?.[1];
    const rootPercent = rootParts?.[4];

    if (uptimeMatch || memLine || rootLine) {
      return {
        message:
          locale === "zh-CN"
            ? `快速判断：服务器已稳定运行${uptimeMatch?.[1] ?? "一段时间"}，当前负载 ${
                load1 !== null ? load1.toFixed(2) : "未知"
              }/${load15 !== null ? load15.toFixed(2) : "未知"}，整体偏低。${
                memUsed && memAvailable ? `内存已用 ${memUsed}，可用 ${memAvailable}。` : ""
              }${
                swapUsed && swapTotal ? `Swap 使用 ${swapUsed}/${swapTotal}。` : ""
              }${
                rootUsed && rootTotal && rootPercent
                  ? `根分区占用 ${rootUsed}/${rootTotal}（${rootPercent}）。`
                  : ""
              } 目前没看到明显的负载或磁盘瓶颈，下一步更该看进程占用明细。`
            : "Quick read: the server appears stable with low load and no obvious disk pressure. The next useful step is inspecting top process consumers.",
      };
    }
  }

  if (/\btop\b/.test(normalizedCommand)) {
    const uptimeMatch = joined.match(/top\s*-\s*[\d:]+\s+up\s+(.+?),\s+\d+\s+users?,\s+load average:\s*([\d.]+),\s*([\d.]+),\s*([\d.]+)/i);
    const cpuMatch = joined.match(/%Cpu\(s\):\s*([\d.]+)\s+us,\s*([\d.]+)\s+sy,\s*([\d.]+)\s+ni,\s*([\d.]+)\s+id,\s*([\d.]+)\s+wa/i);
    const memMatch = joined.match(/MiB Mem\s*:\s*([\d.]+)\s+total,\s*([\d.]+)\s+free,\s*([\d.]+)\s+used,\s*([\d.]+)\s+buff\/cache/i);
    const swapMatch = joined.match(/MiB Swap:\s*([\d.]+)\s+total,\s*([\d.]+)\s+free,\s*([\d.]+)\s+used/i);

    const load1 = toNumber(uptimeMatch?.[2]);
    const cpuIdle = toNumber(cpuMatch?.[4]);
    const cpuWait = toNumber(cpuMatch?.[5]);
    const memTotal = memMatch?.[1];
    const memFree = memMatch?.[2];
    const memUsed = memMatch?.[3];
    const memCache = memMatch?.[4];
    const swapTotal = swapMatch?.[1];
    const swapUsed = swapMatch?.[3];

    if (uptimeMatch || cpuMatch || memMatch) {
      return {
        message:
          locale === "zh-CN"
            ? `快速判断：服务器已运行 ${uptimeMatch?.[1] ?? "一段时间"}，当前负载 ${
                load1 !== null ? load1.toFixed(2) : "未知"
              }。CPU 空闲率 ${cpuIdle !== null ? `${cpuIdle.toFixed(1)}%` : "未知"}${
                cpuWait !== null ? `，I/O wait ${cpuWait.toFixed(1)}%` : ""
              }。${
                memTotal && memUsed && memFree
                  ? `内存 ${memUsed}/${memTotal} MiB，空闲 ${memFree} MiB${memCache ? `，缓存 ${memCache} MiB` : ""}。`
                  : ""
              }${
                swapTotal && swapUsed ? ` Swap 使用 ${swapUsed}/${swapTotal} MiB。` : ""
              } 整体资源压力不高，下一步应该看内存占用最高的进程。`
            : `Quick read: the server has been up ${uptimeMatch?.[1] ?? "for a while"} with load ${
                load1 !== null ? load1.toFixed(2) : "unknown"
              }. CPU idle is ${cpuIdle !== null ? `${cpuIdle.toFixed(1)}%` : "unknown"}${
                cpuWait !== null ? ` with ${cpuWait.toFixed(1)}% iowait` : ""
              }. ${
                memTotal && memUsed && memFree
                  ? `Memory is ${memUsed}/${memTotal} MiB with ${memFree} MiB free${memCache ? ` and ${memCache} MiB cache` : ""}.`
                  : ""
              } ${
                swapTotal && swapUsed ? `Swap usage is ${swapUsed}/${swapTotal} MiB.` : ""
              } Overall pressure looks low; inspect the top memory consumers next.`,
        suggestion: buildReadonlySuggestion(
          locale,
          "ps aux --sort=-%mem | head -15",
          locale === "zh-CN"
            ? "先看内存占用最高的进程，确认哪些服务在持续消耗资源。"
            : "Inspect the top memory consumers to see which services are actually using resources.",
        ),
      };
    }
  }

  if (/ps aux/.test(normalizedCommand) && /--sort=-%mem/.test(normalizedCommand)) {
    const processLines = lines.filter((line) => /\s+\d+\s+[\d.]+\s+[\d.]+\s+/.test(line)).slice(0, 3);
    if (processLines.length > 0) {
      const processNames = processLines
        .map((line) => line.trim().split(/\s+/).slice(10).join(" "))
        .filter((value) => value.length > 0)
        .slice(0, 3)
        .join("，");
      return {
        message:
          locale === "zh-CN"
            ? `快速判断：内存占用前列的进程已经拿到了，当前最值得盯的是：${processNames}。下一步应该结合这些进程继续看 CPU、监听端口或对应服务日志。`
            : `Quick read: the top memory consumers are ${processNames}. Continue by checking CPU, ports, or logs for those services.`,
      };
    }
  }

  return null;
}

function buildReadonlySuggestion(_locale: Locale, command: string, reason: string): AiCommandSuggestion {
  return {
    id: crypto.randomUUID(),
    command,
    reason,
    risk: "safe",
    requiresConfirmation: true,
    blocked: false,
  };
}

function trimAutoReviewHistory(messages: AIMessage[]): AIMessage[] {
  return messages.slice(-AUTO_REVIEW_HISTORY_COUNT);
}

function buildAutoReviewPrompt(locale: Locale, command: string): string {
  void autoReviewPrompt;
  return locale === "zh-CN"
    ? `上一条建议命令已执行完成：${command}\n优先依据“刚执行命令的新输出”做结论，先给简洁判断和证据。若仍不确定，只给下一条最小的只读命令，回答控制在 4 句内。`
    : `The previously suggested command has finished running: ${command}\nUse the new output from that command as the primary evidence. Give a concise conclusion first, cite the evidence, and if it is still inconclusive provide only the next smallest readonly command. Keep the answer within 4 sentences.`;
}

function buildQuickCommandReviewFast(locale: Locale, command: string, lines: string[]): QuickCommandReview | null {
  void buildQuickCommandReview;
  if (lines.length === 0) {
    return null;
  }

  const joined = lines.join("\n");
  const normalizedCommand = command.toLowerCase();

  if (/\bnc\b/.test(normalizedCommand) && /\bsucceeded\b/i.test(joined)) {
    return {
      message:
        locale === "zh-CN"
          ? "快速判断：目标 TCP 端口可达，握手成功。22 端口当前是通的，问题不在基础连通性。"
          : "Quick read: the target TCP port is reachable and the handshake succeeded. Port 22 is open, so the issue is beyond basic reachability.",
    };
  }

  if (/\bping\b/.test(normalizedCommand)) {
    const stats = joined.match(/(\d+)\s+packets transmitted,\s+(\d+)\s+received,\s+([\d.]+)% packet loss/i);
    const rtt = joined.match(/rtt min\/avg\/max\/mdev = ([\d.]+)\/([\d.]+)\/([\d.]+)\/([\d.]+) ms/i);
    if (stats) {
      const loss = stats[3];
      const avg = rtt?.[2];
      return {
        message:
          locale === "zh-CN"
            ? `快速判断：主机网络可达，丢包 ${loss}%${avg ? `，平均延迟约 ${avg} ms` : ""}。如果 SSH 仍异常，下一步优先看 22 端口和 SSH 服务状态。`
            : `Quick read: the host is reachable with ${loss}% packet loss${avg ? ` and ~${avg} ms average latency` : ""}. If SSH is still failing, inspect the SSH service and auth path next.`,
      };
    }
  }

  if (/\buptime\b|\bfree\b|\bdf\b/.test(normalizedCommand)) {
    const uptimeMatch = joined.match(/up\s+(.+?),\s+\d+\s+users?,\s+load average:\s*([\d.]+),\s*([\d.]+),\s*([\d.]+)/i);
    const memLine = lines.find((line) => line.trimStart().startsWith("Mem:"));
    const swapLine = lines.find((line) => line.trimStart().startsWith("Swap:"));
    const rootLine = lines.find((line) => /\s\/$/.test(line.trim()));

    const memParts = memLine?.trim().split(/\s+/);
    const swapParts = swapLine?.trim().split(/\s+/);
    const rootParts = rootLine?.trim().split(/\s+/);

    const load1 = toNumber(uptimeMatch?.[2]);
    const load15 = toNumber(uptimeMatch?.[4]);
    const memUsed = memParts?.[2];
    const memAvailable = memParts?.[6];
    const swapUsed = swapParts?.[2];
    const swapTotal = swapParts?.[1];
    const rootUsed = rootParts?.[2];
    const rootTotal = rootParts?.[1];
    const rootPercent = rootParts?.[4];

    if (uptimeMatch || memLine || rootLine) {
      return {
        message:
          locale === "zh-CN"
            ? `快速判断：服务器已稳定运行 ${uptimeMatch?.[1] ?? "一段时间"}，当前负载 ${
                load1 !== null ? load1.toFixed(2) : "未知"
              }/${load15 !== null ? load15.toFixed(2) : "未知"}。${
                memUsed && memAvailable ? `内存已用 ${memUsed}，可用 ${memAvailable}。` : ""
              }${
                swapUsed && swapTotal ? `Swap 使用 ${swapUsed}/${swapTotal}。` : ""
              }${
                rootUsed && rootTotal && rootPercent
                  ? `根分区占用 ${rootUsed}/${rootTotal}（${rootPercent}）。`
                  : ""
              } 目前没有看到明显的负载或磁盘瓶颈，下一步应该看进程占用明细。`
            : "Quick read: the server appears stable with low load and no obvious disk pressure. The next useful step is inspecting top process consumers.",
        suggestion: buildReadonlySuggestion(
          locale,
          "ps aux --sort=-%mem | head -20",
          locale === "zh-CN"
            ? "先看内存占用最高的进程，确认资源主要被谁消耗。"
            : "Inspect the top memory consumers before drilling into a specific service.",
        ),
      };
    }
  }

  if (/ps aux/.test(normalizedCommand) && /--sort=-%mem/.test(normalizedCommand)) {
    const processLines = lines.filter((line) => /\s+\d+\s+[\d.]+\s+[\d.]+\s+/.test(line)).slice(0, 3);
    if (processLines.length > 0) {
      const processNames = processLines
        .map((line) => line.trim().split(/\s+/).slice(10).join(" "))
        .filter((value) => value.length > 0)
        .slice(0, 3)
        .join("，");
      return {
        message:
          locale === "zh-CN"
            ? `快速判断：内存占用靠前的进程已经拿到了，当前最值得盯的是：${processNames}。下一步应该结合这些进程继续看监听端口或对应服务日志。`
            : `Quick read: the top memory consumers are ${processNames}. Continue by checking ports or logs for those services.`,
        suggestion: buildReadonlySuggestion(
          locale,
          "ss -lntp | head -20",
          locale === "zh-CN"
            ? "先看当前监听端口和对应进程，确认这些高占用进程是否正在对外提供服务。"
            : "Inspect listening TCP ports and owning processes before checking a specific service log.",
        ),
      };
    }
  }

  return null;
}

async function waitForTerminalToSettle(sessionId: string): Promise<void> {
  const initialWorkspace = useWorkspaceStore.getState();
  const initialSession = initialWorkspace.sessions.find((item) => item.id === sessionId) ?? null;
  const initialBuffer = initialWorkspace.terminalBuffers[sessionId] ?? "";
  const initialLastLine =
    initialSession && initialSession.transcript.length > 0
      ? initialSession.transcript[initialSession.transcript.length - 1]
      : "";

  let lastSignature = `${initialSession?.transcript.length ?? 0}:${initialLastLine}:${initialBuffer.length}`;
  let lastChangeAt = Date.now();
  let sawChange = false;

  await new Promise<void>((resolve) => {
    let finished = false;
    let intervalId: ReturnType<typeof setInterval> | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const finish = () => {
      if (finished) {
        return;
      }
      finished = true;
      unsubscribe();
      if (intervalId) {
        clearInterval(intervalId);
      }
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      resolve();
    };

    const inspect = () => {
      const workspace = useWorkspaceStore.getState();
      const session = workspace.sessions.find((item) => item.id === sessionId) ?? null;
      const buffer = workspace.terminalBuffers[sessionId] ?? "";
      const lastLine =
        session && session.transcript.length > 0 ? session.transcript[session.transcript.length - 1] : "";
      const signature = `${session?.transcript.length ?? 0}:${lastLine}:${buffer.length}`;
      const promptLine = extractPromptLine(buffer);

      if (signature !== lastSignature) {
        lastSignature = signature;
        lastChangeAt = Date.now();
        sawChange = true;
      }

      if (session?.connectionState === WorkspaceConnectionState.Failed) {
        finish();
        return;
      }

      if (sawChange && looksLikeShellPrompt(promptLine)) {
        finish();
        return;
      }

      const idleMs = Date.now() - lastChangeAt;
      if (sawChange && idleMs >= COMMAND_SETTLE_IDLE_MS) {
        finish();
        return;
      }

      if (!sawChange && idleMs >= COMMAND_NO_OUTPUT_WAIT_MS) {
        finish();
      }
    };

    const unsubscribe = useWorkspaceStore.subscribe(inspect);
    intervalId = setInterval(inspect, 250);
    timeoutId = setTimeout(finish, COMMAND_SETTLE_MAX_WAIT_MS);
    inspect();
  });
}

export const useAiStore = create<AIState>((set, get) => ({
  statusByProject: {},
  messagesByProject: {},
  suggestionsByProject: {},
  historyByProject: {},
  confirmedCommandsByProject: {},

  setStatus: (projectId, status) =>
    set((state) => ({
      statusByProject: {
        ...state.statusByProject,
        [projectId]: status,
      },
    })),

  analyze: async (projectId, projectName, databaseSummary) => {
    get().setStatus(projectId, AIStatus.Analyzing);
    try {
      const context = buildContext(projectId, projectName, databaseSummary);
      const response = await analyzeProject(projectId, context);
      set((state) => ({
        statusByProject: {
          ...state.statusByProject,
          [projectId]: AIStatus.Ready,
        },
        messagesByProject: {
          ...state.messagesByProject,
          [projectId]: [...(state.messagesByProject[projectId] ?? []), ...normalizeAiMessages(response.messages)],
        },
        suggestionsByProject: {
          ...state.suggestionsByProject,
          [projectId]: response.suggestion,
        },
      }));
    } catch (error) {
      const locale = currentLocale();
      set((state) => ({
        statusByProject: {
          ...state.statusByProject,
          [projectId]: AIStatus.Error,
        },
        messagesByProject: {
          ...state.messagesByProject,
          [projectId]: [
            ...(state.messagesByProject[projectId] ?? []),
            {
              id: crypto.randomUUID(),
              speaker: "system",
              content: errorMessage(error, locale, "ai.requestFailed"),
              createdAt: Date.now(),
            },
          ],
        },
      }));
    }
  },

  sendFollowup: async (projectId, projectName, databaseSummary, prompt) => {
    const nextPrompt = prompt.trim();
    if (!nextPrompt) {
      return;
    }

    const confirmedCommand = get().confirmedCommandsByProject[projectId];
    const locale = currentLocale();
    const effectivePrompt =
      confirmedCommand?.awaitingReview && isAcknowledgementPrompt(nextPrompt)
        ? buildAutoReviewPrompt(locale, confirmedCommand.command)
        : nextPrompt;
    const context = {
      ...buildContext(projectId, projectName, databaseSummary, {
      sessionId: confirmedCommand?.sessionId,
      transcriptStartIndex: confirmedCommand?.awaitingReview ? confirmedCommand.transcriptStartIndex : undefined,
      bufferStartLength: confirmedCommand?.awaitingReview ? confirmedCommand.bufferStartLength : undefined,
      }),
      traceId: confirmedCommand?.traceId,
    };
    const history = get().messagesByProject[projectId] ?? [];
    const userMessage: AIMessage = {
      id: crypto.randomUUID(),
      speaker: "user",
      content: nextPrompt,
      createdAt: Date.now(),
    };

    set((state) => ({
      statusByProject: {
        ...state.statusByProject,
        [projectId]: AIStatus.Analyzing,
      },
      messagesByProject: {
        ...state.messagesByProject,
        [projectId]: [...(state.messagesByProject[projectId] ?? []), userMessage],
      },
    }));

    try {
      const requestStartedAt = nowMs();
      logTiming({
        traceId: confirmedCommand?.traceId ?? null,
        stage: "manual_followup_request_start",
        projectId,
        promptLength: effectivePrompt.length,
        historyCount: history.length,
        terminalLines: context.terminalSnippet.length,
        commandOutputLines: context.commandOutputSnippet?.length ?? 0,
      });
      const response = await sendAiFollowup(projectId, context, history, effectivePrompt);
      logTiming({
        traceId: confirmedCommand?.traceId ?? null,
        stage: "manual_followup_request_done",
        projectId,
        durationMs: elapsedMs(requestStartedAt),
        assistantCount: response.messages.length,
      });
      set((state) => ({
        statusByProject: {
          ...state.statusByProject,
          [projectId]: AIStatus.Ready,
        },
        messagesByProject: {
          ...state.messagesByProject,
          [projectId]: [...(state.messagesByProject[projectId] ?? []), ...normalizeAiMessages(response.messages)],
        },
        suggestionsByProject: {
          ...state.suggestionsByProject,
          [projectId]: response.suggestion,
        },
        confirmedCommandsByProject: {
          ...state.confirmedCommandsByProject,
          [projectId]:
            confirmedCommand?.awaitingReview
              ? {
                  ...confirmedCommand,
                  awaitingReview: false,
                }
              : state.confirmedCommandsByProject[projectId] ?? null,
        },
      }));
    } catch (error) {
      set((state) => ({
        statusByProject: {
          ...state.statusByProject,
          [projectId]: AIStatus.Error,
        },
        messagesByProject: {
          ...state.messagesByProject,
          [projectId]: [
            ...(state.messagesByProject[projectId] ?? []),
            {
              id: crypto.randomUUID(),
              speaker: "system",
              content: errorMessage(error, locale, "ai.requestFailed"),
              createdAt: Date.now(),
            },
          ],
        },
        confirmedCommandsByProject: {
          ...state.confirmedCommandsByProject,
          [projectId]:
            confirmedCommand?.awaitingReview
              ? {
                  ...confirmedCommand,
                  awaitingReview: false,
                }
              : state.confirmedCommandsByProject[projectId] ?? null,
        },
      }));
    }
  },

  confirmSuggestion: async (projectId) => {
    const suggestion = get().suggestionsByProject[projectId];
    if (!suggestion) {
      return;
    }

    const workspace = useWorkspaceStore.getState();
    const activeTab = workspace.terminalTabs.find((tab) => tab.projectId === projectId && tab.active);
    const activeSession = workspace.sessions.find((session) => session.id === activeTab?.sessionId) ?? null;
    const transcriptStartIndex = activeSession?.transcript.length ?? 0;
    const bufferStartLength = activeTab?.sessionId ? workspace.terminalBuffers[activeTab.sessionId]?.length ?? 0 : 0;
    const locale = currentLocale();
    const projectDetails = currentProjectDetails(projectId);
    const traceId = crypto.randomUUID();
    const flowStartedAt = nowMs();
    const pendingCommand: ConfirmedCommandContext | null = activeTab?.sessionId
      ? {
          traceId,
          sessionId: activeTab.sessionId,
          command: suggestion.command,
          transcriptStartIndex,
          bufferStartLength,
          confirmedAt: Date.now(),
          awaitingReview: true,
        }
      : null;
    try {
      logTiming({
        traceId,
        stage: "confirm_click",
        projectId,
        sessionId: activeTab?.sessionId ?? null,
        command: suggestion.command,
      });
      set((state) => ({
        statusByProject: {
          ...state.statusByProject,
          [projectId]: AIStatus.Analyzing,
        },
        suggestionsByProject: {
          ...state.suggestionsByProject,
          [projectId]: null,
        },
        confirmedCommandsByProject: {
          ...state.confirmedCommandsByProject,
          [projectId]: pendingCommand,
        },
      }));
      appendSystemMessage(projectId, commandPendingMessage(locale, suggestion.command));

      const dispatchStartedAt = nowMs();
      const payload = await confirmSuggestedCommand(projectId, activeTab?.sessionId, suggestion);
      logTiming({
        traceId,
        stage: "command_dispatch_done",
        projectId,
        durationMs: elapsedMs(dispatchStartedAt),
        sessionId: payload.session.id,
      });
      workspace.upsertSession(payload.session);

      if (!pendingCommand || !projectDetails) {
        set((state) => ({
          statusByProject: {
            ...state.statusByProject,
            [projectId]: AIStatus.Ready,
          },
        }));
        return;
      }

      const settleStartedAt = nowMs();
      await waitForTerminalToSettle(pendingCommand.sessionId);
      logTiming({
        traceId,
        stage: "terminal_settled",
        projectId,
        durationMs: elapsedMs(settleStartedAt),
        totalSinceConfirmMs: elapsedMs(flowStartedAt),
      });

      const history = trimAutoReviewHistory(get().messagesByProject[projectId] ?? []);
      const context = {
        ...buildContext(projectId, projectDetails.projectName, projectDetails.databaseSummary, {
        sessionId: pendingCommand.sessionId,
        transcriptStartIndex: pendingCommand.transcriptStartIndex,
        bufferStartLength: pendingCommand.bufferStartLength,
        }),
        traceId,
      };
      logTiming({
        traceId,
        stage: "context_built",
        projectId,
        terminalLines: context.terminalSnippet.length,
        commandOutputLines: context.commandOutputSnippet?.length ?? 0,
        logLines: context.logSnippet.length,
      });
      const reviewLines =
        context.commandOutputSnippet && context.commandOutputSnippet.length > 0
          ? context.commandOutputSnippet
          : context.terminalSnippet;
      const quickReview = buildQuickCommandReviewFast(locale, pendingCommand.command, reviewLines);
      if (quickReview) {
        logTiming({
          traceId,
          stage: "quick_review_ready",
          projectId,
          totalSinceConfirmMs: elapsedMs(flowStartedAt),
          commandOutputLines: reviewLines.length,
          hasLocalSuggestion: Boolean(quickReview.suggestion),
        });
        set((state) => ({
          messagesByProject: {
            ...state.messagesByProject,
            [projectId]: [
              ...(state.messagesByProject[projectId] ?? []),
              {
                id: crypto.randomUUID(),
                speaker: "assistant",
                content: quickReview.message,
                createdAt: Date.now(),
              },
            ],
          },
          suggestionsByProject: quickReview.suggestion
            ? {
                ...state.suggestionsByProject,
                [projectId]: quickReview.suggestion,
              }
            : state.suggestionsByProject,
        }));
      }
      const autoPrompt = buildAutoReviewPrompt(locale, pendingCommand.command);
      const aiStartedAt = nowMs();
      logTiming({
        traceId,
        stage: "auto_followup_request_start",
        projectId,
        promptLength: autoPrompt.length,
        historyCount: history.length,
        terminalLines: context.terminalSnippet.length,
        commandOutputLines: context.commandOutputSnippet?.length ?? 0,
      });
      const response = await sendAiFollowup(projectId, context, history, autoPrompt);
      logTiming({
        traceId,
        stage: "auto_followup_request_done",
        projectId,
        durationMs: elapsedMs(aiStartedAt),
        totalSinceConfirmMs: elapsedMs(flowStartedAt),
        assistantCount: response.messages.length,
      });

      set((state) => ({
        statusByProject: {
          ...state.statusByProject,
          [projectId]: AIStatus.Ready,
        },
        messagesByProject: {
          ...state.messagesByProject,
          [projectId]: [...(state.messagesByProject[projectId] ?? []), ...normalizeAiMessages(response.messages)],
        },
        suggestionsByProject: {
          ...state.suggestionsByProject,
          [projectId]: response.suggestion,
        },
        confirmedCommandsByProject: {
          ...state.confirmedCommandsByProject,
          [projectId]: {
            ...pendingCommand,
            awaitingReview: false,
          },
        },
      }));
      logTiming({
        traceId,
        stage: "confirm_flow_done",
        projectId,
        totalSinceConfirmMs: elapsedMs(flowStartedAt),
      });
    } catch (error) {
      logTiming({
        traceId,
        stage: "confirm_flow_error",
        projectId,
        totalSinceConfirmMs: elapsedMs(flowStartedAt),
        error: error instanceof Error ? error.message : String(error),
      });
      set((state) => ({
        statusByProject: {
          ...state.statusByProject,
          [projectId]: AIStatus.Error,
        },
        messagesByProject: {
          ...state.messagesByProject,
          [projectId]: [
            ...(state.messagesByProject[projectId] ?? []),
            {
              id: crypto.randomUUID(),
              speaker: "system",
              content: errorMessage(error, locale, "ai.commandFailed"),
              createdAt: Date.now(),
            },
          ],
        },
        confirmedCommandsByProject: {
          ...state.confirmedCommandsByProject,
          [projectId]:
            pendingCommand
              ? {
                  ...pendingCommand,
                  awaitingReview: false,
                }
              : null,
        },
      }));
    }
  },

  startNewConversation: (projectId) => {
    const locale = currentLocale();
    set((state) => {
      const currentMessages = state.messagesByProject[projectId] ?? [];
      const currentSuggestion = state.suggestionsByProject[projectId] ?? null;
      const history = state.historyByProject[projectId] ?? [];
      const nextHistory =
        currentMessages.length > 0 || currentSuggestion
          ? [buildConversationEntry(currentMessages, currentSuggestion, locale), ...history]
          : history;

      return {
        historyByProject: {
          ...state.historyByProject,
          [projectId]: nextHistory,
        },
        messagesByProject: {
          ...state.messagesByProject,
          [projectId]: [],
        },
        suggestionsByProject: {
          ...state.suggestionsByProject,
          [projectId]: null,
        },
        confirmedCommandsByProject: {
          ...state.confirmedCommandsByProject,
          [projectId]: null,
        },
        statusByProject: {
          ...state.statusByProject,
          [projectId]: AIStatus.Ready,
        },
      };
    });
  },

  restoreConversation: (projectId, conversationId) => {
    set((state) => {
      const target = (state.historyByProject[projectId] ?? []).find((item) => item.id === conversationId);
      if (!target) {
        return state;
      }

      return {
        messagesByProject: {
          ...state.messagesByProject,
          [projectId]: target.messages,
        },
        suggestionsByProject: {
          ...state.suggestionsByProject,
          [projectId]: target.suggestion,
        },
        confirmedCommandsByProject: {
          ...state.confirmedCommandsByProject,
          [projectId]: null,
        },
        statusByProject: {
          ...state.statusByProject,
          [projectId]: AIStatus.Ready,
        },
      };
    });
  },
}));

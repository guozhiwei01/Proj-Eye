/**
 * AI Actions - Action-oriented AI workflows
 *
 * Instead of treating AI as a chat interface, this module provides
 * specific action-based workflows for common operations.
 */

import { analyzeProject, sendAiFollowup, confirmSuggestedCommand } from "../backend";
import { buildProjectContext, buildCommandContext, toLegacyContextPack } from "./context-builder";
import type { AIMessage, AiCommandSuggestion, AiConversationResponse } from "../../types/models";

/**
 * Action: Explain current anomalies in logs
 */
export async function explainAnomalies(projectId: string): Promise<{
  explanation: string;
  suggestion: AiCommandSuggestion | null;
}> {
  const context = buildProjectContext(projectId, {
    includeAnomalies: true,
    maxLogLines: 20,
  });

  if (context.anomalySummary.length === 0) {
    return {
      explanation: "No anomalies detected in recent logs.",
      suggestion: null,
    };
  }

  // Build a focused prompt
  const prompt = `Analyze these log anomalies and explain what might be wrong:

${context.anomalySummary.join("\n")}

Recent terminal output:
${context.terminalSnippet.slice(-10).join("\n")}

Provide a concise explanation and suggest a diagnostic command if appropriate.`;

  const legacyContext = toLegacyContextPack(context);
  const response = await analyzeProject(projectId, legacyContext);

  return {
    explanation: response.messages.find((m) => m.speaker === "assistant")?.content ?? "",
    suggestion: response.suggestion,
  };
}

/**
 * Action: Suggest command based on current context
 */
export async function suggestCommand(
  projectId: string,
  intent: string,
): Promise<{
  suggestion: AiCommandSuggestion | null;
  reasoning: string;
}> {
  const context = buildProjectContext(projectId, {
    includeAnomalies: true,
    includeRecentCommands: true,
  });

  const prompt = `User wants to: ${intent}

Current context:
- Working directory: ${context.currentWorkingDirectory ?? "unknown"}
- Recent commands: ${context.recentCommands.join(", ") || "none"}
- Log errors: ${context.logErrorCount}
- Log warnings: ${context.logWarningCount}

Suggest a safe command to accomplish this goal.`;

  const legacyContext = toLegacyContextPack(context);
  const response = await analyzeProject(projectId, legacyContext);

  return {
    suggestion: response.suggestion,
    reasoning: response.messages.find((m) => m.speaker === "assistant")?.content ?? "",
  };
}

/**
 * Action: Analyze command output
 */
export async function analyzeCommandOutput(
  projectId: string,
  sessionId: string,
  transcriptStartIndex: number,
  bufferStartLength: number,
): Promise<{
  analysis: string;
  hasIssues: boolean;
  nextSteps: string[];
}> {
  const context = buildCommandContext(
    projectId,
    sessionId,
    transcriptStartIndex,
    bufferStartLength,
  );

  const commandOutput = context.commandOutputSnippet?.join("\n") ?? "";

  const prompt = `Analyze this command output and determine if there are any issues:

${commandOutput}

Provide:
1. Brief analysis (1-2 sentences)
2. Whether there are issues (yes/no)
3. Suggested next steps (if any)`;

  const legacyContext = toLegacyContextPack(context);
  const response = await analyzeProject(projectId, legacyContext);

  const content = response.messages.find((m) => m.speaker === "assistant")?.content ?? "";

  // Simple parsing - in production you'd want structured output
  const hasIssues = /issue|error|problem|fail/i.test(content);
  const nextSteps = content
    .split("\n")
    .filter((line) => /^\d+\.|^-/.test(line.trim()))
    .map((line) => line.trim());

  return {
    analysis: content,
    hasIssues,
    nextSteps,
  };
}

/**
 * Action: Quick health check
 */
export async function quickHealthCheck(projectId: string): Promise<{
  status: "healthy" | "warning" | "error";
  summary: string;
  details: string[];
}> {
  const context = buildProjectContext(projectId, {
    includeAnomalies: true,
    maxLogLines: 30,
  });

  // Quick heuristic check
  if (context.logErrorCount > 5) {
    return {
      status: "error",
      summary: `${context.logErrorCount} errors detected in recent logs`,
      details: context.anomalySummary.slice(0, 5),
    };
  }

  if (context.logWarningCount > 10 || context.anomalySummary.length > 3) {
    return {
      status: "warning",
      summary: `${context.logWarningCount} warnings and ${context.anomalySummary.length} anomalies detected`,
      details: context.anomalySummary.slice(0, 5),
    };
  }

  return {
    status: "healthy",
    summary: "No significant issues detected",
    details: [],
  };
}

/**
 * Action: Confirm and execute suggested command
 */
export async function confirmAndExecute(
  projectId: string,
  sessionId: string,
  suggestion: AiCommandSuggestion,
): Promise<{
  executed: boolean;
  message: string;
}> {
  if (suggestion.blocked) {
    return {
      executed: false,
      message: "This command is blocked for safety reasons.",
    };
  }

  if (suggestion.requiresConfirmation && suggestion.risk !== "safe") {
    // In a real implementation, you'd show a confirmation dialog
    // For now, we'll just return a message
    return {
      executed: false,
      message: `Command requires confirmation due to ${suggestion.risk} risk: ${suggestion.command}`,
    };
  }

  try {
    await confirmSuggestedCommand(projectId, sessionId, suggestion);
    return {
      executed: true,
      message: `Executed: ${suggestion.command}`,
    };
  } catch (error) {
    return {
      executed: false,
      message: `Failed to execute: ${error}`,
    };
  }
}

/**
 * Action: Follow-up question in context
 */
export async function askFollowup(
  projectId: string,
  conversationHistory: AIMessage[],
  question: string,
): Promise<AiConversationResponse> {
  const context = buildProjectContext(projectId);
  const legacyContext = toLegacyContextPack(context);

  return sendAiFollowup(
    projectId,
    legacyContext,
    conversationHistory,
    question,
  );
}

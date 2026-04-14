/**
 * Migration Guide: From buildContext to buildProjectContext
 *
 * This file shows how to migrate from the old inline buildContext
 * to the new centralized buildProjectContext.
 */

// ============================================================================
// BEFORE: Old approach (scattered in ai.ts)
// ============================================================================

/*
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
  // ... more logic

  return {
    projectId,
    projectName,
    terminalSnippet: takeTail(recentTerminal, TERMINAL_CONTEXT_LINE_COUNT),
    commandOutputSnippet: takeTail(commandOutputLines, COMMAND_OUTPUT_LINE_COUNT),
    logSnippet: logs,
    databaseSummary,
  };
}

// Usage in analyze function
analyze: async (projectId, projectName, databaseSummary) => {
  const context = buildContext(projectId, projectName, databaseSummary);
  const response = await analyzeProject(projectId, context);
  // ...
}
*/

// ============================================================================
// AFTER: New approach (centralized in context-builder.ts)
// ============================================================================

import { buildProjectContext, buildAnalysisContext, toLegacyContextPack } from "../lib/ai";

// Simple usage - let the builder figure out project details
export async function analyzeWithNewContext(projectId: string) {
  const context = buildAnalysisContext(projectId);
  const legacyContext = toLegacyContextPack(context);
  const response = await analyzeProject(projectId, legacyContext);
  return response;
}

// Advanced usage - with options
export async function analyzeCommandWithNewContext(
  projectId: string,
  sessionId: string,
  transcriptStartIndex: number,
  bufferStartLength: number,
) {
  const context = buildProjectContext(projectId, {
    sessionId,
    transcriptStartIndex,
    bufferStartLength,
    includeAnomalies: true,
    includeRecentCommands: true,
  });

  // Access enhanced fields
  console.log("Anomalies detected:", context.anomalySummary);
  console.log("Recent commands:", context.recentCommands);
  console.log("Error count:", context.logErrorCount);

  const legacyContext = toLegacyContextPack(context);
  const response = await analyzeProject(projectId, legacyContext);
  return response;
}

// ============================================================================
// Migration Steps for ai.ts
// ============================================================================

/*
Step 1: Import the new builder
  import { buildProjectContext, toLegacyContextPack } from "../lib/ai";

Step 2: Replace buildContext calls
  OLD:
    const context = buildContext(projectId, projectName, databaseSummary);

  NEW:
    const context = buildProjectContext(projectId);
    const legacyContext = toLegacyContextPack(context);

Step 3: Update analyze function signature (optional)
  OLD:
    analyze: async (projectId, projectName, databaseSummary) => {

  NEW:
    analyze: async (projectId) => {
    // projectName and databaseSummary are fetched inside buildProjectContext

Step 4: Use enhanced context fields
  // Now you can access:
  context.anomalySummary
  context.recentCommands
  context.logErrorCount
  context.currentWorkingDirectory
  // etc.

Step 5: Remove old buildContext function
  // Delete the old inline buildContext and related helpers
*/

// ============================================================================
// Benefits of the New Approach
// ============================================================================

/*
1. Centralized Logic
   - All context building logic in one place
   - Easier to maintain and test

2. Enhanced Context
   - Automatic anomaly detection
   - Recent command extraction
   - Log level counting
   - More metadata

3. Flexible Options
   - Fine-grained control over what to include
   - Easy to add new context sources

4. Better Separation
   - AI store focuses on state management
   - Context building is a pure function
   - Easier to unit test

5. Backward Compatible
   - toLegacyContextPack() converts to old format
   - Existing backend API unchanged
*/

/**
 * AI Module - Unified AI context and actions
 *
 * This module provides:
 * 1. Context building - Collect and structure context from various sources
 * 2. Actions - Action-oriented AI workflows instead of chat-only interface
 */

export {
  buildProjectContext,
  buildCommandContext,
  buildAnalysisContext,
  toLegacyContextPack,
  type ProjectContextBundle,
  type ContextBuildOptions,
} from "./context-builder";

export {
  explainAnomalies,
  suggestCommand,
  analyzeCommandOutput,
  quickHealthCheck,
  confirmAndExecute,
  askFollowup,
} from "./actions";

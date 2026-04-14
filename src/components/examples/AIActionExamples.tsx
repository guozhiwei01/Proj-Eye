/**
 * Example: AI Action Buttons Component
 *
 * This demonstrates how to use the new action-oriented AI interface
 * instead of just a chat box.
 */

import { useState } from "react";
import {
  explainAnomalies,
  suggestCommand,
  quickHealthCheck,
  analyzeCommandOutput,
} from "../lib/ai";
import type { AiCommandSuggestion } from "../types/models";

interface AIActionButtonsProps {
  projectId: string;
  sessionId?: string;
}

export function AIActionButtons({ projectId, sessionId }: AIActionButtonsProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string>("");
  const [suggestion, setSuggestion] = useState<AiCommandSuggestion | null>(null);

  const handleExplainAnomalies = async () => {
    setLoading(true);
    try {
      const response = await explainAnomalies(projectId);
      setResult(response.explanation);
      setSuggestion(response.suggestion);
    } catch (error) {
      setResult(`Error: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSuggestCommand = async () => {
    setLoading(true);
    try {
      const intent = prompt("What do you want to do?");
      if (!intent) return;

      const response = await suggestCommand(projectId, intent);
      setResult(response.reasoning);
      setSuggestion(response.suggestion);
    } catch (error) {
      setResult(`Error: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const handleHealthCheck = async () => {
    setLoading(true);
    try {
      const response = await quickHealthCheck(projectId);
      setResult(`Status: ${response.status}\n${response.summary}\n\nDetails:\n${response.details.join("\n")}`);
    } catch (error) {
      setResult(`Error: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ai-action-buttons">
      <div className="button-group">
        <button
          onClick={handleExplainAnomalies}
          disabled={loading}
          className="action-button"
        >
          🔍 Explain Anomalies
        </button>

        <button
          onClick={handleSuggestCommand}
          disabled={loading}
          className="action-button"
        >
          💡 Suggest Command
        </button>

        <button
          onClick={handleHealthCheck}
          disabled={loading}
          className="action-button"
        >
          ❤️ Health Check
        </button>
      </div>

      {loading && <div className="loading">Analyzing...</div>}

      {result && (
        <div className="result">
          <pre>{result}</pre>
        </div>
      )}

      {suggestion && (
        <div className="suggestion">
          <h4>Suggested Command:</h4>
          <code>{suggestion.command}</code>
          <p>{suggestion.reason}</p>
          <span className={`risk-badge risk-${suggestion.risk}`}>
            {suggestion.risk}
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * Example: Automatic Anomaly Detection
 *
 * This component automatically detects and highlights anomalies
 * in the log panel.
 */

import { useEffect } from "react";
import { buildProjectContext } from "../lib/ai";

interface AutoAnomalyDetectorProps {
  projectId: string;
  onAnomaliesDetected: (anomalies: string[]) => void;
}

export function AutoAnomalyDetector({
  projectId,
  onAnomaliesDetected,
}: AutoAnomalyDetectorProps) {
  useEffect(() => {
    const interval = setInterval(() => {
      const context = buildProjectContext(projectId, {
        includeAnomalies: true,
        maxLogLines: 50,
      });

      if (context.anomalySummary.length > 0) {
        onAnomaliesDetected(context.anomalySummary);
      }
    }, 5000); // Check every 5 seconds

    return () => clearInterval(interval);
  }, [projectId, onAnomaliesDetected]);

  return null; // This is a logic-only component
}

/**
 * Example: Context-Aware Command Input
 *
 * This shows how to enhance a command input with AI suggestions
 * based on current context.
 */

interface SmartCommandInputProps {
  projectId: string;
  sessionId: string;
  onExecute: (command: string) => void;
}

export function SmartCommandInput({
  projectId,
  sessionId,
  onExecute,
}: SmartCommandInputProps) {
  const [input, setInput] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);

  const handleInputChange = async (value: string) => {
    setInput(value);

    // Trigger suggestions when user types certain keywords
    if (value.includes("?") || value.includes("help")) {
      try {
        const response = await suggestCommand(projectId, value.replace(/[?]/g, ""));
        if (response.suggestion) {
          setSuggestions([response.suggestion.command]);
        }
      } catch {
        // Ignore errors in background suggestions
      }
    }
  };

  return (
    <div className="smart-command-input">
      <input
        type="text"
        value={input}
        onChange={(e) => handleInputChange(e.target.value)}
        placeholder="Type a command or ask for help..."
      />

      {suggestions.length > 0 && (
        <div className="suggestions">
          {suggestions.map((suggestion, i) => (
            <button
              key={i}
              onClick={() => {
                setInput(suggestion);
                setSuggestions([]);
              }}
              className="suggestion-item"
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}

      <button onClick={() => onExecute(input)}>Execute</button>
    </div>
  );
}

/**
 * Example: Post-Command Analysis
 *
 * Automatically analyze command output after execution
 */

interface PostCommandAnalysisProps {
  projectId: string;
  sessionId: string;
  transcriptStartIndex: number;
  bufferStartLength: number;
  onAnalysisComplete: (analysis: {
    hasIssues: boolean;
    summary: string;
  }) => void;
}

export function PostCommandAnalysis({
  projectId,
  sessionId,
  transcriptStartIndex,
  bufferStartLength,
  onAnalysisComplete,
}: PostCommandAnalysisProps) {
  useEffect(() => {
    const analyze = async () => {
      try {
        const result = await analyzeCommandOutput(
          projectId,
          sessionId,
          transcriptStartIndex,
          bufferStartLength,
        );

        onAnalysisComplete({
          hasIssues: result.hasIssues,
          summary: result.analysis,
        });
      } catch {
        // Ignore errors in background analysis
      }
    };

    // Analyze after a short delay to let command complete
    const timer = setTimeout(analyze, 1000);
    return () => clearTimeout(timer);
  }, [projectId, sessionId, transcriptStartIndex, bufferStartLength, onAnalysisComplete]);

  return null;
}

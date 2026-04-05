export const anomalyKeywords = [
  "error",
  "warn",
  "exception",
  "traceback",
  "connection refused",
  "permission denied",
  "oom",
] as const;

export function hasAnomalySignal(content: string): boolean {
  const normalized = content.toLowerCase();
  return anomalyKeywords.some((keyword) => normalized.includes(keyword));
}

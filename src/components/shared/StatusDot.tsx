import { ProjectHealth, ServerStatus, type ProjectHealth as ProjectHealthValue, type ServerStatus as ServerStatusValue } from "../../types/models";

interface StatusDotProps {
  status: ProjectHealthValue | ServerStatusValue;
}

function resolveColor(status: ProjectHealthValue | ServerStatusValue): string {
  switch (status) {
    case ProjectHealth.Error:
    case ServerStatus.Offline:
      return "var(--red)";
    case ProjectHealth.Warning:
    case ServerStatus.Warning:
      return "var(--yellow)";
    case ProjectHealth.Healthy:
    case ServerStatus.Online:
      return "var(--accent)";
    default:
      return "var(--text2)";
  }
}

export default function StatusDot({ status }: StatusDotProps) {
  const color = resolveColor(status);

  return (
    <span
      className="inline-flex h-2.5 w-2.5 rounded-full"
      style={{ backgroundColor: color, boxShadow: `0 0 16px ${color}` }}
      aria-hidden="true"
    />
  );
}

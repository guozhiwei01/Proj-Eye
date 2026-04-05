import type { PropsWithChildren } from "react";

type BadgeTone = "neutral" | "accent" | "warning" | "danger" | "info";

const toneClasses: Record<BadgeTone, string> = {
  neutral: "border-[var(--border2)] text-[var(--text1)]",
  accent: "border-[var(--accent)] text-[var(--accent)]",
  warning: "border-[var(--yellow)] text-[var(--yellow)]",
  danger: "border-[var(--red)] text-[var(--red)]",
  info: "border-[var(--blue)] text-[var(--blue)]",
};

interface BadgeProps extends PropsWithChildren {
  tone?: BadgeTone;
}

export default function Badge({ children, tone = "neutral" }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.22em] ${toneClasses[tone]}`}
    >
      {children}
    </span>
  );
}

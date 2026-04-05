interface EmptyStateProps {
  title: string;
  description: string;
}

export default function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <div className="rounded-3xl border border-dashed border-[var(--border2)] bg-[var(--bg2)]/70 px-5 py-8 text-center">
      <p className="text-sm font-semibold text-[var(--text0)]">{title}</p>
      <p className="mt-2 text-sm leading-6 text-[var(--text1)]">{description}</p>
    </div>
  );
}

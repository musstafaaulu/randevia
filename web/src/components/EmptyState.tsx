export function EmptyState({ icon = '📭', text }: { icon?: string; text: string }) {
  return (
    <div className="empty-state">
      <span className="empty-state-icon" aria-hidden="true">
        {icon}
      </span>
      <p>{text}</p>
    </div>
  );
}

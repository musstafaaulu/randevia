// Shared label for an async submit button: shows a small spinner next to
// the "in progress" text instead of swapping to plain text alone, so a slow
// request reads as "working" rather than "did my click register at all".
export function ButtonLabel({
  busy,
  busyText,
  idleText,
}: {
  busy: boolean;
  busyText: string;
  idleText: string;
}) {
  if (!busy) return <>{idleText}</>;
  return (
    <span className="button-busy">
      <span className="button-spinner" aria-hidden="true" />
      {busyText}
    </span>
  );
}

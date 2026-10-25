import { Card } from './Card';

/** KPI tile — the metric building block used across the product.
    Editorial: Fraunces numeral, compact density, quiet grey label. */
export function StatTile({ label, value, hint, tone = 'default' }) {
  const toneMap = {
    default: 'text-foreground',
    primary: 'text-primary',
    accent: 'text-accent',
  };
  return (
    <Card className="p-4">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-1 font-display text-[26px] leading-none ${toneMap[tone]}`}>{value}</div>
      {hint && <div className="mt-1.5 text-xs text-muted-foreground">{hint}</div>}
    </Card>
  );
}

/**
 * SectionSummary - Brief overview shown at top of each dashboard section
 * Helps companies quickly understand what the section contains
 */
interface SectionSummaryProps {
  title: string;
  description: string;
  stats?: { label: string; value: string }[];
}

export default function SectionSummary({ title, description, stats }: SectionSummaryProps) {
  return (
    <div className="mb-8 rounded-2xl border border-app-border bg-app-surface p-6">
      <h1 className="text-3xl font-semibold tracking-tight text-app-text">{title}</h1>
      <p className="mt-2 text-app-muted">{description}</p>
      {stats && stats.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-6">
          {stats.map(({ label, value }) => (
            <div key={label}>
              <span className="text-sm text-app-muted">{label}: </span>
              <span className="font-semibold text-app-text">{value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

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
    <div className="mb-8 rounded-xl border border-slate-200 bg-slate-50/50 p-6">
      <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
      <p className="mt-2 text-slate-600">{description}</p>
      {stats && stats.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-6">
          {stats.map(({ label, value }) => (
            <div key={label}>
              <span className="text-sm text-slate-500">{label}: </span>
              <span className="font-semibold text-slate-900">{value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

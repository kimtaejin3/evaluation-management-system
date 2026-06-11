export default function StatCard({
  label,
  value,
  hint,
  accent = false,
}: {
  label: string
  value: React.ReactNode
  hint?: string
  accent?: boolean
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="text-sm text-slate-500">{label}</div>
      <div className={`mt-1 text-3xl font-bold ${accent ? 'text-indigo-600' : 'text-slate-900'}`}>{value}</div>
      {hint && <div className="mt-1 text-xs text-slate-400">{hint}</div>}
    </div>
  )
}

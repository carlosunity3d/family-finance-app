import type { MonthlyStats } from '@/lib/types'

interface Props {
  title: string
  stats: MonthlyStats | null
  onEdit?: () => void
  highlight?: boolean
}

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm py-1 border-b border-gray-100 last:border-0">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium text-gray-800">{value}</span>
    </div>
  )
}

export default function StatsCard({ title, stats, onEdit, highlight }: Props) {
  return (
    <div className={`bg-white rounded-2xl shadow-sm border p-5 flex-1 ${highlight ? 'border-blue-200 bg-blue-50' : 'border-gray-200'}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-800">{title}</h3>
        {onEdit && (
          <button
            onClick={onEdit}
            className="text-xs text-blue-600 hover:underline"
          >
            {stats ? 'Edit' : '+ Add'}
          </button>
        )}
      </div>
      {stats ? (
        <div>
          <Row label="Income" value={fmt(stats.income)} />
          <Row label="Expenses" value={fmt(stats.expenses)} />
          <Row label="Investments" value={fmt(stats.investments)} />
          <Row label="Savings" value={fmt(stats.savings)} />
          <Row label="Savings %" value={`${stats.savingsPct.toFixed(1)}%`} />
        </div>
      ) : (
        <p className="text-sm text-gray-400 italic">No data for this month.</p>
      )}
    </div>
  )
}

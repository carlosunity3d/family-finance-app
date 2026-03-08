'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { calcStats, calcFamily } from '@/lib/finance'
import type { MonthlyEntry, MonthlyStats } from '@/lib/types'
import YearlyChart from '@/components/YearlyChart'

const MONTHS = ['01','02','03','04','05','06','07','08','09','10','11','12']
const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
}

function pct(n: number) {
  return `${n.toFixed(1)}%`
}

function sumStats(stats: (MonthlyStats | null)[]): MonthlyStats {
  const valid = stats.filter(Boolean) as MonthlyStats[]
  const income = valid.reduce((s, v) => s + v.income, 0)
  const expenses = valid.reduce((s, v) => s + v.expenses, 0)
  const savings = valid.reduce((s, v) => s + v.savings, 0)
  const net = income - expenses
  const savingsPct = income === 0 ? 0 : (savings / income) * 100
  return { income, expenses, savings, net, savingsPct }
}

function StatCells({ stats }: { stats: MonthlyStats | null }) {
  if (!stats) {
    return <td className="px-3 py-2 text-center text-gray-300" colSpan={5}>—</td>
  }
  return (
    <>
      <td className="px-3 py-2 text-right text-sm">{fmt(stats.income)}</td>
      <td className="px-3 py-2 text-right text-sm">{fmt(stats.expenses)}</td>
      <td className="px-3 py-2 text-right text-sm">{fmt(stats.savings)}</td>
      <td className="px-3 py-2 text-right text-sm">{fmt(stats.net)}</td>
      <td className="px-3 py-2 text-right text-sm">{pct(stats.savingsPct)}</td>
    </>
  )
}

export default function YearlySummaryPage() {
  const [year, setYear] = useState(new Date().getFullYear())
  const [entries, setEntries] = useState<MonthlyEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchEntries() {
      setLoading(true)
      const supabase = createClient()
      const { data, error: fetchErr } = await supabase
        .from('monthly_entry')
        .select('*')
        .gte('month', `${year}-01-01`)
        .lte('month', `${year}-12-31`)
        .order('month', { ascending: true })
      if (fetchErr) {
        setFetchError(fetchErr.message)
        setLoading(false)
        return
      }
      setFetchError(null)
      setEntries((data as MonthlyEntry[]) ?? [])
      setLoading(false)
    }
    fetchEntries()
  }, [year])

  function getStats(person: 'carlos' | 'nicoletta', month: string): MonthlyStats | null {
    const entry = entries.find(e => e.person === person && e.month.startsWith(`${year}-${month}`))
    return entry ? calcStats(entry) : null
  }

  const rows = MONTHS.map((m, i) => {
    const carlos = getStats('carlos', m)
    const nicoletta = getStats('nicoletta', m)
    const family = carlos && nicoletta ? calcFamily(carlos, nicoletta) : null
    return { label: MONTH_NAMES[i], carlos, nicoletta, family }
  })

  const annualCarlos = sumStats(rows.map(r => r.carlos))
  const annualNicoletta = sumStats(rows.map(r => r.nicoletta))
  const annualFamily = calcFamily(annualCarlos, annualNicoletta)

  const chartData = rows
    .filter(r => r.family !== null)
    .map(r => ({
      month: r.label,
      income: r.family!.income,
      expenses: r.family!.expenses,
    }))

  const colHeader = (label: string, key: string) => (
    <th key={key} className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">{label}</th>
  )

  const subHeaders = ['Income', 'Expenses', 'Savings', 'Net', 'Sav%']

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => setYear(y => y - 1)} className="px-3 py-1 border border-gray-300 rounded-lg text-sm hover:bg-gray-100">← Prev</button>
        <h2 className="text-xl font-bold text-gray-800">{year}</h2>
        <button onClick={() => setYear(y => y + 1)} className="px-3 py-1 border border-gray-300 rounded-lg text-sm hover:bg-gray-100">Next →</button>
      </div>

      {fetchError && <p className="text-red-500 text-sm">Failed to load data: {fetchError}</p>}
      {loading ? (
        <p className="text-gray-400">Loading...</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full bg-white rounded-2xl border border-gray-200 shadow-sm text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Month</th>
                  <th className="px-3 py-2 text-center text-xs font-semibold text-blue-600 uppercase" colSpan={5}>Carlos</th>
                  <th className="px-3 py-2 text-center text-xs font-semibold text-purple-600 uppercase" colSpan={5}>Nicoletta</th>
                  <th className="px-3 py-2 text-center text-xs font-semibold text-gray-700 uppercase" colSpan={5}>Family</th>
                </tr>
                <tr className="border-t border-gray-200">
                  <th />
                  {[0, 1, 2].flatMap(group =>
                    subHeaders.map(h => colHeader(h, `${group}-${h}`))
                  )}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={row.label} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-3 py-2 font-medium text-gray-700">{row.label}</td>
                    <StatCells stats={row.carlos} />
                    <StatCells stats={row.nicoletta} />
                    <StatCells stats={row.family} />
                  </tr>
                ))}
                <tr className="border-t-2 border-gray-300 bg-blue-50 font-semibold">
                  <td className="px-3 py-2 text-gray-800">Total</td>
                  <StatCells stats={annualCarlos} />
                  <StatCells stats={annualNicoletta} />
                  <StatCells stats={annualFamily} />
                </tr>
              </tbody>
            </table>
          </div>

          <YearlyChart data={chartData} />
        </>
      )}
    </div>
  )
}

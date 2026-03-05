'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { calcStats, calcFamily } from '@/lib/finance'
import type { MonthlyEntry, MonthlyStats, Person } from '@/lib/types'
import StatsCard from '@/components/StatsCard'
import EntryForm from '@/components/EntryForm'
import SavingsChart from '@/components/SavingsChart'

function monthStr(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function addMonths(dateStr: string, n: number): string {
  const [year, month] = dateStr.split('-').map(Number)
  const d = new Date(year, month - 1 + n, 1)
  return monthStr(d)
}

export default function DashboardPage() {
  const [currentMonth, setCurrentMonth] = useState(monthStr(new Date()))
  const [entries, setEntries] = useState<MonthlyEntry[]>([])
  const [editingPerson, setEditingPerson] = useState<Person | null>(null)
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)

  const fetchEntries = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const sixMonthsAgo = addMonths(currentMonth, -5)
    const { data, error: fetchErr } = await supabase
      .from('monthly_entry')
      .select('*')
      .gte('month', `${sixMonthsAgo}-01`)
      .lte('month', `${currentMonth}-01`)
      .order('month', { ascending: true })
    if (fetchErr) {
      setFetchError(fetchErr.message)
      setLoading(false)
      return
    }
    setFetchError(null)
    setEntries((data as MonthlyEntry[]) ?? [])
    setLoading(false)
  }, [currentMonth])

  useEffect(() => { fetchEntries() }, [fetchEntries])

  function getEntry(person: Person, month: string) {
    return entries.find(e => e.person === person && e.month.startsWith(month))
  }

  function getStats(person: Person, month: string): MonthlyStats | null {
    const entry = getEntry(person, month)
    return entry ? calcStats(entry) : null
  }

  const carlosStats = getStats('carlos', currentMonth)
  const nicolettaStats = getStats('nicoletta', currentMonth)
  const familyStats = carlosStats && nicolettaStats ? calcFamily(carlosStats, nicolettaStats) : null

  const chartData = Array.from({ length: 6 }, (_, i) => {
    const m = addMonths(currentMonth, i - 5)
    const c = getStats('carlos', m)
    const n = getStats('nicoletta', m)
    const fam = c && n ? calcFamily(c, n) : null
    return fam ? { month: m, savingsPct: fam.savingsPct } : null
  }).filter((d): d is { month: string; savingsPct: number } => d !== null)

  const editingEntry = editingPerson ? getEntry(editingPerson, currentMonth) : undefined

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => setCurrentMonth(m => addMonths(m, -1))}
          className="px-3 py-1 border border-gray-300 rounded-lg text-sm hover:bg-gray-100"
        >
          ← Prev
        </button>
        <h2 className="text-xl font-bold text-gray-800">{currentMonth}</h2>
        <button
          onClick={() => setCurrentMonth(m => addMonths(m, 1))}
          className="px-3 py-1 border border-gray-300 rounded-lg text-sm hover:bg-gray-100"
        >
          Next →
        </button>
      </div>

      {fetchError && <p className="text-red-500 text-sm">Failed to load data: {fetchError}</p>}
      {loading ? (
        <p className="text-gray-400">Loading...</p>
      ) : (
        <>
          <div className="flex gap-4">
            <StatsCard
              title="Carlos"
              stats={carlosStats}
              onEdit={() => setEditingPerson('carlos')}
            />
            <StatsCard
              title="Nicoletta"
              stats={nicolettaStats}
              onEdit={() => setEditingPerson('nicoletta')}
            />
          </div>

          <StatsCard title="Family Total" stats={familyStats} highlight />

          <SavingsChart data={chartData} />
        </>
      )}

      {editingPerson && (
        <EntryForm
          person={editingPerson}
          month={currentMonth}
          existing={editingEntry}
          onSaved={() => { setEditingPerson(null); fetchEntries() }}
          onCancel={() => setEditingPerson(null)}
        />
      )}
    </div>
  )
}

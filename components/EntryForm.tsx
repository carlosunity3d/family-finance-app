'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Person, MonthlyEntry } from '@/lib/types'

interface Props {
  person: Person
  month: string // "2026-03" (YYYY-MM format)
  existing?: MonthlyEntry
  onSaved: () => void
  onCancel: () => void
}

export default function EntryForm({ person, month, existing, onSaved, onCancel }: Props) {
  const monthDate = `${month}-01`
  const [income, setIncome] = useState(existing?.income.toString() ?? '')
  const [expenses, setExpenses] = useState(existing?.expenses.toString() ?? '')
  const [investments, setInvestments] = useState(existing?.investments.toString() ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')

    const supabase = createClient()
    const payload = {
      person,
      month: monthDate,
      income: parseFloat(income),
      expenses: parseFloat(expenses),
      investments: parseFloat(investments),
    }

    let result
    if (existing) {
      result = await supabase
        .from('monthly_entry')
        .update(payload)
        .eq('id', existing.id)
    } else {
      result = await supabase.from('monthly_entry').insert(payload)
    }

    if (result.error) {
      setError(result.error.message)
      setSaving(false)
    } else {
      onSaved()
    }
  }

  const personLabel = person === 'carlos' ? 'Carlos' : 'Nicoletta'

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
        <h2 className="text-lg font-semibold mb-4 text-gray-800">
          {existing ? 'Edit' : 'Add'} entry — {personLabel} ({month})
        </h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          {[
            { label: 'Income', value: income, set: setIncome, id: 'income' },
            { label: 'Expenses', value: expenses, set: setExpenses, id: 'expenses' },
            { label: 'Savings', value: investments, set: setInvestments, id: 'investments' },
          ].map(({ label, value, set, id }) => (
            <div key={label}>
              <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
              <input
                id={id}
                type="number"
                min="0"
                step="0.01"
                value={value}
                onChange={e => set(e.target.value)}
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          ))}
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 border border-gray-300 text-gray-600 py-2 rounded-lg text-sm hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

'use client'

import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts'

interface DataPoint {
  month: string
  income: number
  expenses: number
}

function fmt(v: number | undefined) {
  if (v == null) return ''
  return `€${v.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
}

export default function YearlyChart({ data }: { data: DataPoint[] }) {
  if (data.length === 0) return null
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
      <h3 className="font-semibold text-gray-800 mb-4">Family Income vs Expenses</h3>
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="month" tick={{ fontSize: 11 }} />
          <YAxis tickFormatter={fmt} tick={{ fontSize: 11 }} />
          <Tooltip formatter={fmt} />
          <Legend />
          <Bar dataKey="income" fill="#2563eb" name="Income" />
          <Bar dataKey="expenses" fill="#f87171" name="Expenses" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

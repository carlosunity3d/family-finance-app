import type { MonthlyEntry, MonthlyStats, MonthData } from './types'

interface RawEntry {
  income: number
  expenses: number
  investments: number
}

export function calcStats(entry: RawEntry): MonthlyStats {
  const investments = entry.investments
  const net = entry.income - entry.expenses
  const savingsPct = entry.income === 0 ? 0 : (net / entry.income) * 100
  return {
    income: entry.income,
    expenses: entry.expenses,
    investments,
    net,
    savingsPct,
  }
}

export function calcFamily(a: MonthlyStats, b: MonthlyStats): MonthlyStats {
  const income = a.income + b.income
  const expenses = a.expenses + b.expenses
  const investments = a.investments + b.investments
  const net = income - expenses
  const savingsPct = income === 0 ? 0 : (net / income) * 100
  return { income, expenses, investments, net, savingsPct }
}

export function toMonthData(entries: MonthlyEntry[], month: string): MonthData {
  const carlosEntry = entries.find(e => e.person === 'carlos' && e.month.startsWith(month))
  const nicolettaEntry = entries.find(e => e.person === 'nicoletta' && e.month.startsWith(month))

  const carlos = carlosEntry ? calcStats(carlosEntry) : null
  const nicoletta = nicolettaEntry ? calcStats(nicolettaEntry) : null
  const family = carlos && nicoletta ? calcFamily(carlos, nicoletta) : null

  return { month, carlos, nicoletta, family }
}

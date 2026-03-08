export type Person = 'carlos' | 'nicoletta'

export interface MonthlyEntry {
  id: string
  person: Person
  month: string // ISO date string, first of month: "2026-03-01"
  income: number
  expenses: number
  investments: number
  created_at: string
}

export interface MonthlyStats {
  income: number
  expenses: number
  savings: number
  net: number
  savingsPct: number
}

export interface MonthData {
  month: string
  carlos: MonthlyStats | null
  nicoletta: MonthlyStats | null
  family: MonthlyStats | null
}

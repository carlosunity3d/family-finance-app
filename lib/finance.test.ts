import { calcStats, calcFamily, toMonthData } from './finance'
import type { MonthlyEntry } from './types'

describe('calcStats', () => {
  it('computes savings, net, and savingsPct', () => {
    const result = calcStats({ income: 5000, expenses: 3000, investments: 500 })
    expect(result.investments).toBe(500)
    expect(result.net).toBe(2000)
    expect(result.savingsPct).toBeCloseTo(40)
  })

  it('handles zero income without crashing', () => {
    const result = calcStats({ income: 0, expenses: 0, investments: 0 })
    expect(result.savings).toBe(0)
    expect(result.net).toBe(0)
    expect(result.savingsPct).toBe(0)
  })
})

describe('calcFamily', () => {
  it('sums two stats objects', () => {
    const a = calcStats({ income: 5000, expenses: 3000, investments: 500 })
    const b = calcStats({ income: 3000, expenses: 2000, investments: 300 })
    const family = calcFamily(a, b)
    expect(family.income).toBe(8000)
    expect(family.expenses).toBe(5000)
    expect(family.investments).toBe(800)
    expect(family.net).toBe(3000)
    expect(family.savingsPct).toBeCloseTo(37.5)
  })
})

describe('toMonthData', () => {
  const entries: MonthlyEntry[] = [
    { id: '1', person: 'carlos', month: '2026-03-01', income: 5000, expenses: 3000, investments: 500, created_at: '' },
    { id: '2', person: 'nicoletta', month: '2026-03-01', income: 3000, expenses: 2000, investments: 300, created_at: '' },
  ]

  it('returns stats for both people and family', () => {
    const result = toMonthData(entries, '2026-03')
    expect(result.carlos).not.toBeNull()
    expect(result.nicoletta).not.toBeNull()
    expect(result.family).not.toBeNull()
    expect(result.family!.income).toBe(8000)
  })

  it('returns null for missing person', () => {
    const result = toMonthData([entries[0]], '2026-03')
    expect(result.nicoletta).toBeNull()
    expect(result.family).toBeNull()
  })
})

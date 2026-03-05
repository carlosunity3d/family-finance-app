# Family Finance App Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a Next.js web app for Carlos and Nicoletta to track monthly income, expenses, investments, and savings — replacing their Google Sheets.

**Architecture:** Next.js App Router with Supabase for auth and Postgres database. All financial calculations (savings, savings %) are derived client-side. Three pages: Login, Dashboard (monthly view), and Yearly Summary.

**Tech Stack:** Next.js 14 (App Router), Supabase JS client, Tailwind CSS, Recharts, TypeScript

---

## Prerequisites (manual steps before starting)

1. Create a Supabase project at https://supabase.com — free tier is sufficient
2. Copy your project URL and anon key from Project Settings → API
3. Create a Vercel account at https://vercel.com (for deployment later)

---

### Task 1: Scaffold the Next.js project

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`, `postcss.config.mjs`
- Create: `.env.local` (gitignored)
- Create: `.gitignore`

**Step 1: Create the Next.js app**

Run from `family_finance_app/` directory:

```bash
npx create-next-app@latest . --typescript --tailwind --app --no-src-dir --import-alias "@/*" --eslint
```

When prompted, accept all defaults.

**Step 2: Install additional dependencies**

```bash
npm install @supabase/supabase-js @supabase/ssr recharts
npm install -D @types/node
```

**Step 3: Create `.env.local`**

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

Replace the values with your actual Supabase credentials.

**Step 4: Verify the dev server starts**

```bash
npm run dev
```

Expected: Server running at http://localhost:3000 with default Next.js page.

**Step 5: Commit**

```bash
git init
git add -A
git commit -m "feat: scaffold Next.js app with Tailwind and Supabase"
```

---

### Task 2: Set up Supabase database schema

**Files:**
- Create: `supabase/schema.sql`

**Step 1: Create the SQL schema file**

Create `supabase/schema.sql`:

```sql
-- Enable UUID extension
create extension if not exists "pgcrypto";

-- Monthly entries table
create table if not exists monthly_entry (
  id          uuid primary key default gen_random_uuid(),
  person      text not null check (person in ('carlos', 'nicoletta')),
  month       date not null,
  income      numeric not null check (income >= 0),
  expenses    numeric not null check (expenses >= 0),
  investments numeric not null check (investments >= 0),
  created_at  timestamptz default now(),
  unique (person, month)
);

-- Row Level Security: only authenticated users can read/write
alter table monthly_entry enable row level security;

create policy "Authenticated users can select"
  on monthly_entry for select
  to authenticated
  using (true);

create policy "Authenticated users can insert"
  on monthly_entry for insert
  to authenticated
  with check (true);

create policy "Authenticated users can update"
  on monthly_entry for update
  to authenticated
  using (true);
```

**Step 2: Run the schema in Supabase**

Go to your Supabase project → SQL Editor → paste the contents of `supabase/schema.sql` → click Run.

Expected: No errors, table `monthly_entry` appears in Table Editor.

**Step 3: Create the family user account in Supabase**

Go to Supabase → Authentication → Users → Add user.
- Email: your family email (e.g. family@example.com)
- Password: your chosen shared password
- Click "Create user"

**Step 4: Commit**

```bash
git add supabase/schema.sql
git commit -m "feat: add Supabase schema for monthly_entry"
```

---

### Task 3: Set up Supabase client utilities

**Files:**
- Create: `lib/supabase/client.ts`
- Create: `lib/supabase/server.ts`
- Create: `middleware.ts`

**Step 1: Create the browser Supabase client**

Create `lib/supabase/client.ts`:

```typescript
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

**Step 2: Create the server Supabase client**

Create `lib/supabase/server.ts`:

```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Called from Server Component — can be ignored
          }
        },
      },
    }
  )
}
```

**Step 3: Create the auth middleware**

Create `middleware.ts` at the project root:

```typescript
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const isLoginPage = request.nextUrl.pathname === '/login'

  if (!user && !isLoginPage) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (user && isLoginPage) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
```

**Step 4: Commit**

```bash
git add lib/ middleware.ts
git commit -m "feat: add Supabase client utilities and auth middleware"
```

---

### Task 4: Define shared types and finance calculation utilities

**Files:**
- Create: `lib/types.ts`
- Create: `lib/finance.ts`
- Create: `lib/finance.test.ts`

**Step 1: Create types**

Create `lib/types.ts`:

```typescript
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
  investments: number
  savings: number
  savingsPct: number
}

export interface MonthData {
  month: string
  carlos: MonthlyStats | null
  nicoletta: MonthlyStats | null
  family: MonthlyStats | null
}
```

**Step 2: Write failing tests**

Create `lib/finance.test.ts`:

```typescript
import { calcStats, calcFamily, toMonthData } from './finance'
import type { MonthlyEntry } from './types'

describe('calcStats', () => {
  it('computes savings and savingsPct', () => {
    const result = calcStats({ income: 5000, expenses: 3000, investments: 500 })
    expect(result.savings).toBe(2000)
    expect(result.savingsPct).toBeCloseTo(40)
  })

  it('handles zero income without crashing', () => {
    const result = calcStats({ income: 0, expenses: 0, investments: 0 })
    expect(result.savings).toBe(0)
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
    expect(family.savings).toBe(3000)
    expect(family.savingsPct).toBeCloseTo(37.5)
  })
})
```

**Step 3: Run tests to verify they fail**

```bash
npm install -D jest @types/jest ts-jest
npx jest lib/finance.test.ts
```

Expected: FAIL — `calcStats` not found.

**Step 4: Implement the finance utilities**

Create `lib/finance.ts`:

```typescript
import type { MonthlyEntry, MonthlyStats, MonthData, Person } from './types'

interface RawEntry {
  income: number
  expenses: number
  investments: number
}

export function calcStats(entry: RawEntry): MonthlyStats {
  const savings = entry.income - entry.expenses
  const savingsPct = entry.income === 0 ? 0 : (savings / entry.income) * 100
  return {
    income: entry.income,
    expenses: entry.expenses,
    investments: entry.investments,
    savings,
    savingsPct,
  }
}

export function calcFamily(a: MonthlyStats, b: MonthlyStats): MonthlyStats {
  const income = a.income + b.income
  const expenses = a.expenses + b.expenses
  const investments = a.investments + b.investments
  const savings = a.savings + b.savings
  const savingsPct = income === 0 ? 0 : (savings / income) * 100
  return { income, expenses, investments, savings, savingsPct }
}

export function toMonthData(entries: MonthlyEntry[], month: string): MonthData {
  const carlosEntry = entries.find(e => e.person === 'carlos' && e.month.startsWith(month))
  const nicolettaEntry = entries.find(e => e.person === 'nicoletta' && e.month.startsWith(month))

  const carlos = carlosEntry ? calcStats(carlosEntry) : null
  const nicoletta = nicolettaEntry ? calcStats(nicolettaEntry) : null
  const family = carlos && nicoletta ? calcFamily(carlos, nicoletta) : null

  return { month, carlos, nicoletta, family }
}
```

**Step 5: Configure Jest for TypeScript**

Add to `package.json` (in the `scripts` section, add `"test": "jest"`, and add a `jest` config):

```json
"scripts": {
  "test": "jest"
},
"jest": {
  "preset": "ts-jest",
  "testEnvironment": "node"
}
```

**Step 6: Run tests to verify they pass**

```bash
npx jest lib/finance.test.ts
```

Expected: PASS — 3 tests pass.

**Step 7: Commit**

```bash
git add lib/types.ts lib/finance.ts lib/finance.test.ts package.json
git commit -m "feat: add shared types and finance calculation utilities with tests"
```

---

### Task 5: Build the Login page

**Files:**
- Create: `app/login/page.tsx`
- Modify: `app/globals.css` (keep Tailwind directives, remove default styles)
- Modify: `app/layout.tsx`

**Step 1: Clean up default styles**

Replace the contents of `app/globals.css` with:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

**Step 2: Update the root layout**

Replace `app/layout.tsx` with:

```typescript
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Family Finance',
  description: 'Carlos & Nicoletta family finance tracker',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-gray-50 min-h-screen`}>
        {children}
      </body>
    </html>
  )
}
```

**Step 3: Create the Login page**

Create `app/login/page.tsx`:

```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError('Invalid email or password.')
      setLoading(false)
    } else {
      router.push('/')
      router.refresh()
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-md p-8 w-full max-w-sm">
        <h1 className="text-2xl font-bold text-center mb-6 text-gray-800">Family Finance</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition"
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}
```

**Step 4: Verify login works**

```bash
npm run dev
```

Navigate to http://localhost:3000. You should be redirected to `/login`. Enter the credentials you created in Supabase. You should land on the home page (currently blank).

**Step 5: Commit**

```bash
git add app/login/page.tsx app/globals.css app/layout.tsx
git commit -m "feat: add login page with Supabase auth"
```

---

### Task 6: Build the shared Navbar and layout shell

**Files:**
- Create: `components/Navbar.tsx`
- Create: `app/(app)/layout.tsx`

**Step 1: Create the Navbar component**

Create `components/Navbar.tsx`:

```typescript
'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function Navbar() {
  const pathname = usePathname()
  const router = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const linkClass = (href: string) =>
    `text-sm font-medium px-3 py-1 rounded-lg transition ${
      pathname === href
        ? 'bg-blue-100 text-blue-700'
        : 'text-gray-600 hover:text-gray-900'
    }`

  return (
    <nav className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
      <span className="font-bold text-gray-800 text-lg">Family Finance</span>
      <div className="flex items-center gap-2">
        <Link href="/" className={linkClass('/')}>Dashboard</Link>
        <Link href="/yearly" className={linkClass('/yearly')}>Yearly Summary</Link>
        <button
          onClick={handleLogout}
          className="text-sm font-medium text-red-500 hover:text-red-700 ml-4"
        >
          Logout
        </button>
      </div>
    </nav>
  )
}
```

**Step 2: Create the authenticated app layout**

Create `app/(app)/layout.tsx`:

```typescript
import Navbar from '@/components/Navbar'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <Navbar />
      <main className="max-w-5xl mx-auto px-4 py-8">{children}</main>
    </div>
  )
}
```

**Step 3: Move the default home page into the (app) group**

Move (or recreate) `app/page.tsx` to `app/(app)/page.tsx` with a placeholder:

```typescript
export default function DashboardPage() {
  return <div className="text-gray-500">Dashboard coming soon.</div>
}
```

Also delete the original `app/page.tsx` if it still exists.

**Step 4: Verify layout renders**

```bash
npm run dev
```

After logging in, you should see the navbar with Dashboard, Yearly Summary, and Logout links.

**Step 5: Commit**

```bash
git add components/Navbar.tsx app/\(app\)/layout.tsx app/\(app\)/page.tsx
git commit -m "feat: add navbar and authenticated app layout shell"
```

---

### Task 7: Build the data entry form (modal/inline)

**Files:**
- Create: `components/EntryForm.tsx`

**Step 1: Create the entry form component**

Create `components/EntryForm.tsx`:

```typescript
'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Person, MonthlyEntry } from '@/lib/types'

interface Props {
  person: Person
  month: string // "2026-03"
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
            { label: 'Income', value: income, set: setIncome },
            { label: 'Expenses', value: expenses, set: setExpenses },
            { label: 'Investments', value: investments, set: setInvestments },
          ].map(({ label, value, set }) => (
            <div key={label}>
              <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
              <input
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
```

**Step 2: Commit**

```bash
git add components/EntryForm.tsx
git commit -m "feat: add data entry form modal component"
```

---

### Task 8: Build the StatsCard component

**Files:**
- Create: `components/StatsCard.tsx`

**Step 1: Create the stats card**

Create `components/StatsCard.tsx`:

```typescript
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
```

**Step 2: Commit**

```bash
git add components/StatsCard.tsx
git commit -m "feat: add StatsCard component"
```

---

### Task 9: Build the Dashboard page

**Files:**
- Modify: `app/(app)/page.tsx`
- Create: `components/SavingsChart.tsx`

**Step 1: Create the savings chart component**

Create `components/SavingsChart.tsx`:

```typescript
'use client'

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

interface DataPoint {
  month: string
  savingsPct: number
}

export default function SavingsChart({ data }: { data: DataPoint[] }) {
  if (data.length === 0) return null
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
      <h3 className="font-semibold text-gray-800 mb-4">Family Savings % — Last 6 Months</h3>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="month" tick={{ fontSize: 12 }} />
          <YAxis unit="%" tick={{ fontSize: 12 }} domain={[0, 100]} />
          <Tooltip formatter={(v: number) => `${v.toFixed(1)}%`} />
          <Line type="monotone" dataKey="savingsPct" stroke="#2563eb" strokeWidth={2} dot />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
```

**Step 2: Build the Dashboard page**

Replace `app/(app)/page.tsx` with:

```typescript
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

  const fetchEntries = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    // Fetch current month + last 5 months for the chart (6 total)
    const sixMonthsAgo = addMonths(currentMonth, -5)
    const { data } = await supabase
      .from('monthly_entry')
      .select('*')
      .gte('month', `${sixMonthsAgo}-01`)
      .lte('month', `${currentMonth}-01`)
      .order('month', { ascending: true })
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

  // Build chart data for last 6 months
  const chartData = Array.from({ length: 6 }, (_, i) => {
    const m = addMonths(currentMonth, i - 5)
    const c = getStats('carlos', m)
    const n = getStats('nicoletta', m)
    const fam = c && n ? calcFamily(c, n) : null
    return { month: m, savingsPct: fam?.savingsPct ?? 0 }
  }).filter(d => d.savingsPct > 0)

  const editingEntry = editingPerson ? getEntry(editingPerson, currentMonth) : undefined

  return (
    <div className="space-y-6">
      {/* Month selector */}
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

      {loading ? (
        <p className="text-gray-400">Loading...</p>
      ) : (
        <>
          {/* Person cards */}
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

          {/* Family totals */}
          <StatsCard title="Family Total" stats={familyStats} highlight />

          {/* Chart */}
          <SavingsChart data={chartData} />
        </>
      )}

      {/* Entry form modal */}
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
```

**Step 3: Verify the dashboard works**

```bash
npm run dev
```

- Log in → you should see the dashboard with month navigation
- Click "+ Add" on Carlos → fill in income/expenses/investments → Save
- Entry should appear in Carlos's card
- Click "+ Add" on Nicoletta → fill in data → Save
- Family Total should populate and the chart should appear

**Step 4: Commit**

```bash
git add app/\(app\)/page.tsx components/SavingsChart.tsx
git commit -m "feat: build dashboard page with month navigation, stats cards, and savings chart"
```

---

### Task 10: Build the Yearly Summary page

**Files:**
- Create: `app/(app)/yearly/page.tsx`
- Create: `components/YearlyChart.tsx`

**Step 1: Create the yearly income vs expenses chart**

Create `components/YearlyChart.tsx`:

```typescript
'use client'

import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts'

interface DataPoint {
  month: string
  income: number
  expenses: number
}

function fmt(v: number) {
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
```

**Step 2: Create the Yearly Summary page**

Create `app/(app)/yearly/page.tsx`:

```typescript
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
  const investments = valid.reduce((s, v) => s + v.investments, 0)
  const savings = income - expenses
  const savingsPct = income === 0 ? 0 : (savings / income) * 100
  return { income, expenses, investments, savings, savingsPct }
}

export default function YearlySummaryPage() {
  const [year, setYear] = useState(new Date().getFullYear())
  const [entries, setEntries] = useState<MonthlyEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetch() {
      setLoading(true)
      const supabase = createClient()
      const { data } = await supabase
        .from('monthly_entry')
        .select('*')
        .gte('month', `${year}-01-01`)
        .lte('month', `${year}-12-31`)
        .order('month', { ascending: true })
      setEntries((data as MonthlyEntry[]) ?? [])
      setLoading(false)
    }
    fetch()
  }, [year])

  function getStats(person: 'carlos' | 'nicoletta', month: string) {
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
    .filter(r => r.family)
    .map((r, i) => ({
      month: r.label,
      income: r.family!.income,
      expenses: r.family!.expenses,
    }))

  function StatCells({ stats }: { stats: MonthlyStats | null }) {
    if (!stats) return <><td className="px-3 py-2 text-center text-gray-300" colSpan={5}>—</td></>
    return (
      <>
        <td className="px-3 py-2 text-right text-sm">{fmt(stats.income)}</td>
        <td className="px-3 py-2 text-right text-sm">{fmt(stats.expenses)}</td>
        <td className="px-3 py-2 text-right text-sm">{fmt(stats.investments)}</td>
        <td className="px-3 py-2 text-right text-sm">{fmt(stats.savings)}</td>
        <td className="px-3 py-2 text-right text-sm">{pct(stats.savingsPct)}</td>
      </>
    )
  }

  const colHeader = (label: string) => (
    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">{label}</th>
  )

  return (
    <div className="space-y-6">
      {/* Year selector */}
      <div className="flex items-center gap-4">
        <button onClick={() => setYear(y => y - 1)} className="px-3 py-1 border border-gray-300 rounded-lg text-sm hover:bg-gray-100">← Prev</button>
        <h2 className="text-xl font-bold text-gray-800">{year}</h2>
        <button onClick={() => setYear(y => y + 1)} className="px-3 py-1 border border-gray-300 rounded-lg text-sm hover:bg-gray-100">Next →</button>
      </div>

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
                  {['Income','Expenses','Inv.','Savings','Sav%'].flatMap(h => [colHeader(h), colHeader(h), colHeader(h)])}
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
                {/* Annual totals */}
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
```

**Step 3: Fix the table header (3 groups × 5 columns)**

The header row with 15 column headers needs to be written correctly. Replace the second `<tr>` in `<thead>` with:

```typescript
<tr className="border-t border-gray-200">
  <th />
  {[0,1,2].flatMap(() =>
    ['Income','Expenses','Inv.','Savings','Sav%'].map(h => colHeader(h))
  )}
</tr>
```

**Step 4: Verify the yearly summary page works**

```bash
npm run dev
```

Navigate to http://localhost:3000/yearly. You should see:
- Year navigation (← / →)
- A table with months as rows and Carlos/Nicoletta/Family columns
- Annual totals row at the bottom
- Bar chart of income vs expenses

**Step 5: Commit**

```bash
git add app/\(app\)/yearly/page.tsx components/YearlyChart.tsx
git commit -m "feat: add yearly summary page with monthly table and income vs expenses chart"
```

---

### Task 11: Deploy to Vercel

**Step 1: Push to GitHub**

```bash
git remote add origin https://github.com/YOUR_USERNAME/family-finance-app.git
git branch -M main
git push -u origin main
```

**Step 2: Import to Vercel**

1. Go to https://vercel.com → New Project
2. Import your GitHub repository
3. In "Environment Variables", add:
   - `NEXT_PUBLIC_SUPABASE_URL` = your Supabase project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = your Supabase anon key
4. Click Deploy

**Step 3: Verify the deployed app**

- Open the Vercel URL
- Log in with your family credentials
- Add data for the current month for both Carlos and Nicoletta
- Verify Dashboard and Yearly Summary both work

**Step 4: Share the URL with Nicoletta**

Done — the app is live and accessible from any browser.

---

## Summary of Files Created

```
family_finance_app/
├── app/
│   ├── (app)/
│   │   ├── layout.tsx          # Authenticated layout with Navbar
│   │   ├── page.tsx            # Dashboard
│   │   └── yearly/
│   │       └── page.tsx        # Yearly Summary
│   ├── login/
│   │   └── page.tsx            # Login page
│   ├── globals.css
│   └── layout.tsx              # Root layout
├── components/
│   ├── EntryForm.tsx           # Data entry modal
│   ├── Navbar.tsx              # Top navigation
│   ├── SavingsChart.tsx        # 6-month savings % line chart
│   ├── StatsCard.tsx           # Per-person/family stats card
│   └── YearlyChart.tsx         # Yearly income vs expenses bar chart
├── lib/
│   ├── finance.ts              # Calculation utilities
│   ├── finance.test.ts         # Unit tests
│   ├── types.ts                # Shared TypeScript types
│   └── supabase/
│       ├── client.ts           # Browser Supabase client
│       └── server.ts           # Server Supabase client
├── supabase/
│   └── schema.sql              # Database schema
├── middleware.ts               # Auth redirect middleware
└── .env.local                  # Supabase credentials (gitignored)
```

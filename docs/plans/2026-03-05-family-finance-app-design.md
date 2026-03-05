# Family Finance App — Design Document

**Date:** 2026-03-05
**Status:** Approved

## Overview

A web app for Carlos and Nicoletta to track monthly income, expenses, investments, and savings — replacing their Google Sheets setup. Both users share a single family account and access the app from the browser.

## Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js (React) |
| Styling | Tailwind CSS |
| Charts | Recharts |
| Backend / DB | Supabase (Postgres + Auth) |
| Hosting | Vercel (frontend) + Supabase (DB) |

Both Vercel and Supabase have free tiers sufficient for this use case.

## Auth

Single shared family account (one email + password). Supabase Auth handles sessions. Users log in once and stay logged in.

## Data Model

One `monthly_entry` record per person per month.

```sql
monthly_entry (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person      text NOT NULL,        -- 'carlos' or 'nicoletta'
  month       date NOT NULL,        -- first day of month, e.g. 2026-03-01
  income      numeric NOT NULL,
  expenses    numeric NOT NULL,
  investments numeric NOT NULL,     -- subset of expenses going to investments
  created_at  timestamptz DEFAULT now()
)
```

**Calculated fields** (derived in the app, not stored):
- `savings = income - expenses`
- `savings_pct = (savings / income) * 100`
- Family totals = sum of Carlos + Nicoletta for the same month

## Pages

### 1. Login
Simple email/password form. Redirects to Dashboard on success.

### 2. Dashboard (Monthly View)
Default page after login.
- Month selector (navigate back/forward by month)
- Two side-by-side cards: **Carlos** | **Nicoletta**
  - Each card shows: Income, Expenses, Investments, Savings, Savings %
- Family totals row: combined Income, Expenses, Investments, Savings, Savings %
- Line/bar chart: last 6 months of family savings %
- "Edit" button to enter or update the current month's data for each person

### 3. Yearly Summary
Accessible from the top navigation.
- Year selector
- Table: one row per month with all metrics for Carlos, Nicoletta, and family totals
- Annual totals row at the bottom
- Chart: monthly income vs. expenses for the year (family combined)

## Navigation

Top navbar with:
- Dashboard
- Yearly Summary
- Logout button

## Constraints & Decisions

- No per-category expense tracking — only totals per person
- No individual logins — single shared password
- Data entry is monthly (not daily/weekly)
- Investments field is a portion of expenses (not separate from them)

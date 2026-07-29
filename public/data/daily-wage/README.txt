Daily Wage Earner — Synthetic Hackathon Dataset (anonymous)
=============================================================
Theme: budgeting / cash-flow for workers who earn day-to-day (July 29 ZayZoon prompt).
All IDs and people are fake. Seeded generator (seed=20260729). Currency: CAD.
Window: 2026-04-01 to 2026-6-30. Geography: Alberta-weighted (Calgary-heavy).

Tables (join on worker_id):
  workers.csv                 Profile, occupation, volatility, banking access, rent burden
  daily_earnings.csv          Per-shift gross/tips/deductions/net + same-day pay flag
  recurring_obligations.csv   Rent, phone, utilities, childcare, debt, subscriptions
  transactions.csv            Credits (pay) + debits with running_balance_cad
  earned_wage_advances.csv    On-demand advances against earned wages (fees, reasons)
  weekly_cashflow_summary.csv Ready-made weekly aggregates + buffer_days_estimate

Suggested build ideas:
  - Predict days until cash-out / buffer days
  - Bill timing vs irregular pay calendar
  - Advance need scoring without encouraging overuse
  - Essential vs discretionary spend coaching
  - Same-day pay vs lagged payroll cash-gap alerts

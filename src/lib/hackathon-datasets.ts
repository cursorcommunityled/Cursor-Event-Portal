export type HackathonDataset = {
  id: string;
  title: string;
  description: string;
  filename: string;
  /** Public URL for CSV download / preview. */
  path: string;
  /** Public URL for XLSX download. */
  xlsxPath: string;
  rows: number;
  columns: string[];
};

/** Hosted datasets for the hackathon Data tab. Files live under /public/data. */
export const HACKATHON_DATASETS: HackathonDataset[] = [
  {
    id: "daily-wage-workers",
    title: "Workers (profiles)",
    description:
      "220 anonymous Alberta-weighted day-wage workers: occupation, pay type, income volatility, banking access, rent burden, dependents.",
    filename: "workers",
    path: "/data/daily-wage/workers.csv",
    xlsxPath: "/data/daily-wage/workers.xlsx",
    rows: 220,
    columns: [
      "worker_id",
      "city",
      "province",
      "occupation",
      "pay_type",
      "typical_daily_net_cad",
      "income_volatility",
      "tip_share",
      "household_size",
      "dependents",
      "has_bank_account",
      "uses_prepaid_card",
      "primary_employer_id",
      "tenure_months",
      "has_side_gig",
      "commute_mode",
      "rent_burden_band",
    ],
  },
  {
    id: "daily-wage-earnings",
    title: "Daily earnings (shifts)",
    description:
      "Per-shift gross, tips, deductions, and net pay with same-day vs lagged payout — the irregular income engine for cash-gap products.",
    filename: "daily_earnings",
    path: "/data/daily-wage/daily_earnings.csv",
    xlsxPath: "/data/daily-wage/daily_earnings.xlsx",
    rows: 12204,
    columns: [
      "earnings_id",
      "worker_id",
      "work_date",
      "employer_id",
      "shift_type",
      "hours_worked",
      "gross_pay_cad",
      "tips_cad",
      "deductions_cad",
      "net_pay_cad",
      "paid_same_day",
      "pay_method",
    ],
  },
  {
    id: "daily-wage-obligations",
    title: "Recurring obligations",
    description:
      "Rent, phone, utilities, childcare, debt, and subscriptions with due days that often misalign with daily pay.",
    filename: "recurring_obligations",
    path: "/data/daily-wage/recurring_obligations.csv",
    xlsxPath: "/data/daily-wage/recurring_obligations.xlsx",
    rows: 849,
    columns: [
      "obligation_id",
      "worker_id",
      "name",
      "category",
      "amount_cad",
      "frequency",
      "due_day_of_month",
      "autopay",
      "essential",
    ],
  },
  {
    id: "daily-wage-transactions",
    title: "Transactions (ledger)",
    description:
      "Credits and debits with channel, essential flag, and running balance — rebuild day-to-day cash position beyond money in / out.",
    filename: "transactions",
    path: "/data/daily-wage/transactions.csv",
    xlsxPath: "/data/daily-wage/transactions.xlsx",
    rows: 31726,
    columns: [
      "txn_id",
      "worker_id",
      "txn_ts",
      "direction",
      "amount_cad",
      "category",
      "merchant_type",
      "channel",
      "is_essential",
      "running_balance_cad",
      "notes",
    ],
  },
  {
    id: "daily-wage-advances",
    title: "Earned wage advances",
    description:
      "On-demand advances against earned wages: amount, fee, reason, repayment status — useful for need-scoring and fee-aware coaching.",
    filename: "earned_wage_advances",
    path: "/data/daily-wage/earned_wage_advances.csv",
    xlsxPath: "/data/daily-wage/earned_wage_advances.xlsx",
    rows: 535,
    columns: [
      "advance_id",
      "worker_id",
      "requested_at",
      "amount_cad",
      "fee_cad",
      "status",
      "repaid_at",
      "repayment_source",
      "reason_code",
    ],
  },
  {
    id: "daily-wage-weekly",
    title: "Weekly cashflow summary",
    description:
      "Pre-aggregated weekly income, essential spend, advances, ending balance, and buffer-day estimates for faster prototyping.",
    filename: "weekly_cashflow_summary",
    path: "/data/daily-wage/weekly_cashflow_summary.csv",
    xlsxPath: "/data/daily-wage/weekly_cashflow_summary.xlsx",
    rows: 3072,
    columns: [
      "worker_id",
      "week_start",
      "income_cad",
      "expense_cad",
      "essential_expense_cad",
      "net_cashflow_cad",
      "advances_count",
      "advances_amount_cad",
      "advance_fees_cad",
      "ending_balance_cad",
      "buffer_days_estimate",
      "negative_balance_flag",
    ],
  },
];

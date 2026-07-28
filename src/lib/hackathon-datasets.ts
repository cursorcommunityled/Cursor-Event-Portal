export type HackathonDataset = {
  id: string;
  title: string;
  description: string;
  filename: string;
  path: string;
  rows: number;
  columns: string[];
};

/** Anonymized financial datasets for hackathon builds. Source files live in /public/data. */
export const HACKATHON_DATASETS: HackathonDataset[] = [
  {
    id: "employees",
    title: "Employees",
    description:
      "Anonymized workforce roster with department, pay rate, tenure, and a synthetic turnover risk score.",
    filename: "employees",
    path: "/data/employees.csv",
    rows: 25,
    columns: [
      "employee_id",
      "department",
      "job_title",
      "employment_type",
      "hire_date",
      "hourly_rate_cad",
      "weekly_hours",
      "city",
      "province",
      "tenure_months",
      "risk_score",
    ],
  },
  {
    id: "earned-wage-access",
    title: "Earned Wage Access",
    description:
      "Synthetic on-demand pay requests with amounts, fees, destinations, and approval outcomes.",
    filename: "earned_wage_access",
    path: "/data/earned_wage_access.csv",
    rows: 40,
    columns: [
      "advance_id",
      "employee_id",
      "request_date",
      "request_time",
      "amount_cad",
      "available_balance_cad",
      "fee_cad",
      "destination",
      "status",
      "approved_minutes",
      "pay_period_end",
    ],
  },
  {
    id: "transactions",
    title: "Bank Transactions",
    description:
      "Anonymized debit/credit activity across housing, groceries, payroll, and wage advances.",
    filename: "transactions",
    path: "/data/transactions.csv",
    rows: 50,
    columns: [
      "transaction_id",
      "employee_id",
      "posted_date",
      "category",
      "merchant",
      "amount_cad",
      "direction",
      "channel",
      "balance_after_cad",
    ],
  },
  {
    id: "company-metrics",
    title: "Company Metrics",
    description:
      "Monthly company-level usage metrics for earned wage access adoption and volume.",
    filename: "company_metrics",
    path: "/data/company_metrics.csv",
    rows: 7,
    columns: [
      "metric_date",
      "active_employees",
      "ewa_users",
      "ewa_requests",
      "ewa_volume_cad",
      "avg_advance_cad",
      "completion_rate",
      "avg_approval_minutes",
      "turnover_risk_index",
      "payroll_cycle",
    ],
  },
];

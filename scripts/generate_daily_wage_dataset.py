"""
Generate anonymous synthetic datasets for the July 29 hackathon:
daily wage-earner budgeting / cash-flow beyond money-in money-out.

Deterministic (seeded). Outputs CSV files under public/data/daily-wage/.
"""

from __future__ import annotations

import csv
import random
from datetime import date, datetime, timedelta
from pathlib import Path

SEED = 20260729
RNG = random.Random(SEED)

OUT = Path(__file__).resolve().parents[1] / "public" / "data" / "daily-wage"
START = date(2026, 4, 1)
END = date(2026, 6, 30)
N_WORKERS = 220

CITIES = [
    ("Calgary", "AB", 0.55),
    ("Edmonton", "AB", 0.18),
    ("Red Deer", "AB", 0.07),
    ("Lethbridge", "AB", 0.05),
    ("Airdrie", "AB", 0.05),
    ("Okotoks", "AB", 0.03),
    ("Cochrane", "AB", 0.03),
    ("Medicine Hat", "AB", 0.04),
]

OCCUPATIONS = [
    # (label, pay_type, daily_net_low, daily_net_high, volatility, tip_rate)
    ("Warehouse associate", "hourly", 140, 210, 0.25, 0.0),
    ("Retail associate", "hourly", 120, 180, 0.30, 0.05),
    ("Food service / kitchen", "hourly", 110, 170, 0.35, 0.20),
    ("Server / bartender", "hourly", 90, 160, 0.45, 0.55),
    ("Gig delivery driver", "gig", 80, 220, 0.55, 0.15),
    ("Rideshare driver", "gig", 90, 240, 0.50, 0.10),
    ("Construction labourer", "daily", 180, 280, 0.40, 0.0),
    ("Landscaping / grounds", "daily", 150, 230, 0.45, 0.0),
    ("Cleaning / janitorial", "hourly", 120, 190, 0.28, 0.0),
    ("Care aide / support worker", "hourly", 150, 230, 0.22, 0.0),
    ("Hotel housekeeping", "hourly", 115, 175, 0.30, 0.02),
    ("Event / venue staff", "hourly", 100, 200, 0.50, 0.10),
    ("Security guard", "hourly", 140, 210, 0.20, 0.0),
    ("Moving helper", "daily", 160, 260, 0.48, 0.0),
]

EMPLOYERS = [f"EMP-{i:03d}" for i in range(1, 41)]

EXPENSE_CATALOG = [
    # (category, merchant_type, min, max, essential, weight, cash_bias)
    ("housing", "rent_or_mortgage", 650, 1650, True, 0.0, 0.05),  # handled separately monthly
    ("groceries", "grocery", 12, 95, True, 14, 0.25),
    ("food_out", "restaurant_cafe", 8, 45, False, 10, 0.35),
    ("transit", "transit_fuel", 3, 70, True, 12, 0.15),
    ("utilities", "utility", 40, 180, True, 0.0, 0.0),
    ("phone", "telecom", 35, 95, True, 0.0, 0.0),
    ("childcare", "childcare", 20, 80, True, 4, 0.10),
    ("healthcare", "pharmacy_clinic", 8, 120, True, 2, 0.20),
    ("remittance", "money_transfer", 40, 300, True, 3, 0.40),
    ("personal_care", "pharmacy_retail", 6, 45, False, 3, 0.30),
    ("entertainment", "streaming_leisure", 5, 60, False, 4, 0.20),
    ("clothing", "retail", 15, 120, False, 1.5, 0.25),
    ("debt_payment", "loan_credit", 25, 200, True, 3, 0.05),
    ("cash_withdrawal", "atm", 20, 120, False, 4, 1.0),
    ("misc", "general", 5, 55, False, 5, 0.30),
]

CHANNELS = ["debit", "cash", "etransfer", "prepaid"]


def pick_city():
    choices = [(c, p) for c, p, _ in CITIES]
    weights = [w for *_, w in CITIES]
    idx = RNG.choices(range(len(choices)), weights=weights, k=1)[0]
    return choices[idx]


def daterange(start: date, end: date):
    d = start
    while d <= end:
        yield d
        d += timedelta(days=1)


def write_csv(path: Path, fieldnames: list[str], rows: list[dict]):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        w.writerows(rows)


def gen_workers():
    rows = []
    for i in range(1, N_WORKERS + 1):
        occ = RNG.choice(OCCUPATIONS)
        city, province = pick_city()
        household = RNG.choices([1, 2, 3, 4, 5, 6], weights=[22, 28, 22, 15, 9, 4], k=1)[0]
        dependents = max(0, household - RNG.choice([1, 1, 2]))
        banked = RNG.random() > 0.18
        typical = round(RNG.uniform(occ[2], occ[3]), 2)
        rows.append(
            {
                "worker_id": f"W-{i:04d}",
                "city": city,
                "province": province,
                "occupation": occ[0],
                "pay_type": occ[1],
                "typical_daily_net_cad": f"{typical:.2f}",
                "income_volatility": f"{occ[4]:.2f}",
                "tip_share": f"{occ[5]:.2f}",
                "household_size": household,
                "dependents": dependents,
                "has_bank_account": int(banked),
                "uses_prepaid_card": int((not banked) or RNG.random() < 0.22),
                "primary_employer_id": RNG.choice(EMPLOYERS),
                "tenure_months": RNG.randint(1, 84),
                "has_side_gig": int(RNG.random() < 0.28),
                "commute_mode": RNG.choice(["transit", "car", "walk_bike", "rideshare"]),
                "rent_burden_band": RNG.choice(["low", "moderate", "high", "severe"]),
            }
        )
    return rows


def work_probability(d: date, volatility: float, pay_type: str) -> float:
    # Weekends thinner for some roles; gig more weekend-heavy
    wd = d.weekday()
    base = 0.78 - volatility * 0.15
    if pay_type == "gig":
        base = 0.55 + (0.15 if wd >= 5 else 0.0)
    elif wd >= 5:
        base *= 0.45
    return max(0.15, min(0.95, base))


def gen_earnings(workers):
    rows = []
    eid = 1
    for w in workers:
        volatility = float(w["income_volatility"])
        tip_share = float(w["tip_share"])
        typical = float(w["typical_daily_net_cad"])
        pay_type = w["pay_type"]
        for d in daterange(START, END):
            # outdoor / construction skip more rain-proxy days midweek randomly
            p = work_probability(d, volatility, pay_type)
            if "Construction" in w["occupation"] or "Landscaping" in w["occupation"]:
                if d.month == 4:
                    p *= 0.75
                if d.month >= 5:
                    p = min(0.92, p + 0.08)
            if RNG.random() > p:
                continue

            hours = round(RNG.uniform(4.0, 10.5), 1)
            if pay_type == "daily":
                hours = round(RNG.choice([8.0, 8.5, 9.0, 10.0]), 1)
            day_factor = RNG.gauss(1.0, volatility * 0.35)
            day_factor = max(0.45, min(1.65, day_factor))
            gross = round(typical * day_factor * (hours / 8.0) * 1.12, 2)
            tips = round(gross * tip_share * RNG.uniform(0.4, 1.3), 2) if tip_share > 0 else 0.0
            deductions = round(gross * RNG.uniform(0.08, 0.18), 2)
            net = round(max(0.0, gross + tips - deductions), 2)
            same_day = int(
                pay_type == "gig"
                or RNG.random() < (0.35 if w["has_bank_account"] == "1" or w["has_bank_account"] == 1 else 0.15)
            )
            # fix has_bank_account comparison - it's stored as int in dict then maybe string when writing
            banked = int(w["has_bank_account"])
            same_day = int(pay_type == "gig" or RNG.random() < (0.35 if banked else 0.12))

            rows.append(
                {
                    "earnings_id": f"E-{eid:06d}",
                    "worker_id": w["worker_id"],
                    "work_date": d.isoformat(),
                    "employer_id": w["primary_employer_id"]
                    if RNG.random() > 0.18
                    else RNG.choice(EMPLOYERS),
                    "shift_type": RNG.choice(["day", "evening", "night", "split"]),
                    "hours_worked": f"{hours:.1f}",
                    "gross_pay_cad": f"{gross:.2f}",
                    "tips_cad": f"{tips:.2f}",
                    "deductions_cad": f"{deductions:.2f}",
                    "net_pay_cad": f"{net:.2f}",
                    "paid_same_day": same_day,
                    "pay_method": RNG.choice(
                        ["direct_deposit", "payroll_card", "cash", "etransfer"]
                        if banked
                        else ["payroll_card", "cash", "etransfer"]
                    ),
                }
            )
            eid += 1
    return rows


def gen_obligations(workers):
    rows = []
    oid = 1
    for w in workers:
        rent = RNG.randint(750, 1750)
        if w["rent_burden_band"] == "severe":
            rent = RNG.randint(1400, 2100)
        elif w["rent_burden_band"] == "low":
            rent = RNG.randint(600, 950)

        due_rent = RNG.choice([1, 1, 1, 15])
        rows.append(
            {
                "obligation_id": f"O-{oid:05d}",
                "worker_id": w["worker_id"],
                "name": "Rent",
                "category": "housing",
                "amount_cad": f"{rent:.2f}",
                "frequency": "monthly",
                "due_day_of_month": due_rent,
                "autopay": int(RNG.random() < 0.25),
                "essential": 1,
            }
        )
        oid += 1

        phone = RNG.randint(40, 95)
        rows.append(
            {
                "obligation_id": f"O-{oid:05d}",
                "worker_id": w["worker_id"],
                "name": "Mobile phone",
                "category": "phone",
                "amount_cad": f"{phone:.2f}",
                "frequency": "monthly",
                "due_day_of_month": RNG.randint(1, 28),
                "autopay": int(RNG.random() < 0.55),
                "essential": 1,
            }
        )
        oid += 1

        if RNG.random() < 0.7:
            util = RNG.randint(60, 190)
            rows.append(
                {
                    "obligation_id": f"O-{oid:05d}",
                    "worker_id": w["worker_id"],
                    "name": "Utilities",
                    "category": "utilities",
                    "amount_cad": f"{util:.2f}",
                    "frequency": "monthly",
                    "due_day_of_month": RNG.choice([5, 10, 15, 20, 25]),
                    "autopay": int(RNG.random() < 0.4),
                    "essential": 1,
                }
            )
            oid += 1

        if int(w["dependents"]) > 0 and RNG.random() < 0.55:
            child = RNG.randint(200, 900)
            rows.append(
                {
                    "obligation_id": f"O-{oid:05d}",
                    "worker_id": w["worker_id"],
                    "name": "Childcare",
                    "category": "childcare",
                    "amount_cad": f"{child:.2f}",
                    "frequency": "monthly",
                    "due_day_of_month": RNG.choice([1, 7, 15]),
                    "autopay": int(RNG.random() < 0.2),
                    "essential": 1,
                }
            )
            oid += 1

        if RNG.random() < 0.45:
            debt = RNG.randint(40, 220)
            rows.append(
                {
                    "obligation_id": f"O-{oid:05d}",
                    "worker_id": w["worker_id"],
                    "name": "Installment / loan payment",
                    "category": "debt_payment",
                    "amount_cad": f"{debt:.2f}",
                    "frequency": "biweekly" if RNG.random() < 0.4 else "monthly",
                    "due_day_of_month": RNG.randint(1, 28),
                    "autopay": int(RNG.random() < 0.5),
                    "essential": 1,
                }
            )
            oid += 1

        if RNG.random() < 0.35:
            rows.append(
                {
                    "obligation_id": f"O-{oid:05d}",
                    "worker_id": w["worker_id"],
                    "name": "Streaming / subscription",
                    "category": "entertainment",
                    "amount_cad": f"{RNG.choice([9.99, 14.99, 19.99, 24.99]):.2f}",
                    "frequency": "monthly",
                    "due_day_of_month": RNG.randint(1, 28),
                    "autopay": 1,
                    "essential": 0,
                }
            )
            oid += 1
    return rows


def gen_transactions(workers, earnings, obligations):
    rows = []
    tid = 1
    earn_by_worker = {}
    for e in earnings:
        earn_by_worker.setdefault(e["worker_id"], []).append(e)

    obl_by_worker = {}
    for o in obligations:
        obl_by_worker.setdefault(o["worker_id"], []).append(o)

    for w in workers:
        wid = w["worker_id"]
        banked = int(w["has_bank_account"])
        balance = RNG.uniform(20, 450)
        worker_earn = sorted(earn_by_worker.get(wid, []), key=lambda x: x["work_date"])
        earn_dates = {e["work_date"] for e in worker_earn}

        # Income credits when paid
        for e in worker_earn:
            net = float(e["net_pay_cad"])
            d = date.fromisoformat(e["work_date"])
            if int(e["paid_same_day"]):
                pay_dt = datetime(d.year, d.month, d.day, RNG.randint(16, 22), RNG.randint(0, 59))
            else:
                # lag 1-5 days for traditional payroll
                lag = RNG.randint(1, 5)
                pd = d + timedelta(days=lag)
                if pd > END + timedelta(days=5):
                    continue
                pay_dt = datetime(pd.year, pd.month, pd.day, RNG.randint(7, 11), RNG.randint(0, 59))

            balance += net
            rows.append(
                {
                    "txn_id": f"T-{tid:07d}",
                    "worker_id": wid,
                    "txn_ts": pay_dt.isoformat(timespec="seconds"),
                    "direction": "credit",
                    "amount_cad": f"{net:.2f}",
                    "category": "income",
                    "merchant_type": "employer_payroll",
                    "channel": e["pay_method"],
                    "is_essential": 0,
                    "running_balance_cad": f"{balance:.2f}",
                    "notes": f"linked_earnings_id={e['earnings_id']}",
                }
            )
            tid += 1

        # Recurring obligations as debits on due dates
        for o in obl_by_worker.get(wid, []):
            amount = float(o["amount_cad"])
            due_day = int(o["due_day_of_month"])
            freq = o["frequency"]
            for d in daterange(START, END):
                fire = False
                if freq == "monthly" and d.day == min(due_day, 28):
                    fire = True
                elif freq == "biweekly" and d.weekday() == 4 and ((d - START).days // 7) % 2 == 0:
                    fire = True
                if not fire:
                    continue
                # bounce risk when balance low
                if balance < amount * 0.5 and RNG.random() < 0.35:
                    continue
                balance -= amount
                ts = datetime(d.year, d.month, d.day, RNG.randint(6, 10), RNG.randint(0, 59))
                channel = "debit" if banked and RNG.random() > 0.15 else RNG.choice(["etransfer", "cash", "prepaid"])
                rows.append(
                    {
                        "txn_id": f"T-{tid:07d}",
                        "worker_id": wid,
                        "txn_ts": ts.isoformat(timespec="seconds"),
                        "direction": "debit",
                        "amount_cad": f"{amount:.2f}",
                        "category": o["category"],
                        "merchant_type": o["name"].lower().replace(" ", "_")[:40],
                        "channel": channel,
                        "is_essential": o["essential"],
                        "running_balance_cad": f"{balance:.2f}",
                        "notes": f"obligation_id={o['obligation_id']}",
                    }
                )
                tid += 1

        # Variable daily spend
        variable = [c for c in EXPENSE_CATALOG if c[5] > 0]
        for d in daterange(START, END):
            # more spend on payday-ish days
            payday_boost = 1.6 if d.isoformat() in earn_dates else 1.0
            # fewer spend events when broke
            if balance < 25:
                n_events = RNG.choices([0, 1], weights=[70, 30], k=1)[0]
            else:
                n_events = RNG.choices([0, 1, 2, 3], weights=[25, 40, 25, 10], k=1)[0]
            n_events = int(round(n_events * (0.85 + 0.15 * payday_boost)))
            if n_events <= 0:
                continue

            weights = [c[5] for c in variable]
            picked = RNG.choices(variable, weights=weights, k=n_events)
            for cat, merchant, lo, hi, essential, _w, cash_bias in picked:
                amount = round(RNG.uniform(lo, hi) * RNG.uniform(0.85, 1.15), 2)
                if balance < 10 and essential:
                    amount = min(amount, max(5.0, balance * 0.6))
                if balance <= 0 and RNG.random() < 0.7:
                    continue
                balance -= amount
                hour = RNG.randint(7, 22)
                ts = datetime(d.year, d.month, d.day, hour, RNG.randint(0, 59))
                if RNG.random() < cash_bias:
                    channel = "cash"
                elif not banked:
                    channel = RNG.choice(["prepaid", "cash", "etransfer"])
                else:
                    channel = RNG.choice(CHANNELS)
                rows.append(
                    {
                        "txn_id": f"T-{tid:07d}",
                        "worker_id": wid,
                        "txn_ts": ts.isoformat(timespec="seconds"),
                        "direction": "debit",
                        "amount_cad": f"{amount:.2f}",
                        "category": cat,
                        "merchant_type": merchant,
                        "channel": channel,
                        "is_essential": int(essential),
                        "running_balance_cad": f"{balance:.2f}",
                        "notes": "",
                    }
                )
                tid += 1

    rows.sort(key=lambda r: (r["worker_id"], r["txn_ts"]))
    return rows


def gen_advances(workers, earnings):
    """Earned-wage access / cash advances — core product-adjacent behaviour."""
    rows = []
    aid = 1
    earn_by_worker = {}
    for e in earnings:
        earn_by_worker.setdefault(e["worker_id"], []).append(e)

    for w in workers:
        # underbanked / high rent burden more likely to use advances
        base_p = 0.12
        if int(w["has_bank_account"]) == 0:
            base_p += 0.18
        if w["rent_burden_band"] in ("high", "severe"):
            base_p += 0.15
        if float(w["income_volatility"]) > 0.4:
            base_p += 0.08
        if RNG.random() > base_p + 0.25:
            # never uses advances
            if RNG.random() > base_p:
                continue

        worker_earn = sorted(earn_by_worker.get(w["worker_id"], []), key=lambda x: x["work_date"])
        if len(worker_earn) < 5:
            continue

        n_advances = RNG.randint(1, 8)
        used_dates = set()
        for _ in range(n_advances):
            e = RNG.choice(worker_earn)
            d = date.fromisoformat(e["work_date"])
            if d in used_dates:
                continue
            used_dates.add(d)
            # request evening of a workday before payday lag
            req = datetime(d.year, d.month, d.day, RNG.randint(17, 23), RNG.randint(0, 59))
            earned_so_far = float(e["net_pay_cad"]) * RNG.uniform(0.35, 0.85)
            amount = round(min(earned_so_far, RNG.uniform(25, 180)), 2)
            if amount < 20:
                continue
            fee = round(max(1.99, amount * RNG.choice([0.03, 0.05, 0.07, 0.0])), 2)
            if RNG.random() < 0.15:
                fee = 0.0  # promo / fee-free
            status = RNG.choices(
                ["repaid", "repaid", "repaid", "outstanding", "cancelled"],
                weights=[70, 10, 5, 12, 3],
                k=1,
            )[0]
            repaid_at = ""
            if status == "repaid":
                rd = d + timedelta(days=RNG.randint(1, 7))
                repaid_at = datetime(rd.year, rd.month, rd.day, RNG.randint(8, 12), 0).isoformat(
                    timespec="seconds"
                )
            rows.append(
                {
                    "advance_id": f"A-{aid:05d}",
                    "worker_id": w["worker_id"],
                    "requested_at": req.isoformat(timespec="seconds"),
                    "amount_cad": f"{amount:.2f}",
                    "fee_cad": f"{fee:.2f}",
                    "status": status,
                    "repaid_at": repaid_at,
                    "repayment_source": RNG.choice(
                        ["next_payroll", "same_day_earnings", "manual"]
                    ),
                    "reason_code": RNG.choice(
                        [
                            "rent_gap",
                            "groceries",
                            "transit",
                            "emergency",
                            "bill_due",
                            "childcare",
                            "other",
                        ]
                    ),
                }
            )
            aid += 1
    return rows


def gen_weekly_summary(workers, transactions, advances):
    rows = []
    # Build week buckets Mon-Sun
    def week_start(d: date) -> date:
        return d - timedelta(days=d.weekday())

    txn_idx = {}
    for t in transactions:
        d = datetime.fromisoformat(t["txn_ts"]).date()
        key = (t["worker_id"], week_start(d).isoformat())
        txn_idx.setdefault(key, []).append(t)

    adv_idx = {}
    for a in advances:
        d = datetime.fromisoformat(a["requested_at"]).date()
        key = (a["worker_id"], week_start(d).isoformat())
        adv_idx.setdefault(key, []).append(a)

    # all weeks in range
    weeks = []
    ws = week_start(START)
    while ws <= END:
        weeks.append(ws)
        ws += timedelta(days=7)

    for w in workers:
        for wk in weeks:
            key = (w["worker_id"], wk.isoformat())
            txns = txn_idx.get(key, [])
            advs = adv_idx.get(key, [])
            income = sum(float(t["amount_cad"]) for t in txns if t["direction"] == "credit")
            expense = sum(float(t["amount_cad"]) for t in txns if t["direction"] == "debit")
            essential = sum(
                float(t["amount_cad"])
                for t in txns
                if t["direction"] == "debit" and str(t["is_essential"]) in ("1", "True", "true")
            )
            adv_amt = sum(float(a["amount_cad"]) for a in advs if a["status"] != "cancelled")
            adv_fees = sum(float(a["fee_cad"]) for a in advs if a["status"] != "cancelled")
            end_balances = [
                float(t["running_balance_cad"]) for t in txns if t["running_balance_cad"] != ""
            ]
            end_bal = end_balances[-1] if end_balances else ""
            # buffer days = ending balance / avg daily essential spend that week
            daily_ess = essential / 7.0 if essential else 0
            buffer_days = round(float(end_bal) / daily_ess, 2) if end_bal != "" and daily_ess > 0 else ""
            if income == 0 and expense == 0 and adv_amt == 0:
                continue
            rows.append(
                {
                    "worker_id": w["worker_id"],
                    "week_start": wk.isoformat(),
                    "income_cad": f"{income:.2f}",
                    "expense_cad": f"{expense:.2f}",
                    "essential_expense_cad": f"{essential:.2f}",
                    "net_cashflow_cad": f"{(income - expense):.2f}",
                    "advances_count": len([a for a in advs if a["status"] != "cancelled"]),
                    "advances_amount_cad": f"{adv_amt:.2f}",
                    "advance_fees_cad": f"{adv_fees:.2f}",
                    "ending_balance_cad": f"{end_bal:.2f}" if end_bal != "" else "",
                    "buffer_days_estimate": buffer_days if buffer_days != "" else "",
                    "negative_balance_flag": int(end_bal != "" and float(end_bal) < 0),
                }
            )
    return rows


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    print(f"Writing datasets to {OUT}")

    workers = gen_workers()
    write_csv(
        OUT / "workers.csv",
        list(workers[0].keys()),
        workers,
    )
    print(f"  workers.csv: {len(workers)} rows")

    earnings = gen_earnings(workers)
    write_csv(OUT / "daily_earnings.csv", list(earnings[0].keys()), earnings)
    print(f"  daily_earnings.csv: {len(earnings)} rows")

    obligations = gen_obligations(workers)
    write_csv(OUT / "recurring_obligations.csv", list(obligations[0].keys()), obligations)
    print(f"  recurring_obligations.csv: {len(obligations)} rows")

    transactions = gen_transactions(workers, earnings, obligations)
    write_csv(OUT / "transactions.csv", list(transactions[0].keys()), transactions)
    print(f"  transactions.csv: {len(transactions)} rows")

    advances = gen_advances(workers, earnings)
    write_csv(OUT / "earned_wage_advances.csv", list(advances[0].keys()), advances)
    print(f"  earned_wage_advances.csv: {len(advances)} rows")

    weekly = gen_weekly_summary(workers, transactions, advances)
    write_csv(OUT / "weekly_cashflow_summary.csv", list(weekly[0].keys()), weekly)
    print(f"  weekly_cashflow_summary.csv: {len(weekly)} rows")

    # Lightweight data dictionary for builders
    readme = OUT / "README.txt"
    readme.write_text(
        """Daily Wage Earner — Synthetic Hackathon Dataset (anonymous)
=============================================================
Theme: budgeting / cash-flow for workers who earn day-to-day (July 29 ZayZoon prompt).
All IDs and people are fake. Seeded generator (seed=20260729). Currency: CAD.
Window: 2026-04-01 to 2026-6-30. Geography: Alberta-weighted (Calgary-heavy).

Tables (join on worker_id) — each available as .csv and .xlsx:
  workers                     Profile, occupation, volatility, banking access, rent burden
  daily_earnings              Per-shift gross/tips/deductions/net + same-day pay flag
  recurring_obligations       Rent, phone, utilities, childcare, debt, subscriptions
  transactions                Credits (pay) + debits with running_balance_cad
  earned_wage_advances        On-demand advances against earned wages (fees, reasons)
  weekly_cashflow_summary     Ready-made weekly aggregates + buffer_days_estimate

Download from the hackathon Hub → Data tab (CSV or XLSX).

Suggested build ideas:
  - Predict days until cash-out / buffer days
  - Bill timing vs irregular pay calendar
  - Advance need scoring without encouraging overuse
  - Essential vs discretionary spend coaching
  - Same-day pay vs lagged payroll cash-gap alerts
""",
        encoding="utf-8",
    )
    print("  README.txt written")

    try:
        from csv_to_xlsx import main as write_xlsx

        write_xlsx()
    except Exception as exc:
        print(f"  Warning: could not write XLSX files ({exc}). Run scripts/csv_to_xlsx.py")

    print("Done.")


if __name__ == "__main__":
    main()

"""Convert public/data/daily-wage/*.csv to matching .xlsx files."""

from __future__ import annotations

import csv
from pathlib import Path

from openpyxl import Workbook

ROOT = Path(__file__).resolve().parents[1] / "public" / "data" / "daily-wage"


def main() -> None:
    for csv_path in sorted(ROOT.glob("*.csv")):
        wb = Workbook(write_only=True)
        ws = wb.create_sheet(title=csv_path.stem[:31])
        with csv_path.open(newline="", encoding="utf-8") as f:
            for row in csv.reader(f):
                ws.append(row)
        out = csv_path.with_suffix(".xlsx")
        wb.save(out)
        print(f"{out.name}: {out.stat().st_size / 1024:.1f} KB")
    print("done")


if __name__ == "__main__":
    main()

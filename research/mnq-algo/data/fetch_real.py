"""Fetch real MNQ intraday bars. Run this on a machine with market-data access.

Sources (first available wins, or pick with --source):
  yfinance : free, MNQ=F. 1m limited to last ~30 days, 5m to ~60 days.
  databento: CME Globex official data (needs DATABENTO_API_KEY). Best quality.
  polygon  : needs POLYGON_API_KEY with futures entitlement.
  csv      : import your own export (ts,open,high,low,close,volume).

Output: results/mnq_1m_real.parquet — drop-in replacement for the synthetic
set; rerun run_tournament.py --data results/mnq_1m_real.parquet afterwards.
"""
from __future__ import annotations

import argparse
import os
import sys

import pandas as pd

OUT = os.path.join(os.path.dirname(__file__), "..", "results", "mnq_1m_real.parquet")


def from_yfinance(interval="1m"):
    import yfinance as yf

    period = "max" if interval != "1m" else "8d"
    frames = []
    if interval == "1m":
        # yahoo allows 1m in 8-day windows over the last 30 days
        end = pd.Timestamp.utcnow().floor("D")
        for k in range(4):
            s, e = end - pd.Timedelta(days=8 * (k + 1)), end - pd.Timedelta(days=8 * k)
            df = yf.download("MNQ=F", start=s, end=e, interval="1m", progress=False)
            if len(df):
                frames.append(df)
        df = pd.concat(frames).sort_index()
    else:
        df = yf.download("MNQ=F", period="60d", interval=interval, progress=False)
    df = df.rename(columns=str.lower)[["open", "high", "low", "close", "volume"]]
    df.index = df.index.tz_convert("America/New_York").tz_localize(None)
    return df.reset_index(names="ts").drop_duplicates("ts")


def from_databento(start="2024-07-01"):
    import databento as db

    client = db.Historical(os.environ["DATABENTO_API_KEY"])
    data = client.timeseries.get_range(
        dataset="GLBX.MDP3",
        symbols=["MNQ.c.0"],
        stype_in="continuous",
        schema="ohlcv-1m",
        start=start,
    )
    df = data.to_df().reset_index()
    df["ts"] = df["ts_event"].dt.tz_convert("America/New_York").dt.tz_localize(None)
    return df[["ts", "open", "high", "low", "close", "volume"]]


def from_csv(path):
    df = pd.read_csv(path, parse_dates=["ts"])
    need = {"ts", "open", "high", "low", "close", "volume"}
    missing = need - set(df.columns)
    if missing:
        sys.exit(f"CSV missing columns: {missing}")
    return df[sorted(need, key="ts open high low close volume".split().index)]


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--source", choices=["yfinance", "databento", "csv"], default="yfinance")
    ap.add_argument("--csv-path")
    ap.add_argument("--interval", default="1m")
    args = ap.parse_args()

    if args.source == "yfinance":
        df = from_yfinance(args.interval)
    elif args.source == "databento":
        df = from_databento()
    else:
        df = from_csv(args.csv_path)

    df = df.sort_values("ts").reset_index(drop=True)
    df.to_parquet(OUT)
    print(f"wrote {len(df):,} bars -> {OUT} ({df.ts.min()} .. {df.ts.max()})")

"""MNQ intraday backtest engine.

Signals are generated on 5-minute (or 1-minute) bars; fills, stops, targets
and MAE/MFE are simulated on 1-minute bars for precision.

Fill model (conservative):
  - signal evaluated on bar close -> entry at next bar's open +/- 1 tick slippage
  - stop and target checked intrabar on 1m highs/lows
  - if stop AND target are both inside the same 1m bar -> stop is assumed first
  - all positions force-flat at 15:55 ET
  - one position at a time per strategy

Costs: $0.62 commission per side + 1 tick ($0.50) slippage per side, $2/pt.
"""
from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np
import pandas as pd

TICK = 0.25
POINT_VALUE = 2.0
COMMISSION_SIDE = 0.62
SLIP_TICKS = 1
RTH_OPEN = 9 * 60 + 30
RTH_CLOSE = 16 * 60
FLAT_MIN = 15 * 60 + 55  # 15:55 ET force flat


@dataclass
class Signal:
    """Bracket-order signal emitted by a strategy on bar index `idx` (signal TF)."""
    idx: int
    side: int           # +1 long, -1 short
    stop_pts: float
    target_pts: float
    tag: str = ""
    be_r: float = 0.0   # >0: move stop to breakeven+1t after this fraction of stop in favor
    max_bars: int = 0   # >0: time stop, exit at market after N 1-minute bars
    limit_px: float = None  # resting limit entry; fill requires trade-through by 1 tick
    ttl_bars: int = 10      # cancel unfilled limit after N 1-minute bars


@dataclass
class Day:
    date: pd.Timestamp
    # 1-minute arrays (full session incl. ETH)
    ts: np.ndarray
    o: np.ndarray
    h: np.ndarray
    l: np.ndarray
    c: np.ndarray
    v: np.ndarray
    minute: np.ndarray          # minutes since midnight ET
    rth: np.ndarray             # bool mask of RTH 1m bars
    # 5-minute aggregates over the same day
    o5: np.ndarray = field(default=None)
    h5: np.ndarray = field(default=None)
    l5: np.ndarray = field(default=None)
    c5: np.ndarray = field(default=None)
    v5: np.ndarray = field(default=None)
    minute5: np.ndarray = field(default=None)
    rth5: np.ndarray = field(default=None)
    idx5_to_1m_next: np.ndarray = field(default=None)  # 5m bar i -> 1m index of next 5m open
    prev_close: float = np.nan
    prev_high: float = np.nan
    prev_low: float = np.nan


def load_days(path):
    """Split 1m parquet into futures days (keyed by RTH date) with 5m aggregates."""
    df = pd.read_parquet(path)
    ts = pd.DatetimeIndex(df["ts"])
    minute = ts.hour * 60 + ts.minute
    # futures day: bars from 18:00 belong to next calendar day
    fdate = ts.normalize() + pd.to_timedelta((minute >= 18 * 60).astype(int), unit="D")
    df = df.assign(minute=minute.values, fdate=fdate)

    days = []
    prev_close = prev_high = prev_low = np.nan
    for date, g in df.groupby("fdate", sort=True):
        g = g.reset_index(drop=True)
        m = g["minute"].values
        rth = (m >= RTH_OPEN) & (m < RTH_CLOSE)
        if rth.sum() < 300:
            continue
        d = Day(
            date=date,
            ts=g["ts"].values,
            o=g["open"].values.astype(float),
            h=g["high"].values.astype(float),
            l=g["low"].values.astype(float),
            c=g["close"].values.astype(float),
            v=g["volume"].values.astype(float),
            minute=m,
            rth=rth,
            prev_close=prev_close,
            prev_high=prev_high,
            prev_low=prev_low,
        )
        _add_5m(d)
        days.append(d)
        rc = g.loc[rth]
        prev_close = rc["close"].iloc[-1]
        prev_high = rc["high"].max()
        prev_low = rc["low"].min()
    # drop the first day (no prior-day levels)
    return days[1:]


def _add_5m(d: Day):
    n = len(d.o)
    bucket = np.arange(n) // 5
    nb = bucket[-1] + 1
    d.o5 = np.array([d.o[bucket == b][0] for b in range(nb)])
    d.c5 = np.array([d.c[bucket == b][-1] for b in range(nb)])
    d.h5 = np.array([d.h[bucket == b].max() for b in range(nb)])
    d.l5 = np.array([d.l[bucket == b].min() for b in range(nb)])
    d.v5 = np.array([d.v[bucket == b].sum() for b in range(nb)])
    first_idx = np.array([np.argmax(bucket == b) for b in range(nb)])
    d.minute5 = d.minute[first_idx]
    d.rth5 = (d.minute5 >= RTH_OPEN) & (d.minute5 < RTH_CLOSE)
    nxt = first_idx + 5
    d.idx5_to_1m_next = np.clip(nxt, 0, n - 1)


def simulate_day(day: Day, signals, tf="5m"):
    """Simulate bracket signals on one day. Returns list of trade dicts."""
    trades = []
    busy_until = -1  # 1m index until which we hold a position
    h, l, o, c, minute = day.h, day.l, day.o, day.c, day.minute
    n = len(o)

    for sig in signals:
        if tf == "5m":
            e = day.idx5_to_1m_next[sig.idx]
        else:
            e = sig.idx + 1
        if e >= n or e <= busy_until:
            continue
        if not (RTH_OPEN <= minute[e] < FLAT_MIN):
            continue

        side = sig.side
        if sig.limit_px is not None:
            # rest a limit; conservative fill = price trades THROUGH by 1 tick
            filled = None
            for j in range(e, min(e + sig.ttl_bars, n)):
                if minute[j] >= FLAT_MIN:
                    break
                through = l[j] <= sig.limit_px - TICK if side > 0 else h[j] >= sig.limit_px + TICK
                if through:
                    filled = j
                    break
            if filled is None:
                continue
            e = filled
            entry = sig.limit_px
        else:
            entry = o[e] + side * SLIP_TICKS * TICK
        stop = entry - side * sig.stop_pts
        target = entry + side * sig.target_pts

        # walk 1m bars until stop/target/flat-time
        exit_idx, exit_px, reason = None, None, None
        be_trigger = entry + side * sig.be_r * sig.stop_pts if sig.be_r > 0 else None
        for j in range(e, n):
            if minute[j] >= FLAT_MIN:
                exit_idx, exit_px, reason = j, o[j] - side * SLIP_TICKS * TICK, "eod"
                break
            if sig.max_bars and j - e >= sig.max_bars:
                exit_idx, exit_px, reason = j, o[j] - side * SLIP_TICKS * TICK, "time"
                break
            hit_stop = l[j] <= stop if side > 0 else h[j] >= stop
            hit_tgt = h[j] >= target if side > 0 else l[j] <= target
            if j == e and sig.limit_px is not None:
                hit_tgt = False  # target may have printed before the limit filled
            if hit_stop:  # worst case: stop fills first when both hit
                exit_idx, exit_px, reason = j, stop - side * SLIP_TICKS * TICK, "stop"
                break
            if hit_tgt:
                exit_idx, exit_px, reason = j, target, "target"
                break
            if be_trigger is not None:
                reached = h[j] >= be_trigger if side > 0 else l[j] <= be_trigger
                if reached:
                    stop = entry + side * TICK  # breakeven + 1 tick
                    be_trigger = None
        if exit_idx is None:
            exit_idx, exit_px, reason = n - 1, c[-1], "eod"

        seg_h = h[e : exit_idx + 1]
        seg_l = l[e : exit_idx + 1]
        if side > 0:
            mae = max(0.0, entry - seg_l.min())
            mfe = max(0.0, seg_h.max() - entry)
        else:
            mae = max(0.0, seg_h.max() - entry)
            mfe = max(0.0, entry - seg_l.min())

        pts = side * (exit_px - entry)
        pnl = pts * POINT_VALUE - 2 * COMMISSION_SIDE
        trades.append(
            dict(
                date=str(day.date.date()),
                entry_ts=str(day.ts[e]),
                exit_ts=str(day.ts[exit_idx]),
                side=side,
                entry=round(entry, 2),
                exit=round(exit_px, 2),
                reason=reason,
                pts=round(pts, 2),
                pnl=round(pnl, 2),
                mae_pts=round(mae, 2),
                mfe_pts=round(mfe, 2),
                mae_r=round(mae / sig.stop_pts, 3) if sig.stop_pts else np.nan,
                stop_pts=sig.stop_pts,
                target_pts=sig.target_pts,
                bars_held=int(exit_idx - e + 1),
                tag=sig.tag,
            )
        )
        busy_until = exit_idx
    return trades


def run(days, strategy, params):
    """Run a strategy (object with .timeframe and .signals(day, params)) over days."""
    all_trades = []
    for day in days:
        sigs = strategy.signals(day, params)
        if sigs:
            all_trades.extend(simulate_day(day, sigs, tf=strategy.timeframe))
    return all_trades

"""Final candidate: SOA RangeFader v1 — the tuned winner of rounds 1-3.

Edge A (VWAP stretch fade): round-1 stretch entry (in-extension, best
expectancy) + 0.6R breakeven lock (crushes MAE tail & drawdown).
Edge B (IB edge fade): rejection-confirmed initial-balance fade with
structure stop and BE lock, only on non-extending days.

Both edges are combined into one signal stream (engine keeps one position
at a time), giving a single deployable algorithm.
"""
from __future__ import annotations

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import numpy as np

from engine.backtest import Signal
from engine import indicators as ta
from strategies.library import Base, _clamp, _rth_idx


class SOARangeFader(Base):
    name = "soa_range_fader_v1"
    grid = [dict(k=k, tgt=t, be=b, w=w)
            for k in (1.3, 1.5, 1.8)
            for t in (0.65, 0.75, 0.85)
            for b in (0.5, 0.6)
            for w in ((10 * 60, 15 * 60), (10 * 60 + 30, 14 * 60 + 30))]

    def signals(self, day, p):
        idx = _rth_idx(day)
        if len(idx) < 15:
            return []
        vwap = ta.session_vwap(day.h5, day.l5, day.c5, day.v5, day.rth5)
        dev = day.c5 - vwap
        sd = ta.rolling_std(dev, 20)
        r3 = ta.rsi(day.c5, 3)
        a = ta.atr(day.h5, day.l5, day.c5, 14)
        c, h, l = day.c5, day.h5, day.l5

        ib = idx[:12]
        ib_hi, ib_lo = day.h5[ib].max(), day.l5[ib].min()
        rng = max(ib_hi - ib_lo, 1e-9)
        mid = (ib_hi + ib_lo) / 2
        w0, w1 = p["w"]
        out = []
        for i in idx:
            m = day.minute5[i]
            if i < 3 or not (w0 <= m <= w1) or np.isnan(sd[i]) or sd[i] == 0:
                continue
            stop = _clamp(1.2 * a[i])
            dist = abs(dev[i])

            # --- Edge A: VWAP stretch fade ---
            if dist >= 0.6 * a[i]:
                if dev[i] < -p["k"] * sd[i] and r3[i] < 35:
                    out.append(Signal(i, 1, stop, _clamp(p["tgt"] * dist), "A_L",
                                      be_r=p["be"], max_bars=0))
                    continue
                if dev[i] > p["k"] * sd[i] and r3[i] > 65:
                    out.append(Signal(i, -1, stop, _clamp(p["tgt"] * dist), "A_S",
                                      be_r=p["be"], max_bars=0))
                    continue

            # --- Edge B: IB edge fade on non-extending days ---
            if i >= idx[0] + 12 and m >= 11 * 60:
                day_hi = day.h5[idx[0] : i + 1].max()
                day_lo = day.l5[idx[0] : i + 1].min()
                if day_hi <= ib_hi + 0.3 * rng and day_lo >= ib_lo - 0.3 * rng:
                    if h[i] >= ib_hi and c[i] < ib_hi and c[i] < c[i - 1]:
                        s = _clamp(h[i - 2 : i + 1].max() - c[i] + 2.0)
                        out.append(Signal(i, -1, s, _clamp((c[i] - mid) * 0.9), "B_S",
                                          be_r=p["be"], max_bars=150))
                    elif l[i] <= ib_lo and c[i] > ib_lo and c[i] > c[i - 1]:
                        s = _clamp(c[i] - l[i - 2 : i + 1].min() + 2.0)
                        out.append(Signal(i, 1, s, _clamp((mid - c[i]) * 0.9), "B_L",
                                          be_r=p["be"], max_bars=150))
        return out


FINAL = [SOARangeFader]

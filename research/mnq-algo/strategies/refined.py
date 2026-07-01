"""Round-2 refined strategies: confirmation entries, structure stops,
breakeven locks and time stops — targeting lower MAE and higher win rate
than the round-1 originals they derive from.
"""
from __future__ import annotations

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import numpy as np

from engine.backtest import Signal
from engine import indicators as ta
from strategies.library import Base, _clamp, _rth_idx


class VWAPFadePro(Base):
    """VWAP band fade with re-cross confirmation and structure stop.

    Entry only after price has been stretched beyond k*sd from VWAP and the
    CLOSE crosses back inside the band (the turn is confirmed, not
    anticipated). Stop under the local 3-bar extreme, breakeven lock at
    +0.5R, time stop kills stale trades.
    """
    name = "vwap_fade_pro"
    grid = [dict(k=k, be=b, mb=m) for k in (1.5, 2.0) for b in (0.0, 0.5) for m in (0, 30)]

    def signals(self, day, p):
        vwap = ta.session_vwap(day.h5, day.l5, day.c5, day.v5, day.rth5)
        dev = day.c5 - vwap
        sd = ta.rolling_std(dev, 20)
        a = ta.atr(day.h5, day.l5, day.c5, 14)
        c, h, l = day.c5, day.h5, day.l5
        out = []
        for i in _rth_idx(day):
            m = day.minute5[i]
            if i < 3 or not (10 * 60 <= m <= 15 * 60) or np.isnan(sd[i]) or sd[i] == 0:
                continue
            band_lo = vwap[i] - p["k"] * sd[i]
            band_lo1 = vwap[i - 1] - p["k"] * sd[i - 1]
            band_hi = vwap[i] + p["k"] * sd[i]
            band_hi1 = vwap[i - 1] + p["k"] * sd[i - 1]
            dist = abs(dev[i])
            if dist < 0.5 * a[i]:
                continue
            mb = p["mb"] * 5  # signal bars -> 1m bars
            if c[i - 1] < band_lo1 and c[i] > band_lo and c[i] > c[i - 1]:
                stop = _clamp(c[i] - l[i - 2 : i + 1].min() + 2.0)
                out.append(Signal(i, 1, stop, _clamp(0.9 * dist), "vfpL", be_r=p["be"], max_bars=mb))
            elif c[i - 1] > band_hi1 and c[i] < band_hi and c[i] < c[i - 1]:
                stop = _clamp(h[i - 2 : i + 1].max() - c[i] + 2.0)
                out.append(Signal(i, -1, stop, _clamp(0.9 * dist), "vfpS", be_r=p["be"], max_bars=mb))
        return out


class IBFadePro(Base):
    """Initial-balance edge fade with rejection confirmation + BE lock."""
    name = "ib_fade_pro"
    grid = [dict(ext=e, be=b) for e in (0.15, 0.3) for b in (0.0, 0.5)]

    def signals(self, day, p):
        idx = _rth_idx(day)
        if len(idx) < 15:
            return []
        ib = idx[:12]
        ib_hi, ib_lo = day.h5[ib].max(), day.l5[ib].min()
        rng = ib_hi - ib_lo
        if rng <= 0:
            return []
        mid = (ib_hi + ib_lo) / 2
        a = ta.atr(day.h5, day.l5, day.c5, 14)
        c, h, l = day.c5, day.h5, day.l5
        out = []
        for i in idx[12:]:
            m = day.minute5[i]
            if i < 3 or not (11 * 60 <= m <= 15 * 60):
                continue
            day_hi = day.h5[idx[0] : i + 1].max()
            day_lo = day.l5[idx[0] : i + 1].min()
            if day_hi > ib_hi + p["ext"] * rng or day_lo < ib_lo - p["ext"] * rng:
                continue
            if h[i] >= ib_hi and c[i] < ib_hi and c[i] < c[i - 1]:
                stop = _clamp(h[i - 2 : i + 1].max() - c[i] + 2.0)
                out.append(Signal(i, -1, stop, _clamp((c[i] - mid) * 0.9), "ibpS", be_r=p["be"], max_bars=150))
            elif l[i] <= ib_lo and c[i] > ib_lo and c[i] > c[i - 1]:
                stop = _clamp(c[i] - l[i - 2 : i + 1].min() + 2.0)
                out.append(Signal(i, 1, stop, _clamp((mid - c[i]) * 0.9), "ibpL", be_r=p["be"], max_bars=150))
        return out


class RangeFaderPro(Base):
    """THE composite candidate: VWAP band fade, traded only on range-shaped
    days (small IB extension, no runaway gap), with re-cross confirmation,
    structure stops, breakeven lock and time stop. Gap-fill logic covers the
    first 30 minutes before the VWAP bands have enough data.
    """
    name = "range_fader_pro"
    grid = [dict(k=k, ext=e) for k in (1.5, 2.0) for e in (0.25, 0.4)]

    def signals(self, day, p):
        idx = _rth_idx(day)
        if len(idx) < 15:
            return []
        o_rth = day.o5[idx[0]]
        # skip likely trend days: runaway overnight gap
        if not np.isnan(day.prev_close) and abs(o_rth - day.prev_close) > 0.005 * o_rth:
            return []
        ib = idx[:12]
        ib_hi, ib_lo = day.h5[ib].max(), day.l5[ib].min()
        rng = max(ib_hi - ib_lo, 1e-9)

        vwap = ta.session_vwap(day.h5, day.l5, day.c5, day.v5, day.rth5)
        dev = day.c5 - vwap
        sd = ta.rolling_std(dev, 20)
        a = ta.atr(day.h5, day.l5, day.c5, 14)
        c, h, l = day.c5, day.h5, day.l5
        out = []

        # a) gap-fill fade at the open (independent of bands)
        if not np.isnan(day.prev_close):
            gap = o_rth - day.prev_close
            if 0.0012 * o_rth <= abs(gap) <= 0.005 * o_rth:
                i = idx[0]
                side = -1 if gap > 0 else 1
                remaining = (day.prev_close - c[i]) * side
                if remaining > 0:
                    out.append(Signal(i, side, _clamp(abs(gap) * 0.8), _clamp(remaining), "rfp_gap",
                                      be_r=0.5, max_bars=180))

        # b) VWAP band fades on range-shaped days
        for i in idx[12:]:
            m = day.minute5[i]
            if i < 3 or not (10 * 60 <= m <= 15 * 60) or np.isnan(sd[i]) or sd[i] == 0:
                continue
            day_hi = day.h5[idx[0] : i + 1].max()
            day_lo = day.l5[idx[0] : i + 1].min()
            if day_hi > ib_hi + p["ext"] * rng or day_lo < ib_lo - p["ext"] * rng:
                continue  # day is extending -> stand aside
            band_lo = vwap[i] - p["k"] * sd[i]
            band_lo1 = vwap[i - 1] - p["k"] * sd[i - 1]
            band_hi = vwap[i] + p["k"] * sd[i]
            band_hi1 = vwap[i - 1] + p["k"] * sd[i - 1]
            dist = abs(dev[i])
            if dist < 0.5 * a[i]:
                continue
            if c[i - 1] < band_lo1 and c[i] > band_lo and c[i] > c[i - 1]:
                stop = _clamp(c[i] - l[i - 2 : i + 1].min() + 2.0)
                out.append(Signal(i, 1, stop, _clamp(0.9 * dist), "rfpL", be_r=0.5, max_bars=150))
            elif c[i - 1] > band_hi1 and c[i] < band_hi and c[i] < c[i - 1]:
                stop = _clamp(h[i - 2 : i + 1].max() - c[i] + 2.0)
                out.append(Signal(i, -1, stop, _clamp(0.9 * dist), "rfpS", be_r=0.5, max_bars=150))
        return out


REFINED = [VWAPFadePro, IBFadePro, RangeFaderPro]

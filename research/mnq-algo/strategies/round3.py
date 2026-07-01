"""Round-3 strategies: limit-order entries at the stretch extreme.

Key insight from rounds 1-2: fading VWAP stretches works, but market entries
either enter while still extended (round 1: good expectancy, larger MAE) or
after confirmation (round 2: later, worse price, thinner expectancy).
A resting limit order AT the stretch level gets filled on the extension wick
itself — best possible location — which mechanically minimizes MAE.
"""
from __future__ import annotations

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import numpy as np

from engine.backtest import Signal
from engine import indicators as ta
from strategies.library import Base, _clamp, _rth_idx


class VWAPFadePlus(Base):
    """Round-1 vwap_band_fade entry + risk-management grid (BE lock, time
    stop, stop size). Finds the best MAE/expectancy trade-off for market
    entries."""
    name = "vwap_fade_plus"
    grid = [dict(k=1.5, rsi_gate=35, stop_atr=s, be=b, mb=m)
            for s in (0.8, 1.0, 1.2) for b in (0.0, 0.6) for m in (0, 150)]

    def signals(self, day, p):
        vwap = ta.session_vwap(day.h5, day.l5, day.c5, day.v5, day.rth5)
        dev = day.c5 - vwap
        sd = ta.rolling_std(dev, 20)
        r3 = ta.rsi(day.c5, 3)
        a = ta.atr(day.h5, day.l5, day.c5, 14)
        out = []
        for i in _rth_idx(day):
            m = day.minute5[i]
            if not (10 * 60 <= m <= 15 * 60) or np.isnan(sd[i]) or sd[i] == 0:
                continue
            dist = abs(dev[i])
            if dist < 0.6 * a[i]:
                continue
            stop = _clamp(p["stop_atr"] * a[i])
            if dev[i] < -p["k"] * sd[i] and r3[i] < p["rsi_gate"]:
                out.append(Signal(i, 1, stop, _clamp(0.75 * dist), "vfplL",
                                  be_r=p["be"], max_bars=p["mb"]))
            elif dev[i] > p["k"] * sd[i] and r3[i] > 100 - p["rsi_gate"]:
                out.append(Signal(i, -1, stop, _clamp(0.75 * dist), "vfplS",
                                  be_r=p["be"], max_bars=p["mb"]))
        return out


class VWAPLimitFade(Base):
    """When price closes beyond the k*sd VWAP band, rest a limit order DEEPER
    into the stretch (close -/+ depth*ATR). Filled on the extension wick;
    stop beyond the limit by stop_atr*ATR; target back at VWAP."""
    name = "vwap_limit_fade"
    grid = [dict(k=k, depth=d, stop_atr=s)
            for k in (1.5, 2.0) for d in (0.25, 0.5) for s in (0.8, 1.1)]

    def signals(self, day, p):
        vwap = ta.session_vwap(day.h5, day.l5, day.c5, day.v5, day.rth5)
        dev = day.c5 - vwap
        sd = ta.rolling_std(dev, 20)
        a = ta.atr(day.h5, day.l5, day.c5, 14)
        c = day.c5
        out = []
        for i in _rth_idx(day):
            m = day.minute5[i]
            if not (10 * 60 <= m <= 15 * 60) or np.isnan(sd[i]) or sd[i] == 0:
                continue
            dist = abs(dev[i])
            if dist < 0.6 * a[i]:
                continue
            if dev[i] < -p["k"] * sd[i]:
                lim = c[i] - p["depth"] * a[i]
                tgt = max(vwap[i] - lim, 0) * 0.85
                out.append(Signal(i, 1, _clamp(p["stop_atr"] * a[i]), _clamp(tgt), "vlfL",
                                  be_r=0.5, max_bars=150, limit_px=float(lim), ttl_bars=15))
            elif dev[i] > p["k"] * sd[i]:
                lim = c[i] + p["depth"] * a[i]
                tgt = max(lim - vwap[i], 0) * 0.85
                out.append(Signal(i, -1, _clamp(p["stop_atr"] * a[i]), _clamp(tgt), "vlfS",
                                  be_r=0.5, max_bars=150, limit_px=float(lim), ttl_bars=15))
        return out


class IBLimitFade(Base):
    """Initial-balance fade with a resting limit AT the IB edge instead of a
    market order after rejection — filled on the test wick itself."""
    name = "ib_limit_fade"
    grid = [dict(ext=e, off=o_, stop_atr=s)
            for e in (0.15, 0.3) for o_ in (0.0, 0.15) for s in (0.8, 1.1)]

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
        out = []
        for i in idx[12:]:
            m = day.minute5[i]
            if not (11 * 60 <= m <= 15 * 60):
                continue
            day_hi = day.h5[idx[0] : i + 1].max()
            day_lo = day.l5[idx[0] : i + 1].min()
            if day_hi > ib_hi + p["ext"] * rng or day_lo < ib_lo - p["ext"] * rng:
                continue
            c = day.c5[i]
            # approaching the edge from inside -> rest a limit at the edge
            if ib_hi - c <= 0.35 * rng and c < ib_hi:
                lim = ib_hi + p["off"] * rng
                out.append(Signal(i, -1, _clamp(p["stop_atr"] * a[i]), _clamp((lim - mid) * 0.85),
                                  "iblS", be_r=0.5, max_bars=150, limit_px=float(lim), ttl_bars=30))
            elif c - ib_lo <= 0.35 * rng and c > ib_lo:
                lim = ib_lo - p["off"] * rng
                out.append(Signal(i, 1, _clamp(p["stop_atr"] * a[i]), _clamp((mid - lim) * 0.85),
                                  "iblL", be_r=0.5, max_bars=150, limit_px=float(lim), ttl_bars=30))
        return out


ROUND3 = [VWAPFadePlus, VWAPLimitFade, IBLimitFade]

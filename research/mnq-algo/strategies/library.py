"""Strategy battery for the MNQ intraday tournament.

Every strategy exposes:
  name        str
  timeframe   "5m" | "1m"  (signal timeframe; fills always simulate on 1m)
  grid        list[dict]   parameter combos for the train-segment search
  signals(day, params) -> list[Signal]

Signals are evaluated on bar close, filled at next bar open by the engine.
Stops/targets are expressed in points. Strategies with cross-day state
(sr_bounce) update their state at the END of signals() so there is no
lookahead within the day being traded.
"""
from __future__ import annotations

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import numpy as np

from engine.backtest import Signal, RTH_OPEN
from engine import indicators as ta

MIN_STOP = 4.0     # points; below this, 1-tick noise dominates
MAX_STOP = 80.0


def _clamp(x):
    return float(np.clip(x, MIN_STOP, MAX_STOP))


def _rth_idx(day):
    return np.where(day.rth5)[0]


class Base:
    timeframe = "5m"

    def signals(self, day, p):  # pragma: no cover
        raise NotImplementedError


# ----------------------------------------------------------------- baseline
class ORB(Base):
    name = "orb_breakout"
    grid = [dict(or_min=m, rr=r) for m in (15, 30) for r in (1.5, 2.0)]

    def signals(self, day, p):
        idx = _rth_idx(day)
        if not len(idx):
            return []
        nbars = p["or_min"] // 5
        orr = idx[:nbars]
        or_hi, or_lo = day.h5[orr].max(), day.l5[orr].min()
        risk = or_hi - or_lo
        out = []
        fired = set()
        for i in idx[nbars:]:
            if day.minute5[i] > 12 * 60 or len(fired) >= 2:
                break
            c = day.c5[i]
            if c > or_hi and "L" not in fired:
                out.append(Signal(i, 1, _clamp(risk), _clamp(risk * p["rr"]), "orb"))
                fired.add("L")
            elif c < or_lo and "S" not in fired:
                out.append(Signal(i, -1, _clamp(risk), _clamp(risk * p["rr"]), "orb"))
                fired.add("S")
        return out


# ------------------------------------------------------------ VWAP family
class VWAPFade(Base):
    name = "vwap_band_fade"
    grid = [dict(k=k, rsi_gate=g) for k in (1.5, 2.0, 2.5) for g in (25, 35)]

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
            if dev[i] < -p["k"] * sd[i] and r3[i] < p["rsi_gate"]:
                out.append(Signal(i, 1, _clamp(1.2 * a[i]), _clamp(0.75 * dist), "fadeL"))
            elif dev[i] > p["k"] * sd[i] and r3[i] > 100 - p["rsi_gate"]:
                out.append(Signal(i, -1, _clamp(1.2 * a[i]), _clamp(0.75 * dist), "fadeS"))
        return out


class VWAPPullback(Base):
    name = "vwap_trend_pullback"
    grid = [dict(rr=r, conf=c) for r in (1.5, 2.5) for c in (8, 12)]

    def signals(self, day, p):
        vwap = ta.session_vwap(day.h5, day.l5, day.c5, day.v5, day.rth5)
        e20 = ta.ema(day.c5, 20)
        a = ta.atr(day.h5, day.l5, day.c5, 14)
        above = day.c5 > vwap
        out = []
        for i in _rth_idx(day):
            m = day.minute5[i]
            if not (10 * 60 <= m <= 15 * 60) or np.isnan(vwap[i]):
                continue
            j0 = max(0, i - p["conf"])
            up = above[j0:i].mean() > 0.8 and e20[i] > e20[i - 3]
            dn = (~above[j0:i]).mean() > 0.8 and e20[i] < e20[i - 3]
            stop = _clamp(1.2 * a[i])
            if up and day.l5[i] <= vwap[i] and day.c5[i] > vwap[i]:
                out.append(Signal(i, 1, stop, _clamp(stop * p["rr"]), "vpbL"))
            elif dn and day.h5[i] >= vwap[i] and day.c5[i] < vwap[i]:
                out.append(Signal(i, -1, stop, _clamp(stop * p["rr"]), "vpbS"))
        return out


# ------------------------------------------------------------- MA family
class EMAPullback(Base):
    name = "ema_9_21_pullback"
    grid = [dict(rr=r) for r in (1.5, 2.0, 3.0)]

    def signals(self, day, p):
        e9, e21 = ta.ema(day.c5, 9), ta.ema(day.c5, 21)
        a = ta.atr(day.h5, day.l5, day.c5, 14)
        out = []
        for i in _rth_idx(day):
            if not (10 * 60 <= day.minute5[i] <= 15 * 60):
                continue
            stop = _clamp(1.2 * a[i])
            if e9[i] > e21[i] and day.l5[i] <= e21[i] and day.c5[i] > e21[i]:
                out.append(Signal(i, 1, stop, _clamp(stop * p["rr"]), "emaL"))
            elif e9[i] < e21[i] and day.h5[i] >= e21[i] and day.c5[i] < e21[i]:
                out.append(Signal(i, -1, stop, _clamp(stop * p["rr"]), "emaS"))
        return out


class ThreeBarPullback(Base):
    name = "three_bar_pullback"
    grid = [dict(rr=r) for r in (1.5, 2.0)]

    def signals(self, day, p):
        e9, e21 = ta.ema(day.c5, 9), ta.ema(day.c5, 21)
        vwap = ta.session_vwap(day.h5, day.l5, day.c5, day.v5, day.rth5)
        out = []
        for i in _rth_idx(day):
            if i < 4 or not (10 * 60 <= day.minute5[i] <= 15 * 60) or np.isnan(vwap[i]):
                continue
            c = day.c5
            down3 = c[i - 3] < c[i - 4] and c[i - 2] < c[i - 3] and c[i - 1] < c[i - 2]
            up3 = c[i - 3] > c[i - 4] and c[i - 2] > c[i - 3] and c[i - 1] > c[i - 2]
            if e9[i] > e21[i] and c[i] > vwap[i] and down3 and c[i] > c[i - 1]:
                stop = _clamp(c[i] - day.l5[i - 3 : i + 1].min() + 2.0)
                out.append(Signal(i, 1, stop, _clamp(stop * p["rr"]), "3bpL"))
            elif e9[i] < e21[i] and c[i] < vwap[i] and up3 and c[i] < c[i - 1]:
                stop = _clamp(day.h5[i - 3 : i + 1].max() - c[i] + 2.0)
                out.append(Signal(i, -1, stop, _clamp(stop * p["rr"]), "3bpS"))
        return out


# --------------------------------------------------------- mean reversion
class RSI2(Base):
    name = "rsi2_meanrev"
    grid = [dict(th=t, stop_atr=s) for t in (5, 10) for s in (1.5, 2.0)]

    def signals(self, day, p):
        r2 = ta.rsi(day.c5, 2)
        e200 = ta.ema(day.c5, 200)
        a = ta.atr(day.h5, day.l5, day.c5, 14)
        out = []
        for i in _rth_idx(day):
            if not (10 * 60 <= day.minute5[i] <= 15 * 60):
                continue
            stop = _clamp(p["stop_atr"] * a[i])
            tgt = _clamp(1.0 * a[i])
            if day.c5[i] > e200[i] and r2[i] < p["th"]:
                out.append(Signal(i, 1, stop, tgt, "rsi2L"))
            elif day.c5[i] < e200[i] and r2[i] > 100 - p["th"]:
                out.append(Signal(i, -1, stop, tgt, "rsi2S"))
        return out


class BollingerFade(Base):
    name = "bollinger_snapback"
    grid = [dict(nsd=s) for s in (2.0, 2.5)]

    def signals(self, day, p):
        mid = ta.sma(day.c5, 20)
        sd = ta.rolling_std(day.c5, 20)
        a = ta.atr(day.h5, day.l5, day.c5, 14)
        c = day.c5
        out = []
        for i in _rth_idx(day):
            if i < 1 or np.isnan(sd[i]) or not (10 * 60 <= day.minute5[i] <= 15 * 60):
                continue
            up, lo = mid[i] + p["nsd"] * sd[i], mid[i] - p["nsd"] * sd[i]
            up1, lo1 = mid[i - 1] + p["nsd"] * sd[i - 1], mid[i - 1] - p["nsd"] * sd[i - 1]
            if c[i - 1] < lo1 and c[i] > lo:
                out.append(Signal(i, 1, _clamp(1.2 * a[i]), _clamp(max(mid[i] - c[i], 0) * 0.9), "bbL"))
            elif c[i - 1] > up1 and c[i] < up:
                out.append(Signal(i, -1, _clamp(1.2 * a[i]), _clamp(max(c[i] - mid[i], 0) * 0.9), "bbS"))
        return out


class LunchFade(Base):
    name = "midday_extreme_fade"
    grid = [dict(rsi_th=t) for t in (75, 85)]

    def signals(self, day, p):
        vwap = ta.session_vwap(day.h5, day.l5, day.c5, day.v5, day.rth5)
        r3 = ta.rsi(day.c5, 3)
        a = ta.atr(day.h5, day.l5, day.c5, 14)
        idx = _rth_idx(day)
        if not len(idx):
            return []
        out = []
        run_hi, run_lo = -np.inf, np.inf
        for i in idx:
            run_hi, run_lo = max(run_hi, day.h5[i]), min(run_lo, day.l5[i])
            m = day.minute5[i]
            if not (12 * 60 <= m <= 14 * 60) or np.isnan(vwap[i]):
                continue
            dist_v = abs(day.c5[i] - vwap[i])
            if day.h5[i] >= run_hi - 0.1 * a[i] and r3[i] > p["rsi_th"] and day.c5[i] > vwap[i]:
                out.append(Signal(i, -1, _clamp(1.2 * a[i]), _clamp(0.7 * dist_v), "lfS"))
            elif day.l5[i] <= run_lo + 0.1 * a[i] and r3[i] < 100 - p["rsi_th"] and day.c5[i] < vwap[i]:
                out.append(Signal(i, 1, _clamp(1.2 * a[i]), _clamp(0.7 * dist_v), "lfL"))
        return out


class GapFill(Base):
    name = "gap_fade_fill"
    grid = [dict(min_gap=g, max_gap=x) for g, x in ((0.0012, 0.006), (0.002, 0.008))]

    def signals(self, day, p):
        if np.isnan(day.prev_close):
            return []
        idx = _rth_idx(day)
        if len(idx) < 2:
            return []
        o = day.o5[idx[0]]
        gap = o - day.prev_close
        if not (p["min_gap"] * o <= abs(gap) <= p["max_gap"] * o):
            return []
        side = -1 if gap > 0 else 1
        i = idx[0]  # evaluated on close of first 5m bar, filled at 09:35
        c = day.c5[i]
        remaining = (day.prev_close - c) * side
        if remaining <= 0:
            return []
        stop = _clamp(max(abs(gap) * 0.8, 8.0))
        return [Signal(i, side, stop, _clamp(remaining), "gap")]


# ------------------------------------------------------------- level-based
class PDHPDLBreak(Base):
    name = "prevday_break_retest"
    grid = [dict(rr=r) for r in (1.5, 2.0)]

    def signals(self, day, p):
        if np.isnan(day.prev_high):
            return []
        a = ta.atr(day.h5, day.l5, day.c5, 14)
        out = []
        broke_hi = broke_lo = False
        for i in _rth_idx(day):
            if day.minute5[i] > 15 * 60:
                break
            c = day.c5[i]
            if c > day.prev_high:
                broke_hi = True
            if c < day.prev_low:
                broke_lo = True
            stop = _clamp(1.2 * a[i])
            if broke_hi and day.l5[i] <= day.prev_high and c > day.prev_high:
                out.append(Signal(i, 1, stop, _clamp(stop * p["rr"]), "pdhL"))
                broke_hi = False
            elif broke_lo and day.h5[i] >= day.prev_low and c < day.prev_low:
                out.append(Signal(i, -1, stop, _clamp(stop * p["rr"]), "pdlS"))
                broke_lo = False
        return out


class PivotBounce(Base):
    name = "floor_pivot_bounce"
    grid = [dict(tol_atr=t) for t in (0.3, 0.5)]

    def signals(self, day, p):
        if np.isnan(day.prev_close):
            return []
        P = (day.prev_high + day.prev_low + day.prev_close) / 3
        S1, R1 = 2 * P - day.prev_high, 2 * P - day.prev_low
        a = ta.atr(day.h5, day.l5, day.c5, 14)
        out = []
        for i in _rth_idx(day):
            if not (RTH_OPEN + 15 <= day.minute5[i] <= 15 * 60):
                continue
            c, tol = day.c5[i], p["tol_atr"] * a[i]
            if abs(day.l5[i] - S1) <= tol and c > S1 and c < P:
                out.append(Signal(i, 1, _clamp(1.2 * a[i]), _clamp((P - c) * 0.9), "s1L"))
            elif abs(day.h5[i] - R1) <= tol and c < R1 and c > P:
                out.append(Signal(i, -1, _clamp(1.2 * a[i]), _clamp((c - P) * 0.9), "r1S"))
        return out


class IBFade(Base):
    name = "initial_balance_fade"
    grid = [dict(ext=e) for e in (0.15, 0.3)]

    def signals(self, day, p):
        idx = _rth_idx(day)
        if len(idx) < 15:
            return []
        ib = idx[:12]  # first 60 minutes
        ib_hi, ib_lo = day.h5[ib].max(), day.l5[ib].min()
        rng = ib_hi - ib_lo
        if rng <= 0:
            return []
        mid = (ib_hi + ib_lo) / 2
        a = ta.atr(day.h5, day.l5, day.c5, 14)
        out = []
        for i in idx[12:]:
            m = day.minute5[i]
            if not (11 * 60 + 30 <= m <= 15 * 60):
                continue
            day_hi = day.h5[idx[0] : i + 1].max()
            day_lo = day.l5[idx[0] : i + 1].min()
            extended = day_hi > ib_hi + p["ext"] * rng or day_lo < ib_lo - p["ext"] * rng
            if extended:
                continue
            c = day.c5[i]
            if day.h5[i] >= ib_hi and c < ib_hi:
                out.append(Signal(i, -1, _clamp(max(0.35 * rng, 1.0 * a[i])), _clamp((c - mid) * 0.9), "ibS"))
            elif day.l5[i] <= ib_lo and c > ib_lo:
                out.append(Signal(i, 1, _clamp(max(0.35 * rng, 1.0 * a[i])), _clamp((mid - c) * 0.9), "ibL"))
        return out


class FibPullback(Base):
    name = "fib_618_pullback"
    grid = [dict(min_leg_atr=m, fib=f) for m in (6.0, 10.0) for f in (0.618, 0.5)]

    def signals(self, day, p):
        idx = _rth_idx(day)
        if len(idx) < 30:
            return []
        a = ta.atr(day.h5, day.l5, day.c5, 14)
        out = []
        # morning leg: RTH open .. 11:30
        leg_end = [i for i in idx if day.minute5[i] <= 11 * 60 + 30]
        if len(leg_end) < 6:
            return []
        seg = np.array(leg_end)
        hi_i = seg[np.argmax(day.h5[seg])]
        lo_i = seg[np.argmin(day.l5[seg])]
        hi, lo = day.h5[hi_i], day.l5[lo_i]
        leg = hi - lo
        if leg < p["min_leg_atr"] * np.nanmean(a[seg]):
            return []
        up = lo_i < hi_i  # low first -> up leg
        f, f786 = p["fib"], 0.786
        if up:
            lvl = hi - f * leg
            stop_lvl = hi - f786 * leg
            for i in idx:
                if i <= hi_i or day.minute5[i] > 14 * 60 + 30:
                    continue
                if day.l5[i] <= lvl and day.c5[i] > lvl:
                    stop = _clamp(day.c5[i] - stop_lvl + 2.0)
                    out.append(Signal(i, 1, stop, _clamp(hi - day.c5[i]), "fibL"))
                    break
        else:
            lvl = lo + f * leg
            stop_lvl = lo + f786 * leg
            for i in idx:
                if i <= lo_i or day.minute5[i] > 14 * 60 + 30:
                    continue
                if day.h5[i] >= lvl and day.c5[i] < lvl:
                    stop = _clamp(stop_lvl - day.c5[i] + 2.0)
                    out.append(Signal(i, -1, stop, _clamp(day.c5[i] - lo), "fibS"))
                    break
        return out


class SRBounce(Base):
    name = "sr_swing_bounce"
    grid = [dict(rr=r, tol_atr=t) for r in (1.5, 2.0) for t in (0.25, 0.4)]

    def __init__(self):
        self.levels = []  # (price, kind) from prior days

    def signals(self, day, p):
        a = ta.atr(day.h5, day.l5, day.c5, 14)
        out = []
        levels = list(self.levels)
        for i in _rth_idx(day):
            if not (10 * 60 <= day.minute5[i] <= 15 * 60):
                continue
            c, tol = day.c5[i], p["tol_atr"] * a[i]
            stop = _clamp(1.0 * a[i])
            for lvl, kind in levels:
                if kind == "sup" and abs(day.l5[i] - lvl) <= tol and c > lvl:
                    out.append(Signal(i, 1, stop, _clamp(stop * p["rr"]), "srL"))
                    break
                if kind == "res" and abs(day.h5[i] - lvl) <= tol and c < lvl:
                    out.append(Signal(i, -1, stop, _clamp(stop * p["rr"]), "srS"))
                    break
        # ---- update state with today's swings (after signal emission) ----
        idx = _rth_idx(day)
        if len(idx):
            h, l = day.h5[idx], day.l5[idx]
            sh, sl = ta.swing_points(h, l, k=3)
            new = [(float(h[i]), "res") for i in sh] + [(float(l[i]), "sup") for i in sl]
            self.levels = (self.levels + new)[-40:]
        return out


# --------------------------------------------------------------- momentum
class OpeningDrive(Base):
    name = "opening_drive_momo"
    timeframe = "1m"
    grid = [dict(min_move=m, rr=r) for m in (0.0010, 0.0016) for r in (1.5, 2.0)]

    def signals(self, day, p):
        rth1 = np.where(day.rth)[0]
        if len(rth1) < 10:
            return []
        first5 = rth1[:5]
        o = day.o[first5[0]]
        c5 = day.c[first5[-1]]
        move = (c5 - o) / o
        same_dir = np.sign(day.c[first5] - day.o[first5])
        consistent = (same_dir == np.sign(move)).sum() >= 4
        if abs(move) < p["min_move"] or not consistent:
            return []
        side = 1 if move > 0 else -1
        rng_hi, rng_lo = day.h[first5].max(), day.l[first5].min()
        stop = _clamp((rng_hi - rng_lo))
        return [Signal(first5[-1], side, stop, _clamp(stop * p["rr"]), "odrive")]


class KeltnerSqueeze(Base):
    name = "keltner_squeeze_break"
    grid = [dict(sq_bars=b) for b in (4, 8)]

    def signals(self, day, p):
        mid = ta.sma(day.c5, 20)
        sd = ta.rolling_std(day.c5, 20)
        a = ta.atr(day.h5, day.l5, day.c5, 20)
        e20 = ta.ema(day.c5, 20)
        c = day.c5
        squeeze = (2 * sd) < (1.5 * a)
        out = []
        for i in _rth_idx(day):
            if i < p["sq_bars"] or np.isnan(sd[i]) or not (10 * 60 <= day.minute5[i] <= 15 * 60):
                continue
            was_sq = squeeze[i - p["sq_bars"] : i].all()
            if not was_sq:
                continue
            stop = _clamp(1.5 * a[i])
            if c[i] > mid[i] + 2 * sd[i] and c[i] > e20[i]:
                out.append(Signal(i, 1, stop, _clamp(stop * 2.0), "sqL"))
            elif c[i] < mid[i] - 2 * sd[i] and c[i] < e20[i]:
                out.append(Signal(i, -1, stop, _clamp(stop * 2.0), "sqS"))
        return out


class Donchian(Base):
    name = "donchian_breakout"
    grid = [dict(n=n) for n in (36, 60)]

    def signals(self, day, p):
        hh = ta.rolling_max(day.h5, p["n"])
        ll = ta.rolling_min(day.l5, p["n"])
        a = ta.atr(day.h5, day.l5, day.c5, 14)
        c = day.c5
        out = []
        for i in _rth_idx(day):
            if i < 1 or np.isnan(hh[i - 1]) or not (10 * 60 <= day.minute5[i] <= 15 * 60):
                continue
            stop = _clamp(1.8 * a[i])
            if c[i] > hh[i - 1]:
                out.append(Signal(i, 1, stop, _clamp(stop * 3.0), "dcL"))
            elif c[i] < ll[i - 1]:
                out.append(Signal(i, -1, stop, _clamp(stop * 3.0), "dcS"))
        return out


class MACDMomo(Base):
    name = "macd_vwap_momo"
    grid = [dict(rr=r) for r in (1.5, 2.0)]

    def signals(self, day, p):
        line, sig, hist = ta.macd(day.c5)
        vwap = ta.session_vwap(day.h5, day.l5, day.c5, day.v5, day.rth5)
        a = ta.atr(day.h5, day.l5, day.c5, 14)
        out = []
        for i in _rth_idx(day):
            if i < 1 or np.isnan(vwap[i]) or not (10 * 60 <= day.minute5[i] <= 15 * 60):
                continue
            stop = _clamp(1.5 * a[i])
            if hist[i - 1] <= 0 < hist[i] and day.c5[i] > vwap[i]:
                out.append(Signal(i, 1, stop, _clamp(stop * p["rr"]), "macdL"))
            elif hist[i - 1] >= 0 > hist[i] and day.c5[i] < vwap[i]:
                out.append(Signal(i, -1, stop, _clamp(stop * p["rr"]), "macdS"))
        return out


ALL_STRATEGIES = [
    ORB, VWAPFade, VWAPPullback, EMAPullback, ThreeBarPullback, RSI2,
    BollingerFade, LunchFade, GapFill, PDHPDLBreak, PivotBounce, IBFade,
    FibPullback, SRBounce, OpeningDrive, KeltnerSqueeze, Donchian, MACDMomo,
]

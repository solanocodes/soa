"""Vectorized indicator helpers operating on plain numpy arrays."""
from __future__ import annotations

import numpy as np


def ema(x, n):
    a = 2.0 / (n + 1)
    out = np.empty_like(x, dtype=float)
    out[0] = x[0]
    for i in range(1, len(x)):
        out[i] = a * x[i] + (1 - a) * out[i - 1]
    return out


def sma(x, n):
    c = np.cumsum(np.insert(x.astype(float), 0, 0.0))
    out = np.full(len(x), np.nan)
    out[n - 1 :] = (c[n:] - c[:-n]) / n
    out[: n - 1] = np.nan
    return out


def rolling_std(x, n):
    out = np.full(len(x), np.nan)
    for i in range(n - 1, len(x)):
        out[i] = x[i - n + 1 : i + 1].std()
    return out


def rolling_max(x, n):
    out = np.full(len(x), np.nan)
    for i in range(n - 1, len(x)):
        out[i] = x[i - n + 1 : i + 1].max()
    return out


def rolling_min(x, n):
    out = np.full(len(x), np.nan)
    for i in range(n - 1, len(x)):
        out[i] = x[i - n + 1 : i + 1].min()
    return out


def rsi(close, n=14):
    d = np.diff(close, prepend=close[0])
    up = np.where(d > 0, d, 0.0)
    dn = np.where(d < 0, -d, 0.0)
    ru, rd = ema(up, 2 * n - 1), ema(dn, 2 * n - 1)  # Wilder smoothing
    rs = np.divide(ru, rd, out=np.full_like(ru, np.inf), where=rd != 0)
    return 100 - 100 / (1 + rs)


def atr(h, l, c, n=14):
    pc = np.roll(c, 1)
    pc[0] = c[0]
    tr = np.maximum(h - l, np.maximum(np.abs(h - pc), np.abs(l - pc)))
    return ema(tr, 2 * n - 1)


def macd(close, fast=12, slow=26, sig=9):
    line = ema(close, fast) - ema(close, slow)
    signal = ema(line, sig)
    return line, signal, line - signal


def session_vwap(h, l, c, v, rth_mask):
    """VWAP anchored at the first RTH bar; NaN before RTH open."""
    tp = (h + l + c) / 3.0
    out = np.full(len(c), np.nan)
    idx = np.where(rth_mask)[0]
    if len(idx) == 0:
        return out
    s = idx[0]
    pv = np.cumsum(tp[s:] * v[s:])
    vv = np.cumsum(v[s:])
    out[s:] = pv / np.maximum(vv, 1e-9)
    return out


def swing_points(h, l, k=2):
    """Fractal swings: index lists of swing highs and lows (k bars each side)."""
    sh, sl = [], []
    for i in range(k, len(h) - k):
        if h[i] == h[i - k : i + k + 1].max() and h[i] > h[i - 1] and h[i] >= h[i + 1]:
            sh.append(i)
        if l[i] == l[i - k : i + k + 1].min() and l[i] < l[i - 1] and l[i] <= l[i + 1]:
            sl.append(i)
    return sh, sl

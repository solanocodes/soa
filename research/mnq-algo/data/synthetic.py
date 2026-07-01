"""Calibrated synthetic MNQ 1-minute data generator.

Used inside sandboxed environments where market-data hosts are unreachable.
Calibrated to NQ as of mid-2026: price ~30,400, daily range ~0.8-1.6%,
tick 0.25. Generates session-aware (ETH+RTH) 1-minute OHLCV with:

- regime-switching days: trend / range / volatile-chop / gap-fade
- U-shaped intraday volatility and volume
- overnight session at reduced vol -> realistic opening gaps
- VWAP magnetism (OU pull) on range days, persistent drift waves on trend days
- GARCH-like day-to-day volatility clustering
- prices rounded to the 0.25 tick grid

NOT a substitute for real data. Use data/fetch_real.py on a machine with
market-data access, or validate with the Pine ports on TradingView.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

TICK = 0.25
RTH_OPEN_MIN = 9 * 60 + 30   # minutes since midnight ET
RTH_CLOSE_MIN = 16 * 60

REGIMES = ("trend", "range", "chop", "gap_fade")
REGIME_P = (0.22, 0.42, 0.20, 0.16)


def _day_minutes():
    """ET minute stamps for one futures day: 18:00 prev day -> 17:00."""
    eth1 = np.arange(18 * 60, 24 * 60)          # 18:00-23:59 (prev calendar day)
    eth2 = np.arange(0, RTH_OPEN_MIN)           # 00:00-09:29
    rth = np.arange(RTH_OPEN_MIN, RTH_CLOSE_MIN)  # 09:30-15:59
    eth3 = np.arange(16 * 60, 17 * 60)          # 16:00-16:59
    return eth1, eth2, rth, eth3


def _vol_profile(n_rth):
    """U-shaped RTH volatility multipliers, peak at open, trough at lunch."""
    x = np.linspace(0, 1, n_rth)
    u = 1.9 * np.exp(-x / 0.12) + 0.55 + 0.9 * np.exp(-(1 - x) / 0.10)
    return u / u.mean()


def generate(n_days=500, end_price=30400.0, seed=42, start="2024-07-01"):
    rng = np.random.default_rng(seed)
    days = pd.bdate_range(end=pd.Timestamp("2026-06-30"), periods=n_days)

    # Work backwards from calibrated end price with ~24%/yr drift.
    ann_drift = 0.245
    start_price = end_price / np.exp(ann_drift * n_days / 252)

    eth1, eth2, rth, eth3 = _day_minutes()
    n_eth = len(eth1) + len(eth2)
    n_rth = len(rth)
    n_post = len(eth3)
    uprof = _vol_profile(n_rth)

    SUB = 4  # 15-second sub-steps per minute for realistic highs/lows

    # GARCH-ish daily vol series (daily sigma of log returns)
    base_sig = 0.0095
    sig = np.empty(n_days)
    sig[0] = base_sig
    for i in range(1, n_days):
        shock = rng.normal(0, 0.0016)
        sig[i] = np.clip(0.90 * sig[i - 1] + 0.10 * base_sig + shock, 0.006, 0.028)

    regimes = rng.choice(len(REGIMES), size=n_days, p=REGIME_P)

    price = start_price
    recs_ts, recs_o, recs_h, recs_l, recs_c, recs_v = [], [], [], [], [], []

    for d in range(n_days):
        day = days[d]
        regime = REGIMES[regimes[d]]
        day_sig = sig[d]
        # bridge drift: steer gently toward the calibrated end price
        drift_day = np.clip(np.log(end_price / price) / max(n_days - d, 1), -0.005, 0.005)

        # ---- overnight (ETH) ----
        eth_sig = day_sig * 0.28 / np.sqrt(n_eth)
        eth_drift = drift_day * 0.4 / n_eth
        if regime == "gap_fade":
            # exaggerated overnight move that RTH tends to fade
            gap_dir = rng.choice([-1, 1])
            eth_drift += gap_dir * day_sig * 0.45 / n_eth
        n_steps_eth = n_eth * SUB
        r = rng.normal(eth_drift / SUB, eth_sig / np.sqrt(SUB), n_steps_eth)
        eth_path = price * np.exp(np.cumsum(r))

        # ---- RTH ----
        rth_open = eth_path[-1]
        rth_sig_min = day_sig * 0.85 / np.sqrt(n_rth)
        bridge_min = drift_day * 0.6 / n_rth  # remainder of bridge drift into RTH

        if regime == "trend":
            direction = rng.choice([-1, 1])
            amp = day_sig * rng.uniform(0.7, 1.3)
            # persistent drift with 3-5 pullback waves
            waves = rng.integers(3, 6)
            t = np.linspace(0, 1, n_rth)
            path_shape = t + 0.10 * np.sin(2 * np.pi * waves * t + rng.uniform(0, 6.28))
            drift_min = direction * amp * np.gradient(path_shape)
            mr_k = 0.004
        elif regime == "range":
            drift_min = np.zeros(n_rth)
            mr_k = 0.030  # strong pull toward day anchor (VWAP magnetism)
        elif regime == "chop":
            drift_min = np.zeros(n_rth)
            rth_sig_min *= 1.5
            mr_k = 0.012
        else:  # gap_fade: drift back toward prior settle
            fade_target = price  # prior day settle
            drift_min = np.full(n_rth, np.clip(np.log(fade_target / rth_open), -0.02, 0.02) * 0.6 / n_rth)
            mr_k = 0.015

        logp = np.log(rth_open)
        anchor = logp
        sub_prices = np.empty(n_rth * SUB)
        for i in range(n_rth):
            s = rth_sig_min * uprof[i]
            for k in range(SUB):
                pull = mr_k * (anchor - logp)
                logp += (drift_min[i] + bridge_min) / SUB + pull / SUB + rng.normal(0, s / np.sqrt(SUB))
                sub_prices[i * SUB + k] = logp
            anchor = 0.985 * anchor + 0.015 * logp  # slow-moving day anchor
        rth_path = np.exp(sub_prices)

        # ---- post-close ETH ----
        post_sig = day_sig * 0.25 / np.sqrt(n_post)
        r = rng.normal(0, post_sig / np.sqrt(SUB), n_post * SUB)
        post_path = rth_path[-1] * np.exp(np.cumsum(r))

        full = np.concatenate([eth_path, rth_path, post_path])
        full = np.round(full / TICK) * TICK

        # aggregate SUB-steps to 1-min OHLC
        m = full.reshape(-1, SUB)
        opens = m[:, 0]
        highs = m.max(axis=1)
        lows = m.min(axis=1)
        closes = m[:, -1]

        mins = np.concatenate([eth1, eth2, rth, eth3])
        n_all = len(mins)
        # timestamps: eth1 belongs to previous calendar day
        base = day.normalize()
        ts = np.where(
            mins >= 18 * 60,
            (base - pd.Timedelta(days=1)).value + mins * 60_000_000_000,
            base.value + mins * 60_000_000_000,
        ).astype("datetime64[ns]")

        # U-shaped RTH volume, thin overnight
        vol = np.empty(n_all)
        vol[: n_eth] = rng.gamma(2.0, 90, n_eth)
        vol[n_eth : n_eth + n_rth] = rng.gamma(2.5, 900, n_rth) * uprof
        vol[n_eth + n_rth :] = rng.gamma(2.0, 150, n_post)

        recs_ts.append(ts)
        recs_o.append(opens)
        recs_h.append(highs)
        recs_l.append(lows)
        recs_c.append(closes)
        recs_v.append(vol.astype(np.int64))

        price = post_path[-1]

    df = pd.DataFrame(
        {
            "ts": np.concatenate(recs_ts),
            "open": np.concatenate(recs_o),
            "high": np.concatenate(recs_h),
            "low": np.concatenate(recs_l),
            "close": np.concatenate(recs_c),
            "volume": np.concatenate(recs_v),
        }
    )
    df = df.sort_values("ts").reset_index(drop=True)
    return df


if __name__ == "__main__":
    df = generate()
    out = "research/mnq-algo/results/mnq_1m_synthetic.parquet"
    df.to_parquet(out)
    print(df.shape, df.ts.min(), df.ts.max(), df.close.iloc[-1])

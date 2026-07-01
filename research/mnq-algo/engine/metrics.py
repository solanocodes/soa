"""Performance metrics over trade lists, with MAE front and center."""
from __future__ import annotations

import numpy as np
import pandas as pd


def summarize(trades, label=""):
    if not trades:
        return dict(label=label, trades=0)
    t = pd.DataFrame(trades)
    pnl = t["pnl"].values
    wins = pnl > 0
    gross_win = pnl[wins].sum()
    gross_loss = -pnl[~wins].sum()

    daily = t.groupby("date")["pnl"].sum()
    eq = daily.cumsum()
    dd = (eq - eq.cummax()).min()
    sharpe = daily.mean() / daily.std() * np.sqrt(252) if daily.std() > 0 else 0.0

    scratch = pnl.__abs__() <= 5.0  # breakeven-stop scratches (~2 ticks after costs)
    real = ~scratch
    wr_ex = float((pnl[real] > 0).mean()) * 100 if real.any() else 0.0

    return dict(
        label=label,
        trades=int(len(t)),
        win_rate=round(float(wins.mean()) * 100, 2),
        win_rate_ex_scratch=round(wr_ex, 2),
        scratch_rate=round(float(scratch.mean()) * 100, 2),
        profit_factor=round(float(gross_win / gross_loss), 3) if gross_loss > 0 else float("inf"),
        expectancy=round(float(pnl.mean()), 2),
        total_pnl=round(float(pnl.sum()), 2),
        avg_win=round(float(pnl[wins].mean()), 2) if wins.any() else 0.0,
        avg_loss=round(float(pnl[~wins].mean()), 2) if (~wins).any() else 0.0,
        avg_mae=round(float(t["mae_pts"].mean()), 2),
        med_mae=round(float(t["mae_pts"].median()), 2),
        p90_mae=round(float(t["mae_pts"].quantile(0.9)), 2),
        avg_mae_r=round(float(t["mae_r"].mean()), 3),
        avg_mae_win=round(float(t.loc[wins, "mae_pts"].mean()), 2) if wins.any() else 0.0,
        avg_mfe=round(float(t["mfe_pts"].mean()), 2),
        max_dd=round(float(dd), 2),
        sharpe=round(float(sharpe), 2),
        avg_bars=round(float(t["bars_held"].mean()), 1),
        pnl_per_day=round(float(daily.mean()), 2),
        n_days=int(daily.shape[0]),
    )


def score(m):
    """Composite ranking score: expectancy gated by win rate and MAE efficiency.

    Rewards: positive expectancy, high win rate, low MAE relative to stop
    (i.e., winners that don't go far against you), enough trades to matter.
    """
    if not m or m.get("trades", 0) < 40 or m.get("expectancy", 0) <= 0:
        return -1e9
    wr = m.get("win_rate_ex_scratch", m["win_rate"]) / 100
    mae_eff = max(0.0, 1.0 - m["avg_mae_r"])       # 1 = never breathes against you
    pf = min(m["profit_factor"], 3.0) / 3.0
    freq = min(m["trades"] / 400, 1.0)
    return round(100 * (0.30 * wr + 0.30 * mae_eff + 0.25 * pf + 0.15 * freq), 2)


def equity_curve(trades):
    if not trades:
        return []
    t = pd.DataFrame(trades)
    daily = t.groupby("date")["pnl"].sum().cumsum()
    return [{"date": d, "equity": round(float(v), 2)} for d, v in daily.items()]

"""Run the full strategy tournament and emit results JSON for the dashboard.

Usage:
  python3 run_tournament.py [--data results/mnq_1m_synthetic.parquet] [--seed 42]

Protocol:
  1. split days chronologically: 70% train / 30% holdout
  2. grid-search each strategy's params on TRAIN, pick best composite score
  3. re-run the chosen params on HOLDOUT (out-of-sample) -> reported numbers
  4. rank by holdout composite score (win rate + MAE efficiency + PF + freq)
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time

sys.path.insert(0, os.path.dirname(__file__))

from engine.backtest import load_days, run
from engine.metrics import summarize, score, equity_curve
from strategies.library import ALL_STRATEGIES
from strategies.refined import REFINED
from strategies.round3 import ROUND3
from strategies.final import FINAL

ALL_STRATEGIES = ALL_STRATEGIES + REFINED + ROUND3 + FINAL

HERE = os.path.dirname(os.path.abspath(__file__))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default=os.path.join(HERE, "results", "mnq_1m_synthetic.parquet"))
    ap.add_argument("--out", default=os.path.join(HERE, "results", "tournament.json"))
    args = ap.parse_args()

    print(f"loading {args.data} ...")
    days = load_days(args.data)
    cut = int(len(days) * 0.7)
    train, hold = days[:cut], days[cut:]
    print(f"{len(days)} days -> train {len(train)} ({train[0].date.date()}..{train[-1].date.date()}), "
          f"holdout {len(hold)} ({hold[0].date.date()}..{hold[-1].date.date()})")

    results = []
    for cls in ALL_STRATEGIES:
        t0 = time.time()
        best = None
        for params in cls.grid:
            strat = cls()
            m = summarize(run(train, strat, params), label=str(params))
            s = score(m)
            if best is None or s > best[0]:
                best = (s, params, m)
        train_score, best_params, train_m = best

        strat = cls()
        # replay train first for stateful strategies so holdout has warm state,
        # but only keep holdout trades for reporting
        _ = run(train, strat, best_params)
        hold_trades = run(hold, strat, best_params)
        hold_m = summarize(hold_trades, label=cls.name)
        hold_s = score(hold_m)

        results.append(
            dict(
                name=cls.name,
                family=cls.__name__,
                timeframe=cls.timeframe,
                params=best_params,
                grid_size=len(cls.grid),
                train=train_m,
                train_score=train_score,
                holdout=hold_m,
                holdout_score=hold_s,
                equity=equity_curve(hold_trades),
                mae_hist=[t["mae_pts"] for t in hold_trades],
                mae_r_hist=[t["mae_r"] for t in hold_trades],
                trades_sample=hold_trades[-120:],
            )
        )
        hm = hold_m
        print(f"  {cls.name:26s} best={best_params}  "
              f"hold: n={hm.get('trades',0):4d} wr={hm.get('win_rate',0):5.1f}% "
              f"pf={hm.get('profit_factor',0):5.2f} exp=${hm.get('expectancy',0):7.2f} "
              f"avgMAE={hm.get('avg_mae',0):5.1f}pts score={hold_s:7.2f} "
              f"({time.time()-t0:.1f}s)")

    results.sort(key=lambda r: r["holdout_score"], reverse=True)
    payload = dict(
        generated_at="2026-07-01",
        data_file=os.path.basename(args.data),
        n_days=len(days),
        n_train=len(train),
        n_holdout=len(hold),
        holdout_start=str(hold[0].date.date()),
        cost_model="$0.62/side commission + 1 tick slippage/side, $2/pt, MNQ",
        results=results,
    )
    with open(args.out, "w") as f:
        json.dump(payload, f)
    print(f"\nwrote {args.out}")


if __name__ == "__main__":
    main()

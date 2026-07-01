# MNQ Intraday Algo Lab

Systematic search for a low-MAE, high-win-rate intraday algorithm on MNQ
(Micro E-mini Nasdaq-100). 21 strategies across 6 families, 4 iteration
rounds, out-of-sample validated, with a self-contained results dashboard
and TradingView (Pine v6) ports of the winners.

**Open the dashboard:** `dashboard/index.html` (single file, works offline).

## Headline result — SOA RangeFader v1 (out-of-sample, 150 days)

| metric | value |
|---|---|
| Win rate (excluding breakeven scratches) | **60.3%** |
| Profit factor | **1.64** |
| Median MAE | **19.8 pts** (avg 25.7) |
| Winners' average MAE | **14.6 pts** |
| Expectancy | $16.8 / trade (1 contract, net of costs) |
| P&L per day | ~$85 / contract |
| Max drawdown | -$1,007 |
| Trades | 756 (~5/day) |

Two complementary mean-reversion edges in one book (one position at a time):

- **Edge A — VWAP stretch fade:** price stretched >1.5σ from the RTH-anchored
  VWAP with RSI(3) exhaustion, entered in-extension, target 65% of the way
  back to VWAP, stop 1.2×ATR(14), breakeven lock at +0.5R. Window 10:30–14:30 ET.
- **Edge B — Initial-balance edge fade:** on days that have NOT extended more
  than 0.3×IB beyond the first hour's range, fade rejection of the IB edge
  toward IB mid with a structure stop, +0.5R breakeven lock, 30-bar time stop.

## ⚠️ Data provenance — read this first

This sandbox has **no network route to any market-data provider** (Yahoo,
CME, Databento, TradingView, etc. are all blocked by the environment's
egress policy; only GitHub and package registries are reachable). The
tournament therefore ran on a **calibrated synthetic MNQ dataset**
(`data/synthetic.py`): 499 sessions, 1-minute bars, ETH+RTH, 0.25 tick grid,
price ~30,400 at end (calibrated to NQ, mid-2026), 1.28% average daily range,
realistic gaps, U-shaped intraday vol, and a regime mix (trend / range /
chop / gap-fade days).

What that means honestly:

- The **engine, risk mechanics, MAE math and cost drag are real**; the
  *relative* rankings reflect each strategy's ability to detect the regime
  it needs — but the regime mix itself is an assumption of the generator.
- The mean-reversion dominance is consistent with published research on
  index-futures intraday behavior, but **these numbers are not a track
  record**. The Sharpe shown is synthetic-inflated.
- **Validation path (do this before risking a dollar):**
  1. Run the Pine ports in `pine/` on real MNQ data in TradingView
     (Strategy Tester, 5-min chart) — that is a real-data backtest.
  2. On any machine with internet: `python3 data/fetch_real.py`
     (yfinance/Databento/CSV) then
     `python3 run_tournament.py --data results/mnq_1m_real.parquet`.
  3. Paper-trade before going live.

The tradingview-mcp server the task referenced could not be used from this
sandbox (its hosts are on the blocked side of the egress policy), so the
Pine ports are the direct TradingView path.

## What was tested (tournament families)

| family | strategies | verdict |
|---|---|---|
| Breakout / momentum | ORB, Donchian, Keltner squeeze, opening drive, MACD+VWAP, prev-day break | all negative after costs |
| Trend pullback | EMA 9/21, VWAP pullback, 3-bar pullback, Fibonacci 61.8% | flat to negative |
| Mean reversion | VWAP band fade, Bollinger snapback, RSI-2, midday extreme fade | positive, best family |
| Level-based | floor pivots, prior-day H/L retest, S/R swing clusters, IB fade | IB fade & pivots positive |
| Gap | gap-fill fade | positive, low frequency |
| Composites (rounds 2–4) | confirmation entries, limit-at-band entries, BE locks, time stops, regime gates | winner came from here |

Full per-strategy numbers, equity curves, MAE distributions and the
iteration log are in the dashboard.

## Methodology

- **Splits:** 349 train days → parameter grid search; 150 holdout days →
  every reported number. Train↔holdout consistency was checked (winner:
  PF 1.55→1.64, WRx 58.1→60.3 — no overfit cliff).
- **Fill realism:** signals on 5-min closes, fills at next bar open ±1 tick
  slippage; stops/targets/MAE simulated on 1-minute bars; worst-case
  intrabar ordering (stop before target); limit entries require 1-tick
  trade-through; flat by 15:55 ET, no overnight risk.
- **Costs:** $0.62/side commission + 1 tick slippage/side, $2/pt (MNQ).
- **MAE** is measured from actual fill price to the worst 1-minute extreme
  while in the trade — both in points and as a fraction of the stop.
- **Scratch-aware win rate (WRx):** breakeven-lock exits (|P&L| ≤ $5) are
  reported separately instead of polluting the win rate.
- Caveat: iterating across rounds re-used the same holdout, which leaks
  some information. Treat real-data validation as the true out-of-sample.

## Repo layout

```
data/synthetic.py     calibrated MNQ generator (used in-sandbox)
data/fetch_real.py    real-data fetcher (yfinance / Databento / CSV)
engine/backtest.py    fill simulator (brackets, BE lock, time stop, limits)
engine/metrics.py     MAE-centric metrics + composite score
engine/indicators.py  vectorized TA helpers
strategies/           library.py (18 base) + refined.py + round3.py + final.py
run_tournament.py     train/holdout tournament -> results/tournament.json
make_dashboard.py     -> dashboard/index.html (self-contained)
pine/                 Pine v6 ports: soa_range_fader_v1, vwap_fade_plus, ib_fade_pro
```

## Reproduce

```bash
pip install pandas numpy pyarrow
python3 data/synthetic.py        # or data/fetch_real.py for real bars
python3 run_tournament.py        # ~2 min
python3 make_dashboard.py        # regenerates dashboard/index.html
```

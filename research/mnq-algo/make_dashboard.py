"""Generate the self-contained research dashboard (single HTML file, no CDN).

  python3 make_dashboard.py            # reads results/tournament.json
  -> dashboard/index.html
"""
from __future__ import annotations

import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))


def slim(payload):
    """Trim heavy fields so the HTML stays lean."""
    for r in payload["results"]:
        r["trades_sample"] = r.get("trades_sample", [])[-40:]
        r.pop("mae_r_hist", None)
        if len(r.get("mae_hist", [])) > 600:
            r["mae_hist"] = r["mae_hist"][-600:]
    return payload


HTML = r"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>SOA · MNQ Intraday Algo Lab</title>
<style>
  :root{--bg:#0b0f17;--panel:#111827;--panel2:#0f1522;--line:#1f2a3d;--txt:#e5eaf3;
        --dim:#8b98ad;--green:#22c55e;--red:#ef4444;--gold:#f59e0b;--blue:#3b82f6;--cyan:#06b6d4}
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--txt);font:14px/1.5 -apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif}
  header{padding:28px 32px 12px}
  h1{margin:0;font-size:26px} h1 span{color:var(--gold)}
  .sub{color:var(--dim);margin-top:6px;max-width:1000px}
  .banner{margin:14px 32px;padding:12px 16px;border:1px solid #7c5c11;background:#251c06;border-radius:10px;color:#fbd38d;font-size:13px}
  .wrap{padding:0 32px 60px}
  .cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin:18px 0}
  .card{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:14px 16px}
  .card .v{font-size:22px;font-weight:700} .card .k{color:var(--dim);font-size:12px;margin-top:2px}
  .grid2{display:grid;grid-template-columns:1fr 1fr;gap:16px}
  @media(max-width:1100px){.grid2{grid-template-columns:1fr}}
  .panel{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:16px;margin:16px 0}
  .panel h2{margin:0 0 4px;font-size:16px} .panel .note{color:var(--dim);font-size:12px;margin-bottom:10px}
  table{width:100%;border-collapse:collapse;font-size:13px}
  th{color:var(--dim);text-align:right;padding:8px 8px;border-bottom:1px solid var(--line);cursor:pointer;white-space:nowrap;user-select:none}
  td{text-align:right;padding:7px 8px;border-bottom:1px solid var(--panel2);white-space:nowrap}
  th:first-child,td:first-child{text-align:left}
  tr.strat{cursor:pointer} tr.strat:hover{background:var(--panel2)}
  tr.sel{background:#16233b!important} tr.winner td:first-child::after{content:" 🏆"}
  .pos{color:var(--green)} .neg{color:var(--red)} .dimc{color:var(--dim)}
  .tag{display:inline-block;padding:1px 8px;border-radius:20px;font-size:11px;border:1px solid var(--line);color:var(--dim);margin-left:8px}
  svg text{fill:var(--dim);font-size:10px}
  .legend{display:flex;gap:16px;color:var(--dim);font-size:12px;margin-top:6px;flex-wrap:wrap}
  .dot{display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:5px}
  footer{color:var(--dim);font-size:12px;padding:20px 32px;border-top:1px solid var(--line)}
  a{color:var(--cyan)}
</style>
</head>
<body>
<header>
  <h1>MNQ Intraday Algo Lab <span>· SOA Research</span></h1>
  <div class="sub" id="meta"></div>
</header>
<div class="banner"><b>Data provenance:</b> this run was executed on a <b>calibrated synthetic MNQ dataset</b>
(sandbox has no market-data network access). Numbers rank strategies under identical, realistic conditions
(costs, sessions, tick grid) but are <b>not</b> a live-market track record. Re-run with
<code>data/fetch_real.py</code> on real MNQ bars, and validate the Pine ports on TradingView before risking capital.</div>
<div class="wrap">

  <div class="cards" id="wincards"></div>

  <div class="panel">
    <h2>Leaderboard — out-of-sample (holdout) results <span class="tag" id="holdinfo"></span></h2>
    <div class="note">Params chosen on the train segment only; every number below is from the untouched holdout.
    Click a column to sort · click a row to inspect. WR<sub>x</sub> = win rate excluding breakeven scratches.
    MAE = maximum adverse excursion per trade (points). Score = 30% WR<sub>x</sub> + 30% MAE-efficiency + 25% PF + 15% frequency.</div>
    <table id="lb"><thead></thead><tbody></tbody></table>
  </div>

  <div class="grid2">
    <div class="panel"><h2 id="eqtitle">Equity curve</h2>
      <div class="note">Cumulative net P&L, 1 contract, holdout days</div><div id="eq"></div></div>
    <div class="panel"><h2 id="maetitle">MAE distribution</h2>
      <div class="note">How far trades went against entry before resolving (points)</div><div id="mae"></div></div>
  </div>

  <div class="grid2">
    <div class="panel"><h2>Win rate vs. average MAE — all strategies</h2>
      <div class="note">Ideal corner: top-left (high win rate, small adverse excursion). Bubble = trade count, green = profitable.</div>
      <div id="scatter"></div></div>
    <div class="panel"><h2>Recent trades — selected strategy</h2>
      <div class="note">Last 40 holdout trades</div>
      <div style="max-height:420px;overflow:auto"><table id="trades"><thead></thead><tbody></tbody></table></div></div>
  </div>

  <div class="panel">
    <h2>Research log — how we got here</h2>
    <div class="note" style="max-width:1000px" id="log"></div>
  </div>
</div>
<footer>
  Engine: signals on 5-minute bars, fills/stops/MAE simulated on 1-minute bars · worst-case intrabar ordering
  (stop before target) · limit fills require 1-tick trade-through · flat by 15:55 ET ·
  <span id="cost"></span> · Pine ports in <code>research/mnq-algo/pine/</code>
</footer>
<script id="data" type="application/json">__DATA__</script>
<script>
const D = JSON.parse(document.getElementById('data').textContent);
const R = D.results.filter(r => (r.holdout.trades||0) > 0);
const fmt = (v,d=2) => v==null?'–':(+v).toFixed(d);
const money = v => (v<0?'-$':'$')+Math.abs(v).toFixed(0);

document.getElementById('meta').textContent =
  `${D.n_days} simulated sessions · train ${D.n_train} / holdout ${D.n_holdout} (from ${D.holdout_start}) · ${D.cost_model} · generated ${D.generated_at}`;
document.getElementById('holdinfo').textContent = `${D.n_holdout} days out-of-sample`;
document.getElementById('cost').textContent = D.cost_model;

const W = R[0];
const wc = document.getElementById('wincards');
const h0 = W.holdout;
[['Winner', W.name.replace(/_/g,' ')],
 ['Win rate (ex-scratch)', fmt(h0.win_rate_ex_scratch,1)+'%'],
 ['Profit factor', fmt(h0.profit_factor)],
 ['Median MAE', fmt(h0.med_mae,1)+' pts'],
 ['Winners’ avg MAE', fmt(h0.avg_mae_win,1)+' pts'],
 ['Expectancy', money(h0.expectancy)+' /trade'],
 ['P&L / day (1 ct)', money(h0.pnl_per_day)],
 ['Max drawdown', money(h0.max_dd)]
].forEach(([k,v])=>{wc.insertAdjacentHTML('beforeend',
  `<div class="card"><div class="v">${v}</div><div class="k">${k}</div></div>`)});

const COLS = [
  ['name','strategy',0],['trades','n',0],['win_rate','WR %',1],['win_rate_ex_scratch','WRx %',1],
  ['scratch_rate','scr %',1],['profit_factor','PF',2],['expectancy','exp $',2],
  ['avg_mae','MAE',1],['med_mae','medMAE',1],['avg_mae_r','MAE/stop',2],
  ['max_dd','maxDD $',0],['sharpe','Sharpe',1],['pnl_per_day','$ /day',0],['score','score',1]
];
let sortKey='score', sortDir=-1, selected=W.name;
function rowVal(r,k){ if(k==='name')return r.name; if(k==='score')return r.holdout_score; return r.holdout[k]; }
function renderLB(){
  const thead=document.querySelector('#lb thead');
  thead.innerHTML='<tr>'+COLS.map(([k,l])=>`<th data-k="${k}">${l}${sortKey===k?(sortDir<0?' ▾':' ▴'):''}</th>`).join('')+'</tr>';
  thead.querySelectorAll('th').forEach(th=>th.onclick=()=>{const k=th.dataset.k;
    if(sortKey===k)sortDir*=-1;else{sortKey=k;sortDir=-1;} renderLB();});
  const rows=[...R].sort((a,b)=>{const x=rowVal(a,sortKey),y=rowVal(b,sortKey);
    return (x<y?-1:x>y?1:0)*(typeof x==='string'?-sortDir:sortDir)*(typeof x==='string'?-1:1);});
  document.querySelector('#lb tbody').innerHTML=rows.map(r=>{
    const h=r.holdout, win=r.name===W.name?' winner':'', sel=r.name===selected?' sel':'';
    const cell=(k,d)=>{const v=rowVal(r,k);
      const cls=(k==='expectancy'||k==='pnl_per_day')?(v>0?'pos':'neg'):(k==='profit_factor'?(v>=1?'pos':'neg'):(k==='score'&&v<0?'dimc':''));
      if(k==='name')return `<td>${r.name.replace(/_/g,' ')}</td>`;
      if(k==='score'&&v<-1000)return `<td class="dimc">rejected</td>`;
      return `<td class="${cls}">${fmt(v,d)}</td>`;};
    return `<tr class="strat${win}${sel}" data-n="${r.name}">${COLS.map(([k,,d])=>cell(k,d)).join('')}</tr>`;
  }).join('');
  document.querySelectorAll('#lb tbody tr').forEach(tr=>tr.onclick=()=>{selected=tr.dataset.n;renderAll();});
}

function svgEl(w,h){return `<svg viewBox="0 0 ${w} ${h}" width="100%" preserveAspectRatio="none" style="height:${h}px">`}
function lineChart(el, pts, color){
  const w=560,h=260,p=38, n=pts.length;
  if(!n){document.getElementById(el).innerHTML='<div class="dimc">no trades</div>';return;}
  const ys=pts.map(p=>p.equity), xmin=0,xmax=n-1;
  let ymin=Math.min(0,...ys), ymax=Math.max(0,...ys); const pad=(ymax-ymin)*.08||1; ymin-=pad;ymax+=pad;
  const X=i=>p+(w-2*p)*(i-xmin)/Math.max(xmax-xmin,1), Y=v=>h-p-(h-2*p)*(v-ymin)/(ymax-ymin);
  let s=svgEl(w,h);
  for(let g=0;g<5;g++){const v=ymin+(ymax-ymin)*g/4;
    s+=`<line x1="${p}" x2="${w-p}" y1="${Y(v)}" y2="${Y(v)}" stroke="#1f2a3d" stroke-width="1"/>`;
    s+=`<text x="4" y="${Y(v)+3}">${money(v)}</text>`;}
  s+=`<line x1="${p}" x2="${w-p}" y1="${Y(0)}" y2="${Y(0)}" stroke="#31415e" stroke-dasharray="4 3"/>`;
  s+=`<path d="M${pts.map((pt,i)=>`${X(i)},${Y(pt.equity)}`).join(' L')}" fill="none" stroke="${color}" stroke-width="2"/>`;
  const step=Math.max(1,Math.floor(n/6));
  for(let i=0;i<n;i+=step)s+=`<text x="${X(i)-16}" y="${h-8}">${pts[i].date.slice(5)}</text>`;
  document.getElementById(el).innerHTML=s+'</svg>';
}
function histChart(el, vals, color){
  const w=560,h=260,p=38;
  if(!vals.length){document.getElementById(el).innerHTML='<div class="dimc">no trades</div>';return;}
  const mx=Math.max(...vals), nb=24, bw=(mx||1)/nb, bins=Array(nb).fill(0);
  vals.forEach(v=>bins[Math.min(nb-1,Math.floor(v/bw))]++);
  const bmax=Math.max(...bins);
  const X=i=>p+(w-2*p)*i/nb, Y=v=>h-p-(h-2*p)*v/bmax;
  let s=svgEl(w,h);
  for(let g=1;g<=4;g++){const v=bmax*g/4;
    s+=`<line x1="${p}" x2="${w-p}" y1="${Y(v)}" y2="${Y(v)}" stroke="#1f2a3d"/><text x="8" y="${Y(v)+3}">${Math.round(v)}</text>`;}
  bins.forEach((b,i)=>{s+=`<rect x="${X(i)+1}" y="${Y(b)}" width="${(w-2*p)/nb-2}" height="${h-p-Y(b)}" fill="${color}" opacity="0.85" rx="2"/>`;});
  for(let i=0;i<=nb;i+=6)s+=`<text x="${X(i)-6}" y="${h-8}">${(i*bw).toFixed(0)}</text>`;
  s+=`<text x="${w/2-30}" y="${h+0}"></text>`;
  document.getElementById(el).innerHTML=s+'</svg>';
}
function scatter(){
  const w=560,h=300,p=42, ok=R.filter(r=>r.holdout.trades>30);
  const xs=ok.map(r=>r.holdout.avg_mae), ys=ok.map(r=>r.holdout.win_rate_ex_scratch??r.holdout.win_rate);
  const xmin=Math.min(...xs)-5,xmax=Math.max(...xs)+5,ymin=Math.min(...ys)-4,ymax=Math.max(...ys)+4;
  const X=v=>p+(w-2*p)*(v-xmin)/(xmax-xmin), Y=v=>h-p-(h-2*p)*(v-ymin)/(ymax-ymin);
  let s=svgEl(w,h);
  for(let g=0;g<5;g++){const gy=ymin+(ymax-ymin)*g/4, gx=xmin+(xmax-xmin)*g/4;
    s+=`<line x1="${p}" x2="${w-p}" y1="${Y(gy)}" y2="${Y(gy)}" stroke="#1f2a3d"/><text x="6" y="${Y(gy)+3}">${gy.toFixed(0)}%</text>`;
    s+=`<text x="${X(gx)-8}" y="${h-10}">${gx.toFixed(0)}</text>`;}
  s+=`<text x="${w/2-60}" y="${h-0}" style="font-size:11px">avg MAE (points) →</text>`;
  ok.forEach(r=>{const hh=r.holdout, prof=hh.expectancy>0;
    const rad=5+9*Math.min(hh.trades/900,1);
    s+=`<circle cx="${X(hh.avg_mae)}" cy="${Y(hh.win_rate_ex_scratch??hh.win_rate)}" r="${rad}"
        fill="${prof?'#22c55e':'#ef4444'}" opacity="${r.name===selected?0.95:0.45}"
        stroke="${r.name===W.name?'#f59e0b':'none'}" stroke-width="2"><title>${r.name}
n=${hh.trades} WRx=${hh.win_rate_ex_scratch}% PF=${hh.profit_factor} MAE=${hh.avg_mae} exp=$${hh.expectancy}</title></circle>`;});
  document.getElementById('scatter').innerHTML=s+'</svg>'+
   `<div class="legend"><span><span class="dot" style="background:#22c55e"></span>profitable</span>
    <span><span class="dot" style="background:#ef4444"></span>losing</span>
    <span><span class="dot" style="background:none;border:2px solid #f59e0b"></span>winner</span>
    <span>bubble size = trades</span></div>`;
}
function renderTrades(r){
  const cols=['entry_ts','side','tag','entry','exit','reason','pts','pnl','mae_pts','mfe_pts'];
  document.querySelector('#trades thead').innerHTML='<tr>'+cols.map(c=>`<th>${c.replace('_ts','').replace('_pts','')}</th>`).join('')+'</tr>';
  document.querySelector('#trades tbody').innerHTML=(r.trades_sample||[]).slice().reverse().map(t=>
    `<tr>${cols.map(c=>{let v=t[c];
      if(c==='entry_ts')v=String(v).slice(5,16).replace('T',' ');
      if(c==='side')v=t.side>0?'LONG':'SHORT';
      const cls=c==='pnl'?(t.pnl>0?'pos':(Math.abs(t.pnl)<=5?'dimc':'neg')):'';
      return `<td class="${cls}">${v}</td>`;}).join('')}</tr>`).join('');
}
function renderAll(){
  const r=R.find(x=>x.name===selected)||W;
  renderLB();
  document.getElementById('eqtitle').textContent=`Equity curve — ${r.name.replace(/_/g,' ')}`;
  document.getElementById('maetitle').textContent=`MAE distribution — ${r.name.replace(/_/g,' ')}`;
  lineChart('eq', r.equity, r.holdout.total_pnl>=0?'#22c55e':'#ef4444');
  histChart('mae', r.mae_hist||[], '#3b82f6');
  scatter(); renderTrades(r);
}
document.getElementById('log').innerHTML = `
<b>Round 1 — 18 strategies, 6 families.</b> Breakout/momentum (ORB, Donchian, Keltner squeeze, opening drive,
MACD) all bled after costs. Mean-reversion (VWAP band fade, initial-balance fade, Bollinger snapback, gap fill,
RSI-2, floor pivots) carried positive expectancy. Best: vwap_band_fade — 55.7% WR, PF 1.51, avg MAE 33.7 pts.<br><br>
<b>Round 2 — confirmation entries + structure stops + breakeven locks.</b> Re-cross confirmation lifted win rate
and cut MAE but surrendered most of the expectancy (entering later = worse price). Breakeven lock on the IB fade
pushed PF to 2.53 with MAE 22.3 pts — but a third of trades scratch at breakeven, which crushes the RAW win rate
while protecting capital. Added scratch-aware metrics (WRx).<br><br>
<b>Round 3 — resting limit entries at the stretch.</b> Limit fills on the extension wick mechanically lower MAE
(fill at the best price of the excursion), at the cost of missing some winners. vwap_fade_plus (round-1 entry +
0.6R breakeven lock + 1.2×ATR stop) proved the best expectancy/MAE compromise.<br><br>
<b>Round 4 — SOA RangeFader v1 (winner).</b> Two complementary fade edges in one book: (A) VWAP stretch fade with
RSI(3) gate, in-extension entry, 0.5R breakeven lock; (B) initial-balance edge fade on non-extending days with
structure stop. 24-combo grid tuned on train only. Holdout: 60.3% WRx, PF 1.64, median MAE 19.8 pts,
winners' avg MAE 14.6 pts, ~$85/day per contract.`;
renderAll();
</script>
</body>
</html>"""


def main():
    with open(os.path.join(HERE, "results", "tournament.json")) as f:
        payload = slim(json.load(f))
    html = HTML.replace("__DATA__", json.dumps(payload).replace("</", "<\\/"))
    out = os.path.join(HERE, "dashboard", "index.html")
    with open(out, "w") as f:
        f.write(html)
    print(f"wrote {out} ({os.path.getsize(out)//1024} KB)")


if __name__ == "__main__":
    main()

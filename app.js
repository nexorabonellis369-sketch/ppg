/* ══════════════════════════════════════════════
   STOCKSAGE AI – app.js
   Complete application logic with simulated data,
   LSTM prediction engine, charts, and UI
   ══════════════════════════════════════════════ */

'use strict';

// ─── STOCKS DATA ───────────────────────────────────────────────
const STOCKS = {
  AAPL: { name: 'Apple Inc.', base: 185.20, sector: 'Technology' },
  TSLA: { name: 'Tesla Inc.', base: 248.50, sector: 'Automotive' },
  GOOGL: { name: 'Alphabet Inc.', base: 142.80, sector: 'Technology' },
  MSFT: { name: 'Microsoft Corp.', base: 378.90, sector: 'Technology' },
  AMZN: { name: 'Amazon.com', base: 184.60, sector: 'Consumer' },
  NVDA: { name: 'NVIDIA Corp.', base: 875.40, sector: 'Semiconductors' },
  META: { name: 'Meta Platforms', base: 478.20, sector: 'Technology' },
  NFLX: { name: 'Netflix Inc.', base: 612.30, sector: 'Media' },
  // Commodities
  GOLD: { name: 'Gold Spot', base: 2155.40, sector: 'Commodities' },
  SILVER: { name: 'Silver Spot', base: 24.85, sector: 'Commodities' },
  CRUDE: { name: 'Crude Oil', base: 82.30, sector: 'Commodities' },
  COPPER: { name: 'Copper Spot', base: 4.12, sector: 'Commodities' },
};

const TICKERS_TAPE = [
  'AAPL', 'TSLA', 'GOOGL', 'MSFT', 'AMZN', 'NVDA', 'META', 'NFLX',
  'GOLD', 'SILVER', 'CRUDE', 'COPPER',
  'RELIANCE', 'INFY', 'TCS', 'HDFC', 'JPM', 'BAC', 'AMD', 'INTC',
  'DIS', 'UBER', 'LYFT', 'SPOT',
];

let isLoggedIn = localStorage.getItem('stocksage_logged_in') === 'true';

// ─── UTILITY ───────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const fmt = n => '$' + n.toFixed(2);
const fmtN = (n, d = 2) => n.toFixed(d);
const rnd = (min, max) => Math.random() * (max - min) + min;
const randInt = (min, max) => Math.floor(rnd(min, max));

// Pseudo-random seeded, deterministic per ticker
function seeded(seed) {
  let s = seed;
  return function () {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function generatePriceHistory(base, days, ticker) {
  const rand = seeded(ticker.charCodeAt(0) + ticker.charCodeAt(1));
  const prices = [base];
  for (let i = 1; i < days; i++) {
    const change = (rand() - 0.48) * (base * 0.025);
    prices.push(Math.max(prices[i - 1] + change, base * 0.5));
  }
  return prices;
}

function generateLSTMPrediction(prices) {
  // Simulate LSTM prediction: smoothed trend + small offset
  return prices.map((p, i) => {
    const window = prices.slice(Math.max(0, i - 10), i + 1);
    const ma = window.reduce((a, b) => a + b, 0) / window.length;
    const noise = (Math.random() - 0.49) * p * 0.008;
    return +(ma + noise + p * 0.003).toFixed(2);
  });
}

function generateBollingerBands(prices, period = 20) {
  const upper = [], lower = [];
  for (let i = 0; i < prices.length; i++) {
    const slice = prices.slice(Math.max(0, i - period + 1), i + 1);
    const ma = slice.reduce((a, b) => a + b, 0) / slice.length;
    const std = Math.sqrt(slice.reduce((s, v) => (s + (v - ma) ** 2), 0) / slice.length);
    upper.push(+(ma + 2 * std).toFixed(2));
    lower.push(+(ma - 2 * std).toFixed(2));
  }
  return { upper, lower };
}

function generateRSI(prices, period = 14) {
  const rsi = [];
  for (let i = 0; i < prices.length; i++) {
    if (i < period) { rsi.push(50); continue; }
    let gains = 0, losses = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const d = prices[j] - prices[j - 1];
      if (d > 0) gains += d; else losses -= d;
    }
    const rs = gains / period / (losses / period || 0.001);
    rsi.push(+(100 - 100 / (1 + rs)).toFixed(2));
  }
  return rsi;
}

function generateMACD(prices) {
  function ema(data, period) {
    const k = 2 / (period + 1), result = [data[0]];
    for (let i = 1; i < data.length; i++) result.push(data[i] * k + result[i - 1] * (1 - k));
    return result;
  }
  const ema12 = ema(prices, 12), ema26 = ema(prices, 26);
  const macd = prices.map((_, i) => +(ema12[i] - ema26[i]).toFixed(2));
  const signal = ema(macd, 9).map(v => +v.toFixed(2));
  const hist = macd.map((v, i) => +(v - signal[i]).toFixed(2));
  return { macd, signal, hist };
}

// Date array for last N days
function dateArray(days) {
  const dates = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    dates.push(d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }));
  }
  return dates;
}

// ─── INDICATOR SIGNALS ─────────────────────────────────────────
function getIndicatorSignals(prices, rsi, macd) {
  const last = prices[prices.length - 1];
  const prev = prices[prices.length - 2];
  const lastRSI = rsi[rsi.length - 1];
  const lastMACD = macd.macd[macd.macd.length - 1];
  const lastSig = macd.signal[macd.signal.length - 1];
  const ma20 = prices.slice(-20).reduce((a, b) => a + b, 0) / 20;
  const ma50 = prices.slice(-50).reduce((a, b) => a + b, 0) / 50;
  const ma200 = prices.slice(-200).reduce((a, b) => a + b, 0) / 200;

  function sig(cond) { return cond ? 'bullish' : 'bearish'; }

  return [
    {
      name: 'RSI (14)', value: lastRSI.toFixed(1),
      signal: lastRSI < 30 ? 'bullish' : lastRSI > 70 ? 'bearish' : 'neutral'
    },
    {
      name: 'MACD', value: lastMACD.toFixed(2),
      signal: sig(lastMACD > lastSig)
    },
    {
      name: 'MA 20', value: fmt(ma20),
      signal: sig(last > ma20)
    },
    {
      name: 'MA 50', value: fmt(ma50),
      signal: sig(last > ma50)
    },
    {
      name: 'MA 200', value: fmt(ma200),
      signal: sig(last > ma200)
    },
    {
      name: 'Bollinger Bands', value: 'Mid: ' + fmt(ma20),
      signal: last < ma20 * 0.98 ? 'bullish' : last > ma20 * 1.02 ? 'bearish' : 'neutral'
    },
    {
      name: 'Price Change', value: ((last - prev) / prev * 100).toFixed(2) + '%',
      signal: sig(last > prev)
    },
    {
      name: 'SMA Cross', value: ma20 > ma50 ? 'Golden' : 'Death',
      signal: sig(ma20 > ma50)
    },
    {
      name: 'EMA 12 vs 26', value: lastMACD.toFixed(2),
      signal: sig(lastMACD > 0)
    },
    {
      name: 'Volume OBV', value: '+' + randInt(500, 4000) + 'K',
      signal: Math.random() > 0.4 ? 'bullish' : 'neutral'
    },
    {
      name: 'Stochastic %K', value: rnd(20, 80).toFixed(1),
      signal: 'neutral'
    },
    {
      name: 'ATR (14)', value: (last * 0.018).toFixed(2),
      signal: 'neutral'
    },
    {
      name: 'Williams %R', value: '-' + rnd(20, 60).toFixed(1),
      signal: Math.random() > 0.5 ? 'bullish' : 'neutral'
    },
    {
      name: 'Parabolic SAR', value: fmt(last * 0.985),
      signal: sig(last > last * 0.985)
    },
    {
      name: 'Ichimoku Cloud', value: 'Above',
      signal: Math.random() > 0.4 ? 'bullish' : 'neutral'
    },
    {
      name: 'CCI (20)', value: rnd(-100, 100).toFixed(1),
      signal: 'neutral'
    },
  ];
}

// ─── RECOMMENDATION ENGINE ─────────────────────────────────────
function computeRecommendation(prices, rsi, macdData) {
  const signals = getIndicatorSignals(prices, rsi, macdData);
  const counts = { bullish: 0, bearish: 0, neutral: 0 };
  signals.forEach(s => counts[s.signal]++);
  const score = (counts.bullish - counts.bearish) / signals.length;
  let action, conf;
  if (score > 0.2) { action = 'buy'; conf = Math.min(95, 55 + score * 150); }
  else if (score < -0.2) { action = 'sell'; conf = Math.min(95, 55 + Math.abs(score) * 150); }
  else { action = 'hold'; conf = 45 + Math.random() * 20; }
  const last = prices[prices.length - 1];
  const target = action === 'buy' ? last * 1.072 : action === 'sell' ? last * 0.938 : last * 1.01;
  const stop = action === 'buy' ? last * 0.962 : action === 'sell' ? last * 1.04 : last * 0.97;
  return { action, conf: Math.round(conf), target, stop, signals };
}

// ─── CHART REGISTRY ────────────────────────────────────────────
const charts = {};
let mainChartInstance = null;
let dashChartInstance = null;

function destroyChart(id) {
  if (charts[id]) { charts[id].destroy(); delete charts[id]; }
}
function destroyLW(ref) { if (ref) { try { ref.remove(); } catch (e) { } } }

// ─── LIGHTWEIGHT CHARTS HELPERS ────────────────────────────────
function createLineChart(containerId) {
  const container = $(containerId);
  if (!container) return null;
  container.innerHTML = '';

  // Wait for next frame to get layout info if hidden
  const w = container.offsetWidth || 600;
  const h = container.offsetHeight || parseInt(container.style.height) || 300;

  const chart = LightweightCharts.createChart(container, {
    width: w,
    height: h,
    layout: { background: { color: 'transparent' }, textColor: '#9AA5BE', fontFamily: 'Inter' },
    grid: { vertLines: { color: 'rgba(255,255,255,0.04)' }, horzLines: { color: 'rgba(255,255,255,0.04)' } },
    rightPriceScale: { borderColor: 'rgba(255,255,255,0.08)' },
    timeScale: { borderColor: 'rgba(255,255,255,0.08)', timeVisible: true },
    crosshair: { mode: LightweightCharts.CrosshairMode.Normal },
  });

  new ResizeObserver(() => {
    if (container.offsetWidth > 0) {
      chart.applyOptions({
        width: container.offsetWidth,
        height: container.offsetHeight || parseInt(container.style.height) || 300
      });
    }
  }).observe(container);

  return chart;
}

// ─── TOPBAR CLOCK ──────────────────────────────────────────────
function updateClock() {
  const now = new Date();
  const t = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const d = now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  $('topbar-time').textContent = d + '  ' + t;
}
setInterval(updateClock, 1000); updateClock();

// ─── TICKER TAPE ───────────────────────────────────────────────
function buildTickerTape() {
  const items = TICKERS_TAPE.map(t => {
    const base = (STOCKS[t]?.base || rnd(50, 800));
    const chg = (Math.random() - 0.47) * 3;
    const dir = chg >= 0;
    return `<span class="ticker-item">
      <span class="ticker-sym">${t}</span>
      <span class="ticker-price">${fmt(base)}</span>
      <span class="${dir ? 'up' : 'down'}">${dir ? '▲' : '▼'} ${Math.abs(chg).toFixed(2)}%</span>
    </span>`;
  });
  const inner = items.join('') + items.join(''); // doubled for seamless scroll
  $('ticker-tape').innerHTML = `<div class="ticker-inner">${inner}</div>`;
}
buildTickerTape();

// ─── NAVIGATION ────────────────────────────────────────────────
const VIEWS = ['dashboard', 'analysis', 'portfolio', 'backtest', 'model', 'settings'];
function switchView(view) {
  VIEWS.forEach(v => {
    $('view-' + v)?.classList.toggle('active', v === view);
    $('nav-' + v)?.classList.toggle('active', v === view);
  });

  switch (view) {
    case 'dashboard':
      // Dashboard is partially dynamic, but we can refresh components if needed
      break;
    case 'analysis':
      initAnalysisView();
      break;
    case 'portfolio':
      initPortfolioView();
      break;
    case 'backtest':
      initBacktestView();
      break;
    case 'model':
      initModelView();
      break;
  }
}

document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', (e) => {
    e.preventDefault();
    const view = item.getAttribute('data-view');
    if (view) switchView(view);
    // mobile close
    $('sidebar').classList.remove('open');
  });
});

// Auth Init
initAuth();

// If logged in, show app
if (isLoggedIn) {
  document.body.classList.remove('auth-locked');
  document.getElementById('auth-screen').style.display = 'none';
  switchView('dashboard');
}

// Initial Data
updateIndices();
$('hamburger').addEventListener('click', () => {
  $('sidebar').classList.toggle('open');
});

// ─── SEARCH ────────────────────────────────────────────────────
const searchInput = $('search-input');
const searchResults = $('search-results');
searchInput.addEventListener('input', () => {
  const q = searchInput.value.trim().toUpperCase();
  if (!q) { searchResults.style.display = 'none'; return; }
  const matches = Object.entries(STOCKS).filter(([k, v]) =>
    k.includes(q) || v.name.toUpperCase().includes(q)
  );
  if (!matches.length) { searchResults.style.display = 'none'; return; }
  searchResults.innerHTML = matches.map(([sym, info]) => `
    <div class="search-result-item" onclick="selectTicker('${sym}')">
      <span class="sri-symbol">${sym}</span>
      <span class="sri-name">${info.name}</span>
    </div>
  `).join('');
  searchResults.style.display = 'block';
});
document.addEventListener('click', e => {
  if (!e.target.closest('.search-bar')) searchResults.style.display = 'none';
});
window.selectTicker = function (sym) {
  searchInput.value = '';
  searchResults.style.display = 'none';
  $('analysis-ticker').value = sym;
  switchView('analysis');
  setTimeout(() => runAnalysis(sym), 100);
};

// ═══════════════════════════════════════════════════════════════
//  VIEW: DASHBOARD
// ═══════════════════════════════════════════════════════════════
function initDashboard() {
  buildWatchlist();
  buildSentimentChart();
  buildDashPriceChart('AAPL');
  buildRecoGrid();
  // Tabs
  document.querySelectorAll('#dash-ticker-tabs .tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#dash-ticker-tabs .tab').forEach(t => t.classList.remove('active'));
      btn.classList.add('active');
      buildDashPriceChart(btn.dataset.ticker);
    });
  });
  $('refresh-watchlist').addEventListener('click', buildWatchlist);
}

function buildWatchlist() {
  const container = $('watchlist-table');
  const rows = Object.entries(STOCKS).map(([sym, info]) => {
    const price = info.base + rnd(-info.base * 0.03, info.base * 0.03);
    const chg = rnd(-3, 4);
    const dir = chg >= 0;
    const prices = generatePriceHistory(info.base, 90, sym);
    const rsi = generateRSI(prices);
    const macdData = generateMACD(prices);
    const rec = computeRecommendation(prices, rsi, macdData);
    const signal = rec.action;
    return `<div class="watchlist-row">
      <div>
        <div class="wl-symbol">${sym}</div>
        <div class="wl-name">${info.name}</div>
      </div>
      <div class="wl-price">${fmt(price)}</div>
      <div class="${dir ? 'up' : 'down'}">${dir ? '▲' : '▼'} ${Math.abs(chg).toFixed(2)}%</div>
      <div class="wl-signal ${signal}">${signal.toUpperCase()}</div>
      <div style="font-size:11px;color:var(--text3)">${info.sector}</div>
    </div>`;
  });
  container.innerHTML = `
    <div class="watchlist-header">
      <div>Symbol</div><div>Price</div><div>Change</div><div>Signal</div><div>Sector</div>
    </div>
    ${rows.join('')}
  `;
}

function buildSentimentChart() {
  destroyChart('sentiment-chart');
  const ctx = $('sentiment-chart').getContext('2d');
  charts['sentiment-chart'] = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Bullish', 'Neutral', 'Bearish'],
      datasets: [{
        data: [62, 22, 16],
        backgroundColor: ['rgba(0,209,122,0.8)', 'rgba(255,209,102,0.6)', 'rgba(255,69,96,0.8)'],
        borderColor: 'transparent',
        borderWidth: 0,
        hoverOffset: 10,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      cutout: '70%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: '#9AA5BE', usePointStyle: true, padding: 16, font: { size: 12 } },
        },
        tooltip: {
          callbacks: { label: c => ` ${c.label}: ${c.parsed}%` },
        },
      },
    },
  });
}

function buildDashPriceChart(ticker) {
  destroyLW(dashChartInstance);
  const info = STOCKS[ticker] || STOCKS.AAPL;
  const titleEl = document.getElementById('dash-chart-title');
  if (titleEl) titleEl.textContent = `Live Price Feed – ${ticker}`;

  const days = 60;
  const prices = generatePriceHistory(info.base, days, ticker);
  const predicted = generateLSTMPrediction(prices);
  const { upper, lower } = generateBollingerBands(prices);
  const dates = dateArray(days);

  const chart = createLineChart('dash-price-chart');
  dashChartInstance = chart;

  const ts = dates.map((d, i) => ({ time: `2024-${String(i + 1).padStart(2, '0')}-01`, value: prices[i] }));
  // deduplicate times for lightweight charts
  const toTS = (arr) => arr.map((v, i) => ({ time: 1700000000 + i * 86400, value: v }));

  const actualSeries = chart.addLineSeries({ color: '#3A9EFD', lineWidth: 2, title: 'Actual' });
  actualSeries.setData(toTS(prices));
  const predSeries = chart.addLineSeries({ color: '#B57BFF', lineWidth: 2, lineStyle: 2, title: 'LSTM' });
  predSeries.setData(toTS(predicted));
  const upperSeries = chart.addLineSeries({ color: 'rgba(255,140,66,0.5)', lineWidth: 1, title: 'Upper BB' });
  upperSeries.setData(toTS(upper));
  const lowerSeries = chart.addLineSeries({ color: 'rgba(255,69,96,0.5)', lineWidth: 1, title: 'Lower BB' });
  lowerSeries.setData(toTS(lower));
  chart.timeScale().fitContent();
}

function buildRecoGrid() {
  const tickers = ['AAPL', 'TSLA', 'GOOGL', 'MSFT', 'GOLD', 'SILVER'];
  const html = tickers.map(sym => {
    const info = STOCKS[sym];
    const prices = generatePriceHistory(info.base, 90, sym);
    const rsi = generateRSI(prices);
    const macdData = generateMACD(prices);
    const rec = computeRecommendation(prices, rsi, macdData);
    const last = prices[prices.length - 1];
    const first = prices[0];
    const pct = ((last - first) / first * 100).toFixed(2);
    const dir = pct >= 0;
    return `<div class="reco-card">
      <div class="reco-card-top">
        <div class="reco-ticker">${sym}</div>
        <div class="reco-pill ${rec.action}">${rec.action.toUpperCase()}</div>
      </div>
      <div style="font-size:12px;color:var(--text2);margin-top:4px">${info.name}</div>
      <div class="reco-price-line">
        <div class="reco-price">${fmt(last)}</div>
        <div class="reco-pct ${dir ? 'up' : 'down'}">${dir ? '+' : ''}${pct}%</div>
      </div>
      <div class="reco-conf-bar-wrap">
        <div class="reco-conf-label">AI Confidence: ${rec.conf}%</div>
      <div class="reco-conf-bar"><div class="reco-conf-fill" style="width:${rec.conf}%"></div></div>
      </div>
    </div>`;
  }).join('');
  $('reco-grid').innerHTML = html;
  renderDashboardNews();
}

function renderDashboardNews() {
  const container = document.getElementById('dashboard-news');
  const news = [
    { title: "Fed Interest Rate Decision: Markets Brace for Volatility", time: "12m ago", sent: 0.2, source: "Reuters" },
    { title: "Apple (AAPL) Services Revenue Beats Estimates by 14%", time: "45m ago", sent: 0.8, source: "Bloomberg" },
    { title: "Tech Sector Rotation: Analysts Signal Bearish Momentum", time: "1h ago", sent: -0.6, source: "CNBC" },
    { title: "Institutional Inflows into Bitcoin reaching 2-year Highs", time: "2h ago", sent: 0.7, source: "WSJ" },
    { title: "Global Supply Chain Constraints Impacting Semiconductor Yield", time: "3h ago", sent: -0.4, source: "FT" },
    { title: "NVIDIA (NVDA) Unveils Next-Gen AI Infrastructure at Keynote", time: "5h ago", sent: 0.9, source: "TechCrunch" },
  ];

  container.innerHTML = news.map(n => `
    <div class="news-item">
      <div class="news-meta">
        <span>${n.source} • ${n.time}</span>
        <span class="news-sent ${n.sent > 0 ? 'bull' : 'bear'}">
          ${n.sent > 0 ? '▲ BULLISH' : '▼ BEARISH'}
        </span>
      </div>
      <div class="news-title">${n.title}</div>
    </div>
  `).join('');
}

// ═══════════════════════════════════════════════════════════════
//  VIEW: ANALYSIS
// ═══════════════════════════════════════════════════════════════
let analysisInitialized = false;
function initAnalysisView() {
  if (!analysisInitialized) {
    analysisInitialized = true;
    $('run-analysis').addEventListener('click', () => {
      runAnalysis($('analysis-ticker').value);
    });
    $('chart-type-line').addEventListener('click', () => {
      $('chart-type-line').classList.add('active');
      $('chart-type-candle').classList.remove('active');
      runAnalysis($('analysis-ticker').value, 'line');
    });
    $('chart-type-candle').addEventListener('click', () => {
      $('chart-type-candle').classList.add('active');
      $('chart-type-line').classList.remove('active');
      runAnalysis($('analysis-ticker').value, 'candle');
    });
  }
  // Use a small timeout to ensure the view is display:block and has dimensions
  setTimeout(() => runAnalysis($('analysis-ticker').value), 50);
}

function runAnalysis(ticker, chartType = 'line') {
  const info = STOCKS[ticker] || STOCKS.AAPL;
  const period = parseInt($('analysis-period').value) || 90;
  const prices = generatePriceHistory(info.base, period, ticker);
  const predicted = generateLSTMPrediction(prices);
  const { upper, lower } = generateBollingerBands(prices);
  const rsi = generateRSI(prices);
  const macdData = generateMACD(prices);
  const rec = computeRecommendation(prices, rsi, macdData);
  const last = prices[prices.length - 1];

  // Update hero
  $('analysis-chart-title').textContent = `${ticker} – Price Chart & LSTM Prediction`;
  const pill = $('signal-pill');
  pill.className = 'signal-pill ' + rec.action;
  pill.textContent = rec.action.toUpperCase();
  $('signal-conf-value').textContent = rec.conf + '%';
  $('reco-current').textContent = fmt(last);
  $('reco-target').textContent = fmt(rec.target);
  $('reco-stop').textContent = fmt(rec.stop);
  $('reco-predicted').textContent = fmt(predicted[predicted.length - 1]);

  // Main Price Chart
  destroyLW(mainChartInstance);
  const mainContainer = $('main-price-chart');
  mainContainer.innerHTML = '';
  const chart = createLineChart('main-price-chart');
  mainChartInstance = chart;
  const toTS = (arr) => arr.map((v, i) => ({ time: 1700000000 + i * 86400, value: v }));

  if (chartType === 'candle') {
    const candleSeries = chart.addCandlestickSeries({
      upColor: '#00D17A', downColor: '#FF4560',
      borderUpColor: '#00D17A', borderDownColor: '#FF4560',
      wickUpColor: '#00D17A', wickDownColor: '#FF4560',
    });
    const candles = prices.map((close, i) => {
      const open = i === 0 ? close : prices[i - 1];
      const high = Math.max(open, close) * (1 + rnd(0, 0.012));
      const low = Math.min(open, close) * (1 - rnd(0, 0.012));
      return { time: 1700000000 + i * 86400, open, high, low, close };
    });
    candleSeries.setData(candles);
  } else {
    const actualS = chart.addLineSeries({ color: '#3A9EFD', lineWidth: 2.5 });
    actualS.setData(toTS(prices));
  }
  const predS = chart.addLineSeries({ color: '#B57BFF', lineWidth: 2, lineStyle: 2 });
  predS.setData(toTS(predicted));
  const upS = chart.addLineSeries({ color: 'rgba(255,140,66,0.55)', lineWidth: 1 });
  upS.setData(toTS(upper));
  const lowS = chart.addLineSeries({ color: 'rgba(255,69,96,0.55)', lineWidth: 1 });
  lowS.setData(toTS(lower));
  chart.timeScale().fitContent();

  // RSI Chart
  destroyChart('rsi-chart');
  const rsiCtx = $('rsi-chart').getContext('2d');
  const rsiSlice = rsi.slice(-60);
  const labels60 = dateArray(60);
  charts['rsi-chart'] = new Chart(rsiCtx, {
    type: 'line',
    data: {
      labels: labels60,
      datasets: [
        {
          label: 'RSI', data: rsiSlice, borderColor: '#6C63FF', backgroundColor: 'rgba(108,99,255,0.05)',
          borderWidth: 2, tension: 0.4, pointRadius: 0, fill: true
        },
        {
          label: 'Overbought', data: Array(60).fill(70), borderColor: 'rgba(255,69,96,0.4)',
          borderWidth: 1, borderDash: [4, 4], pointRadius: 0
        },
        {
          label: 'Oversold', data: Array(60).fill(30), borderColor: 'rgba(0,209,122,0.4)',
          borderWidth: 1, borderDash: [4, 4], pointRadius: 0
        },
      ],
    },
    options: chartOpts(false),
  });
  const lastRSI = rsiSlice[rsiSlice.length - 1];
  const rsiBadge = $('rsi-badge');
  rsiBadge.className = 'indicator-badge badge ' + (lastRSI > 70 ? 'orange' : lastRSI < 30 ? 'green' : 'blue');
  rsiBadge.textContent = `RSI: ${lastRSI.toFixed(1)} – ${lastRSI > 70 ? 'Overbought' : lastRSI < 30 ? 'Oversold' : 'Neutral'}`;

  // MACD Chart
  destroyChart('macd-chart');
  const macdCtx = $('macd-chart').getContext('2d');
  const ml = macdData.macd.slice(-60);
  const sl = macdData.signal.slice(-60);
  const hl = macdData.hist.slice(-60);
  charts['macd-chart'] = new Chart(macdCtx, {
    type: 'bar',
    data: {
      labels: labels60,
      datasets: [
        { type: 'line', label: 'MACD', data: ml, borderColor: '#3A9EFD', borderWidth: 2, tension: 0.4, pointRadius: 0 },
        { type: 'line', label: 'Signal', data: sl, borderColor: '#FF8C42', borderWidth: 2, tension: 0.4, pointRadius: 0 },
        {
          type: 'bar', label: 'Histogram', data: hl,
          backgroundColor: hl.map(v => v >= 0 ? 'rgba(0,209,122,0.5)' : 'rgba(255,69,96,0.5)'),
          borderColor: 'transparent',
        },
      ],
    },
    options: chartOpts(false),
  });
  const macdLast = ml[ml.length - 1];
  const sigLast = sl[sl.length - 1];
  const macdBadge = $('macd-badge');
  macdBadge.className = 'indicator-badge badge ' + (macdLast > sigLast ? 'green' : 'orange');
  macdBadge.textContent = `MACD ${macdLast > sigLast ? 'Bullish Crossover' : 'Bearish Crossover'}`;

  // Indicator Table
  const signals = getIndicatorSignals(prices, rsi, macdData);
  $('indicator-table').innerHTML = signals.map(s => `
    <div class="ind-row">
      <div class="ind-name">${s.name}</div>
      <div class="ind-value">${s.value}</div>
      <div class="ind-signal ${s.signal}">${s.signal.toUpperCase()}</div>
    </div>
  `).join('');
}

function chartOpts(legend = true) {
  return {
    responsive: true, maintainAspectRatio: false,
    interaction: { intersect: false, mode: 'index' },
    plugins: {
      legend: { display: legend, labels: { color: '#9AA5BE', usePointStyle: true, font: { size: 11 } } },
      tooltip: {
        backgroundColor: '#141829', borderColor: 'rgba(255,255,255,0.08)', borderWidth: 1,
        titleColor: '#E8ECF4', bodyColor: '#9AA5BE'
      },
    },
    scales: {
      x: { ticks: { color: '#5A6480', maxTicksLimit: 8, font: { size: 11 } }, grid: { color: 'rgba(255,255,255,0.04)' } },
      y: { ticks: { color: '#5A6480', font: { size: 11 } }, grid: { color: 'rgba(255,255,255,0.04)' }, position: 'right' },
    },
  };
}

// ══════════ AUTH LOGIC ══════════
function initAuth() {
  const form = document.getElementById('auth-form');
  const toggle = document.getElementById('auth-toggle');
  const submitBtn = document.getElementById('auth-submit');
  const subtext = document.getElementById('auth-subtext');
  const logoutBtn = document.getElementById('logout-btn');
  let isLoginMode = true;

  toggle.addEventListener('click', (e) => {
    e.preventDefault();
    isLoginMode = !isLoginMode;
    submitBtn.textContent = isLoginMode ? 'Sign In' : 'Create Account';
    subtext.textContent = isLoginMode ? 'Sign in to your intelligent trading floor' : 'Join the elite algorithmic trading community';
    document.getElementById('auth-toggle-text').innerHTML = isLoginMode
      ? 'Don\'t have an account? <a href="#" id="auth-toggle">Create Account</a>'
      : 'Already have an account? <a href="#" id="auth-toggle">Sign In</a>';

    // Re-attach listener since we replaced innerHTML
    document.getElementById('auth-toggle').addEventListener('click', (e) => {
      e.preventDefault();
      toggle.click();
    });
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    submitBtn.innerHTML = '<span class="loader"></span> Authenticating...';
    submitBtn.disabled = true;

    setTimeout(() => {
      isLoggedIn = true;
      localStorage.setItem('stocksage_logged_in', 'true');
      document.body.classList.remove('auth-locked');
      document.getElementById('auth-screen').style.opacity = '0';
      setTimeout(() => {
        document.getElementById('auth-screen').style.display = 'none';
        switchView('dashboard');
      }, 400);
    }, 1500);
  });

  logoutBtn.addEventListener('click', () => {
    isLoggedIn = false;
    localStorage.removeItem('stocksage_logged_in');
    location.reload(); // Hard reset for simulation
  });
}

// ═══════════════════════════════════════════════════════════════
//  VIEW: PORTFOLIO
// ═══════════════════════════════════════════════════════════════
const portfolioHoldings = [
  { sym: 'AAPL', shares: 20, avgCost: 160.00 },
  { sym: 'TSLA', shares: 8, avgCost: 210.00 },
  { sym: 'MSFT', shares: 12, avgCost: 340.00 },
  { sym: 'NVDA', shares: 5, avgCost: 780.00 },
  { sym: 'AMZN', shares: 15, avgCost: 170.00 },
];

let portfolioInitialized = false;
function initPortfolioView() {
  if (portfolioInitialized) return;
  portfolioInitialized = true;
  renderPortfolio();
  $('add-holding-btn').addEventListener('click', () => {
    const sym = prompt('Enter ticker (e.g. GOOGL):', 'GOOGL')?.toUpperCase();
    if (!sym || !STOCKS[sym]) { alert('Unknown ticker.'); return; }
    const shares = parseFloat(prompt('Number of shares:', '10') || '0');
    const cost = parseFloat(prompt('Average cost (USD):', STOCKS[sym].base.toFixed(2)) || '0');
    if (shares > 0 && cost > 0) {
      portfolioHoldings.push({ sym, shares, avgCost: cost });
      renderPortfolio();
    }
  });
}

function renderPortfolio() {
  let totalVal = 0, totalCost = 0;
  const rows = portfolioHoldings.map(h => {
    const info = STOCKS[h.sym] || { base: h.avgCost, name: 'Unknown', sector: 'Other' };
    const price = info.base + rnd(-info.base * 0.02, info.base * 0.02);
    const val = price * h.shares;
    const cost = h.avgCost * h.shares;
    const pnl = val - cost;
    const pct = ((pnl / cost) * 100).toFixed(2);
    totalVal += val; totalCost += cost;
    return { sym: h.sym, shares: h.shares, price, val, pnl, pct };
  });
  const totalPnl = totalVal - totalCost;
  $('port-total').textContent = '$' + totalVal.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  $('port-pnl').textContent = (totalPnl >= 0 ? '+$' : '-$') + Math.abs(totalPnl).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  $('port-pnl').className = 'stat-value ' + (totalPnl >= 0 ? 'up' : 'down');

  $('holdings-table').innerHTML = `
    <div class="holdings-header">
      <div>Symbol</div><div>Shares</div><div>Price</div><div>Value</div><div>P&L</div><div>%</div>
    </div>
    ${rows.map(r => `
      <div class="holding-row">
        <div class="holding-ticker">${r.sym}</div>
        <div>${r.shares}</div>
        <div class="holding-val">${fmt(r.price)}</div>
        <div class="holding-val">$${r.val.toFixed(0)}</div>
        <div class="${r.pnl >= 0 ? 'up' : 'down'}">${r.pnl >= 0 ? '+$' : '-$'}${Math.abs(r.pnl).toFixed(0)}</div>
        <div class="${r.pnl >= 0 ? 'up' : 'down'}">${r.pnl >= 0 ? '+' : ''}${r.pct}%</div>
      </div>
    `).join('')}
  `;

  // Allocation pie
  destroyChart('allocation-chart');
  const labels = portfolioHoldings.map(h => h.sym);
  const values = rows.map(r => r.val);
  const colors = ['#6C63FF', '#3ECFCF', '#00D17A', '#FF8C42', '#FF4560', '#FFD166', '#3A9EFD', '#B57BFF'];
  const ctx = $('allocation-chart').getContext('2d');
  charts['allocation-chart'] = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: colors.slice(0, labels.length).map(c => c + 'BB'),
        borderColor: colors.slice(0, labels.length),
        borderWidth: 2,
        hoverOffset: 10,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: '60%',
      plugins: {
        legend: { position: 'bottom', labels: { color: '#9AA5BE', usePointStyle: true, padding: 12, font: { size: 11.5 } } },
        tooltip: { callbacks: { label: c => `  ${c.label}: $${c.parsed.toFixed(0)}` } },
      },
    },
  });

  // Performance chart
  destroyChart('portfolio-perf-chart');
  const perfCtx = $('portfolio-perf-chart').getContext('2d');
  const days = 60, portPrices = [], benchPrices = [];
  let pv = totalCost, bv = totalCost;
  for (let i = 0; i < days; i++) {
    pv += rnd(-pv * 0.015, pv * 0.018);
    bv += rnd(-bv * 0.01, bv * 0.013);
    portPrices.push(+pv.toFixed(2));
    benchPrices.push(+bv.toFixed(2));
  }
  charts['portfolio-perf-chart'] = new Chart(perfCtx, {
    type: 'line',
    data: {
      labels: dateArray(days),
      datasets: [
        {
          label: 'My Portfolio', data: portPrices, borderColor: '#6C63FF', backgroundColor: 'rgba(108,99,255,0.07)',
          borderWidth: 2, tension: 0.4, fill: true, pointRadius: 0
        },
        { label: 'NIFTY 50 Bench', data: benchPrices, borderColor: '#3A9EFD', borderWidth: 2, tension: 0.4, pointRadius: 0 },
      ],
    },
    options: chartOpts(true),
  });
}

// ═══════════════════════════════════════════════════════════════
//  VIEW: BACKTESTING
// ═══════════════════════════════════════════════════════════════
let backtestInitialized = false;
function initBacktestView() {
  if (backtestInitialized) return;
  backtestInitialized = true;
  $('run-backtest').addEventListener('click', runBacktest);
}

function runBacktest() {
  const ticker = $('bt-ticker').value;
  const capital = parseFloat($('bt-capital').value) || 10000;
  const strategy = $('bt-strategy').value;
  const info = STOCKS[ticker] || STOCKS.AAPL;
  const days = 252;
  const prices = generatePriceHistory(info.base, days, ticker);
  const rsi = generateRSI(prices);
  const macdData = generateMACD(prices);

  // Simulate trades based on strategy
  let equity = capital, trades = [], equityCurve = [capital];
  let position = null;
  for (let i = 14; i < prices.length; i++) {
    const p = prices[i];
    const r = rsi[i];
    let signal = 'hold';
    if (strategy === 'lstm') signal = Math.random() > 0.48 ? 'buy' : Math.random() > 0.5 ? 'sell' : 'hold';
    else if (strategy === 'rsi') signal = r < 30 ? 'buy' : r > 70 ? 'sell' : 'hold';
    else if (strategy === 'macd') {
      const md = macdData.macd; const sg = macdData.signal;
      signal = md[i] > sg[i] && md[i - 1] <= sg[i - 1] ? 'buy' : md[i] < sg[i] && md[i - 1] >= sg[i - 1] ? 'sell' : 'hold';
    } else signal = Math.random() > 0.45 ? 'buy' : Math.random() > 0.5 ? 'sell' : 'hold';

    if (signal === 'buy' && !position) {
      const shares = Math.floor(equity * 0.95 / p);
      if (shares > 0) { position = { shares, entryPrice: p, entryDay: i }; }
    } else if (signal === 'sell' && position) {
      const pnl = position.shares * (p - position.entryPrice);
      const fee = p * position.shares * 0.001;
      equity += pnl - fee;
      trades.push({
        day: i, type: 'SELL', price: p, shares: position.shares,
        pnl: +(pnl - fee).toFixed(2), equity: +equity.toFixed(2)
      });
      position = null;
    }
    if (position) equity = capital + position.shares * (p - position.entryPrice);
    equityCurve.push(+equity.toFixed(2));
  }

  // Stats
  const finalEquity = equityCurve[equityCurve.length - 1];
  const totalReturn = ((finalEquity - capital) / capital * 100).toFixed(2);
  const numTrades = trades.length;
  const wins = trades.filter(t => t.pnl > 0).length;
  const winRate = numTrades ? (wins / numTrades * 100).toFixed(1) : 0;
  const maxDD = computeMaxDD(equityCurve).toFixed(2);
  const sharpe = (rnd(0.8, 2.2)).toFixed(2);

  // Show results
  const results = $('backtest-results');
  results.style.display = 'block';
  $('bt-strategy-badge').textContent = strategy.toUpperCase() + ' Strategy';

  $('bt-stats-row').innerHTML = `
    <div class="stat-card glass">
      <div class="stat-icon ${+totalReturn >= 0 ? 'green' : 'red'}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>
      </div>
      <div class="stat-body">
        <div class="stat-value ${+totalReturn >= 0 ? 'up' : 'down'}">${+totalReturn >= 0 ? '+' : ''}${totalReturn}%</div>
        <div class="stat-label">Total Return</div>
      </div>
    </div>
    <div class="stat-card glass">
      <div class="stat-icon blue"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg></div>
      <div class="stat-body">
        <div class="stat-value">${numTrades}</div>
        <div class="stat-label">Total Trades</div>
      </div>
    </div>
    <div class="stat-card glass">
      <div class="stat-icon green"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg></div>
      <div class="stat-body">
        <div class="stat-value">${winRate}%</div>
        <div class="stat-label">Win Rate</div>
      </div>
    </div>
    <div class="stat-card glass">
      <div class="stat-icon purple"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg></div>
      <div class="stat-body">
        <div class="stat-value">${sharpe}</div>
        <div class="stat-label">Sharpe Ratio</div>
      </div>
    </div>
  `;

  // Equity curve chart
  destroyChart('backtest-equity-chart');
  const btCtx = $('backtest-equity-chart').getContext('2d');
  charts['backtest-equity-chart'] = new Chart(btCtx, {
    type: 'line',
    data: {
      labels: Array.from({ length: equityCurve.length }, (_, i) => 'Day ' + (i + 1)),
      datasets: [
        {
          label: 'Portfolio Value', data: equityCurve, borderColor: '#6C63FF',
          backgroundColor: 'rgba(108,99,255,0.08)', borderWidth: 2.5,
          tension: 0.4, fill: true, pointRadius: 0
        },
        {
          label: 'Benchmark', data: equityCurve.map((_, i) => capital * (1 + i * 0.00035)),
          borderColor: 'rgba(58,158,253,0.5)', borderWidth: 1.5,
          borderDash: [4, 4], tension: 0.4, pointRadius: 0
        },
      ],
    },
    options: chartOpts(true),
  });

  // Trade log
  const logRows = trades.slice(-20).reverse().map(t => `
    <div class="trade-row">
      <div class="trade-${t.type.toLowerCase()}">${t.type}</div>
      <div>Day ${t.day}</div>
      <div>${fmt(t.price)}</div>
      <div>${t.shares}</div>
      <div class="${t.pnl >= 0 ? 'up' : 'down'}">${t.pnl >= 0 ? '+$' : '-$'}${Math.abs(t.pnl).toFixed(2)}</div>
      <div>$${t.equity.toLocaleString()}</div>
    </div>
  `).join('');
  $('trade-log').innerHTML = `
    <div class="trade-row trade-header">
      <div>Action</div><div>Day</div><div>Price</div><div>Shares</div><div>P&L</div><div>Equity</div>
    </div>
    ${logRows || '<div style="padding:16px;color:var(--text2)">No closed trades yet.</div>'}
  `;
}

function computeMaxDD(curve) {
  let peak = curve[0], maxDD = 0;
  for (const v of curve) {
    if (v > peak) peak = v;
    const dd = (peak - v) / peak * 100;
    if (dd > maxDD) maxDD = dd;
  }
  return maxDD;
}

// ═══════════════════════════════════════════════════════════════
//  VIEW: LSTM MODEL
// ═══════════════════════════════════════════════════════════════
let modelInitialized = false;
function initModelView() {
  if (modelInitialized) return;
  modelInitialized = true;
  buildLSTMArch();
  buildLossChart();
  buildMetricsTable();
  buildConfigGrid();
}

function buildLSTMArch() {
  const layers = [
    { label: 'Input Layer', sublabel: '60 timesteps × 1', nodes: 6, type: 'input' },
    { label: 'LSTM Layer 1', sublabel: '64 units + Dropout 0.2', nodes: 8, type: 'lstm' },
    { label: 'LSTM Layer 2', sublabel: '128 units + Dropout 0.2', nodes: 10, type: 'lstm2' },
    { label: 'LSTM Layer 3', sublabel: '64 units + Dropout 0.2', nodes: 8, type: 'lstm' },
    { label: 'Dense Layer', sublabel: '32 units (ReLU)', nodes: 5, type: 'dense' },
    { label: 'Output Layer', sublabel: '1 unit (Price)', nodes: 1, type: 'output' },
  ];
  const typeColor = { input: '#3A9EFD', lstm: '#6C63FF', lstm2: '#B57BFF', dense: '#3ECFCF', output: '#00D17A' };

  $('lstm-arch').innerHTML = layers.map((l, i) => `
    ${i > 0 ? '<div class="arch-arrow">→</div>' : ''}
    <div class="arch-layer">
      <div class="arch-nodes">
        ${Array.from({ length: l.nodes }, (_, j) => `
          <div class="arch-node" style="background:${typeColor[l.type]};opacity:${0.4 + j * 0.06}"></div>
        `).join('')}
        ${l.nodes < 10 ? '' : ''}
      </div>
      <div class="arch-label" style="color:${typeColor[l.type]}">${l.label}</div>
      <div class="arch-sublabel">${l.sublabel}</div>
    </div>
  `).join('');
}

function buildLossChart() {
  destroyChart('loss-chart');
  const ctx = $('loss-chart').getContext('2d');
  const epochs = Array.from({ length: 50 }, (_, i) => i + 1);
  let trainLoss = 0.08, valLoss = 0.09;
  const trainLosses = [], valLosses = [];
  for (let i = 0; i < 50; i++) {
    trainLoss *= (0.93 + Math.random() * 0.04);
    valLoss *= (0.94 + Math.random() * 0.05);
    trainLosses.push(+trainLoss.toFixed(5));
    valLosses.push(+valLoss.toFixed(5));
  }
  charts['loss-chart'] = new Chart(ctx, {
    type: 'line',
    data: {
      labels: epochs,
      datasets: [
        {
          label: 'Training Loss (MSE)', data: trainLosses, borderColor: '#6C63FF',
          backgroundColor: 'rgba(108,99,255,0.06)', borderWidth: 2, tension: 0.4, fill: true, pointRadius: 0
        },
        {
          label: 'Validation Loss', data: valLosses, borderColor: '#FF8C42',
          borderWidth: 2, tension: 0.4, pointRadius: 0
        },
      ],
    },
    options: {
      ...chartOpts(true), scales: {
        x: { title: { display: true, text: 'Epoch', color: '#5A6480' }, ticks: { color: '#5A6480' }, grid: { color: 'rgba(255,255,255,0.04)' } },
        y: { title: { display: true, text: 'Loss (MSE)', color: '#5A6480' }, ticks: { color: '#5A6480' }, grid: { color: 'rgba(255,255,255,0.04)' } },
      }
    },
  });
}

function buildMetricsTable() {
  const metrics = [
    { name: 'Directional Accuracy', val: '78.4%', cls: 'green' },
    { name: 'RMSE (Normalized)', val: '0.01832', cls: 'blue' },
    { name: 'MAPE (%)', val: '2.14%', cls: 'blue' },
    { name: 'R² Score', val: '0.9412', cls: 'purple' },
    { name: 'Training Epochs', val: '50', cls: '' },
    { name: 'Batch Size', val: '32', cls: '' },
    { name: 'Lookback Window', val: '60 days', cls: '' },
    { name: 'Optimizer', val: 'Adam (lr=0.001)', cls: '' },
  ];
  $('metrics-table').innerHTML = metrics.map(m => `
    <div class="metric-row">
      <span class="metric-name">${m.name}</span>
      <span class="metric-val ${m.cls}">${m.val}</span>
    </div>
  `).join('');
}

function buildConfigGrid() {
  const config = [
    { key: 'Architecture', val: 'LSTM + Dense' },
    { key: 'Input Shape', val: '(60, 1)' },
    { key: 'Hidden Units', val: '64 → 128 → 64' },
    { key: 'Dropout Rate', val: '0.20' },
    { key: 'Learning Rate', val: '0.001' },
    { key: 'Loss Function', val: 'MSE' },
    { key: 'Scaler', val: 'Min-Max [0,1]' },
    { key: 'Framework', val: 'TensorFlow/Keras' },
    { key: 'Features', val: '45 Engineered' },
    { key: 'Train/Test', val: '80% / 20%' },
    { key: 'Batch Size', val: '32' },
    { key: 'Epochs', val: '50 (Early Stop)' },
  ];
  $('config-grid').innerHTML = config.map(c => `
    <div class="config-item">
      <div class="config-key">${c.key}</div>
      <div class="config-val">${c.val}</div>
    </div>
  `).join('');
}

// ─── LIVE PRICE ANIMATION ──────────────────────────────────────
function animateLiveStats() {
  const statAcc = $('stat-accuracy');
  const statRMSE = $('stat-rmse');
  if (!statAcc) return;
  // Micro-vary values
  setInterval(() => {
    const acc = (78 + rnd(0, 1)).toFixed(1) + '%';
    const rmse = (0.018 + rnd(0, 0.002)).toFixed(4);
    const sharp = (1.5 + rnd(0, 0.3)).toFixed(2);
    statAcc.textContent = acc;
    statRMSE.textContent = rmse;
    $('stat-sharpe').textContent = sharp;
  }, 4000);
}

// ─── INIT ──────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  initDashboard();
  animateLiveStats();
  initAuth();

  if (isLoggedIn) {
    document.body.classList.remove('auth-locked');
    document.getElementById('auth-screen').style.display = 'none';
    switchView('dashboard');
  } else {
    // Show auth screen explicitly if not logged in
    document.getElementById('auth-screen').style.display = 'flex';
  }
});

// ============================================
// DEVPULSE — app.js
// ============================================

// ── Helpers ──────────────────────────────────

function formatPrice(num) {
  if (num >= 1) return '$' + num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return '$' + num.toFixed(6);
}

function formatMarketCap(num) {
  if (num >= 1e12) return '$' + (num / 1e12).toFixed(2) + 'T';
  if (num >= 1e9) return '$' + (num / 1e9).toFixed(2) + 'B';
  return '$' + (num / 1e6).toFixed(2) + 'M';
}

// ── Fetch Crypto Prices ───────────────────────

async function fetchCryptoPrices() {
  try {
    const res = await fetch(
      'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=8&page=1&sparkline=false&price_change_percentage=24h',
      { headers: { 'x-cg-demo-api-key': CONFIG.COINGECKO_KEY } }
    );
    const data = await res.json();
    return data;
  } catch (err) {
    console.error('Crypto fetch error:', err);
    return [];
  }
}

// ── Fetch News ────────────────────────────────

async function fetchNews() {
  try {
    const res = await fetch(
      `https://newsdata.io/api/1/news?apikey=${CONFIG.NEWSDATA_KEY}&category=technology&language=en&size=6`
    );
    const data = await res.json();
    return data.results || [];
  } catch (err) {
    console.error('News fetch error:', err);
    return [];
  }
}

// ── Fetch Global Market Stats ─────────────────

async function fetchGlobalStats() {
  try {
    const res = await fetch('https://api.coingecko.com/api/v3/global', {
      headers: { 'x-cg-demo-api-key': CONFIG.COINGECKO_KEY }
    });
    const data = await res.json();
    return data.data;
  } catch (err) {
    console.error('Global stats error:', err);
    return null;
  }
}

// ── Render Home Ticker ────────────────────────

function renderTicker(coins) {
  const ticker = document.getElementById('ticker');
  if (!ticker) return;
  if (coins.length === 0) {
    ticker.innerHTML = `<p class="text-red-400 col-span-4 text-xs">Failed to load prices. Check your API key.</p>`;
    return;
  }
  ticker.innerHTML = coins.slice(0, 4).map(coin => {
    const change = coin.price_change_percentage_24h?.toFixed(2) ?? '0.00';
    const isUp = parseFloat(change) >= 0;
    return `
      <div class="bg-card border border-border hover:border-indigo-500/30 rounded-xl p-4 transition cursor-pointer" onclick="window.location='markets.html'">
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center gap-2">
            <img src="${coin.image}" class="w-5 h-5 rounded-full" />
            <span class="text-xs text-slate-400 font-medium uppercase">${coin.symbol}</span>
          </div>
          <span class="text-xs font-semibold px-1.5 py-0.5 rounded ${isUp ? 'text-emerald-400 bg-emerald-400/10' : 'text-red-400 bg-red-400/10'}">
            ${isUp ? '▲' : '▼'} ${Math.abs(change)}%
          </span>
        </div>
        <div class="text-white font-bold text-base">${formatPrice(coin.current_price)}</div>
        <div class="text-xs text-slate-600 mt-0.5 truncate">${coin.name}</div>
      </div>
    `;
  }).join('');
}

// ── Render News Preview ───────────────────────

function renderNewsPreview(articles) {
  const container = document.getElementById('newsPreview');
  if (!container) return;
  if (articles.length === 0) {
    container.innerHTML = `<p class="text-red-400 col-span-3 text-xs">Failed to load news. Check your API key.</p>`;
    return;
  }
  container.innerHTML = articles.slice(0, 3).map(article => `
    <a href="${article.link}" target="_blank" class="bg-card border border-border hover:border-indigo-500/30 rounded-xl p-5 block transition group">
      <div class="text-xs text-indigo-400 font-semibold mb-2 uppercase tracking-wide">${article.source_id}</div>
      <h3 class="text-white font-semibold text-sm leading-snug mb-2 group-hover:text-indigo-300 transition line-clamp-3">${article.title}</h3>
      <p class="text-slate-500 text-xs line-clamp-2 leading-relaxed">${article.description || 'Read full article →'}</p>
    </a>
  `).join('');
}

// ── Render Global Stats ───────────────────────

function renderGlobalStats(stats) {
  if (!stats) return;
  const coins = document.getElementById('statCoins');
  const cap = document.getElementById('statMarketCap');
  const dom = document.getElementById('statDominance');
  if (coins) coins.textContent = stats.active_cryptocurrencies?.toLocaleString() ?? '—';
  if (cap) cap.textContent = formatMarketCap(stats.total_market_cap?.usd ?? 0);
  if (dom) dom.textContent = (stats.market_cap_percentage?.btc ?? 0).toFixed(1) + '%';
}

// ── Init Home Page ────────────────────────────

async function initHome() {
  if (!document.getElementById('ticker')) return;
  const [coins, articles, stats] = await Promise.all([
    fetchCryptoPrices(),
    fetchNews(),
    fetchGlobalStats()
  ]);
  renderTicker(coins);
  renderNewsPreview(articles);
  renderGlobalStats(stats);
}

initHome();

// ============================================
// MARKETS PAGE
// ============================================

let priceChart = null;
let allCoins = [];

// ── Fetch 7-Day Sparkline ─────────────────────

async function fetchSparkline(coinId) {
  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=usd&days=7`,
      { headers: { 'x-cg-demo-api-key': CONFIG.COINGECKO_KEY } }
    );
    const data = await res.json();
    return data.prices.map(p => p[1]);
  } catch (err) {
    console.error('Sparkline error:', err);
    return [];
  }
}

// ── Render Price Chart ────────────────────────

async function renderChart(coinId, coinName) {
  document.getElementById('selectedCoin').textContent = coinName;
  const prices = await fetchSparkline(coinId);
  if (!prices.length) return;

  const labels = prices.map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (7 - Math.floor((i / prices.length) * 7)));
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  });

  const isUp = prices[prices.length - 1] >= prices[0];
  const lineColor = isUp ? '#6366f1' : '#ef4444';
  const fillColor = isUp ? 'rgba(99,102,241,0.12)' : 'rgba(239,68,68,0.12)';

  if (priceChart) priceChart.destroy();

  const ctx = document.getElementById('priceChart').getContext('2d');
  priceChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        data: prices,
        borderColor: lineColor,
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.4,
        fill: true,
        backgroundColor: (context) => {
          const chart = context.chart;
          const { ctx: c, chartArea } = chart;
          if (!chartArea) return 'transparent';
          const gradient = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
          gradient.addColorStop(0, fillColor);
          gradient.addColorStop(1, 'rgba(0,0,0,0)');
          return gradient;
        }
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { intersect: false, mode: 'index' },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#131620',
          borderColor: '#1e2130',
          borderWidth: 1,
          titleColor: '#818cf8',
          bodyColor: '#94a3b8',
          titleFont: { family: 'Inter', size: 11 },
          bodyFont: { family: 'Inter', size: 11 },
          callbacks: {
            label: (ctx) => ' $' + ctx.raw.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
          }
        }
      },
      scales: {
        x: {
          ticks: { color: '#334155', font: { family: 'Inter', size: 10 }, maxTicksLimit: 7, maxRotation: 0 },
          grid: { color: '#1e2130' },
          border: { color: '#1e2130' }
        },
        y: {
          ticks: { color: '#334155', font: { family: 'Inter', size: 10 }, callback: (val) => '$' + val.toLocaleString() },
          grid: { color: '#1e2130' },
          border: { color: '#1e2130' }
        }
      }
    }
  });
}

// ── Render Chart Buttons ──────────────────────

function renderChartButtons(coins) {
  const container = document.getElementById('chartBtns');
  if (!container) return;
  container.innerHTML = coins.slice(0, 4).map((coin, i) => `
    <button
      onclick="renderChart('${coin.id}', '${coin.name}')"
      class="text-xs px-3 py-1.5 rounded-lg border font-medium transition ${i === 0
        ? 'border-indigo-500 bg-indigo-500/10 text-indigo-400'
        : 'border-border text-slate-500 hover:border-slate-600 hover:text-slate-300'}"
    >
      ${coin.symbol.toUpperCase()}
    </button>
  `).join('');
}

// ── Render Coins Table ────────────────────────

function renderCoinsTable(coins) {
  const table = document.getElementById('coinsTable');
  if (!table) return;
  table.innerHTML = coins.map(coin => {
    const change = coin.price_change_percentage_24h?.toFixed(2) ?? '0.00';
    const isUp = parseFloat(change) >= 0;
    const watchlist = JSON.parse(localStorage.getItem('watchlist') || '[]');
    const inWatchlist = watchlist.some(w => w.id === coin.id);
    return `
      <div class="grid grid-cols-6 items-center px-6 py-4 border-b border-border hover:bg-white/[0.02] transition group">
        <div class="col-span-2 flex items-center gap-3">
          <img src="${coin.image}" class="w-7 h-7 rounded-full" />
          <div>
            <div class="text-white text-sm font-semibold">${coin.name}</div>
            <div class="text-slate-600 text-xs uppercase">${coin.symbol}</div>
          </div>
        </div>
        <div class="text-right text-white text-sm font-semibold">${formatPrice(coin.current_price)}</div>
        <div class="text-right">
          <span class="text-xs font-semibold px-1.5 py-0.5 rounded ${isUp ? 'text-emerald-400 bg-emerald-400/10' : 'text-red-400 bg-red-400/10'}">
            ${isUp ? '▲' : '▼'} ${Math.abs(change)}%
          </span>
        </div>
        <div class="text-right text-xs text-slate-500">${formatMarketCap(coin.market_cap)}</div>
        <div class="text-right">
          <button
            onclick="toggleWatchlist(${JSON.stringify(coin).replace(/"/g, '&quot;')})"
            class="text-xs px-3 py-1.5 rounded-lg border font-medium transition ${inWatchlist
              ? 'border-indigo-500 bg-indigo-500/10 text-indigo-400'
              : 'border-border text-slate-600 hover:border-slate-600 hover:text-slate-300'}"
          >
            ${inWatchlist ? '✓ Watching' : '+ Watch'}
          </button>
        </div>
      </div>
    `;
  }).join('');
}

// ── Toggle Watchlist ──────────────────────────

function toggleWatchlist(coin) {
  let watchlist = JSON.parse(localStorage.getItem('watchlist') || '[]');
  const exists = watchlist.some(w => w.id === coin.id);
  if (exists) {
    watchlist = watchlist.filter(w => w.id !== coin.id);
  } else {
    watchlist.push({
      id: coin.id,
      name: coin.name,
      symbol: coin.symbol,
      image: coin.image,
      current_price: coin.current_price,
      price_change_percentage_24h: coin.price_change_percentage_24h,
      market_cap: coin.market_cap
    });
  }
  localStorage.setItem('watchlist', JSON.stringify(watchlist));
  renderCoinsTable(allCoins);
}

// ── Init Markets Page ─────────────────────────

async function initMarkets() {
  if (!document.getElementById('coinsTable')) return;
  const coins = await fetchCryptoPrices();
  allCoins = coins;
  renderChartButtons(coins);
  renderCoinsTable(coins);
  if (coins.length > 0) renderChart(coins[0].id, coins[0].name);
}

initMarkets();

// ============================================
// NEWS PAGE
// ============================================

let allArticles = [];
let currentCategory = 'all';
let currentSearch = '';

// ── Fetch News by Category ────────────────────

async function fetchNewsByCategory(category) {
  try {
    const cat = category === 'all' ? 'technology' : category;
    const res = await fetch(
      `https://newsdata.io/api/1/news?apikey=${CONFIG.NEWSDATA_KEY}&category=${cat}&language=en&size=9`
    );
    const data = await res.json();
    return data.results || [];
  } catch (err) {
    console.error('News fetch error:', err);
    return [];
  }
}

// ── Render News Grid ──────────────────────────

function renderNewsGrid(articles) {
  const grid = document.getElementById('newsGrid');
  const count = document.getElementById('articleCount');
  if (!grid) return;

  const filtered = articles.filter(a => {
    const q = currentSearch.toLowerCase();
    return (
      a.title?.toLowerCase().includes(q) ||
      a.description?.toLowerCase().includes(q) ||
      a.source_id?.toLowerCase().includes(q)
    );
  });

  if (count) count.textContent = `${filtered.length} article${filtered.length !== 1 ? 's' : ''} found`;

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div class="col-span-3 text-center py-16">
        <div class="text-slate-600 text-sm">No articles found for that search.</div>
      </div>
    `;
    return;
  }

  grid.innerHTML = filtered.map((article, i) => {
    const isFeature = i === 0;
    return `
      <a href="${article.link}" target="_blank"
        class="${isFeature ? 'md:col-span-2' : ''}
        bg-card border border-border hover:border-indigo-500/30
        rounded-xl p-5 block transition group">
        <div class="flex items-center justify-between mb-3">
          <div class="text-xs text-indigo-400 font-semibold uppercase tracking-wide">${article.source_id || 'Unknown'}</div>
          ${isFeature ? '<span class="text-xs bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded-full font-medium">Featured</span>' : ''}
        </div>
        <h3 class="text-white font-semibold leading-snug mb-2 group-hover:text-indigo-300 transition ${isFeature ? 'text-base' : 'text-sm line-clamp-3'}">
          ${article.title}
        </h3>
        <p class="text-slate-500 text-xs leading-relaxed ${isFeature ? 'line-clamp-3' : 'line-clamp-2'}">
          ${article.description || 'Read full article →'}
        </p>
        <div class="mt-4 text-xs text-slate-600 group-hover:text-indigo-400 transition font-medium">
          Read more →
        </div>
      </a>
    `;
  }).join('');
}

// ── Filter by Category ────────────────────────

async function filterNews(category) {
  currentCategory = category;
  currentSearch = '';

  const input = document.getElementById('searchInput');
  if (input) input.value = '';

  const btns = document.querySelectorAll('.filter-btn');
  btns.forEach(btn => {
    btn.classList.remove('border-indigo-500', 'bg-indigo-500/10', 'text-indigo-400');
    btn.classList.add('border-border', 'text-slate-500');
  });

  const categoryMap = { all: 'all', technology: 'tech', science: 'scie', business: 'busi' };
  const active = [...btns].find(b =>
    b.textContent.trim().toLowerCase().startsWith(categoryMap[category] || category.slice(0, 4))
  );
  if (active) {
    active.classList.add('border-indigo-500', 'bg-indigo-500/10', 'text-indigo-400');
    active.classList.remove('border-border', 'text-slate-500');
  }

  const grid = document.getElementById('newsGrid');
  if (grid) {
    grid.innerHTML = `
      <div class="bg-card border border-border rounded-xl p-4 animate-pulse h-48"></div>
      <div class="bg-card border border-border rounded-xl p-4 animate-pulse h-48"></div>
      <div class="bg-card border border-border rounded-xl p-4 animate-pulse h-48"></div>
    `;
  }

  allArticles = await fetchNewsByCategory(category);
  renderNewsGrid(allArticles);
}

// ── Search Filter ─────────────────────────────

function searchNews(query) {
  currentSearch = query;
  renderNewsGrid(allArticles);
}

// ── Init News Page ────────────────────────────

async function initNews() {
  if (!document.getElementById('newsGrid')) return;
  allArticles = await fetchNewsByCategory('all');
  renderNewsGrid(allArticles);
}

initNews();

// ============================================
// WATCHLIST PAGE
// ============================================

// ── Load Watchlist from localStorage ─────────

function loadWatchlist() {
  return JSON.parse(localStorage.getItem('watchlist') || '[]');
}

// ── Render Summary Cards ──────────────────────

function renderSummaryCards(coins) {
  const container = document.getElementById('summaryCards');
  if (!container) return;

  if (coins.length === 0) {
    container.innerHTML = '';
    return;
  }

  const gainers = coins.filter(c => c.price_change_percentage_24h >= 0);
  const losers = coins.filter(c => c.price_change_percentage_24h < 0);
  const totalValue = coins.reduce((sum, c) => sum + c.current_price, 0);
  const avgChange = coins.reduce((sum, c) => sum + (c.price_change_percentage_24h ?? 0), 0) / coins.length;
  const isAvgUp = avgChange >= 0;

  container.innerHTML = `
    <div class="bg-card border border-border rounded-xl p-5">
      <div class="text-xs text-slate-500 font-medium mb-2 uppercase tracking-wider">Coins Watching</div>
      <div class="text-2xl font-bold text-white">${coins.length}</div>
      <div class="text-xs text-slate-600 mt-1">${gainers.length} gaining · ${losers.length} losing</div>
    </div>
    <div class="bg-card border border-border rounded-xl p-5">
      <div class="text-xs text-slate-500 font-medium mb-2 uppercase tracking-wider">Avg 24h Change</div>
      <div class="text-2xl font-bold ${isAvgUp ? 'text-emerald-400' : 'text-red-400'}">
        ${isAvgUp ? '▲' : '▼'} ${Math.abs(avgChange).toFixed(2)}%
      </div>
      <div class="text-xs text-slate-600 mt-1">Across all watched coins</div>
    </div>
    <div class="bg-card border border-border rounded-xl p-5">
      <div class="text-xs text-slate-500 font-medium mb-2 uppercase tracking-wider">Best Performer</div>
      <div class="text-2xl font-bold text-indigo-400">
        ${coins.sort((a, b) => b.price_change_percentage_24h - a.price_change_percentage_24h)[0]?.symbol?.toUpperCase() ?? '—'}
      </div>
      <div class="text-xs text-slate-600 mt-1">
        ▲ ${Math.abs(coins[0]?.price_change_percentage_24h?.toFixed(2) ?? 0)}% today
      </div>
    </div>
  `;
}

// ── Render Watchlist Table ────────────────────

function renderWatchlistTable(coins) {
  const container = document.getElementById('watchlistContainer');
  const countEl = document.getElementById('watchlistCount');
  if (!container) return;

  if (countEl) countEl.textContent = `${coins.length} coin${coins.length !== 1 ? 's' : ''}`;

  if (coins.length === 0) {
    container.innerHTML = `
      <div class="bg-card border border-border rounded-2xl p-16 text-center">
        <div class="w-14 h-14 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mx-auto mb-5">
          <svg class="w-6 h-6 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M5 3l14 9-14 9V3z"/>
          </svg>
        </div>
        <div class="text-white font-semibold text-base mb-2">Your watchlist is empty</div>
        <div class="text-slate-500 text-sm mb-6">Head to Markets and click "+ Watch" on any coin to start tracking it here.</div>
        <a href="markets.html" class="inline-block bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-semibold px-6 py-2.5 rounded-lg transition">
          Browse Markets
        </a>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="bg-card border border-border rounded-2xl overflow-hidden">
      <div class="grid grid-cols-6 text-xs text-slate-600 uppercase tracking-wider px-6 py-3 border-b border-border font-medium">
        <span class="col-span-2">Asset</span>
        <span class="text-right">Price</span>
        <span class="text-right">24h Change</span>
        <span class="text-right">Market Cap</span>
        <span class="text-right">Action</span>
      </div>
      ${coins.map(coin => {
        const change = coin.price_change_percentage_24h?.toFixed(2) ?? '0.00';
        const isUp = parseFloat(change) >= 0;
        return `
          <div class="grid grid-cols-6 items-center px-6 py-4 border-b border-border hover:bg-white/[0.02] transition group last:border-b-0">
            <div class="col-span-2 flex items-center gap-3">
              <img src="${coin.image}" class="w-8 h-8 rounded-full" />
              <div>
                <div class="text-white text-sm font-semibold">${coin.name}</div>
                <div class="text-slate-600 text-xs uppercase">${coin.symbol}</div>
              </div>
            </div>
            <div class="text-right text-white text-sm font-semibold">${formatPrice(coin.current_price)}</div>
            <div class="text-right">
              <span class="text-xs font-semibold px-1.5 py-0.5 rounded ${isUp ? 'text-emerald-400 bg-emerald-400/10' : 'text-red-400 bg-red-400/10'}">
                ${isUp ? '▲' : '▼'} ${Math.abs(change)}%
              </span>
            </div>
            <div class="text-right text-xs text-slate-500">${formatMarketCap(coin.market_cap)}</div>
            <div class="text-right">
              <button
                onclick="removeFromWatchlist('${coin.id}')"
                class="text-xs px-3 py-1.5 rounded-lg border border-border text-slate-600 hover:border-red-500/40 hover:text-red-400 transition font-medium"
              >
                Remove
              </button>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

// ── Remove Single Coin ────────────────────────

function removeFromWatchlist(coinId) {
  let watchlist = loadWatchlist();
  watchlist = watchlist.filter(c => c.id !== coinId);
  localStorage.setItem('watchlist', JSON.stringify(watchlist));
  const updated = loadWatchlist();
  renderSummaryCards(updated);
  renderWatchlistTable(updated);
}

// ── Clear All ─────────────────────────────────

function clearWatchlist() {
  if (!confirm('Remove all coins from your watchlist?')) return;
  localStorage.removeItem('watchlist');
  renderSummaryCards([]);
  renderWatchlistTable([]);
}

// ── Init Watchlist Page ───────────────────────

function initWatchlist() {
  if (!document.getElementById('watchlistContainer')) return;
  const coins = loadWatchlist();
  renderSummaryCards(coins);
  renderWatchlistTable(coins);
}

initWatchlist();
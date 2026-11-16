// Token Launch Radar's dashboard. It reads window.RADAR (written beside dashboard/ by main.ts) and
// renders the ranked board, a filterable and sortable table, a per-protocol detail view with the
// model's own arithmetic and the protocol's farm plan, the live-token set the multiples are read
// from, and the model itself with a sandbox. No network: every byte it shows is in data.js.
(function () {
  'use strict';

  var DATA = window.RADAR;
  if (!DATA) return;
  var app = document.getElementById('board');
  var M = DATA.model;
  var state = { view: 'board', q: '', category: 'all', chain: 'all', watchlist: false, sort: 'implied', dir: -1, selected: null, sandbox: null };

  var usdFull = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  function fmtUsd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return usdFull.format(n);
  }
  function fmtPct(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return (n > 0 ? '+' : '') + n.toFixed(2) + '%';
  }
  function fmtAge(days) {
    if (days === null || days === undefined) return 'unknown';
    if (days >= 365) return (days / 365).toFixed(1) + 'y (' + days + 'd)';
    return days + 'd';
  }
  function fmtMult(n) { return n.toFixed(3) + 'x'; }

  // The model, recomputed in the page from each row's own figures: at the stated constants this
  // lands on board.json's implied value to the dollar, so the page and the board are one arithmetic.
  function growthMult(row, weight) {
    var g = row.change_7d === null || row.change_7d === undefined ? 0 : row.change_7d;
    g = Math.min(M.growth_cap, Math.max(M.growth_floor, g));
    return 1 + (g / 100) * weight;
  }
  function maturityMult(row, range) {
    var age = row.age_days === null || row.age_days === undefined ? M.unknown_age_days : row.age_days;
    return M.maturity_floor + (Math.min(Math.max(age, 0), M.maturity_days) / M.maturity_days) * range;
  }
  function knobs() {
    return state.sandbox || { growth_weight: M.growth_weight, maturity_range: M.maturity_range, scale: 1 };
  }
  function impliedOf(row) {
    var k = knobs();
    return Math.max(1, Math.round(row.tvl_usd * row.peer_multiple * k.scale * growthMult(row, k.growth_weight) * maturityMult(row, k.maturity_range)));
  }
  function sandboxActive() {
    if (!state.sandbox) return false;
    return state.sandbox.growth_weight !== M.growth_weight || state.sandbox.maturity_range !== M.maturity_range || state.sandbox.scale !== 1;
  }

  function el(tag, attrs) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'class') node.className = attrs[k];
        else if (k === 'text') node.textContent = attrs[k];
        else if (k.slice(0, 2) === 'on') node.addEventListener(k.slice(2), attrs[k]);
        else if (attrs[k] !== null && attrs[k] !== undefined) node.setAttribute(k, attrs[k]);
      });
    }
    for (var i = 2; i < arguments.length; i++) {
      var child = arguments[i];
      if (child === null || child === undefined) continue;
      if (Array.isArray(child)) child.forEach(function (c) { if (c) node.appendChild(c); });
      else if (typeof child === 'string') node.appendChild(document.createTextNode(child));
      else node.appendChild(child);
    }
    return node;
  }

  function rowBySlug(slug) {
    for (var i = 0; i < DATA.rows.length; i++) if (DATA.rows[i].slug === slug) return DATA.rows[i];
    return null;
  }
  function detailHref(slug) { return '#p=' + encodeURIComponent(slug); }
  function boardHref() {
    var params = new URLSearchParams();
    if (state.q) params.set('q', state.q);
    if (state.category !== 'all') params.set('category', state.category);
    if (state.chain !== 'all') params.set('chain', state.chain);
    if (state.watchlist) params.set('watchlist', '1');
    var s = params.toString();
    return s ? '#' + s : '#';
  }

  // ------------------------------------------------------------------ chrome

  function header() {
    var total = DATA.rows.reduce(function (n, r) { return n + r.implied_value_usd; }, 0);
    return el('div', null,
      el('div', { 'class': 'masthead' },
        el('div', { 'class': 'sweep', 'aria-hidden': 'true' }),
        el('div', null,
          el('h1', null, 'Token Launch Radar ', el('span', { 'class': 'thin', text: 'pre-token protocols, ranked by what a launch would be worth' })),
          el('p', { 'class': 'lede', text: 'Every protocol in the snapshot that records no token, priced the way the market prices its kind: its TVL times the market-cap-to-TVL multiple of the tokenized protocols in its category, adjusted for seven-day growth and for how long it has run with no token. Each row carries the steps to farm it.' }),
          el('div', { 'class': 'meta', text: 'Snapshot ' + DATA.as_of + ' · ' + DATA.source + ' · model ' + DATA.model_version + ' · the board is this entry\u2019s claim, not a prediction' })
        )
      ),
      el('div', { 'class': 'stats' },
        stat('Protocols scanned', String(DATA.scanned_size), 'every protocol in the sealed snapshot'),
        stat('Watchlist covered', DATA.watchlist_size + ' of ' + DATA.watchlist_size, 'the house floor, in full'),
        stat('Board rows', String(DATA.board_size), DATA.early_size + ' early finds below the floor'),
        stat('Total implied value', fmtUsd(total), 'the whole board, at the stated model')
      ),
      el('nav', { 'class': 'tabs', 'aria-label': 'Views' },
        tab('board', 'The board'),
        tab('live', 'Already launched'),
        tab('model', 'The model')
      )
    );
  }
  function stat(k, v, s) {
    return el('div', { 'class': 'stat' }, el('div', { 'class': 'k', text: k }), el('div', { 'class': 'v', text: v }), el('div', { 'class': 's', text: s }));
  }
  function tab(view, label) {
    return el('button', {
      'class': 'tab', type: 'button', 'aria-selected': state.view === view ? 'true' : 'false',
      onclick: function () { state.view = view; state.selected = null; syncHash(); render(); },
    }, label);
  }
  function footer() {
    return el('footer', null,
      el('p', null, 'How to read this board: a protocol \u201crecords no token\u201d when its DefiLlama record carries no market cap, no CoinGecko id and no symbol. That is the record, not proof: a protocol may have a token its record does not carry. Wrapped, staked and bridged products of tokens that already trade are not launches waiting to happen, and the ranked board holds none of those product categories (Bridge, Canonical Bridge, Liquid Staking, Liquid Restaking, Restaked BTC), no exchange (CEX) entries and no versioned pools.'),
      el('p', null, 'Implied value is a model\u2019s claim about what a launch would be worth if the protocol\u2019s record stayed as it is. It is not a forecast that a token will be issued, and it is not investment advice. Farm plans are starting points: check each protocol\u2019s own page before committing funds, and never pay anyone to \u201cclaim\u201d an airdrop.'),
      el('p', null, 'Data: ' + DATA.source + ' (as of ' + DATA.as_of + '), sealed with the competition. Page and data generated by main.ts; no network is used to render this page.')
    );
  }

  // ------------------------------------------------------------------ board

  function filteredRows() {
    var q = state.q.trim().toLowerCase();
    return DATA.rows.filter(function (r) {
      if (state.watchlist && !r.watchlist) return false;
      if (state.category !== 'all' && (r.category || 'Uncategorized') !== state.category) return false;
      if (state.chain !== 'all' && r.chains.indexOf(state.chain) < 0) return false;
      if (q && (r.name.toLowerCase().indexOf(q) < 0 && r.slug.indexOf(q) < 0)) return false;
      return true;
    });
  }
  function sortRows(rows) {
    var key = state.sort, dir = state.dir;
    var val = function (r) {
      if (key === 'rank') return r.rank;
      if (key === 'name') return r.name.toLowerCase();
      if (key === 'tvl') return r.tvl_usd;
      if (key === 'change') return r.change_7d === null ? -Infinity : r.change_7d;
      if (key === 'age') return r.age_days === null ? -1 : r.age_days;
      if (key === 'multiple') return r.peer_multiple;
      return impliedOf(r);
    };
    return rows.slice().sort(function (a, b) {
      var x = val(a), y = val(b);
      if (x < y) return -dir; if (x > y) return dir;
      return a.rank - b.rank;
    });
  }
  function sortHead(label, key, cls) {
    var arrow = state.sort === key ? (state.dir === -1 ? ' \u2193' : ' \u2191') : '';
    return el('th', { 'class': cls || '' },
      el('button', {
        type: 'button',
        onclick: function () {
          if (state.sort === key) state.dir = -state.dir;
          else { state.sort = key; state.dir = key === 'name' || key === 'rank' ? 1 : -1; }
          render();
        },
        text: label + arrow,
      }));
  }
  function boardView() {
    var cats = {}, chains = {};
    DATA.rows.forEach(function (r) { cats[r.category || 'Uncategorized'] = 1; r.chains.forEach(function (c) { chains[c] = 1; }); });
    var catSel = el('select', { 'aria-label': 'Filter by category', onchange: function () { state.category = catSel.value; syncHash(); render(); } },
      [el('option', { value: 'all', text: 'All categories' })].concat(Object.keys(cats).sort().map(function (c) {
        return el('option', { value: c, text: c, selected: state.category === c ? 'selected' : null });
      })));
    var chainSel = el('select', { 'aria-label': 'Filter by chain', onchange: function () { state.chain = chainSel.value; syncHash(); render(); } },
      [el('option', { value: 'all', text: 'All chains' })].concat(Object.keys(chains).sort().map(function (c) {
        return el('option', { value: c, text: c, selected: state.chain === c ? 'selected' : null });
      })));
    var search = el('input', {
      type: 'search', placeholder: 'Search by name or slug', value: state.q, 'aria-label': 'Search protocols',
      oninput: function () { state.q = search.value; syncHash(); renderTableOnly(); },
    });
    var watch = el('input', {
      type: 'checkbox', onchange: function () { state.watchlist = watch.checked; syncHash(); render(); },
    });
    if (state.watchlist) watch.checked = true;

    var rows = sortRows(filteredRows());
    var wrap = el('div', null,
      el('div', { 'class': 'controls' },
        search, catSel, chainSel,
        el('label', { 'class': 'toggle' }, watch, ' Watchlist only'),
        el('span', { 'class': 'count', id: 'rowcount' })
      )
    );
    if (sandboxActive()) {
      wrap.appendChild(el('div', { 'class': 'banner', text: 'Sandbox settings are on: the Implied value column shows your model, not the stated one. board.json carries the stated model (' + DATA.model_version + '). Reset it in The model tab.' }));
    }
    var tableHost = el('div', { id: 'tablehost' });
    wrap.appendChild(tableHost);
    wrap._renderTable = function () {
      var now = sortRows(filteredRows());
      var count = wrap.querySelector('#rowcount');
      if (count) count.textContent = now.length + ' of ' + DATA.board_size + ' protocols';
      tableHost.innerHTML = '';
      tableHost.appendChild(boardTable(now));
    };
    wrap._renderTable();
    return wrap;
  }
  function renderTableOnly() {
    var host = app.querySelector('#tablehost');
    if (!host) { render(); return; }
    var wrap = host.parentNode;
    var now = sortRows(filteredRows());
    var count = wrap.querySelector('#rowcount');
    if (count) count.textContent = now.length + ' of ' + DATA.board_size + ' protocols';
    host.innerHTML = '';
    host.appendChild(boardTable(now));
  }
  function boardTable(rows) {
    var thead = el('tr', null,
      sortHead('#', 'rank'), sortHead('Protocol', 'name'), sortHead('TVL', 'tvl', 'num'),
      sortHead('7d', 'change', 'num'), sortHead('Age', 'age', 'num hidesmall'),
      sortHead('Peer multiple', 'multiple', 'num hidesmall'), sortHead('Implied value', 'implied', 'num'));
    var tbody = el('tbody', null, rows.map(function (r) {
      var implied = impliedOf(r);
      return el('tr', null,
        el('td', { 'class': 'rank' + (r.rank <= 3 ? ' top' : ''), text: String(r.rank) }),
        el('td', null,
          el('div', { 'class': 'pname' },
            el('a', { href: detailHref(r.slug), text: r.name }),
            el('span', { 'class': 'badge ' + (r.watchlist ? 'watch' : 'early'), text: r.watchlist ? 'WATCHLIST' : 'EARLY' })
          ),
          el('div', { 'class': 'psub', text: (r.category || 'Uncategorized') + ' · ' + (r.chains.length ? r.chains.join(', ') : 'no chains recorded') })
        ),
        el('td', { 'class': 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { 'class': 'num ' + (r.change_7d === null ? '' : r.change_7d >= 0 ? 'up' : 'down'), text: fmtPct(r.change_7d) }),
        el('td', { 'class': 'num hidesmall', text: fmtAge(r.age_days) }),
        el('td', { 'class': 'num hidesmall', text: fmtMult(r.peer_multiple) }),
        el('td', { 'class': 'num', text: fmtUsd(implied) })
      );
    }));
    return el('div', { 'class': 'tablewrap' }, el('table', null, el('thead', null, thead), tbody));
  }

  // ------------------------------------------------------------------ detail

  function sourceText(row) {
    if (row.multiple_source === 'category') return 'the median of ' + row.peer_count + ' tokenized ' + (row.category || 'Uncategorized') + ' protocols';
    if (row.multiple_source === 'blended') return 'a blend of the ' + (row.category || 'Uncategorized') + ' median and the global median, weighted toward the global because only ' + row.peer_count + ' tokenized peers are too few to stand alone';
    return 'the global median of ' + DATA.global_peers + ' tokenized protocols (this category has no tokenized peers in the snapshot)';
  }
  function stepParts(step) {
    var m = /^(.*?)\sCost: (.*?)\.\sTime: (.*?)\.$/.exec(step);
    if (!m) return { text: step, cost: null, time: null };
    return { text: m[1], cost: m[2], time: m[3] };
  }
  function detailView(row) {
    var implied = row.implied_value_usd;
    var recomputed = (function () {
      var keep = state.sandbox; state.sandbox = null;
      var v = impliedOf(row); state.sandbox = keep; return v;
    })();
    var inCat = DATA.rows.filter(function (r) { return (r.category || 'Uncategorized') === (row.category || 'Uncategorized'); });
    var catRank = inCat.slice().sort(function (a, b) { return a.rank - b.rank; }).indexOf(row) + 1;
    var topCat = inCat.slice().sort(function (a, b) { return a.rank - b.rank; }).slice(0, 5);
    var growthPct = row.change_7d === null ? 0 : Math.min(M.growth_cap, Math.max(M.growth_floor, row.change_7d));

    var steps = el('ol', { 'class': 'steps' }, row.farm_steps.map(function (s) {
      var p = stepParts(s);
      return el('li', null,
        p.text,
        p.cost ? el('span', { 'class': 'chips' },
          el('span', { 'class': 'chip' }, 'Cost: ', el('b', { text: p.cost })),
          el('span', { 'class': 'chip' }, 'Time: ', el('b', { text: p.time }))) : null
      );
    }));

    return el('div', null,
      el('a', { 'class': 'back', href: boardHref(), text: '\u2190 Back to the board' }),
      el('div', { 'class': 'dhead' },
        el('h2', { text: row.name }),
        el('span', { 'class': 'badge ' + (row.watchlist ? 'watch' : 'early'), text: row.watchlist ? 'ON THE HOUSE WATCHLIST' : 'EARLY RADAR FIND' }),
        el('span', { 'class': 'slug', text: row.slug })
      ),
      el('p', { 'class': 'lede', text: (row.category || 'Uncategorized') + ' · ' + (row.chains.length ? 'TVL counted on ' + row.chains.join(', ') : 'no chains recorded') + ' · tracked by DefiLlama since ' + (row.listed_at || 'an unrecorded date') + ' · records no token in the snapshot of ' + DATA.as_of + '.' }),
      el('div', { 'class': 'tiles' },
        stat('Board rank', '#' + row.rank + ' of ' + DATA.board_size, 'and #' + catRank + ' in ' + (row.category || 'its category')),
        stat('Implied value', fmtUsd(implied), 'at the stated model, ' + DATA.model_version),
        stat('TVL', fmtUsd(row.tvl_usd), 'seven-day change ' + fmtPct(row.change_7d)),
        stat('Age with no token', fmtAge(row.age_days), 'listed ' + (row.listed_at || 'unknown'))
      ),
      el('div', { 'class': 'card' },
        el('h3', { text: 'Why this value' }),
        el('div', { 'class': 'eq', text: fmtUsd(row.tvl_usd) + ' TVL  x  ' + fmtMult(row.peer_multiple) + ' peer multiple  x  ' + growthMult(row, M.growth_weight).toFixed(3) + ' growth  x  ' + maturityMult(row, M.maturity_range).toFixed(3) + ' maturity  =  ' + fmtUsd(implied) }),
        el('table', { 'class': 'mini' },
          el('tr', null, el('td', { 'class': 'k', text: 'Peer multiple' }), el('td', { 'class': 'v', text: fmtMult(row.peer_multiple) }), el('td', { text: 'what the market pays per TVL dollar for this kind of protocol: ' + sourceText(row) + ', each peer\u2019s ratio winsorized to [' + M.ratio_floor + ', ' + M.ratio_cap + '].' })),
          el('tr', null, el('td', { 'class': 'k', text: 'Growth' }), el('td', { 'class': 'v', text: growthMult(row, M.growth_weight).toFixed(3) + 'x' }), el('td', { text: 'TVL changed ' + fmtPct(row.change_7d) + ' in seven days; the model clamps that to [' + M.growth_floor + '%, +' + M.growth_cap + '%] and weights it ' + M.growth_weight + '.' })),
          el('tr', null, el('td', { 'class': 'k', text: 'Maturity' }), el('td', { 'class': 'v', text: maturityMult(row, M.maturity_range).toFixed(3) + 'x' }), el('td', { text: 'it has run ' + fmtAge(row.age_days) + ' with no token; the model pays ' + M.maturity_floor + ' to ' + (M.maturity_floor + M.maturity_range).toFixed(1) + ' across the first ' + M.maturity_days + ' days, as a track-record premium.' })),
          el('tr', null, el('td', { 'class': 'k', text: 'Check' }), el('td', { 'class': 'v', text: fmtUsd(recomputed) }), el('td', { text: 'recomputed by this page from the row\u2019s own figures, at the stated model: it is board.json\u2019s number, from the page\u2019s own arithmetic.' }))
        )
      ),
      el('div', { 'class': 'card' },
        el('h3', { text: 'The farm plan' }),
        el('p', null, 'Six steps, written from ' + row.name + '\u2019s own record: its category sets the actions, its first chain (' + (row.chains[0] || 'its main chain') + ') sets the fees, its TVL sets the position size and its age sets the hold.'),
        steps
      ),
      el('div', { 'class': 'card' },
        el('h3', { text: 'Strongest in ' + (row.category || 'Uncategorized') }),
        el('table', { 'class': 'mini' }, topCat.map(function (r) {
          return el('tr', null,
            el('td', { 'class': 'k', text: '#' + r.rank }),
            el('td', null, el('a', { href: detailHref(r.slug), text: r.name })),
            el('td', { 'class': 'v', text: fmtUsd(r.implied_value_usd) }));
        }))
      )
    );
  }

  // ------------------------------------------------------------------ live

  function liveView() {
    var tbody = el('tbody', null, DATA.live.map(function (r) {
      var ratio = r.mcap_usd && r.tvl_usd ? (r.mcap_usd / r.tvl_usd) : null;
      return el('tr', null,
        el('td', null,
          el('div', { 'class': 'pname', text: r.name }),
          el('div', { 'class': 'psub', text: (r.category || 'Uncategorized') + (r.symbol ? ' · $' + r.symbol : '') })
        ),
        el('td', { 'class': 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { 'class': 'num', text: fmtUsd(r.mcap_usd) }),
        el('td', { 'class': 'num', text: ratio === null ? 'n/a' : fmtMult(ratio) }),
        el('td', { 'class': 'num ' + (r.change_7d === null ? '' : r.change_7d >= 0 ? 'up' : 'down'), text: fmtPct(r.change_7d) })
      );
    }));
    return el('div', null,
      el('p', { 'class': 'lede', text: 'These protocols already have a token: the market, not a model, says what they are worth. They are never ranked on the board. They matter because the board\u2019s peer multiples are read from protocols like these: ' + DATA.global_peers + ' tokenized protocols in the snapshot, a global median of ' + fmtMult(DATA.global_multiple) + ' of market cap per TVL dollar. The ' + DATA.live_size + ' largest by market cap are shown.' }),
      el('div', { 'class': 'tablewrap', style: 'margin-top:14px' },
        el('table', null,
          el('thead', null, el('tr', null,
            el('th', { text: 'Protocol' }), el('th', { 'class': 'num', text: 'TVL' }),
            el('th', { 'class': 'num', text: 'Market cap' }), el('th', { 'class': 'num', text: 'Mcap / TVL' }),
            el('th', { 'class': 'num', text: '7d' }))),
          tbody))
    );
  }

  // ------------------------------------------------------------------ model

  function modelView() {
    var k = knobs();
    function slider(label, min, max, step, value, fmt, oninput) {
      var out = el('span', { 'class': 'val', text: fmt(value) });
      var input = el('input', { type: 'range', min: String(min), max: String(max), step: String(step), value: String(value) });
      input.addEventListener('input', function () { out.textContent = fmt(parseFloat(input.value)); oninput(parseFloat(input.value)); });
      return el('label', null, label + ' ', out, input);
    }
    function setKnob(key, value) {
      var base = state.sandbox || { growth_weight: M.growth_weight, maturity_range: M.maturity_range, scale: 1 };
      base[key] = value;
      state.sandbox = base;
      var note = document.getElementById('sandbox-note');
      if (note) note.textContent = sandboxActive() ? 'Sandbox is on: open The board to see it re-ranked by these settings. board.json keeps the stated model.' : 'Sandbox matches the stated model.';
    }
    var multRows = DATA.multiples.map(function (m) {
      return el('tr', null,
        el('td', { 'class': 'k', text: m.category }),
        el('td', { 'class': 'v', text: fmtMult(m.multiple) }),
        el('td', { 'class': 'v', text: String(m.peers) }),
        el('td', { text: m.source === 'category' ? 'category median' : 'blended with the global median' }));
    });
    multRows.push(el('tr', null,
      el('td', { 'class': 'k', text: 'Every category with no peers' }),
      el('td', { 'class': 'v', text: fmtMult(DATA.global_multiple) }),
      el('td', { 'class': 'v', text: String(DATA.global_peers) }),
      el('td', { text: 'global median' })));

    return el('div', null,
      el('div', { 'class': 'card' },
        el('h3', { text: 'The value model (' + DATA.model_version + ')' }),
        el('p', null, 'A launch is worth what the market would pay for the protocol if its record stayed as it is. The market already prices ' + DATA.global_peers + ' tokenized protocols in this snapshot, so the model borrows their pricing instead of inventing one: for each category, the median ratio of market cap to TVL across its tokenized protocols, winsorized to [' + M.ratio_floor + ', ' + M.ratio_cap + '] so one micro-cap cannot bend a category. A pre-token protocol is priced at its own TVL times its category\u2019s multiple, then adjusted for momentum and track record:'),
        el('div', { 'class': 'formula' },
          'implied = TVL x ', el('b', { text: 'peer multiple' }), ' x growth x maturity', el('br'),
          'growth = 1 + clamp(7d change, ' + M.growth_floor + ', +' + M.growth_cap + ') / 100 x ', el('b', { text: String(M.growth_weight) }), el('br'),
          'maturity = ' + M.maturity_floor + ' + min(age in days, ' + M.maturity_days + ') / ' + M.maturity_days + ' x ', el('b', { text: String(M.maturity_range) }), '  (unknown age counts as ' + M.unknown_age_days + ' days)', el('br'),
          'a category needs ', el('b', { text: String(M.peer_min_count) }), ' tokenized peers for its median to stand alone; fewer, and the median is blended with the global median weighted by peer count (n parts category to 3 parts global), the global being ', el('b', { text: fmtMult(DATA.global_multiple) })
        ),
        el('p', null, 'No protocol\u2019s name is read anywhere in the model: the same function scores every row, and every figure in it comes out of the sealed snapshot. The board separates the two sets the snapshot itself separates: protocols that record no token are ranked; protocols whose token trades are set aside in Already launched, at market value.')
      ),
      el('div', { 'class': 'card' },
        el('h3', { text: 'Peer multiples by category' }),
        el('table', { 'class': 'mini' },
          el('tr', null, el('th', { text: 'Category' }), el('th', { text: 'Multiple' }), el('th', { text: 'Peers' }), el('th', { text: 'Source' })),
          multRows)
      ),
      el('div', { 'class': 'card' },
        el('h3', { text: 'Model sandbox' }),
        el('p', null, 'Move the settings and the board re-ranks by your model instead. This changes nothing on disk: board.json always carries the stated model above.'),
        el('div', { 'class': 'sliders' },
          slider('Growth weight', 0, 1, 0.05, k.growth_weight, function (v) { return v.toFixed(2); }, function (v) { setKnob('growth_weight', v); }),
          slider('Maturity range', 0, 0.8, 0.05, k.maturity_range, function (v) { return v.toFixed(2); }, function (v) { setKnob('maturity_range', v); }),
          slider('Multiple scale', 0.25, 3, 0.25, k.scale, function (v) { return v.toFixed(2) + 'x'; }, function (v) { setKnob('scale', v); })
        ),
        el('p', { id: 'sandbox-note', text: sandboxActive() ? 'Sandbox is on: open The board to see it re-ranked by these settings. board.json keeps the stated model.' : 'Sandbox matches the stated model.' }),
        el('button', {
          'class': 'tab', type: 'button',
          onclick: function () { state.sandbox = null; render(); },
          text: 'Reset to the stated model',
        })
      )
    );
  }

  // ------------------------------------------------------------------ routing

  function syncHash() {
    var params = new URLSearchParams();
    if (state.selected) params.set('p', state.selected);
    else {
      if (state.view !== 'board') params.set('view', state.view);
      if (state.q) params.set('q', state.q);
      if (state.category !== 'all') params.set('category', state.category);
      if (state.chain !== 'all') params.set('chain', state.chain);
      if (state.watchlist) params.set('watchlist', '1');
    }
    var s = params.toString();
    var next = s ? '#' + s : '#';
    if (window.location.hash !== next) history.replaceState(null, '', next);
  }
  function readHash() {
    var hash = window.location.hash.replace(/^#/, '');
    state.selected = null;
    if (!hash) return;
    var params = new URLSearchParams(hash);
    if (params.get('p')) { state.selected = params.get('p'); return; }
    if (params.get('view')) state.view = params.get('view');
    if (params.get('q')) state.q = params.get('q');
    if (params.get('category')) state.category = params.get('category');
    if (params.get('chain')) state.chain = params.get('chain');
    if (params.get('watchlist')) state.watchlist = true;
  }
  function render() {
    app.setAttribute('aria-busy', 'true');
    app.innerHTML = '';
    app.appendChild(header());
    if (state.selected) {
      var row = rowBySlug(state.selected);
      app.appendChild(row ? detailView(row) : boardView());
    } else if (state.view === 'live') app.appendChild(liveView());
    else if (state.view === 'model') app.appendChild(modelView());
    else app.appendChild(boardView());
    app.appendChild(footer());
    app.setAttribute('aria-busy', 'false');
  }
  window.addEventListener('hashchange', function () { readHash(); render(); });
  readHash();
  render();
})();

// Part of the Haloo AI page: how fast products are made in Miaoshou, and what each list gave.
// HalooPace works it out (no page, tested in test/pace.test.js) of what lg-grab catalog-list
// answers - the made rows' times and the lists' counts; paceBox draws it with the page's el().
// Nothing more is asked of the cloud for it.
(function (root) {
  const GAP_MS = 5 * 60000; // nothing made for this long: one stretch of making is over

  // The stretches of making, newest first: {from, to, made, minutes, hourly, by}. A stretch of
  // one product has no length to work a rate out of: its hourly is null.
  function stretches(rows) {
    const made = (rows || []).filter((r) => r.made_at).map((r) => ({ at: Date.parse(r.made_at), by: r.made_by || '' }))
      .filter((r) => !Number.isNaN(r.at)).sort((a, b) => a.at - b.at);
    const out = [];
    for (const r of made) {
      const last = out[out.length - 1];
      if (last && r.at - last.to <= GAP_MS) { last.to = r.at; last.made += 1; last.who.add(r.by); }
      else out.push({ from: r.at, to: r.at, made: 1, who: new Set([r.by]) });
    }
    return out.reverse().map((s) => {
      const minutes = (s.to - s.from) / 60000;
      return { from: s.from, to: s.to, made: s.made, minutes, hourly: s.made > 1 && minutes > 0 ? Math.round((s.made - 1) / minutes * 60) : null,
        by: [...s.who].filter(Boolean).sort().join('、') };
    });
  }

  // Today (the browser's day) in a few numbers: made, minutes at it, per hour while at it, and
  // whether it is going on now (the newest stretch made something within the gap).
  function today(list, now = Date.now()) {
    const start = new Date(now); start.setHours(0, 0, 0, 0);
    const mine = list.filter((s) => s.to >= start.getTime());
    const made = mine.reduce((a, s) => a + s.made, 0);
    const minutes = mine.reduce((a, s) => a + s.minutes, 0);
    return { made, minutes, hourly: minutes > 0 ? Math.round(made / minutes * 60) : null, stretches: mine.length,
      live: !!list.length && now - list[0].to <= GAP_MS };
  }

  // What each list gave: of those read, how many were made, how many are left to look at.
  function yields(keywords) {
    return (keywords || []).map((k) => {
      const n = Number(k.n || 0), made = Number(k.made || 0), todo = Number(k.todo || 0);
      return { keyword: k.keyword || '', last: k.last_seen, n, made, todo, share: n - todo > 0 ? made / (n - todo) : null };
    }).sort((a, b) => Date.parse(b.last || 0) - Date.parse(a.last || 0));
  }

  root.HalooPace = { stretches, today, yields, GAP_MS };
  if (typeof module !== 'undefined') module.exports = root.HalooPace;
})(typeof self !== 'undefined' ? self : globalThis);

function paceBox(c) {
  const box = el('div', 'batch');
  const list = HalooPace.stretches(c.rows);
  const t = HalooPace.today(list);
  const time = (ms) => new Date(ms).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  const day = (ms) => new Date(ms).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' });
  const tile = (v, what, cls) => { const x = el('div', `tile ${cls || ''}`); x.append(el('b', '', v), what); return x; };
  const tiles = el('div', 'tiles');
  tiles.append(tile(t.live ? '正在建' : '没在建', t.live ? `最近一个建于 ${time(list[0].to)}` : list.length ? `最近一个建于 ${day(list[0].to)} ${time(list[0].to)}` : '还没建过', t.live ? 'good' : ''),
    tile(String(t.made), '今天建进妙手'), tile(t.hourly == null ? '—' : `${t.hourly} 个/小时`, `今天在建的时候的速度（共建了 ${Math.round(t.minutes)} 分钟，${t.stretches} 段）`),
    tile(list[0] && list[0].hourly != null ? `${list[0].hourly} 个/小时` : '—', '最近一段的速度'));
  box.append(el('h2', '', '建产品的速度'), el('div', 'dim', '按每个产品建好的时间算。连着建、中间停不超过 5 分钟算一段；停下来的时间不算进速度。'), tiles);
  if (list.length) {
    const tb = el('table');
    const hr = el('tr');
    for (const x of ['哪一段', '建了', '用时', '每小时', '机器']) hr.append(el('th', '', x));
    tb.append(hr);
    for (const s of list.slice(0, 12)) {
      const tr = el('tr');
      tr.append(el('td', '', `${day(s.from)} ${time(s.from)} – ${time(s.to)}`), el('td', '', `${s.made} 个`), el('td', '', s.minutes < 1 ? (s.made > 5 ? '一次记进来的，没有逐个的时间' : '不到 1 分钟') : `${Math.round(s.minutes)} 分钟`),
        el('td', '', s.hourly == null ? '—' : String(s.hourly)), el('td', '', s.by));
      tb.append(tr);
    }
    box.append(tb, list.length > 12 ? el('div', 'dim', `只列最近 12 段，共 ${list.length} 段。`) : '');
  }
  const ys = HalooPace.yields(c.keywords);
  if (ys.length) {
    const tb = el('table');
    const hr = el('tr');
    for (const x of ['列表（搜索词或店铺）', '读到', '建进妙手', '还没看', '看过的里建成的比例', '最后读于']) hr.append(el('th', '', x));
    tb.append(hr);
    for (const y of ys) {
      const tr = el('tr');
      tr.append(el('td', '', y.keyword || '（无）'), el('td', '', String(y.n)), el('td', '', String(y.made)), el('td', '', String(y.todo)),
        el('td', '', y.share == null ? '—' : `${Math.round(y.share * 100)}%`), el('td', '', y.last ? `${day(Date.parse(y.last))} ${time(Date.parse(y.last))}` : ''));
      tb.append(tr);
    }
    const h = el('h2', '', '每个列表建出多少');
    h.style.marginTop = '16px';
    box.append(h, el('div', 'dim', '一个商品只算在第一次读到它的列表上，所以后读的列表数字小。比例低了说明这个词里能建的不多，或者和读过的重复多。'), tb);
  }
  return box;
}

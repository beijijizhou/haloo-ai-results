// Part of the results page (index.html loads its scripts in this order: publish.js core.js home.js
// catalog.js ms.js measure.js page.js; they share what each declares at the top). Here: labelling a picture, drawing the page, reading from the cloud.
// One picture's label. Asks for the passcode and the labeller's name the first time, and for
// the IP's name when the picture is said to infringe.
async function label(p, decision) {
  const key = localStorage.passcode || (window.prompt('Haloo AI Assistant 口令（标注需要）') || '').trim();
  if (!key) return;
  const reviewer = localStorage.reviewer ?? (window.prompt('你的名字（和标注一起保存；可以不填）') || '').trim();
  let ip = '';
  if (decision === 'infringing') {
    ip = window.prompt('被侵权的品牌或 IP', p.human_ip || p.labels || '');
    if (ip === null) return;
  }
  const r = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-lg-passcode': key },
    body: JSON.stringify({ action: 'label', url: p.url, decision, ip, reviewer }) });
  const data = await r.json().catch(() => ({}));
  if (r.status === 401) {
    delete localStorage.passcode;
    window.alert('口令不对。');
    return;
  }
  if (!r.ok) {
    window.alert(`没标注上：${data.error || r.status}`);
    return;
  }
  localStorage.passcode = key;
  localStorage.reviewer = reviewer;
  await load();
}

function outcome(b) {
  const left = b.counts.waiting;
  if (b.kind !== 'product') return left ? ['wait', `判断中，还剩 ${left} 张`] : ['done', '已判断；通过的已下载'];
  if (b.miaoshou === 'done') return ['done', `已进妙手${b.removed ? `，去掉 ${b.removed} 张` : ''}`];
  if (b.miaoshou === 'skipped') {
    // yellow when LogoGuard was only unsure, red when it blocked
    const why = b.counts.block ? 'block' : b.counts.review ? 'review' : 'block';
    const what = b.total === 1 ? '主图' : '图片';
    return [why, `${what}${why === 'review' ? '待复核' : b.counts.block ? '被拦截' : '没通过'}：没进妙手`];
  }
  return left ? ['wait', `判断中，还剩 ${left} 张`] : ['wait', '已判断，没交给妙手（商品页被关了）'];
}

// Every drawing ends the same way (the owner's design standard): each button with what it does gets
// its icon, and a column of numbers stands to the right.
function draw() {
  drawView();
  dress(document.querySelector('main'));
}

function drawView() {
  if (!msParts()) return; // a browser with the page of before: the parts split off ms.js are fetched first
  document.getElementById('views').replaceChildren(...NAV.flatMap((part) => {
    const open = part.views.includes(view);
    const head = el('button', open ? 'parent open' : 'parent');
    const arrow = el('b'); arrow.append(icon(open ? 'chevron-down' : 'chevron-right'));
    head.append(icon(part.icon), el('span', '', part.name), arrow);
    head.onclick = () => { if (!open) { view = part.views[0]; only = null; draw(); } };
    if (!open) return [head];
    return [head, ...part.views.map((key) => {
      const list = shown(key, null);
      // products where the view is about products, pictures where it is about pictures
      const n = key === 'ms' || key === 'set' || key === 'hot' ? '' : key === 'msrec' ? (msOver ? (msOver.pub || {}).fail || 0 : '') : key === 'mspend' ? (msPend ? HalooSteps.pending(msPend.rows, (msMade || {}).rows).rows.length : msOver ? (msOver.pending || {}).n || 0 : '') : key === 'cat' ? (catalog ? catalog.total : '…') : key === 'pub' ? (pubData ? pubData.rows.filter((r) => r.temu_id && r.pub !== 'published' && r.pub !== 'sent').length : '') : key === 'use' ? (usage ? Number((usage.days.find((d) => d.day === usage.today) || {}).calls || 0) : '…') : key === 'runs' ? runs.length : key === 'box' ? flagged.counts.block : ['kept', 'todo', 'known'].includes(key) ? list.reduce((a, [, pics]) => a + pics.length, 0) : list.length;
      const btn = el('button', key === view ? 'child on' : 'child');
      btn.append(icon(key), el('span', '', VIEWS[key].name), el('b', '', String(n)));
      btn.onclick = () => { view = key; only = null; if (key === 'box') load(); draw(); };
      return btn;
    })];
  }));
  msTopDraw();
  const bar = document.getElementById('bar');
  // one line that says which page this is; what the page is for is there to be opened, not in the way
  const title = el('h1', 'title');
  title.append(icon(view), only ? `轮次 ${only.slice(0, 8)} 的商品` : VIEWS[view].name);
  bar.replaceChildren(title);
  if (only) {
    const back = el('button', '', '回到所有轮次');
    back.onclick = () => { only = null; view = 'runs'; draw(); };
    bar.append(back);
  } else {
    const what = el('details', 'note');
    what.open = !!folds[`note:${view}`];
    what.ontoggle = () => { folds[`note:${view}`] = what.open; };
    const s = el('summary'); s.append(icon('info'), '这一页是什么');
    what.append(s, el('p', '', VIEWS[view].note));
    bar.append(what);
  }
  if (view === 'box' && !only) {
    const c = flagged.counts;
    const box = el('div', 'batch');
    const head = el('div', 'head');
    head.append(el('span', '', '妙手采集箱'), el('span', 'tag block', `主图拦截 ${c.block}`), el('span', 'tag review', `待复核 ${c.review}`),
      el('span', 'dim', `看了 ${c.all} 个商品的主图，${c.pass} 个通过。先列被拦截的，再列待复核的${flagged.items.length < c.block + c.review ? `（只显示前 ${flagged.items.length} 个）` : ''}。`));
    const grid = el('div', 'grid');
    for (const p of flagged.items) {
      const pic = el('div', `pic ${p.verdict}`);
      const a = el('a');
      a.href = p.url;
      a.target = '_blank';
      a.rel = 'noopener';
      const img = el('img');
      img.loading = 'lazy';
      img.referrerPolicy = 'no-referrer';
      img.src = `${p.url}?imageView2/2/w/240/q/70/format/webp`;
      a.append(img);
      pic.title = p.title || '';
      pic.append(a, el('span', '', (p.human === 'infringing' && p.human_ip) || p.labels || NAME[p.verdict]),
        el('span', 'who', `采集箱 ID ${p.detail_id || '?'}　${p.owner || ''}`));
      if (p.human) pic.append(el('span', 'who', `${p.human_by || '有人'} 标注：${SAY[p.human]}（机器：${NAME[p.machine]}）`));
      const say = el('div', 'say');
      for (const [decision, word] of Object.entries(SAY)) {
        const btn = el('button', p.human === decision ? 'on' : '', word);
        btn.onclick = async () => {
          say.querySelectorAll('button').forEach((x) => { x.disabled = true; });
          try { await label(p, decision); } finally { say.querySelectorAll('button').forEach((x) => { x.disabled = false; }); }
        };
        say.append(btn);
      }
      pic.append(say);
      grid.append(pic);
    }
    box.append(head, grid);
    document.getElementById('list').replaceChildren(box);
    document.getElementById('more').hidden = true;
    return;
  }
  if (view === 'runs' && !pubData && !pubAsking) loadPub(); // the runs show the steps
  if (['ms', 'msrec', 'mspend'].includes(view) && !only) {
    const have = view === 'ms' ? msOver : view === 'msrec' ? msRec : msPend;
    if (!have) msLoad(view);
    document.getElementById('list').replaceChildren(...(view === 'ms' ? msView() : view === 'msrec' ? recView() : pendView()));
    document.getElementById('more').hidden = true;
    return;
  }
  if (view === 'cat' && !only) {
    if (!catalog) loadCatalog();
    document.getElementById('list').replaceChildren(...catView());
    document.getElementById('more').hidden = true;
    return;
  }
  if (view === 'hot' && !only) {
    // popular.js may be missing while a browser still holds the older index.html
    if (typeof popView !== 'function') { document.getElementById('list').replaceChildren(el('div', 'empty', '页面有更新，请刷新一次。')); return; }
    if (!pop) loadPopular();
    document.getElementById('list').replaceChildren(...popView());
    document.getElementById('more').hidden = true;
    return;
  }
  if (view === 'pub' && !only) {
    if (!pubData) loadPub();
    document.getElementById('list').replaceChildren(...pubView());
    document.getElementById('more').hidden = true;
    return;
  }
  if (view === 'set' && !only) {
    if (!setRows) loadSettings();
    const at = document.activeElement; // a field being typed in is not drawn over
    if (at && at.closest && at.closest('.setting') && ['INPUT', 'TEXTAREA'].includes(at.tagName)) return;
    document.getElementById('list').replaceChildren(...setView());
    document.getElementById('more').hidden = true;
    return;
  }
  if (view === 'use' && !only) {
    if (!usage) loadUsage();
    document.getElementById('list').replaceChildren(...useView());
    document.getElementById('more').hidden = true;
    return;
  }
  if (view === 'runs' && !only) {
    document.getElementById('list').replaceChildren(...(runs.length ? runs.map(runCard)
      : [el('div', 'empty', '还没有轮次。在 Temu 列表页用“Products on this page”采集一次。')]));
    document.getElementById('more').hidden = true;
    return;
  }

  const out = [];
  for (const [b, pics] of shown(view)) {
    const box = el('div', 'batch');
    const head = el('div', 'head');
    const title = el(b.page_url ? 'a' : 'span', '', b.page_title || (b.kind === 'product' ? '商品' : '页面'));
    if (b.page_url) {
      // Temu answers a product's plain address with "sold out"; a search for its id shows it, as Miaoshou links it too
      const id = /-g-(\d+)\.html/.exec(b.page_url);
      title.href = id ? `https://www.temu.com/search_result.html?search_key=${id[1]}` : b.page_url;
      title.target = '_blank';
      title.rel = 'noopener';
    }
    const [cls, text] = outcome(b);
    const c = b.counts;
    const along = (b.others || []).length;
    head.append(title, el('span', 'tag', b.kind === 'product' ? '商品 → 妙手' : '整页 → 下载'), el('span', `tag ${cls}`, text),
      ...(arrival(b) ? [el('span', `tag ${arrival(b)[0]}`, arrival(b)[1])] : []),
      ...(b.tags || []).map((tag) => el('span', 'tag mark', TAG[tag] || tag)),
      el('span', 'dim', `${new Date(b.created_at).toLocaleString('zh-CN')}　判断了 ${b.total} 张：通过 ${c.pass}　待复核 ${c.review}　拦截 ${c.block}`
        + (c.error ? `　出错 ${c.error}` : '') + (along ? `　未判断 ${along}` : '')
        + (b.pictures.length < b.total ? `　（只显示 ${b.pictures.length} 张）` : '')));
    const grid = el('div', 'grid');
    for (const p of pics) {
      // faded: a picture of a product that went to Miaoshou without it
      const pic = el('div', `pic ${state(p)}${went(b) && !inside(b, p) ? ' out' : ''}`);
      const a = el('a');
      a.href = p.url;
      a.target = '_blank';
      a.rel = 'noopener';
      const img = el('img');
      img.loading = 'lazy';
      img.referrerPolicy = 'no-referrer';
      img.src = `${p.url}?imageView2/2/w/240/q/70/format/webp`; // Temu's own thumbnail of the original
      a.append(img);
      pic.append(a, el('span', '', (p.human === 'infringing' && p.human_ip) || p.labels || NAME[state(p)]));
      if (went(b) && !inside(b, p)) pic.append(el('span', 'who', '没进妙手'));
      if (p.ledger) {
        pic.append(el('span', 'who', `台账图案 #${p.ledger.id}：${WHO[p.ledger.source] || p.ledger.source} 判为 ${NAME[p.ledger.verdict]}`
          + `，${p.ledger.orders} 个订单文件` + (p.ledger.labels ? `（${p.ledger.labels}）` : '')));
      }
      if (p.design && p.same > 0) pic.append(el('span', 'who', `另有 ${p.same} 张 Temu 图片是同一图案`));
      if (p.human) {
        pic.append(el('span', 'who', `${p.human_by || '有人'} 标注：${SAY[p.human]}`
          + (p.machine && p.machine !== p.verdict ? `（机器：${NAME[p.machine]}）` : '')));
      }
      if (p.status === 'done') {
        const say = el('div', 'say');
        for (const [decision, word] of Object.entries(SAY)) {
          const btn = el('button', p.human === decision ? 'on' : '', word);
          btn.onclick = async () => {
            say.querySelectorAll('button').forEach((x) => { x.disabled = true; });
            try { await label(p, decision); } finally { say.querySelectorAll('button').forEach((x) => { x.disabled = false; }); }
          };
          say.append(btn);
        }
        pic.append(say);
      }
      grid.append(pic);
    }
    box.append(head, grid);
    out.push(box);
  }
  document.getElementById('list').replaceChildren(...(out.length ? out : [el('div', 'empty', batches.length ? '现在这里没有内容。' : '还没抓过。')]));
  document.getElementById('more').hidden = batches.length < wanted || wanted >= 100;
}

async function load() {
  try {
    const get = async (body) => {
      const r = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || r.status);
      return data;
    };
    const [list, made, box, all] = await Promise.all([get({ action: 'list', limit: wanted }), get({ action: 'runs', machine: MACHINE, limit: 200 }),
      view === 'box' ? get({ action: 'ms-flagged', limit: 400 }).catch(() => flagged) : flagged, get({ action: 'machines' }).catch(() => ({ machines: [] }))]);
    runs = made.runs;
    // one machine's page shows the products of its own runs only
    const mine = new Set(runs.map((r) => r.id));
    batches = MACHINE ? list.batches.filter((b) => mine.has(b.run)) : list.batches;
    const who = document.getElementById('who');
    const link = (name, text) => {
      const a = el('a', name === MACHINE ? 'on' : '', text);
      a.href = name ? `?m=${encodeURIComponent(name)}` : location.pathname;
      return a;
    };
    machines = all.machines;
    who.replaceChildren('机器', link('', '所有机器'), ...all.machines.map((m) => link(m.machine, `${m.machine}（今天 ${m.arrived_today}）`)));
    flagged = box;
    if (view === 'cat') loadCatalog();
    if (['ms', 'msrec', 'mspend'].includes(view)) msLoad(view);
    if (PUB_VIEWS.includes(view)) loadPub();
    if (view === 'use') loadUsage(); // read only while it is looked at: reading counts too
    document.getElementById('when').textContent = `更新于 ${new Date().toLocaleTimeString('zh-CN')}`;
    msTopRead(); // the shop and the account, at the top of every view
    draw();
  } catch (e) {
    document.getElementById('when').textContent = `读取失败：${e.message}`;
  }
}

document.getElementById('more').onclick = () => { wanted = 100; load(); };
load();
setInterval(() => { if (!document.hidden) load(); }, 60000);
// Nothing is read while the page is not looked at; coming back to it, it is read at once - it
// showed what it had read before until the minute came round (the owner, 2026-10-09).
let shownAt = Date.now();
document.addEventListener('visibilitychange', () => {
  if (document.hidden || Date.now() - shownAt < 5000) return;
  shownAt = Date.now();
  load();
});

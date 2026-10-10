// The "Publishing" view of the Haloo AI page: how far each product got - read off a list, made in
// Miaoshou, published to the Temu shop or failed and why - as LogoGuard holds it (lg-grab
// catalog-list), and the two things a person decides here: make products of what was read, and
// publish what was made. The page itself can do neither: both happen in Miaoshou with the
// user's own login, so it asks the Haloo AI extension in this same browser (bridge.js), and the
// extension tells LogoGuard what became of each product. Without the extension the page only shows.
// Loaded by index.html, whose el() and post() it uses. One call of the cloud each time the page
// reads (once a minute while this view is open); talking to the extension costs nothing.
let pubData = null;   // the made products and the numbers, of the kind that is looked at
// The three ways into Miaoshou have their progress apart (the owner, 2026-10-09): which one is
// looked at - 'factory', 'temu' or 'link' (kinds.js) - kept in this browser.
let pubKind = (() => { try { return localStorage.pubKind || ''; } catch { return ''; } })();
const pubKindSet = (k) => { pubKind = k; try { localStorage.pubKind = k; } catch { /* a browser that keeps nothing */ } pubData = null; draw(); };
let pubAsking = false; // the cloud is being asked for them
let ext = null;       // { version } once the extension answered; false when there is none here
let extMake = null;   // what the extension says of making products
let extPub = null;    // and of publishing
let makeN = 20;
let extTimer = null;
const PUB_VIEWS = ['pub', 'runs']; // the views that show the steps
if (typeof actCards === 'undefined') {
  const s = document.createElement('script');
  s.src = 'acts.js';
  s.onload = () => { if (typeof draw === 'function') draw(); };
  document.head.append(s);
}
let factory = null;   // the factory's designs: how many there are to put into the catalog (asked of the extension, which asks the cloud)
let factoryN = 20;
let factoryAt = 0;
let factoryWhy = '';   // why the numbers could not be had: said on the page instead of leaving the block out
let pubSet = null;    // what making and publishing are set to (lg-grab settings)

function askExt(msg, ms = 5000) {
  return new Promise((done, fail) => {
    const id = Math.random().toString(36).slice(2);
    const on = (e) => {
      const d = e.data;
      if (e.source !== window || !d || d.haloo !== 'answer' || d.id !== id) return;
      clearTimeout(timer);
      window.removeEventListener('message', on);
      if (d.ok) done(d.data); else fail(new Error(d.error || '插件没做成'));
    };
    const timer = setTimeout(() => { window.removeEventListener('message', on); fail(new Error('插件没有回应')); }, ms);
    window.addEventListener('message', on);
    window.postMessage({ haloo: 'ask', id, msg }, location.origin);
  });
}

// What the extension is doing now; asked again every few seconds only while it is at work.
// It is asked again every few seconds while the page is looked at (talking to the extension costs
// nothing): a batch started on a Temu page shows here without the page being reloaded. When what
// the extension says has changed the view is drawn again, and - a product made, set ready or
// published is a change in the cloud too - the view reads the cloud again, at most every
// EXT_CLOUD_MS (three calls a time: a batch watched for an hour is some 500 calls).
const EXT_VIEWS = ['pub', 'mspend', 'ms', 'msrec'];
const EXT_EVERY_MS = 4000;
const EXT_CLOUD_MS = 20000;
let extSaid = '';
let extCloudAt = 0;
async function extRead() {
  try {
    if (!ext) ext = await askExt({ type: 'hello' }, 1500);
    [extMake, extPub] = await Promise.all([askExt({ type: 'make-state' }), askExt({ type: 'pub-state' })]);
  } catch {
    if (!ext) ext = false;
  }
  clearTimeout(extTimer);
  if (ext) extTimer = setTimeout(extWatch, EXT_EVERY_MS);
}
async function extWatch() {
  if (document.hidden || !EXT_VIEWS.includes(view)) { extTimer = setTimeout(extWatch, EXT_EVERY_MS); return; }
  await extRead();
  const m = extMake || {};
  const p = extPub || {};
  const said = JSON.stringify([m.running, m.started, m.made, m.skipped, m.failed, m.claimed, m.ready, m.note, p.running, p.ok, (p.failed || []).length,
    Object.keys(p.waiting || {}).length, (p.queue || []).length, (p.setup || []).length]);
  if (said === extSaid) return;
  const was = extSaid ? JSON.parse(extSaid) : [];
  if ((was[0] && !m.running) || (was[8] && !p.running)) msAutoSync(true); // a batch has just ended: Miaoshou is read again
  const first = !extSaid;
  extSaid = said;
  if (first) return; // nothing changed yet: this is what it said when the page was read
  if (Date.now() - extCloudAt > EXT_CLOUD_MS) {
    extCloudAt = Date.now();
    if (view === 'pub') loadPub(); else msLoad(view); // these draw when they have read
  } else if (view === 'pub' || view === 'mspend') draw();
}

async function loadPub() {
  pubAsking = true;
  try {
    const kind = pubKind === 'factory' ? 'factory' : 'temu'; // link collecting does not go through the catalog: its page shows Miaoshou's numbers
    const [d, s] = await Promise.all([post({ action: 'catalog-list', state: 'made', limit: 2000, kind }),
      pubSet ? { settings: pubSet } : post({ action: 'settings' }).catch(() => ({})), extRead()]);
    pubData = d;
    pubSet = s.settings || null;
    if (PUB_VIEWS.includes(view)) draw();
  } catch { /* the next round tries again */ }
  pubAsking = false;
}

// A word to the user that does not stop the page: in the corner, gone by itself.
function say(text, bad) {
  let box = document.getElementById('say');
  if (!box) { box = document.createElement('div'); box.id = 'say'; document.body.append(box); }
  box.textContent = text;
  box.className = bad ? 'bad' : '';
  box.style.display = 'block';
  clearTimeout(say.timer);
  say.timer = setTimeout(() => { box.style.display = 'none'; }, bad ? 15000 : 8000);
}
async function extDo(msgs, btn) {
  if (btn) btn.disabled = true;
  try {
    // a round's first step can take a minute (the photographs and the GCC are put into Miaoshou
    // the first time), and the answer comes only after it
    for (const m of msgs) await askExt(m, m.type === 'pub-start' ? 90000 : 20000);
  } catch (e) {
    // said in a corner, not in a box that stops the page (the owner, 2026-10-09: the box said
    // "no answer" over a round that was going, and held the page until it was pressed away)
    say(e.message === '插件没有回应' ? '插件还没回话，可能还在做：进度会自己出现在这里。' : `插件没做成：${e.message}`, e.message !== '插件没有回应');
  }
  await extRead();
  draw();
}

// What this batch has made so far, newest first, under a row that turns while the next one is
// being made (the owner, 2026-10-09: a batch at work is to be seen working). The rows are the
// cloud's - a product shows here once the extension has told the cloud of it, some seconds
// after it was made - and "this batch" is what was made since the batch started.
function batchTable(rows, b) {
  if (!b.started) return '';
  const mine = rows.filter((r) => r.made_at && Date.parse(r.made_at) >= b.started - 5000).sort((x, y) => Date.parse(y.made_at) - Date.parse(x.made_at));
  if (!b.making && !mine.length) return '';
  const t = el('table', 'batchrows');
  const hr = el('tr');
  for (const x of ['', '产品', '走到哪一步', '建好时间']) hr.append(el('th', '', x));
  t.append(hr);
  if (b.making) {
    const tr = el('tr', 'working');
    const cell = el('td'); cell.append(el('span', 'spin'));
    const m = extMake || {};
    tr.append(cell, el('td', '', '正在建下一个…'), el('td', 'dim', `这一批第 ${Number(m.made || 0) + Number(m.skipped || 0) + Number(m.failed || 0) + 1} 个`), el('td', '', ''));
    t.append(tr);
  }
  for (const r of mine.slice(0, 50)) {
    const tr = el('tr');
    const pic = el('td');
    if (r.main) { const img = el('img'); img.loading = 'lazy'; img.referrerPolicy = 'no-referrer'; img.width = 40; img.height = 40; img.style.objectFit = 'cover'; img.src = `${r.main}?imageView2/2/w/120/q/70/format/webp`; pic.append(img); }
    const step = r.pub === 'published' ? '已上架' : r.pub === 'unpublished' ? `发布失败：${r.pub_why || ''}` : r.pub === 'sent' ? '已交给妙手发布' : r.ready_at ? '已设好待发' : r.temu_id ? '已认领到采集箱' : '已在妙手建好';
    tr.append(pic, el('td', '', r.title || r.goods_id), el('td', r.pub === 'unpublished' ? 'o-lost' : r.ready_at || r.pub ? 'o-arrived' : 'o-had', step),
      el('td', '', new Date(r.made_at).toLocaleTimeString('zh-CN', { hour12: false })));
    t.append(tr);
  }
  const box = el('div');
  box.append(el('div', 'dim', `这一批已经建好的 ${mine.length} 个${mine.length > 50 ? '（显示最新的 50 个）' : ''}，最新的在上面：`), t);
  return box;
}

// The three kinds to choose from, at the very top: what is below is of the one chosen.
function pubTabs() {
  const k = (msOver && msOver.kinds) || {};
  const f = (msOver && msOver.factory) || {};
  const box = el('div', 'kindtabs');
  for (const kind of HalooKinds.KINDS) {
    const x = k[kind] || {};
    const b = el('button', kind === pubKind ? 'on' : '');
    b.append(el('b', '', HalooKinds.NAME[kind]),
      el('span', '', kind === 'link' ? `已进妙手 ${Number(x.in_ms || 0).toLocaleString('en-US')} · 未发布 ${Number(x.pending || 0).toLocaleString('en-US')}`
        : `还没建 ${Number((x.todo || 0) + (kind === 'factory' ? f.ready || 0 : 0)).toLocaleString('en-US')} · 已建 ${Number(x.in_ms || 0).toLocaleString('en-US')} · 未发布 ${Number(x.pending || 0).toLocaleString('en-US')}`));
    b.onclick = () => pubKindSet(kind);
    box.append(b);
  }
  return box;
}

// Link collecting: nothing is made here - products are collected whole on Temu's pages with
// Miaoshou's own collecting - so its page is Miaoshou's numbers and the way on to publishing.
function pubLinkView() {
  const k = ((msOver && msOver.kinds) || {}).link || {};
  const n = (v) => Number(v || 0).toLocaleString('en-US');
  const box = el('div', 'batch');
  const tiles = el('div', 'tiles');
  tiles.append(msTile(n(k.in_ms), `已进妙手（今天 ${n(k.today)}）`, 'good'), msTile(n(k.pending), '其中还没发布', k.pending ? 'warn' : ''),
    msTile(n(k.ok), '发布成功', 'good'), msTile(n(k.bad), '发布失败', k.bad ? 'bad' : ''));
  const go = el('button', 'act-go', '去勾选发布');
  go.onclick = () => { view = 'mspend'; draw(); };
  const runs = el('button', 'act-alt', '看每一轮采集');
  runs.onclick = () => { view = 'runs'; draw(); };
  const line = el('div', 'act-do'); line.append(go, runs);
  box.append(el('h2', '', HalooKinds.NAME.link), el('div', 'dim', HalooKinds.SAYS.link), tiles, line,
    el('div', 'dim', '采集是在 Temu 的页面上做的，不在这里开批次；每一轮采了多少在“轮次”里。这里的数是妙手的，和妙手同步之后才更新（总览里的“同步最新”）。'));
  return [box];
}

function pubView() {
  const top = el('div', 'batch');
  if (typeof HalooKinds === 'undefined') { top.append(el('div', 'empty loading', '读取中…')); return [top]; }
  if (!msOver && typeof msTopRead === 'function') msTopRead(); // the tabs' numbers come with the overview
  if (!HalooKinds.KINDS.includes(pubKind)) pubKind = ((msOver && msOver.kinds && msOver.kinds.factory) || {}).todo || ((msOver && msOver.factory) || {}).ready ? 'factory' : 'temu';
  if (pubKind === 'link') return [pubTabs(), ...pubLinkView()];
  if (!pubData) { top.append(el('div', 'empty loading', '读取中…')); return [pubTabs(), top]; }
  const c = pubData;
  const n = (v) => Number(v || 0).toLocaleString('en-US');
  const st = c.states || {};
  // made and in the Temu collect box, and not published: never tried, or tried and failed
  const open = c.rows.filter((r) => r.temu_id && r.pub !== 'published' && r.pub !== 'sent');
  const failed = open.filter((r) => r.pub === 'unpublished');
  const untried = open.filter((r) => r.pub !== 'unpublished');
  // the way into Miaoshou and on to the shop, each step with its own bar (steps.js)
  const all = HalooSteps.steps({ total: c.total, todo: st.todo, made: st.made, skipped: st.skipped, had: st.had, claimed: c.claimed }, c.rows);
  const [sumCls, sumText] = HalooSteps.summary(all);
  const tiles = el('div');
  tiles.append(stepsLine(all, sumText, sumCls), stepsBox(all));
  // the batch this browser is at, or was at last: apart from the history below it
  const now = el('div', 'batch');
  // a batch is of one kind (the extension says which; one from before that was is of the Temu kind)
  const batchKind = (extMake && extMake.kind) || 'temu';
  const b = batchKind === pubKind ? HalooSteps.batch(extMake, extPub) : null;
  if (b) {
    const when = (x) => new Date(x).toLocaleString('zh-CN', { hour12: false });
    const doing = [b.making ? '正在建产品' : '', b.publishing ? '正在发布' : ''].filter(Boolean).join('，') || `已停${b.ended ? `（${when(b.ended)}）` : ''}`;
    const head = el('h2', '', '当前批次');
    if (b.making || b.publishing) head.prepend(el('span', 'spin'), ' ');
    now.append(head,
      el('div', 'dim', `${doing}${b.started ? `　开始于 ${when(b.started)}` : ''}。这里只算这一批，不含以前的。`),
      !b.making && b.note ? el('div', /stopped|failed|cannot|not signed/i.test(b.note) ? 'o-lost' : 'dim', `停下时插件说的：${b.note}`) : '',
      stepsBox(b.steps),
      b.why.length ? el('div', 'dim', `这一批不建的原因：${b.why.map(([why, k]) => `${CAT_WHY[why] || why} ${k} 个`).join(' · ')}。`) : '',
      batchTable(c.rows, b));
  } else {
    now.append(el('h2', '', '当前批次'), el('div', 'empty', extMake && extMake.started && batchKind !== pubKind ? `这个浏览器里最近的一批是“${HalooKinds.NAME[batchKind]}”的${extMake.running ? '，正在跑' : ''}：切到那个页签看。` : ext ? '这个浏览器里还没有跑过这一种的批次。在 Temu 列表页点“Grab this page”，或在下面点“在妙手建产品”，就开始一批。'
      : '当前批次是装了插件的那个浏览器里正在跑的那一批；这个浏览器里没有插件，所以看不到。'));
  }
  const lists = el('div', 'batch');
  lists.append(el('h2', '', '每个列表走到哪一步'), el('div', 'dim', '读过的每个搜索词或店铺一行。读列表只是第一步，建产品之后才在妙手里。'));
  for (const k of HalooSteps.byList(c)) {
    const [cls, text] = HalooSteps.summary(k.steps);
    lists.append(stepsLine(k.steps, `${k.keyword || '（无）'} · 读到 ${n(k.n)} · ${text}`, cls));
  }
  const here = ext ? `这个浏览器里有 Haloo AI 插件（${ext.version}）：下面的按钮在这里可用。`
    : ext === false ? '这个浏览器里没有 Haloo AI 插件：这个页面只能看。建产品和发布是在妙手里用你自己的登录做的，所以按钮要在装了插件的浏览器里才能用。'
      : '正在这个浏览器里找 Haloo AI 插件…';
  top.append(el('h2', '', `历史累计：${HalooKinds.NAME[pubKind]}`), el('div', 'dim', '这一种从开始到现在所有批次、所有机器加起来。'), tiles, el('div', 'dim', here),
    c.matched > c.rows.length ? el('div', 'dim', `已建的 ${n(c.matched)} 个产品里，这里只看最新的 ${n(c.rows.length)} 个。`) : '');

  // The numbers of the factory's designs: asked once when the view is opened and after each
  // putting in - one call of the cloud, through the extension.
  if (ext && !factory && Date.now() - factoryAt > 60000) {
    factoryAt = Date.now();
    askExt({ type: 'factory', n: 0 }, 20000).then((f) => { factory = f; factoryWhy = ''; if (view === 'pub') draw(); })
      .catch((e) => { factoryWhy = e.message || '没有回答'; if (view === 'pub') draw(); });
  }
  // what can be done, as three cards (acts.js)
  const ready = untried.filter((r) => r.ready_at).length;
  const acts = typeof actCards === 'function' ? actCards({ kind: pubKind, todo: Number(st.todo || 0), ready, unready: untried.length - ready, failed: failed.length })
    : el('div', 'empty loading', '读取中…');
  // What can be done comes first, in the order it is done (the owner, 2026-10-09: it was below
  // everything there is to look at, and had to be scrolled to); then what there is to look at.
  return [pubTabs(), acts, fold(now, !!(b && (b.making || b.publishing))), fold(paceBox(pubData)), fold(top), fold(lists)];
}

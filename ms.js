// Part of the Haloo AI page: Miaoshou's own data - what is read, and the reading of Miaoshou
// again. The three views - the overview (总览), Miaoshou's publish record (发布记录) and what its
// Temu collect box holds unpublished (待发布) - are in ms_views.js, the line at the top of every
// view and the choice of shop in ms_top.js. All of it is read
// from the copy LogoGuard keeps (lg-grab ms-overview, ms-pub-list, ms-pending-list). The copy is
// made by the Haloo AI extension in a browser signed in to Miaoshou, when "同步" is pressed here
// or a round of publishing has ended; the page says when that last was. Publishing from the
// list is asked of the extension too (bridge.js), as in publish.js, whose askExt / extRead /
// extDo this uses, with core.js's el() and catalog.js's post().
// One call of the cloud each time a view reads (once a minute while it is open).
let msOver = null;
let msRec = null;
let msPend = null;
let msSync = null; // what the extension says of its reading Miaoshou
let msSyncTimer = null;
let msWho = null; // which Miaoshou account, shop and seller-centre shop this browser is working as (the extension says)
const recAsk = { status: null, why: null, source: null };
const pendAsk = { kind: null }; // ready / unready / failed / collected, or all
let msMade = null; // the products we made, as the cloud knows them: newer than Miaoshou's list
const pendPick = new Set(); // Temu box ids ticked for publishing

const msN = (v) => Number(v || 0).toLocaleString('en-US');
const msTime = (t) => (t ? new Date(t).toLocaleString('zh-CN', { hour12: false }) : '');
const msTile = (v, what, cls) => { const t = el('div', `tile ${cls || ''}`); t.append(el('b', '', v), what); return t; };
// kinds.js is new beside this file: a browser still holding the index.html of before does not load
// it, and this script came fresh - so it is fetched here when it is missing, and the views wait.
if (typeof orderGive === 'undefined') {
  const s = document.createElement('script');
  s.src = 'orders.js';
  s.onload = () => { if (typeof view !== 'undefined' && view === 'mspend') msLoad('mspend'); };
  document.head.append(s);
}
if (typeof roundBox === 'undefined') {
  const s = document.createElement('script');
  s.src = 'round.js';
  s.onload = () => { if (typeof draw === 'function') draw(); };
  document.head.append(s);
}
if (typeof HalooKinds === 'undefined') {
  const s = document.createElement('script');
  s.src = 'kinds.js';
  s.onload = () => { if (typeof draw === 'function') draw(); };
  document.head.append(s);
}
// ms_top.js and ms_views.js were this file's own until 2026-10-09: the same goes for them. False
// while they are on their way; the page is drawn when they have come.
let msPartsAsked = false;
function msParts() {
  if (typeof msTopDraw === 'function' && typeof msView === 'function') return true;
  if (!msPartsAsked) {
    msPartsAsked = true;
    for (const f of ['ms_top.js', 'ms_views.js']) {
      const s = document.createElement('script');
      s.src = f;
      s.onload = () => { if (msParts() && typeof draw === 'function') draw(); };
      document.head.append(s);
    }
  }
  return false;
}
const sourceName = (row) => (typeof HalooKinds === 'undefined' ? '' : HalooKinds.name(row)); // which of the three ways a row came (kinds.js)

async function msLoad(what) {
  try {
    const ask = what === 'msrec' ? post({ action: 'ms-pub-list', status: recAsk.status, why: recAsk.why, source: recAsk.source, limit: 200 })
      : what === 'mspend' ? Promise.all([post({ action: 'ms-pending-list', limit: 2000 }), post({ action: 'catalog-list', state: 'made', limit: 2000 })]) : Promise.resolve(null);
    const [over, part] = await Promise.all([post({ action: 'ms-overview' }), ask, extRead().then(msSyncRead).then(msWhoRead), what === 'mspend' && typeof ordersRead === 'function' ? ordersRead() : null]); // the extension is found first, then asked
    msOver = over;
    if (what === 'msrec') msRec = part;
    if (what === 'mspend') [msPend, msMade] = part;
    if (view === what) draw();
    msAutoSync(false);
  } catch { /* the next round tries again */ }
}

// The extension's reading of Miaoshou: asked again every two seconds while it is at it, and
// when it is done the view reads the cloud once more.
async function msSyncRead() {
  if (!ext) return;
  try {
    const was = msSync && msSync.running;
    msSync = await askExt({ type: 'ms-mirror-state' });
    clearTimeout(msSyncTimer);
    if (msSync.running) msSyncTimer = setTimeout(async () => { await msSyncRead(); if (['ms', 'msrec', 'mspend'].includes(view)) draw(); }, 2000);
    else if (was) msLoad(view);
  } catch { /* an extension older than this page */ }
}

// Miaoshou is read again without being asked (the owner, 2026-10-09: the page showed what it had
// read an hour before): when the copy is older than MS_STALE_MS while one of these views is
// looked at, and at once when a batch of making or publishing has just ended. Only where the
// extension is, never while the page is hidden, never two at a time. A reading is about six
// calls of the cloud: a page left open on these views all day is some three hundred.
const MS_STALE_MS = 10 * 60000;
let msAutoAt = 0;
async function msAutoSync(now) {
  if (!ext || document.hidden || (msSync && msSync.running) || !msOver) return;
  const last = Math.min(Date.parse(msOver.pub_read || 0) || 0, Date.parse((msOver.temu_box || {}).at || 0) || 0);
  if (!now && (Date.now() - last < MS_STALE_MS || Date.now() - msAutoAt < MS_STALE_MS)) return;
  if (now && Date.now() - msAutoAt < 30000) return;
  msAutoAt = Date.now();
  try {
    msSync = await askExt({ type: 'ms-mirror', all: false }, 20000);
    await msSyncRead();
    if (['ms', 'msrec', 'mspend'].includes(view)) draw();
  } catch { /* an extension older than this page, or Miaoshou not signed in: the buttons say why */ }
}

// Asked of the extension, which asks Miaoshou (it keeps the answer half an hour): nothing of our cloud.
async function msWhoRead() {
  if (!ext) return;
  try { msWho = await askExt({ type: 'who' }, 8000); } catch { /* an extension older than this page */ }
}

async function msSyncStart(all, btn) {
  btn.disabled = true;
  try {
    msSync = await askExt({ type: 'ms-mirror', all }, 20000);
  } catch (e) {
    window.alert(`插件没有开始同步：${e.message}`);
  }
  await msSyncRead();
  draw();
}

// When Miaoshou was last read, and the two buttons that have the extension read it again.
function msSyncBar() {
  const o = msOver || {};
  const box = el('div', 'batch');
  const line = el('div', 'key');
  const recent = el('button', '', '同步最新');
  const all = el('button', '', '全部重新同步');
  const busy = msSync && msSync.running;
  recent.disabled = all.disabled = !ext || busy;
  recent.title = '读妙手发布记录最新的 200 条，和 Temu 采集箱里全部未发布的产品';
  all.title = '把妙手的发布记录从头到尾读一遍（几千条，约一两分钟），和全部未发布的产品';
  recent.onclick = () => msSyncStart(false, recent);
  all.onclick = () => msSyncStart(true, all);
  line.append(recent, all);
  const when = `发布记录上次同步：${o.pub_read ? msTime(o.pub_read) : '还没同步过'}；未发布清单上次同步：${o.temu_box ? msTime(o.temu_box.at) : '还没同步过'}。`;
  box.append(el('h2', '', '和妙手同步'), el('div', 'dim', when), line,
    busy ? el('div', 'dim', '插件正在读妙手…') : '',
    el('div', 'dim', ext ? `这个浏览器里装着 Haloo AI 插件（${ext.version}），同步和发布都由它在妙手里做，用的是你自己的妙手登录。打开这几页时，妙手的数据超过 10 分钟没同步会自动同步一次；一批建完或发完也会马上同步。`
      : ext === false ? '这个浏览器里没有 Haloo AI 插件：这里只能看。同步和发布要在装了插件、登录了妙手的浏览器里点。' : '正在找这个浏览器里的 Haloo AI 插件…'));
  return box;
}

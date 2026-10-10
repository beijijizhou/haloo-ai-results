// Public page (published by scripts/publish_haloo_page.sh; no passcode in it): asks LogoGuard's lg-grab function
// for the batches the Haloo AI Assistant extension submitted. The function runs next to the database.
// Reading needs nothing; labelling a picture needs Haloo AI Assistant's passcode, typed once and kept in
// this browser.
const API = 'https://ziveajlinhmafqcweahx.supabase.co/functions/v1/lg-grab?forceFunctionRegion=us-east-1';
const PAGE = 30;
const NAME = { pass: '通过', review: '待复核', block: '拦截', error: '出错', waiting: '判断中', along: '未判断，随商品一起' };
const TAG = { '双面': '双面' }; // a tag as the extension stores it, and as it is shown
const SAY = { infringing: '侵权', false_positive: '不侵权', unsure: '不确定' };
const WHO = { machine: '机器', claude: 'Claude', human: '人工', takedown: 'Temu 下架' }; // who gave a design its verdict
let view = 'ms';
let machines = []; // every collecting machine, with what it got into Miaoshou
let batches = [];
let runs = [];
let flagged = { counts: { all: 0, pass: 0, review: 0, block: 0 }, items: [] }; // Miaoshou's box: main pictures not cleared
let only = null; // a run's id: show only its products
// ?m=<name>: one machine's own page (the link in its Haloo AI Assistant panel). Without it, all machines;
// the totals of all of them are also on LogoGuard's review page (its 妙手图 tab).
const MACHINE = new URLSearchParams(location.search).get('m') || '';
let wanted = 100; // a run can hold dozens of products, one batch each

const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};
const state = (p) => p.along ? 'along' : p.status === 'done' ? p.verdict : p.status === 'error' ? 'error' : 'waiting';
const cleared = (b, p) => state(p) === 'pass' || (state(p) === 'review' && b.review);
const went = (b) => b.kind === 'product' && b.miaoshou === 'done';
// A product's pictures as the page shows them: the judged ones, then those that went along.
const rows = (b) => [...b.pictures, ...(b.others || []).map((url) => ({ url, along: true }))];
// in: did this picture reach Miaoshou? Only a product that was handed over has any that did.
const inside = (b, p) => went(b) && (p.along || cleared(b, p));

// The side navigation, nested (the owner's rule for every project: what the page is for is a
// parent on the left, its pages are its children set in under it, and the right shows the one
// child that is chosen; every entry has an icon). The parents are the kinds of thing there are
// (the owner, 2026-10-09): what Miaoshou holds, the batches - a list read and products made of
// it -, the pictures LogoGuard judged, and the page's own upkeep. Only the parent of the chosen
// page is open; pressing a parent opens it at its first child. VIEWS says which batches a view
// shows, which of their pictures, and what it says above them.
const NAV = [
  { name: '妙手', icon: 'package', views: ['ms', 'mspend', 'msrec'] },
  { name: '批次', icon: 'layers', views: ['pub', 'runs', 'cat'] },
  { name: '图片', icon: 'image', views: ['all', 'waiting', 'kept', 'todo', 'known', 'box', 'page'] },
  { name: '厂里', icon: 'factory', views: ['hot'] },
  { name: '设置', icon: 'settings', views: ['set', 'use'] },
];
// The icon of each page, by its name in Lucide (icons.js; the owner's design standard allows no
// other set, and fixes circle-check, circle-x, clock, triangle-alert, info and a few more to their
// meanings). A parent's icon is named in NAV. Drawn in the colour of the words beside it.
const ICONS = { ms: 'layout-dashboard', mspend: 'clock', msrec: 'list-checks', pub: 'route', runs: 'repeat', cat: 'book-open',
  all: 'images', waiting: 'hourglass', kept: 'shield-x', todo: 'tag', known: 'copy', box: 'package-x', page: 'panel-top',
  hot: 'flame', set: 'sliders-horizontal', use: 'chart-column' };
const icon = (name) => {
  const i = document.createElement('i');
  i.className = 'icon';
  i.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${LUCIDE[ICONS[name] || name] || ''}</svg>`;
  return i;
};
// What is there to be looked at, not acted on, is shut until asked for (the owner's design standard:
// the first screen says how things are and what to do). The heading stays as the line to press;
// whether it was opened is remembered across the page's drawings, by the heading's words.
const folds = {};
function fold(box, open) {
  const h = box.querySelector(':scope > h2');
  if (!h) return box;
  const key = h.textContent;
  const d = el('details', 'batch fold');
  d.open = key in folds ? folds[key] : !!open;
  d.ontoggle = () => { folds[key] = d.open; };
  const s = el('summary');
  const rest = [...box.childNodes].filter((n) => n !== h);
  s.append(icon('chevron-right'), h);
  d.append(s, ...rest);
  return d;
}
// Which icon a button gets, by what its words say it does (Lucide; icons.js).
const BUTTON_ICONS = [[/停|取消/, 'square'], [/同步|刷新|重新|再读|再试|重试/, 'refresh-cw'], [/下载|导出/, 'download'], [/保存|改成/, 'check'],
  [/放进|上传/, 'upload'], [/全部|全选|选上|勾选/, 'list-checks'], [/回到|返回/, 'undo-2'], [/更早|更多|本轮|去/, 'chevron-right'],
  [/发布|建产品|继续|开一批|开始|读/, 'play']];
const NUMBER = /^[-−+]?[\d,.]+\s*(%|个|秒|次|张|小时|分钟)?$/;
function dress(root) {
  if (!root) return;
  for (const b of root.querySelectorAll('button')) {
    if (b.querySelector('.icon') || b.closest('.say, .kindtabs, .key')) continue; // those choose what is shown; they do nothing
    const words = b.textContent;
    b.prepend(icon((BUTTON_ICONS.find(([re]) => re.test(words)) || [0, 'chevron-right'])[1]));
  }
  for (const t of root.querySelectorAll('table')) {
    const rows = [...t.rows];
    const body = rows.filter((r) => r.cells.length && r.cells[0].tagName === 'TD');
    const wide = Math.max(0, ...rows.map((r) => r.cells.length));
    for (let j = 0; j < wide; j++) {
      const cells = body.map((r) => r.cells[j]).filter((c) => c && c.colSpan === 1 && c.textContent.trim());
      if (!cells.length || !cells.every((c) => !c.children.length && NUMBER.test(c.textContent.trim()))) continue;
      for (const r of rows) if (r.cells[j] && r.cells[j].colSpan === 1) r.cells[j].classList.add('num');
    }
  }
}
const VIEWS = {
  ms: { name: '总览', batch: () => false, pic: () => true,
    note: '妙手里现在的情况：公用采集箱、Temu 采集箱、发布记录，分成 Haloo AI 采集的和人工采集的两块。数据是插件从妙手读来存在云端的，页面上写着上次同步的时间。' },
  msrec: { name: '发布记录', batch: () => false, pic: () => true,
    note: '妙手自己的发布记录：每一次发布是成功还是失败，失败是什么原因。在妙手里手动发的、以前采集来发的、插件发的都在。' },
  mspend: { name: '待发布', batch: () => false, pic: () => true,
    note: '所有还没发布的产品在这一张清单里：Haloo AI 采集的（已设好待发、还没设好、上次没发成）和人工采集的。勾选后在这里发布；发布由这个浏览器里的插件在妙手里做，用的是你自己的妙手登录。' },
  runs: { name: '轮次', batch: () => false, pic: () => true,
    note: '在列表页每点一次“Grab this page”就是一轮：这一页有多少商品、筛掉多少、判断了多少、交给妙手多少、真正进了妙手采集箱多少。点“本轮的商品”看每一个。' },
  cat: { name: '目录', batch: () => false, pic: () => true,
    note: '从 Temu 列表上读到的商品，没有打开商品页：ID、标题、主图、价格、销量。之后按这些行在妙手里建产品。可以下载成表格。' },
  pub: { name: '产品进度', batch: () => false, pic: () => true,
    note: '每个产品走到哪一步：从列表读到、在妙手建好、发布到 Temu 店铺，或者失败及原因。建产品和发布都在这里操作；实际由这个浏览器里的 Haloo AI 插件在妙手里用你自己的登录完成。' },
  hot: { name: '厂里热卖', batch: () => false, pic: () => true,
    note: '厂里订单最多的设计，来自 LogoGuard 的图案台账（相似的图算一个）：有多少设计卖得好、每天新出现多少、每个设计的结论和依据。放行的热卖设计有去掉订单标签和二维码的原图。要口令才能看。' },
  set: { name: '运行参数', batch: () => false, pic: () => true,
    note: '插件运行用的数字和搜索词：等多久、一次取几个、搜什么词。存在云端，在这里改，不用发新版插件。' },
  use: { name: '用量', batch: () => false, pic: () => true,
    note: '云端被调用了多少次：这是按次数计费的。每天多少次、谁调用的、平均每个商品几次；下面按机器数量估算每月调用次数，以及落在套餐的哪一档。' },
  box: { name: '妙手里被拦的', batch: () => false, pic: () => true,
    note: '已经在妙手采集箱里、主图被 LogoGuard 拦截或待复核的商品（只看了主图）。用采集箱 ID 可以在妙手里找到它。如果结论看着不对，就标注；以后同一张图按你的标注算。' },
  kept: { name: '被拦下的图', batch: () => true, pic: (b, p) => !p.along && ['review', 'block'].includes(state(p)) && !cleared(b, p),
    note: '没放行的图片：被拦截，或待复核。如果结论看着不对，在图片下面标注；以后同一张图按你的标注算。' },
  todo: { name: '待标注', batch: () => true, pic: (b, p) => !p.along && ['review', 'block'].includes(state(p)) && !p.human,
    note: '机器拿不准或拦截了、还没有人看过的图片。标注需要口令；结论也会写进 LogoGuard 的图案台账。' },
  known: { name: '相似图案', batch: () => true, pic: (b, p) => !!p.ledger || p.same > 0,
    note: '靠图案指纹（相似度哈希）认出来的：和订单图案台账里的某个图案相同，或和另一张 Temu 图片相同。只有机器更新之后判断的图片才有指纹。' },
  waiting: { name: '判断中', batch: (b) => b.counts.waiting > 0, pic: () => true, note: 'LogoGuard 还没判断完的批次。机器先处理订单，所以可能要等。' },
  page: { name: '整页', batch: (b) => b.kind !== 'product', pic: () => true, note: '从整个列表页抓下来的图片；通过的已下载到机器上。' },
  all: { name: '全部图片', batch: () => true, pic: () => true, note: '所有人抓过的每个批次，最新的在前。' },
};
const shown = (key, run = only) => batches.filter((b) => (run ? b.run === run : VIEWS[key].batch(b)))
  .map((b) => [b, rows(b).filter((p) => run || VIEWS[key].pic(b, p))]).filter(([, pics]) => pics.length);

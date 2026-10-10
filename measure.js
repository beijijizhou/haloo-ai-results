// Part of the results page (index.html loads its scripts in this order: publish.js core.js home.js
// catalog.js ms.js measure.js page.js; they share what each declares at the top). Here: usage of the cloud, and speed.
// What is used of the cloud. The plan is Supabase's Pro (the organisation is on it; read from
// Supabase on 2026-10-08). What it includes and what more costs are from memory: the bill counts.
const PLAN = { name: 'Pro', month: 25, calls: 2000000, perMillion: 2, db: 8 * 1024 ** 3 };
const ACT = { run: '上报轮次和进度', opened: '上报一个商品的结果', arrived: '上报已进妙手', 'ms-sync': '同步妙手采集箱', 'ms-have': '问妙手有没有',
  ping: '核对口令', submit: '送图去判断', status: '问判断结果', record: '记录列表上的商品', report: '上报是否交给妙手', label: '标注',
  list: '读商品', runs: '读轮次', 'ms-flagged': '读被标出的', machines: '读机器', usage: '读用量' };
const CALLER = { extension: '插件（采集机器）', page: '这个结果页', review: 'LogoGuard 复查页' };
let usage = null;
const guess = { machines: 100, hours: 8, rate: 0, each: 0 }; // rate, each: 0 = what was measured
async function loadUsage() {
  try {
    const r = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'usage' }) });
    usage = await r.json();
    if (view === 'use') draw();
  } catch { /* the next round tries again */ }
}
function useView() {
  const top = el('div', 'batch');
  if (!usage) { top.append(el('div', 'empty loading', '读取中…')); return [top]; }
  const n = (v) => Number(v || 0).toLocaleString('en-US');
  const days = usage.days;
  const today = days.find((d) => d.day === usage.today) || { calls: 0, extension: 0, results_page: 0, review_page: 0, opened: 0, arrived: 0 };
  // calls a product: the extension's calls against the product pages it opened, over the days
  // counted from their start (the first day was counted from the evening on)
  const whole = days.filter((d) => d.day > usage.since && Number(d.opened) > 0);
  const each = whole.length ? whole.reduce((a, d) => a + Number(d.extension), 0) / whole.reduce((a, d) => a + Number(d.opened), 0) : 0;
  const month = days.filter((d) => d.day.slice(0, 7) === usage.today.slice(0, 7));
  const tile = (v, what, cls) => { const t = el('div', `tile ${cls || ''}`); t.append(el('b', '', v), what); return t; };
  const tiles = el('div', 'tiles');
  tiles.append(tile(n(today.calls), '今天云函数调用次数'), tile(n(today.extension), '其中插件调用'),
    tile(each ? each.toFixed(1) : '—', '平均每打开一个商品调用几次'),
    tile(n(month.reduce((a, d) => a + Number(d.calls), 0)), `本月已用（从 ${usage.since.slice(5)} 起算）`),
    tile(`${(usage.db_bytes / 1024 ** 3).toFixed(2)} GB`, `数据库（${PLAN.name} 含 ${PLAN.db / 1024 ** 3} GB）`));
  const head = el('div', 'head');
  head.append(el('h2', '', `今天（${usage.today}，按纽约时间算一天）`));
  top.append(head, tiles, el('div', 'dim', `现在的套餐：Supabase ${PLAN.name}，每月 $${PLAN.month}，含 ${n(PLAN.calls)} 次云函数调用，超出部分每百万次约 $${PLAN.perMillion}。`
    + '套餐是从 Supabase 读到的；含多少次调用和超出的价格是凭记忆写的，以账单为准。'));

  // how many machines, how many calls, which plan
  const plan = el('div', 'batch');
  plan.append(el('h2', '', '照这个速度，多少台机器要多少次调用'));
  const rate = guess.rate || 63; // an hour, as measured on 2026-10-07 (Speed)
  const per = guess.each || each || 8;
  const ask = (key, text, value, step) => {
    const l = el('label', 'ask', text);
    const i = el('input');
    i.type = 'number'; i.value = value; i.step = step || 1; i.min = 0;
    i.onchange = () => { guess[key] = Number(i.value) || 0; draw(); };
    l.append(i);
    return l;
  };
  const form = el('div', 'key');
  form.append(ask('machines', '机器数 ', guess.machines), ask('hours', '每台每天小时数 ', guess.hours),
    ask('rate', '每台每小时打开商品数 ', Math.round(rate)), ask('each', '每个商品调用次数 ', Math.round(per * 10) / 10, 0.1));
  const products = guess.machines * guess.hours * rate * 30;
  const calls = products * per;
  const over = Math.max(0, calls - PLAN.calls);
  const out = el('div', 'big');
  out.append(`每月约 ${n(Math.round(calls))} 次调用`, el('div', 'dim',
    `= ${n(guess.machines)} 台机器 × ${guess.hours} 小时 × 每小时 ${Math.round(rate)} 个 × 30 天（${n(Math.round(products))} 个商品）× ${per.toFixed(1)} 次调用。`
    + (over ? `超过 ${PLAN.name} 包含的 ${n(PLAN.calls)} 次：超出部分每月约 $${Math.ceil(over / 1e6 * PLAN.perMillion)}，加套餐 $${PLAN.month}，每月共约 $${PLAN.month + Math.ceil(over / 1e6 * PLAN.perMillion)}。`
      : `在 ${PLAN.name} 包含的 ${n(PLAN.calls)} 次以内：不用多付。`)
    + '只算云函数调用次数；结果页和复查页开着时也会调用，那是按人数算，不按机器数。'));
  plan.append(form, out);

  const two = el('div', 'batch');
  two.append(el('h2', '', '今天：谁调用的，调用了什么'));
  const t1 = el('table');
  const hr = el('tr');
  for (const x of ['调用方', '做什么', '调用次数', '占今天的比例']) hr.append(el('th', '', x));
  t1.append(hr);
  for (const a of usage.by_action) {
    const tr = el('tr');
    for (const x of [CALLER[a.who] || a.who, ACT[a.action] || a.action, n(a.n), `${Math.round(a.n / Math.max(1, today.calls) * 100)}%`]) tr.append(el('td', '', x));
    t1.append(tr);
  }
  two.append(t1);

  const each2 = el('div', 'batch');
  each2.append(el('h2', '', '按天'));
  const t2 = el('table');
  const h2 = el('tr');
  for (const x of ['日期', '调用总数', '插件', '结果页', '复查页', '采集的机器数', '打开的商品', '已进妙手', '插件每个商品调用次数']) h2.append(el('th', '', x));
  t2.append(h2);
  for (const d of days) {
    const tr = el('tr');
    const first = d.day === usage.since;
    for (const x of [d.day.slice(5), n(d.calls), n(d.extension), n(d.results_page), n(d.review_page), n(d.machines), n(d.opened), n(d.arrived),
      first ? '当晚才开始计数' : Number(d.opened) ? (d.extension / d.opened).toFixed(1) : '—']) tr.append(el('td', '', x));
    t2.append(tr);
  }
  each2.append(t2);
  return [top, plan, two, each2];
}

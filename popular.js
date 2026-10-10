// Part of the results page (loaded before page.js; shares what the other scripts declare at the top).
// Here: 厂里热卖 - the factory's most ordered designs, from LogoGuard's ledger (lg-grab "popular").
// Unlike the rest of the page this needs the passcode to READ: the list is the factory's own.
// Read only while it is looked at and when a filter changes - not every minute.
let pop = null;
let popSaid = '';
let popAsking = false;
const popAsk = { min: 5, verdict: 'pass', named: 'no', platform: null, new_days: null, art: false, sort: 'orders', q: null };
const POP_PAGE = 100;

async function popPost(body) {
  const r = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-lg-passcode': localStorage.passcode || '' },
    body: JSON.stringify({ action: 'popular', ...popAsk, ...body }) });
  const data = await r.json().catch(() => ({}));
  if (r.status === 401) { delete localStorage.passcode; throw new Error('口令不对。'); }
  if (!r.ok) throw new Error(data.error || r.status);
  return data;
}
async function loadPopular() {
  if (popAsking || !localStorage.passcode) return;
  popAsking = true;
  popSaid = '';
  try { pop = await popPost({ limit: POP_PAGE }); } catch (e) { popSaid = `没有读到：${e.message}`; }
  popAsking = false;
  if (view === 'hot') draw();
}
// Every design the filters leave, as a table a spreadsheet opens; the links in it are good for a day.
async function popDownload(btn) {
  btn.disabled = true;
  const rows = [];
  try {
    for (let offset = 0; ; offset += 1000) {
      const d = await popPost({ limit: 1000, offset });
      rows.push(...d.items);
      btn.textContent = `读取中… ${rows.length}`;
      if (d.items.length < 1000) break;
    }
  } catch (e) { btn.textContent = `没有读到：${e.message}`; btn.disabled = false; return; }
  const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [['design', 'orders', 'verdict', 'decided_by', 'names', 'platforms', 'first_day', 'last_order', 'width', 'height', 'label_cut', 'artwork_link', 'orders_all_platforms', 'orders_by_platform'].join(',')];
  for (const r of rows) lines.push([r.id, r.orders, r.verdict, r.decided_by, r.labels, (r.platforms || []).join(' '), r.first_day,
    r.last_at, r.width, r.height, r.art_label, r.art_url, r.orders_all, Object.entries(r.by_platform || {}).map(([k, v]) => `${k} ${v}`).join(' ')].map(cell).join(','));
  const a = el('a');
  a.href = URL.createObjectURL(new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv' }));
  a.download = `factory-popular-${popAsk.min}plus.csv`;
  a.click();
  btn.disabled = false;
  btn.textContent = `把这 ${rows.length} 个下载成表格（CSV）`;
}
function popView() {
  const top = el('div', 'batch');
  const n = (v) => Number(v || 0).toLocaleString('en-US');
  if (!localStorage.passcode) {
    const b = el('button', '', '输入口令');
    b.onclick = () => { const k = (window.prompt('Haloo AI Assistant 口令（这份清单只给自己人看）') || '').trim(); if (k) { localStorage.passcode = k; draw(); } };
    top.append(el('h2', '', '厂里热卖'), el('div', 'dim', '这一页是厂里的订单数据，要口令才能看。'), popSaid ? el('div', 'dim bad', popSaid) : '', b);
    return [top];
  }
  if (!pop) { top.append(el('div', popSaid ? 'empty' : 'empty loading', popSaid || '读取中…')); return [top]; }
  const p = pop;
  const day = (d) => (d ? `${d.slice(0, 2)}-${d.slice(2)}` : '');
  const tile = (v, what, cls) => { const t = el('div', `tile ${cls || ''}`); t.append(el('b', '', v), what); return t; };
  const tiles = el('div', 'tiles');
  const art = p.artwork || {};
  tiles.append(tile(n(p.range.designs), '厂里印过的设计（相似的图算一个）'), tile(n(p.total), `符合下面筛选的设计，共 ${n(p.orders)} 单`, 'good'),
    tile(n(p.with_art), '其中云端有去掉二维码的原图', p.with_art < p.total ? 'warn' : 'good'));
  top.append(el('h2', '', '厂里热卖'), tiles,
    el('div', 'dim', `数据从 ${new Date(p.range.from).toLocaleDateString('zh-CN')} 到 ${new Date(p.range.to).toLocaleDateString('zh-CN')}，共 ${n(p.range.files)} 个订单文件。“订单数”是印这个设计的订单文件数；时间还短，长期卖得好的要再攒几周才看得出。`),
    el('div', 'dim', `云端的原图：${n(art.made)} 张，${(art.bytes / 2 ** 30).toFixed(2)} GB（放行且 ${art.from_orders} 单及以上的才传；还没传的 ${n(art.waiting)} 个，原文件打不开的 ${n(art.failed)} 个）。图的链接 ${p.link_hours} 小时内有效，过期了刷新这一页。`),
    el('div', 'dim', `厂里电脑上另存的：${((p.kept || {}).places || []).map((k) => `${k.place} ${n(k.n)} 张`).join('；') || '还没有'}（云端 ${n(art.made)} 张；数目一样就是存齐了）。`));

  // the numbers: how many designs are ordered how often, and what LogoGuard says of them
  const nums = el('div', 'batch');
  const t1 = el('table');
  const h1 = el('tr');
  for (const x of ['订单数', '设计', '放行', '其中没认出任何名字', '拦截（侵权）', '待确认', '订单合计', '云端有图']) h1.append(el('th', '', x));
  t1.append(h1);
  for (const b of p.numbers) {
    const tr = el('tr');
    for (const x of [`${b.band} 单`, n(b.designs), n(b.pass), n(b.pass_clean), n(b.block), n(b.review), n(b.orders), n(b.art)]) tr.append(el('td', '', x));
    t1.append(tr);
  }
  const t2 = el('table');
  const h2 = el('tr');
  for (const x of ['第一次出现', '新设计', '放行', '拦截', '待确认', `放行且已到 ${p.asked.min} 单`]) h2.append(el('th', '', x));
  t2.append(h2);
  for (const d of p.days) {
    const tr = el('tr');
    for (const x of [day(d.day), n(d.designs), n(d.pass), n(d.block), n(d.review), n(d.popular)]) tr.append(el('td', '', x));
    t2.append(tr);
  }
  const scope = !popAsk.platform ? '' : popAsk.platform[0] === '!' ? `（只算 ${popAsk.platform.slice(1)} 以外的平台的订单）` : `（只算 ${popAsk.platform} 的订单）`;
  nums.append(el('h2', '', `有多少设计卖得好${scope}`), t1, el('h2', '', '每天新出现的设计'), t2,
    el('div', 'dim', '按厂里的生产日期（文件夹）。第一天的数偏大：LogoGuard 那天才开始记，之前就在卖的也算成那天的新设计。'));

  // the filters and the list
  const pick = el('div', 'batch');
  // one drop-down per filter, side by side (the owner, 2026-10-09: not a row of buttons each)
  const chips = (label, options, key) => {
    const box = el('label', '', label);
    const sel = el('select');
    options.forEach(([value, text], k) => {
      const o = el('option', '', text);
      o.value = k;
      o.selected = popAsk[key] === value;
      sel.append(o);
    });
    sel.onchange = () => { popAsk[key] = options[sel.value][0]; pop = null; draw(); };
    box.append(sel);
    return box;
  };
  const dl = el('button', '', `把这 ${n(p.total)} 个下载成表格（CSV）`);
  dl.onclick = () => popDownload(dl);
  const plats = p.platforms.filter((x) => /^[A-Za-z0-9]{1,12}$/.test(x.platform)); // a file's name in the folder's place is no platform
  const filters = el('div', 'pop');
  filters.append(
    chips('至少', [1, 2, 5, 10, 20, 50].map((v) => [v, `${v} 单`]), 'min'),
    chips('结论', [['pass', '放行'], ['review', '待确认'], ['block', '拦截'], [null, '全部']], 'verdict'),
    chips('名字', [['no', '没认出任何品牌或 IP 的名字'], ['yes', '认出了名字的'], [null, '都要']], 'named'),
    chips('出现', [[null, '不限'], [1, '近 1 天新出现'], [3, '近 3 天'], [7, '近 7 天']], 'new_days'),
    // every platform the factory prints for, the largest first, and "all but the largest": the
    // largest is our own shops' (the owner, 2026-10-09: the other platforms' orders are wanted too)
    chips('平台', [[null, '全厂'], ...(plats[0] ? [[`!${plats[0].platform}`, `${plats[0].platform} 以外的全部平台`]] : []),
      ...plats.map((x) => [x.platform, `${x.platform}（${n(x.designs)} 个设计，${n(x.orders)} 单）`])], 'platform'),
    chips('图', [[false, '不限'], [true, '只要云端有原图的']], 'art'),
    chips('排序', [['orders', '订单多的在前'], ['new', '新出现的在前'], ['recent', '最近有单的在前']], 'sort'));
  pick.append(el('h2', '', '清单'), filters, dl);
  if (!p.items.length) { pick.append(el('div', 'empty', '没有符合的设计。')); return [top, nums, pick]; }
  const t = el('table');
  const hr = el('tr');
  for (const x of ['', '订单', '每天几单', '各平台几单', '结论和依据', '第一次出现', '去掉二维码的原图']) hr.append(el('th', '', x));
  t.append(hr);
  for (const r of p.items) {
    const tr = el('tr');
    const pic = el('td');
    if (r.thumb_url) {
      const a = el('a'); a.href = r.art_url; a.target = '_blank'; a.rel = 'noopener';
      const img = el('img'); img.loading = 'lazy'; img.width = 96; img.style.borderRadius = '6px'; img.src = r.thumb_url;
      a.append(img); pic.append(a);
    }
    const days = Object.entries(r.by_day || {}).sort().map(([d, k]) => `${day(d)} ${k}`).join(' · ');
    const why = el('td');
    why.append(el('div', '', `${NAME[r.verdict] || r.verdict}（${WHO[r.decided_by] || r.decided_by}定的）`),
      el('div', 'dim', r.labels ? `认出的名字：${r.labels}` : '没认出任何名字'),
      r.sonnet ? el('div', 'dim', `Claude 复核：${{ ip: '是 IP', not_ip: '不是 IP', unsure: '拿不准' }[r.sonnet] || r.sonnet}`) : '');
    const link = el('td');
    if (r.art_url) {
      const open = el('a', '', `打开原图 ${r.width}×${r.height}`); open.href = r.art_url; open.target = '_blank'; open.rel = 'noopener';
      const copy = el('button', '', '复制链接');
      copy.onclick = async () => { await navigator.clipboard.writeText(r.art_url); copy.textContent = '已复制'; };
      link.append(open, el('div', 'dim', r.art_label === 'none' ? '没找到订单标签，整张保存的，请看一下有没有二维码' : '订单标签和二维码已去掉'), copy);
    } else link.append(el('span', 'dim', r.art_error ? `没传成：${r.art_error}` : r.verdict !== 'pass' ? '不是放行的，不传图' : '还没传到云端'));
    const count = el('td', '', `${n(r.orders)} 单`);
    if (popAsk.platform && r.orders_all !== r.orders) count.append(el('div', 'dim', `全厂 ${n(r.orders_all)} 单`));
    const where = Object.entries(r.by_platform || {}).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${n(v)}`).join(' · ');
    tr.append(pic, count, el('td', '', days), el('td', '', where), why,
      el('td', '', `${day(r.first_day)}  #${r.id}`), link);
    t.append(tr);
  }
  pick.append(t, p.total > p.items.length ? el('div', 'dim', `这里显示 ${n(p.total)} 个里的前 ${p.items.length} 个；下载的表格里是全部。`) : '');
  return [top, nums, pick];
}

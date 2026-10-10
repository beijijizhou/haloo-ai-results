// Part of the results page (index.html loads its scripts in this order: publish.js core.js home.js
// catalog.js ms.js measure.js page.js; they share what each declares at the top). Here: the catalog and how fresh each search word is.
// The catalog: what was read off Temu's lists. Read from the cloud only while it is looked at.
let catalog = null;
const catAsk = { keyword: null, fresh: false, state: null };
// what became of a row of the catalog, and why a product was not made of it
const CAT_STATE = { todo: '待建', made: '已建', skipped: '未建（跳过）', had: '妙手里已有' };
const CAT_WHY = { 'a photograph, not a mockup': '主图是实拍照片，不是效果图', 'not a black shirt': '不是黑色 T 恤',
  'print all over': '满印', 'no print': '衣服上没有印花', 'the print is too dim': '印花太暗，取不出来',
  'no price on the list': '列表上没有价格', "not a men's T-shirt": '标题写的是女款或童款，不是男款',
  'not a short-sleeved T-shirt': '标题写的是别的款式或袖长（卫衣、长袖、背心…）' };
const post = async (body) => (await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).json();
async function loadCatalog() {
  try {
    catalog = await post({ action: 'catalog-list', keyword: catAsk.keyword, fresh: catAsk.fresh, state: catAsk.state, limit: 200 });
    if (view === 'cat') draw();
  } catch { /* the next round tries again */ }
}
// Every row asked for, as a table a spreadsheet opens (UTF-8 with a mark, so that Excel reads it).
async function catDownload(btn) {
  btn.disabled = true;
  const rows = [];
  for (let offset = 0; ; offset += 2000) {
    const d = await post({ action: 'catalog-list', keyword: catAsk.keyword, fresh: catAsk.fresh, state: catAsk.state, limit: 2000, offset });
    rows.push(...d.rows);
    btn.textContent = `读取中… ${rows.length}`;
    if (d.rows.length < 2000) break;
  }
  const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [['goods_id', 'title', 'main_picture', 'price', 'sold', 'link', 'search_word', 'in_miaoshou', 'first_seen', 'state', 'miaoshou_id', 'temu_box_id', 'left_out_why'].join(',')];
  for (const r of rows) lines.push([r.goods_id, r.title, r.main, r.price, r.sold, `https://www.temu.com/search_result.html?search_key=${r.goods_id}`,
    r.keyword, r.in_ms ? 'yes' : 'no', r.first_seen, r.state, r.ms_id, r.temu_id, r.skip_why].map(cell).join(','));
  const a = el('a');
  a.href = URL.createObjectURL(new Blob(['\ufeff' + lines.join('\r\n')], { type: 'text/csv' }));
  a.download = `temu-catalog${catAsk.keyword ? `-${catAsk.keyword.replace(/\W+/g, '-')}` : ''}${catAsk.fresh ? '-not-in-miaoshou' : ''}.csv`;
  a.click();
  btn.disabled = false;
  btn.textContent = `把这 ${rows.length} 个下载成表格（CSV）`;
}
function catView() {
  const top = el('div', 'batch');
  if (!catalog) { top.append(el('div', 'empty loading', '读取中…')); return [top]; }
  const c = catalog;
  const n = (v) => Number(v || 0).toLocaleString('en-US');
  const tile = (v, what, cls) => { const t = el('div', `tile ${cls || ''}`); t.append(el('b', '', v), what); return t; };
  const tiles = el('div', 'tiles');
  const st = c.states || {};
  tiles.append(tile(n(c.total), '从列表读到的商品'), tile(n(st.made), `在妙手建好的产品（今天 ${n(c.made_today)}）`, 'good'),
    tile(n(c.claimed), '其中已进 Temu 采集箱', 'good'), tile(n(st.todo), '待建'),
    tile(n(st.skipped), '未建（跳过）', st.skipped ? 'warn' : ''), tile(n(st.had), '妙手里已有'));
  const why = (c.why || []).map((w) => `${CAT_WHY[w.why] || w.why} ${n(w.n)}`).join(' · ');
  const who = (c.makers || []).map((m) => `${m.machine || '?'} ${n(m.n)}`).join(' · ');
  top.append(el('h2', '', '目录'), tiles,
    why ? el('div', 'dim', `未建（跳过）的原因：${why}。`) : '', who ? el('div', 'dim', `建产品的机器：${who}。`) : '',
    el('div', 'dim', '在妙手建的产品有四张图：印花穿在模特身上、印花在空白 T 恤上、两张面料图。产品认领到 Temu 采集箱，不发布：店铺、类目和价格在那里手动设置。'),
    el('div', 'dim', '只读了列表页：这些商品都没有打开商品页。列表上有一张图、标题、价格和销量；其他图片、颜色和尺码只在商品页上，这里没有。'));
  const pick = el('div', 'batch');
  const chips = el('div', 'key');
  const chip = (text, on, fn) => { const b = el('button', on ? 'on' : '', text); b.onclick = () => { fn(); catalog = null; draw(); }; return b; };
  chips.append(chip(`全部搜索词 ${n(c.total)}`, !catAsk.keyword, () => { catAsk.keyword = null; }),
    ...c.keywords.map((k) => chip(`${k.keyword || '（无）'} ${n(k.n)} · 新 ${n(k.fresh)}`, catAsk.keyword === k.keyword, () => { catAsk.keyword = k.keyword; })),
    chip('全部状态', !catAsk.state, () => { catAsk.state = null; }),
    ...Object.entries(CAT_STATE).map(([k, name]) => chip(`${name} ${n(st[k])}`, catAsk.state === k, () => { catAsk.state = k; })));
  const dl = el('button', '', `把这 ${n(c.matched)} 个下载成表格（CSV）`);
  dl.onclick = () => catDownload(dl);
  pick.append(chips, dl);
  if (!c.rows.length) { pick.append(el('div', 'empty', '还没读到。在 Temu 列表页，在面板设置里选“Read the list and make products in Miaoshou”，再点“Grab this page”。')); return [top, pick]; }
  const t = el('table');
  const hr = el('tr');
  for (const x of ['', '商品', '价格', '销量', '搜索词', '妙手里的产品', '读到时间']) hr.append(el('th', '', x));
  t.append(hr);
  for (const r of c.rows) {
    const tr = el('tr');
    const pic = el('td');
    if (r.main) { const img = el('img'); img.loading = 'lazy'; img.referrerPolicy = 'no-referrer'; img.width = 56; img.height = 56; img.style.objectFit = 'cover'; img.src = `${r.main}?imageView2/2/w/120/q/70/format/webp`; pic.append(img); }
    const a = el('a', '', r.title || r.goods_id);
    a.href = `https://www.temu.com/search_result.html?search_key=${r.goods_id}`; a.target = '_blank'; a.rel = 'noopener';
    const name = el('td'); name.append(a, el('div', 'dim', r.goods_id));
    tr.append(pic, name, el('td', '', r.price || ''), el('td', '', r.sold == null ? '' : n(r.sold)), el('td', '', r.keyword || ''),
      el('td', r.state === 'made' ? 'o-arrived' : r.state === 'skipped' ? 'o-skipped' : 'o-had',
        r.state === 'made' ? `已建${r.ms_id ? `，采集箱 ${r.ms_id}` : ''}${r.temu_id ? '，已进 Temu 采集箱' : ''}${r.made_by ? `（${r.made_by}）` : ''}`
          : r.state === 'skipped' ? `未建（跳过）：${CAT_WHY[r.skip_why] || r.skip_why}` : CAT_STATE[r.state] || ''),
      el('td', '', new Date(r.first_seen).toLocaleString('zh-CN')));
    t.append(tr);
  }
  pick.append(t, c.matched > c.rows.length ? el('div', 'dim', `这里显示 ${n(c.matched)} 个里的前 ${c.rows.length} 个；下载的表格里是全部。`) : '');
  return [top, pick];
}

// The search word of a run's list (or the shop's name).
const keyword = (r) => {
  try { return new URL(r.page_url).searchParams.get('search_key') || (r.page_title || r.page_url).replace(/ - Temu.*$/, ''); } catch { return r.page_title || '？'; }
};

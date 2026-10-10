// Part of the Haloo AI page (loaded after ms.js and ms_top.js): Miaoshou's three views - the
// overview, its publish record, and what its Temu collect box holds unpublished.
// -- 总览 -----------------------------------------------------------------------------------------
function msView() {
  const top = el('div', 'batch');
  if (!msOver || typeof HalooKinds === 'undefined') { top.append(el('div', 'empty loading', '读取中…')); return [top]; }
  const o = msOver;
  const tb = (o.temu_box && o.temu_box.counts) || null;
  const pub = o.pub || {};
  const cat = o.catalog || {};
  // three steady ways into Miaoshou, each with its own block (kinds.js; lg-grab ms-overview's kinds)
  const kinds = o.kinds || {};
  const fac = o.factory || {};
  const block = (kind) => {
    const k = kinds[kind] || {};
    const tiles = el('div', 'tiles');
    tiles.append(msTile(msN(k.in_ms), `已进妙手（今天 ${msN(k.today)}）`, 'good'),
      msTile(msN(k.pending), '其中还没发布', k.pending ? 'warn' : ''),
      msTile(msN(k.ok), '发布成功', 'good'), msTile(msN(k.bad), '发布失败', k.bad ? 'bad' : ''));
    if (kind === 'temu') tiles.append(msTile(msN(k.todo), '读到了还没建'), msTile(msN(k.skipped), '按规则不建'));
    if (kind === 'factory') tiles.append(msTile(msN(k.todo), '放进目录还没建'), msTile(msN(fac.ready), '还可以放进目录', fac.ready ? 'warn' : ''));
    return [el('h2', '', HalooKinds.NAME[kind]), el('div', 'dim', HalooKinds.SAYS[kind]), tiles];
  };
  const sum = el('div', 'tiles');
  sum.append(msTile(tb ? msN(tb.count) : '—', 'Temu 采集箱里一共'), msTile(tb ? msN(tb.published) : '—', '已发布', 'good'),
    msTile(tb ? msN(tb.notPublished) : '—', '未发布', tb && tb.notPublished ? 'warn' : ''));
  top.append(...HalooKinds.KINDS.flatMap(block),
    el('h2', '', '三种合计（妙手的 Temu 采集箱）'), sum,
    tb ? '' : el('div', 'dim', 'Temu 采集箱的数字要先同步一次才有：点下面的“同步最新”。'),
    el('div', 'dim', '“发布成功 / 失败”数的是发布次数：同一个产品发两次算两次。“厂里的图”要去“产品进度”里放进目录才会开始建。'));

  const days = el('div', 'batch');
  const byDay = {};
  for (const d of o.box_days || []) (byDay[d.day] = byDay[d.day] || {}).box = d.n;
  for (const d of o.pub_days || []) Object.assign(byDay[d.day] = byDay[d.day] || {}, { ok: d.ok, bad: d.bad });
  const t = el('table');
  const hr = el('tr');
  for (const x of ['日期（美东）', '进公用采集箱', '发布成功', '发布失败']) hr.append(el('th', '', x));
  t.append(hr);
  for (const day of Object.keys(byDay).sort().reverse()) {
    const tr = el('tr');
    tr.append(el('td', '', day), el('td', '', msN(byDay[day].box)), el('td', '', msN(byDay[day].ok)), el('td', '', msN(byDay[day].bad)));
    t.append(tr);
  }
  days.append(el('h2', '', '最近 14 天'), t);
  return [msShopBox(), top, msSyncBar(), days];
}

// -- 发布记录 -------------------------------------------------------------------------------------
function recView() {
  const top = el('div', 'batch');
  if (!msRec || !msOver) { top.append(el('div', 'empty loading', '读取中…')); return [top]; }
  const o = msOver;
  const pub = o.pub || {};
  const mine = o.pub_ours || {};
  const tiles = el('div', 'tiles');
  tiles.append(msTile(msN(pub.success), '发布成功', 'good'), msTile(msN(pub.fail), '发布失败', pub.fail ? 'bad' : ''),
    msTile(msN(mine.success), 'Haloo AI 采集的：成功', 'good'), msTile(msN(mine.fail), 'Haloo AI 采集的：失败', mine.fail ? 'bad' : ''));
  top.append(el('h2', '', '妙手的发布记录'), tiles,
    el('div', 'dim', '一次发布一行，同一个产品发几次就有几行。这里是妙手自己的记录：在妙手里手动发的、以前采集来发的、插件发的都在。'));
  const pick = el('div', 'batch');
  const chip = (text, on, fn) => { const b = el('button', on ? 'on' : '', text); b.onclick = () => { fn(); msRec = null; draw(); }; return b; };
  const chips = el('div', 'key');
  chips.append(chip('全部', !recAsk.status && !recAsk.why, () => { recAsk.status = null; recAsk.why = null; }),
    chip(`成功 ${msN(pub.success)}`, recAsk.status === 'success', () => { recAsk.status = 'success'; recAsk.why = null; }),
    chip(`失败 ${msN(pub.fail)}`, recAsk.status === 'fail' && !recAsk.why, () => { recAsk.status = 'fail'; recAsk.why = null; }),
    chip('只看 Haloo AI 建的（Temu 图和厂里的图）', recAsk.source === 'manual', () => { recAsk.source = recAsk.source === 'manual' ? null : 'manual'; }),
    chip('只看链接采集的', recAsk.source === 'temu', () => { recAsk.source = recAsk.source === 'temu' ? null : 'temu'; }));
  pick.append(el('h2', '', '筛选'), chips);
  if ((o.pub_why || []).length) {
    const why = el('div', 'key');
    for (const w of o.pub_why) why.append(chip(`${w.why || '妙手没给原因'}　${msN(w.n)}`, recAsk.why === w.why, () => { recAsk.status = 'fail'; recAsk.why = w.why; }));
    pick.append(el('div', 'dim', '失败原因（点一个只看它）：'), why);
  }
  if (!msRec.rows.length) {
    pick.append(el('div', 'empty', o.pub_read ? '没有符合的记录。' : '还没同步过妙手的发布记录：到“总览”里点“全部重新同步”。'));
    return [top, pick];
  }
  const t = el('table');
  const hr = el('tr');
  for (const x of ['', '产品', '来源', '结果', '店铺', '提交时间']) hr.append(el('th', '', x));
  t.append(hr);
  for (const r of msRec.rows) {
    const tr = el('tr');
    const pic = el('td');
    if (r.thumb) { const img = el('img'); img.loading = 'lazy'; img.referrerPolicy = 'no-referrer'; img.width = 56; img.height = 56; img.style.objectFit = 'cover'; img.src = r.thumb; pic.append(img); }
    const name = el('td'); name.append(r.title || '', el('div', 'dim', `采集箱 ${r.box_id}${r.goods_id ? `　货源 ${r.goods_id}` : ''}`));
    tr.append(pic, name, el('td', '', sourceName(r)),
      el('td', r.status === 'success' ? 'o-arrived' : r.status === 'fail' ? 'o-lost' : 'o-had',
        r.status === 'success' ? `发布成功${r.item ? `，Temu 商品 ${r.item}` : ''}` : r.status === 'fail' ? `失败：${r.reason || '妙手没给原因'}` : r.status || ''),
      el('td', '', r.shop || ''), el('td', '', msTime(r.at)));
    t.append(tr);
  }
  pick.append(t, msRec.matched > msRec.rows.length ? el('div', 'dim', `共 ${msN(msRec.matched)} 条，这里显示最新的 ${msRec.rows.length} 条。`) : '');
  return [top, pick];
}

// -- 待发布 ---------------------------------------------------------------------------------------
const KIND = { ready: '已设好待发', unready: '还没设好', failed: '上次没发成', collected: '链接采集的' };
const KIND_SAYS = { ready: 'Haloo AI 采集的，模板、店铺、价格、库存、尺码表、原产地、运费模板都设好了，可以直接发',
  unready: 'Haloo AI 采集的，发布前的设置还没做（或者是记账之前建的，不知道做没做）；勾了发布时插件会先设好再发',
  failed: '发过一次没成功，原因写在后面；改好了可以再勾选发一次', collected: '人工采集的，按妙手里现在的样子原样发' };
function pendView() {
  const top = el('div', 'batch pend-list');
  if (!msPend || !msOver) { top.append(el('div', 'empty loading', '读取中…')); return [top]; }
  // one list: Miaoshou's unpublished, brought up to date by what the cloud knows of our products
  const all = HalooSteps.pending(msPend.rows, (msMade || {}).rows);
  const rows = all.rows.filter((r) => !pendAsk.kind || r.kind === pendAsk.kind);
  const have = new Set(rows.map((r) => r.box_id));
  for (const id of [...pendPick]) if (!have.has(id)) pendPick.delete(id);
  const pp = typeof cloudPub === 'function' ? cloudPub() : {}; // what the machine chosen told LogoGuard of its round (orders.js)
  const can = typeof orderGive === 'function' && !!orderTo;
  const tiles = el('div', 'tiles');
  const tile = (kind, cls) => {
    const t = msTile(msN(all.count[kind]), KIND[kind], all.count[kind] ? cls : '');
    t.title = KIND_SAYS[kind];
    t.style.cursor = 'pointer';
    if (pendAsk.kind === kind) t.classList.add('pick');
    t.onclick = () => { pendAsk.kind = pendAsk.kind === kind ? null : kind; draw(); };
    return t;
  };
  tiles.append(tile('ready', 'good'), tile('unready', 'warn'), tile('failed', 'bad'), tile('collected', ''));
  top.append(el('h2', '', `② 待发布的产品：${msN(all.rows.length)} 个`), tiles,
    el('div', 'dim', '点一个格子只看那一种，再点一下看全部。“已设好待发”和“还没设好”都是Haloo AI 采集的、都还没发布，区别是发布前的那些设置做没做。'),
    el('div', 'dim', `妙手的未发布清单是${msOver.temu_box ? ` ${msTime(msOver.temu_box.at)} ` : '还没'}同步来的；Haloo AI 采集的产品不用等同步，建好、设好、发出去后这里一分钟内就跟着变。`));

  // what can be done, first: one number (how many are ticked), the button, and the round as it goes (round.js)
  const act = el('div', 'batch');
  const card = el('div', 'act next');
  const head = el('div', 'act-head'); head.append('发布到 Temu');
  act.append(el('h2', '', '① 发布'));
  const line = el('div', 'act-do');
  const ready = rows.filter((r) => r.kind === 'ready');
  if (pp.running) {
    line.append((() => { const stop = el('button', 'act-go', '停止发布'); stop.onclick = () => orderGive('pub-stop', {}, stop); return stop; })());
  } else {
    const go = el('button', 'act-go', `发布选中的 ${pendPick.size} 个`);
    go.disabled = !can || !pendPick.size;
    go.onclick = () => {
      const chosen = rows.filter((r) => pendPick.has(r.box_id));
      if (!window.confirm(`让“${orderTo}”把这 ${chosen.length} 个产品发布到 Temu 店铺？发布后就上架销售了。`)) return;
      pendPick.clear();
      if (typeof roundStart === 'function') roundStart(chosen);
      orderGive('pub', { items: chosen.map((r) => ({ goods: r.goods_id, id: r.box_id, ready: r.kind === 'ready', ours: r.source === 'manual', title: r.title })) }, go);
    };
    const pickReady = el('button', 'act-alt', `选上已设好的 ${msN(ready.length)} 个`);
    pickReady.disabled = !ready.length;
    pickReady.onclick = () => { pendPick.clear(); ready.forEach((r) => pendPick.add(r.box_id)); draw(); };
    const pickAll = el('button', 'act-alt', pendPick.size === rows.length && rows.length ? '全不选' : `全选 ${msN(rows.length)} 个`);
    pickAll.onclick = () => { if (pendPick.size === rows.length) pendPick.clear(); else rows.forEach((r) => pendPick.add(r.box_id)); draw(); };
    line.append(go, pickReady, pickAll);
  }
  const how = el('details');
  how.append(el('summary', 'dim', '发布是怎么做的'), el('div', 'dim', '每分钟交给妙手一组，半分钟后看妙手的发布记录是成功还是失败。Haloo AI 建的产品，没设好的会先设好（模板、店铺、价格、库存、尺码表、原产地、运费模板），标题不符合规则的（卫衣、长袖、女款等）不发；链接采集的产品按妙手里现在的样子原样发。妙手里已经发成功过的不会重复发。'));
  card.append(head, el('div', 'act-num', msN(pendPick.size)), el('div', 'act-what', pp.running ? '正在发布，发完才能再选' : `个已勾选（在下面的清单里勾，或用右边的按钮）`), typeof orderPicker === 'function' ? orderPicker() : '', line, how);
  act.append(card, typeof roundBox === 'function' ? roundBox(pp) : '');
  const list = top; // the products are one box with their filter: what is done above, what there is below
  if (!rows.length) {
    list.append(el('div', 'empty', all.rows.length ? '这一种现在没有。' : msOver.temu_box ? '没有未发布的产品。' : '还没同步过：到“总览”里点“同步最新”。'));
    return [act, list];
  }
  const t = el('table');
  const hr = el('tr');
  for (const x of ['选', '', '产品', '来源', '状态', '进采集箱时间']) hr.append(el('th', '', x));
  t.append(hr);
  for (const r of rows.slice(0, 500)) {
    const tr = el('tr');
    const box = el('input'); box.type = 'checkbox'; box.checked = pendPick.has(r.box_id); box.disabled = !!pp.running;
    box.onchange = () => { if (box.checked) pendPick.add(r.box_id); else pendPick.delete(r.box_id); draw(); };
    const tick = el('td'); tick.append(box);
    const pic = el('td');
    if (r.thumb) { const img = el('img'); img.loading = 'lazy'; img.referrerPolicy = 'no-referrer'; img.width = 56; img.height = 56; img.style.objectFit = 'cover'; img.src = r.thumb; pic.append(img); }
    const name = el('td'); name.append(r.title || '', el('div', 'dim', `采集箱 ${r.box_id}${r.price ? `　货源价 ${r.price}` : ''}${r.owner ? `　${r.owner}` : ''}`));
    const st = r.kind === 'failed' ? `上次没发成：${r.why || '妙手没给原因'}` : r.kind === 'collected' ? `链接采集的（${r.shops ? '已选店铺' : '还没选店铺'}）`
      : r.kind === 'ready' ? '已设好待发' : '还没设好（发布时先设好）';
    tr.append(tick, pic, name, el('td', '', sourceName(r)),
      el('td', { ready: 'o-arrived', unready: 'o-skipped', failed: 'o-lost', collected: 'o-had' }[r.kind], st), el('td', '', msTime(r.made_at)));
    t.append(tr);
  }
  list.append(t, rows.length > 500 ? el('div', 'dim', `共 ${msN(rows.length)} 个，这里显示最新的 500 个；“全选”选的是全部 ${msN(rows.length)} 个。`) : '');
  return [act, list];
}

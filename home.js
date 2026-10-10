// Part of the results page (index.html loads its scripts in this order: publish.js steps.js core.js home.js
// catalog.js ms.js measure.js page.js; they share what each declares at the top). Here: the runs.
// What Miaoshou's collect box said of a product that was handed to it.
function arrival(b) {
  if (b.miaoshou !== 'done' || !b.run) return null;
  if (b.arrived === 'success') return ['arrived', '已进妙手采集箱'];
  if (b.arrived === 'skip') return ['had', '妙手说已采集过'];
  if (b.arrived === 'fail') return ['failed', `妙手采集失败${b.arrived_note ? `：${b.arrived_note}` : ''}`];
  return ['missing', '还没进妙手采集箱'];
}

// Where a run is now. A run that is not over and was last heard of minutes ago was cut off.
function where(r) {
  const ago = (t) => { const s = Math.max(0, (Date.now() - Date.parse(t)) / 1000); return s < 90 ? `${Math.round(s)} 秒前` : s < 5400 ? `${Math.round(s / 60)} 分钟前` : `${Math.round(s / 360) / 10} 小时前`; };
  const st = r.status;
  const got = (r.opened || []).filter((o) => o.outcome === 'arrived').length;
  if (st) {
    const first = String(st.note || '').split('\n')[0];
    // a run that only read the list put nothing into Miaoshou: its number is what it read
    const far = r.mode === 'read' ? `读到 ${st.read || 0} / 目标 ${r.wanted}` : `已进妙手 ${got} / 目标 ${r.wanted}`;
    if (st.over) return ['over', r.mode === 'read' ? `读列表这一步已结束（${ago(st.at)}）：${far}。进没进妙手看下面的步骤。` : `已结束（${ago(st.at)}）：${first}　${far}`];
    if (Date.now() - Date.parse(st.at) < 200000) return ['live', `运行中（${ago(st.at)}上报）：${st.note}`];
    return ['cut', `中断了：最后一次上报在 ${ago(st.at)}，当时在“${first}”，${far}。列表页被关了或浏览器退出了。重新打开那个列表页：6 小时内会自己接着做。`];
  }
  if (r.mode !== 'pages') return null;
  const last = Math.max(Date.parse(r.created_at), ...(r.opened || []).map((o) => Date.parse(o.at)));
  if (Date.now() - last < 180000) return ['live', `运行中：已进妙手 ${got} / 目标 ${r.wanted}（旧版插件采集的，不逐步上报）`];
  return [got >= r.wanted ? 'over' : 'cut', got >= r.wanted ? `已结束：达到目标，已进妙手 ${got} / 目标 ${r.wanted}`
    : `没到目标就停了：已进妙手 ${got} / 目标 ${r.wanted}，最后一次有动静在 ${ago(new Date(last).toISOString())}（旧版插件采集的，没记下为什么停）`];
}

// A run that read a list: how far that list's products are on the way into Miaoshou and the shop
// (steps.js), and the way to the view where the next step is done.
function runSteps(r) {
  const k = pubData && HalooSteps.byList(pubData).find((x) => x.keyword === keyword(r));
  if (!k) return '';
  const box = el('div');
  const go = el('button', '', '去建产品 / 发布');
  go.onclick = () => { view = 'pub'; loadPub(); draw(); };
  const [cls, text] = HalooSteps.summary(k.steps);
  const line = stepsLine(k.steps, `这个列表（${k.keyword}）一共读到 ${k.n} · ${text}`, cls);
  line.style.fontSize = '14px'; line.style.fontWeight = '400';
  line.append(go);
  box.append(line);
  return box;
}

function runCard(r) {
  const c = r.counts;
  const box = el('div', 'batch run');
  const head = el('div', 'head');
  const title = el(r.page_url ? 'a' : 'span', '', r.page_title || '列表页');
  if (r.page_url) { title.href = r.page_url; title.target = '_blank'; title.rel = 'noopener'; }
  const see = el('button', '', '本轮的商品');
  see.onclick = () => { only = r.id; view = 'all'; draw(); };
  head.append(title, el('span', 'tag', r.mode === 'cards' ? '主图模式' : r.mode === 'read' ? '只读列表' : '商品页模式'),
    el('span', 'dim', `${new Date(r.created_at).toLocaleString('zh-CN')}　轮次 ${r.id.slice(0, 8)}`), see);
  const stat = (n, text, cls) => { const s = el('div', `stat ${cls || ''}`); s.append(el('b', '', String(n)), el('span', 'dim', text)); return s; };
  const stats = el('div', 'stats');
  stats.append(stat(r.seen, '页面上的商品'), stat(r.already, '妙手里已有'), stat(r.unfit, '不符合条件'),
    stat(r.wanted, r.mode === 'cards' ? '送去判断' : '要打开'), stat(c.refused, '主图没通过'), stat(c.handed, '交给妙手'),
    stat(c.arrived, '已进妙手', c.arrived ? 'good' : ''), stat(c.had, '妙手已有'), stat(c.failed, '妙手失败', c.failed ? 'bad' : ''),
    stat(c.missing, '还没进妙手', c.missing ? 'wait' : ''));
  // What happened, step by step, with the time of each: nothing here is the extension's guess
  // except where it says so.
  const ms = r.ms || {};
  const at = (iso) => (iso ? new Date(iso).toLocaleTimeString('zh-CN') : '');
  const mine = batches.filter((b) => b.run === r.id);
  const steps = el('ul', 'steps');
  const step = (cls, when, text) => { const li = el('li', cls); li.append(el('time', '', when), document.createTextNode(text)); steps.append(li); };
  step('ok', at(r.created_at), `读了列表页：${r.seen} 个商品，${r.already} 个妙手里已有，${r.unfit} 个被筛掉，${r.mode === 'cards' ? `${r.wanted} 张主图送去判断` : `目标是 ${r.wanted} 个进妙手`}。`);
  if (c.products) {
    step('ok', at(mine.length ? mine[0].created_at : ''), `LogoGuard 判断完了：${c.handed} 张主图通过，${c.refused} 张没通过${c.waiting ? `，${c.waiting} 张还在等` : ''}。`);
  } else if (r.wanted) {
    step('now', '', r.mode === 'pages' ? '商品页一个个打开；结果在上面的表里。' : 'LogoGuard 还在判断，或者这一轮中途停了。');
  }
  if (r.mode === 'cards' && c.handed) {
    if (ms.submitted_at) step('ok', at(ms.submitted_at), `已向妙手“链接采集”提交 ${ms.links} 个链接。`);
    else step(ms.note ? 'bad' : 'now', '', ms.note || '还没提交给妙手。');
    if (ms.finished_at) {
      step('ok', at(ms.finished_at), ms.total == null ? '妙手的链接采集结束了（没读到它的数字）。'
        : `妙手页面显示：共 ${ms.total}，成功 ${ms.success}，失败 ${ms.fail}。（它的“成功”数不可靠：采集箱里明明有商品时它也报过 0。下面一行才是实际情况。）`);
    } else if (ms.submitted_at) {
      step('now', '', '妙手正在采集，还没说完成。');
    }
  }
  if (c.handed) {
    step(c.missing ? 'now' : c.failed ? 'bad' : 'ok', '', `对照共用的妙手采集箱：${c.arrived} 个已到，${c.had} 个妙手说已有，${c.failed} 个失败，${c.missing} 个还没到`
      + (c.missing ? '（交给妙手后核对 45 分钟；一直没出现的就是没采到）。' : '。'));
  }
  // every product of the run, with its link and what became of it
  const list = el('details');
  list.append(el('summary', '', `本轮的 ${mine.length} 个商品和链接`));
  const table = el('table');
  const row = (cells, tag = 'td') => { const tr = el('tr'); for (const x of cells) { const td = el(tag); td.append(x); tr.append(td); } table.append(tr); };
  row(['商品', '交给妙手的链接', '主图', '妙手采集箱'], 'th');
  for (const b of mine) {
    const link = `temu.com/…g-${b.goods_id}.html`; // Miaoshou gets the address a click in the list gives, with Temu's parameters
    const a = el('a', '', link);
    a.href = `https://www.temu.com/search_result.html?search_key=${b.goods_id}`; // the plain address shows "sold out" to a visitor
    a.target = '_blank';
    a.rel = 'noopener';
    const p = b.pictures[0] || {};
    const arr = arrival(b);
    row([(b.page_title || '').slice(0, 60), b.miaoshou === 'done' ? a : '未提交', NAME[state(p)] + (p.labels ? `（${p.labels}）` : ''),
      arr ? arr[1] + (b.arrived_at ? ` ${at(b.arrived_at)}` : '') : '—']);
  }
  list.append(table);
  // What the user asks first: of the product pages opened (or links handed over), how many are
  // in Miaoshou now. Everything else is folded away below it.
  const opened = r.opened || [];
  const OUT = { arrived: '已进妙手', had: '妙手说已采集过', lost: '点了采集，没进妙手', skipped: '没点采集：主图没通过',
    unfit: '没点采集：不符合条件', gone: '没点采集：Temu 说已售罄', error: '没点采集：出错或超时' };
  const big = el('div', 'big');
  if (r.mode === 'pages') {
    const inNow = opened.filter((o) => o.outcome === 'arrived').length;
    // only what was really opened is counted; the goal is another thing
    const pressed = opened.filter((o) => ['arrived', 'had', 'lost'].includes(o.outcome)).length;
    big.append(`目标 ${r.wanted}。打开了 ${opened.length} 个商品页，`, el('b', '', `${inNow} 个已进妙手`),
      pressed ? `（点了采集 ${pressed} 个，成功率 ${Math.round(inNow / pressed * 100)}%）` : '');
    if (!opened.length) big.append(el('div', 'dim', '还没有一个商品页做完：刚开始，或卡在第一个上（Temu 要登录或验证时会停在那个页面，等人处理；看插件面板上怎么说）。'));
  } else if (r.mode === 'read') {
    big.append(`第 1 步读列表：`, el('b', '', `${(r.status || {}).read || 0} / ${r.wanted} 个商品`),
      `，其中 ${(r.status || {}).fresh || 0} 个是目录里新的`, runSteps(r));
  } else {
    big.append(`交给妙手 ${c.handed} 个，`, el('b', '', `${c.arrived} 个已进妙手`));
  }
  const each = el('table');
  if (opened.length) {
    const tr = el('tr');
    for (const x of ['打开的商品', '结果', '进妙手的时间（妙手显示的）', '妙手采集箱 ID', '原因']) tr.append(el('th', '', x));
    each.append(tr);
    for (const o of opened) {
      const row = el('tr');
      const a = el('a', '', o.title || o.goods_id);
      a.href = `https://www.temu.com/search_result.html?search_key=${o.goods_id}`;
      a.target = '_blank';
      a.rel = 'noopener';
      const td = [el('td'), el('td', `o-${o.outcome}`, (OUT[o.outcome] || o.outcome) + (o.how === 'click' ? '　·Temu 打开的' : o.how === 'address' ? '　·插件打开的' : '')), el('td', '', (o.ms_time || '').slice(5)),
        el('td', '', o.ms_id || ''), el('td', '', o.why || '')];
      td[0].append(a);
      row.append(...td);
      each.append(row);
    }
  }
  const more = el('details');
  more.append(el('summary', '', '列表页的数字和每一步'), stats, steps);
  const w = where(r);
  const now = w ? el('div', `state ${w[0]}`, w[1]) : '';
  const pr = (r.status || {}).params;
  const lk = Number((r.status || {}).looked);
  const freshLine = lk ? el('div', 'dim', `搜索词“${keyword(r)}”：本轮看到 ${lk} 个商品，其中 ${lk - Number(r.status.known || 0)} 个妙手里没有，新鲜度 ${Math.round((1 - Number(r.status.known || 0) / lk) * 100)}%`) : '';
  const params = pr && r.mode === 'read' ? el('div', 'dim', `插件 ${pr.version || ''} · 机器 ${r.machine || ''}`) : pr ? el('div', 'dim', `设置：两个商品间隔 ${pr.every} 秒 · 每次随机挑 ${pr.pick} 个 · 每次点“See more” ${pr.more} 次 · LogoGuard 先判断主图：${pr.judge ? '开' : '关'}`
    + ` · 筛选：${pr.fit ? `开（销量至少 ${pr.least}）` : '关'} · 插件 ${pr.version || ''} · 机器 ${r.machine || ''}`) : '';
  box.append(head, now, freshLine, params, big, each, more, list);
  return box;
}

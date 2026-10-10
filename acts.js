// Part of the Haloo AI page: what can be done on the progress view, as three cards side by side in
// the order it is done - put the factory's designs into the catalog, make products in Miaoshou,
// publish to Temu. Each card: one number that says how much there is to do, one button, one line
// of what else to know; the card that is next has a blue edge, one with nothing left a tick.
// (The owner, 2026-10-09: the controls were lines of grey text in three boxes, and after a step
// was done the box still showed its input and a dead button.)
// Uses publish.js's state (ext, extMake, factory, makeN ...) and its askExt / extDo / extRead.
function actCards({ kind, todo, ready, unready, failed }) {
  const n = (v) => Number(v || 0).toLocaleString('en-US');
  const card = (no, title) => {
    const c = el('div', 'act');
    const head = el('div', 'act-head');
    head.append(el('span', 'act-no', String(no)), title);
    c.append(head);
    c.big = (v, what) => { const num = el('div', 'act-num', v === '✓' ? '' : v); if (v === '✓') num.append(icon('circle-check')); c.append(num, el('div', 'act-what', what)); return c; };
    c.row = (...kids) => { const r = el('div', 'act-do'); r.append(...kids.filter(Boolean)); c.append(r); return c; };
    c.note = (text, cls) => { if (text) c.append(el('div', cls || 'dim', text)); return c; };
    return c;
  };
  // a number to type, and beside it "全部": the most there is, in one press
  const count = (value, max, set) => {
    const most = Math.max(1, max || 0);
    const i = el('input'); i.type = 'number'; i.min = 1; i.max = most; i.value = Math.max(1, Math.min(value, max || value));
    i.onchange = () => set(Math.max(1, Math.min(Number(i.value) || 1, max || 5000)));
    const all = el('button', 'act-all', `全部 ${n(max)}`);
    all.disabled = !max;
    all.title = '填成现在最多能做的数';
    all.onclick = () => { i.value = most; set(most); };
    const both = el('span', 'act-count');
    both.append(i, all);
    return both;
  };
  const press = (text, fn, off) => { const b = el('button', 'act-go', text); b.disabled = !!off; b.onclick = () => fn(b); return b; };
  // a batch is of one kind: one of another kind is neither shown here nor gone on with from here
  const other = extMake && extMake.started && ((extMake.kind || 'temu') !== kind) ? extMake : null;
  const mk = other ? {} : extMake || {};
  const left = mk.started && !mk.running ? Math.max(0, (mk.want || 0) - (mk.made || 0)) : 0;

  // 1: what there is to make products of - the factory's designs put into the catalog, or lists read on Temu's pages
  const c1 = card(1, kind === 'factory' ? '把厂里热卖的设计放进目录' : '在 Temu 列表页读列表');
  const f = kind === 'factory' ? factory : null;
  if (kind !== 'factory') {
    c1.big(n(todo), '个读到了还没建').note('读列表在 Temu 的页面上做：打开一个搜索结果页，在右上角的面板上点“Grab this page”。读到的会自动开始建，也可以在右边这一步手动建。');
  } else if (!f) {
    c1.big('—', '厂里的设计').note(ext === null ? '正在找这个浏览器里的 Haloo AI 插件…' : !ext ? '这个浏览器里没有 Haloo AI 插件：这一步要由插件用你的妙手登录来做。'
      : factoryWhy ? `这个浏览器里的插件（${ext.version || '版本未知'}）还不会这一步：${factoryWhy}` : '正在问有几个可以放…', ext === null || (ext && !factoryWhy) ? 'dim' : 'o-lost');
  } else if (f.ready > 0) {
    c1.big(n(f.ready), '个设计可以放进目录')
      .row('放 ', count(factoryN, f.ready, (v) => { factoryN = v; }), ' 个 ', press('放进目录', async (b) => {
        const k = Math.max(1, Math.min(f.ready, factoryN));
        if (!window.confirm(`把厂里订单最多的 ${k} 个设计放进目录？放进去之后它们算“还没建”，建产品时会被建成妙手里的产品（不会自己发布）。`)) return;
        b.disabled = true;
        try {
          factory = await askExt({ type: 'factory', n: k }, 30000);
          pubData = null;
          loadPub();
        } catch (e) {
          window.alert(`没有放进去：${e.message}`);
        }
        draw();
      }, !ext))
      .note(`按订单数从多到少放。目录里已有 ${n(f.in_catalog)} 个，其中建成产品 ${n(f.made)} 个。`);
  } else {
    c1.classList.add('done');
    c1.big('✓', f.in_catalog ? `都放进去了：目录里 ${n(f.in_catalog)} 个，已建成产品 ${n(f.made)} 个` : '现在没有可以放的设计')
      .note(f.untitled ? `还有 ${n(f.untitled)} 个设计没有标题，车间的小模型起了标题之后会出现在这里。` : '');
  }
  if (f) c1.note(f.women ? `女款 ${n(f.women)} 个不建。` : '');
  if (f && (f.turned || []).length) c1.note(`注意：${f.turned.length} 个设计建成产品之后结论变了（被拦截或认出了品牌）：${f.turned.slice(0, 3).map((x) => x.title).join('；')}。去妙手里看要不要下架。`, 'o-lost');

  // 2: products made in Miaoshou
  const c2 = card(2, '在妙手建产品');
  if (mk.running) {
    c2.big(`${n(mk.made)} / ${n(mk.want)}`, '正在建');
    c2.querySelector('.act-what').prepend(el('span', 'spin'), ' ');
    c2
      .row(press('停止建产品', (b) => extDo([{ type: 'make-stop' }], b), !ext))
      .note(`跳过 ${n(mk.skipped)} 个，失败 ${n(mk.failed)} 个。还没建的共 ${n(todo)} 个。`);
  } else {
    c2.big(n(todo), '个还没建');
    if (left) {
      // the batch wants more than there is now: said, so that the number on the button is not taken for what will be made
      c2.row(press(todo < left ? `继续这一批（目标还差 ${n(left)} 个，现在能建 ${n(todo)} 个）` : `继续这一批（还差 ${n(left)} 个）`, async (b) => {
        b.disabled = true;
        try {
          await askExt({ type: 'make-resume' }, 20000);
        } catch { // an extension from before "go on": a new batch of what was left
          await askExt({ type: 'make-start', n: left, kind }, 20000).catch((e) => window.alert(`插件没有继续：${e.message}`));
        }
        await extRead();
        draw();
      }, !ext || !todo));
    }
    const again = press(left ? '另开一批' : '在妙手建产品', (b) => extDo([{ type: 'make-start', n: Math.max(1, Math.min(makeN, todo || makeN)), kind }], b), !ext || !todo);
    if (left) again.className = 'act-alt';
    if (other && other.running) again.disabled = true;
    c2.row('建 ', count(Math.min(makeN, todo || makeN), todo, (v) => { makeN = v; }), ' 个 ', again)
      .note(!todo ? '现在没有可建的：先在 Temu 列表页读列表，或者把厂里的设计放进目录。'
        : mk.started && mk.note ? `上一批：建好 ${n(mk.made)} / ${n(mk.want)}，跳过 ${n(mk.skipped)}，失败 ${n(mk.failed)}。停下时说的：${mk.note}` : '建好的产品认领到店铺的采集箱并设好待发，不会自己发布。');
  }

  if (other && other.running) c2.note(`这个浏览器正在建的是“${HalooKinds.NAME[other.kind || 'temu']}”的一批：等它停了，才能开这一种。`, 'o-lost');

  // 3: published to Temu, on the page of everything that waits
  const c3 = card(3, '发布到 Temu');
  c3.big(n(ready), '个已设好，可以发布')
    .row(press('去勾选发布', () => { view = 'mspend'; draw(); }, false))
    .note(`还没设好 ${n(unready)} 个（发布时会先设好），上次没发成 ${n(failed)} 个。`);
  if (pubSet && pubSet.temu_setup) c3.title = `当前设置：店铺 ${pubSet.temu_setup.shopId}，产品模板 ${pubSet.temu_setup.itemTemplateId}，SKU 模板 ${pubSet.temu_setup.skuTemplateId}，供货价 $${pubSet.temu_setup.price}，库存 ${pubSet.temu_setup.stock}；每分钟 ${pubSet.publish_group || 10} 个。`;

  // the one that is next: the first with something to do
  const next = f && f.ready > 0 ? c1 : mk.running || left || todo ? c2 : ready + unready + failed ? c3 : null;
  if (next) next.classList.add('next');
  const box = el('div', 'acts');
  box.append(c1, c2, c3);
  return box;
}

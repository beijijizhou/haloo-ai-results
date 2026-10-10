// Part of the results page: how far the products got on the way into Miaoshou and on to the Temu
// shop, as steps - each with its own number and its own bar - and as one line of ticked dots.
// The way is: read off a Temu list -> made in Miaoshou -> claimed to the Temu collect box -> set
// ready to publish -> handed to Miaoshou to publish -> in the shop. Reading the list is only the
// first step: nothing is in Miaoshou before the second. HalooSteps works the numbers out (no
// page, tested in test/steps.test.js) of what lg-grab catalog-list answers; stepsBox and
// stepsLine draw them with the page's el().
(function (root) {
  const num = (v) => Number(v || 0);
  // One made row's place on the way.
  const claimed = (r) => !!r.temu_id;
  const handed = (r) => ['sent', 'published', 'unpublished'].includes(r.pub);
  const ready = (r) => claimed(r) && (!!r.ready_at || handed(r));

  // The six steps of {total, todo, made, skipped, had} and the made rows. A step is done when all
  // it was given has passed it, now when some has, and not begun when none has.
  function steps(n, rows) {
    const made = num(n.made);
    const cl = n.claimed != null ? num(n.claimed) : rows.filter(claimed).length;
    const rd = rows.filter(ready).length;
    const hd = rows.filter(handed).length;
    const pub = rows.filter((r) => r.pub === 'published').length;
    const failed = rows.filter((r) => r.pub === 'unpublished').length;
    const decided = Math.max(0, num(n.total) - num(n.todo));
    const list = [
      { key: 'read', name: '读列表', done: num(n.total), of: num(n.total), say: `读到 ${num(n.total)} 个` },
      { key: 'make', name: '在妙手建产品', done: decided, of: num(n.total), count: made,
        say: `建好 ${made} 个，不建 ${num(n.skipped)} 个，妙手已有 ${num(n.had)} 个，还没建 ${num(n.todo)} 个` },
      { key: 'claim', name: '认领到采集箱', done: cl, of: made, say: `${cl} / ${made}` },
      { key: 'ready', name: '设好待发', done: rd, of: made, say: `${rd} / ${made}` },
      { key: 'hand', name: '交给妙手发布', done: hd, of: made, say: `${hd} / ${made}` },
      { key: 'shop', name: '已上架', done: pub, of: made, bad: failed, say: `${pub} / ${made}${failed ? `，发布失败 ${failed}` : ''}` },
    ];
    for (const s of list) s.state = s.of > 0 && s.done >= s.of ? 'done' : s.done > 0 ? 'now' : 'todo';
    return list;
  }

  // The same for each list (search word or shop) that was read: catalog-list's keywords say how
  // many were read, made and are left; the made rows say the rest.
  function byList(c) {
    return (c.keywords || []).map((k) => {
      const rows = (c.rows || []).filter((r) => r.keyword === k.keyword);
      const made = num(k.made);
      return { keyword: k.keyword, last: k.last_seen, n: num(k.n), todo: num(k.todo), made,
        steps: steps({ total: k.n, todo: k.todo, made, claimed: null, skipped: Math.max(0, num(k.n) - num(k.todo) - made), had: 0 }, rows) };
    });
  }

  // The batch this browser is at, or was at last, apart from all that went before (the owner,
  // 2026-10-09: the batch now and the history are to be told apart). Of what the extension says
  // of itself: the products it looked at, made, claimed and set ready in this batch, and - of
  // this round of publishing - handed to Miaoshou and in the shop. null when there is no batch.
  function batch(make, pub) {
    const m = make && make.started ? make : null;
    const p = pub && (pub.running || num(pub.ok) || (pub.failed || []).length) ? pub : null;
    if (!m && !p) return null;
    const list = [];
    if (m) {
      const made = num(m.made);
      const looked = made + num(m.skipped) + num(m.failed);
      list.push({ key: 'look', name: '看过', done: looked, of: looked, say: `从目录里取了 ${looked} 个来看` },
        { key: 'make', name: '在妙手建好', done: made, of: num(m.want), bad: num(m.failed),
          say: `建好 ${made} 个（目标 ${num(m.want)} 个），不建 ${num(m.skipped)} 个，失败 ${num(m.failed)} 个` },
        { key: 'claim', name: '认领到采集箱', done: num(m.claimed), of: made, say: `${num(m.claimed)} / ${made}` },
        { key: 'ready', name: '设好待发', done: num(m.ready), of: made, bad: num(m.unready),
          say: `${num(m.ready)} / ${made}${num(m.unready) ? `，没设好 ${num(m.unready)}` : ''}` });
    }
    if (p) {
      const failed = (p.failed || []).length;
      const waiting = Object.keys(p.waiting || {}).length;
      const left = (p.queue || []).length + (p.setup || []).length;
      const all = num(p.ok) + failed + waiting + left;
      list.push({ key: 'hand', name: '交给妙手发布', done: all - left, of: all, say: `${all - left} / ${all}${left ? `，排队 ${left}` : ''}` },
        { key: 'shop', name: '已上架', done: num(p.ok), of: all, bad: failed,
          say: `${num(p.ok)} / ${all}${failed ? `，发布失败 ${failed}` : ''}${waiting ? `，等妙手回话 ${waiting}` : ''}` });
    }
    for (const s of list) s.state = s.of > 0 && s.done >= s.of ? 'done' : s.done > 0 ? 'now' : 'todo';
    return { steps: list, making: !!(m && m.running), publishing: !!(p && p.running), started: m ? m.started : null,
      ended: m && !m.running ? m.ended || null : null, note: m && !m.running ? String(m.note || '') : '',
      why: Object.entries((m && m.why) || {}).sort((a, b) => b[1] - a[1]) };
  }

  // What waits to be published, as one list (the owner, 2026-10-09: "set ready" and "to publish"
  // belong together, and the difference is to be seen). Two sources: Miaoshou's own list of what
  // its Temu collect box holds unpublished - as it was when last read - and what the cloud knows
  // of the products we made, which is newer. A product we made since Miaoshou was read is added;
  // one the cloud knows as handed over or published is taken out. Each row says which it is:
  //   ready     ours, set ready to publish          unready   ours, not set ready yet
  //   failed    tried and not published (why)       collected Miaoshou's copy of a Temu product
  function pending(listed, made) {
    const ours = new Map((made || []).filter((r) => r.temu_id).map((r) => [String(r.temu_id), r]));
    const gone = (r) => r && (r.pub === 'published' || r.pub === 'sent');
    const kind = (r, c) => ((c ? c.pub === 'unpublished' : r.pub_state === 'fail') ? 'failed'
      : r.source !== 'manual' ? 'collected' : (c ? !!c.ready_at : !!r.ready) ? 'ready' : 'unready');
    const rows = [];
    const seen = new Set();
    for (const r of listed || []) {
      const c = ours.get(String(r.box_id));
      seen.add(String(r.box_id));
      if (gone(c)) continue;
      rows.push({ ...r, ready: c ? !!c.ready_at : !!r.ready, why: (c && c.pub_why) || r.pub_why || '', kind: kind(r, c) });
    }
    for (const [id, c] of ours) {
      if (seen.has(id) || gone(c)) continue;
      const r = { box_id: id, goods_id: c.goods_id, source: 'manual', title: c.title, thumb: c.main, price: c.price, made_at: c.made_at,
        ready: !!c.ready_at, why: c.pub_why || '', fresh: true };
      rows.push({ ...r, kind: kind(r, c) });
    }
    rows.sort((a, b) => String(b.made_at || '').localeCompare(String(a.made_at || '')));
    const count = { ready: 0, unready: 0, failed: 0, collected: 0 };
    for (const r of rows) count[r.kind] += 1;
    return { rows, count };
  }

  // In a few words: how far it all is, and what is next.
  function summary(list) {
    const s = Object.fromEntries(list.map((x) => [x.key, x]));
    if (!s.read.of) return ['todo', '还没读过列表：在 Temu 列表页点“Grab this page”'];
    if (s.shop.state === 'done' && s.make.state === 'done') return ['done', `全部上架 ${s.shop.done}/${s.shop.of} 个`];
    const next = list.find((x) => x.state !== 'done');
    const what = { make: `还有 ${s.make.of - s.make.done} 个没建`, claim: `还有 ${s.claim.of - s.claim.done} 个没认领`,
      ready: `还有 ${s.ready.of - s.ready.done} 个没设好`, hand: `还有 ${s.hand.of - s.hand.done} 个没发布`,
      shop: `还有 ${s.shop.of - s.shop.done} 个没上架` }[next.key];
    return ['now', `已进妙手 ${s.make.count} 个 · 已上架 ${s.shop.done} 个 · 下一步：${next.name}（${what}）`];
  }

  root.HalooSteps = { steps, byList, batch, pending, summary };
  if (typeof module !== 'undefined') module.exports = root.HalooSteps;
})(typeof self !== 'undefined' ? self : globalThis);

// The steps side by side: a dot (ticked when done), the line to the next, the name, the number
// and a bar of its own.
function stepsBox(list) {
  const box = el('div', 'steps6');
  box.style.gridTemplateColumns = `repeat(${list.length}, minmax(0, 1fr))`;
  list.forEach((s, i) => {
    const col = el('div', `step6 ${s.state}`);
    const dot = el('div', 'dotrow');
    const mark = el('span', 'dot', s.state === 'done' ? '' : String(i + 1)); if (s.state === 'done') mark.append(icon('check'));
    dot.append(mark, i < list.length - 1 ? el('i', 'rail') : '');
    const bar = el('div', 'goal');
    const fill = el('i');
    fill.style.width = `${s.of ? Math.min(100, s.done / s.of * 100) : 0}%`;
    bar.append(fill);
    col.append(dot, el('div', 'name', s.name), el('div', 'n', `${s.count != null ? s.count : s.done}`), bar,
      el('div', s.bad ? 'dim bad' : 'dim', s.say));
    box.append(col);
  });
  return box;
}

// One line: the dots joined up, then the words.
function stepsLine(list, text, cls) {
  const line = el('div', `stepline ${cls || ''}`);
  const dots = el('span', 'dots');
  list.forEach((s, i) => {
    const d = el('span', `dot ${s.state}`); if (s.state === 'done') d.append(icon('check'));
    d.title = `${s.name}：${s.say}`;
    dots.append(d, i < list.length - 1 ? el('i', `rail ${s.state}`) : '');
  });
  line.append(dots, el('span', '', text));
  return line;
}

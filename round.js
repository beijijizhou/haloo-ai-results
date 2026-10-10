// Part of the Haloo AI page: a round of publishing, shown as it goes - how many of what was sent
// are published, a bar, and each product with where it stands (waiting, with Miaoshou, published,
// failed and why). The extension says how many and which are still in hand (pub-state); which
// products the round was of, and their names, the page keeps itself (in this browser), since it
// was the page that sent them. (The owner, 2026-10-09: a line of grey numbers was all there was.)
let pubRound = (() => { try { return JSON.parse(localStorage.pubRound || 'null'); } catch { return null; } })();
function roundStart(chosen) {
  pubRound = { at: Date.now(), items: chosen.map((r) => ({ id: String(r.box_id), title: r.title || '', thumb: r.thumb || '' })) };
  try { localStorage.pubRound = JSON.stringify(pubRound); } catch { /* a browser that keeps nothing */ }
}
// Where each product of the round stands, from what the extension holds: [state, words].
function roundState(id, pp) {
  // lists of Temu box ids, as the machine tells LogoGuard (the extension's product.js roundSaid)
  if ((pp.setup || []).includes(id)) return ['wait', '排队：先设好再发'];
  if ((pp.queue || []).includes(id)) return ['wait', '排队中'];
  if ((pp.waiting || []).includes(id)) return ['busy', '妙手处理中…'];
  const f = (pp.failed || []).find((x) => x.id === id);
  if (f) return ['bad', `没发成：${f.reason}`];
  if (typeof cloudDoing !== 'undefined' && cloudDoing && cloudDoing.waiting.some((o) => o.what === 'pub') && !pp.running) return ['wait', '等机器来取'];
  return ['ok', '发布成功'];
}
function roundBox(pp) {
  if (!pubRound || !pubRound.items.length) return '';
  const items = pubRound.items.map((x) => ({ ...x, st: roundState(x.id, pp) }));
  const count = (k) => items.filter((x) => x.st[0] === k).length;
  const [ok, bad, busy, wait] = ['ok', 'bad', 'busy', 'wait'].map(count);
  const box = el('div', `round${pp.running ? ' on' : ''}`);
  const head = el('div', 'act-head');
  if (pp.running) head.append(el('span', 'spin'), ' ');
  head.append(pp.running ? '正在发布这一轮' : bad ? '这一轮发完了，有没发成的' : '这一轮发完了');
  const bar = el('div', 'goal'); const fill = el('i'); fill.style.width = `${Math.round((ok + bad) / items.length * 100)}%`; bar.append(fill);
  const chips = el('div', 'key');
  chips.append(el('span', 'tag pass', `发布成功 ${ok}`), bad ? el('span', 'tag block', `没发成 ${bad}`) : '', busy ? el('span', 'tag review', `妙手处理中 ${busy}`) : '', wait ? el('span', 'tag', `排队 ${wait}`) : '');
  box.append(head, el('div', 'act-num', `${ok} / ${items.length}`), el('div', 'act-what', `已发布到 Temu　开始于 ${new Date(pubRound.at).toLocaleTimeString('zh-CN', { hour12: false })}`), bar, chips);
  const t = el('table', 'batchrows');
  for (const x of items.slice(0, 200)) {
    const tr = el('tr', x.st[0] === 'busy' ? 'working' : '');
    const pic = el('td');
    if (x.thumb) { const img = el('img'); img.loading = 'lazy'; img.referrerPolicy = 'no-referrer'; img.width = 40; img.height = 40; img.style.objectFit = 'cover'; img.src = x.thumb; pic.append(img); }
    const st = el('td', { ok: 'o-arrived', bad: 'o-lost', busy: '', wait: 'dim' }[x.st[0]]);
    if (x.st[0] === 'busy') st.append(el('span', 'spin'), ' ');
    if (x.st[0] === 'ok') st.append(icon('circle-check'), ' ');
    st.append(x.st[1]);
    tr.append(pic, el('td', '', x.title || `采集箱 ${x.id}`), st);
    t.append(tr);
  }
  box.append(t, items.length > 200 ? el('div', 'dim', `这一轮共 ${items.length} 个，这里显示前 200 个。`) : '');
  if (!pp.running) {
    const clear = el('button', 'act-alt', '收起这一轮');
    clear.onclick = () => { pubRound = null; try { delete localStorage.pubRound; } catch { /* nothing kept */ } draw(); };
    box.append(clear);
  }
  return box;
}

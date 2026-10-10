// Part of the Haloo AI page: the numbers the extension runs with (lg-grab settings-list), each
// shown with what it is for and changed here. They are rows in LogoGuard, so changing one needs
// no new version of the extension: it reads them when a batch starts, and keeps its built-in
// value for a row it cannot read. HalooSettings turns what was typed into a value or says what
// is wrong with it (no page, tested in test/settings.test.js) - the cloud checks again.
// One call of the cloud when the view is opened and one for each change; none while it is only looked at.
(function (root) {
  const words = (text) => [...new Set(String(text || '').split(/[\n,，]/).map((w) => w.replace(/\s+/g, ' ').trim().toLowerCase()).filter(Boolean))];
  const num = (text) => (String(text).trim() === '' ? NaN : Number(text));

  // typed: the fields as text - [one] for a number, [two] for a pair, [themes, garments] for words.
  function parse(row, typed) {
    const within = (n) => n >= Number(row.least) && n <= Number(row.most);
    if (row.kind === 'number' || row.kind === 'whole') {
      const n = num(typed[0]);
      if (!Number.isFinite(n)) return { error: '要填一个数' };
      if (row.kind === 'whole' && !Number.isInteger(n)) return { error: '要填整数' };
      return within(n) ? { value: n } : { error: `要在 ${Number(row.least)} 和 ${Number(row.most)} 之间` };
    }
    if (row.kind === 'pair') {
      const a = num(typed[0]), b = num(typed[1]);
      if (!Number.isFinite(a) || !Number.isFinite(b)) return { error: '要填两个数' };
      if (a > b) return { error: '第一个数不能比第二个大' };
      return within(a) && within(b) ? { value: [a, b] } : { error: `两个数都要在 ${Number(row.least)} 和 ${Number(row.most)} 之间` };
    }
    if (row.kind === 'words') {
      const themes = words(typed[0]), garments = words(typed[1]);
      if (!themes.length || !garments.length) return { error: '主题和款式各要至少一个词' };
      if (themes.length > 300 || garments.length > 300) return { error: '主题和款式各不超过 300 个词' };
      if ([...themes, ...garments].some((w) => w.length > 60)) return { error: '每个词不超过 60 个字符' };
      return { value: { themes, garments } };
    }
    return { error: '这一项不在这里改' };
  }
  // A value as it is put into the fields.
  const shown = (row) => (row.kind === 'pair' ? [String(row.value[0]), String(row.value[1])]
    : row.kind === 'words' ? [(row.value.themes || []).join('\n'), (row.value.garments || []).join('\n')] : [String(row.value)]);
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

  root.HalooSettings = { parse, shown, same, words };
  if (typeof module !== 'undefined') module.exports = root.HalooSettings;
})(typeof self !== 'undefined' ? self : globalThis);

let setRows = null;   // the rows as the cloud gave them
let setSaid = {};     // name -> what the last try to save came to
let setTyped = {};    // name -> what is in its fields and not saved: the page draws itself again every minute

async function loadSettings() {
  try {
    setRows = (await post({ action: 'settings-list' })).rows || [];
    if (view === 'set') draw();
  } catch { /* the next round tries again */ }
}

async function saveSetting(row, value, btn) {
  const key = localStorage.passcode || (window.prompt('Haloo AI Assistant 口令（改设置需要）') || '').trim();
  if (!key) return;
  const by = localStorage.reviewer ?? (window.prompt('你的名字（和这次修改一起记下；可以不填）') || '').trim();
  btn.disabled = true;
  try {
    const r = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-lg-passcode': key },
      body: JSON.stringify({ action: 'settings-set', name: row.name, value, by }) });
    const data = await r.json().catch(() => ({}));
    if (r.status === 401) { delete localStorage.passcode; setSaid[row.name] = ['bad', '口令不对，没有保存。']; }
    else if (!r.ok || !data.row) setSaid[row.name] = ['bad', `没有保存：${data.error || r.status}`];
    else {
      localStorage.passcode = key;
      localStorage.reviewer = by;
      setRows = setRows.map((x) => (x.name === row.name ? data.row : x));
      delete setTyped[row.name];
      pubSet = null; // the progress view reads the settings again
      // an extension in this browser forgets what it had read; others take it within two minutes
      const told = ext ? await askExt({ type: 'settings-fresh' }, 3000).then(() => true, () => false) : false;
      setSaid[row.name] = ['good', `已保存。${told ? '这个浏览器里的插件下一批就用新的值。' : '各台机器的插件下一批开始时读到（最迟两分钟后）。'}正在跑的那一批用的还是它开始时的值。`];
    }
  } catch (e) {
    setSaid[row.name] = ['bad', `没有保存：${e.message}`];
  }
  draw();
}

function setView() {
  const top = el('div', 'batch');
  top.append(el('h2', '', '设置'), el('div', 'dim', '插件运行用的数字和搜索词，存在 LogoGuard。在这里改，不用发新版插件：插件每一批开始时读一次；云端读不到、或某一项不合规矩时，插件用自己内置的值照常跑，不会停。改设置要口令。'));
  if (!setRows) { top.append(el('div', 'empty loading', '读取中…')); return [top]; }
  const out = [top];
  for (const row of setRows) {
    const box = el('div', 'batch setting');
    const head = el('div', 'head');
    head.append(el('b', '', row.label || row.name), el('span', 'dim', row.name));
    box.append(head, row.note ? el('div', 'dim', row.note) : '');
    const was = row.updated_by || row.updated_at ? el('div', 'dim', `上次修改：${row.updated_at ? new Date(row.updated_at).toLocaleString('zh-CN') : ''}${row.updated_by ? `，${row.updated_by}` : ''}`) : '';
    if (!row.kind) {
      box.append(el('pre', 'dim', JSON.stringify(row.value, null, 1)), was);
      out.push(box);
      continue;
    }
    const line = el('div', 'key');
    const fields = HalooSettings.shown(row).map((text, i) => {
      const f = el(row.kind === 'words' ? 'textarea' : 'input');
      if (row.kind === 'words') { f.rows = 10; f.placeholder = i ? '款式，一行一个' : '主题，一行一个'; } else { f.type = 'number'; f.step = row.kind === 'number' ? 'any' : '1'; f.min = row.least; f.max = row.most; }
      f.value = (setTyped[row.name] || [])[i] ?? text;
      return f;
    });
    const save = el('button', '', '保存');
    const hint = el('span', 'dim');
    const check = () => {
      const p = HalooSettings.parse(row, fields.map((f) => f.value));
      save.disabled = !!p.error || HalooSettings.same(p.value, row.value);
      hint.className = p.error ? 'dim bad' : 'dim';
      hint.textContent = p.error || (row.kind === 'words' ? `${p.value.themes.length} 个主题 × ${p.value.garments.length} 个款式 = ${p.value.themes.length * p.value.garments.length} 个搜索词`
        : row.kind === 'pair' ? `秒，${Number(row.least)}～${Number(row.most)}` : `${Number(row.least)}～${Number(row.most)}`);
      return p;
    };
    for (const f of fields) f.oninput = () => { setTyped[row.name] = fields.map((x) => x.value); check(); };
    save.onclick = () => { const p = check(); if (!p.error) saveSetting(row, p.value, save); };
    if (row.kind === 'pair') line.append(fields[0], ' 到 ', fields[1], ' ', save, hint);
    else if (row.kind === 'words') { const two = el('div', 'words'); two.append(...fields); box.append(two); line.append(save, hint); }
    else line.append(fields[0], ' ', save, hint);
    box.append(line);
    check();
    const said = setSaid[row.name];
    if (said) box.append(el('div', `state ${said[0] === 'good' ? 'live' : 'cut'}`, said[1]));
    box.append(was);
    out.push(box);
  }
  return out;
}

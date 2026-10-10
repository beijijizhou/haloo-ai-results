// Part of the Haloo AI page: what is asked of a machine goes through LogoGuard, and what the
// machine is doing is read from LogoGuard - the page does not speak to the extension (the owner,
// 2026-10-09). An order (publish these, stop) is given with lg-grab's order-give, which needs
// the passcode: the page is public, and publishing puts products on sale. LogoGuard pushes to
// the machine's browser, the extension takes the order and tells what it is doing (doing-tell);
// that is read here with "doing", again every ORDER_EVERY_MS only while an order waits or a
// round is going and this view is looked at. So the page works from any browser, for any machine.
const ORDER_EVERY_MS = 20000;
let orderTo = (() => { try { return localStorage.orderTo || ''; } catch { return ''; } })();
let orderMachines = null; // the machines that take orders: [{machine, who, since}]
let cloudDoing = null;    // of the machine chosen: {doing: {pub, who, at}, waiting: [orders not yet taken], reachable}
let orderTimer = null;
const cloudPub = () => (cloudDoing && cloudDoing.doing && cloudDoing.doing.pub) || {};
const orderBusy = () => !!cloudDoing && (cloudPub().running || cloudDoing.waiting.length > 0);

async function ordersRead() {
  try {
    if (!orderMachines) {
      orderMachines = (await post({ action: 'doing' })).machines || [];
      if (!orderMachines.some((m) => m.machine === orderTo)) orderTo = orderMachines.length === 1 ? orderMachines[0].machine : '';
    }
    if (orderTo) cloudDoing = await post({ action: 'doing', machine: orderTo });
  } catch { /* shown as it was; the next reading tries again */ }
  clearTimeout(orderTimer);
  if (orderBusy()) orderTimer = setTimeout(ordersWatch, ORDER_EVERY_MS);
}
async function ordersWatch() {
  if (document.hidden || view !== 'mspend') { orderTimer = setTimeout(ordersWatch, ORDER_EVERY_MS); return; }
  const was = JSON.stringify(cloudDoing);
  const going = cloudPub().running;
  await ordersRead();
  if (going && !cloudPub().running && typeof msLoad === 'function') msLoad('mspend'); // the round is over: the list is read again
  else if (JSON.stringify(cloudDoing) !== was && view === 'mspend') draw();
}

// An order for the machine chosen. Says in the corner what came of it; true when it was given.
async function orderGive(what, body, btn) {
  let key = '';
  try { key = localStorage.passcode || ''; } catch { /* a browser that keeps nothing */ }
  if (!key) key = (window.prompt('Haloo AI Assistant 口令（发布要口令）') || '').trim();
  if (!key || !orderTo) return false;
  if (btn) btn.disabled = true;
  try {
    const r = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-lg-passcode': key },
      body: JSON.stringify({ action: 'order-give', machine: orderTo, what, body }) });
    const d = await r.json().catch(() => ({}));
    if (r.status === 401) { try { delete localStorage.passcode; } catch { /* nothing kept */ } say('口令不对。', true); return false; }
    if (!r.ok) { say(`没交出去：${d.error || r.status}`, true); return false; }
    try { localStorage.passcode = key; } catch { /* nothing kept */ }
    say(d.pushed ? `已经交给“${orderTo}”，它的浏览器开着的话几秒内开始。` : `已经记下，但没叫到“${orderTo}”的浏览器（${d.push_said}）：它的浏览器下次打开时会取，半小时内有效。`, !d.pushed);
    return true;
  } catch (e) {
    say(`没交出去：${e.message}`, true);
    return false;
  } finally {
    await ordersRead();
    draw();
  }
}

// Which machine publishes: said large, with the Miaoshou account and shop it told - people have
// several shops and mix them up. One machine there is: no choice to make.
function orderPicker() {
  const box = el('div', 'act-what');
  if (!orderMachines) { box.append('正在读有哪些机器…'); return box; }
  if (!orderMachines.length) { box.append('还没有机器能收指令：在装了 Haloo AI 插件的浏览器里打开一次 Chrome（插件 2026.10.9.29 以上会自己登记）。'); return box; }
  const says = (m) => `${m.machine}${m.who && m.who.ms ? `　妙手 ${m.who.ms}${m.who.sub ? `（${m.who.sub}）` : ''}` : '　妙手没登录'}${m.who && m.who.shop && m.who.shop.name ? `　→ ${m.who.shop.name}` : ''}`;
  const pick = el('select');
  if (!orderTo) pick.append(new Option('选一台机器来发布…', ''));
  for (const m of orderMachines) pick.append(new Option(says(m), m.machine, false, m.machine === orderTo));
  pick.disabled = orderBusy();
  pick.onchange = async () => { orderTo = pick.value; try { localStorage.orderTo = orderTo; } catch { /* nothing kept */ } cloudDoing = null; await ordersRead(); draw(); };
  box.append('由这台机器发布：', pick);
  const waiting = cloudDoing ? cloudDoing.waiting.length : 0;
  if (waiting) box.append(el('div', 'dim', `有 ${waiting} 条指令它还没取（它的浏览器开着才会取；超过 ${cloudDoing.good_minutes} 分钟没取就作废）。`));
  return box;
}

// Part of the Haloo AI page (loaded after ms.js, whose state and helpers it uses): what stands at
// the top of every view, and the choice of the shop products go to.
// The top of every view: which shop the products go to and which Miaoshou account this browser
// is signed in to - first of all, because people have several shops and mix them up (the
// owner, 2026-10-09). The shop is LogoGuard's setting (read with the overview, at most every
// MS_TOP_MS on the views that do not read it anyway); the account and the seller centre's shop
// are what the extension in this browser says, where there is one.
const MS_TOP_MS = 10 * 60000;
let msTopAt = 0;
async function msTopRead() {
  await extRead().then(msWhoRead);
  if (!msOver || Date.now() - msTopAt > MS_TOP_MS) {
    msTopAt = Date.now();
    try { msOver = await post({ action: 'ms-overview' }); } catch { /* the next round */ }
  }
  msTopDraw();
}
function msTopDraw() {
  // made here when the page's own markup has none: a browser may still hold the index.html of
  // before this was added (the scripts came fresh and the page stayed blank, 2026-10-09)
  let bar = document.getElementById('whobar');
  if (!bar) {
    bar = el('div');
    bar.id = 'whobar';
    const main = document.querySelector('main');
    if (!main) return;
    main.prepend(bar);
  }
  const o = msOver || {};
  const w = msWho;
  const listed = ((o.shops && o.shops.list) || []).find((s) => s.id === o.shop_now);
  const shop = (w && w.shop && w.shop.name) || (listed && listed.name) || (o.shop_now ? `店铺 ${o.shop_now}` : '');
  if (!shop && !w) { bar.replaceChildren(); return; }
  const same = !w || !w.seller || !shop || shop.toLowerCase().startsWith(w.seller.name.toLowerCase());
  const box = el('div', `whoami${(w && !w.ms) || !same ? ' bad' : w && w.ms ? ' ok' : ''}`);
  box.append(el('b', '', `产品发到的店铺：${shop || '还不知道'}`));
  if (!w) box.append(el('span', '', ext === false ? '这个浏览器里没有 Haloo AI 插件，所以看不到这里登录的是哪个妙手账号。' : '正在问插件这里登录的是哪个妙手账号…'));
  else if (!w.ms) box.append(el('span', 'o-lost', '这个浏览器里妙手没有登录：登录妙手 ERP 之后才能建产品和发布。'));
  else {
    box.append(el('span', '', `妙手账号：${w.ms.name}${w.ms.subName ? `（${w.ms.subName}）` : ''}　　${w.seller ? `卖家后台现在开着的店铺：${w.seller.name}` : '卖家后台没有开着'}`));
    if (!same) box.append(el('span', 'o-lost', '卖家后台开着的店铺和产品发到的店铺不是同一个，别搞混。'));
  }
  bar.replaceChildren(box);
}

// Which Temu shop the products made go to, and which others Miaoshou offers (the owner,
// 2026-10-09). The shop in use is LogoGuard's setting; the list is what the extension read of
// Miaoshou. Changing it is asked of the extension, which holds the passcode - the page has none.
function msShopBox() {
  const o = msOver || {};
  const list = (o.shops && o.shops.list) || [];
  const now = list.find((s) => s.id === o.shop_now);
  const box = el('div', 'batch');
  const name = (s) => `${s.name}${s.site_name ? `（${s.site_name}）` : ''}`;
  box.append(el('h2', '', '产品发到哪个店铺'));
  const tiles = el('div', 'tiles');
  tiles.append(msTile(now ? now.name : o.shop_now || '—', now ? `现在用的店铺${now.site_name ? `（${now.site_name}站）` : ''}：建好的产品认领到它的店铺采集箱，发布也发到它` : '现在用的店铺编号（还没从妙手读到店铺名：点下面的“同步最新”）', 'good'),
    msTile(now && now.items != null ? msN(now.items) : '—', '妙手里这个店铺已有的产品'),
    msTile(msN(Math.max(0, list.length - (now ? 1 : 0))), '还可以选的其他店铺'));
  box.append(tiles);
  const others = list.filter((s) => s.id !== o.shop_now);
  if (others.length) {
    const pick = el('select');
    for (const s of others) { const op = el('option', '', `${name(s)}${s.items != null ? ` · 已有 ${msN(s.items)} 个产品` : ''}`); op.value = s.id; pick.append(op); }
    const go = el('button', '', '改成发到这个店铺');
    go.disabled = !ext;
    go.onclick = async () => {
      const s = others.find((x) => x.id === pick.value);
      if (!s || !window.confirm(`以后建的产品都认领到“${s.name}”的店铺采集箱，发布也发到它？\n已经建好的不动。正在跑的这一批还按原来的店铺，下一批开始才换。`)) return;
      go.disabled = true;
      try {
        await askExt({ type: 'shop-set', id: s.id }, 20000);
        pubSet = null; // the settings shown on the progress page are read again
        msOver = null;
        msLoad(view);
      } catch (e) {
        window.alert(`没有改成：${e.message}`);
        go.disabled = false;
      }
    };
    const line = el('div', 'key'); line.append('换一个店铺：', pick, go);
    box.append(line, el('div', 'dim', '换店铺只换“发到哪里”；产品模板、SKU 模板、价格、库存不变。新店铺要在美国站，并且在妙手里恰好有一个运费模板，否则设好待发那一步会停下并说明原因。'));
  } else {
    box.append(el('div', 'dim', list.length ? '妙手里现在只授权了这一个 Temu 店铺，所以没有别的可选。在妙手里授权了新店铺之后，点下面的“同步最新”，它就会出现在这里。'
      : '还没从妙手读到店铺：点下面的“同步最新”。'));
  }
  if (o.shops && o.shops.at) box.append(el('div', 'dim', `店铺列表是 ${msTime(o.shops.at)} 从妙手读的。`));
  return box;
}

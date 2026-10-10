// Part of the Haloo AI page: the three steady ways a product gets into Miaoshou (the owner,
// 2026-10-09), named the same wherever the page speaks of them. Pure - no page, no network;
// haloo_site/test/kinds.test.js holds it.
//   link     collected by its Temu link with Miaoshou's own collecting
//   temu     made by Haloo AI of a picture read off a Temu list
//   factory  made by Haloo AI of one of the factory's own designs
(function (root) {
  const KINDS = ['factory', 'temu', 'link'];
  const NAME = { link: '链接采集', temu: 'Temu 图生成', factory: '厂里的图' };
  const SAYS = {
    link: '用妙手自己的采集功能，按 Temu 商品链接整个采进来的：人在妙手里采的，以及旧版插件替人点“采集此商品”采的。',
    temu: '插件从 Temu 列表读到主图，取下印花贴到我们的模特图上，在妙手里“手动创建”成产品的。',
    factory: '厂里订单多、已通过的设计：用厂里的原图贴到模特图上，在妙手里“手动创建”成产品的。',
  };
  // A row of Miaoshou's (its publish record, its unpublished list) or of the catalog: which way it
  // came. Miaoshou knows only "manual" for both of ours; a factory design is known by its number -
  // 9 and the design's id in fourteen digits (the catalog's goods_id) - or by its design id.
  function of(row) {
    const r = row || {};
    if (r.design != null && r.design !== '') return 'factory';
    if (r.source && r.source !== 'manual') return 'link';
    return /^9\d{14}$/.test(String(r.goods_id || '')) ? 'factory' : 'temu';
  }
  const name = (row) => NAME[of(row)];

  root.HalooKinds = { KINDS, NAME, SAYS, of, name };
  if (typeof module !== 'undefined') module.exports = root.HalooKinds;
})(typeof self !== 'undefined' ? self : globalThis);

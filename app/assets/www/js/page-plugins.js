/* page-plugins.js — 插件:已安装启停 + 插件市场(搜索/安装) */
'use strict';

(() => {
  let alive = false;
  let all = [];
  let market = null;      // 全量市场 dict
  let marketList = [];    // 排序后的数组
  let kw = '';
  let mkw = '';
  let view = 'installed';

  const plugIcon = p => {
    const s = (p.name || '?').replace(/^astrbot_?/i, '');
    return (s[0] || 'A').toUpperCase();
  };

  function render() {
    const p = $('#page-plugins');
    p.innerHTML = `
      <div class="page__head">
        <div>
          <div class="page__title">插件</div>
          <div class="page__sub" id="pl-count">扩展你的机器人</div>
        </div>
      </div>
      <div class="page__body">
        <div class="log-chips" id="pl-seg" style="margin:0 4px">
          <button class="chip on" data-v="installed">已安装</button>
          <button class="chip" data-v="market">市场</button>
        </div>
        <div id="pl-installed">
          <div class="searchbar" style="margin-bottom:12px">
            <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M16 16l4.5 4.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
            <input id="pl-search" placeholder="搜索插件" autocomplete="off">
          </div>
          <div id="pl-list" style="display:flex;flex-direction:column;gap:12px"></div>
        </div>
        <div id="pl-market" hidden>
          <div class="searchbar" style="margin-bottom:12px">
            <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M16 16l4.5 4.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
            <input id="mk-search" placeholder="搜索市场(名称/作者/描述)" autocomplete="off">
          </div>
          <div id="mk-list" style="display:flex;flex-direction:column;gap:12px"></div>
        </div>
      </div>`;

    $('#pl-seg').addEventListener('click', e => {
      const b = e.target.closest('.chip');
      if (!b) return;
      view = b.dataset.v;
      $$('#pl-seg .chip').forEach(c => c.classList.toggle('on', c === b));
      $('#pl-installed').hidden = view !== 'installed';
      $('#pl-market').hidden = view !== 'market';
      if (view === 'market') loadMarket();
    });
    $('#pl-search').addEventListener('input', e => { kw = e.target.value.trim().toLowerCase(); renderList(); });
    $('#mk-search').addEventListener('input', e => { mkw = e.target.value.trim().toLowerCase(); renderMarket(); });
    renderList();
    load();
  }

  /* ── 已安装 ── */
  function renderList() {
    const box = $('#pl-list');
    if (!box) return;
    const list = all.filter(x =>
      !kw || (x.name + ' ' + (x.desc || '')).toLowerCase().includes(kw));
    $('#pl-count').textContent = all.length ? `${all.length} 个插件 · ${all.filter(x => x.activated).length} 个已启用` : '扩展你的机器人';
    box.innerHTML = '';
    if (!all.length) { box.innerHTML = '<div class="skel" style="height:76px"></div><div class="skel" style="height:76px"></div><div class="skel" style="height:76px"></div>'; return; }
    if (!list.length) { box.innerHTML = '<div class="empty">没有匹配的插件</div>'; return; }
    for (const plug of list) {
      const sw = el('label', { class: 'switch' },
        el('input', {
          type: 'checkbox', checked: plug.activated ? '' : null,
          onchange: async e => {
            const on = e.target.checked;
            plug.activated = on;
            try { await api('/api/v1/plugins/enabled', { method: 'PATCH', body: { plugin_id: plug.name, enabled: on } }); toast(on ? '已启用 ' + plug.name : '已停用 ' + plug.name, 'ok'); }
            catch (err) { plug.activated = !on; e.target.checked = !on; toast(err.message, 'err'); }
            renderList();
          },
        }),
        el('i'));
      box.append(el('div', { class: 'card plugin' },
        el('div', { class: 'plugin__icon' }, plugIcon(plug)),
        el('div', { class: 'plugin__meta' },
          el('div', { class: 'plugin__name' }, plug.name || '未命名', plug.reserved ? el('span', { class: 'tag' }, '核心') : null),
          el('div', { class: 'plugin__desc' }, plug.desc || ''),
          el('div', { class: 'plugin__ver' }, `v${plug.version || '?'} · ${plug.author || '未知作者'}`)),
        sw));
    }
  }

  async function load() {
    try {
      all = (await api('/api/v1/plugins')) || [];
      if (alive) renderList();
    } catch (e) { if (alive) { toast(e.message, 'err'); $('#pl-list').innerHTML = `<div class="empty">${esc(e.message)}</div>`; } }
  }

  /* ── 市场 ── */
  async function loadMarket() {
    const box = $('#mk-list');
    if (market) { renderMarket(); return; }
    if (box) box.innerHTML = '<div class="skel" style="height:84px"></div><div class="skel" style="height:84px"></div><div class="skel" style="height:84px"></div>';
    try {
      market = await api('/api/v1/plugins/market');
      marketList = Object.entries(market || {})
        .filter(([k]) => k !== '$meta')
        .map(([k, v]) => ({ repo: k, ...v }))
        .sort((a, b) => (b.download_count || 0) - (a.download_count || 0));
    } catch (e) { if (alive && box) box.innerHTML = `<div class="empty">${esc(e.message || '市场加载失败')}</div>`; return; }
    if (alive) renderMarket();
  }

  async function installPlugin(item, btn) {
    btn.disabled = true; btn.textContent = '安装中…';
    try {
      await api('/api/v1/plugins/install/github', {
        method: 'POST',
        timeoutMs: 120000,
        body: {
          url: item.repo,
          ignore_version_check: false,
          install_method: 'market',
          registry_url: null,
          market_plugin_id: item.repo,
        },
      });
      toast('已安装 ' + (item.display_name || item.name), 'ok');
      btn.textContent = '已安装';
      load();
    } catch (e) {
      toast(e.message || '安装失败', 'err');
      btn.disabled = false; btn.textContent = '安装';
    }
  }

  function renderMarket() {
    const box = $('#mk-list');
    if (!box) return;
    const list = marketList.filter(x =>
      !mkw || (x.display_name + ' ' + x.name + ' ' + (x.desc || '') + ' ' + (x.author || '') + ' ' + x.repo).toLowerCase().includes(mkw));
    box.innerHTML = '';
    if (!list.length) { box.innerHTML = market ? '<div class="empty">没有匹配的插件</div>' : ''; return; }
    const installedNames = new Set(all.map(p => p.name));
    for (const item of list.slice(0, 60)) {
      const btn = el('button', {
        class: 'btn btn--primary btn--sm',
        style: 'flex:none',
        onclick: () => installPlugin(item, btn),
      }, '安装');
      const installed = installedNames.has(item.name);
      if (installed) { btn.disabled = true; btn.textContent = '已装'; }
      box.append(el('div', { class: 'card plugin' },
        el('div', { class: 'plugin__icon' }, (item.display_name || item.name || '?')[0].toUpperCase()),
        el('div', { class: 'plugin__meta' },
          el('div', { class: 'plugin__name' }, item.display_name || item.name || item.repo),
          el('div', { class: 'plugin__desc' }, item.desc || ''),
          el('div', { class: 'plugin__ver' },
            `v${item.version || '?'} · ${item.author || '?'}`
            + (item.download_count ? ` · ↓${fmt.num(item.download_count)}` : '')
            + (item.stars ? ` · ★${fmt.num(item.stars)}` : ''))),
        btn));
    }
  }

  Pages.plugins = {
    mount() { alive = true; market = null; marketList = []; render(); },
    unmount() { alive = false; $('#page-plugins').innerHTML = ''; },
  };
})();

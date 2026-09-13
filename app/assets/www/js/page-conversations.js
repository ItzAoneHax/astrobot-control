/* page-conversations.js — 对话记录:全平台会话浏览(筛选私聊/群聊)+ 查看历史 */
'use strict';

(() => {
  let alive = false;
  let items = [];
  let page = 1;
  let total = 0;
  let totalPages = 1;
  let mtype = 'all'; // all | private | group
  let openCid = null;

  async function load(reset) {
    const box = $('#cv-body');
    if (reset) { page = 1; items = []; }
    try {
      const d = await api(`/api/v1/conversations?page=${page}&page_size=20&message_type=${mtype}`);
      const convs = (d && d.conversations) || [];
      const pg = (d && d.pagination) || {};
      total = pg.total || convs.length;
      totalPages = pg.total_pages || 1;
      items = reset ? convs : items.concat(convs);
    } catch (e) { if (alive && box && !items.length) box.innerHTML = `<div class="empty">${esc(e.message)}</div>`; return; }
    if (alive) renderList();
  }

  function convRow(c) {
    const u = c.umo_info || {};
    const title = (typeof c.title === 'string' && c.title) || u.display_name || u.auto_name || u.user_alias || '未命名对话';
    const isGroup = (u.message_type === 'group' || String(c.platform_id || '').includes('Group'));
    return el('div', {
      class: 'card', style: 'cursor:pointer',
      onclick: () => openConv(c),
    },
      el('div', { class: 'plugin__name', style: 'margin-bottom:3px' },
        el('span', { class: 'rank__icon', style: 'display:inline-flex;width:22px;height:22px;border-radius:6px;font-size:11px;margin-right:7px;background:' + (isGroup ? 'var(--purple)' : 'var(--blue)') }, isGroup ? '群' : '私'),
        title),
      el('div', { class: 'plugin__ver' },
        `${c.platform_id || u.platform || '?'} · ${u.creator_sender_id || c.user_id || ''} · ${fmt.rel(c.updated_at || Date.now() / 1000)}`
        + (c.token_usage ? ` · ${fmt.num(c.token_usage)} tokens` : '')));
  }

  function renderList() {
    const box = $('#cv-body');
    if (!box) return;
    box.innerHTML = '';
    if (!items.length) { box.innerHTML = '<div class="empty">没有对话记录</div>'; return; }
    for (const c of items) box.append(convRow(c));
    if (page < totalPages) {
      box.append(el('button', {
        class: 'btn btn--ghost btn--block', onclick: () => { page++; load(false); },
      }, `加载更多(${page}/${totalPages} 页,共 ${total} 条)`));
    }
  }

  /* 详情:解析 history 字段渲染气泡 */
  async function openConv(c) {
    openCid = c.cid;
    const u = c.umo_info || {};
    let hist = [];
    try {
      const d = await api(`/api/v1/conversations/${encodeURIComponent(c.cid)}?user_id=${encodeURIComponent(c.user_id || '')}`);
      let raw = d && (d.history || d.conversation && d.conversation.history) || c.history;
      if (typeof raw === 'string') { try { raw = JSON.parse(raw); } catch (_) { raw = null; } }
      if (Array.isArray(raw)) hist = raw;
    } catch (_) {}
    if (!alive || openCid !== c.cid) return;

    openSheet(close => {
      const title = (typeof c.title === 'string' && c.title) || u.display_name || '对话详情';
      const list = el('div', { style: 'display:flex;flex-direction:column;gap:10px;padding:4px 0;max-height:52dvh;overflow-y:auto' });
      if (!hist.length) list.append(el('div', { class: 'empty' }, '无法解析历史记录'));
      for (const m of hist.slice(-60)) {
        // 兼容多种消息形态:{role,content} / {sender_id, message:[parts]} / {is_llm, message_chain}
        let isBot = false, text = '';
        try {
          if (m.role != null) { isBot = m.role === 'assistant'; text = typeof m.content === 'string' ? m.content : JSON.stringify(m.content); }
          else {
            isBot = !!(m.is_llm || m.type === 'ai' || (m.message && m.message.role === 'assistant'));
            const parts = (m.message && (m.message.message || m.message.chain)) || m.message_chain || m.message;
            if (typeof parts === 'string') text = parts;
            else if (Array.isArray(parts)) text = parts.map(p => (typeof p === 'string' ? p : (p.text || p.type === 'image' ? '[图片]' : ''))).join('');
            else if (parts && typeof parts === 'object') text = JSON.stringify(parts);
          }
        } catch (_) { text = JSON.stringify(m).slice(0, 200); }
        if (!text) continue;
        list.append(el('div', { class: 'msg' + (isBot ? ' msg--bot' : ' msg--user'), style: 'max-width:100%' },
          el('div', { class: 'msg__col' },
            (() => { const b = el('div', { class: 'msg__bubble', style: isBot ? '' : 'background:rgba(0,122,255,.12);color:var(--label)' }); b.append(mdNode(text)); return b; })())));
      }
      return [
        el('div', { class: 'sheet__title' }, title),
        el('div', { class: 'plugin__ver', style: 'text-align:center;margin-bottom:8px' },
          `${c.platform_id || '?'} · ${u.message_type || ''} · 最近 ${fmt.rel(c.updated_at || Date.now() / 1000)}`),
        list,
      ];
    });
  }

  Pages.conversations = {
    mount() {
      alive = true;
      $('#page-conversations').innerHTML = `
        ${subHead('对话记录', '所有平台的历史会话')}
        <div class="page__body">
          <div class="log-chips" id="cv-seg" style="margin:0 4px">
            <button class="chip on" data-t="all">全部</button>
            <button class="chip" data-t="private">私聊</button>
            <button class="chip" data-t="group">群聊</button>
          </div>
          <div id="cv-body" style="display:flex;flex-direction:column;gap:12px">
            <div class="skel" style="height:74px"></div><div class="skel" style="height:74px"></div>
          </div>
        </div>`;
      $('#cv-seg').addEventListener('click', e => {
        const b = e.target.closest('.chip');
        if (!b) return;
        mtype = b.dataset.t;
        $$('#cv-seg .chip').forEach(c => c.classList.toggle('on', c === b));
        load(true);
      });
      load(true);
    },
    unmount() { alive = false; openCid = null; $('#page-conversations').innerHTML = ''; },
  };
})();

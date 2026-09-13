/* page-chat.js — 对话:会话管理 + 历史加载 + 流式收发(SSE) */
'use strict';

(() => {
  let alive = false;
  let sessions = [];
  let cur = null;            // 当前会话
  let curPage = 1;
  let hasMore = false;
  let loadingHist = false;
  let aborter = null;        // 当前生成中断器
  let providers = null;
  let providerId = localStorage.getItem('ab_provider') || '';
  let scroller, input, sendBtn;

  const ICONS = {
    back: '<svg viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h10" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>',
    send: '<svg viewBox="0 0 24 24"><path d="M4 12l16-7-4.5 7L20 19z" fill="currentColor"/></svg>',
    stop: '<svg viewBox="0 0 24 24"><rect x="7" y="7" width="10" height="10" rx="2" fill="currentColor"/></svg>',
    bot: '<svg viewBox="0 0 24 24"><rect x="5" y="8" width="14" height="10" rx="3" fill="none" stroke="currentColor" stroke-width="1.7"/><circle cx="12" cy="13" r="2.2" fill="currentColor"/><path d="M12 8V5M8.5 4.8h.01M15.5 4.8h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    tool: '<svg viewBox="0 0 24 24"><path d="M14.5 4a5 5 0 0 0-6.6 6.1L3.7 14.3a2 2 0 1 0 2.8 2.8l4.2-4.2A5 5 0 0 0 17 6.3l-2.9 2.9-2.4-2.4z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>',
  };

  function bubbleUser(text, ts) {
    const bubble = el('div', { class: 'msg__bubble' });
    bubble.append(mdNode(text));
    return el('div', { class: 'msg msg--user' },
      el('div', { class: 'msg__avatar' }, esc((store.username || '我')[0].toUpperCase())),
      el('div', { class: 'msg__col' },
        bubble,
        ts ? el('div', { class: 'msg__time' }, fmt.hm(ts)) : null));
  }

  function botCol() {
    const col = el('div', { class: 'msg__col' });
    const think = el('div', { class: 'think' + (prefs.get('thinkOpen') !== false ? ' open' : '') },
      el('button', { class: 'think__toggle', onclick: () => think.classList.toggle('open') },
        el('span', null, '思考过程'),
        el('span', null, '<svg viewBox="0 0 24 24" style="width:12px;height:12px"><path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>')),
      el('div', { class: 'think__body' }));
    think.style.display = 'none';
    const answer = el('div', { class: 'msg__bubble' });
    const meta = el('div', { class: 'msg__time' });
    col.append(think, answer, meta);
    return { col, think, answer, meta };
  }

  function bubbleBot(ts) {
    const { col, think, answer, meta } = botCol();
    const node = el('div', { class: 'msg msg--bot' },
      el('div', { class: 'msg__avatar' }, '✦'),
      col);
    if (ts) meta.textContent = fmt.hm(ts);
    return { node, think, answer, meta };
  }

  /* 历史消息渲染 */
  function renderHistoryItem(h) {
    const c = h.content || {};
    const type = c.type === 'user' ? 'user' : 'bot';
    let mdText = '';
    const extras = [];
    for (const part of (c.message || [])) {
      if (part.type === 'plain' || part.type === 'text') mdText += part.text || '';
      else if (part.type === 'image' && (part.url || part.path)) extras.push(absUrl(part.url || part.path));
      else if (part.type === 'file' && part.filename) extras.push(null), mdText += `\n📎 ${part.filename}`;
    }
    if (type === 'user') return bubbleUser(mdText, h.created_at);
    const b = bubbleBot(h.created_at);
    b.answer.innerHTML = renderMD(mdText);
    if (c.reasoning) {
      b.think.style.display = '';
      b.think.querySelector('.think__body').textContent = c.reasoning;
    }
    for (const u of extras) if (u) {
      const img = el('img', { class: 'pic', src: u, loading: 'lazy' });
      img.onclick = () => viewImage(u);
      b.answer.append(img);
    }
    return b.node;
  }

  function viewImage(url) {
    $('#imgv-img').src = url;
    $('#imgv').hidden = false;
  }

  function nearBottom() { return scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 140; }
  function scrollBottom(force) { if (force || nearBottom()) scroller.scrollTop = scroller.scrollHeight; }

  async function loadSessions(pickLatest) {
    try {
      sessions = (await api('/api/v1/chat/sessions?page=1&page_size=50&username=' + encodeURIComponent(store.username))) || [];
    } catch (e) { sessions = []; }
    if (pickLatest && sessions.length) await openSession(sessions[0], true);
    else if (!sessions.length) await newSession(true);
    renderHead();
  }

  async function newSession(silent) {
    try {
      cur = await api('/api/v1/chat/sessions/new?platform_id=webchat');
      sessions.unshift(cur);
      curPage = 1; hasMore = false;
      scroller.innerHTML = '<div class="empty">和你的机器人说点什么吧 ✦</div>';
      renderHead();
    } catch (e) { if (!silent) toast(e.message, 'err'); }
  }

  async function openSession(s, silent) {
    if (aborter) aborter.abort();
    cur = s; curPage = 1; hasMore = false;
    renderHead();
    scroller.innerHTML = '<div class="log-state">加载历史消息…</div>';
    await loadHistory(true);
  }

  async function loadHistory(replace) {
    if (!cur || loadingHist) return;
    loadingHist = true;
    try {
      const d = await api(`/api/v1/chat/sessions/${encodeURIComponent(cur.session_id)}?page=${curPage}&page_size=30`);
      hasMore = !!d.has_more;
      const frag = document.createDocumentFragment();
      for (const h of (d.history || [])) frag.append(renderHistoryItem(h));
      if (replace) {
        scroller.innerHTML = '';
        scroller.append(frag);
        if (!(d.history || []).length) scroller.innerHTML = '<div class="empty">和你的机器人说点什么吧 ✦</div>';
        scrollBottom(true);
      } else {
        const prevH = scroller.scrollHeight;
        scroller.prepend(frag);
        scroller.scrollTop += scroller.scrollHeight - prevH;
      }
    } catch (e) {
      if (replace) scroller.innerHTML = `<div class="empty">${esc(e.message || '加载失败')}</div>`;
      else toast(e.message, 'err');
    }
    loadingHist = false;
  }

  /* ── 发送与流式接收 ── */
  function setStreaming(on) {
    sendBtn.innerHTML = on ? ICONS.stop : ICONS.send;
    sendBtn.classList.toggle('composer__stop', on);
  }

  async function send() {
    const text = input.value.trim();
    if (!text || !cur) return;
    if (aborter) { aborter.abort(); return; }

    input.value = ''; input.style.height = 'auto';
    if (scroller.querySelector('.empty')) scroller.innerHTML = '';
    scroller.append(bubbleUser(text, Date.now() / 1000));
    scrollBottom(true);

    const b = bubbleBot();
    scroller.append(b.node);
    scrollBottom(true);

    let thinkText = '', ansText = '', curEl = null;
    const thinkBody = b.think.querySelector('.think__body');
    const paint = () => {
      b.answer.innerHTML = renderMD(ansText) + '<span class="cursor"></span>';
      scrollBottom();
    };

    aborter = new AbortController();
    setStreaming(true);
    try {
      await chatStream({
        sessionId: cur.session_id, text, provider: providerId, signal: aborter.signal,
        onEvent: ev => {
          const t = ev.type || ev.t;
          if (ev.chain_type === 'reasoning') {
            thinkText += ev.streaming === false ? '' : (ev.data || '');
            if (ev.streaming === false && ev.data) thinkText = ev.data;
            b.think.style.display = '';
            thinkBody.textContent = thinkText;
            scrollBottom();
          } else if (ev.chain_type === 'tool_call' || t === 'tool_call') {
            let name = '';
            try { name = typeof ev.data === 'string' ? (ev.data.match(/"name"\s*:\s*"([^"]+)"/) || [])[1] || '' : (ev.data && ev.data.name) || ''; } catch (_) {}
            b.answer.before(el('div', { class: 'toolchip' }, ICONS.tool, '调用工具 ' + (name || '…')));
          } else if (['image', 'record', 'video', 'file'].includes(t)) {
            const raw = String(ev.data || '');
            const url = absUrl(raw.split('|').pop());
            if (url) {
              const img = el('img', { class: 'pic', src: url });
              img.onclick = () => viewImage(url);
              b.answer.before(img);
            }
          } else if (t === 'error') {
            b.meta.innerHTML = `<span class="msg__err">${esc(ev.data || '生成失败')}</span>`;
          } else if (t === 'complete' || t === 'break') {
            if (ev.data) ansText = ev.data;
          } else if (t === 'end') {
            /* 结束 */
          } else if (t === 'plain' || t === 'text' || (!t && typeof ev.data === 'string')) {
            if (ev.streaming === false) ansText = ev.data || '';
            else ansText += ev.data || '';
            paint();
          }
        },
      });
      b.answer.innerHTML = renderMD(ansText);
      b.meta.textContent = fmt.hm(Date.now() / 1000);
      if (!ansText && !thinkText && !b.meta.textContent) b.answer.innerHTML = '<span style="color:var(--faint)">(空回复)</span>';
    } catch (e) {
      if (e.name === 'AbortError') { b.answer.innerHTML = renderMD(ansText); }
      else { b.meta.innerHTML = `<span class="msg__err">${esc(e.message || '发送失败')}</span>`; }
    }
    aborter = null;
    setStreaming(false);
    scrollBottom();
    input.focus();
  }

  /* ── 会话抽屉 ── */
  function openSessions() {
    openSheet(close => {
      const list = el('div');
      const rebuild = () => {
        list.innerHTML = '';
        if (!sessions.length) list.append(el('div', { class: 'empty' }, '还没有会话'));
        for (const s of sessions) {
          list.append(el('div', { class: 'sess' + (cur && s.session_id === cur.session_id ? '' : '') },
            el('div', { class: 'sess__icon', onclick: async () => { close(); openSession(s); } }, '✦'),
            el('div', { class: 'sess__meta', onclick: async () => { close(); openSession(s); } },
              el('div', { class: 'sess__name' }, s.display_name || '未命名会话'),
              el('div', { class: 'sess__sub' }, `${s.platform_id || ''} · ${fmt.rel(s.updated_at || Date.now() / 1000)}`)),
            el('button', { class: 'sess__more', onclick: () => sessionActions(s, rebuild) }, '⋯')));
        }
      };
      rebuild();
      return [
        el('div', { class: 'sheet__title' }, '全部会话'),
        list,
        el('div', { class: 'sheet__actions' },
          el('button', { class: 'btn btn--primary btn--block', onclick: async () => { close(); newSession(); } }, '+ 开启新对话')),
      ];
    });
  }

  function sessionActions(s, rebuild) {
    openSheet(close => [
      el('div', { class: 'sheet__title' }, s.display_name || '未命名会话'),
      el('div', { class: 'sheet__actions' },
        el('button', { class: 'btn btn--ghost btn--block', onclick: async () => {
          const v = await promptModal({ title: '重命名会话', value: s.display_name || '' });
          if (v) {
            try { await api('/api/v1/chat/sessions/' + encodeURIComponent(s.session_id), { method: 'PATCH', body: { display_name: v } }); s.display_name = v; renderHead(); toast('已重命名', 'ok'); }
            catch (e) { toast(e.message, 'err'); }
          }
          close(); openSessions();
        } }, '重命名'),
        el('button', { class: 'btn btn--danger btn--block', onclick: async () => {
          close();
          if (await confirmModal({ title: '删除会话', text: '删除后聊天记录不可恢复。', okText: '删除', danger: true })) {
            try {
              await api('/api/v1/chat/sessions/' + encodeURIComponent(s.session_id), { method: 'DELETE' });
              sessions = sessions.filter(x => x.session_id !== s.session_id);
              if (cur && cur.session_id === s.session_id) { cur = null; sessions.length ? openSession(sessions[0]) : newSession(); }
              toast('已删除', 'ok');
            } catch (e) { toast(e.message, 'err'); }
          }
        } }, '删除会话')),
    ]);
  }

  /* ── Provider 选择 ── */
  async function openProviders() {
    if (!providers) {
      try { providers = (await api('/api/v1/providers?capability=chat&enabled=true'))?.providers || []; }
      catch (e) { toast(e.message, 'err'); return; }
    }
    if (!providers.length) { toast('没有可用的模型提供方'); return; }
    openSheet(close => [
      el('div', { class: 'sheet__title' }, '选择模型'),
      el('div', null, providers.map(p => el('div', {
        class: 'sess', style: 'cursor:pointer',
        onclick: () => { providerId = p.id === providerId ? '' : p.id; localStorage.setItem('ab_provider', providerId); renderHead(); close(); },
      },
        el('div', { class: 'sess__icon' }, (p.name || p.id || '?')[0].toUpperCase()),
        el('div', { class: 'sess__meta' },
          el('div', { class: 'sess__name' }, p.name || p.id),
          el('div', { class: 'sess__sub' }, p.model || '')),
        el('span', { class: 'cell__val' }, p.id === providerId ? '✓' : '')))),
      el('div', { class: 'sheet__actions' },
        el('button', { class: 'btn btn--ghost btn--block', onclick: () => { providerId = ''; localStorage.setItem('ab_provider', ''); renderHead(); close(); } }, '恢复默认')),
    ]);
  }

  function renderHead() {
    const nameEl = $('#chat-name'), subEl = $('#chat-sub');
    if (nameEl) nameEl.textContent = cur ? (cur.display_name || '未命名会话') : '对话';
    if (subEl) subEl.textContent = (cur ? (cur.platform_id || 'webchat') : '') + (providerId ? ' · ' + providerId : '');
  }

  Pages.chat = {
    mount() {
      alive = true;
      const p = $('#page-chat');
      p.innerHTML = `
        <div class="chat-head">
          <button class="chat-head__btn" id="ch-sess" aria-label="会话列表">${ICONS.back.replace('M4 6h16M4 12h16M4 18h10', 'M4 6h16M4 11h16M4 16h10M4 21h7')}</button>
          <div class="chat-head__title">
            <div class="chat-head__name" id="chat-name">对话</div>
            <div class="chat-head__sub" id="chat-sub"></div>
          </div>
          <button class="chat-head__btn" id="ch-prov" aria-label="选择模型">${ICONS.bot}</button>
        </div>
        <div class="chat-scroll" id="chat-scroll"></div>
        <div class="composer">
          <textarea class="composer__input" id="chat-input" rows="1" placeholder="发送消息…"></textarea>
          <button class="composer__send" id="chat-send" aria-label="发送">${ICONS.send}</button>
        </div>`;
      scroller = $('#chat-scroll');
      input = $('#chat-input');
      sendBtn = $('#chat-send');

      $('#ch-sess').onclick = openSessions;
      $('#ch-prov').onclick = openProviders;
      sendBtn.onclick = send;
      input.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
      });
      input.addEventListener('input', () => {
        input.style.height = 'auto';
        input.style.height = Math.min(110, input.scrollHeight) + 'px';
      });
      scroller.addEventListener('scroll', () => {
        if (scroller.scrollTop < 60 && hasMore && !loadingHist && cur) { curPage++; loadHistory(false); }
      }, { passive: true });

      loadSessions(true);
    },
    unmount() {
      alive = false;
      if (aborter) { aborter.abort(); aborter = null; }
      $('#page-chat').innerHTML = '';
    },
  };
})();

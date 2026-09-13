/* page-me.js — 我的:服务器状态、平台开关、账号、重启、退出 */
'use strict';

(() => {
  let alive = false;
  let bots = [];

  async function ping() {
    const t0 = performance.now();
    const v = await api('/api/v1/stats/versions');
    return { ms: Math.round(performance.now() - t0), v };
  }

  function cellIcon(svg) { return `<span class="cell__icon">${svg}</span>`; }

  async function render() {
    const p = $('#page-me');
    const host = store.demo ? '演示模式' : (() => { try { return new URL(store.server).host; } catch (_) { return store.server; } })();
    p.innerHTML = `
      <div class="page__head">
        <div><div class="page__title">我的</div><div class="page__sub">控制台与账号</div></div>
      </div>
      <div class="page__body">

        <div class="card server-hero">
          <div class="server-hero__host">${esc(host)}</div>
          <div class="server-hero__stat" id="me-ping"><span class="dot dot--idle"></span>测量连接中…</div>
          <div class="vergrid" style="margin-top:14px">
            <div class="verbox"><div class="verbox__k">AstrBot 核心</div><div class="verbox__v" id="me-ver-core">—</div></div>
            <div class="verbox"><div class="verbox__k">WebUI</div><div class="verbox__v" id="me-ver-web">—</div></div>
          </div>
        </div>

        <div class="card">
          <div class="card__title">消息平台</div>
          <div id="me-bots"></div>
        </div>

        <div class="card">
          <div class="card__title">机器人管理</div>
          <a class="cell" href="#/personas">
            ${cellIcon('<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="3.6" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M5 20c1.2-3.2 3.8-4.8 7-4.8s5.8 1.6 7 4.8M12 12.5v2" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>')}
            <span class="cell__body">人格设定<span class="cell__sub">管理机器人的人设角色</span></span>
            <span class="cell__chev">›</span>
          </a>
          <a class="cell" href="#/cron">
            ${cellIcon('<svg viewBox="0 0 24 24"><circle cx="12" cy="13" r="7.2" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M12 10v3.5l2.4 1.6M9.5 3h5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>')}
            <span class="cell__body">定时任务<span class="cell__sub">按计划自动执行提示词</span></span>
            <span class="cell__chev">›</span>
          </a>
          <a class="cell" href="#/conversations">
            ${cellIcon('<svg viewBox="0 0 24 24"><path d="M4 6a2.5 2.5 0 0 1 2.5-2.5h11A2.5 2.5 0 0 1 20 6v8a2.5 2.5 0 0 1-2.5 2.5H9L4.5 20v-3.5H4z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>')}
            <span class="cell__body">对话记录<span class="cell__sub">所有平台的历史会话</span></span>
            <span class="cell__chev">›</span>
          </a>
          <a class="cell" href="#/providers">
            ${cellIcon('<svg viewBox="0 0 24 24"><path d="M12 3v3M12 18v3M4.2 7.5l2.6 1.5M17.2 15l2.6 1.5M4.2 16.5l2.6-1.5M17.2 9l2.6-1.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="1.7"/></svg>')}
            <span class="cell__body">模型提供方<span class="cell__sub">LLM / 语音 / 嵌入服务</span></span>
            <span class="cell__chev">›</span>
          </a>
        </div>

        <div class="card">
          <div class="card__title">账号</div>
          <button class="cell" id="me-user">
            ${cellIcon('<svg viewBox="0 0 24 24"><circle cx="12" cy="8.5" r="3.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M4.5 20c1.4-3.4 4.2-5 7.5-5s6.1 1.6 7.5 5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>')}
            <span class="cell__body">修改密码<span class="cell__sub">当前用户:${esc(store.username || 'astrbot')}</span></span>
            <span class="cell__chev">›</span>
          </button>
          <a class="cell" href="#/settings">
            ${cellIcon('<svg viewBox="0 0 24 24"><path d="M12 8.8a3.2 3.2 0 1 0 0 6.4 3.2 3.2 0 0 0 0-6.4z" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M12 2.8v2.4M12 18.8v2.4M4.7 6.5l1.9 1.4M17.4 16.1l1.9 1.4M2.8 12h2.4M18.8 12h2.4M4.7 17.5l1.9-1.4M17.4 7.9l1.9-1.4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>')}
            <span class="cell__body">设置<span class="cell__sub">外观 · 对话偏好 · 关于</span></span>
            <span class="cell__chev">›</span>
          </a>
        </div>

        <div class="card">
          <div class="card__title">维护</div>
          <button class="cell" id="me-restart">
            ${cellIcon('<svg viewBox="0 0 24 24"><path d="M20 12a8 8 0 1 1-2.3-5.6M20 3v5h-5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>')}
            <span class="cell__body">重启机器人核心<span class="cell__sub">所有会话将短暂中断</span></span>
            <span class="cell__chev">›</span>
          </button>
          <a class="cell" href="https://docs.astrbot.app/" target="_blank" rel="noopener">
            ${cellIcon('<svg viewBox="0 0 24 24"><path d="M4 5a2 2 0 0 1 2-2h5v18H6a2 2 0 0 1-2-2zM13 3h5a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-5z" fill="none" stroke="currentColor" stroke-width="1.7"/></svg>')}
            <span class="cell__body">使用文档<span class="cell__sub">docs.astrbot.app</span></span>
            <span class="cell__chev">›</span>
          </a>
        </div>

        <div class="card">
          <button class="cell cell--danger" id="me-logout">
            ${cellIcon('<svg viewBox="0 0 24 24"><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 8l-4 4 4 4M6 12h10" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>')}
            <span class="cell__body">退出登录</span>
          </button>
        </div>

        <p class="chart-note" style="justify-content:center">AstroBot Control · 为你的机器人而造 ✦</p>
      </div>`;

    // 连接测量
    ping().then(({ ms, v }) => {
      if (!alive) return;
      $('#me-ping').innerHTML = `<span class="dot dot--ok"></span>连接正常 · <span class="server-hero__ping">${store.demo ? '—' : ms + 'ms'}</span>`;
      $('#me-ver-core').textContent = v.astrbot_version || '—';
      $('#me-ver-web').textContent = v.webui_version || '—';
    }).catch(e => {
      if (!alive) return;
      $('#me-ping').innerHTML = `<span class="dot dot--bad"></span>${esc(e.message || '连接失败')}`;
    });

    // 平台列表
    try {
      const d = await api('/api/v1/bots');
      bots = (d && (d.bots || d)) || [];
      if (alive) renderBots();
    } catch (e) { if (alive) $('#me-bots').innerHTML = `<div class="empty">${esc(e.message || '无法获取平台列表')}</div>`; }

    // 修改密码
    $('#me-user').onclick = async () => {
      const old1 = await promptModal({ title: '当前密码', type: 'password' });
      if (old1 === null) return;
      const n1 = await promptModal({ title: '新密码', placeholder: '至少 8 位' });
      if (n1 === null) return;
      const n2 = await promptModal({ title: '再次输入新密码' });
      if (n2 === null) return;
      if (n1 !== n2) { toast('两次输入不一致', 'err'); return; }
      try {
        await api('/api/v1/auth/account', { method: 'PATCH', body: { password: old1, new_password: n1, confirm_password: n2 } });
        toast('密码已修改', 'ok');
      } catch (e) { toast(e.message, 'err'); }
    };

    // 重启核心
    $('#me-restart').onclick = async () => {
      if (!await confirmModal({ title: '重启机器人核心', text: '重启期间机器人将无法响应消息,通常需要 10~30 秒。', okText: '重启', danger: true })) return;
      try {
        await api('/api/v1/system/restart', { method: 'POST' });
        toast('重启指令已发送', 'ok');
      } catch (e) { toast(e.message, 'err'); }
    };

    // 退出
    $('#me-logout').onclick = async () => {
      if (!await confirmModal({ title: '退出登录', text: '需要重新输入密码才能再次控制机器人。', okText: '退出', danger: true })) return;
      api('/api/v1/auth/logout', { method: 'POST' }).catch(() => {});
      store.token = '';
      store.demo = false;
      location.hash = '';
      location.reload();
    };
  }

  function renderBots() {
    const box = $('#me-bots');
    box.innerHTML = '';
    if (!bots.length) { box.innerHTML = '<div class="empty">未配置任何消息平台</div>'; return; }
    for (const b of bots) {
      const id = b.id || b.name;
      const name = b.name || b.id;
      const type = b.type || '';
      const enabled = b.enabled !== false;
      box.append(el('div', { class: 'cell' },
        el('span', { class: 'cell__icon' }, (name || '?')[0].toUpperCase()),
        el('span', { class: 'cell__body' }, name,
          el('div', { class: 'cell__sub' }, type + (b.status ? ' · ' + b.status : ''))),
        el('label', { class: 'switch' },
          el('input', {
            type: 'checkbox', checked: enabled ? '' : null,
            onchange: async e => {
              const on = e.target.checked;
              try { await api('/api/v1/bots/enabled', { method: 'PATCH', body: { bot_id: id, enabled: on } }); toast(on ? '已启用 ' + name : '已停用 ' + name, 'ok'); }
              catch (err) { e.target.checked = !on; toast(err.message, 'err'); }
            },
          }),
          el('i'))));
    }
  }

  Pages.me = {
    mount() { alive = true; render(); },
    unmount() { alive = false; $('#page-me').innerHTML = ''; },
  };
})();

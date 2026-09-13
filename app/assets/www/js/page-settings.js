/* page-settings.js — 应用设置:外观/对话偏好/总览刷新/服务器/关于 */
'use strict';

(() => {
  let alive = false;

  const THEME_NAMES = { auto: '跟随系统', light: '浅色', dark: '深色' };
  const REFRESH_OPTS = [[0, '关闭'], [30, '30 秒'], [60, '1 分钟'], [300, '5 分钟']];

  const cellIcon = svg => `<span class="cell__icon">${svg}</span>`;

  function render() {
    const p = prefs.load();
    const theme = THEME_NAMES[p.theme] || '跟随系统';
    const refresh = (REFRESH_OPTS.find(o => o[0] === (p.dashRefresh ?? 60)) || ['', '1 分钟'])[1];
    const host = (() => { try { return store.demo ? '演示模式' : new URL(store.server).host; } catch (_) { return store.server; } })();
    const ver = (() => {
      try { return window.UpdateBridge ? JSON.parse(UpdateBridge.versions()) : null; } catch (_) { return null; }
    })();

    $('#page-settings').innerHTML = `
      ${subHead('设置', '应用外观与行为')}
      <div class="page__body">

        <div class="card">
          <div class="card__title">外观</div>
          <button class="cell" id="st-theme">
            ${cellIcon('<svg viewBox="0 0 24 24"><path d="M12 3a9 9 0 1 0 9 9c0-.3 0-.6-.05-.9A6.5 6.5 0 0 1 12.9 3.05C12.6 3 12.3 3 12 3z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>')}
            <span class="cell__body">外观主题<span class="cell__sub">深色模式全程适配</span></span>
            <span class="cell__val">${theme}</span>
            <span class="cell__chev">›</span>
          </button>
        </div>

        <div class="card">
          <div class="card__title">对话</div>
          <div class="cell">
            ${cellIcon('<svg viewBox="0 0 24 24"><path d="M12 4l1.6 4.2L18 10l-4.4 1.5L12 16l-1.6-4.5L6 10l4.4-1.4z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>')}
            <span class="cell__body">思考过程默认展开<span class="cell__sub">机器人的推理过程直接可见</span></span>
            <label class="switch"><input type="checkbox" id="st-think" ${p.thinkOpen !== false ? 'checked' : ''}><i></i></label>
          </div>
          <div class="cell">
            ${cellIcon('<svg viewBox="0 0 24 24"><path d="M13 3L5 13h6l-1 8 8-10h-6z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>')}
            <span class="cell__body">流式输出<span class="cell__sub">逐字显示回复(关闭则等待完整结果)</span></span>
            <label class="switch"><input type="checkbox" id="st-stream" ${p.stream !== false ? 'checked' : ''}><i></i></label>
          </div>
        </div>

        <div class="card">
          <div class="card__title">总览</div>
          <button class="cell" id="st-refresh">
            ${cellIcon('<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.2" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M12 7.5V12l3 2" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>')}
            <span class="cell__body">自动刷新<span class="cell__sub">统计数据的刷新频率</span></span>
            <span class="cell__val">${refresh}</span>
            <span class="cell__chev">›</span>
          </button>
        </div>

        <div class="card">
          <div class="card__title">服务器</div>
          <button class="cell" id="st-server">
            ${cellIcon('<svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="6" rx="2" fill="none" stroke="currentColor" stroke-width="1.7"/><rect x="4" y="13" width="16" height="6" rx="2" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M7.5 8h.01M7.5 16h.01" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>')}
            <span class="cell__body">服务器地址<span class="cell__sub">${esc(host)}</span></span>
            <span class="cell__chev">›</span>
          </button>
        </div>

        <div class="card">
          <div class="card__title">关于</div>
          <div class="cell">
            ${cellIcon('<svg viewBox="0 0 24 24"><path d="M12 4l1.8 4.7L18.5 10l-4.7 1.6L12 16.5l-1.8-4.9L5.5 10l4.7-1.3z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>')}
            <span class="cell__body">应用版本<span class="cell__sub">原生壳(需重装 APK 才会变化)</span></span>
            <span class="cell__val">${ver ? ver.native : '1.1'}</span>
          </div>
          <div class="cell">
            ${cellIcon('<svg viewBox="0 0 24 24"><path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>')}
            <span class="cell__body">Web 资源版本<span class="cell__sub">热更新通道 · GitHub Releases</span></span>
            <span class="cell__val">${ver ? 'v' + ver.web : '—'}</span>
          </div>
          <button class="cell" id="st-appupdate">
            ${cellIcon('<svg viewBox="0 0 24 24"><path d="M20 12a8 8 0 1 1-2.3-5.6M20 3v5h-5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>')}
            <span class="cell__body">检查应用更新<span class="cell__sub">仅更新界面资源,无需重装应用</span></span>
            <span class="cell__chev">›</span>
          </button>
          <button class="cell" id="st-update">
            ${cellIcon('<svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="6" rx="2" fill="none" stroke="currentColor" stroke-width="1.7"/><rect x="4" y="13" width="16" height="6" rx="2" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M7.5 8h.01M7.5 16h.01" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>')}
            <span class="cell__body">检查 AstrBot 更新<span class="cell__sub">机器人服务端本体</span></span>
            <span class="cell__chev">›</span>
          </button>
          <a class="cell" href="https://github.com/AstrBotDevs/AstrBot" target="_blank" rel="noopener">
            ${cellIcon('<svg viewBox="0 0 24 24"><path d="M12 3a9 9 0 0 0-2.8 17.5c.4.1.6-.2.6-.4v-1.7c-2.6.6-3.2-1.1-3.2-1.1-.4-1.1-1-1.4-1-1.4-.9-.6.1-.6.1-.6.9.1 1.4 1 1.4 1 .8 1.5 2.2 1 2.7.8.1-.6.3-1 .6-1.3-2-.2-4.2-1-4.2-4.6 0-1 .4-1.8 1-2.5-.1-.2-.4-1.2.1-2.4 0 0 .8-.3 2.5 1a8.5 8.5 0 0 1 4.6 0c1.7-1.2 2.5-1 2.5-1 .5 1.2.2 2.2.1 2.4.6.7 1 1.5 1 2.5 0 3.6-2.2 4.4-4.3 4.6.3.3.6.9.6 1.8V20c0 .3.2.6.7.4A9 9 0 0 0 12 3z" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>')}
            <span class="cell__body">AstrBot 开源仓库</span>
            <span class="cell__chev">›</span>
          </a>
        </div>

        <div class="card">
          <button class="cell cell--danger" id="st-reset">
            ${cellIcon('<svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m3 0-1 13a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1L6 7" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>')}
            <span class="cell__body">重置应用<span class="cell__sub" style="color:rgba(255,59,48,.7)">清除登录与全部本地数据</span></span>
          </button>
        </div>
      </div>`;

    $('#st-theme').onclick = () => {
      openSheet(close => [
        el('div', { class: 'sheet__title' }, '外观主题'),
        el('div', null, Object.entries(THEME_NAMES).map(([k, name]) => el('div', {
          class: 'sess', style: 'cursor:pointer',
          onclick: () => { prefs.set('theme', k); applyTheme(); close(); render(); },
        },
          el('div', { class: 'sess__icon' }, name[0]),
          el('div', { class: 'sess__meta' }, el('div', { class: 'sess__name' }, name)),
          el('span', { class: 'cell__val' }, (prefs.get('theme') || 'auto') === k ? '✓' : '')))),
      ]);
    };

    $('#st-think').addEventListener('change', e => { prefs.set('thinkOpen', e.target.checked); });
    $('#st-stream').addEventListener('change', e => { prefs.set('stream', e.target.checked); });

    $('#st-refresh').onclick = () => {
      openSheet(close => [
        el('div', { class: 'sheet__title' }, '总览自动刷新'),
        el('div', null, REFRESH_OPTS.map(([v, name]) => el('div', {
          class: 'sess', style: 'cursor:pointer',
          onclick: () => { prefs.set('dashRefresh', v); close(); render(); },
        },
          el('div', { class: 'sess__icon' }, '⟳'),
          el('div', { class: 'sess__meta' }, el('div', { class: 'sess__name' }, name)),
          el('span', { class: 'cell__val' }, (prefs.get('dashRefresh') ?? 60) === v ? '✓' : '')))),
      ]);
    };

    $('#st-server').onclick = async () => {
      const v = await promptModal({ title: '服务器地址', value: store.demo ? '' : store.server, placeholder: 'https://your-bot.example.com' });
      if (!v) return;
      const url = normServer(v);
      if (url === store.server && !store.demo) { toast('地址未变化'); return; }
      if (!await confirmModal({ title: '切换服务器', text: '将退出当前登录,前往新服务器重新登录。', okText: '切换' })) return;
      store.clear();
      store.server = url;
      location.hash = '';
      location.reload();
    };

    $('#st-appupdate').onclick = () => {
      if (!window.UpdateBridge) { toast('演示模式下不可用'); return; }
      toast('正在检查更新…');
      UpdateBridge.check(); // 结果经 window.onUpdateResult 回调(util.js)
    };

    $('#st-update').onclick = async () => {
      toast('正在检查更新…');
      try {
        const r = await api('/api/v1/updates/check');
        const has = r && (r.has_update ?? r.has_latest ?? r.update_available);
        const ver = r && (r.latest_version || r.version || '');
        toast(has ? `发现新版本 ${ver},请在服务端升级` : ver ? `已是最新 (${ver})` : '已是最新版本', has ? 'ok' : 'ok');
      } catch (e) { toast(e.message, 'err'); }
    };

    $('#st-reset').onclick = async () => {
      if (!await confirmModal({ title: '重置应用', text: '将清除登录状态、偏好设置等全部本地数据,并回到登录页。', okText: '重置', danger: true })) return;
      localStorage.clear();
      location.hash = '';
      location.reload();
    };
  }

  Pages.settings = {
    mount() { alive = true; render(); },
    unmount() { alive = false; $('#page-settings').innerHTML = ''; },
  };
})();

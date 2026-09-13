/* page-providers.js — 模型提供方:分类列表/启停/测试连接 */
'use strict';

(() => {
  let alive = false;
  let cap = 'chat';   // chat | stt | tts | embedding | rerank
  let provs = [];

  const CAPS = [
    ['chat', '对话'],
    ['stt', '语音转文字'],
    ['tts', '文字转语音'],
    ['embedding', '嵌入'],
    ['rerank', '重排序'],
  ];

  async function load() {
    const box = $('#pv-body');
    if (box) box.innerHTML = '<div class="skel" style="height:84px"></div><div class="skel" style="height:84px"></div>';
    try {
      const d = await api('/api/v1/providers?capability=' + cap);
      provs = (d && d.providers) || [];
    } catch (e) { provs = []; if (alive && box) box.innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
    if (alive) renderList();
  }

  function renderList() {
    const box = $('#pv-body');
    if (!box) return;
    box.innerHTML = '';
    if (!provs.length) { box.innerHTML = '<div class="empty">该类别暂无提供方</div>'; return; }
    for (const p of provs) {
      const testBtn = el('button', {
        class: 'btn btn--ghost btn--sm', style: 'flex:none',
        onclick: async () => {
          testBtn.disabled = true; testBtn.textContent = '测试中…';
          try {
            const r = await api('/api/v1/providers/test', { method: 'POST', body: { provider_id: p.id }, timeoutMs: 30000 });
            toast((r && r.status === 'ok') || !r?.error ? '连接正常' : '失败:' + (r.error || ''), r && r.error ? 'err' : 'ok');
          } catch (e) { toast(e.message, 'err'); }
          testBtn.disabled = false; testBtn.textContent = '测试';
        },
      }, '测试');
      box.append(el('div', { class: 'card plugin' },
        el('div', { class: 'plugin__icon' }, (p.id || '?')[0].toUpperCase()),
        el('div', { class: 'plugin__meta' },
          el('div', { class: 'plugin__name' }, p.id || p.provider || '未命名',
            p.enable === false ? el('span', { class: 'tag' }, '停用') : null),
          el('div', { class: 'plugin__desc' }, p.model || ''),
          el('div', { class: 'plugin__ver' }, (p.api_base || '').replace(/^https?:\/\//, '').slice(0, 40) || p.provider_type || '')),
        el('div', { style: 'display:flex;align-items:center;gap:10px;flex:none' },
          el('label', { class: 'switch' },
            el('input', {
              type: 'checkbox', checked: p.enable !== false ? '' : null,
              onchange: async e => {
                const on = e.target.checked;
                try { await api('/api/v1/providers/enabled', { method: 'PATCH', body: { provider_id: p.id, enabled: on } }); p.enable = on; toast(on ? '已启用' : '已停用', 'ok'); }
                catch (err) { e.target.checked = !on; toast(err.message, 'err'); }
              },
            }),
            el('i')),
          testBtn)));
    }
  }

  Pages.providers = {
    mount() {
      alive = true;
      $('#page-providers').innerHTML = `
        ${subHead('模型提供方', 'LLM / 语音 / 嵌入服务接入')}
        <div class="page__body">
          <div class="cf-chips" id="pv-caps" style="margin:0 2px 4px"></div>
          <div id="pv-body" style="display:flex;flex-direction:column;gap:12px"></div>
        </div>`;
      const bar = $('#pv-caps');
      for (const [key, name] of CAPS) {
        bar.append(el('button', {
          class: 'cf-chip' + (key === cap ? ' on' : ''), 'data-c': key,
          onclick: () => {
            cap = key;
            $$('#pv-caps .cf-chip').forEach(c => c.classList.toggle('on', c.dataset.c === key));
            load();
          },
        }, name));
      }
      load();
    },
    unmount() { alive = false; $('#page-providers').innerHTML = ''; },
  };
})();

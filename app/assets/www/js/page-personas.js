/* page-personas.js — 人格管理:列表/新建/编辑/删除(persona_id 即显示名) */
'use strict';

(() => {
  let alive = false;
  let list = [];

  async function load() {
    const box = $('#ps-body');
    try {
      list = (await api('/api/v1/personas')) || [];
    } catch (e) { list = []; if (alive && box) box.innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
    if (alive) renderList();
  }

  function renderList() {
    const box = $('#ps-body');
    if (!box) return;
    box.innerHTML = '';
    if (!list.length) { box.innerHTML = '<div class="empty">还没有人格,点右上角新建</div>'; return; }
    list.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    for (const p of list) {
      box.append(el('div', { class: 'card', style: 'cursor:pointer', onclick: () => editSheet(p) },
        el('div', { class: 'plugin__name', style: 'margin-bottom:3px' }, p.persona_id,
          el('span', { class: 'tag' }, '点击编辑')),
        el('div', { class: 'plugin__desc', style: 'white-space:normal;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden' },
          (p.system_prompt || '').slice(0, 120) || '(空提示词)'),
        el('div', { class: 'plugin__ver' }, p.updated_at ? '更新于 ' + fmt.rel(Date.parse(p.updated_at) / 1000 || Date.now() / 1000) : '')));
    }
  }

  function editSheet(p) {
    openSheet(close => {
      const name = el('div', { class: 'sheet__title' }, p.persona_id);
      const ta = el('textarea', { class: 'cfg__input', rows: 7, spellcheck: 'false', style: 'width:100%;text-align:left' });
      ta.value = p.system_prompt || '';
      return [
        name,
        el('div', { class: 'cf-field__hint', style: 'margin:2px 0 10px' }, '系统提示词:定义这个人设的性格、语气和行为'),
        ta,
        el('div', { class: 'sheet__actions' },
          el('button', {
            class: 'btn btn--primary btn--block', onclick: async () => {
              try {
                await api('/api/v1/personas/by-id?persona_id=' + encodeURIComponent(p.persona_id), { method: 'PUT', body: { persona_id: p.persona_id, system_prompt: ta.value } });
                p.system_prompt = ta.value;
                toast('已保存', 'ok');
                close(); renderList();
              } catch (e) { toast(e.message, 'err'); }
            },
          }, '保存'),
          el('button', {
            class: 'btn btn--danger btn--block', onclick: async () => {
              close();
              if (!await confirmModal({ title: '删除人格', text: `确定删除「${p.persona_id}」?正在使用它的会话会回退默认。`, okText: '删除', danger: true })) return;
              try {
                await api('/api/v1/personas/by-id?persona_id=' + encodeURIComponent(p.persona_id), { method: 'DELETE' });
                list = list.filter(x => x.persona_id !== p.persona_id);
                toast('已删除', 'ok'); renderList();
              } catch (e) { toast(e.message, 'err'); }
            },
          }, '删除人格')),
      ];
    });
  }

  function createSheet() {
    openSheet(close => {
      const nameI = el('input', { class: 'cfg__input', placeholder: '人格名字,如:小星', style: 'width:100%;text-align:left;font-family:var(--font-body);font-size:15px' });
      const ta = el('textarea', { class: 'cfg__input', rows: 6, spellcheck: 'false', placeholder: '系统提示词:你是……', style: 'width:100%;text-align:left' });
      return [
        el('div', { class: 'sheet__title' }, '新建人格'),
        nameI, ta,
        el('div', { class: 'sheet__actions' },
          el('button', {
            class: 'btn btn--primary btn--block', onclick: async () => {
              const name = nameI.value.trim(), prompt = ta.value.trim();
              if (!name || !prompt) { toast('名字和提示词都要填', 'err'); return; }
              try {
                await api('/api/v1/personas', { method: 'POST', body: { persona_id: name, system_prompt: prompt } });
                toast('已创建 ' + name, 'ok');
                close(); load();
              } catch (e) { toast(e.message, 'err'); }
            },
          }, '创建')),
      ];
    });
  }

  Pages.personas = {
    mount() {
      alive = true;
      $('#page-personas').innerHTML = `
        ${subHead('人格设定', '管理机器人的人设角色')}
        <div class="page__body">
          <div id="ps-body" style="display:flex;flex-direction:column;gap:12px">
            <div class="skel" style="height:88px"></div><div class="skel" style="height:88px"></div>
          </div>
        </div>`;
      // 右上新建按钮
      $('.page__head', $('#page-personas')).append(el('button', { class: 'btn btn--primary btn--sm', onclick: createSheet }, '+ 新建'));
      load();
    },
    unmount() { alive = false; $('#page-personas').innerHTML = ''; },
  };
})();

/* page-cron.js — 定时任务:列表/新建/启停/立即运行/删除(prompt=note,session=UMO) */
'use strict';

(() => {
  let alive = false;
  let jobs = [];

  const CRON_PRESETS = [
    ['0 9 * * *', '每天 9:00'],
    ['0 22 * * *', '每天 22:00'],
    ['30 12 * * 1', '每周一 12:30'],
    ['0 */2 * * *', '每 2 小时'],
  ];

  function cronHuman(expr) {
    const hit = CRON_PRESETS.find(p => p[0] === expr);
    if (hit) return hit[1];
    return expr;
  }

  async function load() {
    const box = $('#cr-body');
    try {
      jobs = (await api('/api/v1/cron/jobs')) || [];
    } catch (e) { jobs = []; if (alive && box) box.innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
    if (alive) renderList();
  }

  function renderList() {
    const box = $('#cr-body');
    if (!box) return;
    box.innerHTML = '';
    if (!jobs.length) { box.innerHTML = '<div class="empty">还没有定时任务,点右上角新建</div>'; return; }
    for (const j of jobs) {
      const session = (j.payload && j.payload.session) || '';
      const note = (j.payload && j.payload.note) || j.note || j.description || '';
      const next = j.next_run_time ? new Date(j.next_run_time) : null;
      box.append(el('div', { class: 'card' },
        el('div', { class: 'plugin__name', style: 'margin-bottom:4px' }, j.name || '未命名',
          el('span', { class: 'tag' }, cronHuman(j.cron_expression || (j.run_once ? '单次' : '?')))),
        note ? el('div', { class: 'plugin__desc', style: 'white-space:normal' }, note) : null,
        el('div', { class: 'plugin__ver' },
          (session ? session + ' · ' : '') + (next ? '下次 ' + fmt.rel(next.getTime() / 1000) : '')
          + (j.last_error ? ' · ⚠ ' + esc(String(j.last_error).slice(0, 40)) : '')),
        el('div', { style: 'display:flex;align-items:center;gap:14px;margin-top:10px' },
          el('label', { class: 'switch' },
            el('input', {
              type: 'checkbox', checked: j.enabled !== false ? '' : null,
              onchange: async e => {
                const on = e.target.checked;
                try { await api('/api/v1/cron/jobs/' + encodeURIComponent(j.job_id), { method: 'PATCH', body: { enabled: on } }); toast(on ? '已启用' : '已停用', 'ok'); j.enabled = on; }
                catch (err) { e.target.checked = !on; toast(err.message, 'err'); }
              },
            }),
            el('i')),
          el('button', {
            class: 'btn btn--ghost btn--sm', onclick: async () => {
              toast('已触发运行');
              try { await api('/api/v1/cron/jobs/' + encodeURIComponent(j.job_id) + '/run', { method: 'POST' }); } catch (e) { toast(e.message, 'err'); }
            },
          }, '▶ 立即运行'),
          el('button', {
            class: 'btn btn--sm', style: 'background:rgba(255,59,48,.1);color:var(--red)', onclick: async () => {
              if (!await confirmModal({ title: '删除任务', text: `删除「${j.name}」?`, okText: '删除', danger: true })) return;
              try {
                await api('/api/v1/cron/jobs/' + encodeURIComponent(j.job_id), { method: 'DELETE' });
                jobs = jobs.filter(x => x.job_id !== j.job_id);
                toast('已删除', 'ok'); renderList();
              } catch (e) { toast(e.message, 'err'); }
            },
          }, '删除'))));
    }
  }

  function createSheet() {
    openSheet(close => {
      const nameI = el('input', { class: 'cfg__input', placeholder: '任务名,如:每晚报时', style: 'width:100%;text-align:left;font-family:var(--font-body);font-size:15px' });
      const ta = el('textarea', { class: 'cfg__input', rows: 4, spellcheck: 'false', placeholder: '到点后发给机器人的提示词,如:向大家道晚安', style: 'width:100%;text-align:left' });
      const cronI = el('input', { class: 'cfg__input', value: '0 9 * * *', spellcheck: 'false', style: 'width:100%;text-align:left' });
      const sessI = el('input', { class: 'cfg__input', placeholder: '会话 UMO,如 webchat:webchat(留空=仅内部触发)', spellcheck: 'false', style: 'width:100%;text-align:left;font-family:var(--font-body);font-size:14px' });
      const presets = el('div', { style: 'display:flex;gap:8px;flex-wrap:wrap;margin:6px 0 2px' },
        CRON_PRESETS.map(p => el('button', {
          class: 'cf-chip', style: 'font-size:12px;padding:5px 11px',
          onclick: () => { cronI.value = p[0]; },
        }, p[1])));
      return [
        el('div', { class: 'sheet__title' }, '新建定时任务'),
        el('div', { class: 'field' }, el('span', { class: 'field__label' }, '任务名'), nameI),
        el('div', { class: 'field' }, el('span', { class: 'field__label' }, '提示词(触发时发送给机器人)'), ta),
        el('div', { class: 'field' }, el('span', { class: 'field__label' }, 'Cron 表达式'), presets, cronI),
        el('div', { class: 'field' }, el('span', { class: 'field__label' }, '投递会话(可选)'), sessI),
        el('div', { class: 'sheet__actions' },
          el('button', {
            class: 'btn btn--primary btn--block', onclick: async () => {
              const name = nameI.value.trim() || '定时任务';
              const note = ta.value.trim();
              const cron = cronI.value.trim();
              if (!note) { toast('请填写提示词', 'err'); return; }
              if (!cron) { toast('请填写 cron 表达式', 'err'); return; }
              try {
                await api('/api/v1/cron/jobs', {
                  method: 'POST',
                  body: {
                    name, note, cron_expression: cron,
                    run_once: false, enabled: true,
                    session: sessI.value.trim(),
                    timezone: 'Asia/Shanghai',
                  },
                });
                toast('已创建 ' + name, 'ok');
                close(); load();
              } catch (e) { toast(e.message, 'err'); }
            },
          }, '创建')),
      ];
    });
  }

  Pages.cron = {
    mount() {
      alive = true;
      $('#page-cron').innerHTML = `
        ${subHead('定时任务', '让机器人按计划自动执行')}
        <div class="page__body">
          <div id="cr-body" style="display:flex;flex-direction:column;gap:12px">
            <div class="skel" style="height:110px"></div>
          </div>
        </div>`;
      $('.page__head', $('#page-cron')).append(el('button', { class: 'btn btn--primary btn--sm', onclick: createSheet }, '+ 新建'));
      load();
    },
    unmount() { alive = false; $('#page-cron').innerHTML = ''; },
  };
})();

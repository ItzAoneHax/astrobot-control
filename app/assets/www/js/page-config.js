/* page-config.js — 配置文件:官方元数据驱动的表单(组→小节→字段,中文名称与提示)
   数据结构:AstrBot CONFIG_METADATA_3 → {group: {name, metadata: {section: {description, hint, items: {字段键: {type, options, ...}}}}}}
   字段键即配置点路径(如 provider_settings.enable),读写用点路径下钻。 */
'use strict';

(() => {
  let alive = false;
  let profiles = [];
  let curId = 'default';
  let cfg = null;
  let metadata = null;      // 官方元数据(i18n 键)
  let dirty = false;
  let activeGroup = 'all';  // 组过滤
  let kw = '';
  let showAdvanced = false;

  /* ── i18n:官方翻译表下钻,未命中回退到键尾段 ── */
  function lookup(key) {
    if (!key || typeof key !== 'string' || !window.CONFIG_I18N) return undefined;
    let cur = CONFIG_I18N;
    for (const seg of key.split('.')) {
      if (cur == null || typeof cur !== 'object' || !(seg in cur)) return undefined;
      cur = cur[seg];
    }
    return typeof cur === 'string' || Array.isArray(cur) ? cur : undefined;
  }
  function tr(v, fallback) {
    const hit = lookup(v);
    if (hit !== undefined && typeof hit === 'string') return hit;
    if (typeof v === 'string' && /^[a-z0-9_]+(\.[a-z0-9_]+)+\.(description|hint|name)$/i.test(v)) {
      const segs = v.split('.');
      return segs[segs.length - 2] || fallback || v;
    }
    return v !== undefined && v !== null && v !== '' ? v : (fallback || v);
  }
  function trLabels(meta) {
    const hit = lookup(meta.labels);
    if (Array.isArray(hit)) return hit;
    if (Array.isArray(meta.labels)) return meta.labels;
    return null;
  }

  /* ── 点路径读写 ── */
  function getByPath(obj, selector) {
    let cur = obj;
    for (const k of String(selector).split('.')) {
      if (cur == null || typeof cur !== 'object') return undefined;
      cur = cur[k];
    }
    return cur;
  }
  function setByPath(obj, selector, value) {
    const segs = String(selector).split('.');
    let cur = obj;
    for (let i = 0; i < segs.length - 1; i++) {
      if (cur[segs[i]] == null || typeof cur[segs[i]] !== 'object') cur[segs[i]] = {};
      cur = cur[segs[i]];
    }
    cur[segs[segs.length - 1]] = value;
  }

  const GROUP_ORDER = ['ai_group', 'plugin_group', 'platform_group', 'ext_group'];
  const GROUP_ICONS = { ai_group: '✦', plugin_group: '⊕', platform_group: '◉', ext_group: '⚙', system_group: '⚙' };

  /* _special 字段:从接口拉候选(模型/人格/知识库),官方同款联动 */
  const SPECIAL_SOURCES = {
    select_provider: '/api/v1/providers?capability=chat',
    select_provider_stt: '/api/v1/providers?capability=stt',
    select_provider_tts: '/api/v1/providers?capability=tts',
    select_persona: '/api/v1/personas',
    select_knowledgebase: '/api/v1/knowledge-bases',
  };
  const specialCache = {};
  function specialOptions(sp) {
    if (!SPECIAL_SOURCES[sp]) return Promise.resolve(null);
    if (!specialCache[sp]) {
      specialCache[sp] = api(SPECIAL_SOURCES[sp])
        .then(d => {
          const arr = (d && (d.providers || d.personas || d.knowledge_bases)) || (Array.isArray(d) ? d : []);
          return arr.map(x => x.id || x.persona_id || x.name).filter(Boolean);
        })
        .catch(() => null);
    }
    return specialCache[sp];
  }

  function groups() {
    if (!metadata) return [];
    const keys = Object.keys(metadata).sort((a, b) => {
      const ia = GROUP_ORDER.indexOf(a), ib = GROUP_ORDER.indexOf(b);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });
    return keys.map(k => ({ key: k, name: tr(metadata[k].name, k), meta: metadata[k].metadata || {} }));
  }

  function matchCond(cond) {
    if (!cond) return true;
    for (const [k, want] of Object.entries(cond)) {
      if (JSON.stringify(getByPath(cfg, k)) !== JSON.stringify(want)) return false;
    }
    return true;
  }
  function fieldHit(itemKey, m) {
    if (!kw) return true;
    const name = tr(m.description, '');
    return itemKey.toLowerCase().includes(kw) || String(name).toLowerCase().includes(kw) || String(m.hint && tr(m.hint) || '').toLowerCase().includes(kw);
  }

  function markDirty() {
    dirty = true;
    const b = $('#cf-save');
    if (b) b.disabled = false;
  }

  /* ── 控件 ── */
  function secretInput(val, set, isSecret) {
    const input = el('input', {
      class: 'cfg__input cf-field__input', type: isSecret ? 'password' : 'text',
      value: val == null ? '' : String(val), spellcheck: 'false', autocomplete: 'off',
    });
    input.addEventListener('change', () => { set(input.value); markDirty(); });
    return input;
  }

  function selectSheet(itemKey, m, cur, set) {
    const labels = trLabels(m);
    const opts = m.options || [];
    openSheet(close => [
      el('div', { class: 'sheet__title' }, tr(m.description, itemKey)),
      el('div', null, opts.map((o, i) => el('div', {
        class: 'sess', style: 'cursor:pointer',
        onclick: () => { set(o); markDirty(); close(); rerender(); },
      },
        el('div', { class: 'sess__icon' }, String(o)[0].toUpperCase()),
        el('div', { class: 'sess__meta', style: 'text-align:left' },
          el('div', { class: 'sess__name' }, (labels && labels[i]) || o)),
        el('span', { class: 'cell__val' }, o === cur ? '✓' : '')))),
    ]);
  }

  function listSheet(itemKey, m, arr, set) {
    arr = Array.isArray(arr) ? arr.slice() : [];
    openSheet(close => {
      const list = el('div');
      const paint = () => {
        list.innerHTML = '';
        arr.forEach((v, i) => {
          const input = el('input', { class: 'cfg__input', value: String(v ?? ''), style: 'flex:1' });
          input.addEventListener('change', () => { arr[i] = castLike(v, input.value); });
          list.append(el('div', { class: 'cf-kv-row' }, input,
            el('button', { class: 'cfg__del', onclick: () => { arr.splice(i, 1); paint(); } }, '−')));
        });
        list.append(el('button', {
          class: 'cfg__add', onclick: () => {
            const t = (m.items && m.items.type) || 'string';
            arr.push(t === 'int' || t === 'float' ? 0 : t === 'bool' ? false : '');
            paint();
          },
        }, '+ 添加一项'));
      };
      paint();
      return [
        el('div', { class: 'sheet__title' }, tr(m.description, itemKey)),
        list,
        el('div', { class: 'sheet__actions' },
          el('button', { class: 'btn btn--primary btn--block', onclick: () => { set(arr); markDirty(); close(); rerender(); } }, '完成')),
      ];
    });
  }

  function dictSheet(itemKey, m, obj, set) {
    obj = { ...(obj || {}) };
    openSheet(close => {
      const list = el('div');
      const paint = () => {
        list.innerHTML = '';
        for (const [k, v] of Object.entries(obj)) {
          const ki = el('input', { class: 'cfg__input', value: k, placeholder: '键', style: 'flex:1;min-width:80px' });
          const vi = el('input', { class: 'cfg__input', value: String(v ?? ''), placeholder: '值', style: 'flex:1.4' });
          const oldK = k;
          vi.addEventListener('change', () => { obj[oldK] = castLike(v, vi.value); });
          ki.addEventListener('change', () => { const nv = {}; for (const [a, b] of Object.entries(obj)) nv[a === oldK ? ki.value : a] = b; obj = nv; paint(); });
          list.append(el('div', { class: 'cf-kv-row' }, ki, vi,
            el('button', { class: 'cfg__del', onclick: () => { delete obj[oldK]; paint(); } }, '−')));
        }
        list.append(el('button', { class: 'cfg__add', onclick: () => { obj['新键'] = ''; paint(); } }, '+ 添加键值对'));
      };
      paint();
      return [
        el('div', { class: 'sheet__title' }, tr(m.description, itemKey)),
        list,
        el('div', { class: 'sheet__actions' },
          el('button', { class: 'btn btn--primary btn--block', onclick: () => { set(obj); markDirty(); close(); rerender(); } }, '完成')),
      ];
    });
  }

  function castLike(sample, s) {
    if (typeof sample === 'number') { const n = parseFloat(s); return isNaN(n) ? sample : n; }
    if (typeof sample === 'boolean') return s === 'true' || s === true;
    return s;
  }

  /* 特殊:切换 agent runner 时重置其 config(官方行为) */
  function onRunnerTypeChange(m, val) {
    if (m.runner_defaults && val in m.runner_defaults) {
      cfg.agent_runner = cfg.agent_runner || {};
      cfg.agent_runner.config = JSON.parse(JSON.stringify(m.runner_defaults[val]));
      toast('已切换执行方式并载入默认配置', 'ok');
    }
  }

  /* ── 单个字段行 ── */
  function fieldRow(itemKey, m) {
    const get = () => getByPath(cfg, itemKey);
    const set = v => { setByPath(cfg, itemKey, v); };

    const nameRow = el('div', { class: 'cf-field__name' },
      tr(m.description, itemKey),
      m.show_key ? el('span', { class: 'cf-field__key' }, itemKey) : null,
      m.secret ? el('span', { class: 'cf-field__key' }, '· 密钥') : null);
    const hint = m.hint ? el('div', { class: 'cf-field__hint' }, (m.obvious_hint ? '‼️ ' : '') + tr(m.hint)) : null;

    let ctrl;
    const t = m.type;
    if (m._special && m.options && m._special === 'agent_runner_type') {
      const cur = get();
      const labels0 = trLabels(m);
      const idx0 = m.options.indexOf(cur);
      ctrl = valueButton(idx0 >= 0 && labels0 ? labels0[idx0] : cur, () => selectSheet(itemKey, m, cur, v => { onRunnerTypeChange(m, v); set(v); }));
    } else if (m._special && SPECIAL_SOURCES[m._special]) {
      const cur = get();
      ctrl = valueButton(cur || '未设置', () => {
        specialOptions(m._special).then(list => {
          if (!list || !list.length) { toast('无法获取候选列表'); return; }
          selectSheet(itemKey, { description: m.description, hint: m.hint, options: list }, cur, set);
        });
      });
    } else if (Array.isArray(m.options) && t === 'string') {
      const cur = get();
      const labels = trLabels(m);
      const idx = m.options.indexOf(cur);
      ctrl = valueButton(idx >= 0 && labels ? labels[idx] : cur, () => selectSheet(itemKey, m, cur, set));
    } else if (t === 'bool') {
      ctrl = el('label', { class: 'switch' },
        el('input', { type: 'checkbox', checked: get() ? '' : null, onchange: e => { set(e.target.checked); markDirty(); rerender(); } }),
        el('i'));
    } else if (t === 'int' || t === 'float') {
      const input = el('input', { class: 'cfg__input cf-field__input', type: 'number', inputmode: 'decimal', value: String(get() ?? '') });
      input.addEventListener('change', () => {
        let v = parseFloat(input.value);
        if (!isNaN(v)) {
          if (m.slider) v = Math.min(m.slider.max, Math.max(m.slider.min, v));
          set(v); markDirty();
        }
      });
      ctrl = el('div', { class: 'cf-num' },
        m.slider ? el('span', { class: 'cf-field__hint', style: 'flex:none' }, `${m.slider.min}–${m.slider.max}`) : null,
        input);
    } else if (t === 'text') {
      const ta = el('textarea', { class: 'cfg__input cf-field__ta', rows: 3, spellcheck: 'false' });
      ta.value = String(get() ?? '');
      ta.addEventListener('change', () => { set(ta.value); markDirty(); });
      ctrl = ta;
    } else if (t === 'list') {
      const arr = get();
      ctrl = valueButton(`${Array.isArray(arr) ? arr.length : 0} 项 ${m.secret ? '·••' : ''}`, () => listSheet(itemKey, m, arr, set));
    } else if (t === 'dict' || t === 'object') {
      const o = get();
      ctrl = valueButton(`${o && typeof o === 'object' ? Object.keys(o).length : 0} 键`, () => dictSheet(itemKey, m, o, set));
    } else if (Array.isArray(m.options)) {
      const cur = get();
      ctrl = valueButton(cur, () => selectSheet(itemKey, m, cur, set));
    } else {
      ctrl = secretInput(get(), set, m.secret);
    }

    const inline = t === 'bool' || ctrl.classList.contains('cf-val-btn');
    const row = el('div', { class: 'cf-field' + (inline ? ' cf-field--inline' : '') },
      el('div', { class: 'cf-field__head' }, nameRow, hint),
      ctrl);
    return row;
  }

  function valueButton(text, onclick) {
    const b = el('button', { class: 'cf-val-btn', onclick }, text, el('span', { class: 'cf-val-btn__chev' }, '›'));
    return b;
  }

  /* ── 小节卡片 ── */
  function sectionCard(secKey, secMeta) {
    const items = secMeta.items || {};
    const visible = [], collapsedItems = [];
    for (const [k, m] of Object.entries(items)) {
      if (m.invisible || !matchCond(m.condition) || !fieldHit(k, m)) continue;
      (m.collapsed ? collapsedItems : visible).push([k, m]);
    }
    if (!visible.length && !collapsedItems.length) return null;

    const card = el('div', { class: 'card cf-sec' });
    const head = el('div', { class: 'cf-sec__head' },
      el('div', { class: 'cf-sec__title' }, tr(secMeta.description, secKey)),
      secMeta.hint ? el('div', { class: 'cf-field__hint' }, tr(secMeta.hint)) : null);
    card.append(head);
    visible.forEach(([k, m]) => card.append(fieldRow(k, m)));

    if (collapsedItems.length) {
      let open = false;
      const box = el('div', { class: 'cf-more-box', style: 'display:none' });
      collapsedItems.forEach(([k, m]) => box.append(fieldRow(k, m)));
      const btn = el('button', {
        class: 'cf-more', onclick: () => { open = !open; box.style.display = open ? '' : 'none'; btn.textContent = open ? '收起更多配置' : `更多配置(${collapsedItems.length})`; },
      }, `更多配置(${collapsedItems.length})`);
      card.append(btn, box);
    }
    return card;
  }

  /* ── 主体 ── */
  function renderBody() {
    const box = $('#cf-body');
    if (!box || !cfg) return;
    box.innerHTML = '';
    if (!metadata) {
      box.append(el('div', { class: 'empty' }, '此配置无表单元数据,请使用下方原始配置'));
      return;
    }
    let shownGroups = 0;
    for (const g of groups()) {
      if (activeGroup !== 'all' && activeGroup !== g.key) continue;
      const secs = [];
      for (const [sk, sm] of Object.entries(g.meta)) {
        if (!kw && sm.condition && !matchCond(sm.condition)) continue;
        const c = sectionCard(sk, sm);
        if (c) secs.push(c);
      }
      if (!secs.length) continue;
      shownGroups++;
      box.append(el('div', { class: 'cf-group-title' }, `${GROUP_ICONS[g.key] || '⚙'} ${g.name}`));
      secs.forEach(c => box.append(c));
    }
    if (kw && !shownGroups) box.innerHTML = `<div class="empty">没有匹配 "${esc(kw)}" 的配置项</div>`;
  }

  function renderChips() {
    const bar = $('#cf-chips');
    if (!bar) return;
    bar.innerHTML = '';
    const mk = (key, name) => {
      const c = el('button', { class: 'cf-chip' + (activeGroup === key ? ' on' : ''), onclick: () => { activeGroup = key; renderChips(); renderBody(); } }, name);
      return c;
    };
    bar.append(mk('all', '全部'));
    for (const g of groups()) bar.append(mk(g.key, g.name));
  }

  function renderHead() {
    const nameEl = $('#cf-profile-name');
    if (!nameEl) return;
    const p = profiles.find(x => x.id === curId);
    nameEl.textContent = p ? (p.name || p.id) : curId;
    const save = $('#cf-save');
    if (save) save.disabled = !dirty;
  }

  function rerender() {
    if (!alive) return;
    renderBody();
    renderHead();
  }

  function render() {
    $('#page-config').innerHTML = `
      <div class="page__head">
        <div>
          <div class="page__title">配置文件</div>
          <button class="page__sub cf-profile-btn" id="cf-profile-btn">
            <span id="cf-profile-name">…</span>
            <span style="color:var(--blue)">切换 ›</span>
          </button>
        </div>
        <button class="btn btn--primary btn--sm" id="cf-save" disabled>保存</button>
      </div>
      <div class="page__body">
        <div class="searchbar">
          <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M16 16l4.5 4.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
          <input id="cf-search" placeholder="搜索配置项(名称/键/提示)" autocomplete="off">
        </div>
        <div class="cf-chips" id="cf-chips"></div>
        ${curId === 'default' ? `<p class="cf-note">默认配置的 provider / platform 由服务端统一管理,改动这两块不会生效。</p>` : ''}
        <div id="cf-body" style="display:flex;flex-direction:column;gap:14px"></div>

        <div class="cf-adv-head" id="cf-adv-head">
          <span>高级 · 原始配置树</span>
          <span style="color:var(--label3)">${showAdvanced ? '收起 ›' : '展开 ›'}</span>
        </div>
        <div id="cf-adv" style="display:${showAdvanced ? 'flex' : 'none'};flex-direction:column;gap:12px"></div>
        <button class="btn btn--ghost btn--block" id="cf-raw">编辑原始 JSON</button>
      </div>`;
    $('#cf-profile-btn').onclick = openProfileSheet;
    $('#cf-search').addEventListener('input', e => { kw = e.target.value.trim().toLowerCase(); renderBody(); });
    $('#cf-save').onclick = save;
    $('#cf-raw').onclick = openRawEditor;
    $('#cf-adv-head').onclick = () => {
      showAdvanced = !showAdvanced;
      $('#cf-adv').style.display = showAdvanced ? 'flex' : 'none';
      $('#cf-adv-head').querySelector('span:last-child').textContent = showAdvanced ? '收起 ›' : '展开 ›';
      if (showAdvanced) renderAdvanced();
    };
    renderChips();
    renderHead();
  }

  /* 原始配置树(高级):metadata 已覆盖的顶层键不重复展示 */
  function renderAdvanced() {
    const box = $('#cf-adv');
    if (!box || !cfg) return;
    box.innerHTML = '';
    const covered = new Set();
    if (metadata) {
      for (const g of Object.values(metadata)) {
        for (const sm of Object.values(g.metadata || {})) {
          for (const k of Object.keys(sm.items || {})) covered.add(k.split('.')[0]);
        }
      }
    }
    for (const [k, v] of Object.entries(cfg)) {
      if (covered.has(k)) continue;
      const node = advancedNode(k, () => cfg[k]);
      if (node) box.append(node);
    }
    if (!box.children.length) box.innerHTML = '<div class="empty">所有配置项都已在上方表单中</div>';
  }

  /* 简化树(递归只读结构的行内编辑,复用字段行风格) */
  function advancedNode(key, live) {
    const v = live();
    if (v === null || typeof v !== 'object') {
      return el('div', { class: 'card cfg__root-row' }, primitiveAdvRow(key, v, vv => { cfg[key] = vv; }));
    }
    return advancedGroup(key, live, false);
  }
  function primitiveAdvRow(key, val, set) {
    const row = el('div', { class: 'cf-field cf-field--inline' });
    row.append(el('div', { class: 'cf-field__head' }, el('div', { class: 'cf-field__name cf-field__key' }, key)));
    if (typeof val === 'boolean') {
      row.append(el('label', { class: 'switch' },
        el('input', { type: 'checkbox', checked: val ? '' : null, onchange: e => { set(e.target.checked); markDirty(); } }), el('i')));
    } else {
      const input = el('input', { class: 'cfg__input', value: String(val ?? ''), style: 'max-width:170px' });
      input.addEventListener('change', () => { set(castLike(val, input.value)); markDirty(); });
      row.append(input);
    }
    return row;
  }
  function advancedGroup(key, live, compact) {
    const val = live();
    const isArr = Array.isArray(val);
    const wrap = el('div', { class: 'cfg__group' + (compact ? ' cfg__group--sub' : '') });
    const body = el('div', { class: 'cfg__group-body', style: 'display:none' });
    const paint = () => {
      body.innerHTML = '';
      const cur = live();
      if (isArr) {
        cur.forEach((v, i) => {
          if (v !== null && typeof v === 'object') body.append(advancedGroup('#' + (i + 1), () => cur[i], true));
          else body.append(primitiveAdvRow('#' + (i + 1), v, vv => { cur[i] = vv; markDirty(); }));
        });
        body.append(el('button', { class: 'cfg__add', onclick: () => { cur.push(cur.length ? JSON.parse(JSON.stringify(emptyLike(cur[0]))) : ''); paint(); markDirty(); } }, '+ 添加一项'));
      } else {
        for (const [k, v] of Object.entries(cur)) {
          if (v !== null && typeof v === 'object') body.append(advancedGroup(k, () => cur[k], true));
          else body.append(primitiveAdvRow(k, v, vv => { cur[k] = vv; markDirty(); }));
        }
      }
    };
    const head = el('div', {
      class: 'cfg__group-head',
      onclick: () => { const open = body.style.display !== 'none'; body.style.display = open ? 'none' : ''; head.classList.toggle('open', !open); },
    },
      el('span', { class: 'cfg__chev' }, '›'),
      el('span', { class: 'cfg__key cfg__key--group' }, key),
      el('span', { class: 'cfg__badge' }, isArr ? val.length + ' 条' : Object.keys(val).length + ' 项'));
    paint();
    wrap.append(head, body);
    return wrap;
  }
  function emptyLike(sample) {
    if (Array.isArray(sample)) return sample.map(x => emptyLike(x));
    if (sample !== null && typeof sample === 'object') { const o = {}; for (const k of Object.keys(sample)) o[k] = emptyLike(sample[k]); return o; }
    return sample;
  }

  /* ── 加载 ── */
  async function loadProfile(id) {
    const paintSkeleton = () => { const b = $('#cf-body'); if (b) b.innerHTML = '<div class="skel" style="height:64px"></div><div class="skel" style="height:140px"></div><div class="skel" style="height:200px"></div>'; };
    paintSkeleton();
    try {
      const d = await api('/api/v1/config-profiles/' + encodeURIComponent(id));
      if (!alive) return;
      cfg = d.config || {};
      metadata = d.metadata || null;
      dirty = false;
      render();
      renderBody();
    } catch (e) {
      if (!alive) return;
      const b = $('#cf-body');
      if (b) b.innerHTML = `<div class="empty">${esc(e.message || '加载失败')}</div>`;
      toast(e.message, 'err');
    }
  }

  async function loadList(selectId) {
    try {
      const d = await api('/api/v1/config-profiles');
      profiles = (d && d.info_list) || [];
    } catch (e) { profiles = []; toast(e.message, 'err'); }
    if (!profiles.find(x => x.id === 'default')) profiles.push({ id: 'default', name: 'default', path: '' });
    if (selectId) curId = selectId;
    await loadProfile(curId);
  }

  /* ── 保存 ── */
  async function save() {
    if (!dirty || !cfg) return;
    const p = profiles.find(x => x.id === curId);
    if (!await confirmModal({ title: '保存配置', text: `将整体写回「${(p && p.name) || curId}」,保存后立即生效。`, okText: '保存' })) return;
    const btn = $('#cf-save');
    btn.disabled = true; btn.textContent = '保存中…';
    try {
      const r = await api('/api/v1/config-profiles/' + encodeURIComponent(curId), {
        method: 'PUT', body: JSON.parse(JSON.stringify(cfg)), raw: true,
      });
      dirty = false;
      toast((r && r.message) || '保存成功', 'ok');
    } catch (e) { toast(e.message || '保存失败', 'err'); }
    btn.textContent = '保存';
    renderHead();
  }

  /* ── Profile 抽屉 ── */
  function openProfileSheet() {
    openSheet(close => [
      el('div', { class: 'sheet__title' }, '配置文件'),
      el('div', null, profiles.map(p => el('div', {
        class: 'sess', style: 'cursor:pointer',
        onclick: async () => {
          if (p.id === curId) { close(); return; }
          if (dirty && !await confirmModal({ title: '放弃未保存的修改?', text: '切换配置会丢弃当前改动。', okText: '放弃', danger: true })) return;
          close();
          curId = p.id; dirty = false;
          await loadProfile(p.id);
        },
      },
        el('div', { class: 'sess__icon' }, '⚙'),
        el('div', { class: 'sess__meta' },
          el('div', { class: 'sess__name' }, p.name || p.id),
          el('div', { class: 'sess__sub' }, p.id === 'default' ? '默认配置 · 不可删除' : (p.path || p.id))),
        el('span', { class: 'cell__val' }, p.id === curId ? '✓' : '')))),
      el('div', { class: 'sheet__actions' },
        el('button', {
          class: 'btn btn--primary btn--block', onclick: async () => {
            close();
            const name = await promptModal({ title: '新建配置文件', placeholder: '例如:精简配置' });
            if (!name) return;
            try {
              const r = await api('/api/v1/config-profiles', { method: 'POST', body: { name } });
              toast('已创建 ' + name, 'ok');
              await loadList((r && r.conf_id) || 'default');
            } catch (e) { toast(e.message, 'err'); }
          },
        }, '+ 新建配置文件'),
        curId !== 'default' ? el('button', {
          class: 'btn btn--ghost btn--block', onclick: async () => {
            close();
            const p = profiles.find(x => x.id === curId);
            const name = await promptModal({ title: '重命名', value: (p && p.name) || '' });
            if (!name) return;
            try {
              await api('/api/v1/config-profiles/' + encodeURIComponent(curId), { method: 'PATCH', body: { name } });
              toast('已重命名', 'ok');
              await loadList(curId);
            } catch (e) { toast(e.message, 'err'); }
          },
        }, '重命名当前配置') : null,
        curId !== 'default' ? el('button', {
          class: 'btn btn--danger btn--block', onclick: async () => {
            close();
            if (!await confirmModal({ title: '删除配置文件', text: '删除后不可恢复。', okText: '删除', danger: true })) return;
            try {
              await api('/api/v1/config-profiles/' + encodeURIComponent(curId), { method: 'DELETE' });
              toast('已删除', 'ok');
              await loadList('default');
            } catch (e) { toast(e.message, 'err'); }
          },
        }, '删除当前配置') : null),
    ]);
  }

  /* ── 原始 JSON ── */
  function openRawEditor() {
    if (!cfg) return;
    document.querySelectorAll('.cf-raw').forEach(n => n.remove());
    const ta = el('textarea', { class: 'cf-raw__ta', spellcheck: 'false' });
    ta.value = JSON.stringify(cfg, null, 2);
    const wrap = el('div', { class: 'cf-raw' },
      el('div', { class: 'cf-raw__bar' },
        el('button', { class: 'btn btn--ghost btn--sm', onclick: () => wrap.remove() }, '取消'),
        el('span', { class: 'cf-raw__title' }, (profiles.find(x => x.id === curId) || {}).name || curId),
        el('button', {
          class: 'btn btn--primary btn--sm', onclick: () => {
            try {
              cfg = JSON.parse(ta.value);
              metadata = metadata; // 保留
              dirty = true;
              wrap.remove();
              renderHead();
              renderBody();
              if (showAdvanced) renderAdvanced();
              toast('JSON 已应用,记得保存', 'ok');
            } catch (e) { toast('JSON 解析失败:' + e.message, 'err'); }
          },
        }, '应用')),
      ta);
    document.body.append(wrap);
  }

  Pages.config = {
    mount() {
      alive = true;
      activeGroup = 'all'; kw = ''; cfg = null; metadata = null; dirty = false;
      render();
      loadList(curId);
    },
    unmount() {
      alive = false;
      document.querySelectorAll('.cf-raw').forEach(n => n.remove());
      $('#page-config').innerHTML = '';
    },
  };
})();

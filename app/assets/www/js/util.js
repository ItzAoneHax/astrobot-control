/* util.js — 通用工具:DOM、格式化、浮层、Markdown、图表 */
'use strict';

window.Pages = window.Pages || {}; // 页面注册表:必须先于各 page-*.js 创建

const $ = (sel, root) => (root || document).querySelector(sel);
const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

function el(tag, attrs, ...children) {
  const n = document.createElement(tag);
  if (attrs) for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') n.className = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else if (v !== null && v !== undefined) n.setAttribute(k, v);
  }
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    n.append(c.nodeType ? c : document.createTextNode(c));
  }
  return n;
}

/* ── 格式化 ── */
const fmt = {
  num(n) {
    n = Number(n) || 0;
    if (n >= 1e8) return (n / 1e8).toFixed(1).replace(/\.0$/, '') + '亿';
    if (n >= 1e4) return (n / 1e4).toFixed(1).replace(/\.0$/, '') + 'w';
    return n.toLocaleString('en-US');
  },
  hm(ts) {
    const d = new Date(ts * 1000);
    return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  },
  md(ts) {
    const d = new Date(ts * 1000);
    return `${d.getMonth() + 1}月${d.getDate()}日`;
  },
  rel(ts) {
    const s = Date.now() / 1000 - ts;
    if (s < 60) return '刚刚';
    if (s < 3600) return Math.floor(s / 60) + ' 分钟前';
    if (s < 86400) return Math.floor(s / 3600) + ' 小时前';
    if (s < 86400 * 7) return Math.floor(s / 86400) + ' 天前';
    return fmt.md(ts);
  },
  dur(sec) {
    sec = Math.max(0, Math.floor(sec));
    const d = Math.floor(sec / 86400), h = Math.floor(sec % 86400 / 3600), m = Math.floor(sec % 3600 / 60);
    if (d > 0) return { main: d, unit: '天', rest: `${h}时${m}分` };
    if (h > 0) return { main: h, unit: '小时', rest: `${m}分` };
    return { main: m, unit: '分钟', rest: '' };
  },
  bytes(mb) { return mb >= 1024 ? (mb / 1024).toFixed(1) + ' GB' : Math.round(mb) + ' MB'; },
};

function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

/* ── Toast ── */
function toast(msg, type) {
  const t = el('div', { class: 'toast' + (type ? ' toast--' + type : '') }, msg);
  $('#toast-root').append(t);
  setTimeout(() => { t.style.transition = 'opacity .3s'; t.style.opacity = '0'; setTimeout(() => t.remove(), 320); }, 2400);
}

/* 原生热更新检查结果回调(Updater → evaluateJavascript 调用这里,须尽早可用) */
window.onUpdateResult = r => {
  if (!r) return;
  if (r.status === 'downloaded') {
    if (r.manual && window.UpdateBridge) {
      toast(`已更新到 Web v${r.to},正在重载…`, 'ok');
      setTimeout(() => { try { UpdateBridge.apply(); } catch (_) {} }, 700);
    } else {
      toast(`应用已更新到 Web v${r.to},重启后生效`, 'ok');
    }
  } else if (r.status === 'uptodate') {
    if (r.manual) toast(`已是最新(Web v${r.version})`);
  } else if (r.status === 'error' && r.manual) {
    toast('检查更新失败:' + (r.message || '网络异常'), 'err');
  }
};

/* ── 底部抽屉 ── */
function closeSheet() {
  const s = $('#sheet'), m = $('#sheet-mask');
  s.hidden = true; m.hidden = true; s.innerHTML = '';
}
function openSheet(build) {
  const s = $('#sheet'), m = $('#sheet-mask');
  s.innerHTML = '';
  const parts = [].concat(build(() => closeSheet()));
  s.append(el('div', { class: 'sheet__grab' }), ...parts);
  s.hidden = false; m.hidden = false;
  m.onclick = closeSheet;
}

/* ── 模态确认/输入 ── */
function closeModal() { $('#modal').hidden = true; $('#modal').innerHTML = ''; }
function confirmModal({ title, text, okText = '确定', danger = false }) {
  return new Promise(resolve => {
    const box = el('div', { class: 'modal__box' },
      el('div', { class: 'modal__title' }, title),
      text ? el('div', { class: 'modal__text' }, text) : null,
      el('div', { class: 'modal__btns' },
        el('button', { class: 'btn btn--ghost', onclick: () => { closeModal(); resolve(false); } }, '取消'),
        el('button', { class: 'btn ' + (danger ? 'btn--danger' : 'btn--primary'), onclick: () => { closeModal(); resolve(true); } }, okText)));
    const mo = $('#modal');
    mo.innerHTML = ''; mo.append(box); mo.hidden = false;
    mo.onclick = e => { if (e.target === mo) { closeModal(); resolve(false); } };
  });
}
function promptModal({ title, text, value = '', placeholder = '', okText = '保存' }) {
  return new Promise(resolve => {
    const input = el('input', { class: 'field-input', value, placeholder, style: 'width:100%;background:var(--fill2);border:1px solid transparent;border-radius:12px;color:var(--label);font-size:16px;padding:12px 14px;outline:none;font-family:var(--font-body)' });
    const box = el('div', { class: 'modal__box' },
      el('div', { class: 'modal__title' }, title),
      text ? el('div', { class: 'modal__text' }, text) : null,
      el('div', { style: 'margin:0 0 14px' }, input),
      el('div', { class: 'modal__btns', style: 'margin-top:14px' },
        el('button', { class: 'btn btn--ghost', onclick: () => { closeModal(); resolve(null); } }, '取消'),
        el('button', { class: 'btn btn--primary', onclick: () => { const v = input.value.trim(); closeModal(); resolve(v); } }, okText)));
    const mo = $('#modal');
    mo.innerHTML = ''; mo.append(box); mo.hidden = false;
    input.focus();
    mo.onclick = e => { if (e.target === mo) { closeModal(); resolve(null); } };
  });
}

/* ── Markdown 精简渲染(先转义,再白名单标记) ── */
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* Markdown → DOM 节点(el() 会把字符串当纯文本,HTML 必须走这里) */
function mdNode(text) {
  const d = document.createElement('div');
  d.className = 'md';
  d.innerHTML = renderMD(text);
  return d;
}

/* ── 应用偏好 ── */
const prefs = {
  data: null,
  load() {
    try { this.data = JSON.parse(localStorage.getItem('ab_prefs') || '{}'); } catch (_) { this.data = {}; }
    this.data.theme = this.data.theme || 'auto';            // auto | light | dark
    this.data.thinkOpen = this.data.thinkOpen !== false;     // 思考过程默认展开
    this.data.stream = this.data.stream !== false;           // 流式输出
    this.data.dashRefresh = this.data.dashRefresh ?? 60;     // 总览刷新秒数,0=关
    return this.data;
  },
  save() { localStorage.setItem('ab_prefs', JSON.stringify(this.data || {})); },
  get(k) { return (this.data || this.load())[k]; },
  set(k, v) { this.data = this.data || this.load(); this.data[k] = v; this.save(); },
};

function applyTheme() {
  const mode = prefs.get('theme') || 'auto';
  const sysDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const dark = mode === 'dark' || (mode === 'auto' && sysDark);
  document.body.classList.toggle('dark', dark);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = dark ? '#000000' : '#F2F2F7';
  if (window.AndroidBridge && window.AndroidBridge.setDark) {
    try { window.AndroidBridge.setDark(dark); } catch (_) {}
  }
}

function renderMD(src) {
  const codeBlocks = [];
  let text = String(src ?? '');
  // 围栏代码块先摘出
  text = text.replace(/```(\w*)\n?([\s\S]*?)(?:```|$)/g, (_, lang, code) => {
    codeBlocks.push({ lang, code });
    return `\u0000CB${codeBlocks.length - 1}\u0000`;
  });
  text = esc(text);

  const inline = s => s
    .replace(/`([^`\n]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>')
    .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<i>$2</i>')
    .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/\u0000CB(\d+)\u0000/g, '<span>⌨ 代码块</span>');

  const lines = text.split('\n');
  let html = '', list = null, para = [];
  const flushP = () => { if (para.length) { html += `<p>${para.map(inline).join('<br>')}</p>`; para = []; } };
  const flushL = () => { if (list) { html += `</${list}>`; list = null; } };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const cb = line.match(/^\u0000CB(\d+)\u0000$/);
    if (cb) { flushP(); flushL(); const b = codeBlocks[+cb[1]];
      html += `<pre><button class="codecopy" data-code="${esc(b.code)}">复制</button><code>${esc(b.code)}</code></pre>`; continue; }
    if (!line.trim()) { flushP(); flushL(); continue; }
    let m;
    if ((m = line.match(/^(#{1,4})\s+(.*)/))) { flushP(); flushL(); html += `<h3>${inline(m[2])}</h3>`; continue; }
    if (/^(---+|\*\*\*+)$/.test(line.trim())) { flushP(); flushL(); html += '<hr style="border:none;border-top:1px solid var(--line);margin:8px 0">'; continue; }
    if ((m = line.match(/^&gt;\s?(.*)/))) { flushP(); flushL(); html += `<blockquote>${inline(m[1])}</blockquote>`; continue; }
    if ((m = line.match(/^[-*+]\s+(.*)/))) { flushP(); if (list !== 'ul') { flushL(); html += '<ul>'; list = 'ul'; } html += `<li>${inline(m[1])}</li>`; continue; }
    if ((m = line.match(/^\d+[.)]\s+(.*)/))) { flushP(); if (list !== 'ol') { flushL(); html += '<ol>'; list = 'ol'; } html += `<li>${inline(m[1])}</li>`; continue; }
    flushL(); para.push(line);
  }
  flushP(); flushL();
  return html;
}

/* 代码块复制(事件委托) */
document.addEventListener('click', e => {
  const btn = e.target.closest('.codecopy');
  if (!btn) return;
  const code = btn.getAttribute('data-code') || '';
  const done = () => { btn.textContent = '已复制'; setTimeout(() => btn.textContent = '复制', 1600); };
  if (navigator.clipboard) navigator.clipboard.writeText(code).then(done, done);
  else {
    const ta = el('textarea', { style: 'position:fixed;opacity:0' }); ta.value = code;
    document.body.append(ta); ta.select();
    try { document.execCommand('copy'); } catch (_) {}
    ta.remove(); done();
  }
});

/* ── SVG 面积图 ── */
function areaChart(points, { w = 640, h = 130, pad = 6 } = {}) {
  if (!points || points.length < 2) return '<div class="empty">暂无数据</div>';
  const max = Math.max(...points.map(p => p[1]), 1);
  const iw = w - pad * 2, ih = h - pad * 2;
  const xy = points.map((p, i) => [pad + i / (points.length - 1) * iw, pad + ih - p[1] / max * ih]);
  // Catmull-Rom → Bezier 平滑
  let d = `M ${xy[0][0]},${xy[0][1]}`;
  for (let i = 0; i < xy.length - 1; i++) {
    const p0 = xy[Math.max(0, i - 1)], p1 = xy[i], p2 = xy[i + 1], p3 = xy[Math.min(xy.length - 1, i + 2)];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C ${c1[0]},${c1[1]} ${c2[0]},${c2[1]} ${p2[0]},${p2[1]}`;
  }
  const area = d + ` L ${xy[xy.length - 1][0]},${h - pad} L ${xy[0][0]},${h - pad} Z`;
  return `<svg viewBox="0 0 ${w} ${h}" style="width:100%;height:auto;display:block" preserveAspectRatio="none">
    <defs><linearGradient id="ag" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="var(--blue)" stop-opacity=".22"/>
      <stop offset="1" stop-color="var(--blue)" stop-opacity="0"/>
    </linearGradient></defs>
    <path d="${area}" fill="url(#ag)"/>
    <path d="${d}" fill="none" stroke="var(--blue)" stroke-width="2.5" stroke-linecap="round"/>
    <circle cx="${xy[xy.length - 1][0]}" cy="${xy[xy.length - 1][1]}" r="7.5" fill="var(--blue)" opacity=".2"/>
    <circle cx="${xy[xy.length - 1][0]}" cy="${xy[xy.length - 1][1]}" r="4" fill="var(--blue)"/>
  </svg>`;
}

/* 相对时间自动刷新 */
function timeago(node, ts) {
  node.textContent = fmt.rel(ts);
  return setInterval(() => node.textContent = fmt.rel(ts), 60000);
}

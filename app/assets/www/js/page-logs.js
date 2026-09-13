/* page-logs.js — 实时日志:历史 + SSE 直播,级别筛选,自动滚动 */
'use strict';

(() => {
  let alive = false;
  let aborter = null;
  let lines = [];             // {time,level,data}
  let filter = 'ALL';
  let follow = true;
  let listEl, stateEl;
  const MAX = 800;

  const LEVELS = ['ALL', 'INFO', 'WARNING', 'ERROR'];

  /* ANSI SGR(\x1b[1;33m…)→ 着色 span;其余 CSI 转义与控制字符剔除 */
  const ANSI_SGR = /\x1b\[([0-9;]*)m/g;
  function xterm256(n) {
    if (n >= 232) { const g = 8 + (n - 232) * 10; return `rgb(${g},${g},${g})`; }
    const v = n - 16, ch = x => x ? 55 + x * 40 : 0;
    return `rgb(${ch(Math.floor(v / 36))},${ch(Math.floor(v / 6) % 6)},${ch(v % 6)})`;
  }
  function ansiChildren(text) {
    const src = String(text ?? '').replace(/\x1b\[[0-9;?]*[A-LN-Za-ln-z]/g, '');
    const out = [];
    let bold = false, under = false, fg = null, rgb = null;
    const push = t => {
      t = t.replace(/[\x00-\x1f\x7f]/g, '');
      if (!t) return;
      const cls = ((bold ? 'a-b ' : '') + (under ? 'a-u ' : '') + (fg === null ? '' : 'a-' + fg)).trim();
      const s = el('span', cls ? { class: cls } : null, t);
      if (rgb) s.style.color = rgb;
      out.push(s);
    };
    let idx = 0, m;
    ANSI_SGR.lastIndex = 0;
    while ((m = ANSI_SGR.exec(src))) {
      push(src.slice(idx, m.index));
      const codes = (m[1] || '0').split(';').map(Number);
      for (let i = 0; i < codes.length; i++) {
        const c = codes[i];
        if (c === 0) { bold = under = false; fg = null; rgb = null; }
        else if (c === 1) bold = true;
        else if (c === 4) under = true;
        else if (c === 22) bold = false;
        else if (c === 24) under = false;
        else if (c === 39) { fg = null; rgb = null; }
        else if ((c >= 30 && c <= 37) || (c >= 90 && c <= 97)) { fg = c >= 90 ? c - 82 : c - 30; rgb = null; }
        else if (c === 38 && codes[i + 1] === 5) {
          const n = codes[i + 2] | 0;
          if (n < 16) { fg = n; rgb = null; } else { fg = null; rgb = xterm256(n); }
          i += 2;
        } else if (c === 38 && codes[i + 1] === 2) {
          rgb = `rgb(${codes[i + 2] | 0},${codes[i + 3] | 0},${codes[i + 4] | 0})`;
          fg = null; i += 4;
        }
      }
      idx = ANSI_SGR.lastIndex;
    }
    push(src.slice(idx));
    return out;
  }

  function lineNode(l) {
    const row = el('div', { class: 'log-line lv-' + (l.level || 'INFO') },
      el('span', { class: 'log-line__t' }, fmt.hm(l.time)),
      el('span', { class: 'log-line__lv' }, l.level || 'INFO'),
      el('span', { class: 'log-line__m' }, ...ansiChildren(l.data)));
    return row;
  }

  function visible(l) { return filter === 'ALL' || (l.level || '').startsWith(filter === 'WARNING' ? 'WARN' : filter); }

  /* 滚到最底:follow 开启时,同步一次 + rAF 兜底(字体加载会改变高度) */
  function stick() {
    if (!follow || !listEl) return;
    listEl.scrollTop = listEl.scrollHeight;
    requestAnimationFrame(() => { if (follow && listEl) listEl.scrollTop = listEl.scrollHeight; });
  }

  function renderAll() {
    listEl.innerHTML = '';
    const frag = document.createDocumentFragment();
    for (const l of lines) if (visible(l)) frag.append(lineNode(l));
    listEl.append(frag);
    stick();
  }

  function appendLine(l) {
    lines.push(l);
    if (lines.length > MAX) lines.splice(0, lines.length - MAX);
    if (!visible(l)) return;
    listEl.append(lineNode(l));
    while (listEl.children.length > MAX) listEl.firstElementChild.remove();
    stick();
  }

  function render() {
    const p = $('#page-logs');
    p.innerHTML = `
      <div class="page__head">
        <div>
          <div class="page__title">运行日志</div>
          <div class="page__sub" id="log-state"><span class="dot dot--idle"></span>连接中…</div>
        </div>
      </div>
      <div class="page__body">
        <div class="log-chips" id="log-chips">
          ${LEVELS.map(l => `<button class="chip ${l === 'ALL' ? 'on' : ''} ${l === 'ERROR' ? 'chip--err' : ''}" data-lv="${l}">${l === 'ALL' ? '全部' : l === 'WARNING' ? '警告' : l === 'ERROR' ? '错误' : '信息'}</button>`).join('')}
        </div>
        <div class="log-list" id="log-list"></div>
        <p class="chart-note" style="justify-content:center;margin:0">实时推送 · 最多保留 ${MAX} 行 · 文本可长按选择</p>
      </div>`;
    listEl = $('#log-list');
    stateEl = $('#log-state');
    follow = true; // 每次进入页面默认跟到最新一行

    $('#log-chips').addEventListener('click', e => {
      const b = e.target.closest('.chip');
      if (!b) return;
      filter = b.dataset.lv;
      $$('#log-chips .chip').forEach(c => c.classList.toggle('on', c === b));
      renderAll();
    });

    listEl.addEventListener('scroll', () => {
      follow = listEl.scrollHeight - listEl.scrollTop - listEl.clientHeight < 60;
    }, { passive: true });

    boot();
  }

  async function boot() {
    try {
      const logs = await logsHistory();
      if (!alive) return;
      lines = logs.slice(-MAX);
      renderAll();
    } catch (e) { if (alive) toast(e.message, 'err'); }

    aborter = new AbortController();
    let retry = 0;
    const connect = () => {
      if (!alive) return;
      logsLive(l => {
        retry = 0;
        if (stateEl) stateEl.innerHTML = '<span class="dot dot--ok"></span>实时接收中';
        appendLine(l);
      }, aborter.signal).catch(() => {
        if (!alive) return;
        retry++;
        if (stateEl) stateEl.innerHTML = `<span class="dot dot--bad"></span>已断开,${Math.min(30, retry * 3)}s 后重连`;
        setTimeout(connect, Math.min(30, retry * 3) * 1000);
      });
    };
    connect();
  }

  Pages.logs = {
    mount() { alive = true; render(); },
    unmount() {
      alive = false;
      if (aborter) aborter.abort();
      $('#page-logs').innerHTML = '';
    },
  };
})();

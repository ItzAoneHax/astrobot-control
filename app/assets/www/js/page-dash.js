/* page-dash.js — 总览:轨道仪表 + 统计卡 + 趋势图 + 平台排行 */
'use strict';

(() => {
  let timer = null;
  let alive = false;
  let aiTokens = null;

  function greet() {
    const h = new Date().getHours();
    if (h < 5) return '夜深了';
    if (h < 9) return '早上好';
    if (h < 12) return '上午好';
    if (h < 14) return '中午好';
    if (h < 18) return '下午好';
    return '晚上好';
  }

  function hostOf(u) { try { return new URL(u).host; } catch (_) { return u; } }

  /* 活动圆环(Apple Fitness 风格):外环 CPU(蓝),内环内存(紫),中心运行时长 */
  function orbitDial(s) {
    const cpu = Math.min(100, Math.max(0, s.cpu_percent ?? 0));
    const memPct = s.memory && s.memory.system ? Math.min(100, s.memory.process / s.memory.system * 100) : 0;
    const up = fmt.dur(Date.now() / 1000 - (s.start_time || Date.now() / 1000));
    return `
    <div class="orbit-wrap">
      <svg class="orbit" viewBox="0 0 220 220">
        <circle class="track" cx="110" cy="110" r="88" stroke-width="17"/>
        <circle class="arc-cpu" cx="110" cy="110" r="88" stroke-width="17"
                pathLength="100" stroke-dasharray="${cpu.toFixed(1)} 100"
                transform="rotate(-90 110 110)"/>
        <circle class="track" cx="110" cy="110" r="64" stroke-width="17"/>
        <circle class="arc-mem" cx="110" cy="110" r="64" stroke-width="17"
                pathLength="100" stroke-dasharray="${memPct.toFixed(1)} 100"
                transform="rotate(-90 110 110)"/>
        <text class="up" x="110" y="106" text-anchor="middle">
          ${up.main}<tspan class="up-unit" dx="3" dy="0">${up.unit}</tspan>
        </text>
        ${up.rest ? `<text class="up-unit" x="110" y="128" text-anchor="middle">${up.rest}</text>` : ''}
        <text class="up-label" x="110" y="${up.rest ? 148 : 130}" text-anchor="middle">运行时长</text>
      </svg>
    </div>
    <div class="orbit-legend">
      <span><i style="background:var(--blue)"></i>CPU <b>${cpu.toFixed(1)}%</b></span>
      <span><i style="background:var(--purple)"></i>内存 <b>${fmt.bytes(s.memory?.process || 0)}</b></span>
      <span><i style="background:var(--label3)"></i>线程 <b>${s.thread_count ?? '—'}</b></span>
    </div>`;
  }

  function rankRows(platforms) {
    const list = (platforms || []).slice().sort((a, b) => (b.count || 0) - (a.count || 0)).slice(0, 6);
    if (!list.length) return '<div class="empty">暂无平台消息数据</div>';
    const max = Math.max(...list.map(p => p.count || 0), 1);
    return list.map(p => `
      <div class="rank__row">
        <div class="rank__icon">${esc((p.name || '?')[0].toUpperCase())}</div>
        <div class="rank__meta">
          <div class="rank__name"><span>${esc(p.name)}</span><em>${fmt.num(p.count)} 条</em></div>
          <div class="rank__bar"><i style="width:${(p.count / max * 100).toFixed(1)}%"></i></div>
        </div>
      </div>`).join('');
  }

  function render(s, tokens) {
    const host = store.demo ? '演示模式' : hostOf(store.server);
    $('#page-dash').innerHTML = `
      <div class="page__head">
        <div>
          <div class="page__title">${greet()}${store.username ? ',' + esc(store.username) : ''}</div>
          <div class="page__sub" id="dash-stat"><span class="dot dot--ok"></span>全部系统运行中</div>
        </div>
        <div class="chip" style="pointer-events:none">${esc(host)}</div>
      </div>
      <div class="page__body">
        <div class="card orbit-card">${orbitDial(s)}</div>

        <div class="stats">
          <div class="card stat">
            <div class="stat__label">消息总数</div>
            <div class="stat__value">${fmt.num(s.message_count)}<span class="stat__unit">条</span></div>
          </div>
          <div class="card stat stat--blue">
            <div class="stat__label">今日 Token</div>
            <div class="stat__value stat__value--blue">${fmt.num(tokens?.today_total_tokens ?? '—')}</div>
          </div>
          <div class="card stat">
            <div class="stat__label">接入平台</div>
            <div class="stat__value stat__value--ink">${s.platform_count ?? '—'}<span class="stat__unit">个</span></div>
          </div>
          <div class="card stat">
            <div class="stat__label">今日调用</div>
            <div class="stat__value stat__value--ink">${fmt.num(tokens?.today_total_calls ?? '—')}<span class="stat__unit">次</span></div>
          </div>
        </div>

        <div class="card">
          <div class="card__title">消息趋势<span class="num" style="color:var(--faint)">最近 24 小时</span></div>
          ${areaChart((s.message_time_series || []).slice(-25))}
          <div class="chart-note"><span>峰值 ${fmt.num(Math.max(0, ...(s.message_time_series || []).map(p => p[1])))} 条/时</span></div>
        </div>

        <div class="card">
          <div class="card__title">平台消息排行</div>
          <div class="rank">${rankRows(s.platform)}</div>
        </div>

        <div class="card" id="ai-card">
          <div class="card__title">AI 模型</div>
          <div class="log-chips" id="ai-days" style="margin:0 0 4px">
            <button class="chip on" data-days="1">1 天</button>
            <button class="chip" data-days="3">3 天</button>
            <button class="chip" data-days="7">1 周</button>
          </div>
          <div id="ai-body">${aiBody()}</div>
        </div>
      </div>`;
    bindAi();
  }

  /* AI 模型区块(数据来自 provider-tokens) */
  function aiBody() {
    const t = aiTokens;
    if (!t) return '<div class="log-state">暂无模型调用数据</div>';
    const provs = (t.range_by_provider || []).slice().sort((a, b) => (b.tokens || 0) - (a.tokens || 0));
    const umos = (t.range_by_umo || []).slice().sort((a, b) => (b.tokens || 0) - (a.tokens || 0)).slice(0, 10);
    const maxP = Math.max(...provs.map(p => p.tokens || 0), 1);
    const total = (t.trend && t.trend.total_series) || [];
    const rate = typeof t.range_success_rate === 'number' ? (t.range_success_rate * 100).toFixed(1) + '%' : '—';
    const ttft = t.range_avg_ttft_ms != null ? Math.round(t.range_avg_ttft_ms) + 'ms' : '—';
    const dur = t.range_avg_duration_ms != null ? (t.range_avg_duration_ms / 1000).toFixed(1) + 's' : '—';
    return `
      <div class="ai-metrics">
        <div class="ai-metrics__item"><b>${rate}</b><span>成功率</span></div>
        <div class="ai-metrics__item"><b>${ttft}</b><span>平均首字</span></div>
        <div class="ai-metrics__item"><b>${dur}</b><span>平均耗时</span></div>
      </div>
      <div style="margin-top:10px">${areaChart(total.slice(-72))}</div>
      <div class="chart-note">
        <span>共 ${fmt.num(t.range_total_tokens)} tokens · ${fmt.num(t.range_total_calls)} 次调用</span>
      </div>
      ${provs.length ? `
      <div style="margin-top:14px">
        <div class="card__title">模型用量排名</div>
        <div class="rank">${provs.map((p, i) => `
          <div class="rank__row">
            <div class="rank__icon">${i + 1}</div>
            <div class="rank__meta">
              <div class="rank__name"><span>${esc(p.provider_id)}</span><em>${fmt.num(p.tokens)}</em></div>
              <div class="rank__bar"><i style="width:${(p.tokens / maxP * 100).toFixed(1)}%"></i></div>
            </div>
          </div>`).join('')}</div>
      </div>` : ''}
      ${umos.length ? `
      <div style="margin-top:14px">
        <div class="card__title">会话用量 Top</div>
        <div class="rank">${umos.map((u, i) => `
          <div class="rank__row">
            <div class="rank__icon">${esc((u.display_name || u.umo || '?')[0].toUpperCase())}</div>
            <div class="rank__meta">
              <div class="rank__name"><span>${esc(u.display_name || u.umo)}</span><em>${fmt.num(u.tokens)}</em></div>
              <div class="rank__name" style="font-size:11px;color:var(--label3)">${esc(u.platform_type || '')}</div>
            </div>
          </div>`).join('')}</div>
      </div>` : ''}`;
  }

  function bindAi() {
    const seg = $('#ai-days');
    if (!seg) return;
    seg.addEventListener('click', async e => {
      const b = e.target.closest('.chip');
      if (!b) return;
      $$('#ai-days .chip').forEach(c => c.classList.toggle('on', c === b));
      const body = $('#ai-body');
      if (body) body.innerHTML = '<div class="log-state">加载中…</div>';
      try {
        aiTokens = await api('/api/v1/stats/provider-tokens?days=' + b.dataset.days);
      } catch (err) { toast(err.message, 'err'); }
      const nb = $('#ai-body');
      if (nb) nb.innerHTML = aiBody();
    });
  }

  function renderSkeleton() {
    $('#page-dash').innerHTML = `
      <div class="page__head">
        <div><div class="page__title">…</div><div class="page__sub">正在建立信号</div></div>
      </div>
      <div class="page__body">
        <div class="card" style="height:230px"></div>
        <div class="stats">
          <div class="skel" style="height:88px"></div><div class="skel" style="height:88px"></div>
          <div class="skel" style="height:88px"></div><div class="skel" style="height:88px"></div>
        </div>
      </div>`;
  }

  async function refresh() {
    if (!alive) return;
    try {
      const off = -new Date().getTimezoneOffset() * 60;
      const [s, tokens] = await Promise.all([
        api('/api/v1/stats?offset_sec=' + off),
        api('/api/v1/stats/provider-tokens?days=1').catch(() => null),
      ]);
      if (!alive) return;
      aiTokens = tokens;
      render(s, tokens);
    } catch (e) {
      if (!alive) return;
      const stat = $('#dash-stat');
      if (stat) stat.innerHTML = '<span class="dot dot--bad"></span>' + esc(e.message || '连接中断');
      else renderSkeleton();
    }
  }

  Pages.dash = {
    mount() {
      alive = true;
      renderSkeleton();
      refresh();
      const sec = (typeof prefs !== 'undefined' ? prefs.get('dashRefresh') : 60) ?? 60;
      if (sec > 0) timer = setInterval(refresh, sec * 1000);
    },
    unmount() {
      alive = false;
      clearInterval(timer);
      $('#page-dash').innerHTML = '';
    },
  };
})();

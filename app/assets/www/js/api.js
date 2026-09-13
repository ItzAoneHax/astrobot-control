/* api.js — AstrBot API 客户端:REST + SSE 流 + WebSocket 聊天,含演示模式拦截 */
'use strict';

const store = {
  get server() { return localStorage.getItem('ab_server') || ''; },
  set server(v) { localStorage.setItem('ab_server', v); },
  get token() { return localStorage.getItem('ab_token') || ''; },
  set token(v) { localStorage.setItem('ab_token', v); },
  get username() { return localStorage.getItem('ab_user') || ''; },
  set username(v) { localStorage.setItem('ab_user', v); },
  get demo() { return localStorage.getItem('ab_demo') === '1'; },
  set demo(v) { localStorage.setItem('ab_demo', v ? '1' : '0'); },
  clear() { ['ab_server', 'ab_token', 'ab_user', 'ab_demo'].forEach(k => localStorage.removeItem(k)); },
};

function normServer(u) {
  u = (u || '').trim().replace(/\/+$/, '');
  if (u && !/^https?:\/\//i.test(u)) u = 'https://' + u;
  return u;
}

class ApiError extends Error {
  constructor(msg, code) { super(msg); this.code = code; }
}

/* 统一请求:返回 envelope.data;失败抛错;401 触发登出回调 */
let onUnauthorized = null;

async function api(path, { method = 'GET', body, raw = false, timeoutMs = 15000 } = {}) {
  if (store.demo) return mockApi(path, { method, body });

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let res;
  try {
    res = await fetch(store.server + path, {
      method,
      signal: ctrl.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(store.token ? { Authorization: 'Bearer ' + store.token } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    clearTimeout(timer);
    throw new ApiError(e.name === 'AbortError' ? '请求超时,请检查网络' : '无法连接服务器', 'network');
  }
  clearTimeout(timer);

  if (res.status === 401) {
    if (onUnauthorized && !path.includes('/auth/login')) onUnauthorized();
    throw new ApiError('登录已过期', 401);
  }
  let json;
  try { json = await res.json(); }
  catch (_) { throw new ApiError('服务器响应异常 (HTTP ' + res.status + ')', res.status); }

  if (raw) return json;
  if (json.status !== 'ok') throw new ApiError(json.message || '请求失败', res.status);
  return json.data;
}

/* 登录:v1 优先,旧版回退 /api/auth/login */
async function login(server, username, password, code) {
  const s = normServer(server);
  const payload = { username, password, trust_device_flag: false };
  if (code) payload.code = code;
  let res;
  try {
    res = await fetch(s + '/api/v1/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (e) { throw new ApiError('无法连接服务器,请检查地址与网络', 'network'); }

  let json;
  try { json = await res.json(); } catch (_) { throw new ApiError('服务器响应异常', 'network'); }

  if (res.status === 404 || (json.message && /not found|missing api key/i.test(json.message))) {
    // 旧版实例回退
    const r2 = await fetch(s + '/api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    }).catch(() => { throw new ApiError('无法连接服务器', 'network'); });
    const j2 = await r2.json().catch(() => null);
    const tk = j2 && (j2.data?.token || j2.token);
    if (!tk) throw new ApiError((j2 && j2.message) || '用户名或密码错误', 401);
    return { token: tk, legacy: true };
  }
  if (res.status === 401 && json.data && json.data.totp_required) {
    throw new ApiError('TOTP_REQUIRED', 401);
  }
  const tk = json.data && json.data.token;
  if (json.status !== 'ok' || !tk) throw new ApiError(json.message || '用户名或密码错误', 401);
  return { token: tk, username: json.data.username || username };
}

/* ── SSE 流解析:遍历 data: 行 ── */
async function sseEach(res, onData, onOpen) {
  if (!res.ok || !res.body) throw new ApiError('流连接失败 (HTTP ' + res.status + ')', res.status);
  if (onOpen) onOpen();
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const parts = buf.split('\n');
    buf = parts.pop();
    for (const line of parts) {
      const l = line.trim();
      if (l.startsWith('data:')) {
        const payload = l.slice(5).trim();
        if (payload === '[DONE]') return;
        try { onData(JSON.parse(payload)); } catch (_) {}
      }
    }
  }
}

/* ── 聊天:POST /api/v1/chat SSE 流式 ── */
async function chatStream({ sessionId, text, provider, onEvent, signal }) {
  if (store.demo) return mockChatStream({ sessionId, text, onEvent });
  const res = await fetch(store.server + '/api/v1/chat', {
    method: 'POST', signal,
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + store.token,
      Accept: 'text/event-stream',
    },
    body: JSON.stringify({
      session_id: sessionId,
      message: [{ type: 'plain', text }],
      flags: { enable_streaming: prefs.get('stream') !== false, enable_reasoning: true, enable_default_system_prompt: true },
      selected_provider: provider || '',
      selected_model: '',
    }),
  });
  await sseEach(res, onEvent);
}

/* ── 日志:历史 + 实时 SSE ── */
async function logsHistory() {
  const d = await api('/api/v1/logs/history');
  return (d && d.logs) || [];
}
function logsLive(onLine, signal) {
  if (store.demo) return mockLogsLive(onLine, signal);
  return fetch(store.server + '/api/v1/logs/live', {
    signal, headers: { Authorization: 'Bearer ' + store.token, Accept: 'text/event-stream' },
  }).then(res => sseEach(res, onLine));
}

/* ── 图片 URL 修正(相对路径补全) ── */
function absUrl(u) {
  if (!u) return '';
  if (/^https?:/.test(u)) return u;
  return store.server + (u.startsWith('/') ? '' : '/') + u;
}

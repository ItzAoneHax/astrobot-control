/* main.js — 路由、启动、登录流程 */
'use strict';

/* ── 路由 ── */
const ROUTES = ['dash', 'chat', 'logs', 'plugins', 'config', 'me'];
const SUB_ROUTES = ['personas', 'cron', 'conversations', 'providers', 'settings'];
let activePage = null;

function go(route) {
  if (!ROUTES.includes(route) && !SUB_ROUTES.includes(route)) route = 'dash';
  if (activePage) Pages[activePage].unmount();
  // 主 tab 高亮;二级页不高亮任何 tab
  $$('.tabbar__tab').forEach(t => t.classList.toggle('on', t.dataset.route === route));
  $$('.page').forEach(p => p.hidden = true);
  const pageEl = $('#page-' + route);
  pageEl.hidden = false;
  activePage = route;
  Pages[route].mount();
  const sc = pageEl.classList.contains('page--chat') ? null : pageEl;
  if (sc) sc.scrollTop = 0;
}

/* 二级页返回 */
function subBack() {
  location.hash = '#/me';
}

/* 二级页通用头部 */
function subHead(title, sub) {
  return `
    <div class="page__head">
      <div style="display:flex;align-items:center;gap:10px;flex:1;min-width:0">
        <button class="sub-back" onclick="subBack()" aria-label="返回">‹</button>
        <div style="flex:1;min-width:0">
          <div class="page__title">${title}</div>
          ${sub ? `<div class="page__sub">${sub}</div>` : ''}
        </div>
      </div>
    </div>`;
}

/* iOS 大标题行为:页面上滚收缩为小标题(scroll 不冒泡,用捕获) */
document.addEventListener('DOMContentLoaded', () => {
  $('#pages').addEventListener('scroll', e => {
    const p = e.target;
    if (!p.classList || !p.classList.contains('page')) return;
    const head = p.querySelector('.page__head');
    if (head) head.classList.toggle('compact', p.scrollTop > 34);
  }, true);
});

window.addEventListener('hashchange', () => go((location.hash || '#/dash').replace('#/', '')));

/* ── 图片查看器 ── */
document.addEventListener('DOMContentLoaded', () => {
  $('#imgv-close').onclick = () => { $('#imgv').hidden = true; };
  $('#imgv').onclick = e => { if (e.target.id === 'imgv') $('#imgv').hidden = true; };
});

/* ── 401 统一处理 ── */
onUnauthorized = () => {
  if (store.token) toast('登录已过期,请重新登录', 'err');
  store.token = '';
  enterLogin();
};

/* ── 登录流程 ── */
function enterLogin() {
  $('#app').hidden = true;
  const lg = $('#login');
  lg.hidden = false;
  $('#li-server').value = store.server || 'https://astrbt.iepose.cn';
  $('#li-user').value = store.username || '';
  $('#li-pass').value = '';

  // 公开版本信息(不要求登录)
  fetch((store.server || 'https://astrbt.iepose.cn') + '/api/v1/stats/versions')
    .then(r => r.json())
    .then(j => { if (j.data) $('#li-ver').textContent = `AstrBot ${j.data.astrbot_version} · WebUI ${j.data.webui_version}`; })
    .catch(() => {});
}

function enterApp() {
  $('#login').hidden = true;
  const app = $('#app');
  app.hidden = false;
  if (store.demo && !$('#demo-flag')) {
    document.body.append(el('div', { class: 'demo-flag', id: 'demo-flag' }, 'DEMO'));
  }
  go((location.hash || '#/dash').replace('#/', ''));
}

async function doLogin() {
  const server = normServer($('#li-server').value);
  const user = $('#li-user').value.trim() || 'astrbot';
  const pass = $('#li-pass').value;
  if (!server) { toast('请输入服务器地址', 'err'); return; }
  if (!pass) { toast('请输入密码', 'err'); return; }

  const btn = $('#li-btn');
  btn.disabled = true;
  btn.textContent = '正在连接…';
  try {
    const r = await login(server, user, pass);
    store.server = server;
    store.token = r.token;
    store.username = r.username || user;
    store.demo = false;
    location.hash = '#/dash';
    enterApp();
  } catch (e) {
    if (e.message === 'TOTP_REQUIRED') {
      const code = await promptModal({ title: '两步验证', text: '该账号已开启动态口令(TOTP),请输入 6 位验证码或恢复码。', placeholder: '123456' });
      if (code) {
        $('#li-btn').disabled = false; $('#li-btn').textContent = '进入控制台';
        const r = await login(server, user, pass, code).catch(e2 => { toast(e2.message || '验证失败', 'err'); return null; });
        if (r && r.token) {
          store.server = server; store.token = r.token; store.username = r.username || user; store.demo = false;
          location.hash = '#/dash'; enterApp(); return;
        }
      }
      btn.disabled = false; btn.textContent = '进入控制台';
      return;
    }
    toast(e.message || '登录失败', 'err');
    btn.disabled = false;
    btn.textContent = '进入控制台';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  $('#li-btn').onclick = doLogin;
  $('#li-pass').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
  $('#li-demo').onclick = () => {
    store.demo = true;
    store.username = '访客';
    store.server = 'https://demo.local';
    enterApp();
  };

  // 主题:先于界面呈现应用;跟随系统时监听变化
  prefs.load();
  applyTheme();
  if (window.matchMedia) {
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
  }

  if (store.token || store.demo) enterApp();
  else enterLogin();
});

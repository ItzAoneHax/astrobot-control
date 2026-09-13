/* mock.js — 演示模式:无需服务器即可体验全部界面 */
'use strict';

const MOCK = {
  ver: { webui_version: 'v4.28.0', astrbot_version: '4.28.0', astrbot_code_version: '4.28.0' },
  started: Date.now() / 1000 - 3 * 86400 - 5 * 3600 - 1122,
  msgCount: 18432,
  sessions: null,
  plugins: null,
  cfgProfiles: [
    { id: 'default', name: 'default', path: 'config/astrbot_config.json' },
    { id: 'demo-uuid-1', name: '精简配置', path: 'data/abconf_demo.json' },
  ],
  personas: [
    { persona_id: '默认人格', system_prompt: '你是 AstrBot,一个乐于助人的 AI 助手。', begin_dialogs: [], updated_at: new Date(Date.now() - 86400e3).toISOString() },
    { persona_id: '猫娘小星', system_prompt: '你是一只叫小星的猫娘,说话结尾会带"喵~",性格活泼。', begin_dialogs: [], updated_at: new Date(Date.now() - 3600e3).toISOString() },
  ],
  cronJobs: [
    { job_id: 'job-1', name: '每晚报时', cron_expression: '0 22 * * *', payload: { session: 'webchat:webchat', note: '向大家道一声晚安' }, enabled: true, next_run_time: new Date(Date.now() + 5 * 3600e3).toISOString(), last_error: null },
    { job_id: 'job-2', name: '晨间新闻摘要', cron_expression: '0 9 * * *', payload: { session: '', note: '总结今天的科技新闻' }, enabled: false, next_run_time: null, last_error: null },
  ],
  convs: [
    {
      cid: 'demo-conv-1', title: '月饭群', platform_id: 'aiocqhttp', user_id: '10086', updated_at: Date.now() / 1000 - 3200, token_usage: 15230,
      umo_info: { display_name: '月饭群', message_type: 'group', platform: 'aiocqhttp', umo: 'aiocqhttp:Group_123', creator_sender_id: '10086' },
      mockHistory: [
        { role: 'user', content: '今晚吃什么好' },
        { role: 'assistant', content: '群里大家投票吧!\n\n- 火锅 🍲\n- 烧烤 🍢\n- 麻辣烫' },
        { role: 'user', content: '火锅!' },
        { role: 'assistant', content: '收到,那就 **火锅** 了 🎉' },
      ],
    },
    {
      cid: 'demo-conv-2', title: '', platform_id: 'webchat', user_id: 'demo-user', updated_at: Date.now() / 1000 - 86400, token_usage: 4210,
      umo_info: { display_name: '网页私聊', message_type: 'private', platform: 'webchat', umo: 'webchat:demo-user', creator_sender_id: 'demo-user' },
      mockHistory: [
        { role: 'user', content: '帮我写一句欢迎语' },
        { role: 'assistant', content: '「欢迎来到本群,有什么可以帮你的吗?」' },
      ],
    },
    {
      cid: 'demo-conv-3', title: '深夜树洞', platform_id: 'webchat', user_id: 'demo-user-2', updated_at: Date.now() / 1000 - 3 * 86400, token_usage: 980,
      umo_info: { display_name: '深夜树洞', message_type: 'private', platform: 'webchat', umo: 'webchat:demo-user-2', creator_sender_id: 'demo-user-2' },
      mockHistory: [{ role: 'user', content: '睡不着…' }, { role: 'assistant', content: '听你说。想聊聊今天发生了什么吗?' }],
    },
  ],
  market: {
    $meta: { name: 'AstrBot Plugin Registry', schema_version: 1 },
    'Soulter/astrbot_plugin_mnemosyne': { name: 'astrbot_plugin_mnemosyne', display_name: '记忆系统 Mnemosyne', desc: '为机器人接入长期记忆,跨会话记住用户偏好。', author: 'Soulter', version: '2.3.4', category: '记忆', download_count: 12834, stars: 210, repo: 'Soulter/astrbot_plugin_mnemosyne' },
    'ravizhan/astrbot_plugin_web_searcher': { name: 'astrbot_plugin_web_searcher', display_name: '网页搜索', desc: '让机器人能搜索整个互联网并引用来源。', author: 'ravizhan', version: '1.7.0', category: '搜索', download_count: 9821, stars: 156, repo: 'ravizhan/astrbot_plugin_web_searcher' },
    'lxfight/astrbot_plugin_qwq_know': { name: 'astrbot_plugin_qwq_know', display_name: '知识库问答', desc: '接入向量知识库,支持文档检索问答。', author: 'wizeo', version: '0.9.1', category: '知识库', download_count: 5410, stars: 88, repo: 'lxfight/astrbot_plugin_qwq_know' },
    'Anaria/astrbot_plugin_bilibili': { name: 'astrbot_plugin_bilibili', display_name: 'B站视频解析', desc: '发送 B 站链接自动解析视频信息与封面。', author: 'Anaria', version: '1.2.0', category: '娱乐', download_count: 3320, stars: 45, repo: 'Anaria/astrbot_plugin_bilibili' },
  },
};

function mockSeries(hours, base) {
  const pts = [];
  const now = Date.now() / 1000;
  for (let i = hours; i >= 0; i--) {
    const t = now - i * 3600;
    const wave = Math.sin(i / 3.1) * 0.4 + Math.sin(i / 1.7) * 0.22 + 0.6;
    pts.push([t, Math.max(0, Math.round(base * wave + Math.random() * base * 0.18))]);
  }
  return pts;
}

function mockSessions() {
  if (!MOCK.sessions) {
    const now = Date.now() / 1000;
    MOCK.sessions = [
      { session_id: 'webchat-demo-1', display_name: '闲聊与灵感', updated_at: now - 320, platform_id: 'webchat', is_group: 0, created_at: now - 90000 },
      { session_id: 'webchat-demo-2', display_name: '服务器运维', updated_at: now - 7200, platform_id: 'webchat', is_group: 0, created_at: now - 200000 },
      { session_id: 'webchat-demo-3', display_name: '写作助手', updated_at: now - 86400, platform_id: 'webchat', is_group: 0, created_at: now - 300000 },
    ];
  }
  return MOCK.sessions;
}

function mockPlugins() {
  if (!MOCK.plugins) {
    MOCK.plugins = [
      { name: 'astrbot', desc: 'AstrBot 核心组件', version: 'v4.28.0', author: 'Soulter', activated: true, reserved: true },
      { name: 'astrbot_apis', desc: '对外 API 服务', version: 'v4.28.0', author: 'Soulter', activated: true, reserved: true },
      { name: 'session_controller', desc: '会话控制与管理', version: 'v1.5.2', author: 'Soulter & lxfight', activated: true },
      { name: 'web_searcher', desc: '让机器人能搜索整个互联网', version: 'v1.7.0', author: 'ravizhan', activated: true },
      { name: 'qwq_know', desc: '知识库问答插件', version: 'v0.9.1', author: 'wizeo', activated: false },
      { name: 'astrbot_plugin_mnemosyne', desc: '长期记忆系统', version: 'v2.3.4', author: 'lxfight', activated: true },
    ];
  }
  return MOCK.plugins;
}

async function mockApi(path, { method, body } = {}) {
  await new Promise(r => setTimeout(r, 160 + Math.random() * 240));
  const q = path.split('?')[0];

  if (q === '/api/v1/stats') {
    const up = Date.now() / 1000 - MOCK.started;
    return {
      message_count: MOCK.msgCount, platform_count: 4,
      platform: [
        { name: 'webchat', count: 9310, timestamp: MOCK.started },
        { name: 'aiocqhttp', count: 6182, timestamp: MOCK.started },
        { name: 'qq_official', count: 2214, timestamp: MOCK.started },
        { name: 'lark', count: 726, timestamp: MOCK.started },
      ],
      message_time_series: mockSeries(24, 30),
      memory: { process: 486.2, system: 3170.5 },
      cpu_percent: 12.4, running: { hours: Math.floor(up / 3600), minutes: Math.floor(up % 3600 / 60), seconds: Math.floor(up % 60) },
      thread_count: 34, start_time: MOCK.started,
    };
  }
  if (q === '/api/v1/stats/provider-tokens') return {
    days: 1, today_total_tokens: 86421, today_total_calls: 137, range_total_tokens: 86421, range_total_calls: 137,
    range_avg_ttft_ms: 612, range_avg_duration_ms: 3140, range_avg_tpm: 2104, range_success_rate: 0.985,
    trend: { series: [{ name: 'glm-4.7', data: mockSeries(24, 4200) }, { name: 'deepseek-v3', data: mockSeries(24, 1800) }] },
    range_by_provider: [{ provider_id: 'glm-4.7', tokens: 61230 }, { provider_id: 'deepseek-v3', tokens: 25191 }],
    range_by_umo: [{ umo: 'webchat:demo', display_name: '闲聊与灵感', platform_type: 'webchat', tokens: 43110 }],
    today_by_provider: [],
  };
  if (q === '/api/v1/stats/versions' || q === '/api/v1/stats/version') return MOCK.ver;
  if (q === '/api/v1/chat/sessions') return mockSessions().map(s => ({ ...s }));
  if (q === '/api/v1/chat/sessions/new') {
    const s = { session_id: 'webchat-demo-' + (mockSessions().length + 1), display_name: '新对话 ' + (mockSessions().length + 1), updated_at: Date.now() / 1000, platform_id: 'webchat', is_group: 0, created_at: Date.now() / 1000 };
    MOCK.sessions.push(s); return s;
  }
  if (/^\/api\/v1\/chat\/sessions\/[^/]+$/.test(q)) {
    const sid = q.split('/')[5];
    return {
      history: [
        { id: 'h1', created_at: Date.now() / 1000 - 3600, sender_id: 'demo', content: { type: 'user', message: [{ type: 'plain', text: '帮我看看今天服务器状态如何?' }] } },
        { id: 'h2', created_at: Date.now() / 1000 - 3598, sender_id: 'bot', content: { type: 'bot', message: [{ type: 'plain', text: '**一切正常。**\n\n- CPU 占用 `12.4%`\n- 内存 486 MB\n- 已稳定运行 3 天\n\n需要我做什么吗?' }], reasoning: '用户询问服务器状态,我应当从最近的统计数据回答……' } },
      ], page: 1, page_size: 50, total: 2, has_more: false,
    };
  }
  if (/^\/api\/v1\/chat\/sessions\/[^/]+$/.test(q) && method === 'DELETE') { return { ok: true }; }
  if (q === '/api/v1/plugins') return mockPlugins().map(p => ({ ...p }));
  if (q === '/api/v1/plugins/enabled' && method === 'PATCH') {
    const p = mockPlugins().find(p => p.name === body.plugin_id);
    if (p) p.activated = body.enabled;
    return { ok: true };
  }
  if (q === '/api/v1/logs/history') {
    const now = Date.now() / 1000;
    return { logs: [
      { time: now - 42, level: 'INFO', data: '[core] 启动插件加载器,共发现 6 个插件' },
      { time: now - 41, level: 'INFO', data: '[plugin] web_searcher 加载完成 (v1.7.0)' },
      { time: now - 39, level: 'INFO', data: '[platform] webchat 适配器已上线' },
      { time: now - 30, level: 'INFO', data: '[llm] glm-4.7 流式响应 812 tokens,耗时 2.4s' },
      { time: now - 18, level: 'WARNING', data: '[platform] aiocqhttp 心跳延迟 2.1s,已自动重试' },
      { time: now - 6, level: 'INFO', data: '[scheduler] 定时任务 news_push 下次运行 08:00' },
    ] };
  }
  if (q === '/api/v1/bots') return { bots: [
    { id: 'webchat', type: 'webchat', name: '网页聊天', enabled: true, status: '已连接' },
    { id: 'aiocqhttp', type: 'aiocqhttp', name: 'QQ (NapCat)', enabled: true, status: '已连接' },
    { id: 'qq_official', type: 'qq_official', name: 'QQ 官方', enabled: false, status: '未启用' },
    { id: 'lark', type: 'lark', name: '飞书', enabled: true, status: '已连接' },
  ] };
  if (q === '/api/v1/bots/enabled' && method === 'PATCH') return { ok: true };
  if (q === '/api/v1/providers') return { providers: [
    { id: 'glm-4.7', name: '智谱 GLM-4.7', model: 'glm-4.7', enable: true },
    { id: 'deepseek-v3', name: 'DeepSeek V3', model: 'deepseek-chat', enable: true },
  ], model_metadata: {} };
  if (q === '/api/v1/personas') {
    if (method === 'POST') {
      MOCK.personas.push({ persona_id: body.persona_id, system_prompt: body.system_prompt, begin_dialogs: [], updated_at: new Date().toISOString() });
      return { message: '人格创建成功', persona: MOCK.personas[MOCK.personas.length - 1] };
    }
    return MOCK.personas.map(p => ({ ...p }));
  }
  if (/^\/api\/v1\/personas\/by-id/.test(q)) {
    const id = decodeURIComponent((q.split('persona_id=')[1] || '').split('&')[0]);
    const p = MOCK.personas.find(x => x.persona_id === id);
    if (method === 'PUT') { if (p) p.system_prompt = body.system_prompt; return { message: '人格更新成功' }; }
    if (method === 'DELETE') { MOCK.personas = MOCK.personas.filter(x => x.persona_id !== id); return { message: '人格删除成功' }; }
  }
  if (q === '/api/v1/knowledge-bases') return { knowledge_bases: [
    { id: 'kb_demo_1', name: '产品手册' },
  ] };

  if (q === '/api/v1/conversations') {
    const mt = (q.split('message_type=')[1] || 'all');
    const all = MOCK.convs.filter(c => mt === 'all' || c.umo_info.message_type === mt);
    return { conversations: all.map(c => ({ ...c })), pagination: { page: 1, page_size: 20, total: all.length, total_pages: 1, grouped_by_session: false } };
  }
  if (/^\/api\/v1\/conversations\/[^/]+$/.test(q)) {
    const cid = decodeURIComponent(q.split('/')[4].split('?')[0]);
    const c = MOCK.convs.find(x => x.cid === cid);
    return { history: JSON.stringify(c ? c.mockHistory : []) };
  }

  if (q === '/api/v1/cron/jobs') {
    if (method === 'POST') {
      MOCK.cronJobs.push({
        job_id: 'job-' + (MOCK.cronJobs.length + 1), name: body.name, cron_expression: body.cron_expression,
        payload: { session: body.session || '', note: body.note }, enabled: body.enabled !== false,
        next_run_time: new Date(Date.now() + 3600e3).toISOString(), last_error: null,
      });
      return MOCK.cronJobs[MOCK.cronJobs.length - 1];
    }
    return MOCK.cronJobs.map(j => ({ ...j }));
  }
  if (/^\/api\/v1\/cron\/jobs\/[^/]+/.test(q)) {
    const id = decodeURIComponent(q.split('/')[5]);
    const j = MOCK.cronJobs.find(x => x.job_id === id);
    if (q.endsWith('/run')) { toast('演示:已触发 ' + (j ? j.name : id), 'ok'); return {}; }
    if (method === 'PATCH') { if (j) j.enabled = body.enabled; return j; }
    if (method === 'DELETE') { MOCK.cronJobs = MOCK.cronJobs.filter(x => x.job_id !== id); return { message: 'deleted' }; }
  }

  if (q === '/api/v1/plugins/market') return MOCK.market;
  if (q === '/api/v1/plugins/install/github' && method === 'POST') {
    await sleep(1500);
    return { name: body.market_plugin_id || body.url || '新插件', repo: body.url || '' , message: '安装成功' };
  }
  if (q === '/api/v1/providers/test' && method === 'POST') { await sleep(800); return { id: body.provider_id, status: 'ok', error: null }; }
  if (q === '/api/v1/updates/check') { await sleep(600); return { has_update: false, latest_version: MOCK.ver.astrbot_version, current_version: MOCK.ver.astrbot_version }; }
  if (q === '/api/v1/auth/account' && method === 'PATCH') return { ok: true };
  if (q === '/api/v1/auth/logout') return { ok: true };
  if (q === '/api/v1/system/restart') { toast('演示模式:不会真的重启', 'err'); return { ok: true }; }

  if (q === '/api/v1/config-profiles') {
    if (method === 'POST') { MOCK.cfgProfiles.push({ id: 'demo-' + (MOCK.cfgProfiles.length + 1), name: (body && body.name) || '新配置', path: 'abconf_demo.json' }); return { conf_id: 'demo-' + MOCK.cfgProfiles.length }; }
    return { info_list: MOCK.cfgProfiles.map(p => ({ ...p })) };
  }
  if (q === '/api/v1/config-profiles/schema') return { config: mockConfig(), metadata: {} };
  if (/^\/api\/v1\/config-profiles\/[^/]+$/.test(q)) {
    const id = decodeURIComponent(q.split('/').pop());
    if (method === 'GET') {
      const p = MOCK.cfgProfiles.find(x => x.id === id);
      if (!p) throw new ApiError('配置不存在', 400);
      return { config: mockConfig(id), metadata: (typeof MOCK_CONFIG_METADATA !== 'undefined' ? MOCK_CONFIG_METADATA : mockMetadata()) };
    }
    if (method === 'PUT') { MOCK.savedCfg = body; return { ok: true }; }
    if (method === 'PATCH') {
      if (id === 'default') throw new ApiError('不能更新默认配置文件的信息', 400);
      const p = MOCK.cfgProfiles.find(x => x.id === id);
      if (p) p.name = body.name;
      return { ok: true };
    }
    if (method === 'DELETE') {
      if (id === 'default') throw new ApiError('不能删除默认配置文件', 400);
      MOCK.cfgProfiles = MOCK.cfgProfiles.filter(x => x.id !== id);
      return { ok: true };
    }
  }
  throw new ApiError('演示模式暂不支持该操作', 400);
}

function mockConfig(id) {
  const base = {
    log_level: 'INFO',
    admins_id: ['10001'],
    t2i: 0,
    wake_prefix: ['/'],
    provider_settings: {
      enable: true,
      web_search: false,
      websearch_tavily_key: '',
    },
    agent_runner: { runner_type: 'local', config: { model: { provider_id: 'glm-4.7', fallback_provider_ids: [] }, timeout: 120 } },
    platform_settings: {
      enable_id_white_list: false,
      id_whitelist: [],
      id_whitelist_log: true,
      segmented_reply: { enable: false, interval_method: 'random', words_count_threshold: 120 },
    },
    provider: [
      { id: 'glm-4.7', type: 'openai_chat_completion', enable: true, model: 'glm-4.7', base_url: 'https://open.bigmodel.cn/api/paas/v4/', key: 'sk-demo***', timeout: 120 },
      { id: 'deepseek-v3', type: 'openai_chat_completion', enable: false, model: 'deepseek-chat', base_url: 'https://api.deepseek.com/v1', key: 'sk-demo***', timeout: 120 },
    ],
    platform: [
      { id: 'webchat', type: 'webchat', enable: true },
      { id: 'qq', type: 'aiocqhttp', enable: false, host: '127.0.0.1', port: 3001 },
    ],
    http_api_settings: { enabled: true, port: 6185 },
    dashboard: { username: 'astrbot', password: 'demo***', jwt_secret: 'demo***', host: '0.0.0.0', port: 6196 },
    callback_api_base_url: '',
    silence: false,
  };
  if (id && id !== 'default') { base.log_level = 'DEBUG'; }
  return base;
}

/* 官方 CONFIG_METADATA_3 结构样例(i18n 键均真实存在,由 i18n-config-metadata.js 翻译) */
function mockMetadata() {
  return {
    ai_group: {
      name: 'ai_group.name',
      metadata: {
        agent_runner: {
          description: 'ai_group.agent_runner.description',
          hint: 'ai_group.agent_runner.hint',
          type: 'object',
          items: {
            'provider_settings.enable': { description: 'ai_group.agent_runner.provider_settings.enable.description', hint: 'ai_group.agent_runner.provider_settings.enable.hint', type: 'bool' },
            'agent_runner.runner_type': {
              description: 'ai_group.agent_runner.agent_runner.runner_type.description',
              type: 'string',
              options: ['local', 'dify', 'coze', 'dashscope', 'deerflow'],
              labels: 'ai_group.agent_runner.agent_runner.runner_type.labels',
              _special: 'agent_runner_type',
              condition: { 'provider_settings.enable': true },
              runner_defaults: {
                local: { model: { provider_id: '', fallback_provider_ids: [] }, timeout: 120 },
                dify: { dify_api_type: 'chat', dify_api_key: '', timeout: 60 },
                coze: { coze_bot_id: '', coze_api_key: '', timeout: 60 },
                dashscope: { application_id: '', api_key: '', timeout: 60 },
                deerflow: { deerflow_api_url: '', deerflow_api_key: '', timeout: 120 },
              },
            },
          },
        },
        websearch: {
          description: 'ai_group.websearch.description',
          hint: 'ai_group.websearch.hint',
          type: 'object',
          items: {
            'provider_settings.web_search': { description: 'ai_group.websearch.provider_settings.web_search.description', type: 'bool' },
            'provider_settings.websearch_tavily_key': { description: 'ai_group.websearch.provider_settings.websearch_tavily_key.description', hint: 'ai_group.websearch.provider_settings.websearch_tavily_key.hint', type: 'string', secret: true, collapsed: true, condition: { 'provider_settings.web_search': true } },
          },
        },
      },
    },
    platform_group: {
      name: 'platform_group.name',
      metadata: {
        general: {
          description: 'platform_group.general.description',
          type: 'object',
          items: {
            admins_id: { description: 'platform_group.general.admins_id.description', type: 'list', items: { type: 'string' } },
            wake_prefix: { description: 'platform_group.general.wake_prefix.description', type: 'list', items: { type: 'string' } },
          },
        },
        whitelist: {
          description: 'platform_group.whitelist.description',
          type: 'object',
          items: {
            'platform_settings.enable_id_white_list': { description: 'platform_group.whitelist.platform_settings.enable_id_white_list.description', hint: 'platform_group.whitelist.platform_settings.enable_id_white_list.hint', type: 'bool' },
            'platform_settings.id_whitelist': { description: 'platform_group.whitelist.platform_settings.id_whitelist.description', hint: 'platform_group.whitelist.platform_settings.id_whitelist.hint', type: 'list', items: { type: 'string' } },
            'platform_settings.id_whitelist_log': { description: 'platform_group.whitelist.platform_settings.id_whitelist_log.description', type: 'bool', collapsed: true },
          },
        },
      },
    },
    ext_group: {
      name: 'ext_group.name',
      metadata: {
        segmented_reply: {
          description: 'ext_group.segmented_reply.description',
          type: 'object',
          items: {
            'platform_settings.segmented_reply.enable': { description: 'ext_group.segmented_reply.platform_settings.segmented_reply.enable.description', type: 'bool' },
            'platform_settings.segmented_reply.interval_method': { description: 'ext_group.segmented_reply.platform_settings.segmented_reply.interval_method.description', hint: 'ext_group.segmented_reply.platform_settings.segmented_reply.interval_method.hint', type: 'string', options: ['random', 'log'], collapsed: true },
            'platform_settings.segmented_reply.words_count_threshold': { description: 'ext_group.segmented_reply.platform_settings.segmented_reply.words_count_threshold.description', type: 'int', slider: { min: 0, max: 200, step: 10 } },
          },
        },
      },
    },
  };
}

/* 演示聊天流:模拟思考 + 打字机回复 */
async function mockChatStream({ onEvent }) {
  const think = '用户在演示模式下发来消息。我可以先展示思考过程,再给出一段格式丰富的回复,包括代码块与列表。';
  const reply = '收到!这里是**演示模式**的回复 🌟\n\n真实连接服务器后,我会直接调用你的机器人,支持:\n\n- 流式输出与思考过程\n- 插件 / 工具调用展示\n- `markdown` 与代码块\n\n```bash\n# 例如查看运行状态\ncurl -H "Authorization: Bearer <token>" \\\n  https://your-bot/api/v1/stats\n```\n\n现在可以退出演示,填入你的服务器地址登录。';
  for (const ch of think) { onEvent({ type: 'plain', chain_type: 'reasoning', data: ch, streaming: true }); await sleep(8); }
  await sleep(200);
  for (const ch of reply) { onEvent({ type: 'plain', data: ch, streaming: true }); await sleep(14); }
  onEvent({ type: 'complete', data: reply });
  onEvent({ type: 'end' });
}

function mockLogsLive(onLine, signal) {
  return new Promise(resolve => {
    const samples = [
      ['INFO', '[llm] glm-4.7 流式响应 {n} tokens,耗时 {t}s'],
      ['INFO', '[webchat] 会话消息已入队'],
      ['INFO', '[plugin] web_searcher 命中缓存,跳过请求'],
      ['DEBUG', '[scheduler] 轮询任务队列,当前 0 项'],
      ['WARNING', '[platform] aiocqhttp 心跳延迟 {t}s'],
      ['INFO', '[server] GET /api/v1/stats 200 ({t}ms)'],
    ];
    const iv = setInterval(() => {
      if (signal && signal.aborted) { clearInterval(iv); resolve(); return; }
      const [lv, tpl] = samples[Math.random() * samples.length | 0];
      onLine({ time: Date.now() / 1000, level: lv, data: tpl.replace('{n}', String(120 + Math.random() * 900 | 0)).replace('{t}', (Math.random() * 3).toFixed(1)) });
    }, 1800);
    if (signal) signal.addEventListener('abort', () => { clearInterval(iv); resolve(); });
  });
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

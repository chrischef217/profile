const BASE = Deno.env.get('SUPABASE_URL') || '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const OPENAI_KEY = Deno.env.get('OPENAI_API_KEY') || '';
const REST = `${BASE}/rest/v1`;
const RUNNER = `${BASE}/functions/v1/unity-ai-office-runner`;
const STAGE = 'ONLINE_MULTI_AGENT_STAGE_7_DEV_OPEN';
const CORS = {
  'access-control-allow-origin':'*',
  'access-control-allow-headers':'content-type, authorization, apikey, x-client-info',
  'access-control-allow-methods':'GET, POST, OPTIONS'
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers:{...CORS,'content-type':'application/json; charset=utf-8','cache-control':'no-store'}
  });
}

async function db(path, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set('apikey', SERVICE_KEY);
  headers.set('authorization', `Bearer ${SERVICE_KEY}`);
  headers.set('content-type','application/json');
  const response = await fetch(`${REST}/${path}`, {...init, headers});
  const text = await response.text();
  let body = [];
  if (text) {
    try { body = JSON.parse(text); }
    catch { body = text; }
  }
  if (!response.ok) {
    console.error('DB_ERROR', response.status, path, typeof body === 'string' ? body.slice(0,500) : body);
    throw new Error(`DB_${response.status}`);
  }
  return body;
}

async function one(table, filter) {
  const rows = await db(`${table}?${filter}&limit=1`);
  return Array.isArray(rows) ? rows[0] || null : null;
}

function pathOf(req) {
  const marker = '/unity-ai-office-dev-open';
  const path = new URL(req.url).pathname;
  const index = path.indexOf(marker);
  return index >= 0 ? path.slice(index + marker.length) || '/' : '/';
}

function unique(values) {
  return [...new Set((Array.isArray(values) ? values : []).map(value => String(value || '').trim()).filter(Boolean))];
}

async function event(type, message, agent = null, job = null, metadata = {}) {
  await db('ai_office_events', {
    method:'POST',headers:{Prefer:'return=minimal'},
    body:JSON.stringify({event_type:type,message,agent_id:agent,job_id:job,metadata})
  });
}

async function runnerToken() {
  const runtime = await one('ai_office_runtime', 'select=internal_tick_token&id=eq.primary');
  return String(runtime?.internal_tick_token || '');
}

function background(promise) {
  if (globalThis.EdgeRuntime?.waitUntil) globalThis.EdgeRuntime.waitUntil(promise);
  else promise.catch(error => console.error('BACKGROUND_ERROR', error));
}

async function triggerRunner(reason = 'API_TRIGGER') {
  const token = await runnerToken();
  if (token.length !== 64) throw new Error('RUNNER_TOKEN_INVALID');
  const request = fetch(RUNNER, {
    method:'POST',
    headers:{'content-type':'application/json','x-ai-office-runner-token':token},
    body:JSON.stringify({reason})
  }).catch(error => console.error('RUNNER_TRIGGER_FAILED', error));
  background(request);
  return true;
}

function riskyCommand(title) {
  return /(삭제|송금|결제|계약\s*(체결|서명)|해고|프로덕션\s*배포|외부\s*게시|메일\s*발송|publish|delete|payment|transfer|terminate|production\s*deploy)/i.test(title);
}

async function usageSummary() {
  const rows = await db('ai_office_usage_ledger?select=total_tokens,estimated_cost_thb,created_at&order=created_at.desc&limit=5000');
  const now = new Date();
  const day = new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
  const month = day.slice(0,7);
  const daily = {total_tokens:0,estimated_cost_thb:0};
  const monthly = {total_tokens:0,estimated_cost_thb:0};
  for (const row of Array.isArray(rows) ? rows : []) {
    const created = new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(row.created_at));
    const tokens = Number(row.total_tokens || 0);
    const cost = Number(row.estimated_cost_thb || 0);
    if (created.slice(0,7) === month) { monthly.total_tokens += tokens; monthly.estimated_cost_thb += cost; }
    if (created === day) { daily.total_tokens += tokens; daily.estimated_cost_thb += cost; }
  }
  daily.estimated_cost_thb = Number(daily.estimated_cost_thb.toFixed(4));
  monthly.estimated_cost_thb = Number(monthly.estimated_cost_thb.toFixed(4));
  return {daily,monthly};
}

async function state() {
  const [agents,jobs,events,runtime,execution,capabilities,templates,contexts,tools,budget,models,policies,pricing,usage] = await Promise.all([
    db('ai_office_agents?select=id,name,role,emoji,status,current_job_id,current_task,last_heartbeat_at,updated_at&order=id.asc'),
    db('ai_office_jobs?select=id,title,status,owner_agent_id,capability_key,template_key,context_keys,requested_tools,risk_level,requested_by,payload,result,error_message,attempts,max_attempts,parent_job_id,root_job_id,job_type,phase,sequence_no,execution_priority,depends_on,model_profile,plan,locked_by,locked_at,lease_expires_at,created_at,updated_at,approved_at,started_at,completed_at&order=created_at.desc&limit=300'),
    db('ai_office_events?select=id,job_id,event_type,agent_id,message,metadata,created_at&order=created_at.desc&limit=200'),
    db('ai_office_runtime?select=id,workday_enabled,environment_mode,last_tick_at,last_tick_result,updated_at&id=eq.primary&limit=1'),
    db('ai_office_execution_config?select=model_provider,model_name,model_enabled,tool_execution_enabled,approval_channel_enabled,disabled_reason,updated_at&id=eq.primary&limit=1'),
    db('ai_office_capabilities?select=capability_key,agent_id,name,description,context_keys,allowed_tools,risk_ceiling,prompt_rules,version,enabled&enabled=eq.true&order=agent_id.asc'),
    db('ai_office_task_templates?select=template_key,category,name,description,agent_id,capability_key,command_template,risk_level,context_keys,sort_order,enabled&enabled=eq.true&order=sort_order.asc'),
    db('ai_office_context?select=context_key,category,priority,source_files,version,is_active,updated_at&is_active=eq.true&order=priority.asc'),
    db('ai_office_tool_policies?select=tool_key,name,category,access_mode,requires_approval,external_effect,allowed_capabilities,enabled,version&order=category.asc,tool_key.asc'),
    db('ai_office_budget_policy?select=*&id=eq.primary&limit=1'),
    db('ai_office_model_registry?select=model_key,provider,model_name,purpose,tier,reasoning_effort,max_output_tokens,supports_tools,supports_structured_output,enabled,verified_at,metadata&order=tier.asc,model_key.asc'),
    db('ai_office_agent_model_policy?select=agent_id,primary_model_key,planner_model_key,reviewer_model_key,fallback_model_key,max_concurrent,enabled&order=agent_id.asc'),
    db('ai_office_model_pricing?select=pricing_key,provider,model,input_cost_per_million_thb,output_cost_per_million_thb,source_reference,effective_from,verified_at,active&active=eq.true&order=verified_at.desc'),
    usageSummary()
  ]);
  const jobRows = Array.isArray(jobs) ? jobs : [];
  const executionRow = Array.isArray(execution) ? execution[0] || null : null;
  return {
    ok:true,mode:STAGE,access_mode:'DEVELOPMENT_OPEN_NO_PASSWORD',
    runtime:'Supabase Edge + PostgreSQL governed multi-agent runtime',
    scheduler:'Immediate trigger + pg_cron recovery every minute',
    orchestration:{enabled:true,max_parallel:3,planner:'PMO',child_jobs:true,synthesis:true},
    credential_status:{openai_configured:Boolean(OPENAI_KEY),anthropic_configured:false},
    generatedAt:new Date().toISOString(),
    agents:Array.isArray(agents)?agents:[],jobs:jobRows,events:Array.isArray(events)?events:[],
    capabilities:Array.isArray(capabilities)?capabilities:[],templates:Array.isArray(templates)?templates:[],
    contexts:Array.isArray(contexts)?contexts:[],tool_policies:Array.isArray(tools)?tools:[],
    model_registry:Array.isArray(models)?models:[],agent_model_policies:Array.isArray(policies)?policies:[],
    verified_model_prices:Array.isArray(pricing)?pricing:[],
    budget_policy:Array.isArray(budget)?budget[0]||null:null,
    usage_summary:usage,
    settings:Array.isArray(runtime)?runtime[0]||null:null,
    execution:executionRow,
    queue:jobRows.filter(job=>['QUEUED','APPROVED','RUNNING'].includes(job.status)).length,
    approvals:jobRows.filter(job=>job.status==='WAITING_APPROVAL').length
  };
}

async function command(req) {
  let body;
  try { body = await req.json(); }
  catch { return json({ok:false,error:'INVALID_JSON'},400); }
  const templateKey = String(body?.template_key || '').trim();
  const template = templateKey
    ? await one('ai_office_task_templates', `select=*&template_key=eq.${encodeURIComponent(templateKey)}&enabled=eq.true`)
    : null;
  if (templateKey && !template) return json({ok:false,error:'TEMPLATE_NOT_FOUND'},404);
  const title = String(body?.command || body?.title || template?.command_template || '').trim();
  if (!title) return json({ok:false,error:'COMMAND_REQUIRED'},400);
  if (title.length > 1200) return json({ok:false,error:'COMMAND_TOO_LONG'},400);

  let owner, capabilityKey, riskLevel, status, contextKeys, jobType, phase, priority;
  if (template) {
    owner = template.agent_id;
    capabilityKey = template.capability_key;
    riskLevel = template.risk_level || 'L1';
    status = ['L2','L3'].includes(riskLevel) ? 'WAITING_APPROVAL' : 'QUEUED';
    const capability = await one('ai_office_capabilities', `select=*&capability_key=eq.${encodeURIComponent(capabilityKey)}&enabled=eq.true`);
    if (!capability) return json({ok:false,error:'CAPABILITY_NOT_AVAILABLE'},409);
    contextKeys = unique([...(capability.context_keys || []),...(template.context_keys || [])]);
    jobType = owner === 'pmo' ? 'ORCHESTRATION' : 'TASK';
    phase = owner === 'pmo' ? 'PLAN' : 'EXECUTE';
    priority = owner === 'pmo' ? 20 : 100;
  } else {
    owner = 'pmo'; capabilityKey = 'pmo_core'; riskLevel = riskyCommand(title) ? 'L2' : 'L1';
    status = riskLevel === 'L2' ? 'WAITING_APPROVAL' : 'QUEUED';
    const capability = await one('ai_office_capabilities', 'select=*&capability_key=eq.pmo_core&enabled=eq.true');
    if (!capability) return json({ok:false,error:'PMO_CAPABILITY_NOT_AVAILABLE'},409);
    contextKeys = unique(capability.context_keys || []);
    jobType = 'ORCHESTRATION'; phase = 'PLAN'; priority = 20;
  }

  const rows = await db('ai_office_jobs', {
    method:'POST',headers:{Prefer:'return=representation'},
    body:JSON.stringify({
      title,status,owner_agent_id:owner,capability_key:capabilityKey,
      template_key:template?.template_key || null,context_keys:contextKeys,requested_tools:[],
      risk_level:riskLevel,requested_by:'MANAGING_DIRECTOR_DEV_OPEN',job_type:jobType,phase,
      execution_priority:priority,payload:{source:'development_open_office',submitted_at:new Date().toISOString(),orchestration:jobType==='ORCHESTRATION'}
    })
  });
  const job = Array.isArray(rows) ? rows[0] : null;
  if (!job) throw new Error('INSERT_FAILED');
  await event(status === 'WAITING_APPROVAL' ? 'APPROVAL_REQUESTED' : 'JOB_QUEUED',
    status === 'WAITING_APPROVAL' ? `승인 필요: ${title}` : `업무 등록: ${title}`,
    owner,job.id,{risk_level:riskLevel,capability_key:capabilityKey,job_type:jobType,phase,access_mode:'DEVELOPMENT_OPEN'});
  if (status !== 'WAITING_APPROVAL') await triggerRunner('COMMAND_CREATED');
  return json({ok:true,job,runner_triggered:status!=='WAITING_APPROVAL'},202);
}

async function action(req, type) {
  let body;
  try { body = await req.json(); }
  catch { return json({ok:false,error:'INVALID_JSON'},400); }
  const id = String(body?.job_id || '').trim();
  if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ok:false,error:'JOB_ID_REQUIRED'},400);
  const job = await one('ai_office_jobs', `select=*&id=eq.${id}`);
  if (!job) return json({ok:false,error:'JOB_NOT_FOUND'},404);
  const now = new Date().toISOString();
  if (type === 'approve') {
    if (job.status !== 'WAITING_APPROVAL') return json({ok:false,error:'JOB_NOT_WAITING_APPROVAL'},409);
    await db(`ai_office_jobs?id=eq.${id}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({status:'APPROVED',approved_at:now,updated_at:now})});
    await event('JOB_APPROVED',`승인: ${job.title}`,job.owner_agent_id||'pmo',id,{access_mode:'DEVELOPMENT_OPEN'});
    await triggerRunner('JOB_APPROVED');
    return json({ok:true,job_id:id,status:'APPROVED',runner_triggered:true});
  }
  if (type === 'reject') {
    if (!['WAITING_APPROVAL','QUEUED','APPROVED','BLOCKED','FAILED'].includes(job.status)) return json({ok:false,error:'JOB_CANNOT_BE_REJECTED'},409);
    await db(`ai_office_jobs?id=eq.${id}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({status:'CANCELLED',completed_at:now,locked_by:null,locked_at:null,lease_expires_at:null,updated_at:now})});
    await event('JOB_REJECTED',`거부/취소: ${job.title}`,job.owner_agent_id||'pmo',id,{access_mode:'DEVELOPMENT_OPEN'});
    return json({ok:true,job_id:id,status:'CANCELLED'});
  }
  if (type === 'retry') {
    if (!['BLOCKED','FAILED','CANCELLED'].includes(job.status)) return json({ok:false,error:'JOB_NOT_RETRYABLE'},409);
    const next = ['L2','L3'].includes(job.risk_level) && !job.approved_at ? 'WAITING_APPROVAL' : 'QUEUED';
    await db(`ai_office_jobs?id=eq.${id}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({status:next,result:null,error_message:null,started_at:null,completed_at:null,locked_by:null,locked_at:null,lease_expires_at:null,updated_at:now})});
    await event('JOB_RETRIED',`재시도: ${job.title}`,job.owner_agent_id||'pmo',id,{access_mode:'DEVELOPMENT_OPEN'});
    if (next === 'QUEUED') await triggerRunner('JOB_RETRIED');
    return json({ok:true,job_id:id,status:next,runner_triggered:next==='QUEUED'});
  }
  return json({ok:false,error:'UNKNOWN_ACTION'},400);
}

async function workday(req) {
  let body;
  try { body = await req.json(); }
  catch { return json({ok:false,error:'INVALID_JSON'},400); }
  const enabled = Boolean(body?.enabled);
  const now = new Date().toISOString();
  await db('ai_office_runtime?id=eq.primary',{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({workday_enabled:enabled,updated_at:now})});
  await event('SCHEDULER_CHANGED',enabled?'스케줄러 활성화':'스케줄러 일시정지','pmo',null,{enabled,access_mode:'DEVELOPMENT_OPEN'});
  if (enabled) await triggerRunner('SCHEDULER_ENABLED');
  return json({ok:true,workday_enabled:enabled,runner_triggered:enabled});
}

async function modelControl(req) {
  let body;
  try { body = await req.json(); }
  catch { return json({ok:false,error:'INVALID_JSON'},400); }
  const enabled = Boolean(body?.enabled);
  const modelKey = String(body?.model_key || 'openai_standard');
  const model = await one('ai_office_model_registry', `select=*&model_key=eq.${encodeURIComponent(modelKey)}&enabled=eq.true`);
  if (!model) return json({ok:false,error:'MODEL_PROFILE_NOT_FOUND'},404);
  if (enabled && !OPENAI_KEY) return json({ok:false,error:'OPENAI_API_KEY_NOT_CONFIGURED'},409);
  const pricing = await one('ai_office_model_pricing', `select=pricing_key&provider=eq.${encodeURIComponent(model.provider)}&model=eq.${encodeURIComponent(model.model_name)}&active=eq.true&order=verified_at.desc`);
  if (enabled && !pricing) return json({ok:false,error:'MODEL_PRICING_NOT_VERIFIED'},409);
  const budget = await one('ai_office_budget_policy', 'select=*&id=eq.primary');
  if (enabled && (budget?.daily_cost_limit_thb == null || budget?.monthly_cost_limit_thb == null)) return json({ok:false,error:'BUDGET_LIMITS_REQUIRED'},409);
  const now = new Date().toISOString();
  await db('ai_office_execution_config?id=eq.primary', {
    method:'PATCH',headers:{Prefer:'return=minimal'},
    body:JSON.stringify({model_provider:model.provider,model_name:model.model_name,model_enabled:enabled,disabled_reason:enabled?null:'MODEL_DISABLED_BY_ADMIN',updated_at:now})
  });
  await event('MODEL_EXECUTION_CHANGED',enabled?`AI 모델 활성화: ${model.model_name}`:'AI 모델 비활성화','pmo',null,{model_key:modelKey,provider:model.provider,model:model.model_name});
  if (enabled) await triggerRunner('MODEL_ENABLED');
  return json({ok:true,enabled,model_key:modelKey,provider:model.provider,model:model.model_name,runner_triggered:enabled});
}

async function budgetControl(req) {
  let body;
  try { body = await req.json(); }
  catch { return json({ok:false,error:'INVALID_JSON'},400); }
  const daily = Number(body?.daily_cost_limit_thb);
  const monthly = Number(body?.monthly_cost_limit_thb);
  const dailyTokens = body?.daily_token_limit == null ? null : Number(body.daily_token_limit);
  const monthlyTokens = body?.monthly_token_limit == null ? null : Number(body.monthly_token_limit);
  if (!Number.isFinite(daily) || daily <= 0 || !Number.isFinite(monthly) || monthly <= 0) return json({ok:false,error:'VALID_COST_LIMITS_REQUIRED'},400);
  if (monthly < daily) return json({ok:false,error:'MONTHLY_LIMIT_MUST_EXCEED_DAILY_LIMIT'},400);
  if (dailyTokens != null && (!Number.isFinite(dailyTokens) || dailyTokens < 1000)) return json({ok:false,error:'INVALID_DAILY_TOKEN_LIMIT'},400);
  if (monthlyTokens != null && (!Number.isFinite(monthlyTokens) || monthlyTokens < 1000)) return json({ok:false,error:'INVALID_MONTHLY_TOKEN_LIMIT'},400);
  const now = new Date().toISOString();
  await db('ai_office_budget_policy?id=eq.primary', {
    method:'PATCH',headers:{Prefer:'return=minimal'},
    body:JSON.stringify({hard_stop:true,require_verified_model_price:true,daily_cost_limit_thb:daily,monthly_cost_limit_thb:monthly,daily_token_limit:dailyTokens,monthly_token_limit:monthlyTokens,updated_at:now})
  });
  await event('BUDGET_POLICY_CHANGED',`AI 예산 한도 변경: 일 ${daily} THB / 월 ${monthly} THB`,'pmo',null,{daily_cost_limit_thb:daily,monthly_cost_limit_thb:monthly,daily_token_limit:dailyTokens,monthly_token_limit:monthlyTokens});
  return json({ok:true,daily_cost_limit_thb:daily,monthly_cost_limit_thb:monthly,daily_token_limit:dailyTokens,monthly_token_limit:monthlyTokens});
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok',{headers:CORS});
  try {
    const path = pathOf(req);
    if (path === '/health' && req.method === 'GET') {
      const execution = await one('ai_office_execution_config','select=*&id=eq.primary');
      return json({ok:true,service:'unity-ai-office-dev-open',stage:STAGE,auth:'disabled-during-initial-development',openai_configured:Boolean(OPENAI_KEY),model_enabled:Boolean(execution?.model_enabled),model:execution?.model_name||null,time:new Date().toISOString()});
    }
    if (path === '/state' && req.method === 'GET') return json(await state());
    if (path === '/command' && req.method === 'POST') return command(req);
    if (path === '/approve' && req.method === 'POST') return action(req,'approve');
    if (path === '/reject' && req.method === 'POST') return action(req,'reject');
    if (path === '/retry' && req.method === 'POST') return action(req,'retry');
    if (path === '/admin/workday' && req.method === 'POST') return workday(req);
    if (path === '/admin/model' && req.method === 'POST') return modelControl(req);
    if (path === '/admin/budget' && req.method === 'POST') return budgetControl(req);
    if (path === '/admin/run-now' && req.method === 'POST') { await triggerRunner('MANUAL_RUN'); return json({ok:true,runner_triggered:true},202); }
    return json({ok:true,service:'Unity Global AI Office Multi-Agent Development API',stage:STAGE,auth:'disabled'});
  } catch (error) {
    console.error(error);
    return json({ok:false,error:error instanceof Error ? error.message : 'INTERNAL_ERROR'},500);
  }
});
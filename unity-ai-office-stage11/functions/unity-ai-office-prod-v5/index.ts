const BASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const REST = `${BASE_URL}/rest/v1`;
const UPSTREAM = `${BASE_URL}/functions/v1/unity-ai-office-prod-v4`;
const BASE_PATH = '/unity-ai-office-prod-v5';
const STAGE = 'ONLINE_MULTI_AGENT_STAGE_11_HARDENED';
const CORS = {
  'access-control-allow-origin':'*',
  'access-control-allow-headers':'content-type,x-client-info,apikey',
  'access-control-allow-methods':'GET,POST,DELETE,OPTIONS',
  'cache-control':'no-store',
  'content-type':'application/json; charset=utf-8'
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {status, headers:CORS});
}

function pathOf(req: Request) {
  const pathname = new URL(req.url).pathname;
  const index = pathname.indexOf(BASE_PATH);
  return index < 0 ? '/' : pathname.slice(index + BASE_PATH.length) || '/';
}

async function sha256(value: string) {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(hash)].map(v => v.toString(16).padStart(2,'0')).join('');
}

async function rpc(name: string, body: unknown) {
  const response = await fetch(`${REST}/rpc/${name}`, {
    method:'POST',
    headers:{apikey:SERVICE_KEY,authorization:`Bearer ${SERVICE_KEY}`,'content-type':'application/json'},
    body:JSON.stringify(body)
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`RPC_${name}_${response.status}`);
  return data;
}

function clientIdentity(req: Request) {
  const ip = req.headers.get('cf-connecting-ip')
    || (req.headers.get('x-forwarded-for') || '').split(',')[0].trim()
    || 'unknown';
  const ua = req.headers.get('user-agent') || 'unknown';
  return `${ip}|${ua.slice(0,300)}`;
}

function policy(path: string, method: string) {
  if (method === 'POST' && path === '/command') return {window:60,limit:10,hourly:60,idempotent:true};
  if (method === 'POST' && ['/approve','/reject','/retry','/admin/run-now'].includes(path)) return {window:60,limit:30,hourly:180,idempotent:false};
  if ((method === 'POST' || method === 'DELETE') && path === '/admin/credential') return {window:3600,limit:3,hourly:null,idempotent:false};
  if (method === 'POST' && ['/admin/budget','/admin/model','/admin/workday'].includes(path)) return {window:3600,limit:10,hourly:null,idempotent:false};
  return null;
}

async function rateCheck(clientHash: string, endpoint: string, method: string, requestHash: string | null, windowSeconds: number, limit: number) {
  return await rpc('ai_office_check_rate_limit', {
    p_client_hash:clientHash,
    p_endpoint:endpoint,
    p_method:method,
    p_request_hash:requestHash,
    p_window_seconds:windowSeconds,
    p_limit:limit
  });
}

async function finalize(requestId: string | null, statusCode: number, jobId: string | null, responseBody: unknown, metadata: Record<string,unknown> = {}) {
  if (!requestId) return;
  await rpc('ai_office_finalize_api_request', {
    p_request_id:requestId,
    p_status_code:statusCode,
    p_job_id:jobId,
    p_response_body:responseBody,
    p_metadata:{...metadata,stage:STAGE}
  });
}

async function upstreamState() {
  const response = await fetch(`${UPSTREAM}/state`, {headers:{'cache-control':'no-store'}});
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error('UPSTREAM_STATE_UNAVAILABLE');
  return body;
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok',{headers:CORS});
  let primaryRequestId: string | null = null;
  try {
    const path = pathOf(req);
    const method = req.method.toUpperCase();
    const rawBody = ['GET','HEAD'].includes(method) ? '' : await req.text();
    if (rawBody.length > 65536) return json({ok:false,error:'REQUEST_BODY_TOO_LARGE'},413);

    const selected = policy(path, method);
    if (selected) {
      const clientHash = await sha256(clientIdentity(req));
      const requestHash = selected.idempotent ? await sha256(`${method}|${path}|${rawBody}`) : null;
      const first = await rateCheck(clientHash,path,method,requestHash,selected.window,selected.limit);
      if (first?.duplicate) {
        const cached = first.response_body || {ok:true,job_id:first.job_id,duplicate:true};
        return json({...cached,duplicate:true,idempotency_replay:true},Number(first.status_code || 200));
      }
      if (!first?.allowed) {
        return json({ok:false,error:'RATE_LIMITED',retry_after_seconds:Number(first?.retry_after_seconds || selected.window)},429);
      }
      primaryRequestId = String(first.request_id || '') || null;
      if (selected.hourly) {
        const hourly = await rateCheck(clientHash,`${path}:hour`,method,null,3600,selected.hourly);
        if (!hourly?.allowed) {
          await finalize(primaryRequestId,429,null,{ok:false,error:'HOURLY_RATE_LIMITED'},{policy:'hourly'});
          return json({ok:false,error:'HOURLY_RATE_LIMITED',retry_after_seconds:3600},429);
        }
      }
    }

    if (path === '/admin/credential' && method === 'POST') {
      const current = await upstreamState();
      if (current?.credential_status?.configured) {
        const body = {ok:false,error:'CREDENTIAL_ROTATION_LOCKED',message:'Credential rotation must be performed directly in Supabase Vault.'};
        await finalize(primaryRequestId,423,null,body,{credential_rotation_locked:true});
        return json(body,423);
      }
    }

    const headers = new Headers();
    const contentType = req.headers.get('content-type');
    if (contentType) headers.set('content-type',contentType);
    const response = await fetch(`${UPSTREAM}${path}`, {
      method,
      headers,
      body:['GET','HEAD'].includes(method) ? undefined : rawBody
    });
    const text = await response.text();
    let parsed: any = null;
    try { parsed = JSON.parse(text); } catch {}
    const jobId = parsed?.job?.id || parsed?.job_id || null;
    await finalize(primaryRequestId,response.status,jobId,parsed || {raw_response:text.slice(0,2000)},{endpoint:path,method});

    if (parsed && path === '/state' && method === 'GET') {
      parsed.mode = STAGE;
      parsed.api_hardening = {
        rate_limit:true,
        command_idempotency:true,
        credential_rotation_locked:Boolean(parsed?.credential_status?.configured),
        job_transition_audit:true,
        dependency_failure_propagation:true
      };
      return json(parsed,response.status);
    }
    if (parsed && path === '/admin/preflight' && method === 'GET') {
      parsed.stage = STAGE;
      parsed.gates = {...(parsed.gates || {}),api_rate_limit:true,command_idempotency:true,job_transition_audit:true,dependency_failure_propagation:true};
      return json(parsed,response.status);
    }
    return new Response(text,{status:response.status,headers:{...CORS,'content-type':response.headers.get('content-type') || CORS['content-type']}});
  } catch (error) {
    const body = {ok:false,error:error instanceof Error ? error.message : 'STAGE11_GATEWAY_ERROR'};
    try { await finalize(primaryRequestId,500,null,body,{internal_error:true}); } catch {}
    console.error('STAGE11_GATEWAY_ERROR',error);
    return json(body,500);
  }
});
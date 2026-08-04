const BASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const REST = `${BASE_URL}/rest/v1`;
let bootPromise: Promise<(req:Request)=>Promise<Response>> | null = null;

async function sha256(value:string) {
  const hash = await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));
  return [...new Uint8Array(hash)].map(v=>v.toString(16).padStart(2,'0')).join('');
}

async function loadInternalSource() {
  const response = await fetch(`${REST}/ai_office_runtime_modules?select=version,source_text,source_sha256&module_key=eq.stage9_runner&is_active=eq.true&limit=1`,{
    headers:{apikey:SERVICE_KEY,authorization:`Bearer ${SERVICE_KEY}`,'cache-control':'no-store'}
  });
  const rows = await response.json().catch(()=>[]);
  if(!response.ok)throw new Error(`MODULE_DB_${response.status}`);
  const row=Array.isArray(rows)?rows[0]:null;
  if(!row?.source_text||!row?.source_sha256)throw new Error('INTERNAL_RUNTIME_MODULE_NOT_FOUND');
  const actual=await sha256(String(row.source_text));
  if(actual!==String(row.source_sha256))throw new Error('INTERNAL_RUNTIME_MODULE_HASH_MISMATCH');
  return {source:String(row.source_text),version:String(row.version||'unknown'),sha:actual};
}

function patchSource(source:string) {
  const originalKey = "const OPENAI_KEY = Deno.env.get('OPENAI_API_KEY') || '';";
  const gatewayKey = "const OPENAI_KEY = 'VAULT_GATEWAY';\nconst OPENAI_GATEWAY_URL = `${BASE_URL}/functions/v1/unity-ai-office-openai-gateway/responses`;";
  const originalFetch = "  const api = await fetch('https://api.openai.com/v1/responses', {";
  const gatewayFetch = "  const gatewayRuntime = await one('ai_office_runtime', 'select=internal_tick_token&id=eq.primary');\n  const gatewayToken = String(gatewayRuntime?.internal_tick_token || '');\n  if (gatewayToken.length !== 64) throw new Error('RUNNER_TOKEN_INVALID');\n  const api = await fetch(OPENAI_GATEWAY_URL, {";
  const originalHeaders = "    headers:{authorization:`Bearer ${OPENAI_KEY}`,'content-type':'application/json'},";
  const gatewayHeaders = "    headers:{'x-ai-office-runner-token':gatewayToken,'content-type':'application/json'},";
  if (!source.includes(originalKey) || !source.includes(originalFetch) || !source.includes(originalHeaders)) {
    throw new Error('RUNTIME_PATCH_TARGET_NOT_FOUND');
  }
  return source
    .replace(originalKey,gatewayKey)
    .replace(originalFetch,gatewayFetch)
    .replace(originalHeaders,gatewayHeaders);
}

async function boot(){
  if(typeof (globalThis as any).__UG_STAGE9_HANDLER__==='function')return (globalThis as any).__UG_STAGE9_HANDLER__;
  if(!bootPromise)bootPromise=(async()=>{
    const module=await loadInternalSource();
    const source=patchSource(module.source);
    (0,eval)(source);
    const handler=(globalThis as any).__UG_STAGE9_HANDLER__;
    if(typeof handler!=='function')throw new Error('RUNTIME_HANDLER_NOT_REGISTERED');
    console.log('INTERNAL_RUNTIME_MODULE_LOADED',module.version,module.sha);
    return handler;
  })();
  return await bootPromise;
}

Deno.serve(async req=>{
  try{return await (await boot())(req)}
  catch(error){
    console.error('RUNTIME_BOOT_ERROR',error);
    bootPromise=null;
    return new Response(JSON.stringify({ok:false,error:'RUNTIME_BOOT_ERROR',detail:error instanceof Error?error.message:String(error)}),{status:500,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
  }
});
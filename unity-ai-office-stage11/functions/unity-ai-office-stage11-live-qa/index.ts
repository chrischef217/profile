const BASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const REST = `${BASE_URL}/rest/v1`;
const RUNNER_V2 = `${BASE_URL}/functions/v1/unity-ai-office-runner-v2`;
const GAME = 'https://raw.githack.com/chrischef217/profile/main/unity-ai-office-v5/index.html';
const PAYLOAD = 'https://raw.githack.com/chrischef217/profile/main/unity-ai-office-v5/payload-a.js';
const STAGE = 'ONLINE_MULTI_AGENT_STAGE_11_HARDENED';
function json(data: unknown,status=200){return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}})}
async function db(path:string,init:RequestInit={}){const headers=new Headers(init.headers||{});headers.set('apikey',SERVICE_KEY);headers.set('authorization',`Bearer ${SERVICE_KEY}`);headers.set('content-type','application/json');const response=await fetch(`${REST}/${path}`,{...init,headers});const text=await response.text();let body:any=null;if(text){try{body=JSON.parse(text)}catch{body=text}}if(!response.ok)throw new Error(`DB_${response.status}:${path}`);return body}
async function token(){const rows=await db('ai_office_runtime?select=internal_tick_token&id=eq.primary&limit=1');return String(rows?.[0]?.internal_tick_token||'')}
async function authorized(req:Request){const expected=await token();return expected.length===64&&(req.headers.get('x-ai-office-runner-token')||'')===expected}
async function probe(name:string,url:string,options:RequestInit={}){const started=Date.now();try{const response=await fetch(url,{...options,signal:AbortSignal.timeout(30000)});const contentType=response.headers.get('content-type')||'';const text=await response.text();let body:any=null;try{body=JSON.parse(text)}catch{body=text.slice(0,500)}return{name,status:response.status,content_type:contentType,duration_ms:Date.now()-started,body}}catch(error){return{name,status:0,content_type:'',duration_ms:Date.now()-started,error:error instanceof Error?error.message:String(error)}}}
Deno.serve(async req=>{if(req.method!=='POST')return json({ok:false,error:'METHOD_NOT_ALLOWED'},405);if(!(await authorized(req)))return json({ok:false,error:'UNAUTHORIZED_QA'},401);const runRows=await db('ai_office_system_test_runs',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({test_suite:'STAGE11_LIVE_DEPLOYMENT',status:'RUNNING'})});const runId=String(runRows?.[0]?.id||'');const checks:any[]=[];let finalStatus='PASS',errorMessage:string|null=null;try{const runnerToken=await token();const [runtimeRows,integrity,executionRows,budgetRows,qualityRows,runnerUnauthorized,runnerAuthorized,gameHtml,gamePayload]=await Promise.all([
  db('ai_office_runtime?select=environment_mode,workday_enabled,last_tick_at,last_tick_result&id=eq.primary'),
  db('rpc/ai_office_document_integrity',{method:'POST',body:'{}'}),
  db('ai_office_execution_config?select=model_enabled,tool_execution_enabled,approval_channel_enabled,disabled_reason&id=eq.primary'),
  db('ai_office_budget_policy?select=hard_stop,require_verified_model_price,daily_cost_limit_thb,monthly_cost_limit_thb&id=eq.primary'),
  db('ai_office_quality_policy?select=enabled,min_pass_score,max_revisions,block_on_unsupported_claim,block_on_critical_conflict&id=eq.primary'),
  probe('RUNNER_UNAUTHORIZED',RUNNER_V2,{method:'POST',headers:{'content-type':'application/json'},body:'{}'}),
  probe('RUNNER_AUTHORIZED',RUNNER_V2,{method:'POST',headers:{'content-type':'application/json','x-ai-office-runner-token':runnerToken},body:JSON.stringify({reason:'STAGE11_LIVE_QA'})}),
  probe('GAME_HTML',GAME,{headers:{'user-agent':'UnityGlobal-Stage11-QA'}}),
  probe('GAME_PAYLOAD',PAYLOAD,{headers:{'user-agent':'UnityGlobal-Stage11-QA'}})
]);
const runtime=runtimeRows?.[0]||{},execution=executionRows?.[0]||{},budget=budgetRows?.[0]||{},quality=qualityRows?.[0]||{};
checks.push({name:'RUNTIME_STAGE',ok:runtime.environment_mode===STAGE,actual:runtime.environment_mode});
checks.push({name:'DOCUMENT_INTEGRITY',ok:integrity?.status==='PASS',actual:integrity});
checks.push({name:'SCHEDULER',ok:runtime.workday_enabled===true&&Boolean(runtime.last_tick_at),last_tick_at:runtime.last_tick_at});
checks.push({name:'EXTERNAL_TOOLS_DISABLED',ok:execution.tool_execution_enabled===false});
checks.push({name:'APPROVAL_CHANNEL',ok:execution.approval_channel_enabled===true});
checks.push({name:'BUDGET_HARD_STOP',ok:budget.hard_stop===true&&budget.require_verified_model_price===true});
checks.push({name:'QUALITY_GATE',ok:quality.enabled===true&&Number(quality.min_pass_score)>=85&&quality.block_on_unsupported_claim===true&&quality.block_on_critical_conflict===true});
checks.push({...runnerUnauthorized,name:'RUNNER_UNAUTHORIZED_PROBE',ok:runnerUnauthorized.status===401});
checks.push({...runnerAuthorized,name:'RUNNER_AUTHORIZED_PROBE',ok:runnerAuthorized.status===200});
checks.push({...gameHtml,name:'GAME_HTML_PROBE',ok:gameHtml.status===200&&String(gameHtml.content_type).includes('text/html')});
checks.push({...gamePayload,name:'GAME_PAYLOAD_PROBE',ok:gamePayload.status===200&&(String(gamePayload.content_type).includes('javascript')||String(gamePayload.body).includes('__UG_V5_PAYLOAD'))});
if(checks.some(item=>item.ok!==true)){finalStatus='FAIL';errorMessage='ONE_OR_MORE_LIVE_ASSERTIONS_FAILED'}}catch(error){finalStatus='FAIL';errorMessage=error instanceof Error?error.message:String(error)}
const result={stage:STAGE,checks,passed:checks.filter(x=>x.ok===true).length,failed:checks.filter(x=>x.ok!==true).length,checked_at:new Date().toISOString()};await db(`ai_office_system_test_runs?id=eq.${runId}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({status:finalStatus,checks,result,error_message:errorMessage,completed_at:new Date().toISOString()})});return json({ok:finalStatus==='PASS',run_id:runId,status:finalStatus,...result},finalStatus==='PASS'?200:500)});
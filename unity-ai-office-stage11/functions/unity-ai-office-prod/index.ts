const BASE = Deno.env.get('SUPABASE_URL') || '';
const UPSTREAM = `${BASE}/functions/v1/unity-ai-office-prod-v5`;
const MARKER = '/unity-ai-office-prod';
const CORS = {
  'access-control-allow-origin':'*',
  'access-control-allow-headers':'content-type,x-client-info,apikey',
  'access-control-allow-methods':'GET,POST,DELETE,OPTIONS',
  'cache-control':'no-store'
};
function pathOf(req: Request) {
  const pathname = new URL(req.url).pathname;
  const index = pathname.indexOf(MARKER);
  return index < 0 ? '/' : pathname.slice(index + MARKER.length) || '/';
}
Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok',{headers:CORS});
  try {
    const path = pathOf(req);
    const body = ['GET','HEAD'].includes(req.method) ? undefined : await req.text();
    const headers = new Headers();
    const contentType = req.headers.get('content-type');
    const clientInfo = req.headers.get('x-client-info');
    const forwardedFor = req.headers.get('x-forwarded-for');
    const connectingIp = req.headers.get('cf-connecting-ip');
    const userAgent = req.headers.get('user-agent');
    if (contentType) headers.set('content-type',contentType);
    if (clientInfo) headers.set('x-client-info',clientInfo);
    if (forwardedFor) headers.set('x-forwarded-for',forwardedFor);
    if (connectingIp) headers.set('cf-connecting-ip',connectingIp);
    if (userAgent) headers.set('user-agent',userAgent);
    const response = await fetch(`${UPSTREAM}${path}`,{method:req.method,headers,body});
    return new Response(await response.text(),{
      status:response.status,
      headers:{...CORS,'content-type':response.headers.get('content-type') || 'application/json; charset=utf-8'}
    });
  } catch (error) {
    console.error('STAGE11_COMPATIBILITY_PROXY_ERROR',error);
    return new Response(JSON.stringify({ok:false,error:'STAGE11_COMPATIBILITY_PROXY_ERROR'}),{
      status:500,
      headers:{...CORS,'content-type':'application/json; charset=utf-8'}
    });
  }
});
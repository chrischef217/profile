export const config = { runtime: 'edge' };

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export default async function handler(request) {
  if (request.method === "OPTIONS") return new Response(null, { headers: cors });
  if (request.method !== "GET") return new Response("Method not allowed", { status: 405, headers: cors });

  const apiKey = process.env.STABILITY_API_KEY;
  if (!apiKey) return new Response("STABILITY_API_KEY secret is missing.", { status: 503, headers: cors });

  try {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    if (!id) return new Response("id is required", { status: 400, headers: cors });

    const upstream = await fetch("https://api.stability.ai/v2beta/audio/results/" + encodeURIComponent(id), {
      headers: {
        "authorization": "Bearer " + apiKey,
        "accept": "audio/*",
      },
    });

    const headers = new Headers(cors);
    headers.set("Content-Type", upstream.headers.get("Content-Type") || (upstream.status === 202 ? "application/json" : "audio/mpeg"));
    return new Response(upstream.body, { status: upstream.status, headers });
  } catch (e) {
    return new Response("Server error: " + e.message, { status: 500, headers: cors });
  }
}

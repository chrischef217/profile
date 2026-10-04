export const config = { runtime: 'edge' };

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export default async function handler(request) {
  if (request.method === "OPTIONS") return new Response(null, { headers: cors });
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405, headers: cors });

  const apiKey = process.env.STABILITY_API_KEY;
  if (!apiKey) return new Response("STABILITY_API_KEY secret is missing.", { status: 503, headers: cors });

  try {
    const incoming = await request.formData();
    const audio = incoming.get("audio");
    if (!(audio instanceof File)) return new Response("audio file is required", { status: 400, headers: cors });

    const fd = new FormData();
    fd.append("audio", audio, audio.name || "humming.wav");
    fd.append("prompt", String(incoming.get("prompt") || "").slice(0, 10000));
    fd.append("output_format", "mp3");
    fd.append("duration", String(Math.max(6, Math.min(360, Number(incoming.get("duration") || 90)))));
    fd.append("strength", String(Math.max(0.01, Math.min(1, Number(incoming.get("strength") || 0.55)))));

    const upstream = await fetch("https://api.stability.ai/v2beta/audio/stable-audio/audio-to-audio", {
      method: "POST",
      headers: {
        "authorization": "Bearer " + apiKey,
        "accept": "application/json",
      },
      body: fd,
    });

    const txt = await upstream.text();
    return new Response(txt, {
      status: upstream.status,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response("Server error: " + e.message, { status: 500, headers: cors });
  }
}

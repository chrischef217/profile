export const config = { runtime: 'edge' };

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export default async function handler(request) {
  if (request.method === "OPTIONS") return new Response(null, { headers: cors });
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405, headers: cors });

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) return new Response("ELEVENLABS_API_KEY secret is missing.", { status: 503, headers: cors });

  try {
    const body = await request.json();
    const prompt = String(body.prompt || "").slice(0, 4100);
    const musicLength = Math.max(3000, Math.min(600000, Number(body.music_length_ms || 90000)));

    if (!prompt) return new Response("prompt is required", { status: 400, headers: cors });

    const upstream = await fetch("https://api.elevenlabs.io/v1/music?output_format=mp3_48000_192", {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt,
        music_length_ms: musicLength,
        model_id: "music_v2_5",
        force_instrumental: !!body.force_instrumental,
        store_for_inpainting: true,
        sign_with_c2pa: true,
      }),
    });

    const headers = new Headers(cors);
    headers.set("Content-Type", upstream.headers.get("Content-Type") || "audio/mpeg");
    if (!upstream.ok) return new Response(await upstream.text(), { status: upstream.status, headers });
    return new Response(upstream.body, { status: 200, headers });
  } catch (e) {
    return new Response("Server error: " + e.message, { status: 500, headers: cors });
  }
}

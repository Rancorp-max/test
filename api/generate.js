// api/generate.js
// Drop-in: polls Replicate until status === "succeeded", then returns { image: <final-url> }

const MODEL = "black-forest-labs/flux-kontext-pro";

// Poll helper: follow data.urls.get until status is succeeded/failed/canceled
async function pollPrediction(getUrl, token, { timeoutMs = 60000, intervalMs = 1200 } = {}) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const resp = await fetch(getUrl, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await resp.json();
    if (!resp.ok) {
      throw new Error(data?.error || "Replicate polling error");
    }

    const status = data?.status;
    if (status === "succeeded") {
      // Return first output URL if array, or string
      if (Array.isArray(data?.output) && data.output.length > 0) return data.output[0];
      if (typeof data?.output === "string") return data.output;
      throw new Error("No output URL in succeeded response");
    }
    if (status === "failed" || status === "canceled") {
      throw new Error(`Prediction ${status}`);
    }

    // keep waiting
    await new Promise(r => setTimeout(r, intervalMs));
  }
  throw new Error("Prediction polling timed out");
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { image, prompt } = req.body || {};
  if (!image || !prompt) {
    return res.status(400).json({ error: "Missing required fields: image, prompt" });
  }

  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) {
    console.error("Missing REPLICATE_API_TOKEN env var");
    return res.status(500).json({ error: "Server misconfigured (no API token)" });
  }

  try {
    const endpoint = `https://api.replicate.com/v1/models/${MODEL}/predictions?wait=true`;
    // IMPORTANT: flux-kontext-pro expects input_image (not image). aspect_ratio supported.
    const input = {
      prompt,
      input_image: image,
      aspect_ratio: "4:5",
      guidance: 3,
      strength: 0.7,
      num_outputs: 1
    };

    console.log("Calling Replicate:", { model: MODEL, hasPrompt: !!prompt, hasImage: !!image });

    const r = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ input })
    });

    const data = await r.json();

    if (!r.ok) {
      console.error("Replicate API error:", data);
      return res.status(500).json({ error: data?.error || "Replicate call failed", raw: data });
    }

    console.log("Replicate raw response:", data);

    // Attempt to extract a direct image URL
    let outUrl = null;
    if (Array.isArray(data?.output) && data.output.length > 0) {
      outUrl = data.output[0];
    } else if (typeof data?.output === "string") {
      outUrl = data.output;
    }

    // If no direct output yet but we have a polling URL, poll until it's ready
    if (!outUrl && data?.urls?.get) {
      try {
        outUrl = await pollPrediction(data.urls.get, token);
      } catch (e) {
        console.error("Polling failed:", e?.message || e);
        return res.status(500).json({ error: e?.message || "Polling failed" });
      }
    }

    if (!outUrl) {
      console.error("No usable output URL found:", data);
      return res.status(500).json({ error: "No output URL found", raw: data });
    }

    // Always return { image: "<final image url>" }
    return res.status(200).json({ image: outUrl });
  } catch (e) {
    console.error("Server error:", e);
    return res.status(500).json({ error: "Unexpected server error" });
  }
}

// /app/api/persona/generate/route.js
export const runtime = "node";

const FLUX_KONTEXT_MODEL = process.env.FLUX_KONTEXT_MODEL || "black-forest-labs/flux-kontext-pro";
const FLUX_FILL_MODEL    = process.env.FLUX_FILL_MODEL    || "black-forest-labs/flux-fill-pro";
// 🔁 Use a public SAM2 endpoint by default (fallback if you change it)
const SEGMENT_MODEL_PRIMARY   = process.env.SEGMENT_MODEL || "lucataco/segment-anything-2";
// Optional second try (leave empty to skip)
const SEGMENT_MODEL_FALLBACK  = process.env.SEGMENT_MODEL_FALLBACK || "";

const CANNY_MODEL = process.env.CANNY_MODEL || "jagilley/controlnet-canny";
const DEPTH_MODEL = process.env.DEPTH_MODEL || "chenxwh/depth-anything-v2";

async function replicatePredict(modelSlug, input) {
  const r = await fetch(`https://api.replicate.com/v1/models/${modelSlug}/predictions`, {
    method: "POST",
    headers: {
      Authorization: `Token ${process.env.REPLICATE_API_TOKEN}`,
      "Content-Type": "application/json",
      "Prefer": "wait"
    },
    body: JSON.stringify({ input })
  });
  const j = await r.json();
  if (!r.ok) {
    const msg = j?.detail || j?.error || JSON.stringify(j);
    throw new Error(`[Replicate ${modelSlug}] ${msg}`);
  }
  const out = Array.isArray(j.output) ? j.output[0] : j.output;
  if (!out) throw new Error(`[Replicate ${modelSlug}] Empty output`);
  return out;
}

function buildGuardedPrompt(userPrompt = "", structureHint = "") {
  const guard =
    "Transform everyone in this uploaded group photo while preserving each person’s facial features, expressions, body positions, and relative placement. " +
    "Do not add or generate any extra people — only include the individuals originally present in the uploaded image. " +
    "Photorealistic rendering, studio-grade lighting, sharp facial details, lifelike textures, cinematic depth of field. ";
  const tail =
    " Maintain the original group arrangement and proportions; consistent styling across all subjects; print-ready quality.";
  return `${guard}${structureHint}${(userPrompt || "").trim()}${tail}`;
}

// Try primary SAM2; if unavailable, try fallback; otherwise return null (caller will degrade gracefully)
async function tryGetMaskUrl(image, task) {
  const tryOne = async (slug) => {
    if (!slug) return null;
    // Many SAM2 wrappers just need { image }; some accept task/mode—safe to pass anyway.
    return await replicatePredict(slug, { image, task });
  };
  try {
    return await tryOne(SEGMENT_MODEL_PRIMARY);
  } catch (_) {
    try {
      return await tryOne(SEGMENT_MODEL_FALLBACK);
    } catch (__){ return null; }
  }
}

export async function POST(req) {
  try {
    if (!process.env.REPLICATE_API_TOKEN) {
      return Response.json({ error: "Missing REPLICATE_API_TOKEN" }, { status: 500 });
    }

    const body = await req.json();
    const {
      image,
      prompt,
      transform = "global",   // "global" | "outfits_bg" | "background_only"
      control = "none",       // "none" | "canny" | "depth"
      preserveFaces = true
    } = body || {};

    if (!image) {
      return Response.json({ error: "Missing image" }, { status: 400 });
    }

    // Optional structure hint (text nudge; we don’t attach control_image to Kontext)
    let structureHint = "";
    if (control === "canny") {
      try { await replicatePredict(CANNY_MODEL, { image }); } catch {}
      structureHint = " Follow the original composition and edge contours; keep outlines and placements consistent. ";
    } else if (control === "depth") {
      try { await replicatePredict(DEPTH_MODEL, { image }); } catch {}
      structureHint = " Preserve subject distances and spatial layout consistent with the original depth structure. ";
    }

    const finalPrompt = buildGuardedPrompt(prompt, structureHint);
    let resultUrl = null;

    if (transform === "global") {
      resultUrl = await replicatePredict(FLUX_KONTEXT_MODEL, {
        input_image: image,
        prompt: finalPrompt,
        output_format: "jpg"
      });
    } else if (transform === "outfits_bg") {
      // Get a face/person mask. If SAM2 isn’t accessible, gracefully fallback to Kontext global.
      const maskUrl = await tryGetMaskUrl(image, preserveFaces ? "face" : "person");
      if (!maskUrl) {
        // fallback path
        resultUrl = await replicatePredict(FLUX_KONTEXT_MODEL, {
          input_image: image,
          prompt: finalPrompt,
          output_format: "jpg"
        });
      } else {
        resultUrl = await replicatePredict(FLUX_FILL_MODEL, {
          image,
          mask: maskUrl,       // mask shows faces/person; invert to keep mask area and edit the rest
          prompt: finalPrompt,
          output_format: "jpg",
          mask_invert: true
        });
      }
    } else if (transform === "background_only") {
      // Mask people so we can invert and edit background only
      const peopleMaskUrl = await tryGetMaskUrl(image, "person");
      if (!peopleMaskUrl) {
        // fallback: at least do a Kontext background-style change globally
        resultUrl = await replicatePredict(FLUX_KONTEXT_MODEL, {
          input_image: image,
          prompt: finalPrompt,
          output_format: "jpg"
        });
      } else {
        resultUrl = await replicatePredict(FLUX_FILL_MODEL, {
          image,
          mask: peopleMaskUrl, // mask shows people → invert to edit only background
          prompt: finalPrompt,
          output_format: "jpg",
          mask_invert: true
        });
      }
    } else {
      return Response.json({ error: `Unknown transform option: ${transform}` }, { status: 400 });
    }

    return Response.json({ image: resultUrl }, { status: 200 });
  } catch (err) {
    return Response.json({ error: String(err?.message || err) }, { status: 500 });
  }
}

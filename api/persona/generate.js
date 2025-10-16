// /app/api/persona/generate/route.js
// Next.js App Router (no res/req from pages API). Uses Web Fetch + Response.
// Runtime: Node is safer for large images and external fetch.
export const runtime = "node";

const FLUX_KONTEXT_MODEL = process.env.FLUX_KONTEXT_MODEL || "black-forest-labs/flux-kontext-pro";
const FLUX_FILL_MODEL    = process.env.FLUX_FILL_MODEL    || "black-forest-labs/flux-fill-pro";
const SEGMENT_MODEL      = process.env.SEGMENT_MODEL      || "meta/sam-2";
const CANNY_MODEL        = process.env.CANNY_MODEL        || "replicate/canny";
const DEPTH_MODEL        = process.env.DEPTH_MODEL        || "chenxwh/depth-anything-v2";

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

export async function POST(req) {
  try {
    if (!process.env.REPLICATE_API_TOKEN) {
      return Response.json({ error: "Missing REPLICATE_API_TOKEN" }, { status: 500 });
    }

    const body = await req.json();
    const {
      image,                  // data URL or https URL (required)
      prompt,                 // optional theme text
      transform = "global",   // "global" | "outfits_bg" | "background_only"
      control = "none",       // "none" | "canny" | "depth"
      preserveFaces = true    // for Fill-based edits
    } = body || {};

    if (!image) {
      return Response.json({ error: "Missing image" }, { status: 400 });
    }

    // Optional structure hint (text nudge only)
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
      // FLUX Kontext: input_image, prompt, output_format
      resultUrl = await replicatePredict(FLUX_KONTEXT_MODEL, {
        input_image: image,
        prompt: finalPrompt,
        output_format: "jpg"
      });
    } else if (transform === "outfits_bg") {
      // 1) Get a face/person mask via SAM-2 (implementation must return a mask image URL)
      const maskUrl = await replicatePredict(SEGMENT_MODEL, {
        image,
        task: preserveFaces ? "face" : "person"
      });
      // 2) FLUX Fill: image, mask, prompt, output_format, mask_invert
      resultUrl = await replicatePredict(FLUX_FILL_MODEL, {
        image,
        mask: maskUrl,           // mask shows faces → invert to protect faces, edit outfits+bg
        prompt: finalPrompt,
        output_format: "jpg",
        mask_invert: true
      });
    } else if (transform === "background_only") {
      // 1) Mask people so we can invert and edit background only
      const peopleMaskUrl = await replicatePredict(SEGMENT_MODEL, { image, task: "person" });
      resultUrl = await replicatePredict(FLUX_FILL_MODEL, {
        image,
        mask: peopleMaskUrl,     // mask shows people → invert to edit only background
        prompt: finalPrompt,
        output_format: "jpg",
        mask_invert: true
      });
    } else {
      return Response.json({ error: `Unknown transform option: ${transform}` }, { status: 400 });
    }

    return Response.json({ image: resultUrl }, { status: 200 });
  } catch (err) {
    return Response.json({ error: String(err?.message || err) }, { status: 500 });
  }
}

// ESM + Node runtime
export const config = { runtime: "nodejs" };

import { list, put } from "@vercel/blob";

// One place to change the key if you ever need to
const LEADS_KEY = "petsona/leads.json";

function send(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.end(JSON.stringify(payload));
}

export default async function handler(req, res) {
  // CORS (safe default)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return send(res, 200, { ok: true });

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST, OPTIONS");
    return send(res, 405, { ok: false, error: "Method not allowed" });
  }

  try {
    const body = await readJson(req);
    const nowIso = new Date().toISOString();

    // Normalize incoming payload
    const lead = {
      id: cryptoRandomId(),
      email: String(body?.email || "").trim().toLowerCase(),
      consent: {
        marketing: !!(body?.consent?.marketing),
        processing: true,
      },
      meta: {
        persona: body?.meta?.persona || null,
        referrer: body?.meta?.referrer || req.headers.referer || null,
        ua: body?.user_agent || req.headers["user-agent"] || null,
        ts: nowIso,
      },
      image: body?.image || "",
    };

    if (!lead.email || !/^\S+@\S+\.\S+$/.test(lead.email)) {
      return send(res, 400, { ok: false, error: "Invalid email" });
    }

    // ---- Read current array (if any) ----
    let current = [];
    let existed = false;
    let srcUrl = null;

    const { blobs } = await list({ prefix: LEADS_KEY, limit: 1 });
    if (blobs && blobs.length > 0) {
      existed = true;
      srcUrl = blobs[0].url;
      const r = await fetch(srcUrl, { cache: "no-store" });
      if (r.ok) {
        try {
          const json = await r.json();
          if (Array.isArray(json)) current = json;
        } catch {
          // Corrupt/empty file → start new array
          current = [];
        }
      }
    }

    // ---- Merge (prepend newest first) ----
    const next = [lead, ...current];

    // ---- Write back (PUBLIC!) ----
    const putResp = await put(LEADS_KEY, JSON.stringify(next), {
      access: "public",
      contentType: "application/json; charset=utf-8",
      // Overwrite same key (no random suffix)
      addRandomSuffix: false,
    });

    return send(res, 200, {
      ok: true,
      message: "Lead stored",
      wroteKey: LEADS_KEY,
      existed,
      size: next.length,
      publicUrl: putResp.url,
      lead,
    });
  } catch (err) {
    console.error("[/api/save-lead] error:", err);
    const msg = String(err?.message || err);
    // Friendly hint
    if (msg.includes("BLOB_READ_WRITE_TOKEN")) {
      return send(res, 500, {
        ok: false,
        error: "Missing BLOB_READ_WRITE_TOKEN env var in Vercel project settings.",
      });
    }
    if (msg.includes('access must be "public"')) {
      return send(res, 500, {
        ok: false,
        error:
          'Vercel Blob requires `access: "public"` for public reads. The handler sets this already. If you still see this, update @vercel/blob to the latest version.',
      });
    }
    return send(res, 500, { ok: false, error: msg });
  }
}

async function readJson(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString("utf8") || "{}";
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function cryptoRandomId() {
  // short-ish unique id
  return (globalThis.crypto?.randomUUID?.() ||
    "id-" + Math.random().toString(36).slice(2) + Date.now().toString(36));
}

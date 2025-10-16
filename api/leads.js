// ESM + Node runtime
export const config = { runtime: "nodejs" };

import { head, list } from "@vercel/blob";

const LEADS_KEY = "petsona/leads.json";

function send(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.end(JSON.stringify(payload));
}

export default async function handler(req, res) {
  // CORS so your dashboard page can call this from the browser
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return send(res, 200, { ok: true });
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET, OPTIONS");
    return send(res, 405, { ok: false, error: "Method not allowed" });
  }

  try {
    // First, try an authorized head() lookup (works for private/public blobs)
    let downloadUrl = null;
    try {
      const meta = await head(LEADS_KEY); // throws if not found
      // meta.url is an authorized, time-limited URL you can fetch server-side
      downloadUrl = meta?.url || null;
    } catch {
      // If head() can't find it, fall back to list() + public url (older SDKs)
      const { blobs } = await list({ prefix: LEADS_KEY, limit: 1 });
      if (blobs && blobs.length) downloadUrl = blobs[0].url;
    }

    if (!downloadUrl) return send(res, 200, { ok: true, data: [], count: 0 });

    // Server-side fetch (authorized for meta.url; public for blob.url)
    const r = await fetch(downloadUrl, { cache: "no-store" });
    if (!r.ok) {
      // Helpful diagnostics
      return send(res, 500, {
        ok: false,
        error: `Blob fetch failed: ${r.status}`,
      });
    }

    let arr = [];
    try {
      const json = await r.json();
      if (Array.isArray(json)) arr = json;
    } catch {
      arr = [];
    }

    // newest first
    arr.sort((a, b) => {
      const ta = new Date(a?.meta?.ts || 0).getTime();
      const tb = new Date(b?.meta?.ts || 0).getTime();
      return tb - ta;
    });

    return send(res, 200, { ok: true, data: arr, count: arr.length });
  } catch (err) {
    console.error("[/api/leads] fatal:", err);
    const msg = String(err?.message || err);
    if (msg.includes("BLOB_READ_WRITE_TOKEN")) {
      return send(res, 500, {
        ok: false,
        error: "Missing BLOB_READ_WRITE_TOKEN in your Vercel project.",
      });
    }
    return send(res, 500, { ok: false, error: msg });
  }
}

// api/upload.js
export const config = { runtime: "nodejs" };

import { put } from "@vercel/blob";
import { randomUUID } from "node:crypto";

function safeName(name = "upload") {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 80);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    // We send the raw file as the request body (application/octet-stream)
    const contentType =
      req.headers["x-content-type"] ||
      req.headers["content-type"] ||
      "application/octet-stream";
    const originalName = safeName(req.headers["x-filename"] || "upload.bin");

    // Read the whole request stream into a Buffer
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const buffer = Buffer.concat(chunks);

    const key = `uploads/${new Date()
      .toISOString()
      .slice(0, 10)}-${randomUUID()}-${originalName}`;

    // Store in Vercel Blob with public access
    const blob = await put(key, buffer, {
      access: "public",
      contentType,
      addRandomSuffix: false,
    });

    return res.status(200).json({
      ok: true,
      url: blob.url,
      size: buffer.length,
      key,
    });
  } catch (err) {
    console.error("[upload] error:", err);
    return res.status(500).json({ ok: false, error: String(err?.message || err) });
  }
}

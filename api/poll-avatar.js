// /api/poll-avatar.js

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Only GET requests allowed" });
  }

  const { id } = req.query;

  try {
    const response = await fetch(`https://api.replicate.com/v1/predictions/${id}`, {
      method: "GET",
      headers: {
        Authorization: `Token ${process.env.REPLICATE_API_TOKEN}`,
        "Content-Type": "application/json"
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({ error: errorText });
    }

    const prediction = await response.json();
    const { status, output, error } = prediction;

    if (status === "succeeded") {
      res.status(200).json({ status, output });
    } else if (status === "failed") {
      res.status(200).json({ status, error });
    } else {
      res.status(200).json({ status });
    }
  } catch (err) {
    console.error("Polling error:", err);
    res.status(500).json({ error: "Failed to poll prediction status" });
  }
}

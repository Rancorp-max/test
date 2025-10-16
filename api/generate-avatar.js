export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Only POST requests allowed" });
  }

  const { image, prompt } = req.body;

  try {
    const response = await fetch("https://api.replicate.com/v1/models/black-forest-labs/flux-kontext-pro/predictions", {
      method: "POST",
      headers: {
        Authorization: `Token ${process.env.REPLICATE_API_TOKEN}`,  // ✅ Make sure this token is valid
        "Content-Type": "application/json",
        "Prefer": "wait"
      },
      body: JSON.stringify({
        input: {
          input_image: image,
          prompt: prompt || "Make this image an illustration of a bustling, magical desert city with glowing towers and golden domes at sunset. A young hero (whose face is this) holding a glowing magic lamp stands beside a flying carpet, with a curious monkey and a princess in a jeweled gown nearby. The atmosphere is warm, mystical, and rich with detail—lanterns float, stars twinkle, and sand sparkles. The hero should resemble the uploaded image of a face. The hero should be a age appropriate within the context of the illustration, so remove any beard.",
          output_format: "jpg"
        }
      })
    });

    if (!response.ok) {
      const error = await response.json();
      return res.status(response.status).json(error);
    }

    const prediction = await response.json();
    const resultUrl = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;

    res.status(200).json({ image: resultUrl });
  } catch (error) {
    console.error("Replicate error:", error);
    res.status(500).json({ error: "Failed to generate image" });
  }
}

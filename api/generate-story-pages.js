// /api/generate-story-pages.js

import Replicate from "replicate";

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

export default async function handler(req, res) {
  const { image, prompts } = req.body;

  if (!image || !prompts || !Array.isArray(prompts)) {
    return res.status(400).json({ error: "Missing image or prompts array." });
  }

  try {
    const results = await Promise.all(
      prompts.map(async (prompt) => {
        const prediction = await replicate.run(
          "black-forest-labs/flux-kontext-pro:95e8698ad794d3d8c8c4c60d685cf5a36092753c0194b44273540470b26fa51a",
          {
            input: {
              prompt,
              input_image: image,
            },
          }
        );

        // replicate.run returns the output array (typically just 1 image URL)
        return Array.isArray(prediction) ? prediction[0] : prediction;
      })
    );

    res.status(200).json({ pages: results });
  } catch (err) {
    console.error("Story page generation error:", err);
    res.status(500).json({ error: "Failed to generate pages" });
  }
}

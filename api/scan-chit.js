/**
 * Biroba Vegetable Suppliers — Vercel Serverless Function: Scan Slip with Gemini Vision
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  }

  const { base64Data, mimeType = 'image/jpeg' } = req.body || {};
  if (!base64Data) {
    return res.status(400).json({ ok: false, error: 'Missing base64Data' });
  }

  const apiKey = (process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '').trim();
  if (!apiKey) {
    return res.status(500).json({ ok: false, error: 'GEMINI_API_KEY is not configured on server' });
  }

  const prompt = `You are an expert Indian wholesale vegetable and fruit market assistant at Byculla / Dadar Market, Mumbai.
Carefully inspect this image of an order chit or handwritten paper note.
1. Detect any customer / hotel name mentioned (e.g. SURYA, SAI DARSHAN, BHAGAT TARACHAND, LOCOMO, HIGHWAY TEA).
2. Extract all vegetable, green, mushroom, and fruit items ordered with numeric quantity and unit (kg, bundle, pkt, 100 pcs, pcs).
Return strictly valid JSON:
{
  "customer": "HOTEL NAME IF FOUND",
  "rawText": "exact lines of text read from note separated by newlines",
  "items": [
    { "rawName": "kobi", "quantity": 4, "unit": "kg" }
  ]
}`;

  const models = ['gemini-3.1-flash-lite', 'gemini-flash-lite-latest', 'gemini-3.5-flash', 'gemini-3.8-flash'];

  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }, { inlineData: { mimeType, data: base64Data } }] }],
          generationConfig: { responseMimeType: 'application/json', temperature: 0.1 }
        })
      });

      if (resp.status === 200) {
        const data = await resp.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        const clean = text.replace(/^```[a-z]*\s*/i, '').replace(/```\s*$/i, '').trim();
        const parsed = JSON.parse(clean);
        return res.status(200).json({ ok: true, data: parsed, modelUsed: model });
      }
    } catch (err) {
      console.warn(`[Vercel /api/scan-chit] Model ${model} failed:`, err.message);
    }
  }

  return res.status(500).json({ ok: false, error: 'Failed to extract items from slip.' });
}

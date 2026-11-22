/**
 * Biroba Vegetable Suppliers — Gemini Vision Chit Extractor
 * 
 * Takes an image (from phone camera or file upload), resizes it for quick transmission,
 * and calls Gemini 3.5 Flash Vision to extract vegetable order items, quantities, units,
 * and customer hotel names.
 */

const GEMINI_MODELS = [
  'gemini-3.1-flash-lite',
  'gemini-flash-lite-latest',
  'gemini-3.5-flash',
  'gemini-3.8-flash'
];

/**
 * Resizes and compresses an image file or DataURL using an offscreen canvas
 * Optimized to maxDimension 1024 and quality 0.75 to consume minimum vision tokens
 * @param {File|Blob|string} imageSource 
 * @param {number} maxDimension 
 * @param {number} quality 
 * @returns {Promise<{ base64Data: string, mimeType: string }>}
 */
export async function prepareImageForAI(imageSource, maxDimension = 1024, quality = 0.75) {
  return new Promise((resolve, reject) => {
    let src = '';
    let shouldRevoke = false;

    if (typeof imageSource === 'string') {
      src = imageSource;
    } else if (imageSource instanceof Blob || imageSource instanceof File) {
      src = URL.createObjectURL(imageSource);
      shouldRevoke = true;
    } else {
      return reject(new Error('Invalid image source'));
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;

        // Downscale while preserving aspect ratio if larger than maxDimension
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        // Clean white background in case of transparent png
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        const mimeType = 'image/jpeg';
        const dataUrl = canvas.toDataURL(mimeType, quality);
        const base64Data = dataUrl.replace(/^data:image\/[a-z]+;base64,/, '');

        if (shouldRevoke) URL.revokeObjectURL(src);
        resolve({ base64Data, mimeType, previewUrl: dataUrl });
      } catch (err) {
        if (shouldRevoke) URL.revokeObjectURL(src);
        reject(err);
      }
    };

    img.onerror = (err) => {
      if (shouldRevoke) URL.revokeObjectURL(src);
      reject(new Error('Failed to load image for scanning'));
    };

    img.src = src;
  });
}

/**
 * Clean and parse JSON from LLM text output (handles markdown ```json ... ``` wrappers)
 */
function extractJsonFromText(rawText) {
  if (!rawText) return null;
  let text = rawText.trim();

  // Remove markdown code fences
  if (text.startsWith('```')) {
    text = text.replace(/^```[a-z]*\s*/i, '').replace(/```\s*$/i, '').trim();
  }

  // Find start and end of JSON object or array
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    try {
      return JSON.parse(text.substring(firstBrace, lastBrace + 1));
    } catch (_) {}
  }

  const firstBracket = text.indexOf('[');
  const lastBracket = text.lastIndexOf(']');
  if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
    try {
      const arr = JSON.parse(text.substring(firstBracket, lastBracket + 1));
      return { items: arr };
    } catch (_) {}
  }

  return null;
}

/**
 * Primary function to scan vegetable chit via Gemini Vision API
 * 
 * @param {string} base64Data - Base64 encoded JPEG/PNG image data
 * @param {string} mimeType - e.g. "image/jpeg"
 * @param {string} apiKeyOverride - Optional API key if user sets one in app settings
 * @returns {Promise<{ success: boolean, customer?: string, items: Array<{ rawName: string, quantity: number|string, unit?: string }> }>}
 */
export async function extractChitDataWithAI(base64Data, mimeType = 'image/jpeg', apiKeyOverride = '') {
  // 1. Try local server proxy first if reachable
  try {
    const proxyRes = await fetch('/api/scan-chit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ base64Data, mimeType })
    });
    if (proxyRes.ok) {
      const json = await proxyRes.json();
      if (json.ok && json.data && Array.isArray(json.data.items)) {
        const rawText = json.data.rawText || json.data.items.map(it => `${it.rawName || it.name} ${it.quantity || ''} ${it.unit || ''}`.trim()).join('\n');
        return {
          success: true,
          modelUsed: json.modelUsed || 'server-proxy',
          customer: (json.data.customer || '').trim(),
          rawText,
          items: json.data.items.map(it => ({
            rawName: String(it.rawName || it.name || '').trim(),
            quantity: it.quantity !== undefined ? it.quantity : (it.weight || 1),
            unit: String(it.unit || 'kg').trim()
          })).filter(it => it.rawName.length > 0)
        };
      }
    }
  } catch (_) {
    // Proceed to direct client-side Gemini API call
  }

  const apiKey = (apiKeyOverride || import.meta.env.VITE_GEMINI_API_KEY || '').trim();

  if (!apiKey) {
    throw new Error('Gemini API key is not configured. Please add GEMINI_API_KEY in .env or Settings.');
  }

  const prompt = `You are an expert Indian wholesale vegetable and fruit market assistant at Byculla / Dadar Market, Mumbai.
Carefully inspect this image of an order chit, notebook page, handwritten paper note, or customer WhatsApp order message.

Task:
1. Detect any customer / hotel / restaurant name written at the top or anywhere on the chit (e.g. "SURYA", "SAI DARSHAN", "BHAGAT TARACHAND", "LOCOMO", "HIGHWAY TEA", "CHINA TOWN", "GURUDAYA", "SAI SAGAR", "MANISHA", "SHIVADI", "SINDH PUNJAB").
2. Extract all vegetable, green, mushroom, and fruit items ordered, along with their exact numeric quantity and unit:
   - rawName: The exact name or transliteration as written (e.g. "kobi", "patta gobhi", "bhendi", "adrak", "lahsun", "palak", "kothmir", "shimeji mushroom", "lemon", "tomato", "chilly").
   - quantity: The numeric quantity as a number or decimal (e.g. 4, 0.5, 2.5, 15, 100). Do NOT write units in the quantity field.
   - unit: The unit written or implied:
     * Standard veggies: "kg"
     * Leafy greens (palak, kothimbir, methi, pudina, suva, kadi patta): "bundle" (also called juddi / gaddi)
     * Mushrooms (shimeji, oyster) & Garlic: "pkt"
     * Lemon / Coconut: "100 pcs" or "pcs"
     * If uncertain: "kg"

Return ONLY a strictly valid JSON object in this format, with NO explanatory prose:
{
  "customer": "HOTEL NAME IF FOUND OR EMPTY STRING",
  "rawText": "exact lines of text read from note separated by newlines",
  "items": [
    { "rawName": "kobi", "quantity": 4, "unit": "kg" },
    { "rawName": "palak", "quantity": 5, "unit": "bundle" },
    { "rawName": "adrak", "quantity": 2, "unit": "kg" },
    { "rawName": "lemon", "quantity": 100, "unit": "100 pcs" }
  ]
}`;

  let lastError = null;

  for (const model of GEMINI_MODELS) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

      const requestBody = {
        contents: [
          {
            parts: [
              { text: prompt },
              {
                inlineData: {
                  mimeType,
                  data: base64Data
                }
              }
            ]
          }
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.1
        }
      };

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      if (res.status === 200) {
        const data = await res.json();
        const rawContent = data.candidates?.[0]?.content?.parts?.[0]?.text;
        const parsed = extractJsonFromText(rawContent);

        if (parsed && Array.isArray(parsed.items)) {
          const rawText = parsed.rawText || parsed.items.map(it => `${it.rawName || it.name} ${it.quantity || ''} ${it.unit || ''}`.trim()).join('\n');
          return {
            success: true,
            modelUsed: model,
            customer: (parsed.customer || '').trim(),
            rawText,
            items: parsed.items.map(it => ({
              rawName: String(it.rawName || it.name || '').trim(),
              quantity: it.quantity !== undefined ? it.quantity : (it.weight || 1),
              unit: String(it.unit || 'kg').trim()
            })).filter(it => it.rawName.length > 0)
          };
        }
      } else {
        const errText = await res.text();
        console.warn(`[Gemini ${model}] Failed (${res.status}):`, errText.substring(0, 150));
        lastError = new Error(`Model ${model} returned ${res.status}`);
      }
    } catch (e) {
      console.warn(`[Gemini ${model}] Exception:`, e.message);
      lastError = e;
    }
  }

  throw lastError || new Error('Could not extract items from slip. Please try again with a clearer photo.');
}

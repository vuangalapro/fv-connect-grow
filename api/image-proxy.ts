import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { url } = req.query;

  // Validate URL
  if (!url || typeof url !== 'string') {
    return res.status(400).send('Invalid image URL');
  }

  // Only allow HTTPS URLs
  if (!url.startsWith('https://')) {
    return res.status(400).send('Only HTTPS URLs are allowed');
  }

  try {
    const imageResponse = await fetch(url, {
      headers: {
        'Accept': 'image/*',
      }
    });

    if (!imageResponse.ok) {
      console.error('Failed to fetch image:', imageResponse.status, imageResponse.statusText);
      return res.status(500).send('Failed to fetch image');
    }

    const buffer = await imageResponse.arrayBuffer();
    const contentType = imageResponse.headers.get('content-type') || 'image/png';

    // Verify it's actually an image
    if (!contentType.startsWith('image/')) {
      console.error('Invalid content type:', contentType);
      return res.status(400).send('URL does not point to an image');
    }

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.setHeader('Content-Length', buffer.byteLength);

    return res.send(Buffer.from(buffer));
  } catch (error) {
    console.error('Image proxy error:', error);
    return res.status(500).send('Image proxy error: ' + (error instanceof Error ? error.message : 'Unknown error'));
  }
}

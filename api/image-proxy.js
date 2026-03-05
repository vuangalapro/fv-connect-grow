export default async function handler(req, res) {
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
        const imageResponse = await fetch(url);

        if (!imageResponse.ok) {
            return res.status(500).send('Failed to fetch image');
        }

        const buffer = await imageResponse.arrayBuffer();
        const contentType = imageResponse.headers.get('content-type') || 'image/png';

        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', 'public, max-age=3600');

        return res.send(Buffer.from(buffer));
    } catch (error) {
        console.error('Image proxy error:', error);
        return res.status(500).send('Image proxy error');
    }
}

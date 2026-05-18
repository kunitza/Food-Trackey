// Vercel Function (Fluid Compute / Node.js).
// Proxies USDA FoodData Central so the API key is server-side only and never shipped
// in the client bundle. Reads USDA_API_KEY (no VITE_ prefix).
//
// Usage from frontend: fetch('/api/usda?query=banana&pageSize=15')

const USDA_BASE = 'https://api.nal.usda.gov/fdc/v1'

export default async function handler(req, res) {
  const query = (req.query.query || '').toString().trim()
  const pageSize = Math.min(Number(req.query.pageSize) || 15, 50)

  if (!query) {
    res.status(400).json({ error: 'Missing query parameter' })
    return
  }

  const apiKey = process.env.USDA_API_KEY
  if (!apiKey) {
    res.status(500).json({ error: 'USDA_API_KEY not configured on server' })
    return
  }

  const url = `${USDA_BASE}/foods/search?query=${encodeURIComponent(query)}&api_key=${apiKey}&pageSize=${pageSize}&dataType=SR%20Legacy,Foundation,Branded`

  try {
    const upstream = await fetch(url)
    if (!upstream.ok) {
      res.status(upstream.status).json({ error: 'USDA upstream error' })
      return
    }
    const data = await upstream.json()
    // Short cache for repeated lookups within a session.
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600')
    res.status(200).json(data)
  } catch (err) {
    res.status(502).json({ error: 'USDA fetch failed', detail: err.message })
  }
}

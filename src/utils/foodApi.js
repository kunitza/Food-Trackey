const BASE_URL = 'https://world.openfoodfacts.org'

export async function searchFoods(query, page = 1) {
  try {
    const url = `${BASE_URL}/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page=${page}&page_size=15&fields=product_name,nutriments,serving_size,code,image_small_url,brands`
    const res = await fetch(url)
    if (!res.ok) throw new Error('API request failed')
    const data = await res.json()
    return (data.products || [])
      .filter(p => p.product_name && p.nutriments)
      .map(normalizeProduct)
  } catch (err) {
    console.error('Food search error:', err)
    return []
  }
}

export async function lookupBarcode(barcode) {
  try {
    const url = `${BASE_URL}/api/v0/product/${barcode}.json`
    const res = await fetch(url)
    if (!res.ok) throw new Error('Barcode lookup failed')
    const data = await res.json()
    if (data.status === 1 && data.product) {
      return normalizeProduct(data.product)
    }
    return null
  } catch (err) {
    console.error('Barcode lookup error:', err)
    return null
  }
}

function normalizeProduct(p) {
  const n = p.nutriments || {}
  const servingStr = p.serving_size || '100g'
  const servingGrams = parseServingSize(servingStr)

  // Prefer per-serving if available, otherwise use per 100g and scale
  let protein, carbs, fat, fiber
  if (n['proteins_serving'] != null) {
    protein = round(n['proteins_serving'])
    carbs = round(n['carbohydrates_serving'])
    fat = round(n['fat_serving'])
    fiber = round(n['fiber_serving'])
  } else {
    const scale = servingGrams / 100
    protein = round((n['proteins_100g'] || 0) * scale)
    carbs = round((n['carbohydrates_100g'] || 0) * scale)
    fat = round((n['fat_100g'] || 0) * scale)
    fiber = round((n['fiber_100g'] || 0) * scale)
  }

  return {
    id: p.code || `off-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: p.product_name + (p.brands ? ` (${p.brands})` : ''),
    servingSizeGrams: servingGrams,
    servingSizeLabel: servingStr,
    protein,
    carbs,
    fat,
    fiber,
    source: 'open-food-facts',
  }
}

function parseServingSize(str) {
  if (!str) return 100
  const match = str.match(/(\d+\.?\d*)\s*(g|ml)/i)
  if (match) return parseFloat(match[1])
  return 100
}

function round(v) {
  return Math.round((v || 0) * 10) / 10
}

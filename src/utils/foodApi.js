const OFF_BASE = 'https://world.openfoodfacts.org'

// ---- Local database search (instant, 13K+ foods) ----
// Lazy-loaded so the 1.5MB JSON isn't bundled into the initial app payload.

let localFoodsCache = null
let localFoodsPromise = null

function loadLocalFoods() {
  if (localFoodsCache) return Promise.resolve(localFoodsCache)
  if (!localFoodsPromise) {
    localFoodsPromise = import('./localFoodDb.json').then(mod => {
      localFoodsCache = mod.default || mod
      return localFoodsCache
    })
  }
  return localFoodsPromise
}

// Kick off the load proactively (idle / first paint).
if (typeof window !== 'undefined') {
  const start = () => loadLocalFoods()
  if ('requestIdleCallback' in window) requestIdleCallback(start, { timeout: 2000 })
  else setTimeout(start, 500)
}

export async function searchLocal(query) {
  if (!query || query.length < 2) return []
  const foods = await loadLocalFoods()
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean)

  const scored = []
  for (const food of foods) {
    const name = food.n.toLowerCase()
    if (!terms.every(t => name.includes(t))) continue

    let score = 0
    if (name.startsWith(terms[0])) score += 100
    if (name === query.toLowerCase()) score += 200
    score -= name.length

    scored.push({ food, score })
  }

  scored.sort((a, b) => b.score - a.score)

  return scored.slice(0, 20).map(({ food }) => ({
    id: `local-${food.n.replace(/\s+/g, '-').substring(0, 40)}`,
    name: food.n,
    servingSizeGrams: food.sg,
    servingSizeLabel: food.sl,
    protein: food.p,
    carbs: food.c,
    fat: food.f,
    fiber: food.fb,
    source: 'usda-local',
  }))
}

// ---- USDA FoodData Central API ----
// Calls go through /api/usda (a Vercel Function) so the USDA key stays server-side.
// In local dev without the function, the call returns []; search still works via
// the local DB and Open Food Facts.

export async function searchUSDA(query, pageSize = 15) {
  try {
    const url = `/api/usda?query=${encodeURIComponent(query)}&pageSize=${pageSize}`
    const res = await fetch(url)
    if (!res.ok) return []
    const data = await res.json()
    return (data.foods || [])
      .filter(f => f.description)
      .map(normalizeUSDA)
  } catch (err) {
    console.error('USDA search error:', err)
    return []
  }
}

function normalizeUSDA(food) {
  const nutrients = {}
  ;(food.foodNutrients || []).forEach(n => {
    nutrients[n.nutrientId] = n.value || 0
  })

  const servingGrams = food.servingSize || 100
  const servingUnit = food.servingSizeUnit || 'g'
  const servingLabel = `${servingGrams}${servingUnit}`
  const scale = servingGrams / 100

  return {
    id: `usda-${food.fdcId}`,
    name: food.description + (food.brandName ? ` (${food.brandName})` : ''),
    servingSizeGrams: servingGrams,
    servingSizeLabel: servingLabel,
    protein: round((nutrients[1003] || 0) * scale),
    carbs: round((nutrients[1005] || 0) * scale),
    fat: round((nutrients[1004] || 0) * scale),
    fiber: round((nutrients[1079] || 0) * scale),
    source: 'usda',
  }
}

// ---- Open Food Facts (English filter) ----

export async function searchOpenFoodFacts(query, page = 1) {
  try {
    const url = `${OFF_BASE}/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page=${page}&page_size=15&fields=product_name,nutriments,serving_size,code,brands,lang,lc&lc=en&cc=us`
    const res = await fetch(url)
    if (!res.ok) throw new Error('OFF API request failed')
    const data = await res.json()
    return (data.products || [])
      .filter(p => p.product_name && p.nutriments)
      .filter(p => {
        // Prefer the product's declared language when present; fall back to a permissive
        // ASCII check so single-emoji/accented brand names aren't dropped.
        if (p.lang === 'en' || p.lc === 'en') return true
        if (p.lang || p.lc) return false
        const name = p.product_name || ''
        const asciiRatio = name.replace(/[^\x20-\x7E]/g, '').length / (name.length || 1)
        return asciiRatio > 0.5
      })
      .map(normalizeOFF)
  } catch (err) {
    console.error('OFF search error:', err)
    return []
  }
}

function normalizeOFF(p) {
  const n = p.nutriments || {}
  const servingStr = p.serving_size || '100g'
  const servingGrams = parseServingSize(servingStr)

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
    protein, carbs, fat, fiber,
    source: 'open-food-facts',
  }
}

// ---- Combined search: local first (instant), then APIs ----

export async function searchFoods(query, page = 1) {
  const [localResults, usdaResults, offResults] = await Promise.all([
    searchLocal(query),
    searchUSDA(query),
    searchOpenFoodFacts(query, page),
  ])

  const seen = new Set()
  const combined = []

  for (const food of localResults) {
    const key = food.name.toLowerCase().trim()
    if (!seen.has(key)) { seen.add(key); combined.push(food) }
  }
  for (const food of usdaResults) {
    const key = food.name.toLowerCase().trim()
    if (!seen.has(key)) { seen.add(key); combined.push(food) }
  }
  for (const food of offResults) {
    const key = food.name.toLowerCase().trim()
    if (!seen.has(key)) { seen.add(key); combined.push(food) }
  }

  return combined
}

// ---- Barcode lookup ----

export async function lookupBarcode(barcode) {
  try {
    const url = `${OFF_BASE}/api/v0/product/${barcode}.json`
    const res = await fetch(url)
    if (!res.ok) throw new Error('Barcode lookup failed')
    const data = await res.json()
    if (data.status === 1 && data.product) {
      return normalizeOFF(data.product)
    }
    return null
  } catch (err) {
    console.error('Barcode lookup error:', err)
    return null
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

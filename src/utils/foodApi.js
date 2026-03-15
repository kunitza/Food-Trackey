const OFF_BASE = 'https://world.openfoodfacts.org'
const USDA_BASE = 'https://api.nal.usda.gov/fdc/v1'

// ---- USDA FoodData Central ----

export async function searchUSDA(query, pageSize = 15) {
  const apiKey = import.meta.env.VITE_USDA_API_KEY
  if (!apiKey) return []

  try {
    const url = `${USDA_BASE}/foods/search?query=${encodeURIComponent(query)}&api_key=${apiKey}&pageSize=${pageSize}&dataType=SR%20Legacy,Foundation,Branded`
    const res = await fetch(url)
    if (!res.ok) throw new Error('USDA API request failed')
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

  // USDA nutrient IDs: Protein=1003, Fat=1004, Carbs=1005, Fiber=1079, Energy=1008
  // Values are per 100g, so scale to serving size
  const scale = servingGrams / 100

  const protein = round((nutrients[1003] || 0) * scale)
  const fat = round((nutrients[1004] || 0) * scale)
  const carbs = round((nutrients[1005] || 0) * scale)
  const fiber = round((nutrients[1079] || 0) * scale)

  const brandSuffix = food.brandName ? ` (${food.brandName})` : ''

  return {
    id: `usda-${food.fdcId}`,
    name: food.description + brandSuffix,
    servingSizeGrams: servingGrams,
    servingSizeLabel: servingLabel,
    protein,
    carbs,
    fat,
    fiber,
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
        // Additional English filter: check product name is mostly ASCII/Latin
        const name = p.product_name || ''
        const asciiRatio = name.replace(/[^\x20-\x7E]/g, '').length / (name.length || 1)
        return asciiRatio > 0.7
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
    protein,
    carbs,
    fat,
    fiber,
    source: 'open-food-facts',
  }
}

// ---- Combined search (USDA first, then OFF) ----

export async function searchFoods(query, page = 1) {
  const [usdaResults, offResults] = await Promise.all([
    searchUSDA(query),
    searchOpenFoodFacts(query, page),
  ])

  // Deduplicate by similar name
  const seen = new Set()
  const combined = []

  for (const food of usdaResults) {
    const key = food.name.toLowerCase().trim()
    if (!seen.has(key)) {
      seen.add(key)
      combined.push(food)
    }
  }

  for (const food of offResults) {
    const key = food.name.toLowerCase().trim()
    if (!seen.has(key)) {
      seen.add(key)
      combined.push(food)
    }
  }

  return combined
}

// ---- Barcode lookup (Open Food Facts only) ----

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

// ---- Helpers ----

function parseServingSize(str) {
  if (!str) return 100
  const match = str.match(/(\d+\.?\d*)\s*(g|ml)/i)
  if (match) return parseFloat(match[1])
  return 100
}

function round(v) {
  return Math.round((v || 0) * 10) / 10
}

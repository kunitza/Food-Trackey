import { getLocalDateStr, getEffectiveTimezone } from './timezone'

export const PRESETS = {
  'high-protein': { protein: 25, carbs: 45, fat: 30 },
  'balanced': { protein: 20, carbs: 40, fat: 40 },
  'high-carb': { protein: 20, carbs: 60, fat: 20 },
  'high-fat': { protein: 20, carbs: 20, fat: 60 },
}

export function calcMacroGrams(calories, ratios) {
  return {
    protein: Math.round((calories * (ratios.protein / 100)) / 4),
    carbs: Math.round((calories * (ratios.carbs / 100)) / 4),
    fat: Math.round((calories * (ratios.fat / 100)) / 9),
  }
}

export function calcCalories(food) {
  const p = food.protein || 0
  const c = food.carbs || 0
  const f = food.fat || 0
  return Math.round(p * 4 + c * 4 + f * 9)
}

export function calcFoodMacros(food, quantityGrams) {
  const servingSize = food.servingSizeGrams || 100
  const ratio = quantityGrams / servingSize
  return {
    protein: Math.round((food.protein || 0) * ratio * 10) / 10,
    carbs: Math.round((food.carbs || 0) * ratio * 10) / 10,
    fat: Math.round((food.fat || 0) * ratio * 10) / 10,
    fiber: Math.round((food.fiber || 0) * ratio * 10) / 10,
    calories: Math.round(((food.protein || 0) * 4 + (food.carbs || 0) * 4 + (food.fat || 0) * 9) * ratio),
  }
}

// ----- Timezone-aware date helpers -----

export function getTodayKey() {
  return getLocalDateStr(new Date())
}

export function getDateKey(date) {
  return getLocalDateStr(date)
}

export function formatDate(dateStr) {
  // Parse YYYY-MM-DD as local noon to avoid off-by-one
  const d = new Date(dateStr + 'T12:00:00')
  const todayStr = getTodayKey()

  if (dateStr === todayStr) return 'Today'

  // Yesterday in user's timezone
  const now = new Date()
  const tz = getEffectiveTimezone()
  const yesterday = new Date(now.getTime() - 86400000)
  const yesterdayStr = getLocalDateStr(yesterday, tz)
  if (dateStr === yesterdayStr) return 'Yesterday'

  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

// ----- Unit conversion helpers -----

const GRAMS_PER_OZ = 28.3495
const LBS_PER_KG = 2.20462

export function gramsToOz(g) {
  return Math.round((g / GRAMS_PER_OZ) * 100) / 100
}

export function ozToGrams(oz) {
  return Math.round(oz * GRAMS_PER_OZ * 100) / 100
}

export function lbsToKg(lbs) {
  return Math.round((lbs / LBS_PER_KG) * 10) / 10
}

export function kgToLbs(kg) {
  return Math.round(kg * LBS_PER_KG * 10) / 10
}

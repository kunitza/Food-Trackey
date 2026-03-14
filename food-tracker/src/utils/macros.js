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

export function calcFoodMacros(food, quantity) {
  const servingSize = food.servingSizeGrams || 100
  const ratio = quantity / servingSize
  return {
    protein: Math.round((food.protein || 0) * ratio * 10) / 10,
    carbs: Math.round((food.carbs || 0) * ratio * 10) / 10,
    fat: Math.round((food.fat || 0) * ratio * 10) / 10,
    fiber: Math.round((food.fiber || 0) * ratio * 10) / 10,
    calories: Math.round(((food.protein || 0) * 4 + (food.carbs || 0) * 4 + (food.fat || 0) * 9) * ratio),
  }
}

export function getTodayKey() {
  return new Date().toISOString().split('T')[0]
}

export function getDateKey(date) {
  return date.toISOString().split('T')[0]
}

export function formatDate(dateStr) {
  const d = new Date(dateStr + 'T12:00:00')
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  if (dateStr === getTodayKey()) return 'Today'
  if (dateStr === getDateKey(yesterday)) return 'Yesterday'

  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

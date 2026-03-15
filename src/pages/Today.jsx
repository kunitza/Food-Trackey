import React, { useState, useMemo } from 'react'
import { useFirestore } from '../hooks/useFirestore'
import { calcMacroGrams, calcCalories, formatDate, getTodayKey, getDateKey } from '../utils/macros'
import { PRESETS } from '../utils/macros'
import MacroBar from '../components/MacroBar'
import LookupOverlay from './Lookup'

export default function Today() {
  const {
    targets, todayFoods, selectedDate, setSelectedDate,
    removeFood, updateFood, getEffectiveTargets,
  } = useFirestore()
  const [editingId, setEditingId] = useState(null)
  const [editQty, setEditQty] = useState('')
  const [showLookup, setShowLookup] = useState(false)

  // Use effective targets (locked for past days)
  const effectiveTargets = getEffectiveTargets(selectedDate)

  const ratios = effectiveTargets
    ? (effectiveTargets.preset === 'custom' ? effectiveTargets.customMacroRatios : (PRESETS[effectiveTargets.preset] || PRESETS.balanced))
    : PRESETS.balanced
  const dailyCals = effectiveTargets?.dailyCalories || 2000
  const macroTargets = calcMacroGrams(dailyCals, ratios)

  const totals = useMemo(() => {
    return todayFoods.reduce(
      (acc, f) => ({
        protein: acc.protein + (f.protein || 0),
        carbs: acc.carbs + (f.carbs || 0),
        fat: acc.fat + (f.fat || 0),
        fiber: acc.fiber + (f.fiber || 0),
        calories: acc.calories + calcCalories(f),
      }),
      { protein: 0, carbs: 0, fat: 0, fiber: 0, calories: 0 }
    )
  }, [todayFoods])

  function navigateDate(delta) {
    const d = new Date(selectedDate + 'T12:00:00')
    d.setDate(d.getDate() + delta)
    setSelectedDate(getDateKey(d))
  }

  function handleEdit(food) {
    setEditingId(food.id)
    setEditQty(food.quantity || food.servingSizeGrams || '')
  }

  async function saveEdit(food) {
    const newQty = Number(editQty) || food.servingSizeGrams || 100
    const ratio = newQty / (food.servingSizeGrams || 100)
    const base = food._base || food

    const updated = {
      ...food,
      quantity: newQty,
      protein: Math.round((base.protein || 0) * ratio * 10) / 10,
      carbs: Math.round((base.carbs || 0) * ratio * 10) / 10,
      fat: Math.round((base.fat || 0) * ratio * 10) / 10,
      fiber: Math.round((base.fiber || 0) * ratio * 10) / 10,
    }
    await updateFood(food, updated)
    setEditingId(null)
  }

  const isToday = selectedDate === getTodayKey()

  return (
    <div className="space-y-4 pb-2">
      {/* Date Selector */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigateDate(-1)}
          className="w-9 h-9 flex items-center justify-center rounded-full bg-white border border-gray-150 hover:bg-gray-50 transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <div className="text-center">
          <p className="font-display text-base font-bold text-brand-dark">{formatDate(selectedDate)}</p>
          {!isToday && (
            <button onClick={() => setSelectedDate(getTodayKey())} className="text-[10px] text-brand-purple font-semibold hover:underline">
              Go to Today
            </button>
          )}
        </div>
        <button
          onClick={() => navigateDate(1)}
          disabled={isToday}
          className="w-9 h-9 flex items-center justify-center rounded-full bg-white border border-gray-150 hover:bg-gray-50 transition-colors disabled:opacity-30"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </div>

      {/* Calorie Summary */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
        <div className="flex items-end justify-between mb-1">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Calories</span>
          <span className="font-display text-2xl font-bold text-brand-dark tabular-nums">
            {Math.round(totals.calories)}
            <span className="text-sm font-medium text-gray-400"> / {dailyCals}</span>
          </span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="macro-bar-fill h-full rounded-full bg-brand-dark"
            style={{ width: `${Math.min((totals.calories / dailyCals) * 100, 100)}%` }}
          />
        </div>
      </div>

      {/* Macro Bars */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-3">
        <MacroBar label="Protein" current={totals.protein} target={macroTargets.protein} />
        <MacroBar label="Carbs" current={totals.carbs} target={macroTargets.carbs} />
        <MacroBar label="Fat" current={totals.fat} target={macroTargets.fat} />
        <MacroBar label="Fiber" current={totals.fiber} target={30} />
      </div>

      {/* Food List */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-display text-sm font-bold text-brand-dark/70 uppercase tracking-wider">
            Food Log
          </h3>
          <span className="text-[10px] text-gray-400">{todayFoods.length} items</span>
        </div>

        {todayFoods.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center border border-gray-100">
            <p className="text-gray-400 text-sm">No foods logged yet.</p>
            <p className="text-gray-300 text-xs mt-1">Tap the button below to add food.</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {todayFoods.map((food) => (
              <div
                key={food.id}
                className="bg-white rounded-xl px-3 py-2 border border-gray-100 shadow-sm"
              >
                {editingId === food.id ? (
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-brand-dark truncate flex-1 min-w-0">{food.name}</p>
                    <input
                      type="number"
                      value={editQty}
                      onChange={(e) => setEditQty(e.target.value)}
                      className="w-16 px-2 py-1 border border-gray-200 rounded text-xs text-center focus:outline-none focus:border-brand-purple"
                      autoFocus
                    />
                    <span className="text-[10px] text-gray-400">g</span>
                    <button onClick={() => saveEdit(food)} className="p-1 text-brand-green hover:bg-brand-green/10 rounded">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                    </button>
                    <button onClick={() => setEditingId(null)} className="p-1 text-gray-400 hover:bg-gray-100 rounded">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="text-sm font-semibold text-brand-dark truncate">{food.name}</p>
                        <span className="text-xs font-bold text-brand-dark/70 tabular-nums shrink-0">{calcCalories(food)} cal</span>
                      </div>
                      <div className="flex gap-3 mt-0.5 text-[10px] text-gray-500">
                        <span className="text-brand-dark/60">P:{Math.round(food.protein || 0)}g</span>
                        <span className="text-brand-purple/80">C:{Math.round(food.carbs || 0)}g</span>
                        <span className="text-brand-tan">F:{Math.round(food.fat || 0)}g</span>
                        {food.fiber > 0 && <span className="text-gray-400">Fb:{Math.round(food.fiber)}g</span>}
                        {food.quantity && <span className="text-gray-400 ml-auto">{food.quantity}g</span>}
                      </div>
                    </div>
                    <div className="flex gap-0.5 shrink-0">
                      <button onClick={() => handleEdit(food)} className="p-1.5 text-gray-400 hover:text-brand-purple hover:bg-brand-purple/10 rounded-lg transition-colors" title="Edit quantity">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      </button>
                      <button onClick={() => removeFood(food)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Remove">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Add Food Button */}
        <button
          onClick={() => setShowLookup(true)}
          className="w-full mt-3 py-3 bg-brand-green text-brand-dark font-bold rounded-xl hover:bg-brand-green/90 transition-colors flex items-center justify-center gap-2"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add Food
        </button>
      </div>

      {/* Lookup Overlay */}
      {showLookup && (
        <LookupOverlay
          overlayMode
          targetDate={selectedDate}
          onClose={() => setShowLookup(false)}
        />
      )}
    </div>
  )
}

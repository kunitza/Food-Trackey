import React, { useState, useEffect, useRef, useMemo, lazy, Suspense } from 'react'
import { useFirestore } from '../hooks/useFirestore'
import { searchFoods, searchLocal, lookupBarcode } from '../utils/foodApi'
import { calcFoodMacros, calcCalories, gramsToOz, ozToGrams } from '../utils/macros'

// Scanner is heavy (zxing decoder) — load only when user opens it.
const BarcodeScanner = lazy(() => import('../components/BarcodeScanner'))

export default function Lookup({ overlayMode = false, targetDate, onClose }) {
  const { foodHistory, customFoods, addFood, addCustomFood, toggleFavoriteFood, selectedDate } = useFirestore()

  const logDate = targetDate || selectedDate

  const [query, setQuery] = useState('')
  const [localResults, setLocalResults] = useState([])
  const [apiResults, setApiResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [showScanner, setShowScanner] = useState(false)
  const [selectedFood, setSelectedFood] = useState(null)
  const [multiplier, setMultiplier] = useState(1)
  const [customMultiplier, setCustomMultiplier] = useState('')
  const [servingUnit, setServingUnit] = useState('g')
  const [showCustomForm, setShowCustomForm] = useState(false)
  const [logged, setLogged] = useState('')
  const [scanStatus, setScanStatus] = useState('')
  const [tab, setTab] = useState('recents')
  const searchTimeout = useRef(null)
  const resultsRef = useRef(null)

  const recents = useMemo(() => {
    const threeDaysAgo = new Date()
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)
    return foodHistory
      .filter(f => new Date(f.lastLogged) >= threeDaysAgo)
      .slice(0, 15)
  }, [foodHistory])

  const favorites = useMemo(() => {
    return foodHistory
      .filter(f => f.favorite)
      .sort((a, b) => new Date(b.lastLogged) - new Date(a.lastLogged))
  }, [foodHistory])

  // Combine local + api results
  const results = useMemo(() => {
    const seen = new Set()
    const combined = []
    // Custom foods matching query first
    if (query.trim()) {
      const customResults = customFoods
        .filter(f => f.name.toLowerCase().includes(query.toLowerCase()))
        .map(f => ({ ...f, source: 'user-custom' }))
      for (const food of customResults) {
        const key = food.name.toLowerCase().trim()
        if (!seen.has(key)) { seen.add(key); combined.push(food) }
      }
    }
    for (const food of localResults) {
      const key = food.name.toLowerCase().trim()
      if (!seen.has(key)) { seen.add(key); combined.push(food) }
    }
    for (const food of apiResults) {
      const key = food.name.toLowerCase().trim()
      if (!seen.has(key)) { seen.add(key); combined.push(food) }
    }
    return combined
  }, [localResults, apiResults, customFoods, query])

  // Search: instant local (once loaded), debounced API
  useEffect(() => {
    if (!query.trim()) {
      setLocalResults([])
      setApiResults([])
      return
    }

    let cancelled = false

    ;(async () => {
      const local = await searchLocal(query)
      if (cancelled) return
      setLocalResults(local)

      if (resultsRef.current) resultsRef.current.scrollTop = 0

      clearTimeout(searchTimeout.current)
      searchTimeout.current = setTimeout(async () => {
        if (cancelled) return
        setSearching(true)
        const api = await searchFoods(query)
        if (cancelled) return
        const localNames = new Set(local.map(f => f.name.toLowerCase().trim()))
        setApiResults(api.filter(f => !localNames.has(f.name.toLowerCase().trim())))
        setSearching(false)
      }, 400)
    })()

    return () => {
      cancelled = true
      clearTimeout(searchTimeout.current)
    }
  }, [query, customFoods])

  async function handleBarcodeScan(barcode) {
    setShowScanner(false)
    setScanStatus('Looking up barcode...')
    const food = await lookupBarcode(barcode)
    if (food) {
      selectFood(food)
      setScanStatus('')
    } else {
      setScanStatus('Barcode not found. Try searching by name or add a custom food.')
    }
  }

  function selectFood(food) {
    setSelectedFood(food)
    setMultiplier(1)
    setCustomMultiplier('')
    setServingUnit('g')
    setScanStatus('')
  }

  function selectHistoryFood(food) {
    setSelectedFood({
      name: food.name,
      protein: food.protein,
      carbs: food.carbs,
      fat: food.fat,
      fiber: food.fiber,
      servingSizeGrams: food.servingSizeGrams || 100,
      source: food.source || 'open-food-facts',
    })
    setMultiplier(1)
    setCustomMultiplier('')
    setServingUnit('g')
  }

  async function handleLog() {
    if (!selectedFood) return
    const effectiveMult = customMultiplier !== '' ? (Number(customMultiplier) || 1) : multiplier
    const qty = (selectedFood.servingSizeGrams || 100) * effectiveMult
    const macros = calcFoodMacros(selectedFood, qty)

    await addFood({
      name: selectedFood.name,
      servingSizeGrams: selectedFood.servingSizeGrams || 100,
      quantity: Math.round(qty * 10) / 10,
      protein: macros.protein,
      carbs: macros.carbs,
      fat: macros.fat,
      fiber: macros.fiber,
      source: selectedFood.source || 'open-food-facts',
    }, logDate)

    setLogged(selectedFood.name)
    setSelectedFood(null)
    setMultiplier(1)
    setCustomMultiplier('')
    setQuery('')
    setLocalResults([])
    setApiResults([])
    setTimeout(() => {
      setLogged('')
      if (overlayMode && onClose) onClose()
    }, 1200)
  }

  const content = (
    <div className="space-y-4 pb-2">
      {/* Overlay Header */}
      {overlayMode && (
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-brand-dark">Add Food</h2>
          <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      )}

      {/* Search Bar */}
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <input
            type="text"
            placeholder="Search foods..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/20"
            autoFocus={overlayMode}
          />
          <svg className="absolute left-3 top-3.5 text-gray-400" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          {searching && (
            <div className="absolute right-3 top-3.5">
              <div className="w-4 h-4 border-2 border-brand-purple/30 border-t-brand-purple rounded-full animate-spin" />
            </div>
          )}
        </div>
        <button
          onClick={() => setShowScanner(true)}
          className="w-12 h-12 bg-brand-dark text-white rounded-xl flex items-center justify-center hover:bg-brand-dark/90 transition-colors shrink-0"
          title="Scan barcode"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M3 7V5a2 2 0 0 1 2-2h2" /><path d="M17 3h2a2 2 0 0 1 2 2v2" /><path d="M21 17v2a2 2 0 0 1-2 2h-2" /><path d="M7 21H5a2 2 0 0 1-2-2v-2" />
            <line x1="7" y1="8" x2="7" y2="16" /><line x1="11" y1="8" x2="11" y2="16" /><line x1="15" y1="8" x2="15" y2="16" />
          </svg>
        </button>
      </div>

      {scanStatus && (
        <div className="bg-brand-tan/20 border border-brand-tan/30 rounded-xl p-3 flex items-start gap-2">
          <p className="text-xs text-brand-dark/80 flex-1">{scanStatus}</p>
          <button onClick={() => setScanStatus('')} className="text-gray-400 text-sm">&times;</button>
        </div>
      )}

      {logged && (
        <div className="bg-brand-green/15 border border-brand-green/30 rounded-xl p-3 flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#87D68D" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
          <p className="text-xs text-brand-dark font-medium">Logged: {logged}</p>
        </div>
      )}

      {selectedFood && (
        <FoodDetail
          food={selectedFood}
          multiplier={multiplier}
          setMultiplier={setMultiplier}
          customMultiplier={customMultiplier}
          setCustomMultiplier={setCustomMultiplier}
          servingUnit={servingUnit}
          setServingUnit={setServingUnit}
          onLog={handleLog}
          onCancel={() => setSelectedFood(null)}
        />
      )}

      {/* Search Results with Add Custom Food at top */}
      {!selectedFood && query.trim() && (
        <div>
          {/* Add Custom Food button at top of results */}
          <button
            onClick={() => setShowCustomForm(true)}
            className="w-full mb-2 py-2.5 border-2 border-dashed border-brand-purple/30 rounded-xl text-xs text-brand-purple font-semibold hover:border-brand-purple hover:bg-brand-purple/5 transition-colors"
          >
            + Add Custom Food
          </button>

          {results.length > 0 && (
            <>
              <h3 className="font-display text-xs font-bold text-brand-dark/60 uppercase tracking-wider mb-2">
                Search Results
              </h3>
              <div ref={resultsRef} className="space-y-1.5 max-h-80 overflow-y-auto">
                {results.map((food, i) => (
                  <FoodRow key={`${food.id}-${i}`} food={food} onClick={() => selectFood(food)} />
                ))}
                {searching && (
                  <p className="text-center text-[10px] text-gray-400 py-2">Loading more results...</p>
                )}
              </div>
            </>
          )}

          {!searching && results.length === 0 && (
            <div className="bg-white rounded-xl p-4 text-center border border-gray-100">
              <p className="text-sm text-gray-500">No results found</p>
            </div>
          )}
        </div>
      )}

      {/* Custom Food Form */}
      {!selectedFood && showCustomForm && (
        <CustomFoodForm
          onSave={async (food) => {
            const saved = await addCustomFood(food)
            setShowCustomForm(false)
            selectFood({ ...saved, source: 'user-custom' })
          }}
          onCancel={() => setShowCustomForm(false)}
          defaultName={query}
        />
      )}

      {/* Recents & Favorites (no query, no custom form) */}
      {!selectedFood && !query.trim() && !showCustomForm && (
        <>
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
            {['recents', 'favorites'].map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 py-2 text-xs font-semibold rounded-md transition-all ${
                  tab === t ? 'bg-white text-brand-dark shadow-sm' : 'text-gray-500'
                }`}
              >
                {t === 'recents' ? 'Recents' : 'Favorites'}
              </button>
            ))}
          </div>

          {tab === 'recents' && (
            <div>
              {recents.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-4">No recent foods</p>
              ) : (
                <div className="space-y-1.5">
                  {recents.map((food, i) => (
                    <FoodRow
                      key={`recent-${i}`}
                      food={food}
                      onClick={() => selectHistoryFood(food)}
                      onToggleFavorite={() => toggleFavoriteFood(food.name)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === 'favorites' && (
            <div>
              {favorites.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-4">
                  No favorites yet — tap the star on a recent food to favorite it.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {favorites.map((food, i) => (
                    <FoodRow
                      key={`fav-${i}`}
                      food={food}
                      onClick={() => selectHistoryFood(food)}
                      onToggleFavorite={() => toggleFavoriteFood(food.name)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          <button
            onClick={() => setShowCustomForm(true)}
            className="w-full py-3 border-2 border-dashed border-gray-200 rounded-xl text-sm text-gray-500 font-medium hover:border-brand-purple hover:text-brand-purple transition-colors"
          >
            + Add Custom Food
          </button>
        </>
      )}

      {showScanner && (
        <Suspense fallback={
          <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          </div>
        }>
          <BarcodeScanner
            onScan={handleBarcodeScan}
            onClose={() => setShowScanner(false)}
          />
        </Suspense>
      )}
    </div>
  )

  // Overlay mode: render as a full-screen modal
  if (overlayMode) {
    return (
      <div className="fixed inset-0 z-50 bg-[#faf9f8] overflow-y-auto">
        <div className="max-w-lg mx-auto px-4 py-4">
          {content}
        </div>
      </div>
    )
  }

  return content
}

function FoodRow({ food, onClick, onToggleFavorite }) {
  const cals = calcCalories(food)
  return (
    <div className="relative w-full bg-white rounded-xl border border-gray-100 hover:border-brand-purple/30 hover:bg-brand-purple/5 transition-all">
      <button
        onClick={onClick}
        className="w-full text-left px-3 py-2.5 pr-9"
      >
        <p className="text-sm font-medium text-brand-dark truncate">{food.name}</p>
        <div className="flex gap-3 mt-0.5 text-[10px] text-gray-500">
          <span>{cals} cal</span>
          <span>P:{Math.round(food.protein || 0)}g</span>
          <span>C:{Math.round(food.carbs || 0)}g</span>
          <span>F:{Math.round(food.fat || 0)}g</span>
          {food.source === 'user-custom' && <span className="text-brand-purple font-semibold">Custom</span>}
          {food.source === 'usda' && <span className="text-brand-green font-semibold">USDA</span>}
          {food.source === 'usda-local' && <span className="text-brand-sage font-semibold">USDA</span>}
          {food.servingSizeLabel && <span className="text-gray-400">{food.servingSizeLabel}</span>}
        </div>
      </button>
      {onToggleFavorite && (
        <button
          onClick={(e) => { e.stopPropagation(); onToggleFavorite() }}
          className="absolute top-1/2 right-1.5 -translate-y-1/2 p-1.5 rounded-lg hover:bg-yellow-50 transition-colors"
          aria-label={food.favorite ? 'Unfavorite' : 'Favorite'}
          title={food.favorite ? 'Unfavorite' : 'Favorite'}
        >
          <svg
            width="16" height="16" viewBox="0 0 24 24"
            fill={food.favorite ? '#FBBF24' : 'none'}
            stroke={food.favorite ? '#FBBF24' : '#CBD5E1'}
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          >
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
        </button>
      )}
    </div>
  )
}

function FoodDetail({ food, multiplier, setMultiplier, customMultiplier, setCustomMultiplier, servingUnit, setServingUnit, onLog, onCancel }) {
  const effectiveMult = customMultiplier !== '' ? (Number(customMultiplier) || 1) : multiplier
  const totalGrams = (food.servingSizeGrams || 100) * effectiveMult
  const macros = calcFoodMacros(food, totalGrams)
  const servingSizeDisplay = servingUnit === 'oz' ? gramsToOz(food.servingSizeGrams || 100) : (food.servingSizeGrams || 100)

  function handleMultiplierButton(val) { setMultiplier(val); setCustomMultiplier('') }

  return (
    <div className="bg-white rounded-2xl p-4 border border-brand-purple/20 shadow-sm space-y-3">
      <div className="flex items-start justify-between">
        <h3 className="font-display text-base font-bold text-brand-dark">{food.name}</h3>
        <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-gray-500">Serving size:</span>
        <span className="text-sm font-semibold text-brand-dark tabular-nums">{Math.round(servingSizeDisplay * 10) / 10}</span>
        <div className="flex bg-gray-100 rounded-md p-0.5">
          <button onClick={() => setServingUnit('g')} className={`px-2 py-0.5 text-[10px] font-bold rounded transition-all ${servingUnit === 'g' ? 'bg-white text-brand-dark shadow-sm' : 'text-gray-500'}`}>g</button>
          <button onClick={() => setServingUnit('oz')} className={`px-2 py-0.5 text-[10px] font-bold rounded transition-all ${servingUnit === 'oz' ? 'bg-white text-brand-dark shadow-sm' : 'text-gray-500'}`}>oz</button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-gray-500"># servings:</span>
        <div className="flex gap-1">
          {[0.5, 1, 2].map((mult) => (
            <button key={mult} onClick={() => handleMultiplierButton(mult)}
              className={`px-2.5 py-1 text-[11px] rounded-md font-semibold transition-colors ${customMultiplier === '' && multiplier === mult ? 'bg-brand-purple text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {mult === 1 ? '1x' : `${mult}x`}
            </button>
          ))}
        </div>
        <input type="number" value={customMultiplier} onChange={(e) => setCustomMultiplier(e.target.value)}
          placeholder="Other" className="w-16 px-2 py-1 border border-gray-200 rounded-md text-xs text-center focus:outline-none focus:border-brand-purple focus:ring-1 focus:ring-brand-purple/30" step="0.1" min="0.1" />
      </div>

      <p className="text-[10px] text-gray-400">
        Total: {Math.round(totalGrams)}g{servingUnit === 'oz' && ` (${Math.round(gramsToOz(totalGrams) * 10) / 10} oz)`} &middot; {effectiveMult}x serving
      </p>

      <div className="grid grid-cols-5 gap-2">
        {[
          { label: 'Calories', value: macros.calories, unit: '', color: 'text-brand-dark' },
          { label: 'Protein', value: macros.protein, unit: 'g', color: 'text-brand-dark' },
          { label: 'Carbs', value: macros.carbs, unit: 'g', color: 'text-brand-purple' },
          { label: 'Fat', value: macros.fat, unit: 'g', color: 'text-brand-tan' },
          { label: 'Fiber', value: macros.fiber, unit: 'g', color: 'text-gray-500' },
        ].map(({ label, value, unit, color }) => (
          <div key={label} className="text-center bg-gray-50 rounded-lg py-2">
            <p className={`text-sm font-bold ${color}`}>{Math.round(value)}{unit}</p>
            <p className="text-[9px] text-gray-400 font-medium uppercase">{label}</p>
          </div>
        ))}
      </div>

      <button onClick={onLog} className="w-full py-3 bg-brand-green text-brand-dark font-bold rounded-xl hover:bg-brand-green/90 transition-colors">
        Log Food
      </button>
    </div>
  )
}

function CustomFoodForm({ onSave, onCancel, defaultName = '' }) {
  const [name, setName] = useState(defaultName)
  const [servingSize, setServingSize] = useState(100)
  const [protein, setProtein] = useState('')
  const [carbs, setCarbs] = useState('')
  const [fat, setFat] = useState('')
  const [fiber, setFiber] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!name.trim()) return
    setSaving(true)
    await onSave({ name: name.trim(), servingSizeGrams: Number(servingSize) || 100, protein: Number(protein) || 0, carbs: Number(carbs) || 0, fat: Number(fat) || 0, fiber: Number(fiber) || 0 })
    setSaving(false)
  }

  return (
    <div className="bg-white rounded-2xl p-4 border border-brand-tan/30 shadow-sm space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-sm font-bold text-brand-dark">Custom Food</h3>
        <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
      </div>
      <div className="space-y-2">
        <input type="text" placeholder="Food name" value={name} onChange={(e) => setName(e.target.value)}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-purple" autoFocus />
        <div className="grid grid-cols-2 gap-2">
          <Field label="Serving (g)" value={servingSize} onChange={setServingSize} />
          <Field label="Protein (g)" value={protein} onChange={setProtein} />
          <Field label="Carbs (g)" value={carbs} onChange={setCarbs} />
          <Field label="Fat (g)" value={fat} onChange={setFat} />
          <Field label="Fiber (g)" value={fiber} onChange={setFiber} />
        </div>
      </div>
      <button onClick={handleSave} disabled={!name.trim() || saving}
        className="w-full py-2.5 bg-brand-tan text-brand-dark font-semibold rounded-xl hover:bg-brand-tan/90 transition-colors disabled:opacity-40">
        {saving ? 'Saving...' : 'Save & Select'}
      </button>
    </div>
  )
}

function Field({ label, value, onChange }) {
  return (
    <div>
      <label className="block text-[10px] font-medium text-gray-400 mb-0.5">{label}</label>
      <input type="number" value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:border-brand-purple" />
    </div>
  )
}

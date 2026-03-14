import React, { useState, useEffect, useRef, useMemo } from 'react'
import { useFirestore } from '../hooks/useFirestore'
import { searchFoods, lookupBarcode } from '../utils/foodApi'
import { calcFoodMacros, calcCalories } from '../utils/macros'
import BarcodeScanner from '../components/BarcodeScanner'

export default function Lookup() {
  const { foodHistory, customFoods, addFood, addCustomFood } = useFirestore()

  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [showScanner, setShowScanner] = useState(false)
  const [selectedFood, setSelectedFood] = useState(null)
  const [quantity, setQuantity] = useState('')
  const [showCustomForm, setShowCustomForm] = useState(false)
  const [logged, setLogged] = useState('')
  const [scanStatus, setScanStatus] = useState('')
  const [tab, setTab] = useState('recents') // 'recents' | 'favorites'
  const searchTimeout = useRef(null)

  // Recents: foods logged in last 3 days
  const recents = useMemo(() => {
    const threeDaysAgo = new Date()
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)
    return foodHistory
      .filter(f => new Date(f.lastLogged) >= threeDaysAgo)
      .slice(0, 15)
  }, [foodHistory])

  // Favorites: most frequently logged (all of food history sorted by frequency)
  const favorites = useMemo(() => {
    const counts = {}
    foodHistory.forEach(f => {
      counts[f.name] = (counts[f.name] || 0) + 1
    })
    // Sort foodHistory by count (deduplicated)
    const seen = new Set()
    return foodHistory
      .filter(f => {
        if (seen.has(f.name)) return false
        seen.add(f.name)
        return true
      })
      .sort((a, b) => (counts[b.name] || 0) - (counts[a.name] || 0))
      .slice(0, 15)
  }, [foodHistory])

  // Search with debounce
  useEffect(() => {
    if (!query.trim()) {
      setResults([])
      return
    }
    clearTimeout(searchTimeout.current)
    searchTimeout.current = setTimeout(async () => {
      setSearching(true)
      // Search custom foods locally
      const customResults = customFoods.filter(f =>
        f.name.toLowerCase().includes(query.toLowerCase())
      ).map(f => ({ ...f, source: 'user-custom' }))

      // Search Open Food Facts
      const apiResults = await searchFoods(query)

      setResults([...customResults, ...apiResults])
      setSearching(false)
    }, 400)

    return () => clearTimeout(searchTimeout.current)
  }, [query, customFoods])

  async function handleBarcodeScan(barcode) {
    setShowScanner(false)
    setScanStatus('Looking up barcode...')
    const food = await lookupBarcode(barcode)
    if (food) {
      setSelectedFood(food)
      setQuantity(food.servingSizeGrams || 100)
      setScanStatus('')
    } else {
      setScanStatus('Barcode not found. Try searching by name or add a custom food.')
    }
  }

  function selectFood(food) {
    setSelectedFood(food)
    setQuantity(food.servingSizeGrams || 100)
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
    setQuantity(food.servingSizeGrams || 100)
  }

  async function handleLog() {
    if (!selectedFood) return
    const qty = Number(quantity) || selectedFood.servingSizeGrams || 100
    const macros = calcFoodMacros(selectedFood, qty)

    await addFood({
      name: selectedFood.name,
      servingSizeGrams: selectedFood.servingSizeGrams || 100,
      quantity: qty,
      protein: macros.protein,
      carbs: macros.carbs,
      fat: macros.fat,
      fiber: macros.fiber,
      source: selectedFood.source || 'open-food-facts',
    })

    setLogged(selectedFood.name)
    setSelectedFood(null)
    setQuantity('')
    setQuery('')
    setResults([])
    setTimeout(() => setLogged(''), 2500)
  }

  return (
    <div className="space-y-4 pb-2">
      {/* Search Bar */}
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <input
            type="text"
            placeholder="Search foods..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/20"
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

      {/* Scan status */}
      {scanStatus && (
        <div className="bg-brand-tan/20 border border-brand-tan/30 rounded-xl p-3 flex items-start gap-2">
          <p className="text-xs text-brand-dark/80 flex-1">{scanStatus}</p>
          <button onClick={() => setScanStatus('')} className="text-gray-400 text-sm">&times;</button>
        </div>
      )}

      {/* Logged confirmation */}
      {logged && (
        <div className="bg-brand-green/15 border border-brand-green/30 rounded-xl p-3 flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#87D68D" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
          <p className="text-xs text-brand-dark font-medium">Logged: {logged}</p>
        </div>
      )}

      {/* Selected Food Detail */}
      {selectedFood && (
        <FoodDetail
          food={selectedFood}
          quantity={quantity}
          setQuantity={setQuantity}
          onLog={handleLog}
          onCancel={() => setSelectedFood(null)}
        />
      )}

      {/* Search Results */}
      {!selectedFood && results.length > 0 && (
        <div>
          <h3 className="font-display text-xs font-bold text-brand-dark/60 uppercase tracking-wider mb-2">
            Search Results
          </h3>
          <div className="space-y-1.5 max-h-80 overflow-y-auto">
            {results.map((food, i) => (
              <FoodRow key={`${food.id}-${i}`} food={food} onClick={() => selectFood(food)} />
            ))}
          </div>
        </div>
      )}

      {/* No results prompt */}
      {!selectedFood && query.trim() && !searching && results.length === 0 && (
        <div className="bg-white rounded-xl p-4 text-center border border-gray-100">
          <p className="text-sm text-gray-500 mb-2">No results found</p>
          <button
            onClick={() => { setShowCustomForm(true); setQuery('') }}
            className="px-4 py-2 bg-brand-purple text-white text-xs font-semibold rounded-lg hover:bg-brand-purple/90 transition-colors"
          >
            Add Custom Food
          </button>
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

      {/* Recents & Favorites (when not searching) */}
      {!selectedFood && !query.trim() && !showCustomForm && (
        <>
          {/* Tab Toggle */}
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
                    <FoodRow key={`recent-${i}`} food={food} onClick={() => selectHistoryFood(food)} />
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === 'favorites' && (
            <div>
              {favorites.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-4">No favorites yet</p>
              ) : (
                <div className="space-y-1.5">
                  {favorites.map((food, i) => (
                    <FoodRow key={`fav-${i}`} food={food} onClick={() => selectHistoryFood(food)} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Add custom food button */}
          <button
            onClick={() => setShowCustomForm(true)}
            className="w-full py-3 border-2 border-dashed border-gray-200 rounded-xl text-sm text-gray-500 font-medium hover:border-brand-purple hover:text-brand-purple transition-colors"
          >
            + Add Custom Food
          </button>
        </>
      )}

      {/* Barcode Scanner */}
      {showScanner && (
        <BarcodeScanner
          onScan={handleBarcodeScan}
          onClose={() => setShowScanner(false)}
        />
      )}
    </div>
  )
}

function FoodRow({ food, onClick }) {
  const cals = calcCalories(food)
  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-white rounded-xl px-3 py-2.5 border border-gray-100 hover:border-brand-purple/30 hover:bg-brand-purple/5 transition-all"
    >
      <p className="text-sm font-medium text-brand-dark truncate">{food.name}</p>
      <div className="flex gap-3 mt-0.5 text-[10px] text-gray-500">
        <span>{cals} cal</span>
        <span>P:{Math.round(food.protein || 0)}g</span>
        <span>C:{Math.round(food.carbs || 0)}g</span>
        <span>F:{Math.round(food.fat || 0)}g</span>
        {food.source === 'user-custom' && (
          <span className="text-brand-purple font-semibold">Custom</span>
        )}
        {food.servingSizeLabel && (
          <span className="text-gray-400">{food.servingSizeLabel}</span>
        )}
      </div>
    </button>
  )
}

function FoodDetail({ food, quantity, setQuantity, onLog, onCancel }) {
  const qty = Number(quantity) || food.servingSizeGrams || 100
  const macros = calcFoodMacros(food, qty)

  return (
    <div className="bg-white rounded-2xl p-4 border border-brand-purple/20 shadow-sm space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-display text-base font-bold text-brand-dark">{food.name}</h3>
          <p className="text-[10px] text-gray-400 mt-0.5">
            Per serving: {food.servingSizeGrams || 100}g
            {food.servingSizeLabel && ` (${food.servingSizeLabel})`}
          </p>
        </div>
        <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
      </div>

      {/* Quantity Input */}
      <div className="flex items-center gap-3">
        <label className="text-xs font-medium text-gray-500">Quantity</label>
        <div className="flex items-center gap-1">
          <input
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="w-20 px-3 py-2 border border-gray-200 rounded-lg text-sm text-center focus:outline-none focus:border-brand-purple focus:ring-1 focus:ring-brand-purple/30"
          />
          <span className="text-xs text-gray-400">grams</span>
        </div>
        {/* Quick quantity buttons */}
        <div className="flex gap-1 ml-auto">
          {[0.5, 1, 1.5, 2].map((mult) => (
            <button
              key={mult}
              onClick={() => setQuantity(Math.round((food.servingSizeGrams || 100) * mult))}
              className={`px-2 py-1 text-[10px] rounded font-medium transition-colors ${
                Number(quantity) === Math.round((food.servingSizeGrams || 100) * mult)
                  ? 'bg-brand-purple text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {mult === 1 ? '1×' : `${mult}×`}
            </button>
          ))}
        </div>
      </div>

      {/* Macro Preview */}
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

      <button
        onClick={onLog}
        className="w-full py-3 bg-brand-green text-brand-dark font-bold rounded-xl hover:bg-brand-green/90 transition-colors"
      >
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
    await onSave({
      name: name.trim(),
      servingSizeGrams: Number(servingSize) || 100,
      protein: Number(protein) || 0,
      carbs: Number(carbs) || 0,
      fat: Number(fat) || 0,
      fiber: Number(fiber) || 0,
    })
    setSaving(false)
  }

  return (
    <div className="bg-white rounded-2xl p-4 border border-brand-tan/30 shadow-sm space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-sm font-bold text-brand-dark">Custom Food</h3>
        <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
      </div>

      <div className="space-y-2">
        <input
          type="text"
          placeholder="Food name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-purple"
          autoFocus
        />
        <div className="grid grid-cols-2 gap-2">
          <Field label="Serving (g)" value={servingSize} onChange={setServingSize} />
          <Field label="Protein (g)" value={protein} onChange={setProtein} />
          <Field label="Carbs (g)" value={carbs} onChange={setCarbs} />
          <Field label="Fat (g)" value={fat} onChange={setFat} />
          <Field label="Fiber (g)" value={fiber} onChange={setFiber} />
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={!name.trim() || saving}
        className="w-full py-2.5 bg-brand-tan text-brand-dark font-semibold rounded-xl hover:bg-brand-tan/90 transition-colors disabled:opacity-40"
      >
        {saving ? 'Saving...' : 'Save & Select'}
      </button>
    </div>
  )
}

function Field({ label, value, onChange }) {
  return (
    <div>
      <label className="block text-[10px] font-medium text-gray-400 mb-0.5">{label}</label>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:border-brand-purple"
      />
    </div>
  )
}

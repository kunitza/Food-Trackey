import { useState, useEffect, useCallback } from 'react'
import {
  doc, getDoc, getDocs, setDoc, updateDoc, onSnapshot, serverTimestamp, arrayUnion, arrayRemove,
  collection, query, where, documentId,
} from 'firebase/firestore'
import { updateProfile as authUpdateProfile } from 'firebase/auth'
import { auth, db } from '../firebase'
import { useAuth } from '../contexts/AuthContext'
import { getTodayKey, kgToLbs } from '../utils/macros'

export function useFirestore() {
  const { user } = useAuth()
  const [targets, setTargets] = useState(null)
  const [todayFoods, setTodayFoods] = useState([])
  const [customFoods, setCustomFoods] = useState([])
  const [foodHistory, setFoodHistory] = useState([])
  const [selectedDate, setSelectedDate] = useState(getTodayKey())
  const [loading, setLoading] = useState(true)
  const [weightLog, setWeightLog] = useState({ preferredUnit: 'lbs', entries: [] })
  const [mealTargetSnapshot, setMealTargetSnapshot] = useState(null)

  // Listen to user targets
  useEffect(() => {
    if (!user) return
    const unsub = onSnapshot(doc(db, 'users', user.uid), (snap) => {
      if (snap.exists()) {
        const data = snap.data()
        setTargets(data.targets || null)
      }
    })
    return unsub
  }, [user])

  // Listen to selected date's meals (including target snapshot)
  useEffect(() => {
    if (!user) return
    setLoading(true)
    const mealRef = doc(db, 'users', user.uid, 'meals', selectedDate)
    const unsub = onSnapshot(mealRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data()
        setTodayFoods(data.foods || [])
        setMealTargetSnapshot(data.targetSnapshot || null)
      } else {
        setTodayFoods([])
        setMealTargetSnapshot(null)
      }
      setLoading(false)
    })
    return unsub
  }, [user, selectedDate])

  // Listen to custom foods
  useEffect(() => {
    if (!user) return
    const ref = doc(db, 'users', user.uid, 'data', 'customFoods')
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        setCustomFoods(snap.data().items || [])
      }
    })
    return unsub
  }, [user])

  // Listen to food history (recents)
  useEffect(() => {
    if (!user) return
    const ref = doc(db, 'users', user.uid, 'data', 'foodHistory')
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        setFoodHistory(snap.data().items || [])
      }
    })
    return unsub
  }, [user])

  // Listen to weight log
  useEffect(() => {
    if (!user) return
    const ref = doc(db, 'users', user.uid, 'data', 'weightLog')
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        setWeightLog(snap.data())
      } else {
        setWeightLog({ preferredUnit: 'lbs', entries: [] })
      }
    })
    return unsub
  }, [user])

  // Get effective targets for a given date
  const getEffectiveTargets = useCallback((dateStr) => {
    const isToday = dateStr === getTodayKey()
    if (isToday || !mealTargetSnapshot) {
      return targets
    }
    return mealTargetSnapshot
  }, [targets, mealTargetSnapshot])

  const updateTargets = useCallback(async (newTargets) => {
    if (!user) return
    await updateDoc(doc(db, 'users', user.uid), {
      targets: { ...newTargets, lastUpdated: serverTimestamp() },
    })
  }, [user])

  // Save a target snapshot to a meal document
  const saveTargetSnapshot = useCallback(async (date) => {
    if (!user || !targets) return
    if (date !== getTodayKey()) return
    const mealRef = doc(db, 'users', user.uid, 'meals', date)
    const snap = await getDoc(mealRef)
    if (snap.exists()) {
      await updateDoc(mealRef, {
        targetSnapshot: {
          dailyCalories: targets.dailyCalories,
          preset: targets.preset,
          customMacroRatios: targets.customMacroRatios,
        }
      })
    }
  }, [user, targets])

  const addFood = useCallback(async (food, date = selectedDate) => {
    if (!user) return
    const mealRef = doc(db, 'users', user.uid, 'meals', date)
    const foodEntry = {
      ...food,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      loggedAt: new Date().toISOString(),
      // Snapshot per-base-serving macros so future quantity edits scale correctly.
      _base: {
        servingSizeGrams: food.servingSizeGrams || 100,
        protein: food.protein || 0,
        carbs: food.carbs || 0,
        fat: food.fat || 0,
        fiber: food.fiber || 0,
      },
    }

    // Atomic append; no read-then-write race.
    await setDoc(mealRef, { foods: arrayUnion(foodEntry) }, { merge: true })

    // Save target snapshot if this is today
    await saveTargetSnapshot(date)

    // Update food history — read+write is fine here (single-user, infrequent contention),
    // but use merge so we don't blow away sibling fields like favorites toggled meanwhile.
    const histRef = doc(db, 'users', user.uid, 'data', 'foodHistory')
    const histSnap = await getDoc(histRef)
    const now = new Date().toISOString()
    const existingItem = histSnap.exists()
      ? (histSnap.data().items || []).find(i => i.name === food.name)
      : null
    const histEntry = {
      name: food.name,
      lastLogged: now,
      protein: food.protein,
      carbs: food.carbs,
      fat: food.fat,
      fiber: food.fiber,
      servingSizeGrams: food.servingSizeGrams,
      source: food.source || 'open-food-facts',
      // Preserve favorite flag across re-logs.
      favorite: existingItem?.favorite || false,
    }

    if (histSnap.exists()) {
      const items = histSnap.data().items || []
      const filtered = items.filter(i => i.name !== food.name)
      const updated = [histEntry, ...filtered].slice(0, 50)
      await setDoc(histRef, { items: updated }, { merge: true })
    } else {
      await setDoc(histRef, { items: [histEntry] })
    }

    return foodEntry
  }, [user, selectedDate, saveTargetSnapshot])

  const removeFood = useCallback(async (food, date = selectedDate) => {
    if (!user) return
    const mealRef = doc(db, 'users', user.uid, 'meals', date)
    await updateDoc(mealRef, { foods: arrayRemove(food) })
  }, [user, selectedDate])

  const updateFood = useCallback(async (oldFood, newFood, date = selectedDate) => {
    if (!user) return
    const mealRef = doc(db, 'users', user.uid, 'meals', date)
    const snap = await getDoc(mealRef)
    if (!snap.exists()) return
    const foods = snap.data().foods || []
    const idx = foods.findIndex(f => f.id === oldFood.id)
    if (idx === -1) return
    foods[idx] = { ...newFood, id: oldFood.id }
    // Only write the foods array — preserves targetSnapshot and any other fields.
    await updateDoc(mealRef, { foods })
  }, [user, selectedDate])

  const addCustomFood = useCallback(async (food) => {
    if (!user) return
    const ref = doc(db, 'users', user.uid, 'data', 'customFoods')
    const entry = { ...food, id: `custom-${Date.now()}`, dateAdded: new Date().toISOString() }
    await setDoc(ref, { items: arrayUnion(entry) }, { merge: true })
    return entry
  }, [user])

  const removeCustomFood = useCallback(async (food) => {
    if (!user) return
    const ref = doc(db, 'users', user.uid, 'data', 'customFoods')
    await updateDoc(ref, { items: arrayRemove(food) })
  }, [user])

  const toggleFavoriteFood = useCallback(async (foodName) => {
    if (!user) return
    const ref = doc(db, 'users', user.uid, 'data', 'foodHistory')
    const snap = await getDoc(ref)
    if (!snap.exists()) return
    const items = snap.data().items || []
    const updated = items.map(i =>
      i.name === foodName ? { ...i, favorite: !i.favorite } : i
    )
    await setDoc(ref, { items: updated }, { merge: true })
  }, [user])

  const getMealsForDateRange = useCallback(async (startDate, endDate) => {
    if (!user) return []
    // Build the full date list so days with zero meals still appear in the chart.
    const dates = []
    const current = new Date(startDate + 'T12:00:00')
    const end = new Date(endDate + 'T12:00:00')
    while (current <= end) {
      const y = current.getFullYear()
      const m = String(current.getMonth() + 1).padStart(2, '0')
      const d = String(current.getDate()).padStart(2, '0')
      dates.push(`${y}-${m}-${d}`)
      current.setDate(current.getDate() + 1)
    }
    // Single range query — one network roundtrip for the whole range, vs N
    // separate getDoc() calls. Doc IDs are YYYY-MM-DD so they sort lexicographically.
    const mealsCol = collection(db, 'users', user.uid, 'meals')
    const q = query(
      mealsCol,
      where(documentId(), '>=', startDate),
      where(documentId(), '<=', endDate),
    )
    const snap = await getDocs(q)
    const byDate = {}
    snap.forEach(d => { byDate[d.id] = d.data() })
    return dates.map(dateKey => ({
      date: dateKey,
      foods: byDate[dateKey]?.foods || [],
      targetSnapshot: byDate[dateKey]?.targetSnapshot || null,
    }))
  }, [user])

  const updateProfile = useCallback(async (name) => {
    if (!user) return
    await updateDoc(doc(db, 'users', user.uid), {
      'profile.name': name,
    })
    // Also keep Firebase Auth displayName in sync so useAuth().user.displayName is fresh.
    if (auth.currentUser) {
      await authUpdateProfile(auth.currentUser, { displayName: name })
    }
  }, [user])

  // ---- Weight tracking ----

  const addWeightEntry = useCallback(async (weight, unit, date) => {
    if (!user) return
    const ref = doc(db, 'users', user.uid, 'data', 'weightLog')
    const snap = await getDoc(ref)
    const targetDate = date || getTodayKey()

    const weightLbs = unit === 'kg' ? kgToLbs(weight) : Number(weight)

    const entry = {
      date: targetDate,
      weightLbs: Math.round(weightLbs * 10) / 10,
      enteredUnit: unit,
      enteredValue: Number(weight),
    }

    if (snap.exists()) {
      const data = snap.data()
      const entries = (data.entries || []).filter(e => e.date !== targetDate)
      entries.push(entry)
      entries.sort((a, b) => a.date.localeCompare(b.date))
      // Preserve preferredUnit (don't auto-flip it just because user logged in another unit).
      await setDoc(ref, { preferredUnit: data.preferredUnit || unit, entries }, { merge: true })
    } else {
      await setDoc(ref, { preferredUnit: unit, entries: [entry] })
    }
  }, [user])

  const removeWeightEntry = useCallback(async (date) => {
    if (!user) return
    const ref = doc(db, 'users', user.uid, 'data', 'weightLog')
    const snap = await getDoc(ref)
    if (!snap.exists()) return
    const data = snap.data()
    const entries = (data.entries || []).filter(e => e.date !== date)
    await setDoc(ref, { ...data, entries }, { merge: true })
  }, [user])

  const updateWeightUnit = useCallback(async (unit) => {
    if (!user) return
    const ref = doc(db, 'users', user.uid, 'data', 'weightLog')
    const snap = await getDoc(ref)
    if (snap.exists()) {
      await updateDoc(ref, { preferredUnit: unit })
    } else {
      await setDoc(ref, { preferredUnit: unit, entries: [] })
    }
  }, [user])

  const getWeightForDateRange = useCallback((startDate, endDate) => {
    const entries = weightLog.entries || []
    return entries.filter(e => e.date >= startDate && e.date <= endDate)
  }, [weightLog])

  return {
    targets,
    todayFoods,
    customFoods,
    foodHistory,
    selectedDate,
    setSelectedDate,
    loading,
    mealTargetSnapshot,
    getEffectiveTargets,
    updateTargets,
    addFood,
    removeFood,
    updateFood,
    addCustomFood,
    removeCustomFood,
    toggleFavoriteFood,
    getMealsForDateRange,
    updateProfile,
    weightLog,
    addWeightEntry,
    removeWeightEntry,
    updateWeightUnit,
    getWeightForDateRange,
  }
}

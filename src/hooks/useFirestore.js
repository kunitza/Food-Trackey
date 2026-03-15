import { useState, useEffect, useCallback } from 'react'
import {
  doc, getDoc, setDoc, updateDoc, onSnapshot, serverTimestamp, arrayUnion, arrayRemove,
} from 'firebase/firestore'
import { db } from '../firebase'
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
    const snap = await getDoc(mealRef)
    const foodEntry = {
      ...food,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      loggedAt: new Date().toISOString(),
    }

    if (snap.exists()) {
      await updateDoc(mealRef, { foods: arrayUnion(foodEntry) })
    } else {
      await setDoc(mealRef, { foods: [foodEntry] })
    }

    // Save target snapshot if this is today
    await saveTargetSnapshot(date)

    // Update food history
    const histRef = doc(db, 'users', user.uid, 'data', 'foodHistory')
    const histSnap = await getDoc(histRef)
    const now = new Date().toISOString()
    const histEntry = {
      name: food.name,
      lastLogged: now,
      protein: food.protein,
      carbs: food.carbs,
      fat: food.fat,
      fiber: food.fiber,
      servingSizeGrams: food.servingSizeGrams,
      source: food.source || 'open-food-facts',
    }

    if (histSnap.exists()) {
      const items = histSnap.data().items || []
      const filtered = items.filter(i => i.name !== food.name)
      const updated = [histEntry, ...filtered].slice(0, 50)
      await setDoc(histRef, { items: updated })
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
    await setDoc(mealRef, { ...snap.data(), foods })
  }, [user, selectedDate])

  const addCustomFood = useCallback(async (food) => {
    if (!user) return
    const ref = doc(db, 'users', user.uid, 'data', 'customFoods')
    const snap = await getDoc(ref)
    const entry = { ...food, id: `custom-${Date.now()}`, dateAdded: new Date().toISOString() }

    if (snap.exists()) {
      await updateDoc(ref, { items: arrayUnion(entry) })
    } else {
      await setDoc(ref, { items: [entry] })
    }
    return entry
  }, [user])

  const removeCustomFood = useCallback(async (food) => {
    if (!user) return
    const ref = doc(db, 'users', user.uid, 'data', 'customFoods')
    await updateDoc(ref, { items: arrayRemove(food) })
  }, [user])

  const getMealsForDateRange = useCallback(async (startDate, endDate) => {
    if (!user) return []
    const results = []
    const current = new Date(startDate + 'T12:00:00')
    const end = new Date(endDate + 'T12:00:00')

    while (current <= end) {
      const y = current.getFullYear()
      const m = String(current.getMonth() + 1).padStart(2, '0')
      const d = String(current.getDate()).padStart(2, '0')
      const dateKey = `${y}-${m}-${d}`
      const snap = await getDoc(doc(db, 'users', user.uid, 'meals', dateKey))
      results.push({
        date: dateKey,
        foods: snap.exists() ? (snap.data().foods || []) : [],
        targetSnapshot: snap.exists() ? (snap.data().targetSnapshot || null) : null,
      })
      current.setDate(current.getDate() + 1)
    }
    return results
  }, [user])

  const updateProfile = useCallback(async (name) => {
    if (!user) return
    await updateDoc(doc(db, 'users', user.uid), {
      'profile.name': name,
    })
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
      await setDoc(ref, { preferredUnit: unit, entries })
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
    await setDoc(ref, { ...data, entries })
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
    getMealsForDateRange,
    updateProfile,
    weightLog,
    addWeightEntry,
    removeWeightEntry,
    updateWeightUnit,
    getWeightForDateRange,
  }
}

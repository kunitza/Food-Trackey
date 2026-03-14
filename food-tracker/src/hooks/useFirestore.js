import { useState, useEffect, useCallback } from 'react'
import {
  doc, getDoc, setDoc, updateDoc, onSnapshot, serverTimestamp, arrayUnion, arrayRemove,
} from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../contexts/AuthContext'
import { getTodayKey } from '../utils/macros'

export function useFirestore() {
  const { user } = useAuth()
  const [targets, setTargets] = useState(null)
  const [todayFoods, setTodayFoods] = useState([])
  const [customFoods, setCustomFoods] = useState([])
  const [foodHistory, setFoodHistory] = useState([])
  const [selectedDate, setSelectedDate] = useState(getTodayKey())
  const [loading, setLoading] = useState(true)

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

  // Listen to selected date's meals
  useEffect(() => {
    if (!user) return
    setLoading(true)
    const mealRef = doc(db, 'users', user.uid, 'meals', selectedDate)
    const unsub = onSnapshot(mealRef, (snap) => {
      if (snap.exists()) {
        setTodayFoods(snap.data().foods || [])
      } else {
        setTodayFoods([])
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

  const updateTargets = useCallback(async (newTargets) => {
    if (!user) return
    await updateDoc(doc(db, 'users', user.uid), {
      targets: { ...newTargets, lastUpdated: serverTimestamp() },
    })
  }, [user])

  const addFood = useCallback(async (food, date = selectedDate) => {
    if (!user) return
    const mealRef = doc(db, 'users', user.uid, 'meals', date)
    const snap = await getDoc(mealRef)
    const foodEntry = { ...food, id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}` }

    if (snap.exists()) {
      await updateDoc(mealRef, { foods: arrayUnion(foodEntry) })
    } else {
      await setDoc(mealRef, { foods: [foodEntry] })
    }

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
  }, [user, selectedDate])

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
    await setDoc(mealRef, { foods })
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
    const current = new Date(startDate)
    const end = new Date(endDate)

    while (current <= end) {
      const dateKey = current.toISOString().split('T')[0]
      const snap = await getDoc(doc(db, 'users', user.uid, 'meals', dateKey))
      results.push({
        date: dateKey,
        foods: snap.exists() ? (snap.data().foods || []) : [],
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

  return {
    targets,
    todayFoods,
    customFoods,
    foodHistory,
    selectedDate,
    setSelectedDate,
    loading,
    updateTargets,
    addFood,
    removeFood,
    updateFood,
    addCustomFood,
    removeCustomFood,
    getMealsForDateRange,
    updateProfile,
  }
}

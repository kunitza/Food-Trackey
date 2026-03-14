import React, { useState, useEffect, useMemo } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { useFirestore } from '../hooks/useFirestore'
import { calcCalories, getDateKey, calcMacroGrams } from '../utils/macros'
import { PRESETS } from '../utils/macros'

export default function History() {
  const { getMealsForDateRange, targets } = useFirestore()
  const [days, setDays] = useState(7)
  const [mode, setMode] = useState('calories') // 'calories' | 'grams'
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)

  const ratios = targets
    ? (targets.preset === 'custom' ? targets.customMacroRatios : (PRESETS[targets.preset] || PRESETS.balanced))
    : PRESETS.balanced
  const dailyCals = targets?.dailyCalories || 2000
  const macroTargets = calcMacroGrams(dailyCals, ratios)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const end = new Date()
      const start = new Date()
      start.setDate(start.getDate() - (days - 1))
      const meals = await getMealsForDateRange(getDateKey(start), getDateKey(end))

      const chartData = meals.map(({ date, foods }) => {
        const totals = foods.reduce(
          (acc, f) => ({
            protein: acc.protein + (f.protein || 0),
            carbs: acc.carbs + (f.carbs || 0),
            fat: acc.fat + (f.fat || 0),
            fiber: acc.fiber + (f.fiber || 0),
            calories: acc.calories + calcCalories(f),
          }),
          { protein: 0, carbs: 0, fat: 0, fiber: 0, calories: 0 }
        )
        const d = new Date(date + 'T12:00:00')
        return {
          date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          dateRaw: date,
          protein: Math.round(totals.protein),
          carbs: Math.round(totals.carbs),
          fat: Math.round(totals.fat),
          fiber: Math.round(totals.fiber),
          calories: Math.round(totals.calories),
          proteinCal: Math.round(totals.protein * 4),
          carbsCal: Math.round(totals.carbs * 4),
          fatCal: Math.round(totals.fat * 9),
        }
      })
      setData(chartData)
      setLoading(false)
    }
    load()
  }, [days, getMealsForDateRange])

  const avgCalories = useMemo(() => {
    if (data.length === 0) return 0
    return Math.round(data.reduce((sum, d) => sum + d.calories, 0) / data.length)
  }, [data])

  const avgProtein = useMemo(() => {
    if (data.length === 0) return 0
    return Math.round(data.reduce((sum, d) => sum + d.protein, 0) / data.length)
  }, [data])

  return (
    <div className="space-y-4 pb-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-bold text-brand-dark">History</h2>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
          {[7, 14, 30].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-3 py-1.5 text-[10px] font-semibold rounded-md transition-all ${
                days === d ? 'bg-white text-brand-dark shadow-sm' : 'text-gray-500'
              }`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {/* Mode Toggle */}
      <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
        {['calories', 'grams'].map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`flex-1 py-2 text-xs font-semibold rounded-md transition-all ${
              mode === m ? 'bg-white text-brand-dark shadow-sm' : 'text-gray-500'
            }`}
          >
            {m === 'calories' ? 'Calories' : 'Grams'}
          </button>
        ))}
      </div>

      {/* Chart */}
      <div className="bg-white rounded-2xl p-3 border border-gray-100 shadow-sm">
        {loading ? (
          <div className="h-52 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-brand-purple/30 border-t-brand-purple rounded-full animate-spin" />
          </div>
        ) : data.length === 0 ? (
          <div className="h-52 flex items-center justify-center">
            <p className="text-sm text-gray-400">No data for this period</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            {mode === 'calories' ? (
              <AreaChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: -15 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 9, fill: '#999' }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fontSize: 9, fill: '#999' }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #eee' }}
                  formatter={(val, name) => [`${val} cal`, name]}
                />
                <Area type="monotone" dataKey="proteinCal" stackId="1" name="Protein" stroke="#87D68D" fill="#87D68D" fillOpacity={0.7} />
                <Area type="monotone" dataKey="carbsCal" stackId="1" name="Carbs" stroke="#846075" fill="#846075" fillOpacity={0.6} />
                <Area type="monotone" dataKey="fatCal" stackId="1" name="Fat" stroke="#DBD3D8" fill="#DBD3D8" fillOpacity={0.7} />
              </AreaChart>
            ) : (
              <AreaChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: -15 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 9, fill: '#999' }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fontSize: 9, fill: '#999' }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #eee' }}
                  formatter={(val, name) => [`${val}g`, name]}
                />
                <Area type="monotone" dataKey="protein" stackId="1" name="Protein" stroke="#87D68D" fill="#87D68D" fillOpacity={0.7} />
                <Area type="monotone" dataKey="carbs" stackId="1" name="Carbs" stroke="#846075" fill="#846075" fillOpacity={0.6} />
                <Area type="monotone" dataKey="fat" stackId="1" name="Fat" stroke="#DBD3D8" fill="#DBD3D8" fillOpacity={0.7} />
                <Area type="monotone" dataKey="fiber" stackId="1" name="Fiber" stroke="#D4AA7D" fill="#D4AA7D" fillOpacity={0.5} />
              </AreaChart>
            )}
          </ResponsiveContainer>
        )}

        {/* Legend */}
        <div className="flex items-center justify-center gap-4 mt-2">
          <LegendItem color="#87D68D" label="Protein" />
          <LegendItem color="#846075" label="Carbs" />
          <LegendItem color="#DBD3D8" label="Fat" />
          {mode === 'grams' && <LegendItem color="#D4AA7D" label="Fiber" />}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3">
        <SummaryCard
          title="Avg Daily Calories"
          value={avgCalories}
          target={dailyCals}
          unit="cal"
        />
        <SummaryCard
          title="Avg Daily Protein"
          value={avgProtein}
          target={macroTargets.protein}
          unit="g"
        />
      </div>

      {/* Daily Breakdown */}
      {!loading && data.length > 0 && (
        <div>
          <h3 className="font-display text-xs font-bold text-brand-dark/60 uppercase tracking-wider mb-2">
            Daily Breakdown
          </h3>
          <div className="space-y-1.5">
            {[...data].reverse().map((day) => (
              <div key={day.dateRaw} className="bg-white rounded-xl px-3 py-2.5 border border-gray-100">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-brand-dark">{day.date}</span>
                  <span className="text-xs font-bold text-brand-dark/70">{day.calories} cal</span>
                </div>
                <div className="flex gap-3 text-[10px] text-gray-500">
                  <span>P: {day.protein}g</span>
                  <span>C: {day.carbs}g</span>
                  <span>F: {day.fat}g</span>
                  <span>Fb: {day.fiber}g</span>
                  <span className="ml-auto">
                    {day.calories > 0
                      ? `${Math.round((day.protein * 4 / day.calories) * 100)}/${Math.round((day.carbs * 4 / day.calories) * 100)}/${Math.round((day.fat * 9 / day.calories) * 100)}`
                      : '–/–/–'
                    } P/C/F
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function LegendItem({ color, label }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: color }} />
      <span className="text-[10px] text-gray-500 font-medium">{label}</span>
    </div>
  )
}

function SummaryCard({ title, value, target, unit }) {
  const pct = target > 0 ? Math.round((value / target) * 100) : 0
  return (
    <div className="bg-white rounded-xl p-3 border border-gray-100 shadow-sm">
      <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">{title}</p>
      <p className="font-display text-xl font-bold text-brand-dark mt-0.5">
        {value}<span className="text-sm font-medium text-gray-400"> {unit}</span>
      </p>
      <p className="text-[10px] text-gray-400 mt-0.5">
        {pct}% of {target}{unit} target
      </p>
    </div>
  )
}

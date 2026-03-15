import React, { useState, useEffect, useMemo } from 'react'
import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Label,
} from 'recharts'
import { useFirestore } from '../hooks/useFirestore'
import { calcCalories, getTodayKey, calcMacroGrams, lbsToKg } from '../utils/macros'
import { getLocalDateStr } from '../utils/timezone'
import { PRESETS } from '../utils/macros'

const CHART = {
  protein: '#082900',
  carbs: '#846075',
  fat: '#D4AA7D',
  fiber: '#1F68C1',
  weight: '#0A0B0A',
}

// Custom tooltip that always shows total calories
function CustomTooltip({ active, payload, label, mode, weightUnit }) {
  if (!active || !payload || payload.length === 0) return null

  const dataPoint = payload[0]?.payload
  if (!dataPoint) return null

  // Calculate total calories from the underlying data (not the chart values)
  const totalCalories = dataPoint.calories || 0

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-2.5 shadow-md text-[11px]">
      <p className="font-semibold text-brand-dark mb-1.5">{label}</p>

      {mode === 'calories' ? (
        <>
          <div className="flex items-center gap-1.5 mb-0.5">
            <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: CHART.protein }} />
            <span className="text-gray-600">Protein:</span>
            <span className="font-semibold text-brand-dark ml-auto">{dataPoint.proteinCal} cal</span>
          </div>
          <div className="flex items-center gap-1.5 mb-0.5">
            <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: CHART.carbs }} />
            <span className="text-gray-600">Carbs:</span>
            <span className="font-semibold text-brand-dark ml-auto">{dataPoint.carbsCal} cal</span>
          </div>
          <div className="flex items-center gap-1.5 mb-0.5">
            <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: CHART.fat }} />
            <span className="text-gray-600">Fat:</span>
            <span className="font-semibold text-brand-dark ml-auto">{dataPoint.fatCal} cal</span>
          </div>
        </>
      ) : (
        <>
          <div className="flex items-center gap-1.5 mb-0.5">
            <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: CHART.protein }} />
            <span className="text-gray-600">Protein:</span>
            <span className="font-semibold text-brand-dark ml-auto">{dataPoint.protein}g</span>
          </div>
          <div className="flex items-center gap-1.5 mb-0.5">
            <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: CHART.carbs }} />
            <span className="text-gray-600">Carbs:</span>
            <span className="font-semibold text-brand-dark ml-auto">{dataPoint.carbs}g</span>
          </div>
          <div className="flex items-center gap-1.5 mb-0.5">
            <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: CHART.fat }} />
            <span className="text-gray-600">Fat:</span>
            <span className="font-semibold text-brand-dark ml-auto">{dataPoint.fat}g</span>
          </div>
          <div className="flex items-center gap-1.5 mb-0.5">
            <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: CHART.fiber }} />
            <span className="text-gray-600">Fiber:</span>
            <span className="font-semibold text-brand-dark ml-auto">{dataPoint.fiber}g</span>
          </div>
        </>
      )}

      {/* Always show total calories */}
      <div className="border-t border-gray-100 mt-1.5 pt-1.5 flex items-center gap-1.5">
        <span className="font-semibold text-gray-600">Total:</span>
        <span className="font-bold text-brand-dark ml-auto">{totalCalories} cal</span>
      </div>

      {/* Weight if available */}
      {dataPoint.weight && (
        <div className="flex items-center gap-1.5 mt-0.5">
          <div className="w-2 h-0.5 rounded" style={{ backgroundColor: CHART.weight }} />
          <span className="text-gray-600">Weight:</span>
          <span className="font-semibold text-brand-dark ml-auto">{dataPoint.weight} {weightUnit}</span>
        </div>
      )}
    </div>
  )
}

export default function History() {
  const { getMealsForDateRange, targets, getWeightForDateRange, weightLog } = useFirestore()
  const [days, setDays] = useState(7)
  const [mode, setMode] = useState('calories')
  const [showWeight, setShowWeight] = useState(false)
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)

  const weightUnit = weightLog?.preferredUnit || 'lbs'

  const currentRatios = targets
    ? (targets.preset === 'custom' ? targets.customMacroRatios : (PRESETS[targets.preset] || PRESETS.balanced))
    : PRESETS.balanced
  const currentDailyCals = targets?.dailyCalories || 2000
  const currentMacroTargets = calcMacroGrams(currentDailyCals, currentRatios)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const end = new Date()
      const start = new Date()
      start.setDate(start.getDate() - (days - 1))

      const startKey = getLocalDateStr(start)
      const endKey = getLocalDateStr(end)

      const meals = await getMealsForDateRange(startKey, endKey)
      const weightEntries = getWeightForDateRange(startKey, endKey)

      const weightByDate = {}
      weightEntries.forEach(e => {
        weightByDate[e.date] = weightUnit === 'kg' ? lbsToKg(e.weightLbs) : e.weightLbs
      })

      const todayKey = getTodayKey()

      const chartData = meals.map(({ date, foods, targetSnapshot }) => {
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

        let dayTargets = targets
        if (date !== todayKey && targetSnapshot) {
          dayTargets = targetSnapshot
        }

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
          weight: weightByDate[date] || null,
          dayCalTarget: dayTargets?.dailyCalories || currentDailyCals,
        }
      })
      setData(chartData)
      setLoading(false)
    }
    load()
  }, [days, getMealsForDateRange, getWeightForDateRange, weightUnit, targets])

  const avgCalories = useMemo(() => {
    if (data.length === 0) return 0
    return Math.round(data.reduce((sum, d) => sum + d.calories, 0) / data.length)
  }, [data])

  const avgProtein = useMemo(() => {
    if (data.length === 0) return 0
    return Math.round(data.reduce((sum, d) => sum + d.protein, 0) / data.length)
  }, [data])

  const hasWeightData = data.some(d => d.weight !== null)

  const leftAxisLabel = mode === 'calories' ? 'Calories' : 'Grams'

  return (
    <div className="space-y-4 pb-2">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-bold text-brand-dark">History</h2>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
          {[7, 14, 30].map((d) => (
            <button key={d} onClick={() => setDays(d)}
              className={`px-3 py-1.5 text-[10px] font-semibold rounded-md transition-all ${days === d ? 'bg-white text-brand-dark shadow-sm' : 'text-gray-500'}`}>
              {d}d
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-2">
        <div className="flex-1 flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
          {['calories', 'grams'].map((m) => (
            <button key={m} onClick={() => setMode(m)}
              className={`flex-1 py-2 text-xs font-semibold rounded-md transition-all ${mode === m ? 'bg-white text-brand-dark shadow-sm' : 'text-gray-500'}`}>
              {m === 'calories' ? 'Calories' : 'Grams'}
            </button>
          ))}
        </div>
        {hasWeightData && (
          <button onClick={() => setShowWeight(!showWeight)}
            className={`px-3 py-2 text-xs font-semibold rounded-lg transition-all ${showWeight ? 'bg-brand-purple text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
            Weight
          </button>
        )}
      </div>

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
            <ComposedChart data={data} margin={{ top: 5, right: showWeight ? 40 : 5, bottom: 5, left: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#999' }} tickLine={false} axisLine={false} />
              <YAxis yAxisId="left" tick={{ fontSize: 9, fill: '#999' }} tickLine={false} axisLine={false}>
                <Label value={leftAxisLabel} position="insideLeft" offset={0} style={{ fontSize: 10, fill: '#999' }} angle={-90} />
              </YAxis>
              {showWeight && (
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 9, fill: CHART.weight }} tickLine={false} axisLine={false} domain={['dataMin - 5', 'dataMax + 5']}>
                  <Label value={`Weight (${weightUnit})`} position="insideRight" offset={0} style={{ fontSize: 10, fill: '#999' }} angle={90} />
                </YAxis>
              )}
              <Tooltip content={<CustomTooltip mode={mode} weightUnit={weightUnit} />} />

              {mode === 'calories' ? (
                <>
                  <Area yAxisId="left" type="monotone" dataKey="proteinCal" stackId="1" name="Protein" stroke={CHART.protein} fill={CHART.protein} fillOpacity={0.7} />
                  <Area yAxisId="left" type="monotone" dataKey="carbsCal" stackId="1" name="Carbs" stroke={CHART.carbs} fill={CHART.carbs} fillOpacity={0.6} />
                  <Area yAxisId="left" type="monotone" dataKey="fatCal" stackId="1" name="Fat" stroke={CHART.fat} fill={CHART.fat} fillOpacity={0.7} />
                </>
              ) : (
                <>
                  <Area yAxisId="left" type="monotone" dataKey="protein" stackId="1" name="Protein" stroke={CHART.protein} fill={CHART.protein} fillOpacity={0.7} />
                  <Area yAxisId="left" type="monotone" dataKey="carbs" stackId="1" name="Carbs" stroke={CHART.carbs} fill={CHART.carbs} fillOpacity={0.6} />
                  <Area yAxisId="left" type="monotone" dataKey="fat" stackId="1" name="Fat" stroke={CHART.fat} fill={CHART.fat} fillOpacity={0.7} />
                  <Area yAxisId="left" type="monotone" dataKey="fiber" stackId="1" name="Fiber" stroke={CHART.fiber} fill={CHART.fiber} fillOpacity={0.5} />
                </>
              )}

              {showWeight && (
                <Line yAxisId="right" type="monotone" dataKey="weight" name="Weight"
                  stroke={CHART.weight} strokeWidth={2} dot={{ r: 3, fill: CHART.weight }} connectNulls />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        )}

        <div className="flex items-center justify-center gap-4 mt-2 flex-wrap">
          <LegendItem color={CHART.protein} label="Protein" />
          <LegendItem color={CHART.carbs} label="Carbs" />
          <LegendItem color={CHART.fat} label="Fat" />
          {mode === 'grams' && <LegendItem color={CHART.fiber} label="Fiber" />}
          {showWeight && <LegendItem color={CHART.weight} label={`Weight (${weightUnit})`} line />}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <SummaryCard title="Avg Daily Calories" value={avgCalories} target={currentDailyCals} unit="cal" />
        <SummaryCard title="Avg Daily Protein" value={avgProtein} target={currentMacroTargets.protein} unit="g" />
      </div>

      {!loading && data.length > 0 && (
        <div>
          <h3 className="font-display text-xs font-bold text-brand-dark/60 uppercase tracking-wider mb-2">Daily Breakdown</h3>
          <div className="space-y-1.5">
            {[...data].reverse().map((day) => (
              <div key={day.dateRaw} className="bg-white rounded-xl px-3 py-2.5 border border-gray-100">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-brand-dark">{day.date}</span>
                  <div className="flex items-center gap-3">
                    {day.weight && (
                      <span className="text-[10px] font-semibold" style={{ color: CHART.weight }}>
                        {day.weight} {weightUnit}
                      </span>
                    )}
                    <span className="text-xs font-bold text-brand-dark/70">{day.calories} cal</span>
                  </div>
                </div>
                <div className="flex gap-3 text-[10px] text-gray-500">
                  <span>P: {day.protein}g</span>
                  <span>C: {day.carbs}g</span>
                  <span>F: {day.fat}g</span>
                  <span>Fb: {day.fiber}g</span>
                  <span className="ml-auto">
                    {day.calories > 0
                      ? `${Math.round((day.protein * 4 / day.calories) * 100)}/${Math.round((day.carbs * 4 / day.calories) * 100)}/${Math.round((day.fat * 9 / day.calories) * 100)}`
                      : '–/–/–'} P/C/F
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

function LegendItem({ color, label, line }) {
  return (
    <div className="flex items-center gap-1.5">
      {line ? (
        <div className="w-4 h-0.5 rounded" style={{ backgroundColor: color }} />
      ) : (
        <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: color }} />
      )}
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
      <p className="text-[10px] text-gray-400 mt-0.5">{pct}% of {target}{unit} target</p>
    </div>
  )
}

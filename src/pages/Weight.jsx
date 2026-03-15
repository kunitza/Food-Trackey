import React, { useState, useMemo } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Label,
} from 'recharts'
import { useFirestore } from '../hooks/useFirestore'
import { getTodayKey, lbsToKg, kgToLbs, formatDate } from '../utils/macros'

// ---- Simple Date Picker (no red weekends) ----
function SimpleDatePicker({ value, max, onChange }) {
  const [open, setOpen] = useState(false)
  const selected = new Date(value + 'T12:00:00')
  const [viewMonth, setViewMonth] = useState(selected.getMonth())
  const [viewYear, setViewYear] = useState(selected.getFullYear())

  const maxDate = max ? new Date(max + 'T12:00:00') : new Date()

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay()

  const weeks = []
  let week = new Array(firstDayOfWeek).fill(null)
  for (let d = 1; d <= daysInMonth; d++) {
    week.push(d)
    if (week.length === 7) {
      weeks.push(week)
      week = []
    }
  }
  if (week.length > 0) {
    while (week.length < 7) week.push(null)
    weeks.push(week)
  }

  function handleDayClick(day) {
    if (!day) return
    const m = String(viewMonth + 1).padStart(2, '0')
    const d = String(day).padStart(2, '0')
    const dateStr = `${viewYear}-${m}-${d}`
    const dateObj = new Date(dateStr + 'T12:00:00')
    if (dateObj > maxDate) return
    onChange(dateStr)
    setOpen(false)
  }

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
    else setViewMonth(m => m - 1)
  }

  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
    else setViewMonth(m => m + 1)
  }

  const canGoNext = new Date(viewYear, viewMonth + 1, 1) <= maxDate

  const displayDate = selected.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-left focus:outline-none focus:border-brand-purple focus:ring-1 focus:ring-brand-purple/30 flex items-center gap-2"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-gray-400 shrink-0">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
        </svg>
        <span className="text-brand-dark font-medium">{displayDate}</span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl border border-gray-200 shadow-lg z-50 p-3 min-w-[280px]">
            {/* Month nav */}
            <div className="flex items-center justify-between mb-2">
              <button onClick={prevMonth} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6" /></svg>
              </button>
              <span className="text-sm font-semibold text-brand-dark">
                {new Date(viewYear, viewMonth).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </span>
              <button onClick={nextMonth} disabled={!canGoNext} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500 disabled:opacity-30">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6" /></svg>
              </button>
            </div>

            {/* Weekday headers */}
            <div className="grid grid-cols-7 mb-1">
              {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
                <div key={d} className="text-center text-[10px] font-semibold text-gray-400 py-1">{d}</div>
              ))}
            </div>

            {/* Day grid */}
            {weeks.map((week, wi) => (
              <div key={wi} className="grid grid-cols-7">
                {week.map((day, di) => {
                  if (!day) return <div key={di} />
                  const m = String(viewMonth + 1).padStart(2, '0')
                  const d = String(day).padStart(2, '0')
                  const dateStr = `${viewYear}-${m}-${d}`
                  const dateObj = new Date(dateStr + 'T12:00:00')
                  const isFuture = dateObj > maxDate
                  const isSelected = dateStr === value
                  const isToday = dateStr === getTodayKey()

                  return (
                    <button
                      key={di}
                      onClick={() => handleDayClick(day)}
                      disabled={isFuture}
                      className={`w-full aspect-square flex items-center justify-center text-xs font-medium rounded-full transition-colors
                        ${isSelected ? 'bg-brand-purple text-white' : ''}
                        ${!isSelected && isToday ? 'bg-brand-purple/10 text-brand-purple font-bold' : ''}
                        ${!isSelected && !isToday && !isFuture ? 'text-brand-dark hover:bg-gray-100' : ''}
                        ${isFuture ? 'text-gray-300 cursor-not-allowed' : ''}
                      `}
                    >
                      {day}
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ---- Main Weight Component ----
export default function Weight() {
  const { weightLog, addWeightEntry, removeWeightEntry, updateWeightUnit } = useFirestore()
  const [weightInput, setWeightInput] = useState('')
  const [entryDate, setEntryDate] = useState(getTodayKey())
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [chartRange, setChartRange] = useState(30)

  const unit = weightLog?.preferredUnit || 'lbs'
  const entries = weightLog?.entries || []
  const todayKey = getTodayKey()

  const dateEntry = entries.find(e => e.date === entryDate)

  const chartData = useMemo(() => {
    let filtered = [...entries]
    if (chartRange !== 'all') {
      const cutoff = new Date()
      cutoff.setDate(cutoff.getDate() - chartRange)
      const cutoffStr = cutoff.toISOString().split('T')[0]
      filtered = filtered.filter(e => e.date >= cutoffStr)
    }
    return filtered.map(e => {
      const d = new Date(e.date + 'T12:00:00')
      return {
        date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        dateRaw: e.date,
        weight: unit === 'kg' ? lbsToKg(e.weightLbs) : e.weightLbs,
      }
    })
  }, [entries, chartRange, unit])

  // Table data: explicitly sorted descending by date
  const tableData = useMemo(() => {
    return [...entries]
      .sort((a, b) => b.date.localeCompare(a.date))
      .map(e => {
        const d = new Date(e.date + 'T12:00:00')
        return {
          date: d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
          dateRaw: e.date,
          weight: unit === 'kg' ? lbsToKg(e.weightLbs) : e.weightLbs,
        }
      })
  }, [entries, unit])

  const avgWeight = useMemo(() => {
    if (chartData.length === 0) return null
    return Math.round((chartData.reduce((acc, d) => acc + d.weight, 0) / chartData.length) * 10) / 10
  }, [chartData])

  const weightChange = useMemo(() => {
    if (chartData.length < 2) return null
    return Math.round((chartData[chartData.length - 1].weight - chartData[0].weight) * 10) / 10
  }, [chartData])

  async function handleLog() {
    const val = Number(weightInput)
    if (!val || val <= 0) {
      setMessage('Enter a valid weight')
      setTimeout(() => setMessage(''), 2000)
      return
    }
    setSaving(true)
    try {
      await addWeightEntry(val, unit, entryDate)
      setWeightInput('')
      setMessage(dateEntry ? 'Weight updated!' : 'Weight logged!')
      setTimeout(() => setMessage(''), 2000)
    } catch (err) {
      setMessage('Error: ' + err.message)
    }
    setSaving(false)
  }

  return (
    <div className="space-y-4 pb-2">
      <h2 className="font-display text-lg font-bold text-brand-dark">Weight</h2>

      {/* Weight Entry */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
        {/* Date picker */}
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs font-medium text-gray-500">Date:</span>
          <div className="flex-1">
            <SimpleDatePicker
              value={entryDate}
              max={todayKey}
              onChange={setEntryDate}
            />
          </div>
          {entryDate !== todayKey && (
            <button
              onClick={() => setEntryDate(todayKey)}
              className="text-[10px] text-brand-purple font-semibold hover:underline shrink-0"
            >
              Today
            </button>
          )}
        </div>

        <div className="flex items-center gap-3 mb-3">
          <div className="flex-1 relative">
            <input
              type="number"
              value={weightInput}
              onChange={(e) => setWeightInput(e.target.value)}
              placeholder={dateEntry ? `Update (${dateEntry.enteredValue} ${unit})` : `Weight`}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/20 tabular-nums"
              step="0.1"
              onKeyDown={(e) => e.key === 'Enter' && handleLog()}
            />
          </div>
          <div className="flex bg-gray-100 rounded-lg p-0.5 shrink-0">
            <button onClick={() => updateWeightUnit('lbs')}
              className={`px-3 py-2 text-xs font-bold rounded-md transition-all ${unit === 'lbs' ? 'bg-white text-brand-dark shadow-sm' : 'text-gray-500'}`}>lbs</button>
            <button onClick={() => updateWeightUnit('kg')}
              className={`px-3 py-2 text-xs font-bold rounded-md transition-all ${unit === 'kg' ? 'bg-white text-brand-dark shadow-sm' : 'text-gray-500'}`}>kg</button>
          </div>
        </div>

        <button onClick={handleLog} disabled={saving || !weightInput}
          className="w-full py-2.5 bg-brand-dark text-white font-semibold rounded-xl hover:bg-brand-dark/90 transition-colors disabled:opacity-40">
          {saving ? 'Saving...' : dateEntry ? 'Update Weight' : 'Log Weight'}
        </button>

        {message && (
          <p className={`text-center text-xs font-medium mt-2 ${message.startsWith('Error') ? 'text-red-500' : 'text-brand-green'}`}>{message}</p>
        )}
      </div>

      {/* Stats Row */}
      {chartData.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-white rounded-xl p-3 border border-gray-100 text-center">
            <p className="text-[10px] text-gray-400 font-medium uppercase">Current</p>
            <p className="font-display text-lg font-bold text-brand-dark">
              {chartData[chartData.length - 1]?.weight}<span className="text-xs font-medium text-gray-400"> {unit}</span>
            </p>
          </div>
          <div className="bg-white rounded-xl p-3 border border-gray-100 text-center">
            <p className="text-[10px] text-gray-400 font-medium uppercase">Average</p>
            <p className="font-display text-lg font-bold text-brand-dark">
              {avgWeight}<span className="text-xs font-medium text-gray-400"> {unit}</span>
            </p>
          </div>
          <div className="bg-white rounded-xl p-3 border border-gray-100 text-center">
            <p className="text-[10px] text-gray-400 font-medium uppercase">Change</p>
            <p className={`font-display text-lg font-bold ${weightChange === null ? 'text-gray-400' : weightChange < 0 ? 'text-brand-green' : weightChange > 0 ? 'text-red-400' : 'text-brand-dark'}`}>
              {weightChange === null ? '—' : (weightChange > 0 ? '+' : '') + weightChange}
              <span className="text-xs font-medium text-gray-400"> {unit}</span>
            </p>
          </div>
        </div>
      )}

      {/* Chart Range */}
      <div className="flex items-center justify-between">
        <h3 className="font-display text-sm font-bold text-brand-dark/70 uppercase tracking-wider">Trend</h3>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
          {[{ label: '7d', value: 7 }, { label: '14d', value: 14 }, { label: '30d', value: 30 }, { label: '6mo', value: 180 }, { label: 'All', value: 'all' }].map((opt) => (
            <button key={opt.label} onClick={() => setChartRange(opt.value)}
              className={`px-2.5 py-1.5 text-[10px] font-semibold rounded-md transition-all ${chartRange === opt.value ? 'bg-white text-brand-dark shadow-sm' : 'text-gray-500'}`}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="bg-white rounded-2xl p-3 border border-gray-100 shadow-sm">
        {chartData.length < 2 ? (
          <div className="h-48 flex items-center justify-center">
            <p className="text-sm text-gray-400">{chartData.length === 0 ? 'No weight data yet' : 'Need at least 2 entries for a chart'}</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData} margin={{ top: 5, right: 10, bottom: 5, left: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#999' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 9, fill: '#999' }} tickLine={false} axisLine={false} domain={['dataMin - 2', 'dataMax + 2']}>
                <Label value={unit} position="insideLeft" offset={0} style={{ fontSize: 10, fill: '#999' }} angle={-90} />
              </YAxis>
              <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #eee' }} formatter={(val) => [`${val} ${unit}`, 'Weight']} />
              {avgWeight && (
                <ReferenceLine y={avgWeight} stroke="#DBD3D8" strokeDasharray="3 3"
                  label={{ value: `avg: ${avgWeight}`, fill: '#999', fontSize: 9, position: 'right' }} />
              )}
              <Line type="monotone" dataKey="weight" stroke="#0A0B0A" strokeWidth={2}
                dot={{ r: 3, fill: '#0A0B0A', strokeWidth: 0 }} activeDot={{ r: 5, fill: '#0A0B0A' }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Data Table */}
      {tableData.length > 0 && (
        <div>
          <h3 className="font-display text-xs font-bold text-brand-dark/60 uppercase tracking-wider mb-2">Log</h3>
          <div className="space-y-1">
            {tableData.map((entry) => (
              <div key={entry.dateRaw} className="bg-white rounded-xl px-3 py-2 border border-gray-100 flex items-center justify-between">
                <span className="text-xs font-semibold text-brand-dark">{entry.date}</span>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-brand-dark tabular-nums">
                    {entry.weight} <span className="text-xs font-medium text-gray-400">{unit}</span>
                  </span>
                  <button onClick={() => removeWeightEntry(entry.dateRaw)}
                    className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors" title="Remove">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

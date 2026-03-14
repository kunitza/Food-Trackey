import React from 'react'

const COLORS = {
  protein: { bg: 'bg-brand-green/20', fill: 'bg-brand-green', text: 'text-brand-dark' },
  carbs: { bg: 'bg-brand-purple/15', fill: 'bg-brand-purple', text: 'text-brand-purple' },
  fat: { bg: 'bg-brand-tan/25', fill: 'bg-brand-tan', text: 'text-brand-tan' },
  fiber: { bg: 'bg-brand-mauve/40', fill: 'bg-brand-dark/40', text: 'text-brand-dark/60' },
}

export default function MacroBar({ label, current, target, unit = 'g' }) {
  const key = label.toLowerCase()
  const colors = COLORS[key] || COLORS.fiber
  const pct = target > 0 ? Math.min((current / target) * 100, 100) : 0
  const over = current > target && target > 0

  return (
    <div className="flex items-center gap-3">
      <div className="w-16 text-right">
        <span className={`text-xs font-semibold uppercase tracking-wider ${colors.text}`}>
          {label}
        </span>
      </div>
      <div className="flex-1">
        <div className={`h-3 rounded-full overflow-hidden ${colors.bg}`}>
          <div
            className={`macro-bar-fill h-full rounded-full ${colors.fill} ${over ? 'opacity-80' : ''}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
      <div className="w-24 text-right">
        <span className={`text-xs font-medium tabular-nums ${over ? 'text-red-500' : 'text-gray-500'}`}>
          {Math.round(current)}{unit} / {target}{unit}
        </span>
      </div>
    </div>
  )
}

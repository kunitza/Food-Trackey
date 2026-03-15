import React, { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useFirestore } from '../hooks/useFirestore'
import { PRESETS, calcMacroGrams } from '../utils/macros'
import { detectTimezone, getEffectiveTimezone, setTimezoneOverride, TIMEZONE_OPTIONS } from '../utils/timezone'

export default function SettingsModal({ onClose }) {
  const { user, logout, changePassword, removeAccount } = useAuth()
  const { targets, updateTargets, updateProfile } = useFirestore()

  const [name, setName] = useState(user?.displayName || '')
  const [calories, setCalories] = useState(targets?.dailyCalories || 2000)
  const [preset, setPreset] = useState(targets?.preset || 'balanced')
  const [customRatios, setCustomRatios] = useState(
    targets?.customMacroRatios || { protein: 20, carbs: 40, fat: 40 }
  )
  // Macro input mode: '%' or 'g'
  const [macroInputMode, setMacroInputMode] = useState(targets?.macroInputMode || '%')
  // Gram inputs (used when mode is 'g')
  const [proteinGrams, setProteinGrams] = useState('')

  const [newPassword, setNewPassword] = useState('')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showDeleteFinal, setShowDeleteFinal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const detectedTz = detectTimezone()
  const currentTz = getEffectiveTimezone()
  const [selectedTz, setSelectedTz] = useState(
    currentTz === detectedTz ? '' : currentTz
  )

  useEffect(() => {
    if (targets) {
      setCalories(targets.dailyCalories || 2000)
      setPreset(targets.preset || 'balanced')
      if (targets.customMacroRatios) setCustomRatios(targets.customMacroRatios)
      if (targets.macroInputMode) setMacroInputMode(targets.macroInputMode)
      if (targets.proteinGramsTarget) setProteinGrams(targets.proteinGramsTarget)
    }
  }, [targets])

  // Get the preset ratios (for distributing carbs/fat around protein)
  const presetRatios = PRESETS[preset] || PRESETS.balanced

  // Current effective ratios based on mode
  const currentRatios = useMemo(() => {
    if (macroInputMode === 'g' && proteinGrams && Number(calories) > 0) {
      const pGrams = Number(proteinGrams) || 0
      const pCal = pGrams * 4
      const totalCal = Number(calories)
      const pPct = Math.min(Math.round((pCal / totalCal) * 100), 100)
      const remaining = 100 - pPct

      // Distribute remaining between carbs and fat proportional to the preset's C:F ratio
      const presetCarbsFat = presetRatios.carbs + presetRatios.fat
      const carbsPct = presetCarbsFat > 0
        ? Math.round(remaining * (presetRatios.carbs / presetCarbsFat))
        : Math.round(remaining / 2)
      const fatPct = remaining - carbsPct

      return { protein: pPct, carbs: carbsPct, fat: fatPct }
    }
    if (preset === 'custom') return customRatios
    return presetRatios
  }, [macroInputMode, proteinGrams, calories, preset, customRatios, presetRatios])

  const macroGrams = calcMacroGrams(calories, currentRatios)

  // When switching to grams mode, initialize protein grams from current targets
  useEffect(() => {
    if (macroInputMode === 'g' && !proteinGrams && calories) {
      const currentPGrams = calcMacroGrams(calories, preset === 'custom' ? customRatios : presetRatios).protein
      setProteinGrams(currentPGrams)
    }
  }, [macroInputMode])

  async function handleSave() {
    setSaving(true)
    try {
      const targetData = {
        dailyCalories: Number(calories),
        preset: macroInputMode === 'g' ? 'custom' : preset,
        customMacroRatios: currentRatios,
        macroInputMode,
      }
      // Store protein grams target if in grams mode
      if (macroInputMode === 'g') {
        targetData.proteinGramsTarget = Number(proteinGrams) || 0
      }

      await updateTargets(targetData)
      await updateProfile(name)
      setTimezoneOverride(selectedTz || null)

      // Close settings after successful save
      onClose()
    } catch (err) {
      setMessage('Error saving: ' + err.message)
      setSaving(false)
    }
  }

  async function handleChangePassword() {
    if (!newPassword || newPassword.length < 6) {
      setMessage('Password must be at least 6 characters')
      return
    }
    try {
      await changePassword(newPassword)
      setNewPassword('')
      setMessage('Password changed!')
      setTimeout(() => setMessage(''), 2000)
    } catch (err) {
      setMessage('Error: ' + err.message)
    }
  }

  async function handleDeleteAccount() {
    try {
      await removeAccount()
    } catch (err) {
      setMessage('Error: ' + err.message + '. You may need to re-login first.')
    }
  }

  function handleCustomRatio(field, value) {
    const v = Math.max(0, Math.min(100, Number(value) || 0))
    setCustomRatios(prev => ({ ...prev, [field]: v }))
  }

  const customTotal = customRatios.protein + customRatios.carbs + customRatios.fat

  const canSave = macroInputMode === 'g'
    ? true
    : (preset !== 'custom' || customTotal === 100)

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center modal-backdrop bg-black/30" onClick={onClose}>
      <div
        className="bg-white w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white/90 backdrop-blur-sm border-b border-gray-100 px-5 py-4 flex items-center justify-between rounded-t-2xl">
          <h2 className="font-display text-lg font-bold text-brand-dark">Settings</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
        </div>

        <div className="px-5 py-4 space-y-6">
          {/* Profile */}
          <Section title="Profile">
            <label className="block text-xs font-medium text-gray-500 mb-1">Email</label>
            <p className="text-sm text-gray-700 mb-3">{user?.email}</p>
            <label className="block text-xs font-medium text-gray-500 mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-purple focus:ring-1 focus:ring-brand-purple/30"
            />
          </Section>

          {/* Timezone */}
          <Section title="Timezone">
            <p className="text-xs text-gray-400 mb-2">Detected: {detectedTz}</p>
            <select
              value={selectedTz}
              onChange={(e) => setSelectedTz(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-purple focus:ring-1 focus:ring-brand-purple/30 bg-white"
            >
              {TIMEZONE_OPTIONS.map(tz => (
                <option key={tz.value} value={tz.value}>
                  {tz.label}{tz.value === '' ? ` (${detectedTz})` : ''}
                </option>
              ))}
            </select>
          </Section>

          {/* Targets */}
          <Section title="Targets">
            <label className="block text-xs font-medium text-gray-500 mb-1">Daily Calories</label>
            <input
              type="number"
              value={calories}
              onChange={(e) => setCalories(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-purple focus:ring-1 focus:ring-brand-purple/30 mb-3"
            />

            {/* Macro Input Mode Toggle */}
            <label className="block text-xs font-medium text-gray-500 mb-2">Macro Input</label>
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5 mb-3">
              <button
                onClick={() => setMacroInputMode('%')}
                className={`flex-1 py-2 text-xs font-semibold rounded-md transition-all ${
                  macroInputMode === '%' ? 'bg-white text-brand-dark shadow-sm' : 'text-gray-500'
                }`}
              >
                Set by %
              </button>
              <button
                onClick={() => setMacroInputMode('g')}
                className={`flex-1 py-2 text-xs font-semibold rounded-md transition-all ${
                  macroInputMode === 'g' ? 'bg-white text-brand-dark shadow-sm' : 'text-gray-500'
                }`}
              >
                Set by Grams
              </button>
            </div>

            {macroInputMode === '%' && (
              <>
                <label className="block text-xs font-medium text-gray-500 mb-2">Macro Preset</label>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  {['high-protein', 'balanced', 'high-carb', 'high-fat', 'custom'].map((p) => (
                    <button
                      key={p}
                      onClick={() => setPreset(p)}
                      className={`px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                        preset === p
                          ? 'bg-brand-purple text-white shadow-sm'
                          : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      {p.replace('-', ' ').replace(/\b\w/g, c => c.toUpperCase())}
                    </button>
                  ))}
                </div>

                {preset === 'custom' && (
                  <div className="space-y-2 mb-3 p-3 bg-gray-50 rounded-lg">
                    {['protein', 'carbs', 'fat'].map((f) => (
                      <div key={f} className="flex items-center gap-2">
                        <span className="text-xs font-medium text-gray-600 w-16 capitalize">{f}</span>
                        <input
                          type="number"
                          value={customRatios[f]}
                          onChange={(e) => handleCustomRatio(f, e.target.value)}
                          className="flex-1 px-2 py-1.5 border border-gray-200 rounded text-sm text-center focus:outline-none focus:border-brand-purple"
                        />
                        <span className="text-xs text-gray-400">%</span>
                      </div>
                    ))}
                    <p className={`text-xs font-medium ${customTotal === 100 ? 'text-brand-green' : 'text-red-500'}`}>
                      Total: {customTotal}% {customTotal !== 100 && '(must equal 100%)'}
                    </p>
                  </div>
                )}
              </>
            )}

            {macroInputMode === 'g' && (
              <div className="space-y-3 mb-3">
                <label className="block text-xs font-medium text-gray-500 mb-2">Macro Preset (for carbs/fat distribution)</label>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  {['high-protein', 'balanced', 'high-carb', 'high-fat'].map((p) => (
                    <button
                      key={p}
                      onClick={() => setPreset(p)}
                      className={`px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                        preset === p
                          ? 'bg-brand-purple text-white shadow-sm'
                          : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      {p.replace('-', ' ').replace(/\b\w/g, c => c.toUpperCase())}
                    </button>
                  ))}
                </div>

                <div className="p-3 bg-gray-50 rounded-lg space-y-3">
                  {/* Protein grams input */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-gray-600 w-16">Protein</span>
                    <input
                      type="number"
                      value={proteinGrams}
                      onChange={(e) => setProteinGrams(e.target.value)}
                      className="flex-1 px-2 py-1.5 border border-gray-200 rounded text-sm text-center focus:outline-none focus:border-brand-purple"
                      placeholder="grams"
                    />
                    <span className="text-xs text-gray-400">g</span>
                    <span className="text-[10px] text-gray-400 w-10 text-right">{currentRatios.protein}%</span>
                  </div>

                  {/* Carbs (auto-calculated) */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-gray-600 w-16">Carbs</span>
                    <div className="flex-1 px-2 py-1.5 bg-gray-100 rounded text-sm text-center text-gray-500">
                      {macroGrams.carbs}
                    </div>
                    <span className="text-xs text-gray-400">g</span>
                    <span className="text-[10px] text-gray-400 w-10 text-right">{currentRatios.carbs}%</span>
                  </div>

                  {/* Fat (auto-calculated) */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-gray-600 w-16">Fat</span>
                    <div className="flex-1 px-2 py-1.5 bg-gray-100 rounded text-sm text-center text-gray-500">
                      {macroGrams.fat}
                    </div>
                    <span className="text-xs text-gray-400">g</span>
                    <span className="text-[10px] text-gray-400 w-10 text-right">{currentRatios.fat}%</span>
                  </div>

                  <p className="text-[10px] text-gray-400">
                    Carbs and fat are auto-distributed based on the {preset.replace('-', ' ')} preset ratio. Change the preset above to adjust the split.
                  </p>
                </div>
              </div>
            )}

            <div className="bg-brand-mauve/20 rounded-lg p-3">
              <p className="text-xs font-semibold text-brand-dark/60 mb-1">Macro Targets (calculated)</p>
              <div className="flex gap-4 text-sm">
                <span className="text-brand-dark font-medium">P: {macroGrams.protein}g</span>
                <span className="text-brand-purple font-medium">C: {macroGrams.carbs}g</span>
                <span className="text-brand-tan font-medium">F: {macroGrams.fat}g</span>
              </div>
            </div>
          </Section>

          {/* Account */}
          <Section title="Account">
            <label className="block text-xs font-medium text-gray-500 mb-1">Change Password</label>
            <div className="flex gap-2 mb-4">
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="New password"
                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-purple focus:ring-1 focus:ring-brand-purple/30"
              />
              <button
                onClick={handleChangePassword}
                className="px-4 py-2 bg-brand-purple text-white text-xs font-semibold rounded-lg hover:bg-brand-purple/90 transition-colors"
              >
                Update
              </button>
            </div>

            <button
              onClick={() => { logout(); onClose(); }}
              className="w-full py-2.5 bg-gray-100 text-gray-700 text-sm font-semibold rounded-lg hover:bg-gray-200 transition-colors mb-3"
            >
              Log Out
            </button>

            {!showDeleteConfirm ? (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="w-full py-2.5 text-red-500 text-xs font-medium hover:bg-red-50 rounded-lg transition-colors"
              >
                Delete Account
              </button>
            ) : !showDeleteFinal ? (
              <div className="bg-red-50 p-3 rounded-lg">
                <p className="text-xs text-red-600 mb-2">This will permanently delete your account and all data. Are you sure?</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowDeleteFinal(true)}
                    className="flex-1 py-2 bg-red-500 text-white text-xs font-semibold rounded-lg"
                  >
                    Yes, Delete
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="flex-1 py-2 bg-gray-200 text-gray-700 text-xs font-semibold rounded-lg"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-red-100 p-3 rounded-lg">
                <p className="text-xs text-red-700 font-bold mb-2">FINAL CONFIRMATION: This cannot be undone.</p>
                <div className="flex gap-2">
                  <button
                    onClick={handleDeleteAccount}
                    className="flex-1 py-2 bg-red-600 text-white text-xs font-bold rounded-lg"
                  >
                    Permanently Delete
                  </button>
                  <button
                    onClick={() => { setShowDeleteConfirm(false); setShowDeleteFinal(false); }}
                    className="flex-1 py-2 bg-gray-200 text-gray-700 text-xs font-semibold rounded-lg"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </Section>

          {/* Save */}
          <button
            onClick={handleSave}
            disabled={saving || !canSave}
            className="w-full py-3 bg-brand-dark text-white font-semibold rounded-xl hover:bg-brand-dark/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>

          {message && (
            <p className={`text-center text-xs font-medium ${message.startsWith('Error') ? 'text-red-500' : 'text-brand-green'}`}>
              {message}
            </p>
          )}

          <p className="text-center text-[10px] text-gray-300 pb-2">Food Trackey v1.2.0</p>
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div>
      <h3 className="font-display text-sm font-bold text-brand-dark/80 mb-3 uppercase tracking-wider">{title}</h3>
      {children}
    </div>
  )
}

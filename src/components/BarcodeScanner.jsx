import React, { useRef, useEffect, useState, useCallback } from 'react'
import { BrowserMultiFormatReader } from '@zxing/browser'

// Cross-browser barcode scanner. Uses @zxing/browser so it works on iOS Safari,
// Firefox, and any browser that gives us getUserMedia — not just the Chromium
// ones with native BarcodeDetector.

export default function BarcodeScanner({ onScan, onClose }) {
  const videoRef = useRef(null)
  const controlsRef = useRef(null)
  const lastScanRef = useRef('')
  const handledRef = useRef(false)
  const [error, setError] = useState('')
  const [ready, setReady] = useState(false)

  const stopCamera = useCallback(() => {
    try {
      controlsRef.current?.stop()
    } catch {
      // controls already stopped
    }
    controlsRef.current = null
  }, [])

  useEffect(() => {
    let cancelled = false
    const reader = new BrowserMultiFormatReader()

    async function init() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('Your browser does not support camera access. Try searching for foods by name instead.')
        return
      }

      try {
        const controls = await reader.decodeFromConstraints(
          { video: { facingMode: { ideal: 'environment' } } },
          videoRef.current,
          (result) => {
            if (!result || handledRef.current) return
            const value = result.getText()
            // Standard product barcodes are 8–14 digits (EAN-8, UPC-A, EAN-13, ITF-14).
            if (!/^\d{8,14}$/.test(value)) return
            if (value === lastScanRef.current) return
            lastScanRef.current = value
            handledRef.current = true
            stopCamera()
            onScan(value)
          }
        )

        if (cancelled) {
          try { controls.stop() } catch { /* nothing to stop */ }
          return
        }

        controlsRef.current = controls
        setReady(true)
      } catch (err) {
        if (cancelled) return
        if (err?.name === 'NotAllowedError') {
          setError('Camera access denied. Allow camera access in your browser settings and try again.')
        } else if (err?.name === 'NotFoundError') {
          setError('No camera found on this device.')
        } else {
          setError('Could not access camera: ' + (err?.message || 'unknown error'))
        }
      }
    }

    init()

    return () => {
      cancelled = true
      stopCamera()
    }
  }, [onScan, stopCamera])

  function handleClose() {
    stopCamera()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Header with large close button */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/80">
        <p className="text-white text-sm font-medium">Scan a barcode</p>
        <button
          onClick={handleClose}
          className="w-12 h-12 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 active:bg-white/40 transition-colors"
          aria-label="Close scanner"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {error ? (
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center max-w-sm">
            <p className="text-white/80 text-sm mb-4">{error}</p>
            <button
              onClick={handleClose}
              className="px-6 py-3 bg-white/20 text-white rounded-lg text-sm font-medium"
            >
              Close
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-1 relative">
          <video
            ref={videoRef}
            className="absolute inset-0 w-full h-full object-cover"
            playsInline
            muted
          />
          {/* Scan overlay */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-64 h-40 border-2 border-white/50 rounded-2xl relative">
              <div className="absolute top-0 left-0 w-8 h-8 border-t-3 border-l-3 border-brand-green rounded-tl-xl" />
              <div className="absolute top-0 right-0 w-8 h-8 border-t-3 border-r-3 border-brand-green rounded-tr-xl" />
              <div className="absolute bottom-0 left-0 w-8 h-8 border-b-3 border-l-3 border-brand-green rounded-bl-xl" />
              <div className="absolute bottom-0 right-0 w-8 h-8 border-b-3 border-r-3 border-brand-green rounded-br-xl" />
              <div className="absolute left-2 right-2 h-0.5 bg-brand-green/60 top-1/2 animate-pulse" />
            </div>
          </div>
          <p className="absolute bottom-8 left-0 right-0 text-center text-white/60 text-xs">
            {ready ? 'Point your camera at a product barcode' : 'Starting camera...'}
          </p>
        </div>
      )}
    </div>
  )
}

import React, { useRef, useEffect, useState, useCallback } from 'react'

export default function BarcodeScanner({ onScan, onClose }) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const animRef = useRef(null)
  const [error, setError] = useState('')
  const [ready, setReady] = useState(false)
  const scanningRef = useRef(true)
  const lastScanRef = useRef('')

  const stopCamera = useCallback(() => {
    scanningRef.current = false
    if (animRef.current) cancelAnimationFrame(animRef.current)
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
  }, [])

  useEffect(() => {
    let detector = null

    async function init() {
      // Check for BarcodeDetector support
      if (!('BarcodeDetector' in window)) {
        setError(
          'Your browser does not support barcode scanning. Please use Chrome (Android) or Safari 17.2+ (iOS) for barcode scanning, or search for foods by name.'
        )
        return
      }

      try {
        detector = new BarcodeDetector({
          formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'itf'],
        })
      } catch (err) {
        setError('Failed to initialize barcode scanner: ' + err.message)
        return
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'environment',
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        })
        streamRef.current = stream
        scanningRef.current = true

        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
          setReady(true)
          scanFrame()
        }
      } catch (err) {
        if (err.name === 'NotAllowedError') {
          setError('Camera access denied. Please allow camera access in your browser settings.')
        } else if (err.name === 'NotFoundError') {
          setError('No camera found on this device.')
        } else {
          setError('Could not access camera: ' + err.message)
        }
      }
    }

    async function scanFrame() {
      if (!scanningRef.current || !videoRef.current || !streamRef.current || !detector) return

      try {
        if (videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
          const barcodes = await detector.detect(videoRef.current)

          if (barcodes.length > 0) {
            const barcode = barcodes[0]
            const value = barcode.rawValue

            // Validate: numeric, 8-14 digits (standard product barcodes)
            if (/^\d{8,14}$/.test(value) && value !== lastScanRef.current) {
              lastScanRef.current = value
              stopCamera()
              onScan(value)
              return
            }
          }
        }
      } catch (err) {
        // BarcodeDetector.detect can throw on some frames, just skip
      }

      animRef.current = requestAnimationFrame(scanFrame)
    }

    init()
    return stopCamera
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
              {/* Scan line animation */}
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

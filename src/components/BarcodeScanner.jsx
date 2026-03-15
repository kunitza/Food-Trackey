import React, { useRef, useEffect, useState, useCallback } from 'react'

export default function BarcodeScanner({ onScan, onClose }) {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const animRef = useRef(null)
  const [error, setError] = useState('')
  const [jsQR, setJsQR] = useState(null)
  const scanningRef = useRef(true)

  // Dynamic import jsQR
  useEffect(() => {
    import('jsqr').then(mod => {
      setJsQR(() => mod.default || mod)
    }).catch(() => {
      setError('Failed to load barcode scanner library')
    })
  }, [])

  const stopCamera = useCallback(() => {
    scanningRef.current = false
    if (animRef.current) cancelAnimationFrame(animRef.current)
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!jsQR) return

    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        })
        streamRef.current = stream
        scanningRef.current = true
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.play()
          requestAnimationFrame(scanFrame)
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

    function isValidBarcode(data) {
      // Must be numeric and between 8-14 digits (EAN-8, UPC-A, EAN-13, ITF-14)
      if (!/^\d{8,14}$/.test(data)) return false
      return true
    }

    function scanFrame() {
      if (!scanningRef.current) return
      if (!videoRef.current || !canvasRef.current || !streamRef.current) return
      const video = videoRef.current
      const canvas = canvasRef.current
      const ctx = canvas.getContext('2d', { willReadFrequently: true })

      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'dontInvert',
        })
        if (code && code.data && isValidBarcode(code.data)) {
          // Successful scan - close and return result
          stopCamera()
          onScan(code.data)
          return
        }
      }
      animRef.current = requestAnimationFrame(scanFrame)
    }

    startCamera()
    return stopCamera
  }, [jsQR, onScan, stopCamera])

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
          className="w-11 h-11 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 active:bg-white/40 transition-colors"
          aria-label="Close scanner"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {error ? (
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center">
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
          <canvas ref={canvasRef} className="hidden" />
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
            Point your camera at a barcode
          </p>
        </div>
      )}
    </div>
  )
}

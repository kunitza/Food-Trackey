import React, { useState, useEffect, lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Today from './pages/Today'
import Lookup from './pages/Lookup'

// Lazy-load chart-heavy pages so recharts isn't in the initial bundle.
const History = lazy(() => import('./pages/History'))
const Weight = lazy(() => import('./pages/Weight'))

function PageLoader() {
  return (
    <div className="h-64 flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-brand-purple/30 border-t-brand-purple rounded-full animate-spin" />
    </div>
  )
}

// Splash screen shown on app load
function SplashScreen() {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden">
      {/* Animated gradient background using brand colors */}
      <div
        className="absolute inset-0"
        style={{
          background: `
            linear-gradient(135deg,
              #082900 0%,
              #2F222A 18%,
              #846075 33%,
              #87D68D 50%,
              #D4AA7D 67%,
              #727E6C 82%,
              #DBD3D8 100%
            )`,
          backgroundSize: '400% 400%',
          animation: 'splashGradient 3s ease infinite',
        }}
      />
      {/* Subtle overlay for readability */}
      <div className="absolute inset-0 bg-black/10" />

      {/* Logo and text */}
      <div className="relative z-10 flex flex-col items-center gap-4 animate-fade-in">
        <img
          src="/marktransparent512.png"
          alt=""
          className="w-40 h-40 drop-shadow-lg"
          style={{ animation: 'splashPulse 1.5s ease-in-out infinite' }}
        />
        <span className="font-logo text-3xl font-bold text-white drop-shadow-md tracking-tight">
          Food Trackey
        </span>
        <div className="mt-4 w-8 h-8 border-3 border-white/30 border-t-white rounded-full animate-spin" />
      </div>

      <style>{`
        @keyframes splashGradient {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes splashPulse {
          0%, 100% { transform: scale(1); opacity: 0.95; }
          50% { transform: scale(1.05); opacity: 1; }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fadeIn 0.5s ease-out forwards;
        }
      `}</style>
    </div>
  )
}

// Wrapper that forces navigation to "/" on initial auth load
function ForceHomeOnLoad({ children }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, loading } = useAuth()
  const [hasRedirected, setHasRedirected] = useState(false)

  useEffect(() => {
    if (!loading && user && !hasRedirected) {
      // On initial load, always go to Today tab
      if (location.pathname !== '/login' && location.pathname !== '/signup') {
        navigate('/', { replace: true })
      }
      setHasRedirected(true)
    }
  }, [loading, user, hasRedirected, navigate, location.pathname])

  return children
}

export default function App() {
  const [showSplash, setShowSplash] = useState(true)

  useEffect(() => {
    // Show splash for minimum 1.2 seconds
    const timer = setTimeout(() => {
      setShowSplash(false)
    }, 1200)
    return () => clearTimeout(timer)
  }, [])

  return (
    <BrowserRouter>
      <AuthProvider>
        {showSplash && <SplashScreen />}
        <ForceHomeOnLoad>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route element={<ProtectedRoute />}>
              <Route element={<Layout />}>
                <Route path="/" element={<Today />} />
                <Route path="/lookup" element={<Lookup />} />
                <Route path="/history" element={<Suspense fallback={<PageLoader />}><History /></Suspense>} />
                <Route path="/weight" element={<Suspense fallback={<PageLoader />}><Weight /></Suspense>} />
              </Route>
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ForceHomeOnLoad>
      </AuthProvider>
    </BrowserRouter>
  )
}

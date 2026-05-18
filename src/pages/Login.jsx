import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const { login, loginWithGoogle, resetPassword } = useAuth()
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
      navigate('/')
    } catch (err) {
      setError(friendlyError(err.code))
    }
    setLoading(false)
  }

  async function handleGoogle() {
    setError('')
    try {
      await loginWithGoogle()
      navigate('/')
    } catch (err) {
      setError(friendlyError(err.code))
    }
  }

  async function handleReset() {
    if (!email) {
      setError('Enter your email first')
      return
    }
    try {
      await resetPassword(email)
      setResetSent(true)
    } catch (err) {
      setError(friendlyError(err.code))
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-[#faf9f8]">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <img
            src="/marktransparent512.png"
            alt=""
            className="h-28 w-28 mb-3"
          />
          <h1 className="font-logo text-3xl font-bold text-brand-dark tracking-tight">
            Food Trackey
          </h1>
          <p className="text-sm text-gray-400 mt-1">Track your nutrition, hit your targets.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="email"
            placeholder="Email"
            aria-label="Email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/20"
          />
          <input
            type="password"
            placeholder="Password"
            aria-label="Password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/20"
          />

          {error && <p className="text-xs text-red-500 text-center">{error}</p>}
          {resetSent && <p className="text-xs text-brand-green text-center">Password reset email sent!</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-brand-dark text-white font-semibold rounded-xl hover:bg-brand-dark/90 transition-colors disabled:opacity-50"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <button
          onClick={handleGoogle}
          className="w-full mt-3 py-3 bg-white border border-gray-200 text-gray-700 font-medium rounded-xl text-sm hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
        >
          <svg width="18" height="18" viewBox="0 0 48 48">
            <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"/>
            <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"/>
            <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"/>
            <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"/>
          </svg>
          Continue with Google
        </button>

        <div className="mt-4 flex items-center justify-between text-xs">
          <button onClick={handleReset} className="text-brand-purple hover:underline">
            Forgot password?
          </button>
          <Link to="/signup" className="text-brand-purple font-semibold hover:underline">
            Create account
          </Link>
        </div>
      </div>
    </div>
  )
}

function friendlyError(code) {
  switch (code) {
    case 'auth/user-not-found': return 'No account with that email'
    case 'auth/wrong-password': return 'Incorrect password'
    case 'auth/invalid-email': return 'Invalid email address'
    case 'auth/too-many-requests': return 'Too many attempts. Try again later.'
    case 'auth/invalid-credential': return 'Invalid email or password'
    default: return 'Something went wrong. Try again.'
  }
}

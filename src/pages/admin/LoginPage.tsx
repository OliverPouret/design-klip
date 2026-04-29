import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../../lib/auth'

export function LoginPage() {
  const { signIn, user } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  if (user) {
    return <Navigate to="/admin/i-dag" replace />
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const result = await signIn(email, password)
    setLoading(false)
    if (result.error) {
      setError('Forkert e-mail eller adgangskode')
    } else {
      navigate('/admin/i-dag')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-white shadow-xl border border-border/50 p-8">
        <div className="text-center mb-8">
          <img src="/logo.png" alt="Design Klip" className="h-12 w-auto mx-auto mb-3" />
          <h1 className="font-serif text-xl text-ink">Personale login</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs tracking-[0.08em] uppercase text-ink-subtle mb-1.5">
              E-mail
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full border border-border rounded-sm px-4 py-3 text-sm text-ink outline-none focus:border-accent transition-colors"
              autoComplete="email"
            />
          </div>

          <div>
            <label className="block text-xs tracking-[0.08em] uppercase text-ink-subtle mb-1.5">
              Adgangskode
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full border border-border rounded-sm px-4 py-3 text-sm text-ink outline-none focus:border-accent transition-colors"
              autoComplete="current-password"
            />
          </div>

          {error && (
            <p className="text-xs text-red-500">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-accent text-white text-sm font-medium tracking-[0.08em] uppercase hover:bg-accent-deep transition-colors disabled:opacity-60"
          >
            {loading ? 'Logger ind…' : 'Log ind'}
          </button>
        </form>
      </div>
    </div>
  )
}

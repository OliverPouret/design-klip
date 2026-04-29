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
    <div className="min-h-screen flex items-center justify-center px-4 bg-[#F6F6F3] relative">
      <div className="w-full max-w-md bg-white border border-[#E8E8E5] rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-10">
        <div className="text-center mb-8">
          <img src="/logo.png" alt="Design Klip" className="h-16 w-auto mx-auto mb-4" />
          <h1 className="font-serif text-[24px] text-ink">Personale login</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-[11px] tracking-[0.08em] uppercase text-[#8A8A8A] font-medium mb-2">
              E-mail
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full border border-[#E8E8E5] rounded-lg px-4 py-3.5 text-sm text-ink outline-none focus:border-[#B08A3E] focus:ring-2 focus:ring-[#B08A3E]/15 transition-all"
              autoComplete="email"
            />
          </div>

          <div>
            <label className="block text-[11px] tracking-[0.08em] uppercase text-[#8A8A8A] font-medium mb-2">
              Adgangskode
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full border border-[#E8E8E5] rounded-lg px-4 py-3.5 text-sm text-ink outline-none focus:border-[#B08A3E] focus:ring-2 focus:ring-[#B08A3E]/15 transition-all"
              autoComplete="current-password"
            />
          </div>

          {error && <p className="text-[12px] text-[#9B2C2C]">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-[#B08A3E] text-white text-sm font-medium tracking-[0.08em] uppercase rounded-lg hover:bg-[#8C6A28] transition-colors disabled:opacity-60"
          >
            {loading ? 'Logger ind…' : 'Log ind'}
          </button>
        </form>
      </div>
    </div>
  )
}

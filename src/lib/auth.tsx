import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from './supabase'
import type { User, Session } from '@supabase/supabase-js'

interface AuthState {
  user: User | null
  session: Session | null
  role: 'super_admin' | 'barber' | null
  barberName: string | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

function deriveRole(u: User | null): 'super_admin' | 'barber' | null {
  const r = (u?.app_metadata?.role as string | undefined) ?? null
  if (r === 'super_admin') return 'super_admin'
  if (r === 'barber') return 'barber'
  return null
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [role, setRole] = useState<'super_admin' | 'barber' | null>(null)
  const [barberName, setBarberName] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s)
      setUser(s?.user ?? null)
      setRole(deriveRole(s?.user ?? null))
      if (s?.user) {
        supabase
          .from('barbers')
          .select('display_name')
          .eq('user_id', s.user.id)
          .single()
          .then(({ data }) => {
            setBarberName((data as { display_name: string } | null)?.display_name ?? null)
          })
      }
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
      setUser(s?.user ?? null)
      setRole(deriveRole(s?.user ?? null))
      if (!s?.user) setBarberName(null)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error?.message ?? null }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setSession(null)
    setRole(null)
    setBarberName(null)
  }

  return (
    <AuthContext.Provider value={{ user, session, role, barberName, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}

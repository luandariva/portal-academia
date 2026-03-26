import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const Ctx = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null) // row from `personais`
  const [loading, setLoading] = useState(true)

  async function loadProfile(authUser) {
    if (!authUser) { setProfile(null); return }
    const { data } = await supabase
      .from('personais')
      .select('*')
      .eq('auth_user_id', authUser.id)
      .maybeSingle()
    setProfile(data || null)
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      loadProfile(session?.user ?? null).finally(() => setLoading(false))
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null)
      loadProfile(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  async function signIn(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return error
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  return (
    <Ctx.Provider value={{ user, profile, loading, signIn, signOut }}>
      {children}
    </Ctx.Provider>
  )
}

export const useAuth = () => useContext(Ctx)

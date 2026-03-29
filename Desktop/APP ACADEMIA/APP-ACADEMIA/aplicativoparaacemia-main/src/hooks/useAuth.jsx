import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { resolveUsuarioDb } from '../lib/usuarioDb'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [usuarioDb, setUsuarioDb] = useState(null)
  const [mustChangePassword, setMustChangePassword] = useState(false)
  const [loading, setLoading] = useState(true)

  async function hydrateUsuario(authUser) {
    if (!authUser) {
      setUsuarioDb(null)
      setMustChangePassword(false)
      return
    }
    const { row } = await resolveUsuarioDb(authUser)
    setUsuarioDb(row || null)
    setMustChangePassword(Boolean(row?.must_change_password))
  }

  useEffect(() => {
    let mounted = true

    async function bootstrapAuth() {
      try {
        const { data, error } = await supabase.auth.getSession()
        if (error) {
          await supabase.auth.signOut({ scope: 'local' })
          if (mounted) {
            setUser(null)
            setUsuarioDb(null)
            setMustChangePassword(false)
          }
          return
        }
        const currentUser = data?.session?.user ?? null
        if (mounted) setUser(currentUser)
        await hydrateUsuario(currentUser)
      } finally {
        if (mounted) setLoading(false)
      }
    }

    bootstrapAuth()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      hydrateUsuario(session?.user ?? null)
    })
    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  async function markPasswordUpdated(newPassword) {
    if (!user?.id) return { error: new Error('Usuario nao autenticado') }
    const { error: authErr } = await supabase.auth.updateUser({ password: newPassword })
    if (authErr) return { error: authErr }
    const { error } = await supabase
      .from('usuarios')
      .update({ must_change_password: false })
      .eq('auth_user_id', user.id)
    if (error) return { error }
    setMustChangePassword(false)
    setUsuarioDb((prev) => (prev ? { ...prev, must_change_password: false } : prev))
    return { error: null }
  }

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, usuarioDb, mustChangePassword, hydrateUsuario, markPasswordUpdated, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)

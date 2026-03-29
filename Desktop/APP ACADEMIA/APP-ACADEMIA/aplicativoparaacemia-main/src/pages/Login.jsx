import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
    setLoading(false)
  }

  return (
    <div style={{
      minHeight: '100dvh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '24px', background: 'var(--bg)',
    }}>
      <div className="anim" style={{ width: '100%', maxWidth: 360 }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{
            width: 56, height: 56, border: '1px solid var(--lime-border)',
            borderRadius: 'var(--radius)', background: 'var(--lime-dim)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px', fontSize: 28
          }}>🥗</div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 800, letterSpacing: '-0.5px' }}>
            Alimenta Aí
          </h1>
          <p style={{ color: 'var(--text-2)', fontSize: 14, marginTop: 6 }}>
            Seu treino e nutrição em um lugar
          </p>
        </div>

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="field">
            <label>Email</label>
            <input
              type="email" className="input" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="seu@email.com" required
            />
          </div>

          <div className="field">
            <label>Senha</label>
            <input
              type="password" className="input" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="••••••••" required
            />
          </div>

          {error && (
            <div style={{
              background: 'rgba(240,91,91,0.1)', border: '1px solid rgba(240,91,91,0.2)',
              borderRadius: 'var(--radius)', padding: '10px 14px', fontSize: 13, color: 'var(--red)'
            }}>{error}</div>
          )}

          <button type="submit" className="btn btn-primary" disabled={loading} style={{
            marginTop: 8, padding: '16px', fontSize: 15,
          }}>
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}

import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'

export default function Login() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handle(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const err = await signIn(email, password)
    if (err) setError(err.message)
    setLoading(false)
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex',
      background: 'var(--bg)',
    }}>
      {/* Left panel - brand */}
      <div style={{
        width: 480, flexShrink: 0,
        background: 'var(--bg-2)',
        borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column',
        padding: 48,
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Grid decoration */}
        <div style={{
          position: 'absolute', inset: 0, opacity: .04,
          backgroundImage: 'linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }} />

        <div style={{ position: 'relative' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12, marginBottom: 64,
          }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10,
              background: 'var(--lime)', color: '#111',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 18,
            }}>A</div>
            <div>
              <p style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 18, lineHeight: 1 }}>AlimentaAI</p>
              <p style={{ fontSize: 11, color: 'var(--text-3)', letterSpacing: '.06em', textTransform: 'uppercase' }}>Portal de Gestão</p>
            </div>
          </div>

          <h1 style={{
            fontFamily: 'var(--font-display)', fontSize: 42, fontWeight: 800,
            lineHeight: 1.05, marginBottom: 20,
          }}>
            Gerencie sua<br />
            <span style={{ color: 'var(--lime)' }}>academia</span><br />
            com inteligência.
          </h1>

          <p style={{ color: 'var(--text-2)', fontSize: 15, lineHeight: 1.6, maxWidth: 360 }}>
            Prescreva treinos, acompanhe o progresso dos alunos e veja o impacto da gamificação em tempo real.
          </p>
        </div>

        <div style={{ marginTop: 'auto', position: 'relative' }}>
          {[
            { num: '10x', label: 'mais engajamento com gamificação' },
            { num: '100%', label: 'integrado ao WhatsApp via n8n' },
          ].map(item => (
            <div key={item.num} style={{
              display: 'flex', alignItems: 'center', gap: 14,
              padding: '14px 0',
              borderTop: '1px solid var(--border)',
            }}>
              <span style={{
                fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 800,
                color: 'var(--lime)', minWidth: 60,
              }}>{item.num}</span>
              <span style={{ fontSize: 13, color: 'var(--text-2)' }}>{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel - form */}
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 48,
      }}>
        <div style={{ width: '100%', maxWidth: 380 }} className="anim">
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 800, marginBottom: 6 }}>
            Entrar no portal
          </h2>
          <p style={{ color: 'var(--text-2)', fontSize: 14, marginBottom: 32 }}>
            Acesso exclusivo para personais e gestores.
          </p>

          <form onSubmit={handle} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="field">
              <label>E-mail</label>
              <input
                className="input"
                type="email" value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="seu@email.com"
                required
              />
            </div>

            <div className="field">
              <label>Senha</label>
              <input
                className="input"
                type="password" value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>

            {error && (
              <div style={{
                padding: '10px 12px', borderRadius: 8,
                background: 'rgba(240,91,91,.1)', border: '1px solid rgba(240,91,91,.25)',
                fontSize: 13, color: 'var(--red)',
              }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
              style={{ height: 44, justifyContent: 'center', marginTop: 4, opacity: loading ? .7 : 1 }}
            >
              {loading ? <span className="spinner" style={{ width: 16, height: 16 }} /> : 'Entrar'}
            </button>
          </form>

          <p style={{ marginTop: 24, fontSize: 12, color: 'var(--text-3)', textAlign: 'center' }}>
            Acesso restrito a profissionais cadastrados.
          </p>
        </div>
      </div>
    </div>
  )
}

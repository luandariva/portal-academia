import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'

export default function TrocarSenhaInicial() {
  const { markPasswordUpdated } = useAuth()
  const [novaSenha, setNovaSenha] = useState('')
  const [confirmacao, setConfirmacao] = useState('')
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')
  const [ok, setOk] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setErro('')
    setOk('')

    if (novaSenha.length < 8) {
      setErro('A senha precisa ter pelo menos 8 caracteres.')
      return
    }
    if (novaSenha !== confirmacao) {
      setErro('As senhas não conferem.')
      return
    }

    setLoading(true)
    const { error } = await markPasswordUpdated(novaSenha)
    if (error) {
      setErro(error.message || 'Falha ao trocar senha.')
      setLoading(false)
      return
    }
    setOk('Senha atualizada com sucesso.')
    setLoading(false)
  }

  return (
    <div style={{
      minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20, background: 'var(--bg)',
    }}>
      <div className="anim" style={{ width: '100%', maxWidth: 380 }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 800, marginBottom: 8 }}>
          Trocar senha inicial
        </h1>
        <p style={{ color: 'var(--text-2)', fontSize: 14, marginBottom: 20 }}>
          Por segurança, altere sua senha temporária para continuar.
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="field">
            <label>Nova senha</label>
            <input
              type="password" className="input" value={novaSenha} onChange={(e) => setNovaSenha(e.target.value)}
              placeholder="Mínimo 8 caracteres" required
            />
          </div>

          <div className="field">
            <label>Confirmar senha</label>
            <input
              type="password" className="input" value={confirmacao} onChange={(e) => setConfirmacao(e.target.value)}
              placeholder="Repita a nova senha" required
            />
          </div>

          {erro && (
            <div style={{
              background: 'rgba(240,91,91,0.1)', border: '1px solid rgba(240,91,91,0.2)',
              borderRadius: 'var(--radius)', padding: '10px 14px', fontSize: 13, color: 'var(--red)',
            }}>
              {erro}
            </div>
          )}
          {ok && (
            <div style={{
              background: 'rgba(75,240,122,0.12)', border: '1px solid rgba(75,240,122,0.35)',
              borderRadius: 'var(--radius)', padding: '10px 14px', fontSize: 13, color: 'var(--lime)',
            }}>
              {ok}
            </div>
          )}

          <button type="submit" className="btn btn-primary" disabled={loading} style={{
            marginTop: 8, padding: '16px', fontSize: 15,
          }}>
            {loading ? 'Atualizando...' : 'Salvar nova senha'}
          </button>
        </form>
      </div>
    </div>
  )
}

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

function Modal({ title, onClose, children }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.65)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: 24,
    }} onClick={onClose}>
      <div style={{
        background: 'var(--bg-2)', border: '1px solid var(--border-2)',
        borderRadius: 14, width: '100%', maxWidth: 480,
        boxShadow: 'var(--shadow)',
        animation: 'fadeIn .2s ease both',
      }} onClick={e => e.stopPropagation()}>
        <div style={{
          padding: '18px 22px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <p style={{ fontWeight: 700, fontSize: 15 }}>{title}</p>
          <button onClick={onClose} style={{ color: 'var(--text-3)', fontSize: 18, background: 'none', lineHeight: 1 }}>✕</button>
        </div>
        <div style={{ padding: 22 }}>{children}</div>
      </div>
    </div>
  )
}

export default function Alunos() {
  const navigate = useNavigate()
  const [alunos, setAlunos] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [busca, setBusca] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ nome: '', email: '', telefone: '', objetivo: '' })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [tempPassword, setTempPassword] = useState('')

  async function load() {
    setLoading(true)
    setLoadError('')
    const { data, error } = await supabase
      .from('usuarios')
      .select('*')
    if (error) {
      setLoadError(error.message || 'Erro ao carregar alunos')
      setLoading(false)
      return
    }
    const sorted = [...(data || [])].sort((a, b) => {
      const aTs = a?.created_at ? new Date(a.created_at).getTime() : 0
      const bTs = b?.created_at ? new Date(b.created_at).getTime() : 0
      return bTs - aTs
    })
    setAlunos(sorted)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const filtered = alunos.filter(a => {
    const q = busca.toLowerCase()
    return !q || (a.nome || '').toLowerCase().includes(q) || (a.email || '').toLowerCase().includes(q)
  })

  async function salvar(e) {
    e.preventDefault()
    if (!form.nome.trim() || !form.email.trim()) return
    setSaving(true)
    setMsg('')
    setTempPassword('')
    const alunoPayload = {
      nome: form.nome.trim(),
      email: form.email.trim(),
      telefone: form.telefone.trim() || null,
      objetivo: form.objetivo.trim() || null,
    }
    const { data: inserted, error } = await supabase
      .from('usuarios')
      .insert(alunoPayload)
      .select('id, email, nome')
      .single()
    if (error || !inserted?.id) { setMsg(error?.message || 'Erro ao cadastrar aluno'); setSaving(false); return }

    const { data: provisionData, error: provisionError } = await supabase.functions.invoke('provision-student-access', {
      body: { usuario_id: inserted.id, email: inserted.email, nome: inserted.nome },
    })
    if (provisionError) {
      let detail = provisionError.message || 'Falha ao provisionar acesso'
      try {
        const body = await provisionError.context?.json?.()
        if (body?.error) detail = body.error
        if (body?.detail) detail = `${detail} (${body.detail})`
      } catch {
        // Ignore parse errors and keep the default message.
      }
      setMsg(`Aluno cadastrado, mas sem acesso no app: ${detail}`)
      setSaving(false)
      load()
      return
    }

    if (provisionData?.senha_temporaria) {
      setTempPassword(provisionData.senha_temporaria)
    }
    setMsg('Aluno cadastrado e acesso criado no app!')
    setForm({ nome: '', email: '', telefone: '', objetivo: '' })
    setSaving(false)
    load()
    setTimeout(() => {
      setShowModal(false)
      setMsg('')
      setTempPassword('')
    }, 7000)
  }

  const objetivoLabel = (o) => {
    const map = { emagrecimento: 'Emagrecimento', hipertrofia: 'Hipertrofia', condicionamento: 'Condicionamento', manutencao: 'Manutenção' }
    return map[o] || o || '—'
  }

  return (
    <div style={{ padding: '32px 36px', overflowY: 'auto', flex: 1 }}>
      <div className="anim" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 800 }}>Alunos</h1>
          <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 2 }}>
            {alunos.length} aluno{alunos.length !== 1 ? 's' : ''} cadastrado{alunos.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          + Novo aluno
        </button>
      </div>

      {/* Search */}
      <div className="anim-2" style={{ marginBottom: 20, position: 'relative', maxWidth: 340 }}>
        <input
          className="input"
          placeholder="Buscar por nome ou e-mail..."
          value={busca}
          onChange={e => setBusca(e.target.value)}
          style={{ paddingLeft: 36, width: '100%' }}
        />
        <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)' }}>⌕</span>
      </div>
      {loadError && (
        <div style={{
          marginBottom: 14,
          background: 'rgba(248,113,113,.08)',
          border: '1px solid rgba(248,113,113,.35)',
          borderRadius: 10,
          padding: '10px 12px',
          color: 'var(--red)',
          fontSize: 12.5,
          fontWeight: 600,
        }}>
          Erro ao carregar lista de alunos: {loadError}
        </div>
      )}

      {/* Table */}
      <div className="anim-3" style={{
        background: 'var(--bg-2)', border: '1px solid var(--border)',
        borderRadius: 12, overflow: 'hidden',
      }}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Aluno</th>
                <th>Telefone</th>
                <th>Objetivo</th>
                <th>Ranking</th>
                <th>Cadastro</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 32, color: 'var(--text-3)' }}>
                  Carregando...
                </td></tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 32, color: 'var(--text-3)' }}>
                  {busca ? 'Nenhum resultado para a busca.' : 'Nenhum aluno cadastrado.'}
                </td></tr>
              )}
              {filtered.map(a => {
                const label = a.nome || a.email?.split('@')[0] || 'Aluno'
                const ini = label[0].toUpperCase()
                const createdAt = a?.created_at ? new Date(a.created_at) : null
                const data = createdAt && !Number.isNaN(createdAt.getTime())
                  ? new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }).format(createdAt)
                  : '—'
                return (
                  <tr key={a.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/alunos/${a.id}`)}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 32, height: 32, borderRadius: '50%',
                          background: 'var(--bg-4)', border: '1px solid var(--border-2)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 12, fontWeight: 700, color: 'var(--lime)', flexShrink: 0,
                        }}>{ini}</div>
                        <div>
                          <p style={{ fontWeight: 500 }}>{label}</p>
                          <p style={{ fontSize: 11, color: 'var(--text-3)' }}>{a.email || '—'}</p>
                        </div>
                      </div>
                    </td>
                    <td style={{ color: 'var(--text-2)' }}>{a.telefone ? `+${a.telefone}` : '—'}</td>
                    <td>
                      {a.objetivo
                        ? <span className="tag tag-blue">{objetivoLabel(a.objetivo)}</span>
                        : <span style={{ color: 'var(--text-3)' }}>—</span>}
                    </td>
                    <td>
                      {a.ranking_opt_in
                        ? <span className="tag tag-lime">Público</span>
                        : <span className="tag" style={{ background: 'rgba(255,255,255,.04)', color: 'var(--text-3)' }}>Privado</span>}
                    </td>
                    <td style={{ color: 'var(--text-3)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>{data}</td>
                    <td>
                      <button
                        className="btn btn-ghost"
                        style={{ height: 30, fontSize: 12 }}
                        onClick={e => { e.stopPropagation(); navigate(`/alunos/${a.id}`) }}
                      >
                        Ver perfil
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal cadastro */}
      {showModal && (
        <Modal title="Cadastrar novo aluno" onClose={() => { setShowModal(false); setMsg(''); setTempPassword('') }}>
          <form onSubmit={salvar} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="field">
                <label>Nome *</label>
                <input className="input" placeholder="João Silva" value={form.nome}
                  onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} required />
              </div>
              <div className="field">
                <label>E-mail *</label>
                <input className="input" type="email" placeholder="joao@email.com" value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="field">
                <label>WhatsApp</label>
                <input className="input" placeholder="5511999999999" value={form.telefone}
                  onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))} />
              </div>
              <div className="field">
                <label>Objetivo</label>
                <select className="input" value={form.objetivo}
                  onChange={e => setForm(f => ({ ...f, objetivo: e.target.value }))}>
                  <option value="">Selecionar...</option>
                  <option value="emagrecimento">Emagrecimento</option>
                  <option value="hipertrofia">Hipertrofia</option>
                  <option value="condicionamento">Condicionamento</option>
                  <option value="manutencao">Manutenção</option>
                </select>
              </div>
            </div>

            {msg && (
              <p style={{ fontSize: 13, color: msg.includes('erro') || msg.includes('Erro') ? 'var(--red)' : 'var(--lime)', fontWeight: 600 }}>
                {msg}
              </p>
            )}
            {tempPassword && (
              <div style={{
                background: 'rgba(201,242,77,.08)',
                border: '1px solid rgba(201,242,77,.35)',
                borderRadius: 10,
                padding: 12,
              }}>
                <p style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 6 }}>
                  Senha temporaria (mostrada apenas agora):
                </p>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--lime)', marginBottom: 8 }}>
                  {tempPassword}
                </p>
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{ height: 30, fontSize: 12 }}
                  onClick={() => navigator.clipboard?.writeText(tempPassword)}
                >
                  Copiar senha
                </button>
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
              <button type="button" className="btn btn-ghost" onClick={() => { setShowModal(false); setMsg(''); setTempPassword('') }}>
                Cancelar
              </button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Salvando...' : 'Cadastrar aluno'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}

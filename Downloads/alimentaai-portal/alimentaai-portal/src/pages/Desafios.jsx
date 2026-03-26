import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

function weekRangeFromDate(value) {
  const base = value ? new Date(value) : new Date()
  const day = base.getDay()
  const mondayDiff = day === 0 ? -6 : 1 - day
  const monday = new Date(base)
  monday.setDate(base.getDate() + mondayDiff)
  monday.setHours(0, 0, 0, 0)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  return {
    data_inicio: monday.toISOString().slice(0, 10),
    data_fim: sunday.toISOString().slice(0, 10),
  }
}

export default function Desafios() {
  const { profile } = useAuth()
  const [desafios, setDesafios] = useState([])
  const [conclusoes, setConclusoes] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    titulo: '',
    descricao: '',
    pontos: '30',
    ...weekRangeFromDate(),
  })

  async function load() {
    setLoading(true)
    const [{ data: dRows }, { data: cRows }] = await Promise.all([
      supabase
        .from('desafios_semanais')
        .select('*')
        .order('data_inicio', { ascending: false }),
      supabase
        .from('desafios_semanais_conclusoes')
        .select('id, desafio_id, usuario_id, concluido_em')
        .order('concluido_em', { ascending: false })
        .limit(200),
    ])
    setDesafios(dRows || [])
    setConclusoes(cRows || [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const conclusoesPorDesafio = useMemo(() => {
    const map = {}
    conclusoes.forEach((c) => {
      map[c.desafio_id] = (map[c.desafio_id] || 0) + 1
    })
    return map
  }, [conclusoes])

  const totalAtivos = desafios.filter((d) => d.ativo).length
  const totalEncerrados = desafios.filter((d) => !d.ativo).length

  async function criarDesafio(e) {
    e.preventDefault()
    if (!form.titulo.trim()) {
      setMsg('Informe um titulo para o desafio.')
      return
    }
    if (!form.data_inicio || !form.data_fim) {
      setMsg('Defina o periodo de inicio e fim.')
      return
    }
    if (form.data_fim < form.data_inicio) {
      setMsg('A data final nao pode ser anterior a data inicial.')
      return
    }
    setSaving(true)
    setMsg('')
    const { error } = await supabase.from('desafios_semanais').insert({
      titulo: form.titulo.trim(),
      descricao: form.descricao.trim() || null,
      pontos: Number(form.pontos) || 10,
      data_inicio: form.data_inicio,
      data_fim: form.data_fim,
      ativo: true,
      criado_por: profile?.id || null,
    })
    if (error) {
      setMsg(error.message || 'Erro ao criar desafio.')
      setSaving(false)
      return
    }
    setSaving(false)
    setShowForm(false)
    setForm({ titulo: '', descricao: '', pontos: '30', ...weekRangeFromDate() })
    setMsg('Desafio criado com sucesso.')
    load()
  }

  async function alternarStatus(desafio) {
    const { error } = await supabase
      .from('desafios_semanais')
      .update({ ativo: !desafio.ativo })
      .eq('id', desafio.id)
    if (error) {
      setMsg(error.message || 'Nao foi possivel atualizar o desafio.')
      return
    }
    load()
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto' }}>
      <div style={{ padding: '32px 36px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 800 }}>Desafios semanais</h1>
            <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 2 }}>
              Publique desafios, pontue alunos e acompanhe conclusoes
            </p>
          </div>
          <button className="btn btn-primary" onClick={() => { setShowForm(true); setMsg('') }}>
            + Novo desafio
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 20 }}>
          <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 10, padding: 14 }}>
            <p style={{ fontSize: 11, color: 'var(--text-3)' }}>Desafios totais</p>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 800 }}>{desafios.length}</p>
          </div>
          <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 10, padding: 14 }}>
            <p style={{ fontSize: 11, color: 'var(--text-3)' }}>Ativos</p>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 800, color: 'var(--lime)' }}>{totalAtivos}</p>
          </div>
          <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 10, padding: 14 }}>
            <p style={{ fontSize: 11, color: 'var(--text-3)' }}>Encerrados</p>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 800 }}>{totalEncerrados}</p>
          </div>
        </div>

        {msg && (
          <div style={{
            marginBottom: 14,
            background: msg.toLowerCase().includes('erro') ? 'rgba(248,113,113,.08)' : 'rgba(75,240,122,.08)',
            border: msg.toLowerCase().includes('erro') ? '1px solid rgba(248,113,113,.35)' : '1px solid rgba(75,240,122,.35)',
            borderRadius: 10,
            padding: '10px 12px',
            color: msg.toLowerCase().includes('erro') ? 'var(--red)' : 'var(--lime)',
            fontSize: 12.5,
            fontWeight: 600,
          }}>
            {msg}
          </div>
        )}

        <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Desafio</th>
                  <th>Periodo</th>
                  <th>Pontos</th>
                  <th>Status</th>
                  <th>Conclusoes</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td colSpan={6} style={{ textAlign: 'center', padding: 28, color: 'var(--text-3)' }}>Carregando...</td></tr>
                )}
                {!loading && desafios.length === 0 && (
                  <tr><td colSpan={6} style={{ textAlign: 'center', padding: 28, color: 'var(--text-3)' }}>Nenhum desafio criado.</td></tr>
                )}
                {!loading && desafios.map((d) => (
                  <tr key={d.id}>
                    <td>
                      <p style={{ fontWeight: 600 }}>{d.titulo}</p>
                      {d.descricao && <p style={{ fontSize: 12, color: 'var(--text-3)' }}>{d.descricao}</p>}
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-2)' }}>
                      {new Intl.DateTimeFormat('pt-BR').format(new Date(`${d.data_inicio}T00:00:00`))}
                      {' - '}
                      {new Intl.DateTimeFormat('pt-BR').format(new Date(`${d.data_fim}T00:00:00`))}
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-2)' }}>
                      {d.pontos} pts
                    </td>
                    <td>
                      {d.ativo ? <span className="tag tag-green">Ativo</span> : <span className="tag">Encerrado</span>}
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-2)' }}>
                      {conclusoesPorDesafio[d.id] || 0}
                    </td>
                    <td>
                      <button className="btn btn-ghost" style={{ height: 30, fontSize: 12 }} onClick={() => alternarStatus(d)}>
                        {d.ativo ? 'Encerrar' : 'Reativar'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showForm && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,.65)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000, padding: 24,
          }}
          onClick={() => { setShowForm(false); setMsg('') }}
        >
          <div
            style={{
              background: 'var(--bg-2)', border: '1px solid var(--border-2)',
              borderRadius: 14, width: '100%', maxWidth: 620,
              boxShadow: 'var(--shadow)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <p style={{ fontWeight: 700, fontSize: 15 }}>Criar desafio semanal</p>
              <button onClick={() => { setShowForm(false); setMsg('') }} style={{ color: 'var(--text-3)', fontSize: 18, background: 'none' }}>✕</button>
            </div>
            <form onSubmit={criarDesafio} style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="field">
                <label>Titulo *</label>
                <input className="input" value={form.titulo} onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))} placeholder="Ex: Corrida de rua 5km" required />
              </div>
              <div className="field">
                <label>Descricao</label>
                <textarea className="input" value={form.descricao} onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))} placeholder="Regras e orientacoes" style={{ minHeight: 90, resize: 'vertical' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                <div className="field">
                  <label>Data inicio *</label>
                  <input className="input" type="date" value={form.data_inicio} onChange={(e) => setForm((f) => ({ ...f, data_inicio: e.target.value }))} required />
                </div>
                <div className="field">
                  <label>Data fim *</label>
                  <input className="input" type="date" value={form.data_fim} onChange={(e) => setForm((f) => ({ ...f, data_fim: e.target.value }))} required />
                </div>
                <div className="field">
                  <label>Pontos *</label>
                  <input className="input" type="number" min="1" step="1" value={form.pontos} onChange={(e) => setForm((f) => ({ ...f, pontos: e.target.value }))} required />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
                <button type="button" className="btn btn-ghost" onClick={() => { setShowForm(false); setMsg('') }}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Salvando...' : 'Criar desafio'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

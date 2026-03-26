import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const CAT_MAP = { chest: 'Peito', upper: 'Membros superiores', legs: 'Pernas' }
const CATS = [
  { id: 'all', label: 'Todos' },
  { id: 'chest', label: 'Peito' },
  { id: 'upper', label: 'Membros superiores' },
  { id: 'legs', label: 'Pernas' },
]
const TIPOS = [
  { id: 'all', label: 'Todos os tipos' },
  { id: 'general', label: 'Gerais' },
  { id: 'user', label: 'Específicos' },
]

export default function Treinos() {
  const navigate = useNavigate()
  const [treinos, setTreinos] = useState([])
  const [personais, setPersonais] = useState([])
  const [filtro, setFiltro] = useState('all')
  const [tipoFiltro, setTipoFiltro] = useState('all')
  const [busca, setBusca] = useState('')
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [showPrescricaoGeral, setShowPrescricaoGeral] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')
  const [pForm, setPForm] = useState({
    nome: '',
    categoria: 'chest',
    personal_id: '',
    duracao_prevista_min: '45',
    exercicios: [{ nome: '', series: '3', repeticoes: '12', carga: '', met: '4.5' }],
  })

  useEffect(() => {
    async function load() {
      const [{ data: t }, { data: p }] = await Promise.all([
        supabase
          .from('treinos_plano')
          .select('*, usuarios(nome, email), personais(nome)')
          .order('created_at', { ascending: false }),
        supabase.from('personais').select('id, nome').order('nome'),
      ])
      setTreinos(t || [])
      setPersonais(p || [])
      setLoading(false)
    }
    load()
  }, [])

  function resetForm() {
    setPForm({
      nome: '',
      categoria: 'chest',
      personal_id: '',
      duracao_prevista_min: '45',
      exercicios: [{ nome: '', series: '3', repeticoes: '12', carga: '', met: '4.5' }],
    })
    setSaveMsg('')
  }

  function addEx() {
    setPForm(f => ({ ...f, exercicios: [...f.exercicios, { nome: '', series: '3', repeticoes: '12', carga: '', met: '4.5' }] }))
  }

  function remEx(i) {
    setPForm(f => ({ ...f, exercicios: f.exercicios.filter((_, j) => j !== i) }))
  }

  function updEx(i, campo, val) {
    setPForm(f => ({ ...f, exercicios: f.exercicios.map((e, j) => (j === i ? { ...e, [campo]: val } : e)) }))
  }

  async function prescreverTreinoGeral(e) {
    e.preventDefault()
    if (!pForm.nome.trim() || pForm.exercicios.some(ex => !ex.nome.trim())) {
      setSaveMsg('Preencha nome do treino e todos os exercícios.')
      return
    }
    if (!pForm.personal_id) {
      setSaveMsg('Treino geral exige personal responsável.')
      return
    }
    setSaving(true)
    setSaveMsg('')

    const exJson = pForm.exercicios.map((ex, i) => ({
      id: i + 1,
      nome: ex.nome.trim(),
      series: Number(ex.series) || 3,
      repeticoes: Number(ex.repeticoes) || 0,
      carga: Number(ex.carga) || 0,
      met: Number(ex.met) || 4.5,
      video_url: null,
    }))

    const { error } = await supabase.from('treinos_plano').insert({
      tipo: 'general',
      usuario_id: null,
      nome: pForm.nome.trim(),
      categoria: pForm.categoria,
      personal_id: pForm.personal_id,
      duracao_prevista_min: pForm.duracao_prevista_min === '' ? null : Number(pForm.duracao_prevista_min),
      gasto_calorico_estimado_kcal: null,
      gasto_calorico_kcal: null,
      data_prevista: new Date().toISOString().slice(0, 10),
      exercicios: exJson,
      criado_pelo_aluno: false,
    })

    if (error) {
      setSaveMsg(error.message)
      setSaving(false)
      return
    }

    const { data: t } = await supabase
      .from('treinos_plano')
      .select('*, usuarios(nome, email), personais(nome)')
      .order('created_at', { ascending: false })

    setTreinos(t || [])
    setSaving(false)
    setSaveMsg('Treino geral prescrito com sucesso!')
    setTimeout(() => {
      setShowPrescricaoGeral(false)
      resetForm()
    }, 1200)
  }

  const filtered = treinos.filter(t => {
    const q = busca.toLowerCase()
    const tipo = t.tipo || 'user'
    const passaCat = filtro === 'all' || t.categoria === filtro
    const passaTipo = tipoFiltro === 'all' || tipo === tipoFiltro
    const passaBusca = !q || (t.nome || '').toLowerCase().includes(q) ||
      (t.usuarios?.nome || '').toLowerCase().includes(q) ||
      (t.usuarios?.email || '').toLowerCase().includes(q)
    return passaCat && passaTipo && passaBusca
  })

  const contPorCat = (cat) => treinos.filter(t => t.categoria === cat).length

  return (
    <div style={{ flex: 1, overflowY: 'auto' }}>
      <div style={{ padding: '32px 36px' }}>
        <div className="anim" style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 800 }}>Biblioteca de treinos</h1>
              <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 2 }}>
                {treinos.length} treino{treinos.length !== 1 ? 's' : ''} prescrito{treinos.length !== 1 ? 's' : ''} na base
              </p>
            </div>
            <button className="btn btn-primary" onClick={() => navigate('/alunos')}>
              + Prescrever treino por aluno
            </button>
            <button
              className="btn btn-ghost"
              onClick={() => {
                setShowPrescricaoGeral(true)
                setSaveMsg('')
              }}
            >
              + Prescrever treino geral
            </button>
          </div>
        </div>

        {/* Summary cards */}
        <div className="anim-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 24 }}>
          {CATS.filter(c => c.id !== 'all').map(c => (
            <button key={c.id} onClick={() => setFiltro(filtro === c.id ? 'all' : c.id)} style={{
              background: filtro === c.id ? 'var(--lime-dim)' : 'var(--bg-2)',
              border: `1px solid ${filtro === c.id ? 'var(--lime-border)' : 'var(--border)'}`,
              borderRadius: 10, padding: '14px 18px', textAlign: 'left', cursor: 'pointer',
              transition: 'all .15s',
            }}>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 800, color: filtro === c.id ? 'var(--lime)' : 'var(--text)' }}>
                {contPorCat(c.id)}
              </p>
              <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>{c.label}</p>
            </button>
          ))}
        </div>

        {/* Controls */}
        <div className="anim-3" style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
          <div style={{ position: 'relative', flex: '0 0 300px' }}>
            <input className="input" placeholder="Buscar por treino ou aluno..."
              value={busca} onChange={e => setBusca(e.target.value)} style={{ paddingLeft: 36, width: '100%' }} />
            <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)' }}>⌕</span>
          </div>
          {CATS.map(c => (
            <button key={c.id} onClick={() => setFiltro(c.id)}
              className={filtro === c.id ? 'btn btn-primary' : 'btn btn-ghost'}
              style={{ height: 40 }}>
              {c.label}
            </button>
          ))}
          {TIPOS.map(t => (
            <button key={t.id} onClick={() => setTipoFiltro(t.id)}
              className={tipoFiltro === t.id ? 'btn btn-primary' : 'btn btn-ghost'}
              style={{ height: 40 }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="anim-4" style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Treino</th>
                  <th>Tipo</th>
                  <th>Aluno</th>
                  <th>Categoria</th>
                  <th>Personal</th>
                  <th>Exercícios</th>
                  <th>Duração</th>
                  <th>Kcal</th>
                  <th>Data</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td colSpan={10} style={{ textAlign: 'center', padding: 32, color: 'var(--text-3)' }}>Carregando...</td></tr>
                )}
                {!loading && filtered.length === 0 && (
                  <tr><td colSpan={10} style={{ textAlign: 'center', padding: 32, color: 'var(--text-3)' }}>Nenhum treino encontrado.</td></tr>
                )}
                {filtered.map(t => {
                  const exs = Array.isArray(t.exercicios) ? t.exercicios : []
                  const tipo = t.tipo || 'user'
                  const alunoNome = tipo === 'general'
                    ? 'Todos os alunos'
                    : (t.usuarios?.nome || t.usuarios?.email?.split('@')[0] || '—')
                  const data = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }).format(new Date(t.created_at))
                  return (
                    <tr key={t.id} style={{ cursor: 'pointer' }} onClick={() => setSelected(selected?.id === t.id ? null : t)}>
                      <td>
                        <p style={{ fontWeight: 500 }}>{t.nome}</p>
                        {t.criado_pelo_aluno && <span className="tag" style={{ background: 'rgba(255,255,255,.04)', color: 'var(--text-3)', marginTop: 2 }}>Criado pelo aluno</span>}
                      </td>
                      <td>
                        {tipo === 'general'
                          ? <span className="tag">Geral</span>
                          : <span className="tag tag-blue">Específico</span>}
                      </td>
                      <td style={{ color: 'var(--text-2)' }}>{alunoNome}</td>
                      <td>
                        {t.categoria
                          ? <span className="tag tag-blue">{CAT_MAP[t.categoria] || t.categoria}</span>
                          : <span style={{ color: 'var(--text-3)' }}>—</span>}
                      </td>
                      <td style={{ color: 'var(--text-2)' }}>{t.personais?.nome || '—'}</td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-2)' }}>
                        {exs.length}
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-2)' }}>
                        {Number.isFinite(Number(t.duracao_prevista_min)) ? `${Math.round(Number(t.duracao_prevista_min))} min` : '—'}
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-2)' }}>
                        {tipo === 'general'
                          ? 'No app'
                          : (Number.isFinite(Number(t.gasto_calorico_estimado_kcal ?? t.gasto_calorico_kcal))
                            ? `~${Math.round(Number(t.gasto_calorico_estimado_kcal ?? t.gasto_calorico_kcal))}`
                            : 'No app')}
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-3)' }}>{data}</td>
                      <td>
                        <button className="btn btn-ghost" style={{ height: 28, fontSize: 11 }}>
                          {selected?.id === t.id ? 'Fechar' : 'Ver'}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Inline detail */}
          {selected && (
            <div style={{ borderTop: '1px solid var(--border)', padding: '18px 24px', background: 'var(--bg-3)', animation: 'fadeIn .2s ease both' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <p style={{ fontWeight: 700, fontSize: 15 }}>{selected.nome}</p>
                <button onClick={() => setSelected(null)} style={{ background: 'none', color: 'var(--text-3)', fontSize: 16 }}>✕</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {(Array.isArray(selected.exercicios) ? selected.exercicios : []).map((ex, i) => (
                  <div key={i} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '8px 12px', background: 'var(--bg-4)', borderRadius: 8,
                    fontSize: 13,
                  }}>
                    <span>{i + 1}. {ex.nome}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-3)' }}>
                      {ex.series}x{ex.repeticoes || 'falha'}{ex.carga ? ` · ${ex.carga}kg` : ''}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {showPrescricaoGeral && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,.65)',
            display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
            zIndex: 1000, padding: 32, overflowY: 'auto',
          }}
          onClick={() => { setShowPrescricaoGeral(false); resetForm() }}
        >
          <div
            style={{
              background: 'var(--bg-2)', border: '1px solid var(--border-2)',
              borderRadius: 14, width: '100%', maxWidth: 760,
              boxShadow: 'var(--shadow)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <p style={{ fontWeight: 700, fontSize: 15 }}>Prescrever treino geral</p>
              <button onClick={() => { setShowPrescricaoGeral(false); resetForm() }} style={{ color: 'var(--text-3)', fontSize: 18, background: 'none' }}>✕</button>
            </div>
            <form onSubmit={prescreverTreinoGeral} style={{ padding: 22 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12, marginBottom: 16 }}>
                <div className="field">
                  <label>Nome do treino *</label>
                  <input className="input" placeholder="Ex: Full Body Base" value={pForm.nome}
                    onChange={e => setPForm(f => ({ ...f, nome: e.target.value }))} required />
                </div>
                <div className="field">
                  <label>Categoria</label>
                  <select className="input" value={pForm.categoria}
                    onChange={e => setPForm(f => ({ ...f, categoria: e.target.value }))}>
                    {CATS.filter(c => c.id !== 'all').map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label>Personal responsável *</label>
                  <select className="input" value={pForm.personal_id}
                    onChange={e => setPForm(f => ({ ...f, personal_id: e.target.value }))}>
                    <option value="">Selecione...</option>
                    {personais.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label>Duração prevista (min)</label>
                  <input
                    className="input"
                    type="number"
                    min="1"
                    step="1"
                    placeholder="Ex: 45"
                    value={pForm.duracao_prevista_min}
                    onChange={e => setPForm(f => ({ ...f, duracao_prevista_min: e.target.value }))}
                  />
                </div>
              </div>

              <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 14 }}>
                Este treino será do tipo geral e ficará disponível para todos os alunos.
                {' '}As calorias serão calculadas no app do aluno com base no MET e nas métricas individuais.
              </p>

              <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--text-3)', marginBottom: 10 }}>
                Exercícios
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 }}>
                {pForm.exercicios.map((ex, i) => (
                  <div key={i} style={{ background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                      <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-3)' }}>Exercício {i + 1}</p>
                      {pForm.exercicios.length > 1 && (
                        <button type="button" onClick={() => remEx(i)} style={{ background: 'none', color: 'var(--text-3)', fontSize: 13, lineHeight: 1 }}>✕</button>
                      )}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) repeat(4, minmax(0, 1fr))', gap: 8 }}>
                      <input className="input" style={{ height: 36, minWidth: 0, width: '100%' }} placeholder="Nome do exercício *"
                        value={ex.nome} onChange={e => updEx(i, 'nome', e.target.value)} required />
                      <input className="input" style={{ height: 36, minWidth: 0, width: '100%' }} placeholder="Séries"
                        value={ex.series} onChange={e => updEx(i, 'series', e.target.value)} />
                      <input className="input" style={{ height: 36, minWidth: 0, width: '100%' }} placeholder="Reps"
                        value={ex.repeticoes} onChange={e => updEx(i, 'repeticoes', e.target.value)} />
                      <input className="input" style={{ height: 36, minWidth: 0, width: '100%' }} placeholder="Carga kg"
                        value={ex.carga} onChange={e => updEx(i, 'carga', e.target.value)} />
                      <div style={{ position: 'relative' }}>
                        <input
                          className="input"
                          style={{ height: 36, minWidth: 0, width: '100%', paddingRight: 30 }}
                          type="number"
                          min="1"
                          max="15"
                          step="0.1"
                          placeholder="MET"
                          title="MET de referência: leve 3-4 | moderado 4.5-6 | intenso 6.5-9+"
                          value={ex.met}
                          onChange={e => updEx(i, 'met', e.target.value)}
                        />
                        <span
                          title="MET de referência: leve 3-4 | moderado 4.5-6 | intenso 6.5-9+"
                          style={{
                            position: 'absolute',
                            right: 10,
                            top: '50%',
                            transform: 'translateY(-50%)',
                            fontSize: 12,
                            color: 'var(--text-3)',
                            cursor: 'help',
                            userSelect: 'none',
                          }}
                        >
                          ?
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <button type="button" className="btn btn-ghost" style={{ marginBottom: 16 }} onClick={addEx}>
                + Adicionar exercício
              </button>

              {saveMsg && (
                <p style={{ fontSize: 13, color: saveMsg.includes('sucesso') ? 'var(--lime)' : 'var(--red)', fontWeight: 600, marginBottom: 12 }}>
                  {saveMsg}
                </p>
              )}

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-ghost" onClick={() => { setShowPrescricaoGeral(false); resetForm() }}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Salvando...' : 'Prescrever treino geral'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

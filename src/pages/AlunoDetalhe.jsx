import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const CATEGORIAS = [
  { id: 'chest', label: 'Peito' },
  { id: 'upper', label: 'Membros superiores' },
  { id: 'legs', label: 'Pernas' },
]

const HIDDEN_KEYS = new Set(['id', 'usuario_id', 'user_id', 'auth_user_id'])
const DATE_KEY_CANDIDATES = ['data_hora', 'data_ref', 'data', 'created_at', 'updated_at']

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function getRiskLevel(score) {
  if (score >= 70) return { label: 'Alto', color: 'var(--red)', bg: 'rgba(248,113,113,.11)', border: 'rgba(248,113,113,.35)' }
  if (score >= 40) return { label: 'Médio', color: 'rgb(251,191,36)', bg: 'rgba(251,191,36,.1)', border: 'rgba(251,191,36,.3)' }
  return { label: 'Baixo', color: 'var(--lime)', bg: 'rgba(201,242,77,.11)', border: 'rgba(201,242,77,.3)' }
}

function calcRisk({ lastActivityAt, activities7d, refeicoes7d }) {
  if (!lastActivityAt) return 95
  const now = Date.now()
  const lastTs = new Date(lastActivityAt).getTime()
  const daysWithout = Math.floor((now - lastTs) / (1000 * 60 * 60 * 24))

  let score = 0
  if (daysWithout <= 3) score = 15
  else if (daysWithout <= 7) score = 35
  else if (daysWithout <= 14) score = 55
  else if (daysWithout <= 21) score = 75
  else score = 90

  if (activities7d >= 6) score -= 25
  else if (activities7d >= 3) score -= 10
  else if (activities7d <= 1) score += 10

  if (refeicoes7d >= 14) score -= 10
  else if (refeicoes7d >= 7) score -= 5
  else if (refeicoes7d === 0) score += 5

  return clamp(score, 0, 99)
}

function looksLikeDateKey(key) {
  const lower = String(key || '').toLowerCase()
  return lower.includes('data') || lower.includes('date') || lower.includes('hora') || lower.endsWith('_at')
}

function toDate(value) {
  if (!value || typeof value !== 'string') return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function findDateKeyFromRow(row) {
  if (!row || typeof row !== 'object') return null
  const keys = Object.keys(row)
  const byPriority = DATE_KEY_CANDIDATES.find(k => keys.includes(k))
  if (byPriority) return byPriority
  const dynamic = keys.find(k => looksLikeDateKey(k))
  return dynamic || null
}

function sortByMostRecent(rows) {
  const list = Array.isArray(rows) ? [...rows] : []
  if (!list.length) return list
  const dateKey = findDateKeyFromRow(list[0])
  if (!dateKey) return list
  return list.sort((a, b) => {
    const aTs = toDate(a?.[dateKey])?.getTime() || 0
    const bTs = toDate(b?.[dateKey])?.getTime() || 0
    return bTs - aTs
  })
}

function labelFromKey(key) {
  return String(key || '')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
}

function formatValue(key, value) {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não'
  if (typeof value === 'number') return Number.isFinite(value) ? value.toLocaleString('pt-BR') : '—'
  if (typeof value === 'object') return JSON.stringify(value)

  const parsedDate = looksLikeDateKey(key) ? toDate(value) : null
  if (parsedDate) {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit',
    }).format(parsedDate)
  }
  return String(value)
}

function getDisplayEntries(obj, extraHidden = []) {
  if (!obj || typeof obj !== 'object') return []
  const hidden = new Set([...HIDDEN_KEYS, ...extraHidden])
  return Object.entries(obj)
    .filter(([key, value]) => !hidden.has(key) && value !== null && value !== undefined && value !== '')
}

function findKeyByAliases(obj, aliases) {
  if (!obj || typeof obj !== 'object') return null
  const keys = Object.keys(obj)
  return keys.find(k => aliases.some(alias => k.toLowerCase().includes(alias)))
}

function toNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (typeof value === 'string') {
    const normalized = value.replace(',', '.').trim()
    const parsed = Number(normalized)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

function getMacroSeries(refeicoes, metaMacros) {
  if (!Array.isArray(refeicoes) || refeicoes.length === 0) return []
  const keyProtMeta = findKeyByAliases(metaMacros, ['proteina', 'protein', 'prot'])
  const keyCarbMeta = findKeyByAliases(metaMacros, ['carbo', 'carb'])
  const keyGordMeta = findKeyByAliases(metaMacros, ['gord', 'fat', 'lip'])
  const targetProt = toNumber(metaMacros?.[keyProtMeta])
  const targetCarb = toNumber(metaMacros?.[keyCarbMeta])
  const targetGord = toNumber(metaMacros?.[keyGordMeta])

  const byDay = new Map()
  refeicoes.forEach(ref => {
    const dateKey = findDateKeyFromRow(ref)
    const dateValue = ref?.[dateKey]
    const parsed = toDate(dateValue)
    if (!parsed) return
    const day = parsed.toISOString().slice(0, 10)
    const keyProt = findKeyByAliases(ref, ['proteina', 'protein', 'prot'])
    const keyCarb = findKeyByAliases(ref, ['carbo', 'carb'])
    const keyGord = findKeyByAliases(ref, ['gord', 'fat', 'lip'])
    const current = byDay.get(day) || { prot: 0, carb: 0, gord: 0 }
    current.prot += toNumber(ref?.[keyProt])
    current.carb += toNumber(ref?.[keyCarb])
    current.gord += toNumber(ref?.[keyGord])
    byDay.set(day, current)
  })

  return [...byDay.entries()]
    .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
    .slice(-10)
    .map(([day, totals]) => ({
      day,
      label: new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(new Date(day)),
      protPct: targetProt > 0 ? Math.min((totals.prot / targetProt) * 100, 200) : 0,
      carbPct: targetCarb > 0 ? Math.min((totals.carb / targetCarb) * 100, 200) : 0,
      gordPct: targetGord > 0 ? Math.min((totals.gord / targetGord) * 100, 200) : 0,
    }))
}

function Tab({ active, onClick, children }) {
  return (
    <button onClick={onClick} style={{
      padding: '8px 16px', border: 'none', background: 'none',
      color: active ? 'var(--lime)' : 'var(--text-3)',
      fontWeight: active ? 600 : 400, fontSize: 13.5,
      borderBottom: active ? '2px solid var(--lime)' : '2px solid transparent',
      transition: 'all .15s', cursor: 'pointer',
    }}>
      {children}
    </button>
  )
}

function Secao({ title, children, action }) {
  return (
    <div style={{
      background: 'var(--bg-2)', border: '1px solid var(--border)',
      borderRadius: 12, overflow: 'hidden', marginBottom: 16,
    }}>
      <div style={{
        padding: '14px 20px', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <p style={{ fontWeight: 600, fontSize: 14 }}>{title}</p>
        {action}
      </div>
      <div style={{ padding: 20 }}>{children}</div>
    </div>
  )
}

export default function AlunoDetalhe() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [aluno, setAluno] = useState(null)
  const [treinos, setTreinos] = useState([])
  const [realizados, setRealizados] = useState([])
  const [badges, setBadges] = useState([])
  const [rankingAluno, setRankingAluno] = useState({ posicao: null, pontos: 0, total: 0 })
  const [desafiosConcluidos, setDesafiosConcluidos] = useState([])
  const [gamif, setGamif] = useState(null)
  const [metaMacros, setMetaMacros] = useState(null)
  const [refeicoes, setRefeicoes] = useState([])
  const [nutriLoading, setNutriLoading] = useState(true)
  const [nutriError, setNutriError] = useState('')
  const [tab, setTab] = useState('treinos')
  const [loading, setLoading] = useState(true)
  const [showPrescricao, setShowPrescricao] = useState(false)
  const [personais, setPersonais] = useState([])
  const [pForm, setPForm] = useState({
    tipo: 'user',
    nome: '',
    categoria: 'chest',
    personal_id: '',
    duracao_prevista_min: '45',
    exercicios: [{ nome: '', series: '3', repeticoes: '12', carga: '', met: '4.5' }],
  })
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')
  const [riscoData, setRiscoData] = useState(null)

  useEffect(() => {
    async function load() {
      const [
        { data: alunoData },
        { data: treinosData },
        { data: realizadosData },
        { data: personaisData },
        { data: desafiosData },
      ] = await Promise.all([
        supabase.from('usuarios').select('*').eq('id', id).maybeSingle(),
        supabase
          .from('treinos_plano')
          .select('*, personais(nome)')
          .eq('usuario_id', id)
          .order('created_at', { ascending: false }),
        supabase.from('treinos_realizados').select('*').eq('usuario_id', id).order('data_hora', { ascending: false }).limit(20),
        supabase.from('personais').select('id, nome').order('nome'),
        supabase
          .from('desafios_semanais_conclusoes')
          .select('id, concluido_em, desafio_id, desafios_semanais(titulo, pontos)')
          .eq('usuario_id', id)
          .order('concluido_em', { ascending: false })
          .limit(20),
      ])
      setAluno(alunoData)
      setTreinos(treinosData || [])
      setRealizados(realizadosData || [])
      setPersonais(personaisData || [])
      setDesafiosConcluidos(desafiosData || [])

      // nutricao
      setNutriLoading(true)
      setNutriError('')
      const [metasRes, refeicoesRes] = await Promise.all([
        supabase.from('metas_macros').select('*').eq('usuario_id', id).limit(20),
        supabase.from('refeicoes').select('*').eq('usuario_id', id).limit(50),
      ])
      if (metasRes.error || refeicoesRes.error) {
        const msgMeta = metasRes.error?.message
        const msgRef = refeicoesRes.error?.message
        setNutriError(msgMeta || msgRef || 'Não foi possível carregar dados de nutrição.')
      }
      const metasSorted = sortByMostRecent(metasRes.data || [])
      const refeicoesSorted = sortByMostRecent(refeicoesRes.data || []).slice(0, 20)
      setMetaMacros(metasSorted[0] || null)
      setRefeicoes(refeicoesSorted)
      setNutriLoading(false)

      // badges
      const { data: ubRows } = await supabase
        .from('gamificacao_usuario_badges')
        .select('id, concedido_em, badge_id')
        .eq('usuario_id', id)
        .order('concedido_em', { ascending: false })
      if (ubRows?.length) {
        const ids = [...new Set(ubRows.map(r => r.badge_id))]
        const { data: bDefs } = await supabase.from('gamificacao_badges').select('*').in('id', ids)
        const byId = Object.fromEntries((bDefs || []).map(b => [b.id, b]))
        setBadges(ubRows.map(r => ({ ...r, badge: byId[r.badge_id] })))
      }

      // gamif semana
      const semanaInicio = new Date()
      semanaInicio.setDate(semanaInicio.getDate() - semanaInicio.getDay() + 1)
      semanaInicio.setHours(0, 0, 0, 0)
      const { data: gRow } = await supabase
        .from('gamificacao_pontos_semana')
        .select('pontos, detalhe')
        .eq('usuario_id', id)
        .gte('semana_inicio', semanaInicio.toISOString().slice(0, 10))
        .maybeSingle()
      setGamif(gRow)

      // ranking geral da gamificação
      const { data: rankingRows, error: rankingError } = await supabase
        .rpc('rpc_gamificacao_leaderboard', { p_limit: 1000 })
        .select()
      if (!rankingError && Array.isArray(rankingRows)) {
        const idx = rankingRows.findIndex(row => row?.usuario_id === id)
        if (idx >= 0) {
          setRankingAluno({
            posicao: idx + 1,
            pontos: Number(rankingRows[idx]?.pontos) || 0,
            total: rankingRows.length,
          })
        } else {
          setRankingAluno({ posicao: null, pontos: 0, total: rankingRows.length })
        }
      }

      // Risco de Cancelamento
      const [{ data: tRisk }, { data: dRisk }, { data: rRisk }] = await Promise.all([
        supabase.from('treinos_realizados').select('data_hora, created_at').eq('usuario_id', id),
        supabase.from('desafios_semanais_conclusoes').select('concluido_em, created_at').eq('usuario_id', id),
        supabase.from('refeicoes').select('data_hora, created_at, data_ref, data').eq('usuario_id', id)
      ])

      let riskActivities7d = 0
      let riskRefeicoes7d = 0
      let riskLastActivityAt = null
      const riskNowMs = Date.now()
      const riskSevenDaysAgo = riskNowMs - (7 * 24 * 60 * 60 * 1000)

      function absorbRisk(events, onCount) {
        ;(events || []).forEach(row => {
          const dateKey = findDateKeyFromRow(row) || Object.keys(row)[0]
          const when = toDate(row?.[dateKey])
          if (!when) return
          const ts = when.getTime()
          if (ts >= riskSevenDaysAgo) riskActivities7d += 1
          if (onCount) onCount(ts)
          if (!riskLastActivityAt || ts > new Date(riskLastActivityAt).getTime()) {
            riskLastActivityAt = when.toISOString()
          }
        })
      }

      absorbRisk(tRisk)
      absorbRisk(dRisk)
      absorbRisk(rRisk, ts => {
        if (ts >= riskSevenDaysAgo) riskRefeicoes7d += 1
      })

      const riskScore = calcRisk({ lastActivityAt: riskLastActivityAt, activities7d: riskActivities7d, refeicoes7d: riskRefeicoes7d })
      
      setRiscoData({
        score: riskScore,
        level: getRiskLevel(riskScore),
        activities7d: riskActivities7d,
        refeicoes7d: riskRefeicoes7d,
        lastActivityAt: riskLastActivityAt,
        daysWithout: riskLastActivityAt ? Math.floor((riskNowMs - new Date(riskLastActivityAt).getTime()) / (1000 * 60 * 60 * 24)) : null
      })

      setLoading(false)
    }
    load()
  }, [id])

  function addEx() {
    setPForm(f => ({ ...f, exercicios: [...f.exercicios, { nome: '', series: '3', repeticoes: '12', carga: '', met: '4.5' }] }))
  }
  function remEx(i) {
    setPForm(f => ({ ...f, exercicios: f.exercicios.filter((_, j) => j !== i) }))
  }
  function updEx(i, campo, val) {
    setPForm(f => ({ ...f, exercicios: f.exercicios.map((e, j) => j === i ? { ...e, [campo]: val } : e) }))
  }

  async function prescreverTreino(e) {
    e.preventDefault()
    if (!pForm.nome.trim() || pForm.exercicios.some(ex => !ex.nome.trim())) {
      setSaveMsg('Preencha nome do treino e todos os exercícios.')
      return
    }
    if (pForm.tipo === 'general' && !pForm.personal_id) {
      setSaveMsg('Treino geral exige personal responsável.')
      return
    }
    setSaving(true)
    setSaveMsg('')
    const exJson = pForm.exercicios.map((ex, i) => ({
      id: i + 1, nome: ex.nome.trim(),
      series: Number(ex.series) || 3,
      repeticoes: Number(ex.repeticoes) || 0,
      carga: Number(ex.carga) || 0,
      met: Number(ex.met) || 4.5,
      video_url: null,
    }))
    const tipo = pForm.tipo === 'general' ? 'general' : 'user'
    const { error } = await supabase.from('treinos_plano').insert({
      tipo,
      usuario_id: tipo === 'general' ? null : id,
      nome: pForm.nome.trim(),
      categoria: pForm.categoria,
      personal_id: pForm.personal_id || null,
      duracao_prevista_min: pForm.duracao_prevista_min === '' ? null : Number(pForm.duracao_prevista_min),
      gasto_calorico_estimado_kcal: null,
      gasto_calorico_kcal: null,
      data_prevista: new Date().toISOString().slice(0, 10),
      exercicios: exJson,
      criado_pelo_aluno: false,
    })
    if (error) { setSaveMsg(error.message); setSaving(false); return }
    setSaveMsg('Treino prescrito com sucesso!')
    const { data: fresh } = await supabase
      .from('treinos_plano')
      .select('*, personais(nome)')
      .eq('usuario_id', id)
      .order('created_at', { ascending: false })
    setTreinos(fresh || [])
    setSaving(false)
    setTimeout(() => { setShowPrescricao(false); setSaveMsg('') }, 1500)
  }

  if (loading) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="spinner" />
    </div>
  )
  if (!aluno) return (
    <div style={{ flex: 1, padding: 36 }}>
      <p style={{ color: 'var(--text-3)' }}>Aluno não encontrado.</p>
      <button className="btn btn-ghost" style={{ marginTop: 12 }} onClick={() => navigate('/alunos')}>← Voltar</button>
    </div>
  )

  const nome = aluno.nome || aluno.email?.split('@')[0] || 'Aluno'
  const ini = nome[0].toUpperCase()
  const objetivoMap = { emagrecimento: 'Emagrecimento', hipertrofia: 'Hipertrofia', condicionamento: 'Condicionamento', manutencao: 'Manutenção' }
  const catLabel = { chest: 'Peito', upper: 'Membros superiores', legs: 'Pernas' }
  const macroSeries = getMacroSeries(refeicoes, metaMacros)
  const chartW = 760
  const chartH = 220
  const padX = 32
  const padY = 18
  const innerW = chartW - (padX * 2)
  const innerH = chartH - (padY * 2)
  const getX = index => (
    macroSeries.length <= 1
      ? chartW / 2
      : padX + (index * innerW) / (macroSeries.length - 1)
  )
  const getY = valuePct => padY + innerH - (Math.max(0, Math.min(valuePct, 200)) / 200) * innerH
  const buildPath = key => macroSeries
    .map((point, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(point[key])}`)
    .join(' ')

  return (
    <div style={{ flex: 1, overflowY: 'auto' }}>
      {/* Header */}
      <div style={{
        padding: '24px 36px 0',
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg-2)',
      }}>
        <button className="btn btn-ghost" style={{ height: 28, fontSize: 12, marginBottom: 16 }} onClick={() => navigate('/alunos')}>
          ← Alunos
        </button>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, marginBottom: 20 }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%',
            background: 'var(--bg-4)', border: '1px solid var(--border-2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 20, fontWeight: 800, color: 'var(--lime)',
          }}>{ini}</div>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 800 }}>{nome}</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
              <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{aluno.email}</span>
              {aluno.telefone && <span style={{ fontSize: 12, color: 'var(--text-3)' }}>· +{aluno.telefone}</span>}
              {aluno.objetivo && <span className="tag tag-blue" style={{ marginLeft: 4 }}>{objetivoMap[aluno.objetivo] || aluno.objetivo}</span>}
            </div>
          </div>

          {/* Mini stats */}
          <div style={{ display: 'flex', gap: 20 }}>
            {[
              { label: 'Treinos prescritos', value: treinos.length },
              { label: 'Treinos realizados', value: realizados.length },
              { label: 'Pts esta semana', value: gamif?.pontos || 0, accent: 'var(--lime)' },
              { label: 'Badges', value: badges.length },
            ].map(s => (
              <div key={s.label} style={{ textAlign: 'center' }}>
                <p style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 800, color: s.accent || 'var(--text)', lineHeight: 1 }}>
                  {s.value}
                </p>
                <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 3 }}>{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 0, borderTop: '1px solid var(--border)', marginTop: 4 }}>
          {[
            { id: 'treinos', label: 'Treinos' },
            { id: 'historico', label: 'Histórico' },
            { id: 'nutricao', label: 'Nutrição' },
            { id: 'gamif', label: 'Gamificação' },
            { id: 'perfil', label: 'Dados pessoais' },
            { id: 'risco', label: 'Risco de Cancelamento' },
          ].map(t => (
            <Tab key={t.id} active={tab === t.id} onClick={() => setTab(t.id)}>{t.label}</Tab>
          ))}
        </div>
      </div>

      <div style={{ padding: '24px 36px' }}>

        {/* Tab: Treinos */}
        {tab === 'treinos' && (
          <div className="anim">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <p style={{ fontWeight: 600 }}>Treinos prescritos ({treinos.length})</p>
              <button className="btn btn-primary" onClick={() => setShowPrescricao(true)}>
                + Prescrever treino
              </button>
            </div>

            {treinos.length === 0 && (
              <div style={{
                background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 12,
                padding: '40px 24px', textAlign: 'center', color: 'var(--text-3)',
              }}>
                <p style={{ fontSize: 32, marginBottom: 8 }}>🏋️</p>
                <p>Nenhum treino prescrito ainda.</p>
                <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => setShowPrescricao(true)}>
                  Prescrever primeiro treino
                </button>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
              {treinos.map(t => {
                const exs = Array.isArray(t.exercicios) ? t.exercicios : []
                return (
                  <div key={t.id} style={{
                    background: 'var(--bg-2)', border: '1px solid var(--border)',
                    borderRadius: 12, padding: 16,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
                      <div>
                        <p style={{ fontWeight: 600, fontSize: 14 }}>{t.nome}</p>
                        <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>
                          {t.personais?.nome || (t.criado_pelo_aluno ? 'Criado pelo aluno' : 'Sem personal')}
                        </p>
                      </div>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        {(t.tipo || 'user') === 'general' && <span className="tag">Geral</span>}
                        {((t.tipo || 'user') === 'user') && <span className="tag tag-blue">Específico</span>}
                        {t.categoria && <span className="tag tag-blue">{catLabel[t.categoria] || t.categoria}</span>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {exs.slice(0, 4).map((ex, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-2)' }}>
                          <span>{ex.nome}</span>
                          <span style={{ color: 'var(--text-3)' }}>{ex.series}x{ex.repeticoes || 'falha'}{ex.carga ? ` · ${ex.carga}kg` : ''}</span>
                        </div>
                      ))}
                      {exs.length > 4 && <p style={{ fontSize: 11, color: 'var(--text-3)' }}>+{exs.length - 4} mais</p>}
                    </div>
                    <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)', fontSize: 11, color: 'var(--text-3)' }}>
                      {new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }).format(new Date(t.created_at))}
                      {' · '}{exs.length} exercício{exs.length !== 1 ? 's' : ''}
                      {Number.isFinite(Number(t.duracao_prevista_min)) ? ` · ${Math.round(Number(t.duracao_prevista_min))} min` : ''}
                      {' · kcal no app'}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Tab: Histórico */}
        {tab === 'historico' && (
          <div className="anim">
            <p style={{ fontWeight: 600, marginBottom: 16 }}>Treinos realizados ({realizados.length})</p>
            {realizados.length === 0 && (
              <p style={{ color: 'var(--text-3)', fontSize: 13 }}>Nenhum treino registrado ainda.</p>
            )}
            <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
              {realizados.map((r, i) => {
                const exs = Array.isArray(r.exercicios) ? r.exercicios : []
                const dur = r.duracao_min ? `${r.duracao_min} min` : '—'
                const kcal = r.kcal_gastas ? `${Math.round(r.kcal_gastas)} kcal` : '—'
                const when = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(r.data_hora))
                return (
                  <div key={r.id} style={{
                    padding: '12px 18px',
                    borderBottom: i < realizados.length - 1 ? '1px solid var(--border)' : 'none',
                    display: 'flex', alignItems: 'center', gap: 12,
                  }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: 8, flexShrink: 0,
                      background: r.concluido ? 'rgba(75,240,122,.1)' : 'var(--bg-4)',
                      border: `1px solid ${r.concluido ? 'rgba(75,240,122,.25)' : 'var(--border)'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 14,
                    }}>
                      {r.concluido ? '✓' : '○'}
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 13, fontWeight: 500 }}>{r.nome || 'Treino'}</p>
                      <p style={{ fontSize: 11, color: 'var(--text-3)' }}>
                        {exs.length} exercício{exs.length !== 1 ? 's' : ''} · {dur} · {kcal}
                      </p>
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>{when}</span>
                    {r.concluido && <span className="tag tag-green">Concluído</span>}
                  </div>
                )
              })}
            </div>

            <p style={{ fontWeight: 600, marginTop: 22, marginBottom: 12 }}>
              Desafios concluídos ({desafiosConcluidos.length})
            </p>
            {desafiosConcluidos.length === 0 && (
              <p style={{ color: 'var(--text-3)', fontSize: 13 }}>
                Nenhum desafio concluído ainda.
              </p>
            )}
            {desafiosConcluidos.length > 0 && (
              <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
                {desafiosConcluidos.map((d, i) => {
                  const when = new Intl.DateTimeFormat('pt-BR', {
                    day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit',
                  }).format(new Date(d.concluido_em))
                  const pontos = d.desafios_semanais?.pontos || 0
                  return (
                    <div key={d.id} style={{
                      padding: '12px 18px',
                      borderBottom: i < desafiosConcluidos.length - 1 ? '1px solid var(--border)' : 'none',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                    }}>
                      <div>
                        <p style={{ fontSize: 13, fontWeight: 600 }}>
                          {d.desafios_semanais?.titulo || 'Desafio semanal'}
                        </p>
                        <p style={{ fontSize: 11, color: 'var(--text-3)' }}>{when}</p>
                      </div>
                      <span className="tag tag-lime">+{pontos} pts</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Tab: Nutrição */}
        {tab === 'nutricao' && (
          <div className="anim">
            {nutriLoading && (
              <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 16 }}>
                Carregando dados de nutrição...
              </p>
            )}
            {nutriError && (
              <div style={{
                marginBottom: 16,
                background: 'rgba(248,113,113,.08)',
                border: '1px solid rgba(248,113,113,.35)',
                borderRadius: 10,
                padding: '10px 12px',
                color: 'var(--red)',
                fontSize: 12.5,
                fontWeight: 600,
              }}>
                {nutriError}
              </div>
            )}

            {!nutriLoading && (
              <>
                <Secao title="Meta de macros">
                  {!metaMacros && (
                    <p style={{ fontSize: 13, color: 'var(--text-3)' }}>
                      Nenhuma meta de macros cadastrada.
                    </p>
                  )}
                  {metaMacros && (() => {
                    const keyCal = findKeyByAliases(metaMacros, ['kcal', 'caloria', 'calorias'])
                    const keyProt = findKeyByAliases(metaMacros, ['proteina', 'protein', 'prot'])
                    const keyCarb = findKeyByAliases(metaMacros, ['carbo', 'carb'])
                    const keyGord = findKeyByAliases(metaMacros, ['gord', 'fat', 'lip'])
                    const macroKeys = [keyCal, keyProt, keyCarb, keyGord].filter(Boolean)
                    const cards = [
                      keyCal ? { label: 'Calorias', value: `${formatValue(keyCal, metaMacros[keyCal])} kcal` } : null,
                      keyProt ? { label: 'Proteínas', value: `${formatValue(keyProt, metaMacros[keyProt])} g` } : null,
                      keyCarb ? { label: 'Carboidratos', value: `${formatValue(keyCarb, metaMacros[keyCarb])} g` } : null,
                      keyGord ? { label: 'Gorduras', value: `${formatValue(keyGord, metaMacros[keyGord])} g` } : null,
                    ].filter(Boolean)
                    const extraEntries = getDisplayEntries(metaMacros, macroKeys)

                    return (
                      <>
                        {cards.length > 0 && (
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(120px, 1fr))', gap: 10, marginBottom: 14 }}>
                            {cards.map(card => (
                              <div key={card.label} style={{
                                background: 'var(--bg-3)', border: '1px solid var(--border)',
                                borderRadius: 10, padding: '10px 12px',
                              }}>
                                <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 4 }}>
                                  {card.label}
                                </p>
                                <p style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 800 }}>
                                  {card.value}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}

                        {extraEntries.length > 0 && (
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                            {extraEntries.map(([key, value]) => (
                              <div key={key}>
                                <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text-3)', marginBottom: 4 }}>
                                  {labelFromKey(key)}
                                </p>
                                <p style={{ fontSize: 14 }}>{formatValue(key, value)}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    )
                  })()}
                </Secao>

                <Secao title="Macros atingidos por dia (%)">
                  {macroSeries.length === 0 && (
                    <p style={{ fontSize: 13, color: 'var(--text-3)' }}>
                      Sem dados suficientes de refeições para montar o gráfico.
                    </p>
                  )}
                  {macroSeries.length > 0 && (
                    <>
                      <div style={{
                        marginBottom: 10, display: 'flex', gap: 14,
                        alignItems: 'center', flexWrap: 'wrap',
                      }}>
                        {[
                          { label: 'Proteínas', color: '#4bf07a' },
                          { label: 'Carboidratos', color: '#60a5fa' },
                          { label: 'Gorduras', color: '#f59e0b' },
                        ].map(item => (
                          <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ width: 10, height: 10, borderRadius: 999, background: item.color }} />
                            <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{item.label}</span>
                          </div>
                        ))}
                        <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
                          Escala de 0% a 200% da meta
                        </span>
                      </div>
                      <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 10, background: 'var(--bg-3)' }}>
                        <svg width={chartW} height={chartH} role="img" aria-label="Evolução dos macros atingidos por dia">
                          {[0, 50, 100, 150, 200].map(tick => {
                            const y = getY(tick)
                            return (
                              <g key={tick}>
                                <line x1={padX} y1={y} x2={chartW - padX} y2={y} stroke="var(--border)" strokeDasharray={tick === 100 ? '0' : '3 3'} />
                                <text x={6} y={y + 4} fill="var(--text-3)" fontSize="10">{tick}%</text>
                              </g>
                            )
                          })}

                          {macroSeries.length > 1 && (
                            <>
                              <path d={buildPath('protPct')} fill="none" stroke="#4bf07a" strokeWidth="2.5" />
                              <path d={buildPath('carbPct')} fill="none" stroke="#60a5fa" strokeWidth="2.5" />
                              <path d={buildPath('gordPct')} fill="none" stroke="#f59e0b" strokeWidth="2.5" />
                            </>
                          )}

                          {macroSeries.map((point, i) => (
                            <g key={point.day}>
                              <circle cx={getX(i)} cy={getY(point.protPct)} r="3.5" fill="#4bf07a" />
                              <circle cx={getX(i)} cy={getY(point.carbPct)} r="3.5" fill="#60a5fa" />
                              <circle cx={getX(i)} cy={getY(point.gordPct)} r="3.5" fill="#f59e0b" />
                              <text x={getX(i)} y={chartH - 2} textAnchor="middle" fill="var(--text-3)" fontSize="10">
                                {point.label}
                              </text>
                            </g>
                          ))}
                        </svg>
                      </div>
                    </>
                  )}
                </Secao>

                <Secao title={`Últimas refeições (${refeicoes.length})`}>
                  {refeicoes.length === 0 && (
                    <p style={{ fontSize: 13, color: 'var(--text-3)' }}>
                      Nenhuma refeição registrada.
                    </p>
                  )}
                  {refeicoes.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {refeicoes.map((ref, i) => {
                        const dateKey = findDateKeyFromRow(ref)
                        const titulo = ref.nome || ref.refeicao || ref.tipo_refeicao || `Refeição ${i + 1}`
                        const entries = getDisplayEntries(ref, dateKey ? [dateKey] : [])
                        return (
                          <div key={ref.id || i} style={{
                            background: 'var(--bg-3)', border: '1px solid var(--border)',
                            borderRadius: 10, padding: '12px 14px',
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
                              <p style={{ fontSize: 13, fontWeight: 700 }}>{titulo}</p>
                              <span style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
                                {dateKey ? formatValue(dateKey, ref[dateKey]) : '—'}
                              </span>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                              {entries.map(([key, value]) => (
                                <div key={key}>
                                  <p style={{ fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 3 }}>
                                    {labelFromKey(key)}
                                  </p>
                                  <p style={{ fontSize: 12.5, color: 'var(--text-2)' }}>{formatValue(key, value)}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </Secao>
              </>
            )}
          </div>
        )}

        {/* Tab: Gamificação */}
        {tab === 'gamif' && (
          <div className="anim">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 20 }}>
              {[
                { label: 'Pontos esta semana', value: gamif?.pontos || 0, accent: 'var(--lime)' },
                { label: 'Bônus desafio', value: gamif?.detalhe?.bonus_desafio || 0, accent: '#efb144' },
                { label: 'Posição no ranking', value: rankingAluno.posicao ? `#${rankingAluno.posicao}` : '—', accent: 'var(--blue)' },
                { label: 'Badges obtidos', value: badges.length },
              ].map(s => (
                <div key={s.label} style={{
                  background: 'var(--bg-2)', border: '1px solid var(--border)',
                  borderRadius: 10, padding: '16px 18px',
                }}>
                  <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text-3)', marginBottom: 6 }}>
                    {s.label}
                  </p>
                  <p style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 800, color: s.accent || 'var(--text)' }}>
                    {s.value}
                  </p>
                </div>
              ))}
            </div>

            <Secao title="Ranking do aluno">
              {rankingAluno.posicao ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <p style={{ fontSize: 13, color: 'var(--text-2)' }}>
                    {nome} está em <strong>#{rankingAluno.posicao}</strong>
                    {rankingAluno.total ? ` de ${rankingAluno.total}` : ''} no ranking geral.
                  </p>
                  <span className="tag tag-blue">{rankingAluno.pontos} pts</span>
                </div>
              ) : (
                <p style={{ fontSize: 13, color: 'var(--text-3)' }}>
                  Este aluno ainda não aparece no ranking geral.
                </p>
              )}
            </Secao>

            <Secao title="Badges">
              {badges.length === 0 && <p style={{ fontSize: 13, color: 'var(--text-3)' }}>Ainda sem conquistas.</p>}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                {badges.map(ub => (
                  <div key={ub.id} style={{
                    background: 'var(--bg-3)', border: '1px solid rgba(201,242,77,.2)',
                    borderRadius: 10, padding: '10px 14px',
                    display: 'flex', alignItems: 'center', gap: 10,
                  }}>
                    <span style={{ fontSize: 22 }}>{ub.badge?.icone || '★'}</span>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 600 }}>{ub.badge?.titulo || 'Badge'}</p>
                      <p style={{ fontSize: 11, color: 'var(--text-3)' }}>
                        {new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(new Date(ub.concedido_em))}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </Secao>
          </div>
        )}

        {/* Tab: Dados pessoais */}
        {tab === 'perfil' && (
          <div className="anim">
            <Secao title="Dados do aluno">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                {[
                  { label: 'Nome', value: aluno.nome || '—' },
                  { label: 'E-mail', value: aluno.email || '—' },
                  { label: 'WhatsApp', value: aluno.telefone ? `+${aluno.telefone}` : '—' },
                  { label: 'Objetivo', value: objetivoMap[aluno.objetivo] || aluno.objetivo || '—' },
                  { label: 'Sexo', value: aluno.sexo || '—' },
                  { label: 'Peso atual', value: aluno.peso_atual_kg ? `${aluno.peso_atual_kg} kg` : '—' },
                  { label: 'Altura', value: aluno.altura_cm ? `${aluno.altura_cm} cm` : '—' },
                  { label: 'Nível de atividade', value: aluno.nivel_atividade || '—' },
                  { label: 'Restrições', value: aluno.restricoes || '—' },
                  { label: 'Nome no ranking', value: aluno.display_name || '—' },
                ].map(item => (
                  <div key={item.label}>
                    <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text-3)', marginBottom: 4 }}>
                      {item.label}
                    </p>
                    <p style={{ fontSize: 14 }}>{item.value}</p>
                  </div>
                ))}
              </div>
            </Secao>
          </div>
        )}

        {/* Tab: Risco de Cancelamento */}
        {tab === 'risco' && (
          <div className="anim">
            <Secao title="Análise de Risco de Cancelamento">
              {riscoData ? (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
                    <div style={{
                      background: riscoData.level.bg,
                      border: `1px solid ${riscoData.level.border}`,
                      borderRadius: 16,
                      padding: '16px 24px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      minWidth: 140
                    }}>
                      <span style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--text-3)', fontWeight: 600 }}>Score</span>
                      <span style={{ fontSize: 36, fontWeight: 800, color: riscoData.level.color }}>{riscoData.score}%</span>
                      <span style={{ fontSize: 14, fontWeight: 700, color: riscoData.level.color, marginTop: 4 }}>{riscoData.level.label}</span>
                    </div>
                    
                    <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12 }}>
                      <div style={{ background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 10, padding: 14 }}>
                        <p style={{ fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.07em', fontWeight: 600 }}>Dias Inativo</p>
                        <p style={{ marginTop: 6, fontSize: 22, fontWeight: 800 }}>{riscoData.daysWithout === null ? '—' : riscoData.daysWithout}</p>
                      </div>
                      <div style={{ background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 10, padding: 14 }}>
                        <p style={{ fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.07em', fontWeight: 600 }}>Ativ. (7 dias)</p>
                        <p style={{ marginTop: 6, fontSize: 22, fontWeight: 800 }}>{riscoData.activities7d}</p>
                      </div>
                      <div style={{ background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 10, padding: 14 }}>
                        <p style={{ fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.07em', fontWeight: 600 }}>Ref. (7 dias)</p>
                        <p style={{ marginTop: 6, fontSize: 22, fontWeight: 800 }}>{riscoData.refeicoes7d}</p>
                      </div>
                    </div>
                  </div>

                  <div style={{
                    background: 'var(--bg-2)',
                    border: '1px solid var(--border)',
                    borderRadius: 10,
                    padding: '12px 14px',
                  }}>
                    <p style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Critérios do risco de cancelamento</p>
                    <p style={{ fontSize: 12, color: 'var(--text-3)', lineHeight: 1.6 }}>
                      O score vai de 0 a 99 e combina <strong>tempo sem atividade</strong> + <strong>atividades nos últimos 7 dias</strong>.
                      Faixas: <strong>Alto</strong> (70-99), <strong>Médio</strong> (40-69) e <strong>Baixo</strong> (0-39).
                    </p>
                    <p style={{ fontSize: 12, color: 'var(--text-3)', lineHeight: 1.6, marginTop: 6 }}>
                      Base por inatividade: sem atividade = 95, até 3 dias = 15, até 7 dias = 35, até 14 dias = 55, até 21 dias = 75, acima de 21 dias = 90.
                      Ajuste por frequência: 6+ atividades (-25), 3-5 (-10), 0-1 (+10).
                    </p>
                    <p style={{ fontSize: 12, color: 'var(--text-3)', lineHeight: 1.6, marginTop: 6 }}>
                      Peso de refeições (7 dias): 14+ refeições (-10), 7-13 (-5), nenhuma refeição (+5).
                    </p>
                  </div>
                </div>
              ) : (
                <p style={{ fontSize: 13, color: 'var(--text-3)' }}>Carregando dados de risco...</p>
              )}
            </Secao>
          </div>
        )}
      </div>

      {/* Modal prescrição */}
      {showPrescricao && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,.65)',
          display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
          zIndex: 1000, padding: 32, overflowY: 'auto',
        }} onClick={() => { setShowPrescricao(false); setSaveMsg('') }}>
          <div style={{
            background: 'var(--bg-2)', border: '1px solid var(--border-2)',
            borderRadius: 14, width: '100%', maxWidth: 760,
            boxShadow: 'var(--shadow)', marginTop: 0,
          }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <p style={{ fontWeight: 700, fontSize: 15 }}>Prescrever treino</p>
              <button onClick={() => { setShowPrescricao(false); setSaveMsg('') }} style={{ color: 'var(--text-3)', fontSize: 18, background: 'none' }}>✕</button>
            </div>
            <form onSubmit={prescreverTreino} style={{ padding: 22 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12, marginBottom: 16 }}>
                <div className="field">
                  <label>Tipo</label>
                  <select className="input" value={pForm.tipo}
                    onChange={e => setPForm(f => ({ ...f, tipo: e.target.value }))}>
                    <option value="user">Específico ({nome})</option>
                    <option value="general">Geral (aparece para todos)</option>
                  </select>
                </div>
                <div className="field">
                  <label>Nome do treino *</label>
                  <input className="input" placeholder="Ex: Peito + Tríceps" value={pForm.nome}
                    onChange={e => setPForm(f => ({ ...f, nome: e.target.value }))} required />
                </div>
                <div className="field">
                  <label>Categoria</label>
                  <select className="input" value={pForm.categoria}
                    onChange={e => setPForm(f => ({ ...f, categoria: e.target.value }))}>
                    {CATEGORIAS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label>Personal {pForm.tipo === 'general' ? '*' : ''}</label>
                  <select className="input" value={pForm.personal_id}
                    onChange={e => setPForm(f => ({ ...f, personal_id: e.target.value }))}>
                    <option value="">— Sem personal —</option>
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
                {pForm.tipo === 'general'
                  ? 'Treino geral fica disponível na base para todos os alunos (sem atribuição automática).'
                  : `Treino específico será vinculado apenas ao aluno ${nome}.`}
              </p>
              <div style={{ marginBottom: 14 }}>
                <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
                  O app do aluno calcula as calorias automaticamente com base no MET e nas métricas individuais.
                </span>
              </div>

              <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--text-3)', marginBottom: 10 }}>
                Exercícios
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 }}>
                {pForm.exercicios.map((ex, i) => (
                  <div key={i} style={{
                    background: 'var(--bg-3)', border: '1px solid var(--border)',
                    borderRadius: 10, padding: '12px 14px',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                      <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-3)' }}>Exercício {i + 1}</p>
                      {pForm.exercicios.length > 1 && (
                        <button type="button" onClick={() => remEx(i)}
                          style={{ background: 'none', color: 'var(--text-3)', fontSize: 13, lineHeight: 1 }}>✕</button>
                      )}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) repeat(4, minmax(0, 1fr))', gap: 8 }}>
                      <input className="input" style={{ height: 36, minWidth: 0, width: '100%' }} placeholder="Nome do exercício *"
                        value={ex.nome} onChange={e => updEx(i, 'nome', e.target.value)} required />
                      <input className="input" style={{ height: 36, minWidth: 0, width: '100%' }} placeholder="Séries" inputMode="numeric"
                        title="Quantidade de séries do exercício (ex: 3)"
                        value={ex.series} onChange={e => updEx(i, 'series', e.target.value)} />
                      <input className="input" style={{ height: 36, minWidth: 0, width: '100%' }} placeholder="Reps"
                        title="Quantidade de repetições por série (ex: 12)"
                        value={ex.repeticoes} onChange={e => updEx(i, 'repeticoes', e.target.value)} />
                      <input className="input" style={{ height: 36, minWidth: 0, width: '100%' }} placeholder="Carga kg"
                        title="Carga utilizada em quilos (kg) (ex: 20)"
                        value={ex.carga} onChange={e => updEx(i, 'carga', e.target.value)} />
                      <div style={{ position: 'relative' }}>
                        <input
                          className="input"
                          style={{ height: 36, minWidth: 0, width: '100%', paddingRight: 30 }}
                          type="number"
                          min="1"
                          max="15"
                          step="0.1"
                          placeholder="MET *"
                          title="MET de referencia: leve 3-4 | moderado 4.5-6 | intenso 6.5-9+"
                          value={ex.met}
                          onChange={e => updEx(i, 'met', e.target.value)}
                          required
                        />
                        <span
                          title="MET de referencia: leve 3-4 | moderado 4.5-6 | intenso 6.5-9+"
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
                <button type="button" className="btn btn-ghost" onClick={() => { setShowPrescricao(false); setSaveMsg('') }}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Salvando...' : 'Prescrever treino'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

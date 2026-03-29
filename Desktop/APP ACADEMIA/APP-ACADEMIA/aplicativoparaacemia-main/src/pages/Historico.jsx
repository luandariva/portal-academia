import { useEffect, useMemo, useState, useCallback } from 'react'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { resolveUsuarioDb } from '../lib/usuarioDb'
import './Historico.css'

function toNum(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function pick(obj, keys, fallback = null) {
  for (const key of keys) {
    if (obj && obj[key] !== undefined && obj[key] !== null) return obj[key]
  }
  return fallback
}

function formatDate(dateStr) {
  if (!dateStr) return '--'
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return String(dateStr)
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  const ontem = new Date(hoje)
  ontem.setDate(ontem.getDate() - 1)
  const dia = new Date(d)
  dia.setHours(0, 0, 0, 0)

  if (dia.getTime() === hoje.getTime()) return 'Hoje'
  if (dia.getTime() === ontem.getTime()) return 'Ontem'

  return new Intl.DateTimeFormat('pt-BR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(d)
}

function formatTime(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

function dayKey(dateStr) {
  const d = new Date(dateStr)
  return d.toISOString().slice(0, 10)
}

function formatShortDate(d) {
  return new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short' }).format(d)
}

function formatWeekRange(monday, sunday) {
  return `${formatShortDate(monday)} – ${formatShortDate(sunday)}`
}

function getPeriodRange(periodo, offset) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  if (periodo === 'dia') {
    const d = new Date(today)
    d.setDate(d.getDate() + offset)
    const label = offset === 0 ? 'Hoje' : offset === -1 ? 'Ontem' : formatDate(d)
    return { start: d, end: d, label }
  }

  if (periodo === 'semana') {
    const day = today.getDay()
    const monday = new Date(today)
    monday.setDate(today.getDate() - (day === 0 ? 6 : day - 1) + offset * 7)
    const sunday = new Date(monday)
    sunday.setDate(monday.getDate() + 6)
    const label = offset === 0 ? 'Esta semana' : formatWeekRange(monday, sunday)
    return { start: monday, end: sunday, label }
  }

  // mes
  const d = new Date(today.getFullYear(), today.getMonth() + offset, 1)
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0)
  const label = offset === 0
    ? 'Este mês'
    : new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(d)
  return { start: d, end, label }
}

/* ─── Icons ─── */
function DumbbellIcon({ size = 18, color = 'var(--lime)' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m14.4 14.4 5.6 5.6" /><path d="M22 14.8v3.4c0 .8-.5 1.5-1.2 1.7l-1.3.4c-.6.2-1.3-.2-1.5-.8L18 19" />
      <path d="M10.8 19.2l-5.6-5.6" /><path d="M2.8 5.6 2 4.2c-.2-.6.2-1.3.8-1.5l1.3-.4c.8-.2 1.5.3 1.7 1.1L6 4.6" />
      <path d="m13.8 13.8 2-2" /><path d="m10.2 10.2-2 2" /><path d="m6.6 6.6-2 2" /><path d="m17.4 17.4-2 2" />
      <path d="M13 13 5 5" /><path d="m19 19-8-8" />
      <path d="M7.4 7.4 6 6c-.8-.8-.8-2 0-2.8s2-.8 2.8 0l1.4 1.4" />
      <path d="m16.6 16.6 1.4 1.4c.8.8.8 2 0 2.8s-2 .8-2.8 0l-1.4-1.4" />
    </svg>
  )
}

function MealIcon({ size = 18, color = 'var(--amber)' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8h1a4 4 0 0 1 0 8h-1" /><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" />
      <line x1="6" y1="1" x2="6" y2="4" /><line x1="10" y1="1" x2="10" y2="4" /><line x1="14" y1="1" x2="14" y2="4" />
    </svg>
  )
}

function ChevronIcon({ direction = 'down', size = 16, color = 'var(--text-3)' }) {
  const rotations = { down: 0, up: 180, left: 90, right: -90 }
  const rotation = rotations[direction] ?? 0
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
      style={{ transform: `rotate(${rotation}deg)`, transition: 'transform .2s' }}>
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}

function EmptyIcon({ size = 48 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5 }}>
      <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
    </svg>
  )
}

export default function Historico() {
  const { user } = useAuth()
  const [periodo, setPeriodo] = useState('semana')
  const [offset, setOffset] = useState(0)
  const [filtro, setFiltro] = useState('todos')
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState('')
  const [treinos, setTreinos] = useState([])
  const [refeicoes, setRefeicoes] = useState([])
  const [expandedId, setExpandedId] = useState(null)

  useEffect(() => { setOffset(0) }, [periodo])

  useEffect(() => {
    let alive = true

    async function load() {
      if (!user?.id) {
        if (alive) { setErro('Usuário não autenticado.'); setLoading(false) }
        return
      }
      setLoading(true)
      setErro('')

      try {
        const { usuarioId } = await resolveUsuarioDb(user)
        if (!usuarioId) throw new Error('Usuário não encontrado.')

        const [trRes, refRes] = await Promise.all([
          supabase
            .from('treinos_realizados')
            .select('id, nome, exercicios, concluido, data_hora')
            .eq('usuario_id', usuarioId)
            .order('data_hora', { ascending: false })
            .limit(100),
          supabase
            .from('refeicoes')
            .select('*')
            .eq('usuario_id', usuarioId)
            .order('data_hora', { ascending: false })
            .limit(100),
        ])

        if (trRes.error) throw trRes.error
        if (refRes.error) throw refRes.error

        if (alive) {
          setTreinos(trRes.data || [])
          setRefeicoes(refRes.data || [])
        }
      } catch (err) {
        if (alive) setErro(err?.message || 'Falha ao carregar histórico.')
      } finally {
        if (alive) setLoading(false)
      }
    }

    load()
    return () => { alive = false }
  }, [user?.id, user?.email])

  const allItems = useMemo(() => {
    const treinoItems = treinos.map((t) => ({
      id: `treino-${t.id}`,
      type: 'treino',
      nome: t.nome || 'Treino',
      data: t.data_hora,
      concluido: t.concluido,
      categoria: t.categoria || '',
      duracao: t.duracao_min || null,
      exercicios: Array.isArray(t.exercicios) ? t.exercicios : [],
    }))

    const refeicaoItems = refeicoes.map((r) => ({
      id: `refeicao-${r.id}`,
      type: 'refeicao',
      nome: pick(r, ['nome', 'refeicao', 'tipo_refeicao'], 'Refeição'),
      data: pick(r, ['data_hora', 'horario', 'created_at']),
      kcal: toNum(pick(r, ['kcal', 'calorias', 'calorias_kcal'])),
      proteina: toNum(pick(r, ['proteina_g', 'proteina', 'proteinas_g'])),
      carboidrato: toNum(pick(r, ['carboidrato_g', 'carboidrato', 'carbo_g'])),
      gordura: toNum(pick(r, ['gordura_g', 'gordura', 'lipideos_g'])),
      status: String(pick(r, ['status', 'situacao'], 'registrada')).toLowerCase().includes('pend') ? 'Pendente' : 'Registrada',
      observacoes: pick(r, ['observacoes', 'observacao', 'descricao'], ''),
    }))

    return [...treinoItems, ...refeicaoItems].sort((a, b) => new Date(b.data) - new Date(a.data))
  }, [treinos, refeicoes])

  const filteredByPeriod = useMemo(() => {
    const { start, end } = getPeriodRange(periodo, offset)
    return allItems.filter((item) => {
      if (!item.data) return false
      const d = new Date(item.data)
      d.setHours(0, 0, 0, 0)
      return d >= start && d <= end
    })
  }, [allItems, periodo, offset])

  const displayItems = useMemo(() => {
    if (filtro === 'treino') return filteredByPeriod.filter(i => i.type === 'treino')
    if (filtro === 'refeicao') return filteredByPeriod.filter(i => i.type === 'refeicao')
    return filteredByPeriod
  }, [filteredByPeriod, filtro])

  const stats = useMemo(() => {
    const trTotal = filteredByPeriod.filter(i => i.type === 'treino').length
    const refTotal = filteredByPeriod.filter(i => i.type === 'refeicao').length
    const kcalTotal = filteredByPeriod.filter(i => i.type === 'refeicao').reduce((acc, r) => acc + r.kcal, 0)
    const uniqueDays = new Set(filteredByPeriod.map(i => i.data ? dayKey(i.data) : null).filter(Boolean))
    return { trTotal, refTotal, kcalTotal, diasAtivos: uniqueDays.size }
  }, [filteredByPeriod])

  const kcalFormatted = stats.kcalTotal > 9999
    ? `${(stats.kcalTotal / 1000).toFixed(1)}k`
    : stats.kcalTotal

  const grouped = useMemo(() => {
    const map = new Map()
    for (const item of displayItems) {
      const key = item.data ? dayKey(item.data) : 'sem-data'
      if (!map.has(key)) map.set(key, { dateLabel: formatDate(item.data), items: [] })
      map.get(key).items.push(item)
    }
    return [...map.entries()]
  }, [displayItems])

  const toggleExpand = useCallback((id) => {
    setExpandedId(prev => prev === id ? null : id)
  }, [])

  const periodRange = getPeriodRange(periodo, offset)

  const statItems = periodo === 'dia'
    ? [
        { label: 'Treinos', value: stats.trTotal, color: 'var(--lime)' },
        { label: 'Refeições', value: stats.refTotal, color: 'var(--amber)' },
        { label: 'Kcal', value: kcalFormatted, color: 'var(--red)' },
        { label: 'Itens', value: filteredByPeriod.length, color: 'var(--blue)' },
      ]
    : [
        { label: 'Treinos', value: stats.trTotal, color: 'var(--lime)' },
        { label: 'Refeições', value: stats.refTotal, color: 'var(--amber)' },
        { label: 'Kcal', value: kcalFormatted, color: 'var(--red)' },
        { label: 'Dias', value: stats.diasAtivos, color: 'var(--blue)' },
      ]

  const periodoTabs = [
    { id: 'dia', label: 'Dia' },
    { id: 'semana', label: 'Semana' },
    { id: 'mes', label: 'Mês' },
  ]

  const filtroTabs = [
    { id: 'todos', label: 'Todos', icon: '📋' },
    { id: 'treino', label: 'Treinos', icon: '💪' },
    { id: 'refeicao', label: 'Refeições', icon: '🍽️' },
  ]

  return (
    <div className="hist-container">
      {/* ─── Header ─── */}
      <div className="hist-header">
        <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 2 }}>Acompanhamento</p>
        <h1 className="hist-title">Histórico</h1>
      </div>

      {/* ─── Period Selector ─── */}
      <div className="tab-group anim">
        {periodoTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setPeriodo(tab.id)}
            className={`tab-btn ${periodo === tab.id ? 'active' : ''}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ─── Navigation Row ─── */}
      <div className="nav-row anim">
        <button
          type="button"
          className="nav-btn"
          onClick={() => setOffset(o => o - 1)}
          aria-label="Período anterior"
        >
          <ChevronIcon direction="left" size={18} color="var(--text-2)" />
        </button>
        <span className="nav-label">{periodRange.label}</span>
        <button
          type="button"
          className="nav-btn"
          onClick={() => setOffset(o => o + 1)}
          disabled={offset >= 0}
          aria-label="Próximo período"
          style={{ opacity: offset >= 0 ? 0.3 : 1 }}
        >
          <ChevronIcon direction="right" size={18} color="var(--text-2)" />
        </button>
      </div>

      {/* ─── Period Stats ─── */}
      <div className="resumo-card anim" style={{ padding: 16 }}>
        <div className="stats-grid">
          {statItems.map((s) => (
            <div key={s.label} className="stat-item">
              <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ─── Filter Tabs ─── */}
      <div className="tab-group">
        {filtroTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFiltro(tab.id)}
            className={`tab-btn ${filtro === tab.id ? 'active' : ''}`}
          >
            <span style={{ fontSize: 14 }}>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ─── Loading ─── */}
      {loading && (
        <div className="dash-loading anim">
          <div className="spinner" />
          <span>Carregando histórico...</span>
        </div>
      )}

      {/* ─── Error ─── */}
      {!loading && erro && (
        <div className="dash-warning anim">
          {erro}
        </div>
      )}

      {/* ─── Empty State ─── */}
      {!loading && !erro && displayItems.length === 0 && (
        <div className="dash-warning anim" style={{ padding: '40px 20px', flexDirection: 'column', gap: 12 }}>
          <EmptyIcon />
          <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-2)' }}>Nenhum registro neste período</p>
        </div>
      )}

      {/* ─── Timeline ─── */}
      {!loading && !erro && grouped.map(([key, group], groupIdx) => (
        <div key={key} className="timeline-group anim" style={{ animationDelay: `${0.1 + groupIdx * 0.05}s` }}>
          <div className="day-header">
            <span className="day-label">{group.dateLabel}</span>
            <div className="day-line" />
            <span className="day-count">{group.items.length} {group.items.length === 1 ? 'item' : 'itens'}</span>
          </div>

          <div className="hist-list">
            {group.items.map((item) => {
              const isExpanded = expandedId === item.id
              const isTreino = item.type === 'treino'
              const accentColor = isTreino ? 'var(--lime)' : 'var(--amber)'

              return (
                <div key={item.id}>
                  <button
                    type="button"
                    onClick={() => toggleExpand(item.id)}
                    className={`hist-item-btn ${isExpanded ? 'expanded' : ''}`}
                  >
                    <div className="icon-box" style={{ background: isTreino ? 'var(--lime-dim)' : 'rgba(255,145,77,0.1)', borderColor: isTreino ? 'var(--lime-border)' : 'rgba(255,145,77,0.2)' }}>
                      {isTreino ? <DumbbellIcon size={20} color={accentColor} /> : <MealIcon size={20} color={accentColor} />}
                    </div>

                    <div className="hist-item-info">
                      <div className="hist-item-title">{item.nome}</div>
                      <div className="hist-item-meta">
                        <span>{formatTime(item.data)}</span>
                        {isTreino ? (
                          <span className={`badge-status ${item.concluido ? 'concluido' : 'pendente'}`}>
                            {item.concluido ? '✓ OK' : '○ PENDENTE'}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--amber)', fontWeight: 700 }}>{item.kcal} kcal</span>
                        )}
                      </div>
                    </div>

                    <ChevronIcon direction={isExpanded ? 'up' : 'down'} color={isExpanded ? accentColor : 'var(--text-3)'} />
                  </button>

                  {isExpanded && (
                    <div className="details-box">
                      {isTreino ? (
                        <div className="anim">
                          <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                            {item.categoria && <span className="tag" style={{ background: 'var(--lime-dim)', color: 'var(--lime)', border: '1px solid var(--lime-border)' }}>{item.categoria}</span>}
                            {item.duracao && <span className="tag">{item.duracao} min</span>}
                            <span className="tag">{item.exercicios.length} exs</span>
                          </div>

                          {item.exercicios.length > 0 && (
                            <div className="ex-list-mini">
                              {item.exercicios.slice(0, 10).map((ex, ei) => {
                                const exNome = typeof ex === 'string' ? ex : (ex?.nome || ex?.exercicio || `Exercício ${ei + 1}`)
                                const series = ex?.series || ex?.sets || null
                                const reps = ex?.repeticoes || ex?.reps || null
                                return (
                                  <div key={ei} className="ex-item-mini">
                                    <span style={{ color: 'var(--text-2)' }}>{exNome}</span>
                                    {(series || reps) && <span style={{ color: 'var(--text-3)', fontWeight: 800 }}>{series && `${series}x`}{reps}</span>}
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="anim">
                          <div className="macro-grid">
                            {[
                              { label: 'KCAL', val: item.kcal, color: 'var(--red)' },
                              { label: 'PROT', val: item.proteina, color: 'var(--blue)' },
                              { label: 'CARB', val: item.carboidrato, color: 'var(--amber)' },
                              { label: 'GORD', val: item.gordura, color: 'var(--purple)' },
                            ].map((m) => (
                              <div key={m.label} className="macro-item">
                                <div className="macro-val" style={{ color: m.color }}>{m.val}</div>
                                <div className="macro-lab">{m.label}</div>
                              </div>
                            ))}
                          </div>

                          {item.observacoes && (
                            <div className="input-field" style={{ padding: 12, borderRadius: 12, background: 'var(--bg-3)', opacity: 0.8 }}>
                              <p style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 4, fontWeight: 700 }}>OBSERVAÇÕES</p>
                              <p style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.5 }}>{item.observacoes}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

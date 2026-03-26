import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const DATE_KEYS = ['data_hora', 'concluido_em', 'created_at', 'data_ref', 'data']

function toDate(value) {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function getRiskLevel(score) {
  if (score >= 70) return { label: 'Alto', color: 'var(--red)', bg: 'rgba(248,113,113,.11)', border: 'rgba(248,113,113,.35)' }
  if (score >= 40) return { label: 'Médio', color: 'rgb(251,191,36)', bg: 'rgba(251,191,36,.1)', border: 'rgba(251,191,36,.3)' }
  return { label: 'Baixo', color: 'var(--lime)', bg: 'rgba(201,242,77,.11)', border: 'rgba(201,242,77,.3)' }
}

function formatDateTime(dateValue) {
  const d = toDate(dateValue)
  if (!d) return 'Sem atividade'
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
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

  // Refeições têm peso próprio no risco de cancelamento.
  if (refeicoes7d >= 14) score -= 10
  else if (refeicoes7d >= 7) score -= 5
  else if (refeicoes7d === 0) score += 5

  return clamp(score, 0, 99)
}

export default function RiscoCancelamento() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState('alto_medio')
  const [rows, setRows] = useState([])

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError('')

      const [{ data: usuarios, error: uErr }, { data: treinos, error: tErr }, { data: desafios, error: dErr }, { data: refeicoes, error: rErr }] = await Promise.all([
        supabase.from('usuarios').select('id, nome, email, telefone, objetivo'),
        supabase.from('treinos_realizados').select('usuario_id, data_hora'),
        supabase.from('desafios_semanais_conclusoes').select('usuario_id, concluido_em'),
        supabase.from('refeicoes').select('*'),
      ])

      if (uErr || tErr || dErr || rErr) {
        setError(uErr?.message || tErr?.message || dErr?.message || rErr?.message || 'Erro ao carregar dados de engajamento.')
        setLoading(false)
        return
      }

      const now = Date.now()
      const sevenDaysAgo = now - (7 * 24 * 60 * 60 * 1000)
      const map = new Map()

      ;(usuarios || []).forEach((u) => {
        map.set(u.id, {
          ...u,
          totalActivities: 0,
          activities7d: 0,
          refeicoes7d: 0,
          lastActivityAt: null,
        })
      })

      function absorbActivity(events, userKey, dateKeyCandidates, onCount) {
        ;(events || []).forEach((row) => {
          const userId = row?.[userKey]
          if (!userId || !map.has(userId)) return

          const target = map.get(userId)
          const dateKey = dateKeyCandidates.find((key) => row?.[key])
          const when = dateKey ? toDate(row?.[dateKey]) : null
          if (!when) return

          const ts = when.getTime()
          target.totalActivities += 1
          if (ts >= sevenDaysAgo) target.activities7d += 1
          if (onCount) onCount(target, ts)
          if (!target.lastActivityAt || ts > new Date(target.lastActivityAt).getTime()) {
            target.lastActivityAt = when.toISOString()
          }
        })
      }

      absorbActivity(treinos, 'usuario_id', ['data_hora', ...DATE_KEYS])
      absorbActivity(desafios, 'usuario_id', ['concluido_em', ...DATE_KEYS])
      absorbActivity(refeicoes, 'usuario_id', DATE_KEYS, (target, ts) => {
        if (ts >= sevenDaysAgo) target.refeicoes7d += 1
      })

      const computed = Array.from(map.values()).map((u) => {
        const score = calcRisk({
          lastActivityAt: u.lastActivityAt,
          activities7d: u.activities7d,
          refeicoes7d: u.refeicoes7d,
        })
        const daysWithout = u.lastActivityAt
          ? Math.floor((now - new Date(u.lastActivityAt).getTime()) / (1000 * 60 * 60 * 24))
          : null
        return {
          ...u,
          riskScore: score,
          risk: getRiskLevel(score),
          daysWithout,
        }
      })

      computed.sort((a, b) => {
        if (b.riskScore !== a.riskScore) return b.riskScore - a.riskScore
        return (b.daysWithout || 0) - (a.daysWithout || 0)
      })

      setRows(computed)
      setLoading(false)
    }

    load()
  }, [])

  const filtered = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return rows.filter((row) => {
      const matchText = !q
        || (row.nome || '').toLowerCase().includes(q)
        || (row.email || '').toLowerCase().includes(q)
      if (!matchText) return false
      if (filtro === 'alto') return row.riskScore >= 70
      if (filtro === 'medio') return row.riskScore >= 40 && row.riskScore < 70
      if (filtro === 'baixo') return row.riskScore < 40
      if (filtro === 'alto_medio') return row.riskScore >= 40
      return true
    })
  }, [rows, busca, filtro])

  const kpis = useMemo(() => {
    const alto = rows.filter(r => r.riskScore >= 70).length
    const medio = rows.filter(r => r.riskScore >= 40 && r.riskScore < 70).length
    const semAtividade = rows.filter(r => !r.lastActivityAt).length
    return { alto, medio, semAtividade, total: rows.length }
  }, [rows])

  return (
    <div style={{ padding: '32px 36px', overflowY: 'auto', flex: 1 }}>
      <div className="anim" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 22 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 800 }}>
            Risco de cancelamento
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 2 }}>
            Identifique alunos com baixa atividade recente para ação proativa.
          </p>
        </div>
      </div>

      <div className="anim-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 18 }}>
        <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 10, padding: 14 }}>
          <p style={{ fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.07em' }}>Alto risco</p>
          <p style={{ marginTop: 6, fontSize: 24, fontWeight: 800, color: 'var(--red)' }}>{kpis.alto}</p>
        </div>
        <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 10, padding: 14 }}>
          <p style={{ fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.07em' }}>Médio risco</p>
          <p style={{ marginTop: 6, fontSize: 24, fontWeight: 800, color: 'rgb(251,191,36)' }}>{kpis.medio}</p>
        </div>
        <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 10, padding: 14 }}>
          <p style={{ fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.07em' }}>Sem atividade</p>
          <p style={{ marginTop: 6, fontSize: 24, fontWeight: 800 }}>{kpis.semAtividade}</p>
        </div>
        <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 10, padding: 14 }}>
          <p style={{ fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.07em' }}>Base total</p>
          <p style={{ marginTop: 6, fontSize: 24, fontWeight: 800 }}>{kpis.total}</p>
        </div>
      </div>

      <div
        className="anim-2"
        style={{
          marginBottom: 14,
          background: 'var(--bg-2)',
          border: '1px solid var(--border)',
          borderRadius: 10,
          padding: '12px 14px',
        }}
      >
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

      <div className="anim-2" style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14 }}>
        <input
          className="input"
          placeholder="Buscar por nome ou e-mail..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          style={{ width: 340 }}
        />
        <select className="input" value={filtro} onChange={(e) => setFiltro(e.target.value)} style={{ width: 210 }}>
          <option value="alto_medio">Filtrar: alto + médio</option>
          <option value="alto">Filtrar: só alto</option>
          <option value="medio">Filtrar: só médio</option>
          <option value="baixo">Filtrar: só baixo</option>
          <option value="todos">Filtrar: todos</option>
        </select>
      </div>

      {error && (
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
          Erro ao carregar dados: {error}
        </div>
      )}

      <div className="anim-3" style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Aluno</th>
                <th>Risco</th>
                <th>Inatividade</th>
                <th>Atividades 7 dias</th>
                <th>Refeições 7 dias</th>
                <th>Última atividade</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: 32, color: 'var(--text-3)' }}>
                    Carregando análise...
                  </td>
                </tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: 32, color: 'var(--text-3)' }}>
                    Nenhum aluno encontrado para este filtro.
                  </td>
                </tr>
              )}
              {!loading && filtered.map((row) => {
                const label = row.nome || row.email?.split('@')[0] || 'Aluno'
                const initials = label[0]?.toUpperCase() || 'A'
                return (
                  <tr key={row.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/alunos/${row.id}`)}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 32,
                          height: 32,
                          borderRadius: '50%',
                          background: 'var(--bg-4)',
                          border: '1px solid var(--border-2)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 12,
                          fontWeight: 700,
                          color: 'var(--lime)',
                          flexShrink: 0,
                        }}>
                          {initials}
                        </div>
                        <div>
                          <p style={{ fontWeight: 500 }}>{label}</p>
                          <p style={{ fontSize: 11, color: 'var(--text-3)' }}>{row.email || '—'}</p>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span style={{
                        background: row.risk.bg,
                        color: row.risk.color,
                        border: `1px solid ${row.risk.border}`,
                        borderRadius: 999,
                        padding: '4px 9px',
                        fontSize: 11,
                        fontWeight: 700,
                      }}>
                        {row.risk.label} ({row.riskScore}%)
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-2)' }}>
                      {row.daysWithout === null ? 'Sem histórico' : `${row.daysWithout} dia${row.daysWithout !== 1 ? 's' : ''}`}
                    </td>
                    <td style={{ fontWeight: 600, color: row.activities7d > 0 ? 'var(--lime)' : 'var(--text-3)' }}>
                      {row.activities7d}
                    </td>
                    <td style={{ fontWeight: 600, color: row.refeicoes7d > 0 ? 'var(--lime)' : 'var(--text-3)' }}>
                      {row.refeicoes7d}
                    </td>
                    <td style={{ color: 'var(--text-3)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                      {formatDateTime(row.lastActivityAt)}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          className="btn btn-ghost"
                          style={{ height: 30, fontSize: 12 }}
                          onClick={(e) => { e.stopPropagation(); navigate(`/alunos/${row.id}`) }}
                        >
                          Ver perfil
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

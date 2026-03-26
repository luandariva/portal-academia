import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

function KpiCard({ label, value, sub, accent }) {
  return (
    <div style={{
      background: 'var(--bg-2)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      padding: '16px 18px',
    }}>
      <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 8 }}>
        {label}
      </p>
      <p style={{ fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 800, color: accent || 'var(--text)', lineHeight: 1 }}>
        {value}
      </p>
      {sub && <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 6 }}>{sub}</p>}
    </div>
  )
}

function toPct(value) {
  const num = Number(value || 0)
  return `${num.toFixed(1)}%`
}

function levelFromScore(score) {
  if (score >= 70) return 'alto'
  if (score >= 40) return 'medio'
  return 'baixo'
}

function calcRiskScore(lastAt, activities7d) {
  if (!lastAt) return 95
  const now = Date.now()
  const ts = new Date(lastAt).getTime()
  const daysWithout = Math.floor((now - ts) / (1000 * 60 * 60 * 24))
  let score = 0
  if (daysWithout <= 3) score = 15
  else if (daysWithout <= 7) score = 35
  else if (daysWithout <= 14) score = 55
  else if (daysWithout <= 21) score = 75
  else score = 90
  if (activities7d >= 6) score -= 25
  else if (activities7d >= 3) score -= 10
  else if (activities7d <= 1) score += 10
  return Math.max(0, Math.min(99, score))
}

function dateKeyFromRow(row) {
  const keys = ['data_hora', 'created_at', 'data_ref', 'data', 'concluido_em']
  return keys.find((k) => row && row[k])
}

function isMissingRelationError(error) {
  const msg = String(error?.message || '').toLowerCase()
  return msg.includes('does not exist') || msg.includes('relation') || msg.includes('schema cache')
}

export default function Dashboard() {
  const { profile } = useAuth()
  const [periodDays, setPeriodDays] = useState(30)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [source, setSource] = useState('rpc')

  useEffect(() => {
    let mounted = true

    async function loadRanking() {
      const { data: ranking, error } = await supabase
        .rpc('rpc_gamificacao_leaderboard', { p_limit: 5 })
        .select()
      if (error) {
        if (isMissingRelationError(error)) return []
        throw error
      }
      return ranking || []
    }

    async function loadFallback() {
      async function optionalQuery(run) {
        const { data, error } = await run()
        if (error && !isMissingRelationError(error)) throw error
        return data || []
      }

      const sinceIso = new Date(Date.now() - (periodDays * 24 * 60 * 60 * 1000)).toISOString()
      const last7Days = Date.now() - (7 * 24 * 60 * 60 * 1000)

      const [
        { data: usuarios, error: uErr },
        treinosPlano,
        treinosRealizados,
        desafios,
        concl,
        personais,
        refeicoes,
      ] = await Promise.all([
        supabase.from('usuarios').select('id, objetivo'),
        optionalQuery(() => supabase.from('treinos_plano').select('id, tipo, personal_id')),
        optionalQuery(() => supabase.from('treinos_realizados').select('usuario_id, data_hora').gte('data_hora', sinceIso)),
        optionalQuery(() => supabase.from('desafios_semanais').select('id, ativo')),
        optionalQuery(() => supabase.from('desafios_semanais_conclusoes').select('usuario_id, concluido_em').gte('concluido_em', sinceIso)),
        optionalQuery(() => supabase.from('personais').select('id, nome')),
        optionalQuery(() => supabase.from('refeicoes').select('*')),
      ])

      if (uErr) throw new Error(uErr?.message || 'Erro ao carregar alunos')

      const users = usuarios || []
      const userTotal = users.length
      const refRows = refeicoes || []
      const refDateKey = dateKeyFromRow(refRows[0]) || null
      const refInPeriod = refDateKey
        ? refRows.filter((r) => r?.[refDateKey] && new Date(r[refDateKey]).getTime() >= new Date(sinceIso).getTime())
        : []

      const byUser = new Map(users.map((u) => [u.id, { lastAt: null, activities7d: 0 }]))
      function absorb(list, userField, dateField) {
        ;(list || []).forEach((row) => {
          const uid = row?.[userField]
          const raw = row?.[dateField]
          if (!uid || !raw || !byUser.has(uid)) return
          const ts = new Date(raw).getTime()
          if (Number.isNaN(ts)) return
          const curr = byUser.get(uid)
          if (!curr.lastAt || ts > new Date(curr.lastAt).getTime()) curr.lastAt = new Date(ts).toISOString()
          if (ts >= last7Days) curr.activities7d += 1
        })
      }
      absorb(treinosRealizados, 'usuario_id', 'data_hora')
      absorb(concl, 'usuario_id', 'concluido_em')
      if (refDateKey) absorb(refRows, 'usuario_id', refDateKey)

      let riscoAlto = 0
      let riscoMedio = 0
      let riscoBaixo = 0
      let semAtividade = 0
      let ativos7d = 0
      byUser.forEach((v) => {
        const score = calcRiskScore(v.lastAt, v.activities7d)
        const level = levelFromScore(score)
        if (!v.lastAt) semAtividade += 1
        if (v.activities7d > 0) ativos7d += 1
        if (level === 'alto') riscoAlto += 1
        else if (level === 'medio') riscoMedio += 1
        else riscoBaixo += 1
      })

      const desafiosParticipantes = new Set((concl || []).map((x) => x.usuario_id).filter(Boolean)).size
      const refeicaoParticipantes = new Set(refInPeriod.map((x) => x.usuario_id).filter(Boolean)).size
      const byTipoMap = new Map()
      ;(treinosPlano || []).forEach((row) => {
        const tipo = row?.tipo || 'nao_informado'
        byTipoMap.set(tipo, (byTipoMap.get(tipo) || 0) + 1)
      })
      const byPersonalMap = new Map()
      ;(treinosPlano || []).forEach((row) => {
        const id = row?.personal_id || 'sem_personal'
        byPersonalMap.set(id, (byPersonalMap.get(id) || 0) + 1)
      })
      const personalById = Object.fromEntries((personais || []).map((p) => [p.id, p.nome]))
      const objetivosMap = new Map()
      users.forEach((u) => {
        const objetivo = u?.objetivo || 'nao_informado'
        objetivosMap.set(objetivo, (objetivosMap.get(objetivo) || 0) + 1)
      })

      return {
        period_days: periodDays,
        alunos: {
          total: userTotal,
          ativos_7d: ativos7d,
          ativos_7d_percentual: userTotal ? (ativos7d / userTotal) * 100 : 0,
        },
        risco_cancelamento: {
          alto: riscoAlto,
          medio: riscoMedio,
          baixo: riscoBaixo,
          sem_atividade: semAtividade,
        },
        desafios: {
          ativos: (desafios || []).filter((d) => d.ativo).length,
          participantes_periodo: desafiosParticipantes,
          percentual_participacao: userTotal ? (desafiosParticipantes / userTotal) * 100 : 0,
        },
        refeicoes: {
          participantes_periodo: refeicaoParticipantes,
          percentual_registro: userTotal ? (refeicaoParticipantes / userTotal) * 100 : 0,
        },
        treinos: {
          prescritos_periodo: (treinosPlano || []).length,
          realizados_periodo: (treinosRealizados || []).length,
          adesao_percentual: (treinosPlano || []).length
            ? ((treinosRealizados || []).length / (treinosPlano || []).length) * 100
            : 0,
          por_tipo: Array.from(byTipoMap.entries()).map(([tipo, prescritos]) => ({ tipo, prescritos })),
          por_personal: Array.from(byPersonalMap.entries())
            .map(([id, prescritos]) => ({
              personal_id: id === 'sem_personal' ? null : id,
              personal_nome: id === 'sem_personal' ? 'Sem personal' : (personalById[id] || 'Personal'),
              prescritos,
            }))
            .sort((a, b) => b.prescritos - a.prescritos),
        },
        objetivos: Array.from(objetivosMap.entries()).map(([objetivo, total]) => ({ objetivo, total })),
        gamificacao: {
          ranking_top5: await loadRanking(),
        },
      }
    }

    async function load() {
      setLoading(true)
      setLoadError('')
      try {
        const [{ data: rpcData, error: rpcError }, rankingTop5] = await Promise.all([
          supabase.rpc('rpc_dashboard_exec_summary', { p_days: periodDays }),
          loadRanking(),
        ])
        if (rpcError) throw rpcError
        if (mounted) {
          setData({
            ...(rpcData || {}),
            gamificacao: { ranking_top5: rankingTop5 || [] },
          })
          setSource('rpc')
        }
      } catch {
        try {
          const fallbackData = await loadFallback()
          if (mounted) {
            setData(fallbackData)
            setSource('fallback')
          }
        } catch (fallbackError) {
          if (mounted) setLoadError(fallbackError?.message || 'Erro ao carregar dashboard executivo.')
        }
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [periodDays])

  const topPersonais = useMemo(
    () => (data?.treinos?.por_personal || []).slice(0, 6),
    [data],
  )
  const topTipos = useMemo(
    () => (data?.treinos?.por_tipo || []).slice(0, 4),
    [data],
  )
  const topObjetivos = useMemo(
    () => (data?.objetivos || []).sort((a, b) => b.total - a.total).slice(0, 5),
    [data],
  )
  const rankingTop5 = useMemo(
    () => data?.gamificacao?.ranking_top5 || [],
    [data],
  )

  const hora = new Date().getHours()
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite'

  return (
    <div style={{ padding: '32px 36px', overflowY: 'auto', flex: 1 }}>
      <div className="anim" style={{ marginBottom: 20, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20 }}>
        <div>
          <p style={{ fontSize: 13, color: 'var(--text-3)' }}>{saudacao},</p>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 800 }}>
            {profile?.nome || 'Portal AlimentaAI'}
          </h1>
          <p style={{ marginTop: 4, fontSize: 12, color: 'var(--text-3)' }}>
            Dashboard executivo ({source === 'rpc' ? 'camada SQL consolidada' : 'fallback local'})
          </p>
        </div>
        <select className="input" value={periodDays} onChange={(e) => setPeriodDays(Number(e.target.value))} style={{ width: 180 }}>
          <option value={7}>Período: 7 dias</option>
          <option value={30}>Período: 30 dias</option>
          <option value={90}>Período: 90 dias</option>
        </select>
      </div>

      {loadError && (
        <div style={{
          marginBottom: 16, background: 'rgba(248,113,113,.08)', border: '1px solid rgba(248,113,113,.35)',
          borderRadius: 10, padding: '10px 12px', color: 'var(--red)', fontSize: 12.5, fontWeight: 600,
        }}>
          {loadError}
        </div>
      )}

      <div className="anim-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        <KpiCard label="Alunos na base" value={loading ? '—' : data?.alunos?.total || 0} sub="total de cadastrados" accent="var(--lime)" />
        <KpiCard label="Ativos em 7 dias" value={loading ? '—' : data?.alunos?.ativos_7d || 0} sub={loading ? '' : toPct(data?.alunos?.ativos_7d_percentual)} />
        <KpiCard label="Aderência desafios" value={loading ? '—' : toPct(data?.desafios?.percentual_participacao)} sub={`${data?.desafios?.participantes_periodo || 0} participantes`} accent="var(--blue)" />
        <KpiCard label="Registro refeições" value={loading ? '—' : toPct(data?.refeicoes?.percentual_registro)} sub={`${data?.refeicoes?.participantes_periodo || 0} alunos`} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div style={{
          background: 'var(--bg-2)', border: '1px solid var(--border)',
          borderRadius: 12, overflow: 'hidden',
        }}>
          <div style={{
            padding: '16px 20px', borderBottom: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <p style={{ fontWeight: 600, fontSize: 14 }}>Risco de cancelamento</p>
            <a href="/risco-cancelamento" style={{ fontSize: 12, color: 'var(--lime)' }}>Abrir página →</a>
          </div>
          <div>
            <div style={{ padding: '14px 20px', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
              <div style={{ background: 'rgba(248,113,113,.08)', border: '1px solid rgba(248,113,113,.3)', borderRadius: 10, padding: 12 }}>
                <p style={{ fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase' }}>Alto</p>
                <p style={{ fontSize: 26, fontWeight: 800, color: 'var(--red)' }}>{loading ? '—' : data?.risco_cancelamento?.alto || 0}</p>
              </div>
              <div style={{ background: 'rgba(251,191,36,.08)', border: '1px solid rgba(251,191,36,.3)', borderRadius: 10, padding: 12 }}>
                <p style={{ fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase' }}>Médio</p>
                <p style={{ fontSize: 26, fontWeight: 800, color: 'rgb(251,191,36)' }}>{loading ? '—' : data?.risco_cancelamento?.medio || 0}</p>
              </div>
              <div style={{ background: 'rgba(201,242,77,.08)', border: '1px solid rgba(201,242,77,.3)', borderRadius: 10, padding: 12 }}>
                <p style={{ fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase' }}>Baixo</p>
                <p style={{ fontSize: 26, fontWeight: 800, color: 'var(--lime)' }}>{loading ? '—' : data?.risco_cancelamento?.baixo || 0}</p>
              </div>
              <div style={{ background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 10, padding: 12 }}>
                <p style={{ fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase' }}>Sem atividade</p>
                <p style={{ fontSize: 26, fontWeight: 800 }}>{loading ? '—' : data?.risco_cancelamento?.sem_atividade || 0}</p>
              </div>
            </div>
          </div>
        </div>

        <div style={{
          background: 'var(--bg-2)', border: '1px solid var(--border)',
          borderRadius: 12, overflow: 'hidden',
        }}>
          <div style={{
            padding: '16px 20px', borderBottom: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <p style={{ fontWeight: 600, fontSize: 14 }}>Adesão de treinos</p>
            <span style={{ fontSize: 11, color: 'var(--text-3)' }}>por período</span>
          </div>
          <div>
            <div style={{ padding: '14px 20px' }}>
              <p style={{ fontSize: 13, marginBottom: 8 }}>
                Prescritos: <strong>{loading ? '—' : data?.treinos?.prescritos_periodo || 0}</strong>{' · '}
                Realizados: <strong>{loading ? '—' : data?.treinos?.realizados_periodo || 0}</strong>{' · '}
                Adesão: <strong style={{ color: 'var(--lime)' }}>{loading ? '—' : toPct(data?.treinos?.adesao_percentual)}</strong>
              </p>
            </div>
            <div style={{ borderTop: '1px solid var(--border)' }}>
              <p style={{ padding: '10px 20px', fontSize: 12, color: 'var(--text-3)', textTransform: 'uppercase' }}>Por tipo</p>
              {topTipos.length === 0 && <p style={{ padding: '0 20px 12px', fontSize: 12, color: 'var(--text-3)' }}>Sem dados.</p>}
              {topTipos.map((row, i) => (
                <div key={`${row.tipo}-${i}`} style={{ padding: '8px 20px', display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 13 }}>{row.tipo}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{row.prescritos}</span>
                </div>
              ))}
            </div>
            <div style={{ borderTop: '1px solid var(--border)' }}>
              <p style={{ padding: '10px 20px', fontSize: 12, color: 'var(--text-3)', textTransform: 'uppercase' }}>Por personal</p>
              {topPersonais.length === 0 && <p style={{ padding: '0 20px 12px', fontSize: 12, color: 'var(--text-3)' }}>Sem dados.</p>}
              {topPersonais.map((row, i) => (
                <div key={`${row.personal_id || 'sp'}-${i}`} style={{ padding: '8px 20px', display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 13 }}>{row.personal_nome}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{row.prescritos} prescrições</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginTop: 20 }}>
        <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 12 }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
            <p style={{ fontWeight: 600, fontSize: 14 }}>Desafios</p>
          </div>
          <div style={{ padding: '14px 20px' }}>
            <p style={{ fontSize: 13, marginBottom: 8 }}>
              Desafios ativos: <strong>{loading ? '—' : data?.desafios?.ativos || 0}</strong>
            </p>
            <p style={{ fontSize: 13 }}>
              Participação no período: <strong style={{ color: 'var(--blue)' }}>{loading ? '—' : toPct(data?.desafios?.percentual_participacao)}</strong>
            </p>
          </div>
        </div>

        <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 12 }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
            <p style={{ fontWeight: 600, fontSize: 14 }}>Ranking da gamificação</p>
          </div>
          <div style={{ padding: '8px 20px 14px' }}>
            {rankingTop5.length === 0 && <p style={{ fontSize: 13, color: 'var(--text-3)' }}>Sem dados de ranking.</p>}
            {rankingTop5.map((row, i) => (
              <div key={row.usuario_id || i} style={{ padding: '8px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13 }}>
                  {i + 1}. {row.display_label || 'Aluno'}
                </span>
                <span style={{ fontSize: 12, color: 'var(--lime)', fontWeight: 700 }}>{row.pontos || 0} pts</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ marginTop: 20, background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 12 }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          <p style={{ fontWeight: 600, fontSize: 14 }}>Outros insights</p>
        </div>
        <div style={{ padding: '8px 20px 14px' }}>
          <p style={{ fontSize: 12, color: 'var(--text-3)', textTransform: 'uppercase', margin: '8px 0' }}>Objetivos mais comuns</p>
          {topObjetivos.length === 0 && <p style={{ fontSize: 13, color: 'var(--text-3)' }}>Sem dados de objetivo.</p>}
          {topObjetivos.map((item, i) => (
            <div key={`${item.objetivo}-${i}`} style={{ padding: '6px 0', display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13 }}>{item.objetivo}</span>
              <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{item.total}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

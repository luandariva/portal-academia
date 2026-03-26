import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'

function Card({ title, children, action }) {
  return (
    <div style={{
      background: 'var(--bg-2)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      overflow: 'hidden',
    }}>
      <div style={{
        padding: '14px 18px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 10,
      }}>
        <p style={{ fontWeight: 600, fontSize: 14 }}>{title}</p>
        {action}
      </div>
      <div style={{ padding: 18 }}>
        {children}
      </div>
    </div>
  )
}

function Stat({ label, value, accent }) {
  return (
    <div style={{
      background: 'var(--bg-2)',
      border: '1px solid var(--border)',
      borderRadius: 10,
      padding: '14px 16px',
    }}>
      <p style={{ fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>
        {label}
      </p>
      <p style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 800, color: accent || 'var(--text)' }}>
        {value}
      </p>
    </div>
  )
}

function levelLabel(value) {
  const num = Number(value || 0)
  if (num >= 9) return 'Lenda'
  if (num >= 7) return 'Elite'
  if (num >= 4) return 'Intermediário'
  if (num >= 1) return 'Iniciante'
  return '—'
}

export default function Gamificacao() {
  const [ranking, setRanking] = useState([])
  const [badges, setBadges] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refreshTick, setRefreshTick] = useState(0)

  useEffect(() => {
    let mounted = true

    async function load() {
      setLoading(true)
      setError('')
      try {
        const [{ data: rankingRows, error: rankingError }, { data: badgeRows, error: badgesError }] = await Promise.all([
          supabase.rpc('rpc_gamificacao_leaderboard', { p_limit: 5000 }).select(),
          supabase.from('gamificacao_badges').select('*').order('titulo', { ascending: true }),
        ])

        if (rankingError) throw rankingError
        if (badgesError) throw badgesError

        const safeRanking = Array.isArray(rankingRows) ? rankingRows : []
        const ids = safeRanking.map((r) => r?.usuario_id).filter(Boolean)
        let optInByUser = {}
        if (ids.length > 0) {
          const { data: usersRows, error: usersError } = await supabase
            .from('usuarios')
            .select('id, ranking_opt_in')
            .in('id', ids)
          if (usersError) throw usersError
          optInByUser = Object.fromEntries((usersRows || []).map((u) => [u.id, u.ranking_opt_in]))
        }

        const normalizedRanking = safeRanking.map((row, idx) => {
          const pontos = Number(row?.pontos || 0)
          const nivel = Number(row?.nivel || 0)
          const nome = row?.display_label || row?.display_name || row?.nome || row?.email || 'Aluno'
          const optIn = typeof row?.ranking_opt_in === 'boolean'
            ? row.ranking_opt_in
            : optInByUser[row?.usuario_id]

          return {
            posicao: idx + 1,
            usuario_id: row?.usuario_id || `${idx}`,
            nome,
            pontos,
            nivel,
            ranking_opt_in: Boolean(optIn),
          }
        })

        if (mounted) {
          setRanking(normalizedRanking)
          setBadges(Array.isArray(badgeRows) ? badgeRows : [])
        }
      } catch (err) {
        if (mounted) setError(err?.message || 'Erro ao carregar dados de gamificação.')
      } finally {
        if (mounted) setLoading(false)
      }
    }

    load()
    return () => { mounted = false }
  }, [refreshTick])

  const summary = useMemo(() => {
    const total = ranking.length
    const optOut = ranking.filter((r) => r.ranking_opt_in === false).length
    const totalPoints = ranking.reduce((acc, r) => acc + (Number(r.pontos) || 0), 0)
    return { total, optOut, totalPoints }
  }, [ranking])

  return (
    <div style={{ padding: '28px 34px', overflowY: 'auto', flex: 1 }}>
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 800 }}>
          Gamificação
        </h1>
        <p style={{ marginTop: 4, fontSize: 12.5, color: 'var(--text-3)' }}>
          Ranking completo, status de opt-in e catálogo de badges disponíveis.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 18 }}>
        <Stat label="Usuários no ranking" value={loading ? '—' : summary.total} accent="var(--lime)" />
        <Stat label="Opt-out (opt-in=false)" value={loading ? '—' : summary.optOut} accent="var(--red)" />
        <Stat label="Pontos acumulados" value={loading ? '—' : summary.totalPoints.toLocaleString('pt-BR')} />
      </div>

      {error && (
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
          {error}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 18 }}>
        <Card title="Ranking completo">
          {loading && <p style={{ fontSize: 13, color: 'var(--text-3)' }}>Carregando ranking...</p>}
          {!loading && ranking.length === 0 && <p style={{ fontSize: 13, color: 'var(--text-3)' }}>Nenhum dado de ranking encontrado.</p>}

          {!loading && ranking.length > 0 && (
            <div style={{ maxHeight: 540, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 10 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-3)' }}>
                    {['Posição', 'Usuário', 'Pontos', 'Nível', 'Opt-in'].map((h) => (
                      <th key={h} style={{ textAlign: 'left', padding: '10px 12px', fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.06em' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ranking.map((row) => (
                    <tr key={`${row.usuario_id}-${row.posicao}`} style={{ borderTop: '1px solid var(--border)' }}>
                      <td style={{ padding: '10px 12px', fontSize: 13, fontFamily: 'var(--font-mono)' }}>#{row.posicao}</td>
                      <td style={{ padding: '10px 12px', fontSize: 13 }}>{row.nome}</td>
                      <td style={{ padding: '10px 12px', fontSize: 13, fontWeight: 700, color: 'var(--lime)' }}>{row.pontos}</td>
                      <td style={{ padding: '10px 12px', fontSize: 12.5 }}>{levelLabel(row.nivel)}</td>
                      <td style={{ padding: '10px 12px', fontSize: 12.5 }}>
                        {row.ranking_opt_in ? (
                          <span className="tag tag-green">true</span>
                        ) : (
                          <span className="tag">false</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <Card title={`Badges disponíveis (${badges.length})`} action={(
            <button className="btn btn-ghost" style={{ height: 30, fontSize: 12 }} onClick={() => setRefreshTick((x) => x + 1)}>
              Atualizar
            </button>
          )}>
            {loading && <p style={{ fontSize: 13, color: 'var(--text-3)' }}>Carregando badges...</p>}
            {!loading && badges.length === 0 && <p style={{ fontSize: 13, color: 'var(--text-3)' }}>Nenhum badge cadastrado.</p>}
            {badges.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10, maxHeight: 280, overflowY: 'auto' }}>
                {badges.map((badge) => (
                  <div key={badge.id} style={{
                    background: 'var(--bg-3)',
                    border: '1px solid var(--border)',
                    borderRadius: 10,
                    padding: '10px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                  }}>
                    <span style={{ fontSize: 20 }}>{badge.icone || '🏅'}</span>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {badge.titulo || 'Badge'}
                      </p>
                      {badge.descricao && (
                        <p style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 2 }}>
                          {badge.descricao}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

        </div>
      </div>
    </div>
  )
}

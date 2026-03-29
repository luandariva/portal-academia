import { useEffect, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { fetchGamificacaoResumo } from '../lib/gamificacao'

const SPRING = 'cubic-bezier(.34,1.56,.64,1)'

function RingProgress({ pct, size = 60, stroke = 5, color = 'var(--lime)', children }) {
  const r = (size - stroke * 2) / 2
  const circ = 2 * Math.PI * r
  const offset = circ - (pct / 100) * circ
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={color} strokeWidth={stroke}
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: `stroke-dashoffset .65s ${SPRING}` }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {children}
      </div>
    </div>
  )
}

function DesafioBar({ label, atual, meta, cor, completo }) {
  const pct = completo ? 100 : (meta > 0 ? Math.min(100, Math.round((atual / meta) * 100)) : 0)
  const ok = completo || atual >= meta
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
        <span style={{ color: ok ? 'var(--lime)' : 'var(--text-2)' }}>
          {ok ? '✓ ' : ''}{label}
        </span>
        <span style={{ color: 'var(--text-3)' }}>{completo ? `${meta}/${meta}` : `${atual}/${meta}`}</span>
      </div>
      <div style={{ height: 4, background: 'rgba(255,255,255,0.07)', borderRadius: 999, overflow: 'hidden' }}>
        <div style={{
          width: `${pct}%`, height: '100%', background: ok ? 'var(--lime)' : cor, borderRadius: 999,
          transition: `width .55s ${SPRING}`,
        }} />
      </div>
    </div>
  )
}

/**
 * Widget do Dashboard: pontos da semana (anel), desafio semanal (3 barras) e posição no ranking.
 * Dados via `rpc_gamificacao_resumo`.
 */
export default function GamifWidget({ onVerConquistas }) {
  const { user } = useAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    if (!user?.id) {
      setLoading(false)
      setData(null)
      return () => { alive = false }
    }
    setLoading(true)
    fetchGamificacaoResumo().then(({ data: d }) => {
      if (!alive) return
      if (d?.ok) setData(d)
      else setData(null)
      setLoading(false)
    })
    return () => { alive = false }
  }, [user?.id])

  if (!user?.id) return null

  if (loading) {
    return (
      <div style={{
        borderRadius: 16, border: '1px solid var(--border)',
        background: 'var(--bg-3)', padding: 14, minHeight: 80,
        display: 'flex', alignItems: 'center',
      }}>
        <div style={{
          width: 16, height: 16, border: '2px solid var(--border)',
          borderTopColor: 'var(--lime)', borderRadius: '50%',
          animation: 'spin .7s linear infinite',
        }} />
      </div>
    )
  }

  if (!data) return null

  const desafio = data.desafio
  const prog = desafio?.progresso
  const pontos = data.pontos_semana || 0
  const bonus = data.pontos_bonus_desafio || 0
  const maxSemana = 7 * (10 + 15 + 40) + (desafio?.bonus_pontos || 25)
  const pctSemana = Math.min(100, Math.round((pontos / maxSemana) * 100))
  const desafioOk = prog?.completo

  return (
    <div className="resumo-card anim" style={{ 
      background: 'linear-gradient(145deg, var(--bg-3), var(--bg-4))',
      padding: 16, border: '1px solid var(--border-2)'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <p style={{ fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.05em' }}>
          Progresso da Semana
        </p>
        <button
          type="button"
          onClick={onVerConquistas}
          className="tag"
          style={{ background: 'var(--lime-dim)', color: 'var(--lime)', border: '1px solid var(--lime-border)', fontWeight: 800, cursor: 'pointer' }}
        >
          DETALHES →
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
        <RingProgress pct={pctSemana} size={68} stroke={6} color="var(--lime)">
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 18, fontWeight: 900, color: 'var(--lime)', lineHeight: 1, fontFamily: 'var(--font-display)' }}>{pontos}</p>
            <p style={{ fontSize: 9, color: 'var(--text-3)', fontWeight: 700, textTransform: 'uppercase' }}>pts</p>
          </div>
        </RingProgress>

        <div style={{ flex: 1 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div className="point-card">
              <span className="point-val" style={{ fontSize: 18, color: 'var(--text-2)' }}>{data.pontos_actividade ?? 0}</span>
              <span className="point-lab">ATIVIDADE</span>
            </div>
            <div className="point-card">
              <span className="point-val" style={{ fontSize: 18, color: bonus > 0 ? 'var(--amber)' : 'var(--text-3)' }}>
                {bonus > 0 ? `+${bonus}` : '0'}
              </span>
              <span className="point-lab">BÔNUS</span>
            </div>
          </div>
        </div>
      </div>

      {desafio && prog && (
        <div style={{
          background: desafioOk ? 'var(--lime-dim)' : 'var(--bg-4)',
          borderRadius: 14, padding: '12px',
          border: `1px solid ${desafioOk ? 'var(--lime-border)' : 'var(--border)'}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <p style={{ fontSize: 12, fontWeight: 800, color: desafioOk ? 'var(--lime)' : 'var(--text-2)' }}>
              {desafioOk ? '🏆 DESAFIO CONCLUÍDO!' : (desafio.titulo?.toUpperCase() || 'DESAFIO SEMANAL')}
            </p>
            {!desafioOk && (
              <span className="tag" style={{ background: 'rgba(239,177,68,0.1)', color: 'var(--amber)', border: '1px solid rgba(239,177,68,0.2)' }}>
                +{desafio.bonus_pontos} PTS
              </span>
            )}
          </div>
          <DesafioBar label="Dias ativos" atual={prog.dias_atividade} meta={desafio.min_dias_atividade} cor="var(--blue)" completo={desafioOk} />
          <DesafioBar label="Treinos" atual={prog.treinos_semana} meta={desafio.min_treinos} cor="var(--amber)" completo={desafioOk} />
          <DesafioBar label="Macros" atual={prog.dias_macros} meta={desafio.min_dias_macros} cor="var(--purple)" completo={desafioOk} />
        </div>
      )}

      <div style={{
        marginTop: 12, display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 12px', background: 'rgba(0,0,0,0.2)', borderRadius: 12, border: '1px solid var(--border)'
      }}>
        <span style={{ fontSize: 20 }}>{data.ranking_opt_in ? '🏅' : '👻'}</span>
        {data.ranking_opt_in && data.posicao_ranking > 0 ? (
          <p style={{ fontSize: 12, color: 'var(--text-2)', fontWeight: 500 }}>
            Você está em <span style={{ color: 'var(--lime)', fontWeight: 800 }}>#{data.posicao_ranking}</span> no ranking
          </p>
        ) : (
          <p style={{ fontSize: 11, color: 'var(--text-3)', lineHeight: 1.3 }}>
            Seu ranking está <strong>privado</strong>. Ative no perfil para competir.
          </p>
        )}
      </div>
    </div>
  )
}

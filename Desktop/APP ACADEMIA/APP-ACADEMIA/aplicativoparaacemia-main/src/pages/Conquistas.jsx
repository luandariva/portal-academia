import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchGamificacaoLeaderboard, fetchGamificacaoResumo, fetchUsuarioBadges, setDisplayName, setRankingOptIn } from '../lib/gamificacao'
import { resolveUsuarioDb } from '../lib/usuarioDb'
import { useAuth } from '../hooks/useAuth'
import './Conquistas.css'

function Pill({ children, ativo, onClick, cor }) {
  return (
    <button
      onClick={onClick}
      className={`pill-btn ${ativo ? 'active' : ''}`}
      style={{
        background: ativo ? (cor || 'var(--lime)') : 'var(--bg-3)',
        color: ativo ? '#111' : 'var(--text-2)',
        padding: '10px 16px', borderRadius: 12, border: '1px solid var(--border)',
        fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', transition: 'all .2s'
      }}
    >
      {children}
    </button>
  )
}

function BadgeCard({ ub }) {
  const b = ub?.badge
  const data = ub?.concedido_em
    ? new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(new Date(ub.concedido_em))
    : null
  return (
    <div className="badge-card unlocked">
      <div className="badge-ico">
        {b?.icone || '★'}
      </div>
      <div>
        <p style={{ fontSize: 14, fontWeight: 800 }}>{b?.titulo || 'Conquista'}</p>
        <p style={{ fontSize: 11, color: 'var(--text-3)', lineHeight: 1.4 }}>{b?.descricao || ''}</p>
        {data && <p style={{ fontSize: 10, color: 'var(--lime)', marginTop: 4, fontWeight: 700 }}>Obtido em {data}</p>}
      </div>
    </div>
  )
}

function BadgeLocked({ slug }) {
  const INFO = {
    primeiro_treino: { icone: '🏋️', titulo: 'Primeiro treino', descricao: 'Conclua seu primeiro treino no app.' },
    desafio_semana: { icone: '🏆', titulo: 'Campeão da semana', descricao: 'Complete o desafio semanal (atividade, treinos e macros).' },
    quatro_refeicoes_dia: { icone: '🍽️', titulo: '4 refeições no dia', descricao: 'Registre pelo menos 4 refeições no mesmo dia.' },
  }
  const b = INFO[slug] || { icone: '🔒', titulo: slug, descricao: 'Conquista ainda não obtida.' }
  return (
    <div className="badge-card locked">
      <div className="badge-ico">
        {b.icone}
      </div>
      <div>
        <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-2)' }}>{b.titulo}</p>
        <p style={{ fontSize: 11, color: 'var(--text-3)', lineHeight: 1.4 }}>{b.descricao}</p>
        <p style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 4 }}>Bloqueado</p>
      </div>
    </div>
  )
}

const TABS = [
  { id: 'resumo', label: 'Resumo' },
  { id: 'badges', label: 'Conquistas' },
  { id: 'ranking', label: 'Ranking' },
  { id: 'config', label: 'Config.' },
]

const ALL_BADGE_SLUGS = ['primeiro_treino', 'quatro_refeicoes_dia', 'desafio_semana']

export default function Conquistas({ onVoltar, embeddedInPerfil }) {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState('resumo')
  const [loading, setLoading] = useState(true)
  const [resumo, setResumo] = useState(null)
  const [badges, setBadges] = useState([])
  const [board, setBoard] = useState([])
  const [meuUsuarioId, setMeuUsuarioId] = useState(null)
  const [nomeExibicao, setNomeExibicao] = useState('')
  const [optIn, setOptIn] = useState(true)
  const [msg, setMsg] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  useEffect(() => {
    let alive = true
    async function load() {
      if (!user?.id) { setLoading(false); return }
      setLoading(true)
      const { row, usuarioId } = await resolveUsuarioDb(user)
      if (alive) {
        setMeuUsuarioId(usuarioId)
        setNomeExibicao(row?.display_name || '')
        setOptIn(row?.ranking_opt_in !== false)
      }
      const [r1, r2, r3] = await Promise.all([
        fetchGamificacaoResumo(),
        fetchUsuarioBadges(usuarioId),
        fetchGamificacaoLeaderboard(30),
      ])
      if (alive) {
        if (r1.data?.ok) setResumo(r1.data)
        if (!r2.error) setBadges(r2.data || [])
        if (!r3.error) setBoard(r3.data || [])
        setLoading(false)
      }
    }
    load()
    return () => { alive = false }
  }, [user?.id, user?.email])

  const badgeSlugsObtidos = new Set(badges.map(ub => ub.badge?.slug).filter(Boolean))
  const desafio = resumo?.desafio
  const prog = desafio?.progresso

  const pontosAtividade = resumo?.pontos_actividade || 0
  const pontosBonus = resumo?.pontos_bonus_desafio || 0
  const pontosTotal = resumo?.pontos_semana || 0
  const detalhe = resumo?.detalhe && typeof resumo.detalhe === 'object' ? resumo.detalhe : null
  const diasComResumo = detalhe?.dias_com_resumo

  async function salvarConfig() {
    setSalvando(true)
    setMsg('')
    const [r1, r2] = await Promise.all([
      setDisplayName(nomeExibicao),
      setRankingOptIn(optIn),
    ])
    setSalvando(false)
    if (r1 || r2) setMsg('Erro ao salvar. Tente novamente.')
    else setMsg('Configurações salvas!')
    setTimeout(() => setMsg(''), 3000)
  }

  return (
    <div className={`conq-container ${embeddedInPerfil ? 'embedded' : ''}`}>
      <div className="conq-header" style={{ padding: '0 0 12px', display: 'flex', alignItems: 'center', gap: 12 }}>
        {!embeddedInPerfil && (
          <button
            type="button"
            onClick={() => (onVoltar ? onVoltar() : navigate('/'))}
            className="btn"
            style={{ width: 40, height: 40, padding: 0 }}
          >
            ←
          </button>
        )}
        <div>
          <p style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Gamificação</p>
          <h1 className="conq-title">Conquistas</h1>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, padding: '0 0 14px', overflowX: 'auto', scrollbarWidth: 'none' }}>
        {TABS.map(t => (
          <Pill key={t.id} ativo={tab === t.id} onClick={() => setTab(t.id)}>{t.label}</Pill>
        ))}
      </div>

      <div style={{
        flex: embeddedInPerfil ? 'none' : 1,
        overflowY: embeddedInPerfil ? 'visible' : 'auto',
        minHeight: embeddedInPerfil ? undefined : 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}>
        {loading && (
          <div className="dash-loading anim">
            <div className="spinner" />
          </div>
        )}

        {!loading && tab === 'resumo' && (
          <>
            <div className="card-gradient anim">
              <p style={{ fontSize: 10, color: 'var(--text-3)', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.05em', marginBottom: 12 }}>
                Pontuação da Semana
              </p>
              <div className="points-grid">
                {[
                  { label: 'Atividade', value: pontosAtividade, cor: 'var(--lime)' },
                  { label: 'Bônus', value: pontosBonus > 0 ? `+${pontosBonus}` : '—', cor: '#efb144' },
                  { label: 'Total', value: pontosTotal, cor: 'var(--lime)', active: true },
                ].map(item => (
                  <div key={item.label} className={`point-card ${item.active ? 'active' : ''}`}>
                    <span className="point-val" style={{ color: item.active ? 'var(--lime)' : 'var(--text-2)' }}>{item.value}</span>
                    <span className="point-lab">{item.label}</span>
                  </div>
                ))}
              </div>
              {typeof diasComResumo === 'number' && (
                <div style={{ marginTop: 16, padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: 12, border: '1px solid var(--border)' }}>
                  <p style={{ fontSize: 12, color: 'var(--text-3)', lineHeight: 1.5 }}>
                    <strong style={{ color: 'var(--lime)' }}>{diasComResumo} de 7</strong> dias ativos. Continue assim para completar o desafio!
                  </p>
                </div>
              )}
            </div>

            <div className="resumo-card anim" style={{ border: prog?.completo ? '1px solid var(--lime-border)' : '1px solid var(--border)', background: prog?.completo ? 'var(--lime-dim)' : 'var(--bg-3)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <p style={{ fontSize: 14, fontWeight: 800, color: prog?.completo ? 'var(--lime)' : 'var(--text)' }}>
                  {prog?.completo ? '🏆 DESAFIO CONCLUÍDO!' : (desafio?.titulo || 'DESAFIO SEMANAL')}
                </p>
                {!prog?.completo && desafio && (
                  <span className="tag" style={{ background: 'rgba(239,177,68,0.1)', color: '#efb144', border: '1px solid rgba(239,177,68,0.2)' }}>
                    +{desafio.bonus_pontos} PTS
                  </span>
                )}
              </div>
              {prog && !prog.completo && desafio && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {[
                    { label: 'Dias ativos', atual: prog.dias_atividade, meta: desafio.min_dias_atividade, cor: 'var(--blue)' },
                    { label: 'Treinos', atual: prog.treinos_semana, meta: desafio.min_treinos, cor: 'var(--amber)' },
                    { label: 'Macros no alvo', atual: prog.dias_macros, meta: desafio.min_dias_macros, cor: 'var(--purple)' },
                  ].map(bar => {
                    const pct = bar.meta > 0 ? Math.min(100, Math.round((bar.atual / bar.meta) * 100)) : 0
                    const ok = bar.atual >= bar.meta
                    return (
                      <div key={bar.label}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 6, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                          <span style={{ color: ok ? 'var(--lime)' : 'var(--text-2)' }}>{ok ? '✓ ' : ''}{bar.label}</span>
                          <span style={{ color: 'var(--text-3)' }}>{bar.atual}/{bar.meta}</span>
                        </div>
                        <div style={{ height: 6, background: 'var(--bg-4)', borderRadius: 999, overflow: 'hidden', border: '1px solid var(--border)' }}>
                          <div style={{ width: `${pct}%`, height: '100%', background: ok ? 'var(--lime)' : bar.cor, borderRadius: 999, transition: 'width .8s cubic-bezier(0.16, 1, 0.3, 1)' }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="resumo-card anim" style={{ padding: 12 }}>
              <p style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 800, marginBottom: 8, textTransform: 'uppercase' }}>Sistema de Pontos</p>
              {[
                { acao: 'Registro diário', pts: '+10' },
                { acao: 'Macros no alvo', pts: '+15' },
                { acao: 'Treino concluído', pts: '+20' },
                { acao: 'Desafio semanal', pts: '+25' },
              ].map((item, i, arr) => (
                <div key={item.acao} style={{
                  display: 'flex', justifyContent: 'space-between', padding: '10px 4px',
                  borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none',
                }}>
                  <span style={{ fontSize: 13, color: 'var(--text-2)', fontWeight: 500 }}>{item.acao}</span>
                  <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--lime)' }}>{item.pts} PTS</span>
                </div>
              ))}
            </div>
          </>
        )}

        {!loading && tab === 'badges' && (
          <div className="anim">
            {badges.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <p style={{ fontSize: 11, color: 'var(--lime)', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.05em', marginBottom: 12 }}>
                  Conquistas Obtidas ({badges.length})
                </p>
                <div className="badge-grid">
                  {badges.map(ub => <BadgeCard key={ub.id} ub={ub} />)}
                </div>
              </div>
            )}

            {ALL_BADGE_SLUGS.filter(s => !badgeSlugsObtidos.has(s)).length > 0 && (
              <div>
                <p style={{ fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.05em', marginBottom: 12 }}>
                  Próximos Desafios
                </p>
                <div className="badge-grid">
                  {ALL_BADGE_SLUGS
                    .filter(s => !badgeSlugsObtidos.has(s))
                    .map(slug => <BadgeLocked key={slug} slug={slug} />)}
                </div>
              </div>
            )}
          </div>
        )}

        {!loading && tab === 'ranking' && (
          <div className="anim">
            {!resumo?.ranking_opt_in ? (
              <div className="dash-warning" style={{ flexDirection: 'column', gap: 16, padding: 32, textAlign: 'center' }}>
                <span style={{ fontSize: 40 }}>👻</span>
                <div>
                  <p style={{ fontWeight: 800, fontSize: 16, marginBottom: 4 }}>Perfil Privado</p>
                  <p style={{ fontSize: 13, color: 'var(--text-3)', lineHeight: 1.5 }}>Ative o ranking nas configurações para comparar seu progresso com outros atletas.</p>
                </div>
                <button onClick={() => setTab('config')} className="btn-primary" style={{ padding: '12px 24px' }}>
                  Ativar Ranking
                </button>
              </div>
            ) : (
              <>
                {resumo?.posicao_ranking > 0 && (
                  <div className="resumo-card" style={{ background: 'var(--lime-dim)', borderColor: 'var(--lime-border)', display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
                    <span style={{ fontSize: 32 }}>
                      {resumo.posicao_ranking === 1 ? '🥇' : resumo.posicao_ranking === 2 ? '🥈' : resumo.posicao_ranking === 3 ? '🥉' : '🏅'}
                    </span>
                    <div>
                      <p style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 700, textTransform: 'uppercase' }}>Sua Posição</p>
                      <p style={{ fontSize: 28, fontWeight: 900, fontFamily: 'var(--font-display)', color: 'var(--lime)' }}>
                        #{resumo.posicao_ranking}
                        <span style={{ fontSize: 14, color: 'var(--text-3)', fontWeight: 400 }}> de {resumo.participantes_ranking}</span>
                      </p>
                    </div>
                  </div>
                )}

                <div className="ranking-list">
                  {board.length === 0 ? (
                    <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-3)' }}>Ninguém pontuou ainda.</div>
                  ) : (
                    board.map((row, i) => {
                      const souEu = meuUsuarioId && row.usuario_id === meuUsuarioId
                      return (
                        <div key={row.usuario_id} className={`ranking-item ${souEu ? 'me' : ''}`}>
                          <span className="rank-pos">
                            {row.posicao === 1 ? '🥇' : row.posicao === 2 ? '🥈' : row.posicao === 3 ? '🥉' : `${row.posicao}.`}
                          </span>
                          <div className="rank-avatar">
                            {row.display_label?.slice(0, 1)?.toUpperCase() || '?'}
                          </div>
                          <span className="rank-name">{row.display_label}{souEu ? ' (Você)' : ''}</span>
                          <span className="rank-pts">{row.pontos} PTS</span>
                        </div>
                      )
                    })
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {!loading && tab === 'config' && (
          <div className="anim" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="resumo-card">
              <p style={{ fontSize: 13, fontWeight: 800, marginBottom: 12, textTransform: 'uppercase' }}>Nome de Exibição</p>
              <div className="field">
                <input
                  className="input"
                  value={nomeExibicao}
                  onChange={e => setNomeExibicao(e.target.value)}
                  placeholder="Seu nome no ranking..."
                  maxLength={50}
                />
              </div>
              <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 8 }}>Como você aparecerá para os outros usuários na aba de Ranking.</p>
            </div>

            <div className="resumo-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 13, fontWeight: 800, textTransform: 'uppercase' }}>Visibilidade</p>
                <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>{optIn ? 'Seu perfil está visível no ranking.' : 'Seu perfil está oculto.'}</p>
              </div>
              <button
                onClick={() => setOptIn(v => !v)}
                style={{
                  width: 52, height: 28, borderRadius: 14, position: 'relative',
                  background: optIn ? 'var(--lime)' : 'var(--bg-4)',
                  border: '1px solid var(--border)', transition: 'all .3s ease',
                  cursor: 'pointer'
                }}
              >
                <div style={{
                  position: 'absolute', top: 3, left: optIn ? 26 : 3,
                  width: 20, height: 20, borderRadius: '50%',
                  background: optIn ? '#000' : 'var(--text-3)',
                  transition: 'all .3s cubic-bezier(0.16, 1, 0.3, 1)'
                }} />
              </button>
            </div>

            {msg && (
              <div className={msg.includes('Erro') ? 'dash-warning' : 'tag'} style={{ justifyContent: 'center', padding: 12 }}>
                {msg}
              </div>
            )}

            <button className="btn-primary" onClick={salvarConfig} disabled={salvando} style={{ padding: 16 }}>
              {salvando ? 'Salvando...' : 'Salvar Alterações'}
            </button>

            <button
               className="btn"
               disabled={signingOut}
               onClick={() => {
                 if (signingOut) return
                 setSigningOut(true)
                 void signOut().finally(() => setSigningOut(false))
               }}
               style={{ borderColor: 'rgba(239, 68, 68, 0.4)', color: '#f87171', background: 'rgba(239, 68, 68, 0.05)', marginTop: 8 }}
            >
              {signingOut ? 'Saindo...' : 'Sair da Conta'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { resolveUsuarioDb } from '../lib/usuarioDb'
import ConquistasPage from './Conquistas'
import './Placeholders.css'

function pick(obj, keys, fallback = null) {
  for (const key of keys) {
    if (obj && obj[key] !== undefined && obj[key] !== null) return obj[key]
  }
  return fallback
}

function toNum(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function formatDateTime(value) {
  if (!value) return '--'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function iniciais(str) {
  const s = String(str || '').trim()
  if (!s) return '?'
  return s.slice(0, 1).toUpperCase()
}

export function Nutricao() {
  const { user } = useAuth()
  const [diaSelecionado, setDiaSelecionado] = useState(() => {
    const hoje = new Date()
    hoje.setHours(0, 0, 0, 0)
    return hoje
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [metas, setMetas] = useState(null)
  const [refeicoes, setRefeicoes] = useState([])
  const [refeicaoSelecionada, setRefeicaoSelecionada] = useState(null)

  useEffect(() => {
    let alive = true
    async function carregarDieta() {
      if (!user?.id) {
        if (alive) {
          setLoading(false)
          setError('Usuário não autenticado.')
        }
        return
      }
      setLoading(true)
      setError('')
      try {
        const { usuarioId } = await resolveUsuarioDb(user)
        
        const { data: metasData, error: metasErr } = await supabase
          .from('metas_macros')
          .select('*')
          .eq('usuario_id', usuarioId)
          .order('data_referencia', { ascending: false })
          .limit(1)
          .maybeSingle()
        if (metasErr) throw metasErr

        const inicioDia = new Date(diaSelecionado)
        const fimDia = new Date(inicioDia)
        fimDia.setDate(fimDia.getDate() + 1)
        const { data: refeicoesData, error: refeicoesErr } = await supabase
          .from('refeicoes')
          .select('*')
          .eq('usuario_id', usuarioId)
          .gte('data_hora', inicioDia.toISOString())
          .lt('data_hora', fimDia.toISOString())
          .order('data_hora', { ascending: true })
        if (refeicoesErr) throw refeicoesErr

        if (alive) {
          setMetas(metasData || null)
          setRefeicoes(refeicoesData || [])
        }
      } catch (err) {
        if (alive) setError(err?.message || 'Falha ao carregar dados da dieta.')
      } finally {
        if (alive) setLoading(false)
      }
    }
    carregarDieta()
    return () => { alive = false }
  }, [diaSelecionado, user])

  const { isHoje, podeAvancarDia } = useMemo(() => {
    const hoje = new Date()
    hoje.setHours(0, 0, 0, 0)
    const d = new Date(diaSelecionado)
    d.setHours(0, 0, 0, 0)
    return {
      isHoje: d.getTime() === hoje.getTime(),
      podeAvancarDia: d.getTime() < hoje.getTime(),
    }
  }, [diaSelecionado])

  const diaSelecionadoLabel = useMemo(() => {
    return new Intl.DateTimeFormat('pt-BR', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    }).format(diaSelecionado)
  }, [diaSelecionado])

  const resumo = useMemo(() => {
    const kcalMeta = toNum(pick(metas || {}, ['calorias_kcal', 'kcal_meta', 'meta_kcal', 'kcal_diaria', 'calorias_meta']))
    const proteinaMeta = toNum(pick(metas || {}, ['proteina_meta', 'meta_proteina', 'proteina_g']))
    const carboMeta = toNum(pick(metas || {}, ['carboidrato_meta', 'meta_carboidrato', 'carboidrato_g']))
    const gorduraMeta = toNum(pick(metas || {}, ['gordura_meta', 'meta_gordura', 'gordura_g']))

    const consumidoKcal = refeicoes.reduce((acc, r) => acc + toNum(pick(r, ['kcal', 'calorias', 'calorias_kcal'])), 0)
    const proteinaAtual = refeicoes.reduce((acc, r) => acc + toNum(pick(r, ['proteina_g', 'proteina', 'proteinas_g'])), 0)
    const carboAtual = refeicoes.reduce((acc, r) => acc + toNum(pick(r, ['carboidrato_g', 'carboidrato', 'carbo_g'])), 0)
    const gorduraAtual = refeicoes.reduce((acc, r) => acc + toNum(pick(r, ['gordura_g', 'gordura', 'lipideos_g'])), 0)

    return {
      kcalMeta,
      consumidoKcal,
      saldoKcal: Math.max(kcalMeta - consumidoKcal, 0),
      proteinaMeta,
      proteinaAtual,
      carboMeta,
      carboAtual,
      gorduraMeta,
      gorduraAtual,
    }
  }, [metas, refeicoes])

  const refeicoesUI = useMemo(() => {
    return refeicoes.map((r, index) => {
      const nome = pick(r, ['nome', 'refeicao', 'tipo_refeicao'], 'Refeição')
      const kcal = toNum(pick(r, ['kcal', 'calorias', 'calorias_kcal']))
      const statusRaw = String(pick(r, ['status', 'situacao'], 'registrada')).toLowerCase()
      const status = statusRaw.includes('pend') ? 'Pendente' : 'Registrada'
      return {
        id: pick(r, ['id'], `${nome}-${index}`),
        nome,
        kcalNum: kcal,
        kcal: `${kcal} kcal`,
        status,
        horario: pick(r, ['data_hora', 'horario', 'created_at']),
        proteina: toNum(pick(r, ['proteina_g', 'proteina', 'proteinas_g'])),
        carboidrato: toNum(pick(r, ['carboidrato_g', 'carboidrato', 'carbo_g'])),
        gordura: toNum(pick(r, ['gordura_g', 'gordura', 'lipideos_g'])),
        observacoes: pick(r, ['observacoes', 'observacao', 'descricao'], ''),
      }
    })
  }, [refeicoes])

  return (
    <div className="place-container anim">
      <div className="place-header" style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
        <button
          onClick={() => {
            const next = new Date(diaSelecionado)
            next.setDate(next.getDate() - 1)
            setDiaSelecionado(next)
          }}
          className="btn"
          style={{ width: 40, height: 40, padding: 0 }}
        >
          ←
        </button>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <span className="tag" style={{ background: 'var(--bg-3)', color: 'var(--lime)', fontSize: 13, padding: '10px 20px', borderRadius: 14 }}>
            {diaSelecionadoLabel}
          </span>
        </div>
        <button
          disabled={!podeAvancarDia}
          onClick={() => {
            const next = new Date(diaSelecionado)
            next.setDate(next.getDate() + 1)
            setDiaSelecionado(next)
          }}
          className="btn"
          style={{ width: 40, height: 40, padding: 0 }}
        >
          →
        </button>
      </div>

      <div className="place-header">
        <p style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Dieta</p>
        <h1 className="place-title" style={{ margin: 0 }}>Nutrição</h1>
      </div>

      {loading && (
        <div className="dash-loading anim">
          <div className="spinner" />
        </div>
      )}

      {!loading && error && (
        <div className="dash-warning anim">
          {error}
        </div>
      )}

      <div className="card-gradient anim">
        <p style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 800, textTransform: 'uppercase', marginBottom: 12 }}>
          {isHoje ? 'RESUMO DE HOJE' : 'RESUMO DO DIA'}
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {[
            { label: 'META', value: resumo.kcalMeta || '—', color: '#fff' },
            { label: 'CALORIAS', value: resumo.consumidoKcal, color: 'var(--lime)' },
            { label: 'PROTEÍNA', value: `${resumo.proteinaAtual}g`, color: 'var(--blue)' },
            { label: 'SALDO', value: resumo.saldoKcal, color: 'var(--amber)' },
          ].map(item => (
            <div key={item.label} className="point-card">
              <span className="point-val" style={{ color: item.color }}>{item.value}</span>
              <span className="point-lab">{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="resumo-card anim">
        <h2 style={{ fontSize: 18, fontWeight: 900, marginBottom: 16, fontFamily: 'var(--font-display)' }}>MACRO NUTRIENTES</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {[
            { nome: 'Proteína', atual: resumo.proteinaAtual, meta: resumo.proteinaMeta, cor: 'var(--blue)' },
            { nome: 'Carboidrato', atual: resumo.carboAtual, meta: resumo.carboMeta, cor: 'var(--amber)' },
            { nome: 'Gordura', atual: resumo.gorduraAtual, meta: resumo.gorduraMeta, cor: 'var(--purple)' },
          ].map(m => {
            const pct = m.meta > 0 ? Math.min(100, Math.round((m.atual / m.meta) * 100)) : 0
            return (
              <div key={m.nome}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 800, marginBottom: 6, textTransform: 'uppercase' }}>
                  <span style={{ color: 'var(--text-2)' }}>{m.nome}</span>
                  <span style={{ color: 'var(--text-3)' }}>{m.atual}{m.meta > 0 ? ` / ${m.meta}g` : 'g'}</span>
                </div>
                <div className="macro-bar-container">
                  <div className="macro-bar-fill" style={{ width: `${pct}%`, background: m.cor }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="resumo-card anim" style={{ padding: '4px 16px' }}>
        <h2 style={{ fontSize: 18, fontWeight: 900, padding: '16px 0 8px', fontFamily: 'var(--font-display)' }}>REFEIÇÕES</h2>
        {refeicoesUI.length === 0 ? (
          <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>
            Nenhuma refeição registrada {isHoje ? 'hoje' : 'neste dia'}.
          </div>
        ) : (
          refeicoesUI.map((r) => (
            <button key={r.id} onClick={() => setRefeicaoSelecionada(r)} className="ref-item">
              <div className="ref-info">
                <h4>{r.nome}</h4>
                <p>{r.kcal}</p>
              </div>
              <span className="tag" style={{ 
                background: r.status === 'Registrada' ? 'var(--lime-dim)' : 'var(--bg-4)', 
                color: r.status === 'Registrada' ? 'var(--lime)' : 'var(--text-3)',
                borderColor: r.status === 'Registrada' ? 'var(--lime-border)' : 'var(--border)'
              }}>
                {r.status.toUpperCase()}
              </span>
            </button>
          ))
        )}
      </div>

      {refeicaoSelecionada && (
        <div className="modal-overlay" onClick={() => setRefeicaoSelecionada(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontSize: 20, fontWeight: 900, fontFamily: 'var(--font-display)', margin: 0 }}>{refeicaoSelecionada.nome}</h3>
              <button onClick={() => setRefeicaoSelecionada(null)} className="btn" style={{ padding: '6px 14px', fontSize: 12 }}>FECHAR</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {[
                { label: 'Calorias', value: `${refeicaoSelecionada.kcalNum} kcal` },
                { label: 'Status', value: refeicaoSelecionada.status },
                { label: 'Proteína', value: `${refeicaoSelecionada.proteina}g` },
                { label: 'Carbo', value: `${refeicaoSelecionada.carboidrato}g` },
                { label: 'Gordura', value: `${refeicaoSelecionada.gordura}g` },
                { label: 'Horário', value: formatDateTime(refeicaoSelecionada.horario) },
              ].map(item => (
                <div key={item.label} className="point-card" style={{ textAlign: 'left', padding: '12px' }}>
                  <span className="point-lab">{item.label}</span>
                  <span style={{ fontSize: 15, fontWeight: 700, display: 'block', marginTop: 2 }}>{item.value}</span>
                </div>
              ))}
            </div>
            {refeicaoSelecionada.observacoes && (
              <div className="resumo-card" style={{ marginTop: 12, background: 'rgba(0,0,0,0.1)' }}>
                <p className="point-lab" style={{ marginBottom: 4 }}>OBSERVAÇÕES</p>
                <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.5 }}>{refeicaoSelecionada.observacoes}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export function Perfil() {
  const { user } = useAuth()
  const [row, setRow] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    async function load() {
      if (!user?.id) {
        setLoading(false)
        return
      }
      setLoading(true)
      const { row: urow } = await resolveUsuarioDb(user)
      if (!alive) return
      setRow(urow)
      setLoading(false)
    }
    load()
    return () => { alive = false }
  }, [user])

  const nomeMostrado = (pick(row || {}, ['display_name'], '') || '').trim()
    || user?.email?.split('@')[0]
    || 'Aluno'

  return (
    <div className="place-container anim">
      <div className="place-header">
        <p style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Atleta</p>
        <h1 className="place-title" style={{ margin: 0 }}>Meu Perfil</h1>
      </div>

      <div className="profile-card anim">
        <div className="profile-avatar">{iniciais(nomeMostrado)}</div>
        <div className="profile-info">
          <h2>{nomeMostrado}</h2>
          <p>{loading ? 'Carregando...' : (user?.email || '—')}</p>
        </div>
      </div>

      <div className="anim">
        <ConquistasPage embeddedInPerfil />
      </div>
    </div>
  )
}

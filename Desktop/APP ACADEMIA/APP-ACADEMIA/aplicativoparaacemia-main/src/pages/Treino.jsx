import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { fetchGamificacaoResumo, fetchUsuarioBadges } from '../lib/gamificacao'
import { BadgeToast, PontosToast } from '../components/GamifToasts'
import { resolveUsuarioDb } from '../lib/usuarioDb'
import './Treino.css'

const CATEGORIAS = [
  { id: 'all', label: 'Todos os treinos' },
  { id: 'chest', label: 'Peito' },
  { id: 'upper', label: 'Membros superiores' },
  { id: 'legs', label: 'Pernas' },
]

const THUMB_PERSONALIZADO = 'https://images.unsplash.com/photo-1517964603305-11c0f6f66012?auto=format&fit=crop&w=900&q=60'

/** Resposta RPC pode vir como array, objeto único ou null */
function normalizarLinhasRpc(data) {
  if (data == null) return []
  if (Array.isArray(data)) return data
  if (typeof data === 'object') return [data]
  return []
}

/** Capas por tipo de treino (Unsplash) */
const THUMB_POR_CATEGORIA = {
  chest: 'https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?auto=format&fit=crop&w=900&q=60',
  upper: 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=900&q=60',
  legs: 'https://images.unsplash.com/photo-1574680178050-55c6a6a96e0a?auto=format&fit=crop&w=900&q=60',
}

const CATEGORIA_SLUGS = new Set(['chest', 'upper', 'legs'])
const YOUTUBE_ID_RE = /^[\w-]{11}$/

/** URL segura para gravar em `exercicios[].video_url` (somente http/https). */
function sanitizeVideoUrl(raw) {
  const s = String(raw || '').trim()
  if (!s) return null
  try {
    const u = new URL(s.includes('://') ? s : `https://${s}`)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    return u.href
  } catch {
    return null
  }
}

/**
 * YouTube, Vimeo, arquivo direto (.mp4/.webm/.ogg) ou link genérico (abre em nova aba).
 * @returns {{ kind: 'iframe', src: string } | { kind: 'video', src: string } | { kind: 'link', href: string } | null}
 */
function parseVideoEmbed(raw) {
  const trimmed = String(raw || '').trim()
  if (!trimmed) return null
  let href
  try {
    href = new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`)
  } catch {
    return null
  }
  if (href.protocol !== 'http:' && href.protocol !== 'https:') return null

  const host = href.hostname.replace(/^www\./, '').toLowerCase()

  if (host === 'youtube.com' || host === 'm.youtube.com') {
    const v = href.searchParams.get('v')
    if (v && YOUTUBE_ID_RE.test(v)) {
      return { kind: 'iframe', src: `https://www.youtube-nocookie.com/embed/${encodeURIComponent(v)}?rel=0` }
    }
    const shorts = href.pathname.match(/\/shorts\/([\w-]{11})/)
    if (shorts?.[1] && YOUTUBE_ID_RE.test(shorts[1])) {
      return { kind: 'iframe', src: `https://www.youtube-nocookie.com/embed/${encodeURIComponent(shorts[1])}?rel=0` }
    }
    const emb = href.pathname.match(/^\/embed\/([\w-]{11})/)
    if (emb?.[1] && YOUTUBE_ID_RE.test(emb[1])) {
      return { kind: 'iframe', src: `https://www.youtube-nocookie.com/embed/${encodeURIComponent(emb[1])}?rel=0` }
    }
    return null
  }
  if (host === 'youtu.be') {
    const id = href.pathname.replace(/^\//, '').split('/')[0]
    if (id && YOUTUBE_ID_RE.test(id)) {
      return { kind: 'iframe', src: `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?rel=0` }
    }
    return null
  }

  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    const parts = href.pathname.split('/').filter(Boolean)
    const vid = parts[0] === 'video' ? parts[1] : parts[parts.length - 1]
    if (vid && /^\d+$/.test(vid)) return { kind: 'iframe', src: `https://player.vimeo.com/video/${vid}` }
    return null
  }

  const pathLower = href.pathname.toLowerCase()
  if (/\.(mp4|webm|ogg)(\?|#|$)/i.test(pathLower)) return { kind: 'video', src: href.href }

  return { kind: 'link', href: href.href }
}

function ExercicioVideoDemo({ url }) {
  const parsed = parseVideoEmbed(url)
  if (!parsed) return null

  const wrap = {
    position: 'relative',
    width: '100%',
    borderRadius: 12,
    overflow: 'hidden',
    background: '#0a0a0a',
    aspectRatio: '16 / 9',
    marginBottom: 12,
  }

  if (parsed.kind === 'iframe') {
    return (
      <div style={wrap}>
        <iframe
          title="Demonstracao do exercicio"
          src={parsed.src}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>
    )
  }
  if (parsed.kind === 'video') {
    return (
      <div style={wrap}>
        <video
          src={parsed.src}
          controls
          playsInline
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain' }}
        >
          Video nao suportado neste navegador.
        </video>
      </div>
    )
  }
  return (
    <a
      href={parsed.href}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: 'block',
        marginBottom: 12,
        padding: '12px 14px',
        borderRadius: 12,
        background: 'var(--bg-4)',
        border: '1px solid var(--border)',
        color: 'var(--lime)',
        fontWeight: 700,
        fontSize: 13,
        textAlign: 'center',
        textDecoration: 'none',
      }}
    >
      Abrir video do exercicio
    </a>
  )
}

function normalizeCategoriaSlug(value) {
  if (value == null || typeof value !== 'string') return ''
  const v = value.trim().toLowerCase()
  return CATEGORIA_SLUGS.has(v) ? v : ''
}

/** Fallback quando a coluna categoria no banco estiver vazia */
function inferCategoriaFromNome(nome) {
  const n = String(nome || '').toLowerCase()
  if (n.includes('peito') || n.includes('tricep') || n.includes('trícep')) return 'chest'
  if (n.includes('perna') || n.includes('agach') || n.includes('leg press') || n.includes('panturrilh') || n.includes('extensora') || n.includes('coxa')) return 'legs'
  if (n.includes('costa') || n.includes('bicep') || n.includes('bícep') || n.includes('puxada') || n.includes('remada') || n.includes('ombro')) return 'upper'
  return ''
}

function isPlanoUuid(id) {
  return typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)
}

/** jsonb pode vir como array ou string; evita lista vazia silenciosa */
function parseExerciciosColumn(raw) {
  if (Array.isArray(raw)) return raw
  if (typeof raw === 'string') {
    try {
      const p = JSON.parse(raw)
      return Array.isArray(p) ? p : []
    } catch {
      return []
    }
  }
  return []
}

/** Remove entradas repetidas no JSON (mesmo id ou mesma assinatura sem id) */
function dedupeExerciciosJson(list) {
  const seen = new Set()
  const out = []
  for (const ex of list) {
    if (!ex || typeof ex !== 'object') continue
    const key = ex.id != null && String(ex.id).trim() !== ''
      ? `id:${String(ex.id)}`
      : `f:${String(ex.nome || '').trim()}|${Number(ex.series)}|${Number(ex.repeticoes)}|${Number(ex.carga)}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(ex)
  }
  return out
}

/**
 * Várias linhas iguais em treinos_plano (mesmo aluno + treino) viram cards duplicados.
 * Mantém a mais recente (created_at) e preserva ordenação por data_prevista.
 */
function dedupePlanosRows(rows) {
  if (!rows?.length) return []
  const sortedNewestFirst = [...rows].sort((a, b) => {
    const ta = new Date(a.created_at || 0).getTime()
    const tb = new Date(b.created_at || 0).getTime()
    return tb - ta
  })
  const seen = new Set()
  const kept = []
  for (const row of sortedNewestFirst) {
    const raw = parseExerciciosColumn(row.exercicios)
    const exKey = JSON.stringify(dedupeExerciciosJson(raw))
    const key = `${String(row.nome || '').trim()}|${row.data_prevista || ''}|${exKey}`
    if (seen.has(key)) continue
    seen.add(key)
    kept.push(row)
  }
  kept.sort((a, b) => {
    const da = String(a.data_prevista || '')
    const db = String(b.data_prevista || '')
    if (da !== db) return da.localeCompare(db)
    return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
  })
  return kept
}

/** Unifica linhas do catálogo (RPC + REST); a segunda lista só preenche ids em falta na primeira. */
function mergeCatalogoPlanoRows(primary, secondary) {
  const map = new Map()
  for (const row of secondary || []) {
    if (row?.id != null) map.set(String(row.id), row)
  }
  for (const row of primary || []) {
    if (row?.id != null) map.set(String(row.id), row)
  }
  return [...map.values()]
}

function mapPlanoRowToTreino(row, options = {}) {
  const { personalizado: personalizadoOpt, categoria: categoriaOpt } = options
  const personalizado = personalizadoOpt !== undefined
    ? personalizadoOpt
    : Boolean(row.criado_pelo_aluno)
  const categoriaSlug =
    normalizeCategoriaSlug(row.categoria) ||
    (categoriaOpt !== undefined ? normalizeCategoriaSlug(categoriaOpt) : '') ||
    inferCategoriaFromNome(row.nome)
  const list = dedupeExerciciosJson(parseExerciciosColumn(row.exercicios))
  const exercicios = list.map((ex, idx) => ({
    id: ex.id != null ? String(ex.id) : `${row.id}-ex-${idx + 1}`,
    nome: String(ex.nome || ''),
    series: Math.max(1, Number(ex.series) || 1),
    repeticoes: Math.max(0, Number(ex.repeticoes) || 0),
    carga: Math.max(0, Number(ex.carga) || 0),
    met: Number(ex.met) || 0,
    video_url: ex.video_url ?? null,
  }))
  const personalNome = row.personais?.nome != null && String(row.personais.nome).trim() !== ''
    ? String(row.personais.nome).trim()
    : null
  const isCatalogo = Boolean(row.catalogo)
  const personalLabel = personalizado
    ? 'Treino personalizado'
    : isCatalogo
      ? (personalNome ? `${personalNome} · Academia` : 'Academia')
      : (personalNome || 'Plano')
  return {
    id: row.id,
    nome: row.nome || 'Treino',
    categoria: categoriaSlug,
    thumb: THUMB_POR_CATEGORIA[categoriaSlug] || THUMB_PERSONALIZADO,
    personal: personalLabel,
    exercicios,
    fromDb: true,
    personalizado,
    catalogo: isCatalogo,
  }
}

function treinoIcone(categoria) {
  if (categoria === 'chest') return '💪'
  if (categoria === 'upper') return '🏋️'
  if (categoria === 'legs') return '🦵'
  return '🔥'
}

function labelCategoria(categoria) {
  if (categoria === 'chest') return 'Peito'
  if (categoria === 'upper') return 'Membros superiores'
  if (categoria === 'legs') return 'Pernas'
  return 'Treino'
}

/**
 * Ícones alinhados ao tipo de treino: pilha (todos), supino (peito), bíceps (MS), agachamento (pernas).
 * Acessível via aria-label no botão.
 */
function IconFiltroCategoria({ id }) {
  const common = {
    width: 22,
    height: 22,
    viewBox: '0 0 24 24',
    fill: 'none',
    xmlns: 'http://www.w3.org/2000/svg',
    'aria-hidden': true,
  }
  const stroke = 'currentColor'
  const sw = 1.75
  if (id === 'all') {
    return (
      <svg {...common} stroke={stroke} strokeWidth={sw} strokeLinejoin="round" strokeLinecap="round">
        {/* Pilha de fichas de treino (lista completa) */}
        <rect x="5" y="3" width="14" height="5" rx="1.25" fill={stroke} fillOpacity={0.14} />
        <rect x="4.5" y="6.5" width="15" height="5.5" rx="1.25" fill={stroke} fillOpacity={0.22} />
        <rect x="4" y="10.5" width="16" height="7" rx="1.5" fill={stroke} fillOpacity={0.06} />
        <line x1="7" y1="13" x2="14" y2="13" />
        <line x1="7" y1="15.5" x2="12" y2="15.5" />
      </svg>
    )
  }
  if (id === 'chest') {
    return (
      <svg {...common} stroke={stroke} strokeWidth={sw} strokeLinejoin="round" strokeLinecap="round">
        {/* Supino: corpo deitado + barra sobre o peito */}
        <line x1="2" y1="18" x2="22" y2="18" />
        <circle cx="7.5" cy="13" r="2.25" />
        <path d="M9.5 13.5 L15 14.5 L17.5 16" />
        <line x1="3.5" y1="10.5" x2="20.5" y2="10.5" />
        <rect x="1" y="8.75" width="2.75" height="3.5" rx="0.6" />
        <rect x="20.25" y="8.75" width="2.75" height="3.5" rx="0.6" />
      </svg>
    )
  }
  if (id === 'upper') {
    return (
      <svg {...common} stroke={stroke} strokeWidth={sw} strokeLinejoin="round" strokeLinecap="round">
        {/* Braço em flexão de bíceps — braços, costas, ombros */}
        <circle cx="17.5" cy="4.5" r="1.35" />
        <path d="M17.5 5.6 L16.2 12.2 L9.5 7.2" />
        <path d="M9.5 7.2 L10.8 4.8" />
      </svg>
    )
  }
  if (id === 'legs') {
    return (
      <svg {...common} stroke={stroke} strokeWidth={sw} strokeLinejoin="round" strokeLinecap="round">
        {/* Agachamento: tronco, coxas e joelhos a ~90° */}
        <circle cx="12" cy="5.5" r="2" />
        <path d="M12 7.5 L12 10" />
        <path d="M12 10 L8.2 15.2 L7 20.5" />
        <path d="M12 10 L15.8 15.2 L17 20.5" />
        <path d="M5.8 20.5 h3.6 M14.6 20.5 h3.6" />
      </svg>
    )
  }
  return null
}

function resetExercicios(exercicios) {
  return exercicios.map(ex => ({ ...ex, concluido: false, series_feitas: [] }))
}

function novoExercicioBuilder() {
  return {
    id: `bex-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    nome: '',
    series: '3',
    repeticoes: '12',
    carga: '',
    video_url: '',
  }
}

function SerieButton({ numero, feita, onClick }) {
  return (
    <button onClick={onClick} className={`serie-btn ${feita ? 'feita' : ''}`} style={{
      width: 40, height: 40, borderRadius: '50%',
      background: feita ? 'var(--lime)' : 'var(--bg-4)',
      border: `1px solid ${feita ? 'transparent' : 'var(--border)'}`,
      color: feita ? '#121212' : 'var(--text-3)',
      fontSize: 13, fontWeight: 700, display: 'flex',
      alignItems: 'center', justifyContent: 'center', transition: 'all .2s',
    }}>
      {feita ? '✓' : numero}
    </button>
  )
}

function ExercicioCard({ ex, index, onToggleSerie, onToggleConcluido, expandido, onExpand }) {
  const totalFeitas = ex.series_feitas.length
  const progresso = ex.series > 0 ? (totalFeitas / ex.series) * 100 : 0

  return (
    <div style={{
      background: ex.concluido ? 'rgba(201,242,77,0.09)' : 'var(--bg-3)',
      border: `1px solid ${ex.concluido ? 'var(--border-2)' : 'var(--border)'}`,
      borderRadius: 16, overflow: 'hidden', transition: 'all .25s',
      flexShrink: 0,
      animation: `fadeUp .3s ease ${index * 0.06}s both`,
    }}>
      <button
        onClick={() => onExpand(ex.id)}
        style={{
          width: '100%', background: 'none', color: 'inherit', border: 'none',
          padding: 14, display: 'flex', alignItems: 'center', gap: 12,
        }}
      >
        <div style={{
          width: 36, height: 36, borderRadius: 10, flexShrink: 0,
          background: ex.concluido ? 'var(--lime)' : 'var(--bg-4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: ex.concluido ? '#111' : 'var(--text-2)', fontWeight: 700,
        }}>
          {ex.concluido ? '✓' : index + 1}
        </div>
        <div style={{ textAlign: 'left', flex: 1, minWidth: 0 }}>
          <p style={{
            fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16,
            color: ex.concluido ? 'var(--text-2)' : 'var(--text)',
            textDecoration: ex.concluido ? 'line-through' : 'none',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {ex.nome}
          </p>
          <p style={{ color: 'var(--text-3)', fontSize: 12 }}>
            {ex.series}x{ex.repeticoes > 0 ? ex.repeticoes : 'falha'} {ex.carga > 0 ? `• ${ex.carga}kg` : ''} • {totalFeitas}/{ex.series}
          </p>
        </div>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-3)', flexShrink: 0 }}>
          {ex.video_url ? (
            <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--lime)' }} title="Tem video">▶</span>
          ) : null}
          <span>{expandido ? '▴' : '▾'}</span>
        </span>
      </button>

      <div style={{ height: 3, background: 'rgba(255,255,255,0.06)', margin: '0 14px' }}>
        <div style={{ height: '100%', width: `${progresso}%`, background: 'var(--lime)', transition: 'width .3s ease' }} />
      </div>

      {expandido && (
        <div style={{ padding: 14 }}>
          {ex.video_url ? (
            <>
              <p style={{ fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: 8 }}>Como fazer</p>
              <ExercicioVideoDemo url={ex.video_url} />
              {!parseVideoEmbed(ex.video_url) ? (
                <p style={{ fontSize: 12, color: '#ff7676', marginBottom: 12 }}>
                  {sanitizeVideoUrl(ex.video_url)
                    ? 'Link nao reconhecido. Use YouTube, Vimeo ou URL direta .mp4 / .webm.'
                    : 'URL do video invalida.'}
                </p>
              ) : null}
            </>
          ) : null}
          <p style={{ fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: 8 }}>Series</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            {Array.from({ length: ex.series }).map((_, i) => (
              <SerieButton
                key={i}
                numero={i + 1}
                feita={ex.series_feitas.includes(i)}
                onClick={() => onToggleSerie(ex.id, i)}
              />
            ))}
          </div>
          <button
            onClick={() => onToggleConcluido(ex.id)}
            style={{
              width: '100%', padding: '12px', borderRadius: 12, fontWeight: 700,
              background: ex.concluido ? 'var(--bg-4)' : 'var(--lime)',
              color: ex.concluido ? 'var(--text-2)' : '#111',
              border: `1px solid ${ex.concluido ? 'var(--border)' : 'transparent'}`,
            }}
          >
            {ex.concluido ? 'Desmarcar' : 'Marcar como feito'}
          </button>
        </div>
      )}
    </div>
  )
}

export default function Treino() {
  const { user } = useAuth()
  const [usuarioDbId, setUsuarioDbId] = useState(null)
  const [treinosPlano, setTreinosPlano] = useState([])
  const [listaLoading, setListaLoading] = useState(true)
  const [listaError, setListaError] = useState('')
  const [listaAviso, setListaAviso] = useState('')
  const [treinoSelecionadoId, setTreinoSelecionadoId] = useState(null)
  const [filtroCategoria, setFiltroCategoria] = useState('all')
  const [filtroPersonal, setFiltroPersonal] = useState('todos')
  const [busca, setBusca] = useState('')
  const [treino, setTreino] = useState({ id: null, nome: '', categoria: '', personal: '', thumb: '', exercicios: [] })
  const [builderNome, setBuilderNome] = useState('')
  const [builderCategoria, setBuilderCategoria] = useState('chest')
  const [builderExercicios, setBuilderExercicios] = useState([novoExercicioBuilder()])
  const [builderMensagem, setBuilderMensagem] = useState({ tipo: '', texto: '' })
  const [builderExpandido, setBuilderExpandido] = useState(false)
  const [builderSalvando, setBuilderSalvando] = useState(false)
  const [expandido, setExpandido] = useState(null)
  const [concluindo, setConcluindo] = useState(false)
  const [concluido, setConcluido] = useState(false)
  const [toastBadge, setToastBadge] = useState(null)
  const [toastPontos, setToastPontos] = useState(null)
  const scrollRef = useRef(null)
  const todosTreinos = treinosPlano
  const personais = ['todos', ...Array.from(new Set(todosTreinos.map((t) => t.personal)))]

  useEffect(() => {
    let alive = true

    async function carregarTreinos() {
      if (!user?.id) {
        if (alive) {
          setListaLoading(false)
          setListaError('Usuario nao autenticado.')
        }
        return
      }

      setListaLoading(true)
      setListaError('')
      setListaAviso('')

      try {
        const { usuarioId } = await resolveUsuarioDb(user)
        if (alive) setUsuarioDbId(usuarioId)

        const planoSelect =
          'id, nome, personal_id, data_prevista, exercicios, criado_pelo_aluno, categoria, created_at, catalogo, personais(nome)'

        let planos = []
        if (usuarioId) {
          const { data, error: planosErr } = await supabase
            .from('treinos_plano')
            .select(planoSelect)
            .eq('usuario_id', usuarioId)
            .order('data_prevista', { ascending: true })
            .order('created_at', { ascending: false })
          if (planosErr) throw planosErr
          planos = data || []
        }

        /** Catálogo: RPC (DEFINER) e REST com política treinos_plano_select_catalogo_aluno (se existir). */
        const rpcCatalogo = await supabase.rpc('treinos_catalogo_para_aluno')
        const rpcAcad = await supabase.rpc('aluno_academia_ids')
        const fromRpc = !rpcCatalogo.error ? normalizarLinhasRpc(rpcCatalogo.data) : []

        if (import.meta.env.DEV) {
          if (rpcCatalogo.error) {
            console.warn('[Treino] treinos_catalogo_para_aluno:', rpcCatalogo.error.message)
          }
          if (rpcAcad.error) {
            console.warn('[Treino] aluno_academia_ids:', rpcAcad.error.message)
          }
        }

        let academiaIds = [
          ...new Set(
            normalizarLinhasRpc(rpcAcad.data)
              .map((row) => (row && typeof row === 'object' ? row.academia_id : row))
              .filter(Boolean),
          ),
        ]

        /** Se a RPC devolveu vazio, tenta o mesmo vínculo via REST (RLS alunos_academia). */
        if (academiaIds.length === 0) {
          const { data: alRows, error: alErr } = await supabase
            .from('alunos_academia')
            .select('academia_id')
            .eq('status', 'ativo')
          if (import.meta.env.DEV && alErr) {
            console.warn('[Treino] alunos_academia (fallback):', alErr.message)
          }
          if (!alErr && alRows?.length) {
            academiaIds = [
              ...new Set(alRows.map((r) => r.academia_id).filter(Boolean)),
            ]
          }
        }

        let fromRest = []
        let catErr = null
        if (academiaIds.length > 0) {
          const res = await supabase
            .from('treinos_plano')
            .select(planoSelect)
            .eq('catalogo', true)
            .in('academia_id', academiaIds)
            .order('data_prevista', { ascending: true })
            .order('created_at', { ascending: false })
          catErr = res.error
          if (!res.error && res.data?.length) fromRest = res.data
          if (import.meta.env.DEV && res.error) {
            console.warn('[Treino] GET treinos_plano catalogo:', res.error.message)
          }
        }

        const catalogoRows = mergeCatalogoPlanoRows(fromRpc, fromRest)

        if (alive) {
          const merged = [...planos, ...catalogoRows]
          const lista = dedupePlanosRows(merged).map((row) => mapPlanoRowToTreino(row))
          setTreinosPlano(lista)

          if (lista.length === 0) {
            const partes = []
            if (!usuarioId) {
              partes.push(
                'Nao ha perfil em usuarios ligado a esta conta. Treinos prescritos ao seu nome nao aparecem; treinos gerais exigem utilizador vinculado em alunos_academia. Contacte a academia ou suporte.',
              )
            }
            if (rpcCatalogo.error) {
              partes.push(`Catálogo (RPC): ${rpcCatalogo.error.message}`)
            }
            if (rpcAcad.error) {
              partes.push(`Academias (RPC): ${rpcAcad.error.message}`)
            } else if (usuarioId && academiaIds.length === 0 && fromRpc.length === 0) {
              partes.push(
                'Sem vinculo em alunos_academia para esta sessao (ou status diferente de ativo). Peça à academia para o vincular no portal ou confirme que o e-mail em usuarios é o mesmo da conta de login.',
              )
            }
            if (catErr?.message) {
              partes.push(`Catálogo (REST): ${catErr.message}`)
            }
            if (partes.length) setListaAviso(partes.join(' '))
          }
        }
      } catch (err) {
        if (alive) setListaError(err?.message || 'Falha ao carregar treinos.')
      } finally {
        if (alive) setListaLoading(false)
      }
    }

    carregarTreinos()
    return () => { alive = false }
  }, [user?.email, user?.id])

  const treinosFiltrados = todosTreinos.filter((t) => {
    const termo = busca.trim().toLowerCase()
    const passouBusca = !termo ||
      t.nome.toLowerCase().includes(termo) ||
      labelCategoria(t.categoria).toLowerCase().includes(termo) ||
      t.personal.toLowerCase().includes(termo) ||
      t.exercicios.some((ex) => ex.nome.toLowerCase().includes(termo))
    const passouCategoria = filtroCategoria === 'all' || !t.categoria || t.categoria === filtroCategoria
    const passouPersonal = filtroPersonal === 'todos' || t.personal === filtroPersonal
    return passouBusca && passouCategoria && passouPersonal
  })

  const toastLayer = (
    <>
      {toastBadge && <BadgeToast badge={toastBadge} onClose={() => setToastBadge(null)} />}
      {toastPontos && (
        <PontosToast
          texto={toastPontos}
          top={toastBadge ? 'calc(var(--safe-top) + 96px)' : 'calc(var(--safe-top) + 16px)'}
          onClose={() => setToastPontos(null)}
        />
      )}
    </>
  )

  const totalExercicios = treino.exercicios.length
  const concluidos = treino.exercicios.filter(e => e.concluido).length
  const progresso = totalExercicios > 0 ? (concluidos / totalExercicios) * 100 : 0
  const builderValido = Boolean(
    builderNome.trim() &&
    builderExercicios.length > 0 &&
    builderExercicios.every((ex) => {
      const series = Number(ex.series)
      return ex.nome.trim() && Number.isFinite(series) && series > 0
    })
  )

  function atualizarExercicioBuilder(exId, campo, valor) {
    setBuilderExercicios((prev) => prev.map((ex) => (ex.id === exId ? { ...ex, [campo]: valor } : ex)))
  }

  function adicionarExercicioBuilder() {
    setBuilderExercicios((prev) => [...prev, novoExercicioBuilder()])
  }

  function removerExercicioBuilder(exId) {
    setBuilderExercicios((prev) => (prev.length > 1 ? prev.filter((ex) => ex.id !== exId) : prev))
  }

  async function salvarTreinoPersonalizado() {
    if (!builderValido) {
      setBuilderMensagem({ tipo: 'erro', texto: 'Preencha nome do treino e os exercicios obrigatorios.' })
      return
    }
    if (!user?.id) {
      setBuilderMensagem({ tipo: 'erro', texto: 'Faca login para salvar o treino.' })
      return
    }
    if (!usuarioDbId) {
      setBuilderMensagem({ tipo: 'erro', texto: 'Perfil de usuario nao encontrado. Tente novamente.' })
      return
    }

    const exerciciosPayload = builderExercicios.map((ex, index) => ({
      id: `ex-${index + 1}`,
      nome: ex.nome.trim(),
      series: Math.max(1, Number(ex.series) || 1),
      repeticoes: Math.max(0, Number(ex.repeticoes) || 0),
      carga: Math.max(0, Number(ex.carga) || 0),
      met: 0,
      video_url: sanitizeVideoUrl(ex.video_url),
    }))

    setBuilderSalvando(true)
    setBuilderMensagem({ tipo: '', texto: '' })

    try {
      const hoje = new Date()
      const dataPrevista = hoje.toISOString().slice(0, 10)

      const { data: row, error } = await supabase
        .from('treinos_plano')
        .insert({
          usuario_id: usuarioDbId,
          nome: builderNome.trim(),
          personal_id: null,
          data_prevista: dataPrevista,
          exercicios: exerciciosPayload,
          criado_pelo_aluno: true,
          categoria: builderCategoria,
        })
        .select('id, nome, personal_id, data_prevista, exercicios, criado_pelo_aluno, categoria, created_at')
        .single()

      if (error) throw error

      const novo = mapPlanoRowToTreino(row)
      setTreinosPlano((prev) => [novo, ...prev])

      setBuilderNome('')
      setBuilderCategoria('chest')
      setBuilderExercicios([novoExercicioBuilder()])
      setBuilderMensagem({ tipo: 'sucesso', texto: 'Treino salvo na sua conta.' })
    } catch (err) {
      setBuilderMensagem({
        tipo: 'erro',
        texto: err?.message || 'Nao foi possivel salvar o treino.',
      })
    } finally {
      setBuilderSalvando(false)
    }
  }

  function selecionarTreino(t) {
    setTreinoSelecionadoId(t.id)
    setConcluido(false)
    setExpandido(null)
    setTreino({
      id: t.id,
      nome: t.nome,
      categoria: t.categoria,
      personal: t.personal,
      thumb: t.thumb,
      exercicios: resetExercicios(t.exercicios),
    })
  }

  function toggleSerie(exId, serieIdx) {
    setTreino(prev => ({
      ...prev,
      exercicios: prev.exercicios.map((ex) => {
        if (ex.id !== exId) return ex
        const jaFeita = ex.series_feitas.includes(serieIdx)
        const novas = jaFeita ? ex.series_feitas.filter(i => i !== serieIdx) : [...ex.series_feitas, serieIdx]
        return { ...ex, series_feitas: novas, concluido: novas.length >= ex.series }
      })
    }))
  }

  function toggleConcluido(exId) {
    setTreino(prev => ({
      ...prev,
      exercicios: prev.exercicios.map((ex) => {
        if (ex.id !== exId) return ex
        const novo = !ex.concluido
        return { ...ex, concluido: novo, series_feitas: novo ? Array.from({ length: ex.series }, (_, i) => i) : [] }
      })
    }))
  }

  async function finalizarTreino() {
    if (!usuarioDbId || !user?.id) {
      setConcluido(true)
      return
    }

    setConcluindo(true)

    const exerciciosResumo = treino.exercicios.map((ex) => ({
      nome: ex.nome,
      series_feitas: ex.series_feitas.length,
      met: ex.met || 0,
      duracao_min: Math.max(1, Math.round(Number(ex.series) * 2.5)),
    }))
    const duracaoTotalMin = exerciciosResumo.reduce((acc, e) => acc + e.duracao_min, 0)

    try {
      const planoId = isPlanoUuid(treino.id) ? treino.id : null
      const { error: insertErr } = await supabase.from('treinos_realizados').insert({
        usuario_id: usuarioDbId,
        plano_id: planoId,
        nome: treino.nome,
        exercicios: exerciciosResumo,
        duracao_min: duracaoTotalMin,
        kcal_gastas: null,
        concluido: true,
      })
      if (insertErr) throw insertErr

      const gRes = await fetchGamificacaoResumo()
      let msgPontos = null
      if (gRes.data?.ok) {
        const r = gRes.data
        const rank =
          r.ranking_opt_in && r.posicao_ranking > 0
            ? ` · Ranking #${r.posicao_ranking}`
            : ''
        msgPontos = `Treino registrado! Semana: ${r.pontos_semana} pts${rank}`
      }

      let badgeDesbloqueado = null
      const badRes = await fetchUsuarioBadges(usuarioDbId)
      if (badRes.data?.length) {
        const agora = Date.now()
        const limiteMs = 30000
        const candidato = badRes.data.find(
          (ub) => ub.badge && ub.concedido_em && agora - new Date(ub.concedido_em).getTime() < limiteMs,
        )
        if (candidato?.badge) badgeDesbloqueado = candidato.badge
      }

      if (badgeDesbloqueado) setToastBadge(badgeDesbloqueado)
      if (msgPontos) setToastPontos(msgPontos)

      const hook = import.meta.env.VITE_N8N_WEBHOOK_TREINO
      if (hook) {
        await fetch(hook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            usuario_id: usuarioDbId,
            exercicios: exerciciosResumo,
            duracao_total_min: duracaoTotalMin,
          }),
        })
      }
    } catch {
      /* sessao concluida na UI mesmo se gravacao falhar */
    }

    setConcluido(true)
    setConcluindo(false)
  }

  if (!treinoSelecionadoId) {
    return (
      <>
      {toastLayer}
      <div className="treino-container">
        <div className="treino-header">
          <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 2 }}>Seu Plano</p>
          <h1 className="treino-title">Treinos</h1>
        </div>

        {listaLoading && (
          <div className="dash-loading anim">
            Carregando treinos...
          </div>
        )}

        {!listaLoading && listaError && (
          <div className="dash-warning anim">
            {listaError}
          </div>
        )}

        {!listaLoading && listaAviso && (
          <div className="dash-warning anim" style={{ color: 'var(--amber)', borderColor: 'var(--amber-dim)' }}>
            {listaAviso}
          </div>
        )}

        <div className="resumo-card anim" style={{ padding: 12 }}>
          <button
            onClick={() => setBuilderExpandido((prev) => !prev)}
            className="btn-add-treino"
          >
            {builderExpandido ? 'Fechar Criador' : '+ Criar Treino Personalizado'}
            <span style={{ marginLeft: 'auto' }}>{builderExpandido ? '▴' : '▾'}</span>
          </button>
          
          {builderExpandido && (
            <div className="anim" style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
              <div className="field">
                <input
                  className="input"
                  value={builderNome}
                  onChange={(e) => setBuilderNome(e.target.value)}
                  placeholder="Nome do treino (ex: Peito e Tríceps)"
                />
              </div>

              <div className="field">
                <select
                  className="input"
                  value={builderCategoria}
                  onChange={(e) => setBuilderCategoria(e.target.value)}
                >
                  {CATEGORIAS.filter((cat) => cat.id !== 'all').map((cat) => (
                    <option key={cat.id} value={cat.id}>{cat.label}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {builderExercicios.map((exercicio, index) => (
                  <div key={exercicio.id} className="resumo-card" style={{ padding: 12, background: 'var(--bg-4)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <p style={{ fontWeight: 800, fontSize: 12, color: 'var(--text-2)' }}>EXERCÍCIO {index + 1}</p>
                      <button
                        onClick={() => removerExercicioBuilder(exercicio.id)}
                        disabled={builderExercicios.length === 1}
                        style={{ color: 'var(--red)', fontSize: 11, fontWeight: 700, background: 'none', border: 'none' }}
                      >
                        Remover
                      </button>
                    </div>

                    <input
                      className="input"
                      value={exercicio.nome}
                      onChange={(e) => atualizarExercicioBuilder(exercicio.id, 'nome', e.target.value)}
                      placeholder="Nome do exercício"
                      style={{ marginBottom: 8 }}
                    />

                    <div style={{ display: 'grid', gap: 8, gridTemplateColumns: '1fr 1fr 1fr', marginBottom: 8 }}>
                      <input className="input" value={exercicio.series} onChange={(e) => atualizarExercicioBuilder(exercicio.id, 'series', e.target.value)} placeholder="Séries" inputMode="numeric" />
                      <input className="input" value={exercicio.repeticoes} onChange={(e) => atualizarExercicioBuilder(exercicio.id, 'repeticoes', e.target.value)} placeholder="Reps" inputMode="numeric" />
                      <input className="input" value={exercicio.carga} onChange={(e) => atualizarExercicioBuilder(exercicio.id, 'carga', e.target.value)} placeholder="Kg" inputMode="numeric" />
                    </div>
                    
                    <input
                      className="input"
                      value={exercicio.video_url ?? ''}
                      onChange={(e) => atualizarExercicioBuilder(exercicio.id, 'video_url', e.target.value)}
                      placeholder="URL do vídeo (YouTube/Vimeo)"
                      style={{ fontSize: 12 }}
                    />
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={adicionarExercicioBuilder} className="btn" style={{ flex: 1, fontSize: 12 }}>+ Exercício</button>
                <button
                  onClick={salvarTreinoPersonalizado}
                  disabled={!builderValido || builderSalvando}
                  className="btn-primary"
                  style={{ flex: 1, fontSize: 12 }}
                >
                  {builderSalvando ? 'Salvando...' : 'Salvar Treino'}
                </button>
              </div>

              {builderMensagem.texto && (
                <p style={{ fontSize: 11, textAlign: 'center', color: builderMensagem.tipo === 'erro' ? 'var(--red)' : 'var(--lime)', fontWeight: 700 }}>
                  {builderMensagem.texto}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="search-field">
          <input
            className="search-input"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar treino ou exercício..."
          />
          <span className="search-icon">🔍</span>
        </div>

        <div className="filter-scroll">
          {CATEGORIAS.map((cat) => {
            const ativo = cat.id === filtroCategoria
            return (
              <button
                key={cat.id}
                onClick={() => setFiltroCategoria(cat.id)}
                className={`filter-btn ${ativo ? 'active' : ''}`}
              >
                <IconFiltroCategoria id={cat.id} />
                {cat.label}
              </button>
            )
          })}
        </div>

        <div className="filter-scroll" style={{ paddingTop: 0 }}>
          {personais.map((personal) => {
            const ativo = personal === filtroPersonal
            return (
              <button
                key={personal}
                onClick={() => setFiltroPersonal(personal)}
                className={`filter-btn ${ativo ? 'active' : ''}`}
              >
                {personal === 'todos' ? 'Todos os instrutores' : personal}
              </button>
            )
          })}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {!listaLoading && treinosFiltrados.map((t, i) => (
            <div
              key={t.id}
              className="treino-card anim"
              style={{ animationDelay: `${i * 0.05}s` }}
              onClick={() => selecionarTreino(t)}
            >
              <img src={t.thumb} className="treino-thumb" alt={t.nome} />
              <div className="treino-info">
                <h3 className="treino-name">{t.nome}</h3>
                <div className="treino-meta">
                  <span className="tag">{labelCategoria(t.categoria)}</span>
                  <span>{t.exercicios.length} exs</span>
                  {t.personalizado && <span className="tag" style={{ background: 'var(--lime-dim)', color: 'var(--lime)' }}>Personal</span>}
                </div>
              </div>
              <div className="treino-badge">▶</div>
            </div>
          ))}

          {!listaLoading && treinosFiltrados.length === 0 && (
            <div className="dash-warning" style={{ textAlign: 'center' }}>
              Nenhum treino encontrado.
            </div>
          )}
        </div>
      </div>
      </>
    )
  }

  if (concluido) {
    return (
      <>
      {toastLayer}
      <div style={{
        minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column', padding: 28, textAlign: 'center',
      }}>
        <div style={{
          width: 84, height: 84, borderRadius: '50%', background: 'var(--lime)',
          color: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 36, marginBottom: 16, boxShadow: 'var(--shadow-glow)',
        }}>
          ✓
        </div>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 30, marginBottom: 8 }}>Treino concluido!</h2>
        <p style={{ color: 'var(--text-2)', marginBottom: 20 }}>
          Saldo atualizado e envio para WhatsApp em andamento.
        </p>
        <button
          onClick={() => { setConcluido(false); setTreinoSelecionadoId(null) }}
          style={{
            background: 'var(--lime)', color: '#111', borderRadius: 12,
            fontWeight: 800, padding: '12px 18px',
          }}
        >
          Voltar para catalogo
        </button>
      </div>
      </>
    )
  }

  return (
    <>
    {toastLayer}
    <div style={{
      height: '100dvh', minHeight: 0, display: 'flex', flexDirection: 'column',
      paddingTop: 'var(--safe-top)', overflow: 'hidden', background: 'var(--bg)'
    }}>
      <div style={{ padding: '16px 16px 0', flexShrink: 0 }}>
        <div className="resumo-card" style={{ 
          minHeight: 160, 
          backgroundImage: `linear-gradient(0deg, var(--bg-3), rgba(0,0,0,0.25)), url(${treino.thumb || THUMB_PERSONALIZADO})`,
          backgroundSize: 'cover', backgroundPosition: 'center', 
          display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
          border: '1px solid var(--border-2)',
          padding: 16
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button
              onClick={() => setTreinoSelecionadoId(null)}
              className="btn"
              style={{ width: 40, height: 40, padding: 0, borderRadius: 12, background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.2)' }}
            >
              ←
            </button>
            <span className="tag" style={{ background: 'var(--lime)', color: '#000', fontWeight: 800 }}>
              {concluidos}/{totalExercicios} EXS
            </span>
          </div>
          <div>
            <h2 className="treino-name" style={{ fontSize: 24, marginBottom: 4 }}>{treino.nome}</h2>
            <p style={{ color: 'var(--text-3)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Instrutor: {treino.personal}
            </p>
          </div>
        </div>

        <div style={{ height: 6, background: 'var(--bg-3)', borderRadius: 999, marginTop: 12, overflow: 'hidden', border: '1px solid var(--border)' }}>
          <div style={{ height: '100%', width: `${progresso}%`, background: 'var(--lime)', transition: 'width .6s cubic-bezier(0.16, 1, 0.3, 1)', boxShadow: '0 0 10px var(--lime-dim)' }} />
        </div>
      </div>

      <div
        ref={scrollRef}
        className="anim"
        style={{
          flex: 1, minHeight: 0, overflowY: 'auto', padding: '16px',
          paddingBottom: 'calc(100px + var(--safe-bottom))', display: 'flex',
          flexDirection: 'column', gap: 12,
        }}
      >
        {treino.exercicios.map((ex, i) => (
          <ExercicioCard
            key={ex.id}
            ex={ex}
            index={i}
            expandido={expandido === ex.id}
            onExpand={(id) => setExpandido((prev) => prev === id ? null : id)}
            onToggleSerie={toggleSerie}
            onToggleConcluido={toggleConcluido}
          />
        ))}

        {totalExercicios > 0 && (
          <button
            onClick={finalizarTreino}
            disabled={concluindo || concluidos !== totalExercicios}
            className={concluidos === totalExercicios ? "btn-primary" : "btn"}
            style={{
              width: '100%',
              padding: 18,
              marginTop: 8,
              opacity: (concluindo || (concluidos !== totalExercicios)) ? 0.6 : 1
            }}
          >
            {concluindo
              ? 'Enviando...'
              : concluidos === totalExercicios
                ? 'FINALIZAR TREINO 💪'
                : `CONCLUA MAIS ${totalExercicios - concluidos} EXERCÍCIOS`}
          </button>
        )}
      </div>
    </div>
    </>
  )
}

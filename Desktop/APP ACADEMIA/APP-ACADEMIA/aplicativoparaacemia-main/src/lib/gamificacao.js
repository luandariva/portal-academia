import { supabase } from './supabase'

function postgrestErrorMessage(error) {
  if (!error) return ''
  const bits = [error.message, error.details, error.hint].filter(Boolean)
  const msg = bits.join(' — ')
  if (error.code) return `${msg} (${error.code})`
  return msg
}

export async function fetchGamificacaoResumo() {
  const { data, error } = await supabase.rpc('rpc_gamificacao_resumo', {})
  if (error) return { error: postgrestErrorMessage(error), data: null }
  return { error: null, data }
}

export async function fetchGamificacaoLeaderboard(limit = 20) {
  const { data, error } = await supabase.rpc('rpc_gamificacao_leaderboard', { p_limit: limit })
  if (error) return { error: postgrestErrorMessage(error), data: null }
  return { error: null, data: data || [] }
}

export async function setRankingOptIn(optIn) {
  const { error } = await supabase.rpc('rpc_gamificacao_set_ranking_opt_in', { p_opt_in: optIn })
  return { error: postgrestErrorMessage(error) || null }
}

export async function setDisplayName(name) {
  const { error } = await supabase.rpc('rpc_gamificacao_set_display_name', { p_name: name || '' })
  return { error: postgrestErrorMessage(error) || null }
}

export async function fetchUsuarioBadges(usuarioId) {
  if (!usuarioId) return { error: null, data: [] }
  const { data: rows, error } = await supabase
    .from('gamificacao_usuario_badges')
    .select('id, badge_id, semana_inicio, concedido_em')
    .eq('usuario_id', usuarioId)
    .order('concedido_em', { ascending: false })
    .limit(50)
  if (error) return { error: error.message, data: null }
  const list = rows || []
  const ids = [...new Set(list.map((r) => r.badge_id).filter(Boolean))]
  if (ids.length === 0) return { error: null, data: normalizedBadgeRows(list, {}) }
  const { data: badges, error: bErr } = await supabase
    .from('gamificacao_badges')
    .select('id, slug, titulo, descricao, icone')
    .in('id', ids)
  if (bErr) return { error: bErr.message, data: null }
  const byId = Object.fromEntries((badges || []).map((b) => [b.id, b]))
  return { error: null, data: normalizedBadgeRows(list, byId) }
}

function normalizedBadgeRows(list, byId) {
  return list.map((r) => ({
    id: r.id,
    semana_inicio: r.semana_inicio,
    concedido_em: r.concedido_em,
    badge: byId[r.badge_id] || null,
  }))
}

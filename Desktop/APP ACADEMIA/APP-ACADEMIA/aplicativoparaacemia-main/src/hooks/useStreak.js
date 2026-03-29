import { useEffect, useState } from 'react'
import { useAuth } from './useAuth'
import { supabase } from '../lib/supabase'
import { resolveUsuarioDb } from '../lib/usuarioDb'

/**
 * Retorna a data no formato YYYY-MM-DD (local).
 */
function toLocalDateStr(date) {
  const d = new Date(date)
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

/**
 * Subtrai N dias de uma data.
 */
function subDays(date, n) {
  const d = new Date(date)
  d.setDate(d.getDate() - n)
  return d
}

/**
 * Hook que calcula o streak (sequência de dias consecutivos)
 * com base em refeições registradas e treinos concluídos.
 *
 * Um dia é "ativo" se o usuário registrou ≥1 refeição OU concluiu ≥1 treino.
 *
 * @returns {{ streak: number, recordeStreak: number, hojeAtivo: boolean, diasAtivosNaSemana: boolean[], loading: boolean }}
 */
export function useStreak() {
  const { user } = useAuth()
  const [streak, setStreak] = useState(0)
  const [recordeStreak, setRecordeStreak] = useState(0)
  const [hojeAtivo, setHojeAtivo] = useState(false)
  const [diasAtivosNaSemana, setDiasAtivosNaSemana] = useState([false, false, false, false, false, false, false])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true

    async function calcular() {
      if (!user?.id) {
        if (alive) setLoading(false)
        return
      }

      setLoading(true)

      try {
        const { usuarioId } = await resolveUsuarioDb(user)
        if (!usuarioId) {
          if (alive) setLoading(false)
          return
        }

        const hoje = new Date()
        hoje.setHours(0, 0, 0, 0)
        const inicio90 = subDays(hoje, 90)

        // Buscar refeições e treinos concluídos dos últimos 90 dias
        const [refRes, treinoRes] = await Promise.all([
          supabase
            .from('refeicoes')
            .select('data_hora')
            .eq('usuario_id', usuarioId)
            .gte('data_hora', inicio90.toISOString())
            .order('data_hora', { ascending: true }),
          supabase
            .from('treinos_realizados')
            .select('data_hora')
            .eq('usuario_id', usuarioId)
            .eq('concluido', true)
            .gte('data_hora', inicio90.toISOString())
            .order('data_hora', { ascending: true }),
        ])

        if (!alive) return

        // Montar Set de datas ativas
        const datasAtivas = new Set()

        if (refRes.data) {
          for (const r of refRes.data) {
            datasAtivas.add(toLocalDateStr(r.data_hora))
          }
        }
        if (treinoRes.data) {
          for (const t of treinoRes.data) {
            datasAtivas.add(toLocalDateStr(t.data_hora))
          }
        }

        // Verificar se hoje está ativo
        const hojeStr = toLocalDateStr(hoje)
        const hojeEstaAtivo = datasAtivas.has(hojeStr)

        // Calcular streak atual: andar para trás a partir de hoje (ou ontem se hoje não tiver registro)
        let streakAtual = 0
        let cursor = new Date(hoje)

        if (hojeEstaAtivo) {
          // Hoje conta, começar a contar de hoje
          while (datasAtivas.has(toLocalDateStr(cursor))) {
            streakAtual++
            cursor = subDays(cursor, 1)
          }
        } else {
          // Hoje não conta ainda, começar de ontem
          cursor = subDays(cursor, 1)
          while (datasAtivas.has(toLocalDateStr(cursor))) {
            streakAtual++
            cursor = subDays(cursor, 1)
          }
        }

        // Calcular recorde: maior sequência nos 90 dias
        let melhorStreak = 0
        let sequenciaAtual = 0
        for (let i = 0; i <= 90; i++) {
          const dia = subDays(hoje, 90 - i)
          if (datasAtivas.has(toLocalDateStr(dia))) {
            sequenciaAtual++
            if (sequenciaAtual > melhorStreak) melhorStreak = sequenciaAtual
          } else {
            sequenciaAtual = 0
          }
        }

        // Dias ativos na semana atual (Seg a Dom)
        // Encontrar a segunda-feira da semana atual
        const diaSemana = hoje.getDay() // 0=Dom, 1=Seg, ...
        const offsetSeg = diaSemana === 0 ? -6 : 1 - diaSemana
        const segunda = new Date(hoje)
        segunda.setDate(hoje.getDate() + offsetSeg)

        const semanaAtiva = []
        for (let i = 0; i < 7; i++) {
          const dia = new Date(segunda)
          dia.setDate(segunda.getDate() + i)
          semanaAtiva.push(datasAtivas.has(toLocalDateStr(dia)))
        }

        if (alive) {
          setStreak(streakAtual)
          setRecordeStreak(melhorStreak)
          setHojeAtivo(hojeEstaAtivo)
          setDiasAtivosNaSemana(semanaAtiva)
          setLoading(false)
        }
      } catch (err) {
        console.error('[useStreak] Erro:', err)
        if (alive) setLoading(false)
      }
    }

    calcular()
    return () => { alive = false }
  }, [user?.id, user?.email])

  return { streak, recordeStreak, hojeAtivo, diasAtivosNaSemana, loading }
}

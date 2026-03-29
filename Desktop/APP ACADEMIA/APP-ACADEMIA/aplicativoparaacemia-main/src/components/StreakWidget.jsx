import { useStreak } from '../hooks/useStreak'

const DIAS_SEMANA = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D']

function getMensagem(streak, hojeAtivo) {
  if (streak === 0 && !hojeAtivo) return 'Comece sua sequência hoje! 💪'
  if (streak <= 2) return 'Bom começo! Continue assim 💪'
  if (streak <= 6) return `${streak} dias seguidos! Não pare agora 🔥`
  if (streak <= 13) return `${streak} dias! Você está em chamas! 🔥🔥`
  if (streak <= 29) return `Incrível! ${streak} dias seguidos! 🏆`
  return `Lendário! ${streak} dias sem parar! 👑`
}

function FireIcon({ ativo, size = 32 }) {
  return (
    <div style={{
      fontSize: size,
      lineHeight: 1,
      animation: ativo ? 'fireFlicker 1.2s ease-in-out infinite' : 'none',
      filter: ativo ? 'drop-shadow(0 0 8px rgba(255, 140, 0, 0.6))' : 'grayscale(1) opacity(0.4)',
      transition: 'filter 0.4s ease',
    }}>
      🔥
    </div>
  )
}

export default function StreakWidget() {
  const { streak, recordeStreak, hojeAtivo, diasAtivosNaSemana, loading } = useStreak()

  if (loading) {
    return (
      <div style={{
        borderRadius: 'var(--radius)',
        background: 'var(--bg-3)',
        border: '1px solid var(--border)',
        padding: '16px 18px',
        minHeight: 70,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}>
        <div className="spinner" />
        <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Calculando sequência...</span>
      </div>
    )
  }

  const streakAtivo = streak > 0 || hojeAtivo
  const emRisco = streak > 0 && !hojeAtivo

  const corPrincipal = emRisco ? 'var(--amber)' : streakAtivo ? 'var(--lime)' : 'var(--text-3)'
  const bgGlow = emRisco ? 'rgba(240, 168, 75, 0.08)' : streakAtivo ? 'rgba(201, 242, 77, 0.06)' : 'transparent'
  const borderGlow = emRisco ? 'rgba(240, 168, 75, 0.3)' : streakAtivo ? 'rgba(201, 242, 77, 0.2)' : 'var(--border)'

  return (
    <div style={{
      borderRadius: 'var(--radius)',
      background: `linear-gradient(145deg, var(--bg-3), ${bgGlow})`,
      border: `1px solid ${borderGlow}`,
      padding: '16px 18px',
      animation: 'floatIn .45s ease .06s both',
      boxShadow: streakAtivo ? `0 4px 24px ${emRisco ? 'rgba(240,168,75,0.1)' : 'rgba(201,242,77,0.08)'}` : 'none',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{
          width: 56, height: 56,
          borderRadius: 'var(--radius)',
          background: emRisco
            ? 'var(--bg-4)'
            : streakAtivo
              ? 'var(--lime-dim)'
              : 'rgba(255,255,255,0.04)',
          border: `1.5px solid ${emRisco ? 'var(--amber)' : streakAtivo ? 'var(--lime-border)' : 'var(--border)'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          animation: streakAtivo && !emRisco ? 'glowPulse 2.5s ease-in-out infinite' : 'none',
        }}>
          <FireIcon ativo={streakAtivo} size={28} />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span style={{
              fontSize: 32, fontWeight: 900, fontFamily: 'var(--font-display)',
              color: corPrincipal, lineHeight: 1, letterSpacing: '-0.02em',
            }}>
              {streak}
            </span>
            <span style={{ fontSize: 13, fontWeight: 600, color: corPrincipal, opacity: 0.7 }}>
              {streak === 1 ? 'dia' : 'dias'}
            </span>
          </div>
          <p style={{
            fontSize: 12, color: emRisco ? 'var(--amber)' : 'var(--text-2)',
            marginTop: 3, lineHeight: 1.3, fontWeight: emRisco ? 600 : 400,
          }}>
            {emRisco ? '⚠️ Registre hoje para manter sua sequência!' : getMensagem(streak, hojeAtivo)}
          </p>
        </div>
      </div>

      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginTop: 14, padding: '10px 4px', background: 'rgba(255,255,255,0.025)', borderRadius: 'var(--radius)',
      }}>
        {diasAtivosNaSemana.map((ativo, i) => {
          const ehHoje = (() => {
            const hoje = new Date()
            const diaSemana = hoje.getDay()
            const indiceSeg = diaSemana === 0 ? 6 : diaSemana - 1
            return i === indiceSeg
          })()

          return (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, flex: 1 }}>
              <span style={{ fontSize: 10, fontWeight: 600, color: ehHoje ? 'var(--text)' : 'var(--text-3)' }}>
                {DIAS_SEMANA[i]}
              </span>
              <div style={{
                width: ehHoje ? 22 : 18, height: ehHoje ? 22 : 18, borderRadius: '50%',
                background: ativo ? 'var(--lime)' : ehHoje ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)',
                border: ehHoje && !ativo ? '1.5px dashed rgba(255,255,255,0.2)' : ativo ? '1.5px solid rgba(201,242,77,0.5)' : '1px solid rgba(255,255,255,0.06)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.3s ease',
                boxShadow: ativo ? '0 0 8px rgba(201,242,77,0.3)' : 'none',
              }}>
                {ativo && (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.05)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            width: 18, height: 18, borderRadius: '50%',
            background: hojeAtivo ? 'var(--lime)' : 'rgba(255,255,255,0.06)',
            border: hojeAtivo ? 'none' : '1px dashed rgba(255,255,255,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10,
            color: '#000'
          }}>
            {hojeAtivo ? '✓' : ''}
          </span>
          <span style={{ fontSize: 11, color: hojeAtivo ? 'var(--lime)' : 'var(--text-3)', fontWeight: hojeAtivo ? 600 : 400 }}>
            {hojeAtivo ? 'Hoje registrado' : 'Hoje pendente'}
          </span>
        </div>

        {recordeStreak > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 11, color: 'var(--text-3)' }}>Recorde:</span>
            <span style={{
              fontSize: 12, fontWeight: 800, color: streak >= recordeStreak ? 'var(--lime)' : 'var(--text-2)',
              fontFamily: 'var(--font-display)',
            }}>
              {recordeStreak}
            </span>
            {streak >= recordeStreak && streak > 0 && <span style={{ fontSize: 11 }}>👑</span>}
          </div>
        )}
      </div>
    </div>
  )
}

import { useLocation, useNavigate } from 'react-router-dom'

const tabs = [
  { path: '/', label: 'Início', icon: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/>
      <rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>
    </svg>
  )},
  { path: '/nutricao', label: 'Dieta', icon: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/>
    </svg>
  )},
  { path: '/treino', label: 'Treino', icon: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 5v14M18 5v14M3 8h3M18 8h3M3 16h3M18 16h3"/>
    </svg>
  )},
  { path: '/historico', label: 'Histórico', icon: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
    </svg>
  )},
  { path: '/perfil', label: 'Perfil', icon: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
  )},
]

export default function BottomNav() {
  const location = useLocation()
  const navigate = useNavigate()
  return (
    <nav style={{
      position: 'fixed', bottom: 0, left: 0, right: 0,
      background: 'rgba(11, 12, 14, 0.98)',
      backdropFilter: 'blur(10px)',
      borderTop: '1px solid var(--border-2)',
      display: 'flex',
      alignItems: 'flex-end',
      padding: '8px 10px calc(8px + var(--safe-bottom))',
      zIndex: 120,
      boxShadow: '0 -8px 32px rgba(0,0,0,0.45)',
    }}>
      {tabs.map((tab, index) => {
        const active = location.pathname === tab.path
        const isCenter = index === 2
        return (
          <button key={tab.path} onClick={() => navigate(tab.path)} style={{
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
            gap: 4, padding: isCenter ? '0' : '6px 0 4px',
            background: 'none', color: active ? 'var(--lime)' : 'var(--text-3)',
            transition: 'all .2s',
            position: 'relative',
          }}>
            {isCenter ? (
              <>
                <div style={{
                  width: 54, height: 54, borderRadius: '50%', marginTop: -24,
                  background: active ? '#dbff70' : 'var(--lime)',
                  color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: active ? '0 0 0 3px rgba(201,242,77,0.3)' : 'none',
                  transform: active ? 'scale(1.05)' : 'scale(1)',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                }}>
                  {tab.icon}
                </div>
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.02em', color: 'var(--text-2)', marginTop: 2 }}>
                  {tab.label}
                </span>
              </>
            ) : (
              <>
                <div style={{ transform: active ? 'translateY(-2px)' : 'none', transition: 'transform .2s' }}>
                  {tab.icon}
                </div>
                <span style={{ fontSize: 10, fontWeight: active ? 700 : 500, letterSpacing: '0.03em' }}>
                  {tab.label}
                </span>
              </>
            )}
            {active && !isCenter && (
              <div style={{
                position: 'absolute', top: -8, width: 28, height: 3,
                background: 'var(--lime)', borderRadius: 999,
              }}/>
            )}
          </button>
        )
      })}
    </nav>
  )
}

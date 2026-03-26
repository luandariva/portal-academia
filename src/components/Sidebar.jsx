import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

const NAV = [
  { path: '/dashboard', label: 'Dashboard', icon: IconGrid },
  { path: '/alunos',    label: 'Alunos',    icon: IconUsers },
  { path: '/treinos',   label: 'Treinos',   icon: IconDumbbell },
  { path: '/desafios',  label: 'Desafios',  icon: IconTrophy },
  { path: '/gamificacao', label: 'Gamificação', icon: IconBadge },
  { path: '/risco-cancelamento', label: 'Risco cancelamento', icon: IconAlertTriangle },
]

function IconGrid() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1.2"/><rect x="14" y="3" width="7" height="7" rx="1.2"/>
      <rect x="3" y="14" width="7" height="7" rx="1.2"/><rect x="14" y="14" width="7" height="7" rx="1.2"/>
    </svg>
  )
}
function IconUsers() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  )
}
function IconDumbbell() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 5v14M18 5v14M3 8h3M18 8h3M3 16h3M18 16h3"/>
    </svg>
  )
}
function IconTrophy() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 21h8"/>
      <path d="M12 17v4"/>
      <path d="M7 4h10v5a5 5 0 0 1-10 0z"/>
      <path d="M5 6H3a2 2 0 0 0 2 2"/>
      <path d="M19 6h2a2 2 0 0 1-2 2"/>
    </svg>
  )
}
function IconBadge() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="5" />
      <path d="m8.21 13.89-1.42 7.11L12 18l5.21 3-1.42-7.11" />
    </svg>
  )
}
function IconAlertTriangle() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.3 3.86 1.82 18a2 2 0 0 0 1.72 3h16.92a2 2 0 0 0 1.72-3L13.7 3.86a2 2 0 0 0-3.4 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  )
}
function IconLogout() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
      <polyline points="16 17 21 12 16 7"/>
      <line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  )
}

export default function Sidebar() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { profile, user, signOut } = useAuth()

  const displayName = profile?.nome || user?.email?.split('@')[0] || 'Usuário'
  const role = profile?.role === 'gestor' ? 'Gestor' : 'Personal'
  const initials = displayName.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()

  return (
    <aside style={{
      width: 'var(--sidebar-w)', flexShrink: 0,
      background: 'var(--bg-2)',
      borderRight: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column',
      height: '100vh', position: 'sticky', top: 0,
    }}>
      {/* Logo */}
      <div style={{
        padding: '20px 20px 16px',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          background: 'var(--lime)', color: '#111',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 13,
        }}>
          A
        </div>
        <div>
          <p style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 15, lineHeight: 1 }}>
            AlimentaAI
          </p>
          <p style={{ fontSize: 10, color: 'var(--text-3)', letterSpacing: '.06em', textTransform: 'uppercase' }}>
            Portal
          </p>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ padding: '12px 10px', flex: 1 }}>
        {NAV.map(item => {
          const active = pathname.startsWith(item.path)
          const Icon = item.icon
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 10px', borderRadius: 8, marginBottom: 2,
                background: active ? 'var(--lime-dim)' : 'transparent',
                color: active ? 'var(--lime)' : 'var(--text-2)',
                fontWeight: active ? 600 : 400, fontSize: 13.5,
                border: active ? '1px solid var(--lime-border)' : '1px solid transparent',
                transition: 'all .15s', textAlign: 'left',
              }}
            >
              <Icon />
              {item.label}
              {active && (
                <div style={{
                  marginLeft: 'auto', width: 5, height: 5,
                  borderRadius: '50%', background: 'var(--lime)',
                }} />
              )}
            </button>
          )
        })}
      </nav>

      {/* User footer */}
      <div style={{
        padding: '12px 14px',
        borderTop: '1px solid var(--border)',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10,
        }}>
          <div style={{
            width: 34, height: 34, borderRadius: '50%',
            background: 'var(--bg-4)', border: '1px solid var(--border-2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 700, fontSize: 12, color: 'var(--lime)',
          }}>
            {initials}
          </div>
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {displayName}
            </p>
            <p style={{ fontSize: 11, color: 'var(--text-3)' }}>{role}</p>
          </div>
        </div>
        <button
          onClick={signOut}
          className="btn btn-ghost"
          style={{ width: '100%', justifyContent: 'center', height: 34, fontSize: 12 }}
        >
          <IconLogout /> Sair
        </button>
      </div>
    </aside>
  )
}

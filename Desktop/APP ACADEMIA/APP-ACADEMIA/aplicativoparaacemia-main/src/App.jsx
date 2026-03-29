import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Treino from './pages/Treino'
import { Nutricao, Perfil } from './pages/Placeholders'
import Historico from './pages/Historico'
import BottomNav from './components/BottomNav'
import TrocarSenhaInicial from './pages/TrocarSenhaInicial'

function PrivateLayout({ children }) {
  return (
    <div style={{ position: 'relative', height: '100dvh', overflow: 'hidden' }}>
      <div style={{ height: '100%', minHeight: 0, overflowY: 'auto' }}>
        {children}
      </div>
      <BottomNav />
    </div>
  )
}

function PrivateRoute({ children }) {
  const { user, loading, mustChangePassword } = useAuth()
  if (loading) return (
    <div style={{
      height: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg)',
    }}>
      <div className="spinner" />
    </div>
  )
  if (!user) return <Navigate to="/login" replace />
  if (mustChangePassword) return <Navigate to="/trocar-senha-inicial" replace />
  return children
}

export default function App() {
  const { user, loading, mustChangePassword } = useAuth()
  if (loading) return null
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route
        path="/trocar-senha-inicial"
        element={
          user
            ? (mustChangePassword ? <TrocarSenhaInicial /> : <Navigate to="/" replace />)
            : <Navigate to="/login" replace />
        }
      />
      <Route path="/" element={
        <PrivateRoute>
          <PrivateLayout><Dashboard /></PrivateLayout>
        </PrivateRoute>
      }/>
      <Route path="/treino" element={
        <PrivateRoute>
          <PrivateLayout><Treino /></PrivateLayout>
        </PrivateRoute>
      }/>
      <Route path="/nutricao" element={
        <PrivateRoute>
          <PrivateLayout><Nutricao /></PrivateLayout>
        </PrivateRoute>
      }/>
      <Route path="/historico" element={
        <PrivateRoute>
          <PrivateLayout><Historico /></PrivateLayout>
        </PrivateRoute>
      }/>
      <Route path="/perfil" element={
        <PrivateRoute>
          <PrivateLayout><Perfil /></PrivateLayout>
        </PrivateRoute>
      }/>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

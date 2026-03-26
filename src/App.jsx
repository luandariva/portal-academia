import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import Sidebar from './components/Sidebar'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Alunos from './pages/Alunos'
import AlunoDetalhe from './pages/AlunoDetalhe'
import Treinos from './pages/Treinos'
import Desafios from './pages/Desafios'
import RiscoCancelamento from './pages/RiscoCancelamento'
import Gamificacao from './pages/Gamificacao'

function PortalLayout({ children }) {
  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar />
      <main style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {children}
      </main>
    </div>
  )
}

function PrivateRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <div className="spinner" />
    </div>
  )
  return user ? children : <Navigate to="/login" replace />
}

export default function App() {
  const { user, loading } = useAuth()
  if (loading) return null
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <Login />} />
      <Route path="/dashboard" element={
        <PrivateRoute><PortalLayout><Dashboard /></PortalLayout></PrivateRoute>
      }/>
      <Route path="/alunos" element={
        <PrivateRoute><PortalLayout><Alunos /></PortalLayout></PrivateRoute>
      }/>
      <Route path="/alunos/:id" element={
        <PrivateRoute><PortalLayout><AlunoDetalhe /></PortalLayout></PrivateRoute>
      }/>
      <Route path="/treinos" element={
        <PrivateRoute><PortalLayout><Treinos /></PortalLayout></PrivateRoute>
      }/>
      <Route path="/desafios" element={
        <PrivateRoute><PortalLayout><Desafios /></PortalLayout></PrivateRoute>
      }/>
      <Route path="/risco-cancelamento" element={
        <PrivateRoute><PortalLayout><RiscoCancelamento /></PortalLayout></PrivateRoute>
      }/>
      <Route path="/gamificacao" element={
        <PrivateRoute><PortalLayout><Gamificacao /></PortalLayout></PrivateRoute>
      }/>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}

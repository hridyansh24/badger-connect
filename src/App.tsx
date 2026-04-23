import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { ChatMode } from './types'
import { useBannedInterests } from './hooks/useBannedInterests'
import LoginPage from './pages/LoginPage'
import VerifyPage from './pages/VerifyPage'
import ModeSelectionPage from './pages/ModeSelectionPage'
import TextChatPage from './pages/TextChatPage'
import VideoChatPage from './pages/VideoChatPage'
import BackgroundFX from './components/BackgroundFX'
import './App.css'
import { useSocket } from './context/SocketContext'
import { useAuth } from './context/AuthContext'

function App() {
  const location = useLocation()
  const { user, logout } = useAuth()
  const [selectedMode, setSelectedMode] = useState<ChatMode | null>(null)
  const { bannedInterests, loading: bannedLoading } = useBannedInterests()
  const { status: socketStatus, send: sendSocket } = useSocket()

  const isLoginView = location.pathname === '/' || location.pathname === '/verify'
  const isModeView = location.pathname === '/mode'
  const shellClasses = useMemo(() => {
    const classes = ['app-shell']
    if (isLoginView) classes.push('login-shell')
    if (isModeView) classes.push('mode-shell')
    return classes.join(' ')
  }, [isLoginView, isModeView])

  // Once the socket connects with an authed user, tell the backend about the profile.
  useEffect(() => {
    if (user && socketStatus === 'connected') {
      sendSocket('profile:update', {
        name: user.name,
        email: user.email,
        interests: user.interests,
      })
    }
  }, [user, socketStatus, sendSocket])

  const handleModeSelection = (mode: ChatMode) => setSelectedMode(mode)

  const handleLogout = () => {
    setSelectedMode(null)
    logout()
  }

  const requireAuth = (component: ReactNode) =>
    user ? component : <Navigate to="/" replace />

  const chatsBasePath = user ? '/mode' : '/'

  return (
    <div className={shellClasses}>
      <BackgroundFX />
      <Routes>
        <Route
          path="/"
          element={
            user ? (
              <Navigate to="/mode" replace />
            ) : (
              <LoginPage
                bannedInterests={bannedInterests}
                loadingBannedList={bannedLoading}
              />
            )
          }
        />
        <Route
          path="/verify"
          element={user ? <Navigate to="/mode" replace /> : <VerifyPage />}
        />
        <Route
          path="/mode"
          element={requireAuth(
            <ModeSelectionPage
              user={user!}
              onSelectMode={handleModeSelection}
              onLogout={handleLogout}
            />,
          )}
        />
        <Route
          path="/chat/text"
          element={
            user && selectedMode === 'text' ? (
              <TextChatPage
                user={user!}
                onLeaveChat={() => setSelectedMode(null)}
                onLogout={handleLogout}
              />
            ) : (
              <Navigate to={chatsBasePath} replace />
            )
          }
        />
        <Route
          path="/chat/video"
          element={
            user && selectedMode === 'video' ? (
              <VideoChatPage
                user={user!}
                onLeaveChat={() => setSelectedMode(null)}
                onLogout={handleLogout}
              />
            ) : (
              <Navigate to={chatsBasePath} replace />
            )
          }
        />
        <Route path="*" element={<Navigate to={user ? '/mode' : '/'} replace />} />
      </Routes>
    </div>
  )
}

export default App

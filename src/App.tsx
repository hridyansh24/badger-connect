import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { ChatMode, UserProfile } from './types'
import { useBannedInterests } from './hooks/useBannedInterests'
import LoginPage from './pages/LoginPage'
import ModeSelectionPage from './pages/ModeSelectionPage'
import TextChatPage from './pages/TextChatPage'
import VideoChatPage from './pages/VideoChatPage'
import './App.css'
import { useSocket } from './context/SocketContext'

function App() {
  const location = useLocation()
  const [user, setUser] = useState<UserProfile | null>(null)
  const [selectedMode, setSelectedMode] = useState<ChatMode | null>(null)
  const { bannedInterests, loading: bannedLoading } = useBannedInterests()
  const { send: sendSocket } = useSocket()
  const isLoginView = location.pathname === '/'
  const isModeView = location.pathname === '/mode'
  const shellClasses = useMemo(() => {
    const classes = ['app-shell']
    if (isLoginView) classes.push('login-shell')
    if (isModeView) classes.push('mode-shell')
    return classes.join(' ')
  }, [isLoginView, isModeView])

  const handleAuthenticated = (profile: UserProfile) => {
    setUser(profile)
    setSelectedMode(null)
    sendSocket('profile:update', profile)
  }

  const handleModeSelection = (mode: ChatMode) => {
    setSelectedMode(mode)
  }

  const handleLogout = () => {
    setUser(null)
    setSelectedMode(null)
  }

  const requireAuth = (component: ReactNode) =>
    user ? component : <Navigate to="/" replace />

  const chatsBasePath = user ? '/mode' : '/'

  return (
    <div className={shellClasses}>
      <Routes>
        <Route
          path="/"
          element={
            <LoginPage
              onAuthenticated={handleAuthenticated}
              bannedInterests={bannedInterests}
              loadingBannedList={bannedLoading}
            />
          }
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
        <Route
          path="*"
          element={<Navigate to={user ? '/mode' : '/'} replace />}
        />
      </Routes>
    </div>
  )
}

export default App

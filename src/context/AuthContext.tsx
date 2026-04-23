import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import type { UserProfile } from '../types'

type PendingSignup = {
  name: string
  email: string
  interests: string[]
}

type AuthContextValue = {
  user: UserProfile | null
  token: string | null
  pending: PendingSignup | null
  setPending: (payload: PendingSignup | null) => void
  setSession: (payload: { token: string; user: UserProfile }) => void
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

const TOKEN_KEY = 'bc.token'
const USER_KEY = 'bc.user'

const loadStored = (): { token: string | null; user: UserProfile | null } => {
  try {
    const token = localStorage.getItem(TOKEN_KEY)
    const userRaw = localStorage.getItem(USER_KEY)
    if (!token || !userRaw) return { token: null, user: null }
    return { token, user: JSON.parse(userRaw) as UserProfile }
  } catch {
    return { token: null, user: null }
  }
}

export const AuthProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [token, setToken] = useState<string | null>(null)
  const [user, setUser] = useState<UserProfile | null>(null)
  const [pending, setPending] = useState<PendingSignup | null>(null)

  useEffect(() => {
    const { token: t, user: u } = loadStored()
    if (t && u) {
      setToken(t)
      setUser(u)
    }
  }, [])

  const setSession = useCallback(
    ({ token: t, user: u }: { token: string; user: UserProfile }) => {
      localStorage.setItem(TOKEN_KEY, t)
      localStorage.setItem(USER_KEY, JSON.stringify(u))
      setToken(t)
      setUser(u)
      setPending(null)
    },
    [],
  )

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    setToken(null)
    setUser(null)
    setPending(null)
  }, [])

  const value = useMemo(
    () => ({ user, token, pending, setPending, setSession, logout }),
    [user, token, pending, setSession, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { io, type Socket } from 'socket.io-client'
import { useAuth } from './AuthContext'

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

type SocketContextValue = {
  socket: Socket | null
  status: ConnectionStatus
  error: string | null
  url: string
  send: <T>(event: string, payload: T) => void
}

const SocketContext = createContext<SocketContextValue | undefined>(undefined)

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? 'http://localhost:4000'

export const SocketProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const { token, logout } = useAuth()
  const [socket, setSocket] = useState<Socket | null>(null)
  const [status, setStatus] = useState<ConnectionStatus>('disconnected')
  const [error, setError] = useState<string | null>(null)
  const logoutRef = useRef(logout)

  useEffect(() => {
    logoutRef.current = logout
  }, [logout])

  useEffect(() => {
    if (!token) {
      setSocket(null)
      setStatus('disconnected')
      setError(null)
      return
    }

    const instance = io(SOCKET_URL, {
      autoConnect: false,
      transports: ['websocket'],
      reconnectionAttempts: 5,
      auth: { token },
    })

    setSocket(instance)
    setStatus('connecting')
    setError(null)
    instance.connect()

    instance.on('connect', () => {
      setStatus('connected')
      setError(null)
    })

    instance.on('disconnect', () => {
      setStatus('disconnected')
    })

    instance.on('connect_error', (err) => {
      setStatus('error')
      setError(err.message)
      if (/auth|token|jwt|invalid|expired/i.test(err.message)) {
        logoutRef.current()
      }
    })

    return () => {
      instance.removeAllListeners()
      instance.disconnect()
    }
  }, [token])

  const send = useCallback(
    <T,>(event: string, payload: T) => {
      if (socket && socket.connected) {
        socket.emit(event, payload)
      } else {
        console.info('Socket not connected, skipping emit for event:', event)
      }
    },
    [socket],
  )

  const value = useMemo(
    () => ({ socket, status, error, url: SOCKET_URL, send }),
    [socket, status, error, send],
  )

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>
}

export const useSocket = () => {
  const context = useContext(SocketContext)
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider')
  }
  return context
}

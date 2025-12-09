import { createContext, useCallback, useContext, useMemo, useState } from 'react'

export type ReactionType = 'like' | 'dislike' | 'report'

interface ProfileReputation {
  likes: number
  dislikes: number
  reports: number
  banned: boolean
}

interface FeedbackContextValue {
  recordReaction: (email: string, type: ReactionType) => ProfileReputation
  getReputationFor: (email: string) => ProfileReputation
  REPORT_THRESHOLD: number
  DISLIKE_THRESHOLD: number
}

const defaultReputation: ProfileReputation = {
  likes: 0,
  dislikes: 0,
  reports: 0,
  banned: false,
}

const REPORT_THRESHOLD = 3
const DISLIKE_THRESHOLD = 10

const FeedbackContext = createContext<FeedbackContextValue | undefined>(undefined)

export const FeedbackProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [reputations, setReputations] = useState<Record<string, ProfileReputation>>({})

  const recordReaction = useCallback((email: string, type: ReactionType) => {
    let next: ProfileReputation
    setReputations((current) => {
      const profile = current[email] ?? { ...defaultReputation }
      next = { ...profile }
      if (type === 'like') {
        next.likes += 1
      } else if (type === 'dislike') {
        next.dislikes += 1
      } else {
        next.reports += 1
      }
      const reachedReportBan = next.reports >= REPORT_THRESHOLD
      const reachedDislikeBan = next.dislikes >= DISLIKE_THRESHOLD
      if (reachedReportBan || reachedDislikeBan) {
        next.banned = true
      }
      return { ...current, [email]: next }
    })
    return next!
  }, [])

  const getReputationFor = useCallback(
    (email: string) => {
      return reputations[email] ?? defaultReputation
    },
    [reputations],
  )

  const value = useMemo(
    () => ({ recordReaction, getReputationFor, REPORT_THRESHOLD, DISLIKE_THRESHOLD }),
    [getReputationFor, recordReaction],
  )

  return <FeedbackContext.Provider value={value}>{children}</FeedbackContext.Provider>
}

export const useFeedback = () => {
  const context = useContext(FeedbackContext)
  if (!context) {
    throw new Error('useFeedback must be used within FeedbackProvider')
  }
  return context
}

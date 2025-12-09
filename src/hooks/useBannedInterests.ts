import { useEffect, useState } from 'react'

const SOURCE = '/banned-interests.txt'

export const useBannedInterests = () => {
  const [list, setList] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const controller = new AbortController()
    const load = async () => {
      try {
        const response = await fetch(SOURCE, { signal: controller.signal })
        if (!response.ok) {
          throw new Error('Unable to load banned interest list')
        }
        const text = await response.text()
        const nextList = text
          .split(/\r?\n/)
          .map((entry) => entry.trim().toLowerCase())
          .filter(Boolean)
        setList(nextList)
      } catch (error) {
        console.error(error)
      } finally {
        setLoading(false)
      }
    }

    load()

    return () => controller.abort()
  }, [])

  return { bannedInterests: list, loading }
}

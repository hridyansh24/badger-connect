import { useEffect, useRef } from 'react'

const BackgroundFX = () => {
  const rootRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const el = rootRef.current
    if (!el) return

    let raf = 0
    let targetX = window.innerWidth / 2
    let targetY = window.innerHeight / 2

    const handleMove = (event: PointerEvent) => {
      targetX = event.clientX
      targetY = event.clientY
      if (!raf) {
        raf = requestAnimationFrame(() => {
          el.style.setProperty('--mx', `${targetX}px`)
          el.style.setProperty('--my', `${targetY}px`)
          raf = 0
        })
      }
    }

    window.addEventListener('pointermove', handleMove, { passive: true })
    return () => {
      window.removeEventListener('pointermove', handleMove)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [])

  return (
    <div className="bg-fx" ref={rootRef} aria-hidden>
      <div className="bg-aurora" />
      <div className="bg-grid" />
      <div className="bg-orbs">
        <span className="orb orb-red" />
        <span className="orb orb-gold" />
        <span className="orb orb-violet" />
      </div>
      <div className="bg-scanlines" />
      <div className="bg-cursor" />
      <div className="bg-vignette" />
    </div>
  )
}

export default BackgroundFX

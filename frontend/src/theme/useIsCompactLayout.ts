import { useEffect, useState } from 'react'
import { MOBILE_LAYOUT_BREAKPOINT } from './tokens'

export function useIsCompactLayout() {
  const [isCompact, setIsCompact] = useState(() => {
    if (typeof window === 'undefined') {
      return false
    }
    return window.innerWidth < MOBILE_LAYOUT_BREAKPOINT
  })

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const mediaQuery = window.matchMedia(`(max-width: ${MOBILE_LAYOUT_BREAKPOINT - 1}px)`)
    const handleChange = (event: MediaQueryListEvent | MediaQueryList) => {
      setIsCompact(event.matches)
    }

    handleChange(mediaQuery)

    const legacyMediaQuery = mediaQuery as MediaQueryList & {
      addListener?: (listener: (event: MediaQueryListEvent) => void) => void
      removeListener?: (listener: (event: MediaQueryListEvent) => void) => void
    }

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleChange)
      return () => mediaQuery.removeEventListener('change', handleChange)
    }

    legacyMediaQuery.addListener?.(handleChange)
    return () => legacyMediaQuery.removeListener?.(handleChange)
  }, [])

  return isCompact
}
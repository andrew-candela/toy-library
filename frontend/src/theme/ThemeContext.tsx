import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { darkTokens, lightTokens, type Tokens } from './tokens'

const STORAGE_KEY = 'theme'

interface ThemeContextValue {
  isDark: boolean
  toggleTheme: () => void
  theme: Tokens
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

function getInitialDark(): boolean {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === 'dark') return true
  if (stored === 'light') return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [isDark, setIsDark] = useState<boolean>(getInitialDark)

  const toggleTheme = useCallback(() => {
    setIsDark((prev) => {
      const next = !prev
      localStorage.setItem(STORAGE_KEY, next ? 'dark' : 'light')
      return next
    })
  }, [])

  useEffect(() => {
    const bg = isDark ? darkTokens.bg : lightTokens.bg
    document.documentElement.style.background = bg
    document.body.style.background = bg
  }, [isDark])

  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme, theme: isDark ? darkTokens : lightTokens }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}

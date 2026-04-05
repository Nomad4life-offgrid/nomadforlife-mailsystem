'use client'

import { useState, useCallback } from 'react'

/**
 * Persistent state backed by localStorage.
 * Falls back gracefully when localStorage is unavailable (SSR, private mode).
 */
export function useLocalStorage<T>(key: string, initialValue: T): [T, (val: T | ((prev: T) => T)) => void] {
  const [stored, setStored] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key)
      return item ? (JSON.parse(item) as T) : initialValue
    } catch {
      return initialValue
    }
  })

  const setValue = useCallback((val: T | ((prev: T) => T)) => {
    setStored(prev => {
      const next = typeof val === 'function' ? (val as (p: T) => T)(prev) : val
      try {
        window.localStorage.setItem(key, JSON.stringify(next))
      } catch {
        // Quota exceeded or private mode — silently ignore
      }
      return next
    })
  }, [key])

  return [stored, setValue]
}

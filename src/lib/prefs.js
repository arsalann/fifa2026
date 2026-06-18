import { useEffect, useState } from 'react'

// localStorage-backed state that stays in sync across every component using
// the same key (same-tab via a custom event, other tabs via 'storage').
function usePersistent(key, initial) {
  const read = () => {
    try {
      const v = localStorage.getItem(key)
      return v !== null ? JSON.parse(v) : initial
    } catch {
      return initial
    }
  }
  const [value, setValue] = useState(read)

  useEffect(() => {
    const onSync = (e) => {
      if (!e.detail || e.detail.key === key) setValue(read())
    }
    const onStorage = (e) => {
      if (e.key === key) setValue(read())
    }
    window.addEventListener('prefs-sync', onSync)
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener('prefs-sync', onSync)
      window.removeEventListener('storage', onStorage)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  const set = (next) => {
    const v = typeof next === 'function' ? next(read()) : next
    try {
      localStorage.setItem(key, JSON.stringify(v))
    } catch {
      /* private mode etc. — preference just won't persist */
    }
    setValue(v)
    window.dispatchEvent(new CustomEvent('prefs-sync', { detail: { key } }))
  }
  return [value, set]
}

export function useTheme() {
  const systemDark =
    typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches
  const [theme, setTheme] = usePersistent('wc26.theme', systemDark ? 'dark' : 'light')
  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])
  return [theme, () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))]
}

export function useFavorite() {
  return usePersistent('wc26.favoriteTeam', null)
}

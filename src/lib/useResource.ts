import { useEffect, useRef, useState } from 'react'
import { normalizeError } from './errors'
import type { AppError } from './errors'

export function useResource<T>(key: string, load: () => Promise<T>) {
  const loader = useRef(load)
  const generation = useRef(0)
  const [revision, setRevision] = useState(0)
  const requestKey = `${key}:request-${revision}`
  const [state, setState] = useState<{ key: string; data: T | null; loading: boolean; error: AppError | null }>({
    key: requestKey, data: null, loading: true, error: null,
  })
  useEffect(() => { loader.current = load }, [load])
  useEffect(() => {
    const request = ++generation.current
    let active = true
    void loader.current().then(data => {
      if (active && request === generation.current) setState({ key: requestKey, data, loading: false, error: null })
    }).catch(error => {
      if (active && request === generation.current) setState({ key: requestKey, data: null, loading: false, error: normalizeError(error) })
    })
    return () => { active = false }
  }, [requestKey])
  const current = state.key === requestKey ? state : { data: null, loading: true, error: null }
  return { ...current, reload: () => setRevision(value => value + 1) }
}

export function useAction(onSettled: () => void) {
  const alive = useRef(true)
  const locked = useRef(false)
  const [pending, setPending] = useState<string | null>(null)
  const [error, setError] = useState<AppError | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  useEffect(() => {
    alive.current = true
    return () => { alive.current = false }
  }, [])
  async function run(label: string, operation: () => Promise<unknown>, success: string): Promise<boolean> {
    if (locked.current) return false
    locked.current = true
    setPending(label); setError(null); setNotice(null)
    try {
      await operation()
      if (!alive.current) return false
      setNotice(success)
      onSettled()
      return true
    } catch (failure) {
      if (alive.current) { setError(normalizeError(failure)); onSettled() }
      return false
    } finally {
      locked.current = false
      if (alive.current) setPending(null)
    }
  }
  return { run, pending, error, notice, clear: () => { setError(null); setNotice(null) } }
}

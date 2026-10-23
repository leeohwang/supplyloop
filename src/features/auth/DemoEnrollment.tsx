import { useEffect, useRef, useState } from 'react'
import { ErrorNotice, Field, Notice } from '../../components/ui'
import { joinDemoSchool } from '../../lib/api'
import { AppError, normalizeError } from '../../lib/errors'
import { EmailConfirmation } from './EmailConfirmation'
import { readPendingEmail } from './emailCode'

export function DemoEnrollment({ userId, email, onRecheck, refreshing, membershipError, onEmailBusyChange }: {
  userId: string; email: string | undefined; onRecheck: () => void; refreshing: boolean; membershipError: AppError | null
  onEmailBusyChange: (busy: boolean) => void
}) {
  const [accessCode, setAccessCode] = useState('')
  const [displayLabel, setDisplayLabel] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<AppError | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [needsEmailCode, setNeedsEmailCode] = useState(false)
  const alive = useRef(false)
  const locked = useRef(false)
  const request = useRef(0)
  const savedEmail = readPendingEmail()
  useEffect(() => {
    alive.current = true
    return () => { alive.current = false }
  }, [])

  async function join() {
    if (locked.current || refreshing) return
    const code = accessCode.trim()
    const label = displayLabel.trim()
    if (!code || !label) { setError(new AppError('INVALID_INPUT')); return }
    locked.current = true
    const currentRequest = ++request.current
    setPending(true); setError(null); setNotice(null)
    try {
      await joinDemoSchool(userId, code, label)
      if (!alive.current || request.current !== currentRequest) return
      setAccessCode('')
      setNotice('Your demo student membership is saved. Checking your school access…')
      onRecheck()
    } catch (failure) {
      if (!alive.current || request.current !== currentRequest) return
      const normalized = normalizeError(failure)
      setError(normalized)
      if (normalized.code === 'EMAIL_CONFIRMATION_REQUIRED' && email) setNeedsEmailCode(true)
      if (['NETWORK_ERROR', 'SERVER_ERROR', 'CONFLICT'].includes(normalized.code)) onRecheck()
    } finally {
      locked.current = false
      if (alive.current && request.current === currentRequest) setPending(false)
    }
  }

  return <section className="enrollment-card" aria-labelledby="enrollment-title">
    <span className="eyebrow">One more step</span>
    <h1 id="enrollment-title">Join the fictional school.</h1>
    <p>Your real demo account is signed in{email ? <> as <strong className="enrollment-email">{email}</strong></> : null}, with no active school workspace yet. Enter the organizer’s private code to join fictional School A as a student.</p>
    <div className="demo-auth-note"><strong>Demo access only</strong><p>New school enrollment requires a personal email code and the private school join code. School identity is not verified. This code grants student access to shared fictional data; the organizer provides manager access separately.</p></div>
    {needsEmailCode && email ? <EmailConfirmation key={email} confirmation={{ email, sentAt: savedEmail?.email === email ? savedEmail.sentAt : 0 }} kind="existing" userId={userId} onBusyChange={onEmailBusyChange} onVerified={() => { onEmailBusyChange(false); setNeedsEmailCode(false); setError(null); setNotice('Email code confirmed for this session. Review your display label and private school join code, then choose Join School A.') }} onBack={() => { setNeedsEmailCode(false); setError(null) }} /> : <form onSubmit={event => { event.preventDefault(); void join() }}>
      <fieldset className="form-fieldset" disabled={pending || refreshing}>
        <Field label="Fictional display label" help="Use a made-up label. School managers can see it in the pickup queue."><input name="demo-display-label" autoComplete="off" required value={displayLabel} onChange={event => setDisplayLabel(event.target.value)} /></Field>
        <Field label="Private school join code" help="Get this code privately from the organizer. It is case-sensitive and is not your personal email code."><input name="demo-access-code" type="password" autoComplete="off" autoCapitalize="none" spellCheck={false} required value={accessCode} onChange={event => setAccessCode(event.target.value)} /></Field>
        <button type="submit" className="button full" disabled={pending || refreshing}>{pending ? 'Joining the demo school…' : refreshing ? 'Checking school access…' : 'Join School A as a student'}</button>
      </fieldset>
    </form>}
    {!needsEmailCode && <ErrorNotice error={error} />}
    <ErrorNotice error={membershipError} />
    {notice && <Notice>{notice}</Notice>}
    {!needsEmailCode && <button type="button" className="text-button confirmation-recovery" disabled={pending || refreshing || !email} onClick={() => { setError(null); setNotice(null); setNeedsEmailCode(true) }}>Confirm email for school enrollment</button>}
    {!needsEmailCode && <div className="enrollment-help"><p>Already joined, or lost a response? Check again to load your saved membership. Retrying the same enrollment keeps your original display label.</p><button type="button" className="button secondary small" disabled={pending || refreshing} onClick={() => { setError(null); setNotice(null); onRecheck() }}>{refreshing ? 'Checking…' : 'Check again'}</button></div>}
  </section>
}

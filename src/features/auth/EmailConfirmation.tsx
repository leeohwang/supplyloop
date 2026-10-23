import { useEffect, useId, useRef, useState } from 'react'
import { ErrorNotice, Field } from '../../components/ui'
import {
  authErrorMessage, authFailureCode, clearPendingEmail, emailCodeLength, emailCodeLifetimeSeconds,
  emailCodeResendSeconds, requestEmailCode, savePendingEmail, verifyEmailCode,
} from './emailCode'
import type { EmailCodeRequest, PendingEmailConfirmation } from './emailCode'

export function EmailConfirmation({ confirmation, kind, userId, onEmailChange, onBack, onVerified, onBusyChange }: {
  confirmation: PendingEmailConfirmation; kind: EmailCodeRequest; userId?: string
  onEmailChange?: (email: string) => void; onBack?: () => void
  onVerified?: () => void; onBusyChange?: (busy: boolean) => void
}) {
  const [token, setToken] = useState('')
  const [pending, setPending] = useState<'verify' | 'send' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [sentAt, setSentAt] = useState(confirmation.sentAt)
  const [now, setNow] = useState(Date.now)
  const alive = useRef(false)
  const locked = useRef(false)
  const emailRef = useRef<HTMLInputElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const descriptionId = useId()
  const codeHelpId = useId()
  const remaining = Math.max(0, Math.ceil((sentAt + emailCodeResendSeconds * 1000 - now) / 1000))
  useEffect(() => {
    alive.current = true
    headingRef.current?.focus()
    const interval = window.setInterval(() => setNow(Date.now()), 1000)
    return () => { alive.current = false; window.clearInterval(interval) }
  }, [])

  async function act(phase: 'verify' | 'send') {
    if (locked.current || !emailRef.current?.reportValidity()) return
    if (phase === 'send' && remaining > 0) return
    const email = confirmation.email.trim()
    if (phase === 'verify' && !new RegExp(`^[0-9]{${emailCodeLength}}$`).test(token.trim())) {
      setError(`Enter the ${emailCodeLength}-digit code from your latest email.`); return
    }
    locked.current = true
    setPending(phase); onBusyChange?.(true); setError(null); setNotice(null)
    try {
      if (phase === 'verify') {
        await verifyEmailCode(email, token.trim(), userId)
        if (!alive.current) return
        clearPendingEmail(); setToken(''); onVerified?.()
      } else {
        const requestedAt = Date.now()
        // A lost response can still mean an email was sent. Keep retries deliberate.
        setSentAt(requestedAt); setNow(requestedAt)
        savePendingEmail({ email, sentAt: requestedAt })
        await requestEmailCode(email, kind, userId)
        if (!alive.current) return
        setToken('')
        setNotice(kind === 'existing' ? 'Code requested. Check your inbox and spam folder for the latest SupplyLoop email.' : 'If this account needs confirmation, a new code has been requested. Check your inbox and spam folder. If you already confirmed, return to Sign in.')
      }
    } catch (failure) {
      if (alive.current && authFailureCode(failure) !== 'AUTH_SUPERSEDED') setError(authErrorMessage(failure, phase))
    } finally {
      locked.current = false
      if (alive.current) { setPending(null); onBusyChange?.(false) }
    }
  }

  return <section className="email-confirmation" aria-labelledby={`${descriptionId}-title`}>
    <h2 ref={headingRef} tabIndex={-1} id={`${descriptionId}-title`}>Confirm your email.</h2>
    <p id={descriptionId}>{kind === 'existing' ? 'Before joining a school, receive and enter a personal code at your account email. Earlier demo sign-in alone does not confirm mailbox ownership.' : 'Enter the personal code from your SupplyLoop email to finish confirmation and sign in. If you already confirmed your email, return to Sign in.'}</p>
    <form onSubmit={event => { event.preventDefault(); void act('verify') }}>
      <Field label="Account email"><input ref={emailRef} name="confirmation-email" type="email" autoComplete="username" autoCapitalize="none" spellCheck={false} required readOnly={!onEmailChange} disabled={!!pending} value={confirmation.email} onChange={event => { setToken(''); setSentAt(0); setError(null); setNotice(null); clearPendingEmail(); onEmailChange?.(event.target.value) }} aria-describedby={descriptionId} /></Field>
      <Field label={`${emailCodeLength}-digit email code`}><input name="email-confirmation-code" inputMode="numeric" autoComplete="one-time-code" pattern={`[0-9]{${emailCodeLength}}`} maxLength={emailCodeLength} required disabled={!!pending} value={token} onChange={event => setToken(event.target.value.replace(/\s/g, ''))} aria-describedby={codeHelpId} /></Field>
      <p className="helper-text" id={codeHelpId}>Codes expire after {emailCodeLifetimeSeconds / 60} minutes and work once. This personal code is separate from the private school join code.</p>
      <ErrorNotice error={error} />
      {notice && <p className="auth-result" role="status">{notice}</p>}
      <button type="submit" className="button full" disabled={!!pending}>{pending === 'verify' ? 'Confirming your email…' : 'Confirm email and continue'}</button>
    </form>
    <div className="email-code-actions"><button type="button" className="button secondary full" disabled={!!pending || remaining > 0} onClick={() => void act('send')}>{pending === 'send' ? 'Requesting a code…' : remaining > 0 ? `Request another code in ${remaining}s` : sentAt > 0 ? 'Request another email code' : 'Send confirmation code'}</button>{onBack && <button type="button" className="text-button" disabled={!!pending} onClick={onBack}>{kind === 'existing' ? 'Back to school enrollment' : 'Back to sign in'}</button>}</div>
    <p className="email-delivery-help">Look for SupplyLoop from noreply@auth.joinsupplyloop.app. If no email arrives, check the address and spam folder before requesting another code.</p>
  </section>
}

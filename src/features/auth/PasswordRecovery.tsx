import { useEffect, useId, useRef, useState } from 'react'
import { ErrorNotice, Field } from '../../components/ui'
import { emailCodeLength, emailCodeLifetimeSeconds, emailCodeResendSeconds } from './emailCode'

export interface PasswordRecoveryProps {
  email: string
  verified: boolean
  sentAt: number
  pending: boolean
  error: string | null
  notice: string | null
  onEmailChange: (email: string) => void
  onRequest: (email: string) => Promise<void>
  onVerify: (email: string, code: string) => Promise<void>
  onUpdate: (password: string) => Promise<void>
  onCancel: () => Promise<void>
}

export function PasswordRecovery({ email, verified, sentAt, pending, error, notice, onEmailChange, onRequest, onVerify, onUpdate, onCancel }: PasswordRecoveryProps) {
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [repeat, setRepeat] = useState('')
  const [codeEntry, setCodeEntry] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [now, setNow] = useState(Date.now)
  const locked = useRef(false)
  const alive = useRef(false)
  const emailRef = useRef<HTMLInputElement>(null)
  const repeatRef = useRef<HTMLInputElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const titleId = useId()
  const descriptionId = useId()
  const codeHelpId = useId()
  const passwordHelpId = useId()
  const requested = sentAt > 0 || codeEntry
  const remaining = Math.max(0, Math.ceil((sentAt + emailCodeResendSeconds * 1000 - now) / 1000))

  useEffect(() => {
    alive.current = true
    const interval = window.setInterval(() => setNow(Date.now()), 1000)
    return () => { alive.current = false; window.clearInterval(interval) }
  }, [])
  useEffect(() => { headingRef.current?.focus() }, [verified, requested])

  async function act(action: 'request' | 'verify' | 'update' | 'cancel') {
    if (pending || locked.current) return
    if (action !== 'cancel' && !emailRef.current?.reportValidity()) return
    if (action === 'request' && remaining > 0) return
    if (action === 'verify' && !new RegExp(`^[0-9]{${emailCodeLength}}$`).test(code.trim())) {
      setValidationError(`Enter the ${emailCodeLength}-digit code from your latest password reset email.`)
      return
    }
    if (action === 'update' && password !== repeat) {
      setValidationError('The new passwords do not match. Enter the same password in both fields.')
      repeatRef.current?.setCustomValidity('Enter the same password in both fields.')
      repeatRef.current?.reportValidity()
      return
    }
    locked.current = true
    setValidationError(null)
    try {
      if (action === 'update') {
        const nextPassword = password
        setPassword(''); setRepeat('')
        await onUpdate(nextPassword)
      } else if (action === 'verify') {
        const nextCode = code.trim()
        setCode('')
        await onVerify(email.trim(), nextCode)
      } else if (action === 'request') {
        setCode('')
        await onRequest(email.trim())
      } else {
        setCode(''); setPassword(''); setRepeat('')
        await onCancel()
      }
    } catch {
      // The parent normally handles failures and owns all account/session state.
      if (alive.current) setValidationError('We could not confirm this action. Try again, or return to sign in.')
    } finally { locked.current = false }
  }

  function clearPasswordMismatch() {
    repeatRef.current?.setCustomValidity('')
    setValidationError(null)
  }

  return <section className="email-confirmation password-recovery" aria-labelledby={titleId} aria-busy={pending}>
    <h2 ref={headingRef} tabIndex={-1} id={titleId}>{verified ? 'Choose a new password.' : requested ? 'Enter your reset code.' : 'Reset your password.'}</h2>
    <p id={descriptionId}>{verified ? 'Your code was accepted. Save a new password, then sign in with it. Resetting your password does not change your school memberships or role.' : 'Use your account email to request a personal password reset code. Resetting your password does not change your school memberships or role.'}</p>
    <form onSubmit={event => { event.preventDefault(); void act(verified ? 'update' : requested ? 'verify' : 'request') }}>
      <Field label="Account email"><input ref={emailRef} name="password-recovery-email" type="email" autoComplete="username" autoCapitalize="none" spellCheck={false} required readOnly={verified} disabled={pending} value={email} onChange={event => { setCode(''); setValidationError(null); onEmailChange(event.target.value) }} aria-describedby={descriptionId} /></Field>
      {verified ? <>
        <Field label="New password"><input name="new-password" type="password" autoComplete="new-password" minLength={12} required disabled={pending} value={password} onChange={event => { setPassword(event.target.value); clearPasswordMismatch() }} aria-describedby={passwordHelpId} /></Field>
        <Field label="Repeat new password"><input ref={repeatRef} name="repeat-new-password" type="password" autoComplete="new-password" minLength={12} required disabled={pending} value={repeat} onChange={event => { setRepeat(event.target.value); clearPasswordMismatch() }} aria-describedby={passwordHelpId} /></Field>
        <p className="helper-text" id={passwordHelpId}>Use a unique password with at least 12 characters. Enter it exactly the same way in both fields.</p>
      </> : requested && <>
        <Field label={`${emailCodeLength}-digit password reset code`}><input name="password-reset-code" inputMode="numeric" autoComplete="one-time-code" pattern={`[0-9]{${emailCodeLength}}`} maxLength={emailCodeLength} required disabled={pending} value={code} onChange={event => { setCode(event.target.value.replace(/\s/g, '')); setValidationError(null) }} aria-describedby={codeHelpId} /></Field>
        <p className="helper-text" id={codeHelpId}>Use the latest password reset email. Codes expire after {emailCodeLifetimeSeconds / 60} minutes and work once. Requesting another reset code replaces the previous code. This is separate from email confirmation and the private school join code.</p>
      </>}
      <ErrorNotice error={validationError ?? error} />
      {notice && <p className="auth-result" role="status">{notice}</p>}
      <button type="submit" className="button full" disabled={pending}>{pending ? 'Please wait…' : verified ? 'Save new password' : requested ? 'Verify reset code' : 'Send reset code'}</button>
    </form>
    <div className="email-code-actions">
      {!verified && !requested && <button type="button" className="button secondary full" disabled={pending} onClick={() => { setValidationError(null); setCodeEntry(true) }}>I have a reset code</button>}
      {!verified && requested && <button type="button" className="button secondary full" disabled={pending || remaining > 0} onClick={() => void act('request')}>{remaining > 0 ? `Request another reset code in ${remaining}s` : sentAt > 0 ? 'Request another reset code' : 'Send a new reset code'}</button>}
      <button type="button" className="text-button" disabled={pending} onClick={() => void act('cancel')}>Back to sign in</button>
    </div>
    {!verified && <p className="email-delivery-help">If the address belongs to an eligible account, look for SupplyLoop from noreply@auth.joinsupplyloop.app. Check your inbox and spam folder before requesting another code.</p>}
  </section>
}

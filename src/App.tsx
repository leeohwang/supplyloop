import { useEffect, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase, configurationError, authSessionAction, acceptAuthEvent, subscribeAuthTransition, authRecoveryRequired, authContext, authActionKind, signOutAccount, requestPasswordRecovery, verifyPasswordRecovery, updateRecoveredPassword } from './lib/supabase'
import { isPasswordRecoveryKind } from './lib/authLifecycle'
import { clearPendingPasswordReset, readPendingPasswordReset, savePendingPasswordReset } from './lib/passwordRecovery'
import type { PendingPasswordReset } from './lib/passwordRecovery'
import { loadSchools } from './lib/api'
import { normalizeError } from './lib/errors'
import { useResource } from './lib/useResource'
import { ErrorNotice, Field, Icon, Loading } from './components/ui'
import { Catalog } from './features/catalog/Catalog'
import { Pickups } from './features/reservations/Pickups'
import { Manager } from './features/manager/Manager'
import { JudgeGuide } from './features/auth/JudgeGuide'
import { SchoolEnrollment } from './features/auth/SchoolEnrollment'
import { EmailConfirmation } from './features/auth/EmailConfirmation'
import { PasswordRecovery } from './features/auth/PasswordRecovery'
import { authErrorMessage, authFailureCode, clearPendingEmail, readPendingEmail, savePendingEmail, uncertainAuthFailure } from './features/auth/emailCode'
import type { PendingEmailConfirmation } from './features/auth/emailCode'
import type { Membership, School } from './shared/contracts'

function Brand({ large = false }: { large?: boolean }) {
  return <div className={`brand ${large ? 'brand-large' : ''}`}><span className="brand-mark"><Icon type="loop" /></span><span>SupplyLoop<span className="brand-dot">.</span></span></div>
}

function recoveryErrorMessage(failure: unknown, phase: 'send' | 'verify' | 'update') {
  const code = authFailureCode(failure)
  if (phase === 'update' && code === 'same_password') return 'Choose a new password that is different from your previous password.'
  if (phase === 'update' && ['reauthentication_needed', 'reauthentication_not_valid', 'session_not_found', 'refresh_token_not_found'].includes(code ?? '')) return 'Return to sign in and request a fresh password reset code before trying again.'
  if (uncertainAuthFailure(failure)) {
    if (phase === 'update') return 'We could not confirm the password change. It may have succeeded. Return to sign in and try the new password, or request a fresh reset code. We will not retry the change automatically.'
    if (phase === 'verify') return 'We could not confirm the reset-code response. If the new-password form does not open, request a fresh reset code before trying again.'
    return 'We could not confirm the reset-code request. Check your inbox before requesting another code after the countdown.'
  }
  return authErrorMessage(failure, phase === 'update' ? 'signup' : phase)
}

function SignIn({ onSignIn, onCreateAccount, onModeChange, onRecover, onForgotPassword, onConfirmationEmailChange, onCancelConfirmation, confirmation, pending, error, notice }: {
  onSignIn: (email: string, password: string) => Promise<void>; onCreateAccount: (email: string, password: string) => Promise<void>
  onModeChange: () => void; pending: boolean; error: string | null; notice: string | null
  confirmation: PendingEmailConfirmation | null; onRecover: (email: string) => void
  onForgotPassword: (email: string) => void
  onConfirmationEmailChange: (email: string) => void; onCancelConfirmation: () => void
}) {
  const [registering, setRegistering] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  function changeMode(next: boolean) { setRegistering(next); setPassword(''); onModeChange() }
  return <main id="main-content" tabIndex={-1} className="signin-layout">
    <div className="signin-story">
      <p className="eyebrow">A shared shelf. A stronger school.</p>
      <h1>Good things <br />deserve a <br /><em>next chapter.</em></h1>
      <p className="signin-intro">Find clothing and textbooks your school community is ready to pass along.</p>
      <div className="community-illustration" aria-hidden="true"><div className="illustration-orbit" /><div className="illustration-card garment"><Icon type="clothing" /><span>Ready to wear again</span></div><div className="illustration-card book"><Icon type="textbook" /><span>Another term ahead</span></div><div className="illustration-loop"><Icon type="loop" /></div><span className="illustration-spark spark-one">✳</span><span className="illustration-spark spark-two">+</span></div>
      <div className="signin-principles"><span><Icon type="check" />Within your school</span><span><Icon type="check" />Reviewed by staff</span><span><Icon type="check" />Free to keep</span></div>
    </div>
    <section className="signin-card" aria-labelledby="signin-title">
      {confirmation ? <>
        <span className="eyebrow" id="signin-title">Your personal email code</span>
        {notice && <p className="auth-result" role="status">{notice}</p>}
        <ErrorNotice error={error} />
        <EmailConfirmation confirmation={confirmation} kind="signup" onEmailChange={onConfirmationEmailChange} onBack={() => { setRegistering(false); setPassword(''); onCancelConfirmation() }} />
      </> : <>
      <span className="eyebrow">Welcome to SupplyLoop</span><h2 id="signin-title">{registering ? <>Create your <br />account.</> : <>Your community <br />starts here.</>}</h2><p>{registering ? 'Create your SupplyLoop account and confirm your email. Then join fictional School A with the private code shared by the organizer.' : 'Sign in to your SupplyLoop account. New here? Create an account, then join your school with a private code.'}</p>
      <div className="auth-switch" role="group" aria-label="Account access"><button type="button" aria-pressed={!registering} disabled={pending} onClick={() => changeMode(false)}>Sign in</button><button type="button" aria-pressed={registering} disabled={pending} onClick={() => changeMode(true)}>Create account</button></div>
      {registering && <div className="demo-auth-note"><strong>Your account, then your school</strong><p>Confirm your email with a personal code, then enter the separate private school join code. Your account is real; school identity is not verified and all school data is fictional. Choose a unique password. Creating an account alone grants no school access.</p></div>}
      {configurationError ? <div className="notice error" role="alert"><div><strong>Connection setup needed</strong><p>{configurationError}</p></div></div> : <form onSubmit={event => { event.preventDefault(); void (registering ? onCreateAccount : onSignIn)(email.trim(), password) }}>
        <Field label="Email address"><input name="email" type="email" autoComplete="username" autoCapitalize="none" spellCheck={false} required value={email} onChange={event => setEmail(event.target.value)} disabled={pending} placeholder="Your email address" /></Field>
        <Field label="Password" help={registering ? 'Use a unique password with at least 12 characters.' : undefined}><input name="password" type="password" autoComplete={registering ? 'new-password' : 'current-password'} minLength={registering ? 12 : undefined} required value={password} onChange={event => setPassword(event.target.value)} disabled={pending} /></Field>
        <ErrorNotice error={error} />
        {notice && <p className="auth-result" role="status">{notice}</p>}
        <button type="submit" className="button full signin-button" disabled={pending}>{pending ? registering ? 'Creating your account…' : 'Signing in…' : registering ? 'Create account' : 'Sign in'}<Icon type="arrow" /></button>
      </form>}
      {!configurationError && <button type="button" className="text-button confirmation-recovery" disabled={pending} onClick={() => { setPassword(''); onRecover(email.trim()) }}>Finish email confirmation</button>}
      {!configurationError && !registering && <button type="button" className="text-button confirmation-recovery" disabled={pending} onClick={() => { setPassword(''); onForgotPassword(email.trim()) }}>Forgot password</button>}
      <div className="signin-help"><span aria-hidden="true">↳</span><p>{registering ? 'Already created an account, or unsure whether your request completed? Sign in with the same details or finish email confirmation. Keep the personal email code separate from the school join code.' : 'Your saved membership determines school access. The private School A join code grants student access after email confirmation. The organizer supplies manager sign-in details privately.'}</p></div>
      </>}
      <JudgeGuide />
    </section>
  </main>
}

type Screen = 'find' | 'pickups' | 'manager'
function SchoolWorkspace({ school, membership, userId }: { school: School; membership: Membership; userId: string }) {
  const isManager = membership.role === 'manager'
  const [requestedScreen, setScreen] = useState<Screen>(() => isManager ? 'manager' : 'find')
  const screen: Screen = isManager ? 'manager' : requestedScreen === 'manager' ? 'find' : requestedScreen
  const [uncertainIntakeTitle, setUncertainIntakeTitle] = useState<string | null>(null)
  return <>
    <div className="workspace-nav"><nav className="main-nav" aria-label="Main navigation">{isManager ? <button aria-current="page" onClick={() => setScreen('manager')}>Manager desk</button> : <><button aria-current={screen === 'find' ? 'page' : undefined} onClick={() => setScreen('find')}>Find items</button><button aria-current={screen === 'pickups' ? 'page' : undefined} onClick={() => setScreen('pickups')}>My pickups</button></>}</nav><span className="term-label">{school.term_label}</span></div>
    <main id="main-content" tabIndex={-1} className="workspace-content" key={`${userId}:${school.id}:${membership.role}`}>
      {!isManager && screen === 'find' && <Catalog school={school} userId={userId} onReserved={() => setScreen('pickups')} />}
      {!isManager && screen === 'pickups' && <Pickups school={school} userId={userId} onFind={() => setScreen('find')} />}
      {isManager && screen === 'manager' && <Manager school={school} userId={userId} uncertainIntakeTitle={uncertainIntakeTitle} onUncertainIntake={setUncertainIntakeTitle} onInventoryReviewed={() => setUncertainIntakeTitle(null)} />}
    </main>
  </>
}

function SignedIn({ session, onSignOut }: { session: Session; onSignOut: () => void }) {
  const schools = useResource(`${session.user.id}:memberships`, () => loadSchools(session.user.id))
  const [selectedId, setSelectedId] = useState('')
  const [enrollmentVisible, setEnrollmentVisible] = useState(false)
  const [confirmingEmail, setConfirmingEmail] = useState(false)
  const authorized = schools.data?.find(entry => entry.school.id === selectedId) ?? schools.data?.[0]
  const showEnrollment = !authorized && (enrollmentVisible || schools.data?.length === 0)
  function recheckEnrollment() { setEnrollmentVisible(true); schools.reload() }
  return <>
    <header className="topbar"><Brand /><div className="account-controls">
      {authorized && <Field label="Your school" className="school-select"><select value={authorized.school.id} onChange={event => setSelectedId(event.target.value)}>{schools.data?.map(entry => <option key={entry.school.id} value={entry.school.id}>{entry.school.name}</option>)}</select></Field>}
      {authorized && <div className="account-label"><strong>{authorized.membership.display_label}</strong><span>{authorized.membership.role === 'manager' ? 'School manager' : 'School student'}</span></div>}
      <button className="button secondary small" disabled={confirmingEmail} onClick={onSignOut}>Sign out</button>
    </div></header>
    {showEnrollment ? <main id="main-content" tabIndex={-1} className="workspace-content enrollment-layout"><SchoolEnrollment key={session.user.id} userId={session.user.id} email={session.user.email} onRecheck={recheckEnrollment} refreshing={schools.loading} membershipError={schools.error} onEmailBusyChange={setConfirmingEmail} /></main> : schools.loading ? <main id="main-content" tabIndex={-1} className="workspace-content"><Loading label="Loading your school membership…" /></main> : schools.error ? <main id="main-content" tabIndex={-1} className="workspace-content"><ErrorNotice error={schools.error} retry={schools.reload} /></main> : authorized ? <SchoolWorkspace key={`${session.user.id}:${authorized.school.id}:${authorized.membership.role}`} school={authorized.school} membership={authorized.membership} userId={session.user.id} /> : null}
  </>
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [passwordRecoverySession, setPasswordRecoverySession] = useState(false)
  const [restoring, setRestoring] = useState(!!supabase)
  const [signingIn, setSigningIn] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [authNotice, setAuthNotice] = useState<string | null>(null)
  const [signoutNotice, setSignoutNotice] = useState<string | null>(null)
  const [confirmation, setConfirmation] = useState<PendingEmailConfirmation | null>(readPendingEmail)
  const [passwordReset, setPasswordReset] = useState<PendingPasswordReset | null>(readPendingPasswordReset)
  const [authTransition, setAuthTransition] = useState(false)
  const [authReconciling, setAuthReconciling] = useState(false)
  const [authRecovery, setAuthRecovery] = useState(false)
  const attempt = useRef(0)
  const authLock = useRef(false)
  const currentUserId = useRef<string | null>(null)
  useEffect(() => {
    if (!supabase) return
    let active = true
    let events = 0
    let reconciliation = 0
    function acceptSession(nextSession: Session | null, signedOut = false) {
      const nextUserId = nextSession?.user.id ?? null
      if (nextSession || signedOut) { clearPendingEmail(); setConfirmation(null) }
      if (signedOut || (nextSession && !isPasswordRecoveryKind(authActionKind()))) { clearPendingPasswordReset(); setPasswordReset(null) }
      if (nextSession) setSignoutNotice(null)
      if (signedOut || currentUserId.current !== nextUserId) {
        currentUserId.current = nextUserId
        attempt.current++
        authLock.current = false
        setSigningIn(false)
        setError(null); setAuthNotice(null)
      }
      setSession(nextSession)
      // Purpose belongs to the accepted session, not an in-flight intent from
      // another tab. Keep recovery screens until that next session reconciles.
      setPasswordRecoverySession(!!nextSession && isPasswordRecoveryKind(authActionKind()))
      setRestoring(false)
      setAuthReconciling(false)
    }
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!active) return
      if (event === 'SIGNED_OUT' && authActionKind() === 'signout') { clearPendingEmail(); setConfirmation(null) }
      // Keep this callback synchronous; membership queries run in React effects.
      if (!acceptAuthEvent(event, nextSession)) return
      events++
      acceptSession(nextSession, event === 'SIGNED_OUT')
    })
    const stopTransitions = subscribeAuthTransition(pending => {
      if (!active) return
      const request = ++reconciliation
      setAuthTransition(pending)
      const recovery = authRecoveryRequired()
      setAuthRecovery(recovery)
      if (pending || recovery) return
      setAuthReconciling(true)
      const before = events
      const context = authContext()
      // Reconcile after the complete SDK action, outside its auth callback.
      void supabase!.auth.getSession().then(({ data, error: failure }) => {
        if (!active || request !== reconciliation || events !== before || context !== authContext()) return
        if (failure) { setError(normalizeError(failure).message); setSession(null); setRestoring(false); setAuthReconciling(false); return }
        if (!acceptAuthEvent('INITIAL_SESSION', data.session)) return
        acceptSession(data.session)
      }).catch(failure => {
        if (active && request === reconciliation && context === authContext() && !authRecoveryRequired()) { setError(normalizeError(failure).message); setRestoring(false); setAuthReconciling(false) }
      })
    })
    return () => { active = false; stopTransitions(); subscription.unsubscribe() }
  }, [])

  async function signIn(email: string, password: string) {
    if (!supabase || authLock.current) return
    authLock.current = true
    const currentAttempt = ++attempt.current
    setSigningIn(true); setError(null); setAuthNotice(null); setSignoutNotice(null)
    try {
      const { data, error: failure } = await authSessionAction('signin', null, db => db.auth.signInWithPassword({ email, password }))
      if (currentAttempt !== attempt.current) return
      if (failure) {
        if (authFailureCode(failure) === 'email_not_confirmed') {
          const saved = readPendingEmail()
          const next = { email, sentAt: saved?.email === email ? saved.sentAt : 0 }
          savePendingEmail(next); setConfirmation(next)
        }
        setError(authErrorMessage(failure, 'signin'))
      }
      else if (!data.session) setError('Sign-in did not open a session. Try again, or ask the organizer for help.')
      // The auth listener owns session changes; request callbacks do not assign a session.
    } catch (failure) {
      if (currentAttempt === attempt.current && authFailureCode(failure) !== 'AUTH_SUPERSEDED') setError(authErrorMessage(failure, 'signin'))
    } finally {
      if (currentAttempt === attempt.current) { authLock.current = false; setSigningIn(false) }
    }
  }

  async function createAccount(email: string, password: string) {
    if (!supabase || authLock.current) return
    authLock.current = true
    const currentAttempt = ++attempt.current
    setSigningIn(true); setError(null); setAuthNotice(null); setSignoutNotice(null)
    try {
      const { data, error: failure } = await authSessionAction('signup', null, db => db.auth.signUp({ email, password }))
      if (currentAttempt !== attempt.current) return
      if (failure) {
        setError(authErrorMessage(failure, 'signup'))
        if (uncertainAuthFailure(failure)) {
          const next = { email, sentAt: Date.now() }; savePendingEmail(next); setConfirmation(next)
        }
      } else if (!data.session) {
        const next = { email, sentAt: Date.now() }; savePendingEmail(next); setConfirmation(next)
        setAuthNotice('If this account needs confirmation, check your inbox for a SupplyLoop code. Already confirmed? Return to Sign in.')
      }
      // SIGNED_IN mounts the separate enrollment step. No code or role is sent to Auth.
    } catch (failure) {
      if (currentAttempt === attempt.current && authFailureCode(failure) !== 'AUTH_SUPERSEDED') {
        setError(authErrorMessage(failure, 'signup'))
        if (uncertainAuthFailure(failure)) {
          const next = { email, sentAt: Date.now() }; savePendingEmail(next); setConfirmation(next)
        }
      }
    } finally {
      if (currentAttempt === attempt.current) { authLock.current = false; setSigningIn(false) }
    }
  }

  async function recoverPassword(phase: 'send' | 'verify' | 'update', email: string, value = '') {
    if (!supabase || authLock.current) return
    const actor = session?.user.email ? { userId: session.user.id, email: session.user.email } : null
    const context = authContext()
    if (phase === 'update' && (!actor || !isPasswordRecoveryKind(authActionKind()))) { setError('Request and verify a fresh password reset code before choosing a new password.'); return }
    authLock.current = true
    const currentAttempt = ++attempt.current
    setSigningIn(true); setError(null); setAuthNotice(null); setSignoutNotice(null)
    if (phase === 'send') {
      // A lost response can still mean the email was sent. Never resend in an effect.
      const next = { email, sentAt: Date.now() }
      savePendingPasswordReset(next); setPasswordReset(next)
    }
    try {
      if (phase === 'send') await requestPasswordRecovery(email)
      else if (phase === 'verify') await verifyPasswordRecovery(email, value)
      else if (actor) {
        const result = await updateRecoveredPassword(actor, context, value)
        if (result.context === authContext()) {
          clearPendingPasswordReset(); setPasswordReset(null)
          setSignoutNotice(result.localOnly
            ? 'Your password was updated and this browser was signed out. Server sign-out could not be confirmed. Sign in with your new password.'
            : 'Your password was updated. Sign in with your new password.')
        }
      }
      if (currentAttempt !== attempt.current) return
      if (phase === 'send') setAuthNotice('If this address belongs to an account that can reset its password, check your inbox and spam folder for the latest SupplyLoop password reset code.')
    } catch (failure) {
      if (currentAttempt === attempt.current && authFailureCode(failure) !== 'AUTH_SUPERSEDED') setError(recoveryErrorMessage(failure, phase))
    } finally {
      if (currentAttempt === attempt.current) { authLock.current = false; setSigningIn(false) }
    }
  }

  function startPasswordRecovery(email: string) {
    clearPendingEmail(); setConfirmation(null)
    const saved = readPendingPasswordReset()
    const address = email || saved?.email || ''
    const next = { email: address, sentAt: saved?.email.toLowerCase() === address.toLowerCase() ? saved.sentAt : 0 }
    savePendingPasswordReset(next); setPasswordReset(next)
    setError(null); setAuthNotice(null); setSignoutNotice(null)
  }

  async function cancelPasswordRecovery() {
    if (session) await signOut()
    else { clearPendingPasswordReset(); setPasswordReset(null); setError(null); setAuthNotice(null) }
  }

  async function signOut() {
    if (!supabase || signingOut) return
    const actor = currentUserId.current
    clearPendingEmail(); setConfirmation(null)
    clearPendingPasswordReset(); setPasswordReset(null)
    attempt.current++
    setSigningOut(true); setSigningIn(false); setError(null); setAuthNotice(null); setSignoutNotice(null)
    try {
      const result = await signOutAccount()
      if (result.localOnly) setSignoutNotice('Signed out on this browser. The server could not confirm session revocation; sign in again to continue.')
    } catch (failure) { if (currentUserId.current === actor && authFailureCode(failure) !== 'AUTH_SUPERSEDED') setError(authErrorMessage(failure, 'signin')) }
    finally { setSigningOut(false) }
  }

  const hideWorkspace = authTransition || authReconciling || authRecovery
  const recoveredSession = session && passwordRecoverySession ? session : null
  const showPasswordRecovery = !!recoveredSession || (!session && !!passwordReset)
  return <div className="app-shell">
    <a className="skip-link" href={hideWorkspace && !signingOut ? '#auth-transition' : '#main-content'}>Skip to main content</a>
    <div className="demo-banner"><span><i aria-hidden="true" />Fictional demo data</span><span>A shared shelf for your school.</span></div>
    {hideWorkspace && !signingOut && <main id="auth-transition" tabIndex={-1} className="workspace-content">{authRecovery ? <div className="notice error" role="alert"><div><strong>An account change was interrupted.</strong><p>Sign out before continuing so an earlier account is not reopened.</p><ErrorNotice error={error} /><button className="button secondary" onClick={() => void signOut()}>Sign out and retry</button></div></div> : <Loading label="Updating your signed-in session…" />}</main>}
    <div className="auth-view" hidden={hideWorkspace && !signingOut}>
      {restoring || signingOut ? <><header className="topbar"><Brand /></header><main id="main-content" tabIndex={-1} className="workspace-content"><Loading label={signingOut ? 'Signing out and clearing your workspace…' : 'Restoring your session…'} /></main></> : showPasswordRecovery ? <><header className="topbar signin-topbar"><Brand /><span className="topbar-note">Recover your account</span></header><main id="main-content" tabIndex={-1} className="workspace-content enrollment-layout"><div className="signin-card"><PasswordRecovery key={recoveredSession?.user.id ?? 'guest-reset'} email={recoveredSession?.user.email ?? passwordReset?.email ?? ''} verified={!!recoveredSession} sentAt={passwordReset?.sentAt ?? 0} pending={signingIn} error={error} notice={authNotice} onEmailChange={email => { const next = { email, sentAt: 0 }; savePendingPasswordReset(next); setPasswordReset(next); setError(null); setAuthNotice(null) }} onRequest={email => recoverPassword('send', email)} onVerify={(email, code) => recoverPassword('verify', email, code)} onUpdate={password => recoverPassword('update', recoveredSession?.user.email ?? '', password)} onCancel={cancelPasswordRecovery} /></div></main></> : session ? (!hideWorkspace ? <><SignedIn key={session.user.id} session={session} onSignOut={() => void signOut()} />{error && <div className="global-error"><ErrorNotice error={error} /></div>}</> : null) : <><header className="topbar signin-topbar"><Brand /><span className="topbar-note">Less waste. More possibility.</span></header><SignIn onSignIn={signIn} onCreateAccount={createAccount} onForgotPassword={startPasswordRecovery} onModeChange={() => { setError(null); setAuthNotice(null) }} confirmation={confirmation} onRecover={email => { const next = { email, sentAt: 0 }; clearPendingEmail(); setConfirmation(next); setError(null); setAuthNotice(null) }} onConfirmationEmailChange={email => { setConfirmation({ email, sentAt: 0 }); setError(null); setAuthNotice(null) }} onCancelConfirmation={() => { clearPendingEmail(); setConfirmation(null); setError(null); setAuthNotice(null) }} pending={signingIn} error={error} notice={authNotice ?? signoutNotice} /></>}
    </div>
    <footer className="app-footer"><span>SupplyLoop<span className="brand-dot">.</span></span><p>Shared with care. Passed on with purpose.</p><span>School community prototype</span></footer>
  </div>
}

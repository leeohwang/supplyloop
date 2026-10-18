import { useEffect, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase, configurationError } from './lib/supabase'
import { loadSchools } from './lib/api'
import { normalizeError } from './lib/errors'
import { useResource } from './lib/useResource'
import { ErrorNotice, Field, Icon, Loading } from './components/ui'
import { Catalog } from './features/catalog/Catalog'
import { Pickups } from './features/reservations/Pickups'
import { Manager } from './features/manager/Manager'
import { JudgeGuide } from './features/auth/JudgeGuide'
import { DemoEnrollment } from './features/auth/DemoEnrollment'
import type { Membership, School } from './shared/contracts'

function Brand({ large = false }: { large?: boolean }) {
  return <div className={`brand ${large ? 'brand-large' : ''}`}><span className="brand-mark"><Icon type="loop" /></span><span>SupplyLoop<span className="brand-dot">.</span></span></div>
}

function SignIn({ onSignIn, onRegister, onModeChange, pending, error, notice }: {
  onSignIn: (email: string, password: string) => Promise<void>; onRegister: (email: string, password: string) => Promise<void>
  onModeChange: () => void; pending: boolean; error: string | null; notice: string | null
}) {
  const [registering, setRegistering] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  function changeMode(next: boolean) { setRegistering(next); setPassword(''); onModeChange() }
  return <main id="main-content" tabIndex={-1} className="signin-layout">
    <div className="signin-story">
      <p className="eyebrow">A shared shelf. A stronger school.</p>
      <h1>Good things<br />deserve a<br /><em>next chapter.</em></h1>
      <p className="signin-intro">Find clothing and textbooks your school community is ready to pass along.</p>
      <div className="community-illustration" aria-hidden="true"><div className="illustration-orbit" /><div className="illustration-card garment"><Icon type="clothing" /><span>Ready to wear again</span></div><div className="illustration-card book"><Icon type="textbook" /><span>Another term ahead</span></div><div className="illustration-loop"><Icon type="loop" /></div><span className="illustration-spark spark-one">✳</span><span className="illustration-spark spark-two">+</span></div>
      <div className="signin-principles"><span><Icon type="check" />Within your school</span><span><Icon type="check" />Reviewed by staff</span><span><Icon type="check" />Free to keep</span></div>
    </div>
    <section className="signin-card" aria-labelledby="signin-title">
      <span className="eyebrow">Welcome to SupplyLoop</span><h2 id="signin-title">{registering ? <>Create your<br />demo account.</> : <>Your community<br />starts here.</>}</h2><p>{registering ? 'Create an account, then enter the organizer’s private code to join fictional School A as a student.' : 'Sign in with your demo account, including the student or manager account supplied privately by the organizer.'}</p>
      <div className="auth-switch" role="group" aria-label="Account access"><button type="button" aria-pressed={!registering} disabled={pending} onClick={() => changeMode(false)}>Sign in</button><button type="button" aria-pressed={registering} disabled={pending} onClick={() => changeMode(true)}>Register for demo</button></div>
      {registering && <div className="demo-auth-note"><strong>A real account for fictional data</strong><p>Email ownership and school identity are not verified. No confirmation email is sent. Choose a unique password for this demo; account creation alone does not grant school access.</p></div>}
      {configurationError ? <div className="notice error" role="alert"><div><strong>Connection setup needed</strong><p>{configurationError}</p></div></div> : <form onSubmit={event => { event.preventDefault(); void (registering ? onRegister : onSignIn)(email.trim(), password) }}>
        <Field label="Email address"><input name="email" type="email" autoComplete="username" autoCapitalize="none" spellCheck={false} required value={email} onChange={event => setEmail(event.target.value)} disabled={pending} placeholder="Your demo account email" /></Field>
        <Field label="Password"><input name="password" type="password" autoComplete={registering ? 'new-password' : 'current-password'} required value={password} onChange={event => setPassword(event.target.value)} disabled={pending} /></Field>
        <ErrorNotice error={error} />
        {notice && <p className="auth-result" role="status">{notice}</p>}
        <button type="submit" className="button full signin-button" disabled={pending}>{pending ? registering ? 'Creating your account…' : 'Signing in…' : registering ? 'Create demo account' : 'Sign in'}<Icon type="arrow" /></button>
      </form>}
      <div className="signin-help"><span aria-hidden="true">↳</span><p>{registering ? 'Registered before, or unsure whether your request completed? Sign in with the same details to continue enrollment. Ask the organizer if you need help.' : 'School access and roles come from saved memberships. New demo registrations join only School A as students after entering the private access code.'}</p></div>
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
  const authorized = schools.data?.find(entry => entry.school.id === selectedId) ?? schools.data?.[0]
  const showEnrollment = !authorized && (enrollmentVisible || schools.data?.length === 0)
  function recheckEnrollment() { setEnrollmentVisible(true); schools.reload() }
  return <>
    <header className="topbar"><Brand /><div className="account-controls">
      {authorized && <Field label="Your school" className="school-select"><select value={authorized.school.id} onChange={event => setSelectedId(event.target.value)}>{schools.data?.map(entry => <option key={entry.school.id} value={entry.school.id}>{entry.school.name}</option>)}</select></Field>}
      {authorized && <div className="account-label"><strong>{authorized.membership.display_label}</strong><span>{authorized.membership.role === 'manager' ? 'School manager' : 'School student'}</span></div>}
      <button className="button secondary small" onClick={onSignOut}>Sign out</button>
    </div></header>
    {showEnrollment ? <main id="main-content" tabIndex={-1} className="workspace-content enrollment-layout"><DemoEnrollment key={session.user.id} userId={session.user.id} email={session.user.email} onRecheck={recheckEnrollment} refreshing={schools.loading} membershipError={schools.error} /></main> : schools.loading ? <main id="main-content" tabIndex={-1} className="workspace-content"><Loading label="Loading your school membership…" /></main> : schools.error ? <main id="main-content" tabIndex={-1} className="workspace-content"><ErrorNotice error={schools.error} retry={schools.reload} /></main> : authorized ? <SchoolWorkspace key={`${session.user.id}:${authorized.school.id}:${authorized.membership.role}`} school={authorized.school} membership={authorized.membership} userId={session.user.id} /> : null}
  </>
}

function authErrorMessage(failure: unknown, registering: boolean): string {
  const code = failure && typeof failure === 'object' && 'code' in failure ? failure.code : null
  if (code === 'invalid_credentials') return 'Email or password was not recognized. Check your demo account details.'
  if (code === 'weak_password') return 'Choose a stronger, longer password and try again.'
  if (code === 'email_address_invalid') return 'Enter a valid email address and try again.'
  if (code === 'user_already_exists' || code === 'email_exists') return 'We could not create an account with these details. If you registered before, choose Sign in to continue enrollment.'
  if (code === 'signup_disabled' || code === 'email_address_not_authorized') return 'Demo registration is unavailable. Ask the organizer to check account setup, or use your existing demo account.'
  if (code === 'email_not_confirmed') return 'This account cannot sign in yet. Ask the organizer to check the demo account setup.'
  if (code === 'over_request_rate_limit' || code === 'over_email_send_rate_limit') return 'Too many attempts. Wait a little before trying again, or use an existing demo account.'
  const normalized = normalizeError(failure)
  return registering && (normalized.code === 'SERVER_ERROR' || normalized.code === 'NETWORK_ERROR')
    ? 'We could not confirm whether registration completed. Try signing in with the same details before creating another account. Ask the organizer if you need help.'
    : normalized.message
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [restoring, setRestoring] = useState(!!supabase)
  const [signingIn, setSigningIn] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [authNotice, setAuthNotice] = useState<string | null>(null)
  const attempt = useRef(0)
  const authLock = useRef(false)
  const currentUserId = useRef<string | null>(null)
  useEffect(() => {
    if (!supabase) return
    let active = true
    let events = 0
    function acceptSession(nextSession: Session | null, signedOut = false) {
      const nextUserId = nextSession?.user.id ?? null
      if (signedOut || currentUserId.current !== nextUserId) {
        currentUserId.current = nextUserId
        attempt.current++
        authLock.current = false
        setSigningIn(false)
        setError(null); setAuthNotice(null)
      }
      setSession(nextSession)
      setRestoring(false)
    }
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!active) return
      events++
      // Keep this callback synchronous; membership queries run in React effects.
      acceptSession(nextSession, event === 'SIGNED_OUT')
    })
    const before = events
    void supabase.auth.getSession().then(({ data, error: failure }) => {
      if (!active || events !== before) return
      if (failure) setError(normalizeError(failure).message)
      acceptSession(data.session)
    }).catch(failure => {
      if (active && events === before) { setError(normalizeError(failure).message); setRestoring(false) }
    })
    return () => { active = false; subscription.unsubscribe() }
  }, [])

  async function signIn(email: string, password: string) {
    if (!supabase || authLock.current) return
    authLock.current = true
    const currentAttempt = ++attempt.current
    setSigningIn(true); setError(null); setAuthNotice(null)
    try {
      const { data, error: failure } = await supabase.auth.signInWithPassword({ email, password })
      if (currentAttempt !== attempt.current) return
      if (failure) setError(authErrorMessage(failure, false))
      else if (!data.session) setError('Sign-in did not open a session. Try again, or ask the organizer for help.')
      // The auth listener owns session changes; request callbacks do not assign a session.
    } catch (failure) {
      if (currentAttempt === attempt.current) setError(authErrorMessage(failure, false))
    } finally {
      if (currentAttempt === attempt.current) { authLock.current = false; setSigningIn(false) }
    }
  }

  async function register(email: string, password: string) {
    if (!supabase || authLock.current) return
    authLock.current = true
    const currentAttempt = ++attempt.current
    setSigningIn(true); setError(null); setAuthNotice(null)
    try {
      const { data, error: failure } = await supabase.auth.signUp({ email, password })
      if (currentAttempt !== attempt.current) return
      if (failure) setError(authErrorMessage(failure, true))
      else if (!data.session) setAuthNotice('No session opened. If you already registered, choose Sign in to continue. This demo sends no confirmation email; ask the organizer if sign-in does not work.')
      // SIGNED_IN mounts the separate enrollment step. No code or role is sent to Auth.
    } catch (failure) {
      if (currentAttempt === attempt.current) setError(authErrorMessage(failure, true))
    } finally {
      if (currentAttempt === attempt.current) { authLock.current = false; setSigningIn(false) }
    }
  }

  async function signOut() {
    if (!supabase || signingOut) return
    const actor = currentUserId.current
    attempt.current++
    setSigningOut(true); setSigningIn(false); setError(null); setAuthNotice(null)
    try {
      const { error: failure } = await supabase.auth.signOut({ scope: 'local' })
      if (failure && currentUserId.current === actor) setError(normalizeError(failure).message)
    } catch (failure) { if (currentUserId.current === actor) setError(normalizeError(failure).message) }
    finally { setSigningOut(false) }
  }

  return <div className="app-shell">
    <a className="skip-link" href="#main-content">Skip to main content</a>
    <div className="demo-banner"><span><i aria-hidden="true" />Fictional demo data</span><span>A shared shelf for your school.</span></div>
    {restoring || signingOut ? <><header className="topbar"><Brand /></header><main id="main-content" tabIndex={-1} className="workspace-content"><Loading label={signingOut ? 'Signing out and clearing your workspace…' : 'Restoring your session…'} /></main></> : session ? <><SignedIn key={session.user.id} session={session} onSignOut={() => void signOut()} />{error && <div className="global-error"><ErrorNotice error={error} /></div>}</> : <><header className="topbar signin-topbar"><Brand /><span className="topbar-note">Less waste. More possibility.</span></header><SignIn onSignIn={signIn} onRegister={register} onModeChange={() => { setError(null); setAuthNotice(null) }} pending={signingIn} error={error} notice={authNotice} /></>}
    <footer className="app-footer"><span>SupplyLoop<span className="brand-dot">.</span></span><p>Shared with care. Passed on with purpose.</p><span>School community prototype</span></footer>
  </div>
}

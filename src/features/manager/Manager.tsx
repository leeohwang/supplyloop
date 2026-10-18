import { useState } from 'react'
import { releaseReasons, retirementReasons } from '../../shared/contracts'
import type { CatalogItem, EventAction, IntakeInput, ReleaseReason, Reservation, RetirementReason, School } from '../../shared/contracts'
import { cancelReservation, completePickup, intakeItem, loadManager, publishItem, retireItem, updateItem } from '../../lib/api'
import { useAction, useResource } from '../../lib/useResource'
import { Empty, ErrorNotice, Field, Icon, ItemFacts, Loading, Modal, Notice, Status } from '../../components/ui'
import { dateTime, sentence } from '../../lib/format'
import { normalizeError } from '../../lib/errors'
import { ItemEditor } from './ItemEditor'

type Tab = 'inventory' | 'queue' | 'history'
type Decision = { kind: 'publish'; item: CatalogItem } | { kind: 'retire'; item: CatalogItem }
  | { kind: 'release'; reservation: Reservation } | { kind: 'complete'; reservation: Reservation }
const eventLabels: Record<EventAction, string> = {
  intake_received: 'Item received', published: 'Published for the school', details_updated: 'Item details corrected',
  reserved: 'Reserved', cancelled: 'Reservation cancelled', released: 'Reservation released',
  pickup_completed: 'Collection confirmed', retired: 'Item retired',
}

export function Manager({ school, userId, uncertainIntakeTitle, onUncertainIntake, onInventoryReviewed }: {
  school: School; userId: string; uncertainIntakeTitle: string | null;
  onUncertainIntake: (title: string) => void; onInventoryReviewed: () => void
}) {
  const [tab, setTab] = useState<Tab>('inventory')
  const [inventoryStatus, setInventoryStatus] = useState('all')
  const [editing, setEditing] = useState<CatalogItem | 'new' | null>(null)
  const [decision, setDecision] = useState<Decision | null>(null)
  const [reason, setReason] = useState('')
  const [inspected, setInspected] = useState(false)
  const resource = useResource(`${userId}:${school.id}:manager:${tab}`, () => loadManager(school.id))
  const action = useAction(resource.reload)
  const data = resource.data
  const active = data?.reservations.filter(row => row.status === 'active') ?? []
  const completed = data?.reservations.filter(row => row.status === 'completed') ?? []
  const inventory = data?.items.filter(item => inventoryStatus === 'all' || item.status === inventoryStatus) ?? []
  const itemFor = (id: string) => data?.items.find(item => item.id === id)
  const memberLabel = (id: string) => data?.memberships.find(member => member.user_id === id)?.display_label ?? 'School member'
  const eligibleStudent = (reservation: Reservation) => data?.memberships.some(member =>
    member.school_id === school.id && member.user_id === reservation.member_id
    && member.active && member.role === 'member') ?? false
  function chooseDecision(value: Decision) {
    setDecision(value); setReason(''); setInspected(false); action.clear()
  }
  async function save(value: IntakeInput): Promise<boolean> {
    if (uncertainIntakeTitle && editing === 'new') return false
    return action.run('save', async () => {
      if (editing && editing !== 'new') return updateItem(editing, value.details, value.storage_code)
      try { return await intakeItem(school.id, value) }
      catch (failure) {
        const normalized = normalizeError(failure)
        if (normalized.code === 'NETWORK_ERROR' || normalized.code === 'SERVER_ERROR') {
          onUncertainIntake(value.details.title?.trim() || 'Untitled intake draft')
        }
        throw normalized
      }
    },
    editing === 'new' ? 'Item received as a draft. Complete its details and inspect it before publishing.' : 'Item details updated.')
  }
  function reviewInventory() {
    setEditing(null); setInventoryStatus('all'); setTab('inventory'); resource.reload()
  }
  async function confirmDecision() {
    if (!decision) return
    const submittedDecision = decision
    let success = false
    if (decision.kind === 'publish') success = await action.run(decision.item.id, () => publishItem(decision.item), 'Item published. Your school can now find and reserve it.')
    else if (decision.kind === 'retire') success = await action.run(decision.item.id, () => retireItem(decision.item, reason as RetirementReason), 'Item retired. Its history has been retained.')
    else if (decision.kind === 'release') success = await action.run(decision.reservation.id, () => cancelReservation(decision.reservation, reason as ReleaseReason), 'Reservation released. The item is available again.')
    else success = await action.run(decision.reservation.id, () => completePickup(decision.reservation), 'Collection confirmed. Stock and the handoff record have been updated.')
    if (success) setDecision(current => current === submittedDecision ? null : current)
  }
  const decisionItem = decision ? itemFor('item' in decision ? decision.item.id : decision.reservation.item_id) : null
  const decisionReservation = decision && 'reservation' in decision ? data?.reservations.find(row => row.id === decision.reservation.id) : null
  const decisionAllowed = !!decisionItem && !!decision && (decision.kind === 'publish' ? decisionItem.status === 'intake'
    : decision.kind === 'retire' ? ['intake', 'available'].includes(decisionItem.status)
    : decisionReservation?.status === 'active' && (decision.kind !== 'complete'
      || (decisionReservation.member_id !== userId && eligibleStudent(decisionReservation))))
  return <section aria-labelledby="manager-title">
    <div className="page-heading"><div><p className="eyebrow">A little care keeps things moving</p><h1 id="manager-title">Manager desk.</h1><p>Receive, review, and hand over items for {school.name}.</p></div><button className="button" disabled={!!uncertainIntakeTitle} onClick={() => { action.clear(); setEditing('new') }}>+ Receive an item</button></div>
    {uncertainIntakeTitle && <div className="notice error" role="alert"><div><strong>Review inventory before receiving this item again.</strong><p>The response for “{uncertainIntakeTitle}” was not confirmed. It may already be recorded. Check the newest inventory entries before submitting another intake for the same physical object.</p>{tab === 'inventory' && inventoryStatus === 'all' && data && !resource.loading && !resource.error ? <button className="button secondary small" onClick={onInventoryReviewed}>I’ve reviewed the inventory</button> : <button className="button secondary small" onClick={reviewInventory} disabled={resource.loading}>Review inventory</button>}</div></div>}
    {data && !resource.error && <div className="stats-grid">
      <div><span>Available items</span><strong>{data.items.filter(item => item.status === 'available').length}</strong><small>Ready for the next person</small></div>
      <div><span>Active reservations</span><strong>{active.length}</strong><small>Waiting for collection</small></div>
      <div><span>Completed demo transfers</span><strong>{completed.length}</strong><small>Confirmed physical handoffs</small></div>
    </div>}
    <div className="manager-toolbar"><div className="subnav" aria-label="Manager views">{(['inventory', 'queue', 'history'] as const).map(value => <button key={value} aria-pressed={tab === value} onClick={() => { setTab(value); action.clear() }}>{value === 'queue' ? 'Pickup queue' : sentence(value)}{value === 'queue' && active.length > 0 && <span className="count-pill">{active.length}</span>}</button>)}</div><button className="text-button" onClick={resource.reload} disabled={resource.loading}>Refresh records</button></div>
    <ErrorNotice error={resource.error} retry={resource.reload} /><ErrorNotice error={action.error} />{action.notice && <Notice>{action.notice}</Notice>}
    {resource.loading ? <Loading /> : !resource.error && data && <>
      {tab === 'inventory' && <>
        <div className="section-heading inventory-heading"><div><h2>School inventory</h2><p className="muted">One record for each physical item. Drafts stay private until published.</p></div><Field label="Inventory status"><select value={inventoryStatus} onChange={event => setInventoryStatus(event.target.value)}><option value="all">All statuses</option><option value="intake">Draft intake</option><option value="available">Available</option><option value="reserved">Reserved</option><option value="transferred">Collected</option><option value="retired">Retired</option></select></Field></div>
        {inventory.length ? <div className="inventory-list">{inventory.map(item => {
          const staff = data.staff.find(row => row.item_id === item.id)
          const editable = item.status === 'intake' || item.status === 'available'
          return <article className="inventory-row" key={item.id}>
            <span className={`small-item-icon visual-${item.category}`}><Icon type={item.category} /></span>
            <div className="inventory-summary"><div className="inline-meta"><span className="mono">{item.item_code}</span><Status value={item.status} /></div><h3>{item.title || 'Untitled intake draft'}</h3><p>{item.category === 'clothing' ? `${item.garment_type ? sentence(item.garment_type) : 'Garment not entered'} · ${item.size_label || 'Size not entered'} · ${item.color_variant || 'Variant not entered'}` : `${item.isbn13 || 'ISBN not entered'} · ${item.edition || 'Edition not entered'}`}</p><small>Storage: {staff?.storage_code || 'Not entered'}</small></div>
            {editable && <div className="inventory-actions"><button className="button secondary small" onClick={() => { action.clear(); setEditing(item) }}>Edit details</button>{item.status === 'intake' && <button className="button small" onClick={() => chooseDecision({ kind: 'publish', item })}>Review & publish</button>}<button className="text-button danger-text" onClick={() => chooseDecision({ kind: 'retire', item })}>Retire</button></div>}
          </article>
        })}</div> : <Empty title="No items in this view.">{data.items.length ? 'Choose a different status to see more inventory.' : 'Receive your first donated item to begin the school’s inventory.'}</Empty>}
      </>}
      {tab === 'queue' && <>
        <div className="section-heading"><div><h2>Ready for a handoff</h2><p className="muted">Confirm collection only when the physical item has been handed over.</p></div></div>
        {active.length ? <div className="stack">{active.map(reservation => {
          const item = itemFor(reservation.item_id)
          const staff = data.staff.find(row => row.item_id === reservation.item_id)
          const own = reservation.member_id === userId
          const canCollect = !own && eligibleStudent(reservation)
          return <article className="queue-card" key={reservation.id}><div className="queue-heading"><span className="small-item-icon"><Icon type={item?.category ?? 'clothing'} /></span><div><span className="eyebrow">{item?.item_code ?? 'Item record unavailable'}</span><h3>{item?.title || 'Item details unavailable'}</h3><p>For <strong>{memberLabel(reservation.member_id)}</strong></p></div><Status value="active" /></div><div className="queue-detail"><span><strong>Storage</strong>{staff?.storage_code || 'Not entered'}</span><span><strong>Reserved</strong>{dateTime(reservation.created_at)}</span></div>{!canCollect && <p className="helper-text">Review or release this reservation. Collection requires an active school student; managers cannot receive items.</p>}<div className="queue-actions"><button className="text-button" onClick={() => chooseDecision({ kind: 'release', reservation })}>Release reservation</button><button className="button" disabled={!canCollect || !item || !!action.pending} onClick={() => chooseDecision({ kind: 'complete', reservation })}>Confirm collection<Icon type="check" /></button></div></article>
        })}</div> : <Empty title="The pickup queue is clear.">Active school reservations appear here when a member reserves an item.</Empty>}
      </>}
      {tab === 'history' && <>
        <div className="section-heading"><div><h2>School activity</h2><p className="muted">Server-recorded actions and confirmations. History cannot be edited here.</p></div></div>
        {data.events.length ? <ol className="timeline">{data.events.map(event => {
          const item = itemFor(event.item_id)
          return <li key={event.id}><span className="timeline-dot" aria-hidden="true" /><div><div className="timeline-title"><h3>{eventLabels[event.action]}</h3><time dateTime={event.created_at}>{dateTime(event.created_at)}</time></div><p><strong>{item?.item_code || 'Item'}</strong> · {item?.title || 'Untitled draft'}</p><small>{memberLabel(event.actor_id)}{event.reason ? ` · ${sentence(event.reason)}` : ''}</small></div></li>
        })}</ol> : <Empty title="A fresh start.">Receipt, publication, reservation, and collection events will appear here.</Empty>}
      </>}
    </>}
    {editing && <ItemEditor key={editing === 'new' ? 'new' : editing.id} item={editing === 'new' ? undefined : editing} staff={editing === 'new' ? undefined : data?.staff.find(row => row.item_id === editing.id)} onClose={() => setEditing(null)} onSave={save} pending={!!action.pending} blocked={resource.loading || !!resource.error} uncertainIntake={editing === 'new' && !!uncertainIntakeTitle} onReviewInventory={reviewInventory} error={action.error} />}
    {decision && <Modal title={decision.kind === 'publish' ? 'Review and publish' : decision.kind === 'retire' ? 'Retire this item?' : decision.kind === 'release' ? 'Release this reservation?' : 'Confirm physical collection'} onClose={() => setDecision(null)}>
      {decisionItem && <><p className="eyebrow">{decisionItem.item_code}</p><h3>{decisionItem.title || 'Untitled intake draft'}</h3><ItemFacts item={decisionItem} /></>}
      {decision.kind === 'publish' && <><div className="pickup-note"><strong>Private storage location</strong><span>{data?.staff.find(row => row.item_id === decision.item.id)?.storage_code || 'Not entered — edit the draft before publishing.'}</span></div><label className="checkbox-field"><input type="checkbox" checked={inspected} onChange={event => setInspected(event.target.checked)} /><span>I inspected this physical item and approve it as suitable and ready for reuse in this school.</span></label></>}
      {decision.kind === 'retire' && <><p>The item will leave the available inventory. Its history stays recorded.</p><Field label="Retirement reason"><select required value={reason} onChange={event => setReason(event.target.value)}><option value="">Choose a reason</option>{retirementReasons.map(value => <option key={value} value={value}>{sentence(value)}</option>)}</select></Field></>}
      {decision.kind === 'release' && <><p>The reservation for <strong>{memberLabel(decision.reservation.member_id)}</strong> will be cancelled and the item made available again.</p><Field label="Release reason"><select required value={reason} onChange={event => setReason(event.target.value)}><option value="">Choose a reason</option>{releaseReasons.map(value => <option key={value} value={value}>{sentence(value)}</option>)}</select></Field></>}
      {decision.kind === 'complete' && <div className="pickup-note"><strong>Handing this item to {memberLabel(decision.reservation.member_id)}</strong><span>Confirm only after the physical handoff. This is a permanent gift.</span></div>}
      <ErrorNotice error={action.error} />
      {!resource.loading && !decisionAllowed && <p className="helper-text">{decision.kind === 'complete' ? 'Collection requires an active school student and an active reservation. Close this dialog to review or release the reservation.' : 'This record has changed. Close this dialog to review its latest status.'}</p>}
      <div className="modal-actions"><button className="button secondary" onClick={() => setDecision(null)}>Go back</button><button className={`button ${decision.kind === 'retire' ? 'danger' : ''}`} disabled={!!action.pending || resource.loading || !decisionAllowed || (decision.kind === 'publish' && !inspected) || ((decision.kind === 'release' || decision.kind === 'retire') && !reason)} onClick={() => void confirmDecision()}>{action.pending ? 'Saving…' : decision.kind === 'publish' ? 'Publish item' : decision.kind === 'retire' ? 'Retire item' : decision.kind === 'release' ? 'Release reservation' : 'Confirm collection'}</button></div>
    </Modal>}
  </section>
}

import { useState } from 'react'
import type { CatalogItem, Reservation, School } from '../../shared/contracts'
import { cancelReservation, loadPickups } from '../../lib/api'
import { useAction, useResource } from '../../lib/useResource'
import { Empty, ErrorNotice, Icon, ItemFacts, ItemVisual, Loading, Modal, Notice, Status } from '../../components/ui'
import { dateTime } from '../../lib/format'

export function Pickups({ school, userId, onFind }: { school: School; userId: string; onFind: () => void }) {
  const resource = useResource(`${userId}:${school.id}:pickups`, () => loadPickups(school.id, userId))
  const action = useAction(resource.reload)
  const [detail, setDetail] = useState<CatalogItem | null>(null)
  const [cancelling, setCancelling] = useState<Reservation | null>(null)
  const active = resource.data?.reservations.filter(row => row.status === 'active') ?? []
  const completed = resource.data?.reservations.filter(row => row.status === 'completed') ?? []
  function row(reservation: Reservation) {
    const item = resource.data?.items.find(value => value.id === reservation.item_id)
    return <article className="pickup-card" key={reservation.id}>
      <div className="pickup-item">{item && <ItemVisual item={item} />}<div><Status value={reservation.status} /><h3>{item?.title || 'Item details unavailable'}</h3><p>{item?.item_code ?? 'Refresh to load the item'}{item?.category === 'clothing' ? ` · ${item.size_label ?? ''} · ${item.color_variant ?? ''}` : item ? ` · ${item.edition ?? ''}` : ''}</p><small>{reservation.status === 'active' ? `Reserved ${dateTime(reservation.created_at)}` : `Collected ${dateTime(reservation.completed_at)}`}</small></div></div>
      <div className="pickup-card-actions">{item && <button className="button secondary" onClick={() => setDetail(item)}>Item details</button>}{reservation.status === 'active' && <button className="text-button" disabled={!!action.pending} onClick={() => { action.clear(); setCancelling(reservation) }}>Cancel reservation</button>}</div>
    </article>
  }
  return <section aria-labelledby="pickups-title">
    <div className="page-heading"><div><p className="eyebrow">Your next step</p><h1 id="pickups-title">My pickups.</h1><p>Your reservations and collected items, all in one place.</p></div><button className="button secondary" onClick={resource.reload} disabled={resource.loading}>Refresh records</button></div>
    <div className="pickup-banner"><span className="banner-icon"><Icon type="check" /></span><div><h2>{school.pickup_label}</h2><p>Bring your item code. A school manager confirms collection when the item is handed over.</p></div></div>
    <ErrorNotice error={resource.error} retry={resource.reload} /><ErrorNotice error={action.error} />{action.notice && <Notice>{action.notice}</Notice>}
    {resource.loading ? <Loading /> : !resource.error && <>
      <div className="section-heading"><h2>Ready to collect</h2><span className="count-pill">{active.length}</span></div>
      {active.length ? <div className="stack">{active.map(row)}</div> : <Empty title="No active pickups.">Find an item that works for you, then reserve it for collection.<br /><button className="button secondary" onClick={onFind}>Find items<Icon type="arrow" /></button></Empty>}
      <div className="section-heading completed-heading"><h2>Collected</h2><span className="count-pill">{completed.length}</span></div>
      {completed.length ? <div className="stack">{completed.map(row)}</div> : <p className="muted">Your collected items will appear here after a manager confirms the handoff.</p>}
    </>}
    {detail && <Modal title={detail.title || 'Item details'} onClose={() => setDetail(null)}><ItemVisual item={detail} /><ItemFacts item={detail} /><div className="modal-actions"><button className="button secondary" onClick={() => setDetail(null)}>Close details</button></div></Modal>}
    {cancelling && <Modal title="Cancel this reservation?" onClose={() => setCancelling(null)}><p>The item will become available for someone else in your school.</p><ErrorNotice error={action.error} />{!resource.loading && !active.some(row => row.id === cancelling.id) && <p className="helper-text">This reservation has changed. Close this dialog to review the latest records.</p>}<div className="modal-actions"><button className="button secondary" onClick={() => setCancelling(null)}>Go back</button><button className="button danger" disabled={!!action.pending || resource.loading || !active.some(row => row.id === cancelling.id)} onClick={() => void action.run(cancelling.id, () => cancelReservation(cancelling), 'Reservation cancelled. The item is available again.').then(success => { if (success) setCancelling(current => current?.id === cancelling.id ? null : current) })}>{action.pending ? 'Cancelling…' : 'Cancel reservation'}</button></div></Modal>}
  </section>
}

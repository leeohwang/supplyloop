import { useEffect, useId, useRef } from 'react'
import type { ReactNode } from 'react'
import type { CatalogItem, ItemStatus } from '../shared/contracts'
import { conditionLabels } from '../shared/contracts'
import type { AppError } from '../lib/errors'
import { sentence } from '../lib/format'
export function Icon({ type, className = '' }: { type: 'loop' | 'clothing' | 'textbook' | 'arrow' | 'check'; className?: string }) {
  return <svg className={`icon ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {type === 'loop' && <><path d="M18.7 7.2A7 7 0 0 0 6.6 5.6L3 10" /><path d="M3 5v5h5M5.3 16.8a7 7 0 0 0 12.1 1.6L21 14" /><path d="M16 14h5v5" /></>}
    {type === 'clothing' && <><path d="m8 3-6 4 3 5 3-2v11h8V10l3 2 3-5-6-4" /><path d="M8 3a4 4 0 0 0 8 0" /></>}
    {type === 'textbook' && <><path d="M12 5c-3-2-6-2-10-1v15c4-1 7-1 10 1 3-2 6-2 10-1V4c-4-1-7-1-10 1v15" /><path d="M5 8h3M16 8h3M5 12h3M16 12h3" /></>}
    {type === 'arrow' && <><path d="M5 12h14m-5-5 5 5-5 5" /></>}
    {type === 'check' && <path d="m5 12 4 4L19 6" />}
  </svg>
}
export function Field({ label, children, help, className = '' }: { label: string; children: ReactNode; help?: string; className?: string }) {
  const id = useId()
  return <label className={`field ${className}`}><span>{label}</span>{children}{help && <small id={id}>{help}</small>}</label>
}
export function ErrorNotice({ error, retry }: { error: AppError | string | null; retry?: () => void }) {
  if (!error) return null
  return <div className="notice error" role="alert"><span>{typeof error === 'string' ? error : error.message}</span>{retry && <button className="text-button" onClick={retry}>Try again</button>}</div>
}
export function Notice({ children }: { children: ReactNode }) {
  return <div className="notice success" role="status"><Icon type="check" /><span>{children}</span></div>
}
export function Loading({ label = 'Loading your school’s records…' }: { label?: string }) {
  return <div className="loading" role="status"><span className="spinner" aria-hidden="true" />{label}</div>
}
export function Empty({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return <div className="empty"><span className="empty-symbol" aria-hidden="true">↗</span><h3>{title}</h3><p>{children}</p>{action}</div>
}
export function Status({ value }: { value: ItemStatus | 'active' | 'completed' | 'cancelled' }) {
  const label = value === 'intake' ? 'Draft intake' : value === 'transferred' ? 'Collected' : sentence(value)
  return <span className={`status status-${value}`}><span aria-hidden="true" />{label}</span>
}
export function ItemVisual({ item }: { item: Pick<CatalogItem, 'category' | 'garment_type'> }) {
  return <div className={`item-visual visual-${item.category}`}><Icon type={item.category} /><span>{item.category === 'clothing' ? sentence(item.garment_type ?? 'clothing') : 'Physical textbook'}</span></div>
}
export function ItemFacts({ item }: { item: CatalogItem }) {
  return <dl className="facts">
    <div><dt>Item code</dt><dd>{item.item_code}</dd></div>
    <div><dt>Condition</dt><dd>{item.condition ? conditionLabels[item.condition] : 'Not entered'}</dd></div>
    {item.category === 'clothing' ? <>
      <div><dt>Garment</dt><dd>{item.garment_type ? sentence(item.garment_type) : 'Not entered'}</dd></div>
      <div><dt>Size</dt><dd>{item.size_label ? `${item.size_label} · letter sizing` : 'Not entered'}</dd></div>
      <div><dt>Color / variant</dt><dd>{item.color_variant || 'Not entered'}</dd></div>
      {item.measurements && <div className="wide"><dt>Measurements</dt><dd>{item.measurements} {item.measurement_unit}</dd></div>}
    </> : <>
      <div><dt>ISBN-13</dt><dd className="mono">{item.isbn13 || 'Not entered'}</dd></div>
      <div><dt>Edition</dt><dd>{item.edition || 'Not entered'}</dd></div>
      <div><dt>Format</dt><dd>{item.book_format || 'Not entered'}</dd></div>
      {item.course_label && <div><dt>Course</dt><dd>{item.course_label}</dd></div>}
      {item.book_term_label && <div><dt>Book term</dt><dd>{item.book_term_label}</dd></div>}
    </>}
  </dl>
}

export function Modal({ title, children, onClose, className = '' }: {
  title: string; children: ReactNode; onClose: () => void; className?: string
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const opener = useRef<HTMLElement | null>(null)
  const dialogId = useId()
  const titleId = useId()
  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (!dialog.open) {
      opener.current = document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : null
      dialog.showModal()
    }
    const previous = opener.current
    return () => {
      // Wait until React has removed the dialog. StrictMode's replay keeps the
      // same element mounted; it must not close the dialog or move its focus.
      void Promise.resolve().then(() => {
        if (document.getElementById(dialogId) === dialog) return
        const active = document.activeElement
        // A native Escape close or a newly opened dialog may already have put
        // focus somewhere useful. Leave that focus alone.
        if (active && active !== document.body && active !== dialog) return
        previous?.focus({ preventScroll: true })
        if (previous && document.activeElement === previous) return
        document.getElementById('main-content')?.focus()
      })
    }
  }, [dialogId])
  return <dialog ref={ref} id={dialogId} className={`modal ${className}`} aria-labelledby={titleId} onClose={onClose}>
    <div className="modal-heading"><h2 id={titleId}>{title}</h2><button className="icon-button" type="button" onClick={onClose} aria-label="Close dialog">×</button></div>
    {children}
  </dialog>
}

import { useState } from 'react'
import {
  clothingSizes, conditions, conditionLabels, garmentTypes,
} from '../../shared/contracts'
import type { CatalogFilters, CatalogItem, Category, School } from '../../shared/contracts'
import { loadCatalog, reserveItem } from '../../lib/api'
import { useAction, useResource } from '../../lib/useResource'
import { Empty, ErrorNotice, Field, Icon, ItemFacts, ItemVisual, Loading, Modal, Notice, Status } from '../../components/ui'
import { sentence } from '../../lib/format'

function initialFilters(category: Category): CatalogFilters {
  return { category, garment_type: '', size_label: '', color_variant: '', minimum_condition: '', isbn13: '', edition: '', course_label: '', book_term_label: '' }
}

export function Catalog({ school, userId, onReserved }: { school: School; userId: string; onReserved: () => void }) {
  const [filters, setFilters] = useState(() => initialFilters(school.enabled_categories[0] ?? 'clothing'))
  const [draft, setDraft] = useState(filters)
  const [selected, setSelected] = useState<CatalogItem | null>(null)
  const resource = useResource(`${userId}:${school.id}:find:${JSON.stringify(filters)}`, () => loadCatalog(school.id, filters))
  const action = useAction(resource.reload)
  function changeCategory(category: Category) {
    const next = initialFilters(category)
    setDraft(next); setFilters(next); setSelected(null); action.clear()
  }
  async function reserve(item: CatalogItem) {
    if (await action.run(item.id, () => reserveItem(item), 'Your pickup is reserved. Visit My pickups for the next step.')) setSelected(current => current?.id === item.id ? null : current)
  }
  const items = resource.data ?? []
  return <section aria-labelledby="find-title">
    <div className="page-heading"><div><p className="eyebrow">Good things, another chapter</p><h1 id="find-title">Find what you need.</h1><p>Clothing and textbooks shared within your school.</p></div><span className="school-note"><Icon type="loop" />Made for your community</span></div>
    <div className="catalog-layout">
      <aside className="filter-panel">
        <form onSubmit={event => { event.preventDefault(); action.clear(); setFilters({ ...draft }) }}>
          <h2>Narrow your search</h2>
          <div className="segmented category-switch" aria-label="Item category">{school.enabled_categories.map(category => <button type="button" key={category} aria-pressed={filters.category === category} onClick={() => changeCategory(category)}><Icon type={category} />{category === 'clothing' ? 'Clothing' : 'Textbooks'}</button>)}</div>
          {filters.category === 'clothing' ? <>
            <Field label="Garment"><select value={draft.garment_type} onChange={event => setDraft({ ...draft, garment_type: event.target.value as CatalogFilters['garment_type'] })}><option value="">All garments</option>{garmentTypes.map(type => <option key={type} value={type}>{sentence(type)}</option>)}</select></Field>
            <Field label="Size label" help="Letter sizes; check measurements for fit."><select value={draft.size_label} onChange={event => setDraft({ ...draft, size_label: event.target.value as CatalogFilters['size_label'] })}><option value="">All sizes</option>{clothingSizes.map(size => <option key={size}>{size}</option>)}</select></Field>
            <Field label="Color / variant" help="Matches the exact description entered by staff."><input value={draft.color_variant} onChange={event => setDraft({ ...draft, color_variant: event.target.value })} placeholder="e.g. Navy" /></Field>
          </> : <>
            <Field label="ISBN-13" help="An exact match for the copy you need."><input inputMode="numeric" pattern="[0-9]{13}" maxLength={13} value={draft.isbn13} onChange={event => setDraft({ ...draft, isbn13: event.target.value })} placeholder="13 digits, without hyphens" /></Field>
            <Field label="Edition"><input value={draft.edition} onChange={event => setDraft({ ...draft, edition: event.target.value })} placeholder="Exact edition label" /></Field>
            <Field label="Course (optional)"><input value={draft.course_label} onChange={event => setDraft({ ...draft, course_label: event.target.value })} placeholder="Exact course label" /></Field>
            <Field label="Book term (optional)"><input value={draft.book_term_label} onChange={event => setDraft({ ...draft, book_term_label: event.target.value })} placeholder="Exact term label" /></Field>
          </>}
          <Field label="Minimum condition"><select value={draft.minimum_condition} onChange={event => setDraft({ ...draft, minimum_condition: event.target.value as CatalogFilters['minimum_condition'] })}><option value="">Any usable condition</option>{conditions.map(condition => <option key={condition} value={condition}>{conditionLabels[condition]}</option>)}</select></Field>
          <button className="button full" type="submit">Find items<Icon type="arrow" /></button>
          <button type="button" className="text-button reset-button" onClick={() => { const next = initialFilters(filters.category); setFilters(next); setDraft(next); action.clear() }}>Clear filters</button>
        </form>
        <div className="filter-footnote"><Icon type="check" /><p>Every available item has been reviewed by a school manager.</p></div>
      </aside>
      <div className="catalog-results">
        <ErrorNotice error={action.error} />
        {action.notice && <Notice>{action.notice} <button className="text-button" onClick={onReserved}>My pickups →</button></Notice>}
        <div className="results-heading"><h2>{filters.category === 'clothing' ? 'Clothing' : 'Textbooks'} available now</h2><button className="text-button" onClick={resource.reload} disabled={resource.loading}>Refresh</button></div>
        <p className="results-caption">{resource.loading ? 'Checking current availability…' : `${items.length} ${items.length === 1 ? 'item' : 'items'} in your school`}</p>
        <ErrorNotice error={resource.error} retry={resource.reload} />
        {resource.loading ? <Loading label="Finding available items…" /> : !resource.error && (items.length ? <div className="item-grid">{items.map(item => <article className="item-card" key={item.id}>
          <ItemVisual item={item} />
          <div className="item-card-body"><div className="card-meta"><span>{item.item_code}</span><Status value={item.status} /></div><h3>{item.title}</h3><p className="item-description">{item.category === 'clothing' ? `${item.size_label} · ${item.color_variant}` : `${item.edition} · ${item.book_format}`}</p><span className="condition-label">{item.condition ? conditionLabels[item.condition] : ''}</span>
            <p className="match-label">{item.category === 'clothing' ? (filters.size_label ? 'Matching size label · check measurements' : 'Check size and measurements') : (filters.isbn13 ? 'Exact ISBN match' : 'Check ISBN and edition')}</p>
            <button className="button secondary full" onClick={() => { action.clear(); setSelected(item) }}>View item<Icon type="arrow" /></button>
          </div>
        </article>)}</div> : <Empty title="Nothing matches just yet.">Try a different filter or check back after the next intake. Available items appear here after staff review.</Empty>)}
        <div className="quiet-callout"><Icon type="loop" /><p>One physical item. One confirmed reservation. Collect it from <strong>{school.pickup_label}</strong>.</p></div>
      </div>
    </div>
    {selected && <Modal title={selected.title || 'Item details'} onClose={() => setSelected(null)}>
      <ItemVisual item={selected} /><ItemFacts item={selected} />
      <p className="helper-text">{selected.category === 'clothing' ? 'A size label does not guarantee fit. Check the measurements and condition before reserving.' : 'Check the ISBN and edition against your course requirements. This is a physical, reusable copy.'}</p>
      <div className="pickup-note"><strong>Collect at {school.pickup_label}</strong><span>A school manager will confirm your handoff.</span></div>
      <ErrorNotice error={action.error} />
      {!resource.loading && !items.some(item => item.id === selected.id) && <p className="helper-text">This item is no longer available. If you submitted a reservation, check My pickups to see its outcome.</p>}
      <div className="modal-actions"><button className="button secondary" onClick={() => setSelected(null)}>Back to items</button><button className="button" disabled={!!action.pending || resource.loading || !items.some(item => item.id === selected.id)} onClick={() => void reserve(selected)}>{action.pending === selected.id ? 'Reserving…' : 'Reserve this item'}<Icon type="arrow" /></button></div>
    </Modal>}
  </section>
}

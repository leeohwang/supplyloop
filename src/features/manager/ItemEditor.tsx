import { useEffect, useRef, useState } from 'react'
import {
  clothingSizes, conditions, conditionLabels, emptyClothingDetails, emptyTextbookDetails,
  garmentTypes, itemDetails,
} from '../../shared/contracts'
import type {
  CatalogItem, ClothingDetails, IntakeInput, ItemStaff, TextbookDetails,
} from '../../shared/contracts'
import type { AppError } from '../../lib/errors'
import { ErrorNotice, Field, Modal } from '../../components/ui'
import { sentence } from '../../lib/format'

const clean = (text: string | null) => text?.trim() || null
function cleaned(value: IntakeInput): IntakeInput {
  if (value.category === 'clothing') return { ...value, storage_code: clean(value.storage_code), details: {
    ...value.details, title: clean(value.details.title), color_variant: clean(value.details.color_variant), measurements: clean(value.details.measurements),
  } }
  return { ...value, storage_code: clean(value.storage_code), details: {
    ...value.details, title: clean(value.details.title), isbn13: clean(value.details.isbn13), edition: clean(value.details.edition),
    book_format: clean(value.details.book_format), course_label: clean(value.details.course_label), book_term_label: clean(value.details.book_term_label),
  } }
}

function initialValue(item?: CatalogItem, staff?: ItemStaff): IntakeInput {
  if (!item) return { category: 'clothing', details: emptyClothingDetails(), storage_code: null }
  return item.category === 'clothing'
    ? { category: 'clothing', details: itemDetails(item) as ClothingDetails, storage_code: staff?.storage_code ?? null }
    : { category: 'textbook', details: itemDetails(item) as TextbookDetails, storage_code: staff?.storage_code ?? null }
}

export function ItemEditor({ item, staff, onClose, onSave, pending, blocked, uncertainIntake, onReviewInventory, error }: {
  item?: CatalogItem; staff?: ItemStaff; onClose: () => void;
  onSave: (value: IntakeInput) => Promise<boolean>; pending: boolean; blocked: boolean;
  uncertainIntake: boolean; onReviewInventory: () => void; error: AppError | null
}) {
  const [value, setValue] = useState(() => initialValue(item, staff))
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])
  function clothing(patch: Partial<ClothingDetails>) {
    setValue(current => current.category === 'clothing' ? { ...current, details: { ...current.details, ...patch } } : current)
  }
  function textbook(patch: Partial<TextbookDetails>) {
    setValue(current => current.category === 'textbook' ? { ...current, details: { ...current.details, ...patch } } : current)
  }
  function common(patch: Pick<Partial<ClothingDetails>, 'title' | 'condition'>) {
    setValue(current => current.category === 'clothing'
      ? { ...current, details: { ...current.details, ...patch } }
      : { ...current, details: { ...current.details, ...patch } })
  }
  return <Modal title={item ? `Edit ${item.item_code}` : 'Receive a donated item'} onClose={onClose} className="editor-modal">
    <p className="helper-text">{item?.status === 'available' ? 'Available stock must keep all required catalog and storage details.' : 'Save an incomplete draft now. Review and publish it when the item is ready.'}</p>
    <form onSubmit={event => { event.preventDefault(); if (uncertainIntake) return; void onSave(cleaned(value)).then(success => { if (success && mounted.current) onClose() }) }}>
      <fieldset disabled={pending || blocked || uncertainIntake} className="form-fieldset">
        <div className="form-grid">
          <Field label="Category"><select disabled={!!item} value={value.category} onChange={event => setValue(event.target.value === 'clothing' ? { category: 'clothing', details: emptyClothingDetails(), storage_code: value.storage_code } : { category: 'textbook', details: emptyTextbookDetails(), storage_code: value.storage_code })}><option value="clothing">Clothing</option><option value="textbook">Physical textbook</option></select></Field>
          <Field label="Condition"><select value={value.details.condition ?? ''} onChange={event => common({ condition: (event.target.value || null) as ClothingDetails['condition'] })}><option value="">Not entered</option>{conditions.map(condition => <option key={condition} value={condition}>{conditionLabels[condition]}</option>)}</select></Field>
          <Field label="Item title" className="wide"><input value={value.details.title ?? ''} onChange={event => common({ title: event.target.value })} placeholder={value.category === 'clothing' ? 'e.g. Navy school sweater' : 'e.g. Algebra, physical copy'} /></Field>
          {value.category === 'clothing' ? <>
            <Field label="Garment"><select value={value.details.garment_type ?? ''} onChange={event => clothing({ garment_type: (event.target.value || null) as ClothingDetails['garment_type'] })}><option value="">Not entered</option>{garmentTypes.map(type => <option key={type} value={type}>{sentence(type)}</option>)}</select></Field>
            <Field label="Letter size"><select value={value.details.size_label ?? ''} onChange={event => clothing({ size_system: 'letter', size_label: (event.target.value || null) as ClothingDetails['size_label'] })}><option value="">Not entered</option>{clothingSizes.map(size => <option key={size}>{size}</option>)}</select></Field>
            <Field label="Color / variant" className="wide"><input value={value.details.color_variant ?? ''} onChange={event => clothing({ color_variant: event.target.value })} placeholder="Describe the school-approved color or variant" /></Field>
            <Field label="Measurements (optional)"><input value={value.details.measurements ?? ''} onChange={event => clothing({ measurements: event.target.value })} placeholder="e.g. Chest 90, length 62" /></Field>
            <Field label="Measurement unit"><select value={value.details.measurement_unit ?? ''} onChange={event => clothing({ measurement_unit: (event.target.value || null) as ClothingDetails['measurement_unit'] })}><option value="">No measurements</option><option value="cm">Centimeters (cm)</option><option value="in">Inches (in)</option></select></Field>
          </> : <>
            <Field label="ISBN-13"><input inputMode="numeric" pattern="[0-9]{13}" maxLength={13} value={value.details.isbn13 ?? ''} onChange={event => textbook({ isbn13: event.target.value })} placeholder="13 digits, without hyphens" /></Field>
            <Field label="Edition"><input value={value.details.edition ?? ''} onChange={event => textbook({ edition: event.target.value })} placeholder="Exact printed edition" /></Field>
            <Field label="Physical format"><input value={value.details.book_format ?? ''} onChange={event => textbook({ book_format: event.target.value })} placeholder="e.g. Paperback" /></Field>
            <Field label="Course (optional)"><input value={value.details.course_label ?? ''} onChange={event => textbook({ course_label: event.target.value })} /></Field>
            <Field label="Book term (optional)" className="wide"><input value={value.details.book_term_label ?? ''} onChange={event => textbook({ book_term_label: event.target.value })} /></Field>
            <Field label="Requires a one-time digital code?"><select value={value.details.requires_digital_code === null ? '' : String(value.details.requires_digital_code)} onChange={event => textbook({ requires_digital_code: event.target.value === '' ? null : event.target.value === 'true' })}><option value="">Not checked</option><option value="false">No</option><option value="true">Yes — cannot publish</option></select></Field>
            <Field label="Consumable workbook?"><select value={value.details.is_consumable === null ? '' : String(value.details.is_consumable)} onChange={event => textbook({ is_consumable: event.target.value === '' ? null : event.target.value === 'true' })}><option value="">Not checked</option><option value="false">No</option><option value="true">Yes — cannot publish</option></select></Field>
          </>}
          <Field label="Exact storage code" className="wide" help="Visible only to school managers. Required before publication."><input value={value.storage_code ?? ''} onChange={event => setValue({ ...value, storage_code: event.target.value })} placeholder="e.g. Cabinet A · shelf 2" /></Field>
        </div>
      </fieldset>
      <ErrorNotice error={error} />
      {uncertainIntake && <div className="notice error" role="alert"><div><strong>This intake may already be recorded.</strong><p>Review inventory before submitting it again, so the same physical item is not received twice.</p><button type="button" className="button secondary small" onClick={onReviewInventory}>Review inventory</button></div></div>}
      <div className="modal-actions"><button className="button secondary" type="button" onClick={onClose}>Cancel</button><button className="button" type="submit" disabled={pending || blocked || uncertainIntake}>{pending ? 'Saving…' : item ? 'Save changes' : 'Save intake draft'}</button></div>
    </form>
  </Modal>
}

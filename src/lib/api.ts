import { supabase } from './supabase'
import { AppError, normalizeError } from './errors'
import {
  conditions, conditionRank, itemStatuses,
} from '../shared/contracts'
import type {
  CatalogFilters, CatalogItem, IntakeInput, ItemDetails, ItemEvent, ItemStaff,
  Membership, MutationResult, ReleaseReason, Reservation, RetirementReason, School,
} from '../shared/contracts'
import type { Json } from './database.types'

function client() {
  if (!supabase) throw new AppError('SERVER_ERROR')
  return supabase
}

async function read<T>(request: PromiseLike<{ data: T | null; error: unknown }>): Promise<T> {
  try {
    const { data, error } = await request
    if (error) throw normalizeError(error)
    if (data === null) throw new AppError('SERVER_ERROR')
    return data
  } catch (error) { throw normalizeError(error) }
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
function validMutation(value: unknown): value is MutationResult {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const result = value as Record<string, unknown>
  const reservationStatus = result.reservation_status
  return typeof result.school_id === 'string' && uuid.test(result.school_id)
    && typeof result.item_id === 'string' && uuid.test(result.item_id)
    && typeof result.item_status === 'string' && itemStatuses.some(status => status === result.item_status)
    && (result.reservation_id === null || (typeof result.reservation_id === 'string' && uuid.test(result.reservation_id)))
    && (reservationStatus === null || ['active', 'cancelled', 'completed'].includes(String(reservationStatus)))
    && ((result.reservation_id === null) === (reservationStatus === null))
    && (result.completed_at === null || (typeof result.completed_at === 'string' && Number.isFinite(Date.parse(result.completed_at))))
    && typeof result.changed === 'boolean'
}

async function mutate(request: PromiseLike<{ data: unknown; error: unknown }>, schoolId: string): Promise<MutationResult> {
  const data = await read(request)
  if (!validMutation(data) || data.school_id !== schoolId) throw new AppError('SERVER_ERROR')
  return data
}

export interface AuthorizedSchool { school: School; membership: Membership }

function validSchoolMembership(value: unknown, userId: string): value is Membership {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const membership = value as Record<string, unknown>
  return membership.school_id === '11111111-1111-1111-1111-111111111111'
    && membership.user_id === userId && typeof membership.user_id === 'string' && uuid.test(membership.user_id)
    && membership.role === 'member' && membership.active === true
    && typeof membership.display_label === 'string' && membership.display_label.trim().length > 0
    && typeof membership.created_at === 'string' && Number.isFinite(Date.parse(membership.created_at))
}

export async function joinSchool(userId: string, accessCode: string, displayLabel: string): Promise<Membership> {
  try {
    const db = client()
    const { data: auth, error } = await db.auth.getSession()
    if (error) throw normalizeError(error)
    if (!auth.session || auth.session.user.id !== userId) throw new AppError('AUTH_REQUIRED')
    // Bind this request to its submitting account even if shared auth changes
    // while the fetch wrapper is retrieving the current session token.
    const data = await read<unknown>(db.rpc('join_demo_school', {
      p_access_code: accessCode.trim(), p_display_label: displayLabel.trim(),
    }).setHeader('Authorization', `Bearer ${auth.session.access_token}`).single<unknown>())
    if (!validSchoolMembership(data, userId)) throw new AppError('SERVER_ERROR')
    return data
  } catch (error) { throw normalizeError(error) }
}

export async function loadSchools(userId: string): Promise<AuthorizedSchool[]> {
  const db = client()
  const memberships = await read(db.from('memberships').select('*').eq('user_id', userId).eq('active', true))
  if (!memberships.length) return []
  const schools = await read(db.from('schools').select('*').in('id', memberships.map(row => row.school_id)).order('name'))
  return schools.flatMap(school => {
    const membership = memberships.find(row => row.school_id === school.id)
    return membership ? [{ school, membership }] : []
  })
}

export async function loadCatalog(schoolId: string, filters: CatalogFilters): Promise<CatalogItem[]> {
  let query = client().from('items').select('*').eq('school_id', schoolId)
    .eq('status', 'available').not('approved_at', 'is', null).eq('category', filters.category)
  if (filters.category === 'clothing') {
    query = query.eq('size_system', 'letter')
    if (filters.garment_type) query = query.eq('garment_type', filters.garment_type)
    if (filters.size_label) query = query.eq('size_label', filters.size_label)
    if (filters.color_variant.trim()) query = query.eq('color_variant', filters.color_variant.trim())
  } else {
    if (filters.isbn13.trim()) query = query.eq('isbn13', filters.isbn13.trim())
    if (filters.edition.trim()) query = query.eq('edition', filters.edition.trim())
    if (filters.course_label.trim()) query = query.eq('course_label', filters.course_label.trim())
    if (filters.book_term_label.trim()) query = query.eq('book_term_label', filters.book_term_label.trim())
    query = query.eq('requires_digital_code', false).eq('is_consumable', false)
  }
  const minimum = filters.minimum_condition
  if (minimum) query = query.in('condition', conditions.filter(condition => conditionRank[condition] >= conditionRank[minimum]))
  return read(query.order('available_at', { ascending: true }).order('id', { ascending: true }))
}

export interface PersonalData { reservations: Reservation[]; items: CatalogItem[] }
export async function loadPickups(schoolId: string, userId: string): Promise<PersonalData> {
  const db = client()
  const reservations = await read(db.from('reservations').select('*').eq('school_id', schoolId)
    .eq('member_id', userId).in('status', ['active', 'completed']).order('created_at', { ascending: false }))
  const ids = [...new Set(reservations.map(row => row.item_id))]
  const items = ids.length ? await read(db.from('items').select('*').eq('school_id', schoolId).in('id', ids)) : []
  return { reservations, items }
}

export interface ManagerData {
  items: CatalogItem[]; staff: ItemStaff[]; reservations: Reservation[]; memberships: Membership[]; events: ItemEvent[]
}
export async function loadManager(schoolId: string): Promise<ManagerData> {
  const db = client()
  const [items, staff, reservations, memberships, events] = await Promise.all([
    read(db.from('items').select('*').eq('school_id', schoolId).order('created_at', { ascending: false })),
    read(db.from('item_staff').select('*').eq('school_id', schoolId)),
    read(db.from('reservations').select('*').eq('school_id', schoolId).order('created_at', { ascending: false })),
    read(db.from('memberships').select('*').eq('school_id', schoolId)),
    read(db.from('item_events').select('*').eq('school_id', schoolId).order('created_at', { ascending: false })),
  ])
  return { items, staff, reservations, memberships, events }
}

export function intakeItem(schoolId: string, input: IntakeInput) {
  return mutate(client().rpc('intake_item', {
    p_school_id: schoolId, p_category: input.category, p_details: { ...input.details } as Json,
    p_storage_code: input.storage_code,
  }).single(), schoolId)
}
export function updateItem(item: CatalogItem, details: ItemDetails, storage: string | null) {
  return mutate(client().rpc('update_item_details', {
    p_item_id: item.id, p_details: { ...details } as Json, p_storage_code: storage,
  }).single(), item.school_id)
}
export function publishItem(item: CatalogItem) {
  return mutate(client().rpc('publish_item', { p_item_id: item.id, p_inspection_confirmed: true }).single(), item.school_id)
}
export function reserveItem(item: CatalogItem) {
  return mutate(client().rpc('reserve_item', { p_item_id: item.id }).single(), item.school_id)
}
export function cancelReservation(reservation: Reservation, reason: ReleaseReason | null = null) {
  return mutate(client().rpc('cancel_reservation', {
    p_reservation_id: reservation.id, p_release_reason: reason,
  }).single(), reservation.school_id)
}
export function completePickup(reservation: Reservation) {
  return mutate(client().rpc('complete_pickup', { p_reservation_id: reservation.id }).single(), reservation.school_id)
}
export function retireItem(item: CatalogItem, reason: RetirementReason) {
  return mutate(client().rpc('retire_item', { p_item_id: item.id, p_reason: reason }).single(), item.school_id)
}

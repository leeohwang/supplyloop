export const categories = ['clothing', 'textbook'] as const
export type Category = (typeof categories)[number]
export const garmentTypes = ['shirt', 'sweater', 'jacket', 'trousers', 'skirt'] as const
export type GarmentType = (typeof garmentTypes)[number]
export const clothingSizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL'] as const
export type ClothingSize = (typeof clothingSizes)[number]
export const conditions = ['new', 'like_new', 'good', 'fair'] as const
export type Condition = (typeof conditions)[number]
export const conditionLabels: Record<Condition, string> = {
  new: 'New', like_new: 'Like new', good: 'Good', fair: 'Fair',
}
export const conditionRank: Record<Condition, number> = {
  new: 4, like_new: 3, good: 2, fair: 1,
}
export const itemStatuses = ['intake', 'available', 'reserved', 'transferred', 'retired'] as const
export type ItemStatus = (typeof itemStatuses)[number]
export type ReservationStatus = 'active' | 'cancelled' | 'completed'
export type MembershipRole = 'member' | 'manager'
export type MeasurementUnit = 'cm' | 'in'
export const releaseReasons = ['uncollected', 'member_request', 'stock_issue'] as const
export type ReleaseReason = (typeof releaseReasons)[number]
export const retirementReasons = ['unsuitable', 'damaged', 'missing'] as const
export type RetirementReason = (typeof retirementReasons)[number]
export type EventAction = 'intake_received' | 'published' | 'details_updated' | 'reserved'
  | 'cancelled' | 'released' | 'pickup_completed' | 'retired'

export interface School {
  id: string
  name: string
  slug: string
  enabled_categories: Category[]
  pickup_label: string
  term_label: string
  created_at: string
}

export interface Membership {
  school_id: string
  user_id: string
  role: MembershipRole
  active: boolean
  display_label: string
  created_at: string
}

export interface CommonDetails {
  title: string | null
  condition: Condition | null
}
export interface ClothingDetails extends CommonDetails {
  garment_type: GarmentType | null
  size_system: 'letter' | null
  size_label: ClothingSize | null
  color_variant: string | null
  measurements: string | null
  measurement_unit: MeasurementUnit | null
}
export interface TextbookDetails extends CommonDetails {
  isbn13: string | null
  edition: string | null
  book_format: string | null
  course_label: string | null
  book_term_label: string | null
  requires_digital_code: boolean | null
  is_consumable: boolean | null
}
export type ItemDetails = ClothingDetails | TextbookDetails
export type IntakeInput =
  | { category: 'clothing'; details: ClothingDetails; storage_code: string | null }
  | { category: 'textbook'; details: TextbookDetails; storage_code: string | null }

export interface CatalogItem extends ClothingDetails, TextbookDetails {
  id: string
  school_id: string
  item_code: string
  category: Category
  status: ItemStatus
  approved_at: string | null
  created_at: string
  updated_at: string
  available_at: string | null
}

export interface ItemStaff {
  school_id: string
  item_id: string
  storage_code: string | null
  inspection_passed: boolean
  inspected_at: string | null
  inspected_by: string | null
  received_by: string
  received_at: string
  updated_at: string
}

export interface Reservation {
  id: string
  school_id: string
  item_id: string
  member_id: string
  status: ReservationStatus
  created_at: string
  cancelled_at: string | null
  cancelled_by: string | null
  cancel_reason: 'member_cancelled' | ReleaseReason | null
  completed_at: string | null
  completed_by: string | null
}

export interface ItemEvent {
  id: string
  school_id: string
  item_id: string
  reservation_id: string | null
  action: EventAction
  actor_id: string
  reason: 'member_cancelled' | ReleaseReason | RetirementReason | null
  created_at: string
}

export interface MutationResult {
  school_id: string
  item_id: string
  item_status: ItemStatus
  reservation_id: string | null
  reservation_status: ReservationStatus | null
  completed_at: string | null
  changed: boolean
}

export type ApplicationErrorCode = 'AUTH_REQUIRED' | 'NOT_AUTHORIZED' | 'NOT_FOUND'
  | 'INVALID_INPUT' | 'INCOMPLETE_ITEM' | 'INVALID_STATE' | 'ITEM_UNAVAILABLE'
  | 'CONFLICT' | 'SERVER_ERROR' | 'NETWORK_ERROR' | 'DEMO_ACCESS_DENIED' | 'EMAIL_CONFIRMATION_REQUIRED'

export interface CatalogFilters {
  category: Category
  garment_type: GarmentType | ''
  size_label: ClothingSize | ''
  color_variant: string
  minimum_condition: Condition | ''
  isbn13: string
  edition: string
  course_label: string
  book_term_label: string
}

export function emptyClothingDetails(): ClothingDetails {
  return {
    title: null, condition: null, garment_type: null, size_system: 'letter',
    size_label: null, color_variant: null, measurements: null, measurement_unit: null,
  }
}

export function emptyTextbookDetails(): TextbookDetails {
  return {
    title: null, condition: null, isbn13: null, edition: null, book_format: null,
    course_label: null, book_term_label: null, requires_digital_code: null, is_consumable: null,
  }
}

export function itemDetails(item: CatalogItem): ItemDetails {
  if (item.category === 'clothing') {
    const { title, condition, garment_type, size_system, size_label, color_variant, measurements, measurement_unit } = item
    return { title, condition, garment_type, size_system, size_label, color_variant, measurements, measurement_unit }
  }
  const { title, condition, isbn13, edition, book_format, course_label, book_term_label, requires_digital_code, is_consumable } = item
  return { title, condition, isbn13, edition, book_format, course_label, book_term_label, requires_digital_code, is_consumable }
}

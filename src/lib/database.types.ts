// Preserve catalog-generated defaults, relationships, and RPC signatures while
// narrowing CHECK-constrained text columns to the reviewed application vocabulary.
// RPC results remain conservative here; api.ts validates them before use.
import type {
  CatalogItem, ItemEvent, ItemStaff, Membership, Reservation, School,
} from '../shared/contracts'
import type { Database as GeneratedDatabase } from './database.generated.types'

export type { Json } from './database.generated.types'
type PublicTables = GeneratedDatabase['public']['Tables']
type Flat<Row> = { [Key in keyof Row]: Row[Key] }
type Table<Name extends keyof PublicTables, Row extends PublicTables[Name]['Row']> =
  Omit<PublicTables[Name], 'Row'> & { Row: Flat<Row> }

export type Database = {
  public: Omit<GeneratedDatabase['public'], 'Tables'> & {
    Tables: {
      schools: Table<'schools', School>
      memberships: Table<'memberships', Membership>
      items: Table<'items', CatalogItem>
      item_staff: Table<'item_staff', ItemStaff>
      reservations: Table<'reservations', Reservation>
      item_events: Table<'item_events', ItemEvent>
    }
  }
}

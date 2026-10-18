// Generated from a read-only PostgreSQL catalog export. Do not edit by hand.
// Generator: scripts/operator/generate-types.mjs; query: supabase/introspect-types.sql.
// Source PostgreSQL server: 17.11.
// Table nullability/defaults and FK relationships are catalog-derived.
// RPC scalar nullability is not encoded in PostgreSQL signatures; unions are conservative.
// Refine validated application RPC results separately; CHECK constraints are not TS enums.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  public: {
    Tables: {
      "item_events": {
        Row: {
          "id": string
          "school_id": string
          "item_id": string
          "reservation_id": string | null
          "action": string
          "actor_id": string
          "reason": string | null
          "created_at": string
        }
        Insert: {
          "id"?: string
          "school_id": string
          "item_id": string
          "reservation_id"?: string | null
          "action": string
          "actor_id": string
          "reason"?: string | null
          "created_at"?: string
        }
        Update: {
          "id"?: string
          "school_id"?: string
          "item_id"?: string
          "reservation_id"?: string | null
          "action"?: string
          "actor_id"?: string
          "reason"?: string | null
          "created_at"?: string
        }
        Relationships: [
          {
            foreignKeyName: "item_events_school_id_actor_id_fkey"
            columns: ["school_id","actor_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["school_id","user_id"]
          },
          {
            foreignKeyName: "item_events_school_id_item_id_fkey"
            columns: ["school_id","item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["school_id","id"]
          },
          {
            foreignKeyName: "item_events_school_id_reservation_id_item_id_fkey"
            columns: ["school_id","reservation_id","item_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["school_id","id","item_id"]
          },
        ]
      }
      "item_staff": {
        Row: {
          "school_id": string
          "item_id": string
          "storage_code": string | null
          "inspection_passed": boolean
          "inspected_at": string | null
          "inspected_by": string | null
          "received_by": string
          "received_at": string
          "updated_at": string
        }
        Insert: {
          "school_id": string
          "item_id": string
          "storage_code"?: string | null
          "inspection_passed"?: boolean
          "inspected_at"?: string | null
          "inspected_by"?: string | null
          "received_by": string
          "received_at"?: string
          "updated_at"?: string
        }
        Update: {
          "school_id"?: string
          "item_id"?: string
          "storage_code"?: string | null
          "inspection_passed"?: boolean
          "inspected_at"?: string | null
          "inspected_by"?: string | null
          "received_by"?: string
          "received_at"?: string
          "updated_at"?: string
        }
        Relationships: [
          {
            foreignKeyName: "item_staff_school_id_inspected_by_fkey"
            columns: ["school_id","inspected_by"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["school_id","user_id"]
          },
          {
            foreignKeyName: "item_staff_school_id_item_id_fkey"
            columns: ["school_id","item_id"]
            isOneToOne: true
            referencedRelation: "items"
            referencedColumns: ["school_id","id"]
          },
          {
            foreignKeyName: "item_staff_school_id_received_by_fkey"
            columns: ["school_id","received_by"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["school_id","user_id"]
          },
        ]
      }
      "items": {
        Row: {
          "id": string
          "school_id": string
          "item_code": string
          "category": string
          "title": string | null
          "condition": string | null
          "status": string
          "garment_type": string | null
          "size_system": string | null
          "size_label": string | null
          "color_variant": string | null
          "measurements": string | null
          "measurement_unit": string | null
          "isbn13": string | null
          "edition": string | null
          "book_format": string | null
          "course_label": string | null
          "book_term_label": string | null
          "requires_digital_code": boolean | null
          "is_consumable": boolean | null
          "approved_at": string | null
          "created_at": string
          "updated_at": string
          "available_at": string | null
        }
        Insert: {
          "id"?: string
          "school_id": string
          "item_code": string
          "category": string
          "title"?: string | null
          "condition"?: string | null
          "status"?: string
          "garment_type"?: string | null
          "size_system"?: string | null
          "size_label"?: string | null
          "color_variant"?: string | null
          "measurements"?: string | null
          "measurement_unit"?: string | null
          "isbn13"?: string | null
          "edition"?: string | null
          "book_format"?: string | null
          "course_label"?: string | null
          "book_term_label"?: string | null
          "requires_digital_code"?: boolean | null
          "is_consumable"?: boolean | null
          "approved_at"?: string | null
          "created_at"?: string
          "updated_at"?: string
          "available_at"?: string | null
        }
        Update: {
          "id"?: string
          "school_id"?: string
          "item_code"?: string
          "category"?: string
          "title"?: string | null
          "condition"?: string | null
          "status"?: string
          "garment_type"?: string | null
          "size_system"?: string | null
          "size_label"?: string | null
          "color_variant"?: string | null
          "measurements"?: string | null
          "measurement_unit"?: string | null
          "isbn13"?: string | null
          "edition"?: string | null
          "book_format"?: string | null
          "course_label"?: string | null
          "book_term_label"?: string | null
          "requires_digital_code"?: boolean | null
          "is_consumable"?: boolean | null
          "approved_at"?: string | null
          "created_at"?: string
          "updated_at"?: string
          "available_at"?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "items_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      "memberships": {
        Row: {
          "school_id": string
          "user_id": string
          "role": string
          "active": boolean
          "display_label": string
          "created_at": string
        }
        Insert: {
          "school_id": string
          "user_id": string
          "role": string
          "active"?: boolean
          "display_label": string
          "created_at"?: string
        }
        Update: {
          "school_id"?: string
          "user_id"?: string
          "role"?: string
          "active"?: boolean
          "display_label"?: string
          "created_at"?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      "reservations": {
        Row: {
          "id": string
          "school_id": string
          "item_id": string
          "member_id": string
          "status": string
          "created_at": string
          "cancelled_at": string | null
          "cancelled_by": string | null
          "cancel_reason": string | null
          "completed_at": string | null
          "completed_by": string | null
        }
        Insert: {
          "id"?: string
          "school_id": string
          "item_id": string
          "member_id": string
          "status"?: string
          "created_at"?: string
          "cancelled_at"?: string | null
          "cancelled_by"?: string | null
          "cancel_reason"?: string | null
          "completed_at"?: string | null
          "completed_by"?: string | null
        }
        Update: {
          "id"?: string
          "school_id"?: string
          "item_id"?: string
          "member_id"?: string
          "status"?: string
          "created_at"?: string
          "cancelled_at"?: string | null
          "cancelled_by"?: string | null
          "cancel_reason"?: string | null
          "completed_at"?: string | null
          "completed_by"?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reservations_school_id_cancelled_by_fkey"
            columns: ["school_id","cancelled_by"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["school_id","user_id"]
          },
          {
            foreignKeyName: "reservations_school_id_completed_by_fkey"
            columns: ["school_id","completed_by"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["school_id","user_id"]
          },
          {
            foreignKeyName: "reservations_school_id_item_id_fkey"
            columns: ["school_id","item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["school_id","id"]
          },
          {
            foreignKeyName: "reservations_school_id_member_id_fkey"
            columns: ["school_id","member_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["school_id","user_id"]
          },
        ]
      }
      "schools": {
        Row: {
          "id": string
          "name": string
          "slug": string
          "enabled_categories": string[]
          "pickup_label": string
          "term_label": string
          "created_at": string
        }
        Insert: {
          "id"?: string
          "name": string
          "slug": string
          "enabled_categories"?: string[]
          "pickup_label": string
          "term_label": string
          "created_at"?: string
        }
        Update: {
          "id"?: string
          "name"?: string
          "slug"?: string
          "enabled_categories"?: string[]
          "pickup_label"?: string
          "term_label"?: string
          "created_at"?: string
        }
        Relationships: []
      }
    }
    Views: { [_ in never]: never }
    Functions: {
      "cancel_reservation": {
        Args: {
          "p_reservation_id": string | null
          "p_release_reason": string | null
        }
        Returns: {
          "school_id": string | null
          "item_id": string | null
          "item_status": string | null
          "reservation_id": string | null
          "reservation_status": string | null
          "completed_at": string | null
          "changed": boolean | null
        }[]
      }
      "complete_pickup": {
        Args: {
          "p_reservation_id": string | null
        }
        Returns: {
          "school_id": string | null
          "item_id": string | null
          "item_status": string | null
          "reservation_id": string | null
          "reservation_status": string | null
          "completed_at": string | null
          "changed": boolean | null
        }[]
      }
      "intake_item": {
        Args: {
          "p_school_id": string | null
          "p_category": string | null
          "p_details": Json | null
          "p_storage_code": string | null
        }
        Returns: {
          "school_id": string | null
          "item_id": string | null
          "item_status": string | null
          "reservation_id": string | null
          "reservation_status": string | null
          "completed_at": string | null
          "changed": boolean | null
        }[]
      }
      "join_demo_school": {
        Args: {
          "p_access_code": string | null
          "p_display_label": string | null
        }
        Returns: {
          "school_id": string | null
          "user_id": string | null
          "role": string | null
          "active": boolean | null
          "display_label": string | null
          "created_at": string | null
        }
      }
      "publish_item": {
        Args: {
          "p_item_id": string | null
          "p_inspection_confirmed": boolean | null
        }
        Returns: {
          "school_id": string | null
          "item_id": string | null
          "item_status": string | null
          "reservation_id": string | null
          "reservation_status": string | null
          "completed_at": string | null
          "changed": boolean | null
        }[]
      }
      "reserve_item": {
        Args: {
          "p_item_id": string | null
        }
        Returns: {
          "school_id": string | null
          "item_id": string | null
          "item_status": string | null
          "reservation_id": string | null
          "reservation_status": string | null
          "completed_at": string | null
          "changed": boolean | null
        }[]
      }
      "retire_item": {
        Args: {
          "p_item_id": string | null
          "p_reason": string | null
        }
        Returns: {
          "school_id": string | null
          "item_id": string | null
          "item_status": string | null
          "reservation_id": string | null
          "reservation_status": string | null
          "completed_at": string | null
          "changed": boolean | null
        }[]
      }
      "update_item_details": {
        Args: {
          "p_item_id": string | null
          "p_details": Json | null
          "p_storage_code": string | null
        }
        Returns: {
          "school_id": string | null
          "item_id": string | null
          "item_status": string | null
          "reservation_id": string | null
          "reservation_status": string | null
          "completed_at": string | null
          "changed": boolean | null
        }[]
      }
    }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      announcements: {
        Row: {
          body: string
          created_at: string | null
          created_by: string | null
          event_date: string | null
          id: string
          is_published: boolean | null
          organ: Database["public"]["Enums"]["organ_type"] | null
          published_at: string | null
          title: string
        }
        Insert: {
          body: string
          created_at?: string | null
          created_by?: string | null
          event_date?: string | null
          id?: string
          is_published?: boolean | null
          organ?: Database["public"]["Enums"]["organ_type"] | null
          published_at?: string | null
          title: string
        }
        Update: {
          body?: string
          created_at?: string | null
          created_by?: string | null
          event_date?: string | null
          id?: string
          is_published?: boolean | null
          organ?: Database["public"]["Enums"]["organ_type"] | null
          published_at?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string | null
          id: string
          metadata: Json | null
          target_id: string | null
          target_type: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          target_id?: string | null
          target_type?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          target_id?: string | null
          target_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          ends_at: string | null
          event_type: string | null
          id: string
          is_published: boolean | null
          location: string | null
          organ: Database["public"]["Enums"]["organ_type"] | null
          starts_at: string
          title: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          ends_at?: string | null
          event_type?: string | null
          id?: string
          is_published?: boolean | null
          location?: string | null
          organ?: Database["public"]["Enums"]["organ_type"] | null
          starts_at: string
          title: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          ends_at?: string | null
          event_type?: string | null
          id?: string
          is_published?: boolean | null
          location?: string | null
          organ?: Database["public"]["Enums"]["organ_type"] | null
          starts_at?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      legacy_members: {
        Row: {
          academic_level: string | null
          address: string | null
          claim_status: string | null
          claim_token: string | null
          claim_token_expires: string | null
          claimed_by_profile: string | null
          created_at: string | null
          date_of_birth: string | null
          department: string | null
          dues_imported: boolean | null
          email: string | null
          faculty: string | null
          full_name: string
          id: string
          matric_number: string | null
          migrated_by: string | null
          migration_source: Database["public"]["Enums"]["migration_source"]
          notes: string | null
          organ: Database["public"]["Enums"]["organ_type"] | null
          parish: string | null
          phone: string | null
          position: string | null
          role: Database["public"]["Enums"]["user_role"]
          society: string | null
          updated_at: string | null
        }
        Insert: {
          academic_level?: string | null
          address?: string | null
          claim_status?: string | null
          claim_token?: string | null
          claim_token_expires?: string | null
          claimed_by_profile?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          department?: string | null
          dues_imported?: boolean | null
          email?: string | null
          faculty?: string | null
          full_name: string
          id?: string
          matric_number?: string | null
          migrated_by?: string | null
          migration_source: Database["public"]["Enums"]["migration_source"]
          notes?: string | null
          organ?: Database["public"]["Enums"]["organ_type"] | null
          parish?: string | null
          phone?: string | null
          position?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          society?: string | null
          updated_at?: string | null
        }
        Update: {
          academic_level?: string | null
          address?: string | null
          claim_status?: string | null
          claim_token?: string | null
          claim_token_expires?: string | null
          claimed_by_profile?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          department?: string | null
          dues_imported?: boolean | null
          email?: string | null
          faculty?: string | null
          full_name?: string
          id?: string
          matric_number?: string | null
          migrated_by?: string | null
          migration_source?: Database["public"]["Enums"]["migration_source"]
          notes?: string | null
          organ?: Database["public"]["Enums"]["organ_type"] | null
          parish?: string | null
          phone?: string | null
          position?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          society?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "legacy_members_claimed_by_profile_fkey"
            columns: ["claimed_by_profile"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          id: string
          is_read: boolean
          metadata: Json | null
          profile_id: string
          title: string
          type: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          is_read?: boolean
          metadata?: Json | null
          profile_id: string
          title: string
          type: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          is_read?: boolean
          metadata?: Json | null
          profile_id?: string
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          channel: Database["public"]["Enums"]["payment_channel"]
          created_at: string | null
          dues_type: Database["public"]["Enums"]["dues_type"]
          gateway: string | null
          gateway_response: Json | null
          id: string
          legacy_member_id: string | null
          notes: string | null
          opay_cashier_url: string | null
          opay_order_no: string | null
          payment_date: string | null
          payment_period: string | null
          payment_reference: string | null
          profile_id: string | null
          receipt_number: string | null
          recorded_by: string | null
          status: Database["public"]["Enums"]["payment_status"]
          updated_at: string | null
        }
        Insert: {
          amount: number
          channel: Database["public"]["Enums"]["payment_channel"]
          created_at?: string | null
          dues_type?: Database["public"]["Enums"]["dues_type"]
          gateway?: string | null
          gateway_response?: Json | null
          id?: string
          legacy_member_id?: string | null
          notes?: string | null
          opay_cashier_url?: string | null
          opay_order_no?: string | null
          payment_date?: string | null
          payment_period?: string | null
          payment_reference?: string | null
          profile_id?: string | null
          receipt_number?: string | null
          recorded_by?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string | null
        }
        Update: {
          amount?: number
          channel?: Database["public"]["Enums"]["payment_channel"]
          created_at?: string | null
          dues_type?: Database["public"]["Enums"]["dues_type"]
          gateway?: string | null
          gateway_response?: Json | null
          id?: string
          legacy_member_id?: string | null
          notes?: string | null
          opay_cashier_url?: string | null
          opay_order_no?: string | null
          payment_date?: string | null
          payment_period?: string | null
          payment_reference?: string | null
          profile_id?: string | null
          receipt_number?: string | null
          recorded_by?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_legacy_member_id_fkey"
            columns: ["legacy_member_id"]
            isOneToOne: false
            referencedRelation: "legacy_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          academic_level: string | null
          address: string | null
          approved_at: string | null
          approved_by: string | null
          claimed_at: string | null
          created_at: string | null
          date_of_birth: string | null
          department: string | null
          email: string
          faculty: string | null
          full_name: string
          id: string
          is_legacy: boolean | null
          legacy_id: string | null
          matric_number: string | null
          organ: Database["public"]["Enums"]["organ_type"] | null
          parish: string | null
          passport_photo_url: string | null
          phone: string | null
          position: Database["public"]["Enums"]["organization_position"] | null
          role: Database["public"]["Enums"]["user_role"]
          society: string | null
          status: Database["public"]["Enums"]["account_status"]
          updated_at: string | null
        }
        Insert: {
          academic_level?: string | null
          address?: string | null
          approved_at?: string | null
          approved_by?: string | null
          claimed_at?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          department?: string | null
          email: string
          faculty?: string | null
          full_name: string
          id: string
          is_legacy?: boolean | null
          legacy_id?: string | null
          matric_number?: string | null
          organ?: Database["public"]["Enums"]["organ_type"] | null
          parish?: string | null
          passport_photo_url?: string | null
          phone?: string | null
          position?: Database["public"]["Enums"]["organization_position"] | null
          role?: Database["public"]["Enums"]["user_role"]
          society?: string | null
          status?: Database["public"]["Enums"]["account_status"]
          updated_at?: string | null
        }
        Update: {
          academic_level?: string | null
          address?: string | null
          approved_at?: string | null
          approved_by?: string | null
          claimed_at?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          department?: string | null
          email?: string
          faculty?: string | null
          full_name?: string
          id?: string
          is_legacy?: boolean | null
          legacy_id?: string | null
          matric_number?: string | null
          organ?: Database["public"]["Enums"]["organ_type"] | null
          parish?: string | null
          passport_photo_url?: string | null
          phone?: string | null
          position?: Database["public"]["Enums"]["organization_position"] | null
          role?: Database["public"]["Enums"]["user_role"]
          society?: string | null
          status?: Database["public"]["Enums"]["account_status"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_profiles_approved_by"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      is_exco_or_above: { Args: never; Returns: boolean }
      is_super_admin: { Args: never; Returns: boolean }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
    }
    Enums: {
      account_status: "pending" | "active" | "suspended" | "legacy"
      dues_type: "membership_levy" | "annual_dues" | "special_levy" | "other"
      migration_source: "notebook" | "dues_card" | "csv_import" | "manual_entry"
      organ_type:
        | "gospel_band"
        | "evangelical_committee"
        | "federation_theater"
        | "social_communications_commission"
        | "discipline_committee"
      organization_position:
        | "President"
        | "Vice-President"
        | "General Secretary"
        | "Assistant General Secretary"
        | "Financial Secretary"
        | "Treasurer"
        | "Religious Coordinator"
        | "Assistant Religious Coordinator"
        | "Director of Socials"
        | "Assistant Director of Socials"
        | "Director of Works"
        | "Assistant Director of Works"
        | "Director of Transport"
        | "Assistant Director of Transport"
        | "General Public Relations Officer (GPRO)"
        | "Female Public Relations Officer (FPRO)"
        | "Annunciation Public Relations Officer"
        | "Assistant Annunciation Public Relations Officer"
        | "Academic Coordinator"
        | "Assistant Academic Coordinator"
        | "Director of Hostel and Faculty Affairs"
        | "Assistant Director of Hostel and Faculty Affairs"
        | "Ex-Officio Member"
      payment_channel: "online" | "manual"
      payment_status: "pending" | "confirmed" | "failed" | "reversed"
      user_role: "student" | "alumnus" | "exco" | "super_admin"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      account_status: ["pending", "active", "suspended", "legacy"],
      dues_type: ["membership_levy", "annual_dues", "special_levy", "other"],
      migration_source: ["notebook", "dues_card", "csv_import", "manual_entry"],
      organ_type: [
        "gospel_band",
        "evangelical_committee",
        "federation_theater",
        "social_communications_commission",
        "discipline_committee",
      ],
      organization_position: [
        "President",
        "Vice-President",
        "General Secretary",
        "Assistant General Secretary",
        "Financial Secretary",
        "Treasurer",
        "Religious Coordinator",
        "Assistant Religious Coordinator",
        "Director of Socials",
        "Assistant Director of Socials",
        "Director of Works",
        "Assistant Director of Works",
        "Director of Transport",
        "Assistant Director of Transport",
        "General Public Relations Officer (GPRO)",
        "Female Public Relations Officer (FPRO)",
        "Annunciation Public Relations Officer",
        "Assistant Annunciation Public Relations Officer",
        "Academic Coordinator",
        "Assistant Academic Coordinator",
        "Director of Hostel and Faculty Affairs",
        "Assistant Director of Hostel and Faculty Affairs",
        "Ex-Officio Member",
      ],
      payment_channel: ["online", "manual"],
      payment_status: ["pending", "confirmed", "failed", "reversed"],
      user_role: ["student", "alumnus", "exco", "super_admin"],
    },
  },
} as const

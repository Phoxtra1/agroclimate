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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      disaster_alerts: {
        Row: {
          active: boolean
          affected_regions: string[] | null
          alert_type: string
          created_at: string
          created_by: string | null
          description: string | null
          expires_at: string | null
          id: string
          severity: string
          title: string
        }
        Insert: {
          active?: boolean
          affected_regions?: string[] | null
          alert_type: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          expires_at?: string | null
          id?: string
          severity?: string
          title: string
        }
        Update: {
          active?: boolean
          affected_regions?: string[] | null
          alert_type?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          expires_at?: string | null
          id?: string
          severity?: string
          title?: string
        }
        Relationships: []
      }
      drone_missions: {
        Row: {
          advisory_result: string | null
          altitude_m: number | null
          created_at: string
          drone_type: string | null
          id: string
          mission_type: string
          notes: string | null
          planned_date: string | null
          status: string
          target_lat: number | null
          target_location: string | null
          target_lon: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          advisory_result?: string | null
          altitude_m?: number | null
          created_at?: string
          drone_type?: string | null
          id?: string
          mission_type?: string
          notes?: string | null
          planned_date?: string | null
          status?: string
          target_lat?: number | null
          target_location?: string | null
          target_lon?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          advisory_result?: string | null
          altitude_m?: number | null
          created_at?: string
          drone_type?: string | null
          id?: string
          mission_type?: string
          notes?: string | null
          planned_date?: string | null
          status?: string
          target_lat?: number | null
          target_location?: string | null
          target_lon?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      farm_qr_codes: {
        Row: {
          created_at: string
          farm_location: string | null
          farm_name: string
          farmer_id: string
          id: string
          qr_code_data: string
        }
        Insert: {
          created_at?: string
          farm_location?: string | null
          farm_name: string
          farmer_id: string
          id?: string
          qr_code_data: string
        }
        Update: {
          created_at?: string
          farm_location?: string | null
          farm_name?: string
          farmer_id?: string
          id?: string
          qr_code_data?: string
        }
        Relationships: []
      }
      farmer_crops: {
        Row: {
          created_at: string
          crop_name: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          crop_name: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          crop_name?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      fish_ponds: {
        Row: {
          created_at: string
          dissolved_oxygen: number | null
          feeding_schedule: string | null
          id: string
          last_feeding: string | null
          name: string
          notes: string | null
          ph_level: number | null
          pond_size_sqm: number | null
          species: string
          stock_count: number | null
          updated_at: string
          user_id: string
          water_temp: number | null
        }
        Insert: {
          created_at?: string
          dissolved_oxygen?: number | null
          feeding_schedule?: string | null
          id?: string
          last_feeding?: string | null
          name: string
          notes?: string | null
          ph_level?: number | null
          pond_size_sqm?: number | null
          species: string
          stock_count?: number | null
          updated_at?: string
          user_id: string
          water_temp?: number | null
        }
        Update: {
          created_at?: string
          dissolved_oxygen?: number | null
          feeding_schedule?: string | null
          id?: string
          last_feeding?: string | null
          name?: string
          notes?: string | null
          ph_level?: number | null
          pond_size_sqm?: number | null
          species?: string
          stock_count?: number | null
          updated_at?: string
          user_id?: string
          water_temp?: number | null
        }
        Relationships: []
      }
      handler_issues: {
        Row: {
          created_at: string
          description: string | null
          farmer_id: string
          gps_lat: number | null
          gps_lon: number | null
          handler_id: string
          id: string
          issue_type: string
          photo_url: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          farmer_id: string
          gps_lat?: number | null
          gps_lon?: number | null
          handler_id: string
          id?: string
          issue_type: string
          photo_url?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          farmer_id?: string
          gps_lat?: number | null
          gps_lon?: number | null
          handler_id?: string
          id?: string
          issue_type?: string
          photo_url?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "handler_issues_handler_id_fkey"
            columns: ["handler_id"]
            isOneToOne: false
            referencedRelation: "handlers"
            referencedColumns: ["id"]
          },
        ]
      }
      handler_tasks: {
        Row: {
          completed_at: string | null
          created_at: string
          deadline: string | null
          description: string | null
          evidence_required: boolean | null
          farmer_id: string
          field_location: string | null
          handler_id: string
          id: string
          quantity_completed: number | null
          quantity_expected: number | null
          quantity_label: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          deadline?: string | null
          description?: string | null
          evidence_required?: boolean | null
          farmer_id: string
          field_location?: string | null
          handler_id: string
          id?: string
          quantity_completed?: number | null
          quantity_expected?: number | null
          quantity_label?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          deadline?: string | null
          description?: string | null
          evidence_required?: boolean | null
          farmer_id?: string
          field_location?: string | null
          handler_id?: string
          id?: string
          quantity_completed?: number | null
          quantity_expected?: number | null
          quantity_label?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "handler_tasks_handler_id_fkey"
            columns: ["handler_id"]
            isOneToOne: false
            referencedRelation: "handlers"
            referencedColumns: ["id"]
          },
        ]
      }
      handlers: {
        Row: {
          assigned_farm: string | null
          created_at: string
          farmer_id: string
          handler_name: string
          handler_type: string
          id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assigned_farm?: string | null
          created_at?: string
          farmer_id: string
          handler_name: string
          handler_type?: string
          id?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assigned_farm?: string | null
          created_at?: string
          farmer_id?: string
          handler_name?: string
          handler_type?: string
          id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      harvest_losses: {
        Row: {
          created_at: string
          crop_name: string
          farm_plot: string | null
          id: string
          loss_reason: string
          notes: string | null
          quantity_lost: number
          season: string | null
          unit: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          crop_name: string
          farm_plot?: string | null
          id?: string
          loss_reason?: string
          notes?: string | null
          quantity_lost?: number
          season?: string | null
          unit?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          crop_name?: string
          farm_plot?: string | null
          id?: string
          loss_reason?: string
          notes?: string | null
          quantity_lost?: number
          season?: string | null
          unit?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      harvest_records: {
        Row: {
          created_at: string
          crop_name: string
          farm_plot: string | null
          harvest_date: string | null
          id: string
          notes: string | null
          quality_grade: string | null
          quantity: number
          season: string | null
          unit: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          crop_name: string
          farm_plot?: string | null
          harvest_date?: string | null
          id?: string
          notes?: string | null
          quality_grade?: string | null
          quantity?: number
          season?: string | null
          unit?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          crop_name?: string
          farm_plot?: string | null
          harvest_date?: string | null
          id?: string
          notes?: string | null
          quality_grade?: string | null
          quantity?: number
          season?: string | null
          unit?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      inventory_items: {
        Row: {
          created_at: string
          crop_name: string | null
          farm_plot: string | null
          id: string
          item_name: string
          item_type: string
          notes: string | null
          price_per_unit: number
          quantity: number
          season: string | null
          unit: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          crop_name?: string | null
          farm_plot?: string | null
          id?: string
          item_name: string
          item_type: string
          notes?: string | null
          price_per_unit?: number
          quantity?: number
          season?: string | null
          unit?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          crop_name?: string | null
          farm_plot?: string | null
          id?: string
          item_name?: string
          item_type?: string
          notes?: string | null
          price_per_unit?: number
          quantity?: number
          season?: string | null
          unit?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      labor_records: {
        Row: {
          cost_per_day: number
          created_at: string
          crop_name: string | null
          days_worked: number
          farm_plot: string | null
          id: string
          notes: string | null
          season: string | null
          task_description: string
          updated_at: string
          user_id: string
          worker_count: number | null
        }
        Insert: {
          cost_per_day?: number
          created_at?: string
          crop_name?: string | null
          days_worked?: number
          farm_plot?: string | null
          id?: string
          notes?: string | null
          season?: string | null
          task_description: string
          updated_at?: string
          user_id: string
          worker_count?: number | null
        }
        Update: {
          cost_per_day?: number
          created_at?: string
          crop_name?: string | null
          days_worked?: number
          farm_plot?: string | null
          id?: string
          notes?: string | null
          season?: string | null
          task_description?: string
          updated_at?: string
          user_id?: string
          worker_count?: number | null
        }
        Relationships: []
      }
      land_costs: {
        Row: {
          cost_amount: number
          cost_type: string
          created_at: string
          farm_plot: string | null
          id: string
          land_description: string
          notes: string | null
          season: string | null
          size_acres: number
          updated_at: string
          user_id: string
        }
        Insert: {
          cost_amount?: number
          cost_type?: string
          created_at?: string
          farm_plot?: string | null
          id?: string
          land_description: string
          notes?: string | null
          season?: string | null
          size_acres?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          cost_amount?: number
          cost_type?: string
          created_at?: string
          farm_plot?: string | null
          id?: string
          land_description?: string
          notes?: string | null
          season?: string | null
          size_acres?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          community: string | null
          country: string | null
          created_at: string
          display_name: string | null
          district: string | null
          drone_ownership: boolean | null
          drone_type: string | null
          farm_size: string | null
          farmer_type: string | null
          id: string
          phone: string | null
          preferred_language: string | null
          region: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          community?: string | null
          country?: string | null
          created_at?: string
          display_name?: string | null
          district?: string | null
          drone_ownership?: boolean | null
          drone_type?: string | null
          farm_size?: string | null
          farmer_type?: string | null
          id?: string
          phone?: string | null
          preferred_language?: string | null
          region?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          community?: string | null
          country?: string | null
          created_at?: string
          display_name?: string | null
          district?: string | null
          drone_ownership?: boolean | null
          drone_type?: string | null
          farm_size?: string | null
          farmer_type?: string | null
          id?: string
          phone?: string | null
          preferred_language?: string | null
          region?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      sales_records: {
        Row: {
          buyer_name: string | null
          created_at: string
          crop_name: string
          farm_plot: string | null
          id: string
          notes: string | null
          price_per_unit: number
          quantity_sold: number
          sale_date: string | null
          season: string | null
          unit: string
          updated_at: string
          user_id: string
        }
        Insert: {
          buyer_name?: string | null
          created_at?: string
          crop_name: string
          farm_plot?: string | null
          id?: string
          notes?: string | null
          price_per_unit?: number
          quantity_sold?: number
          sale_date?: string | null
          season?: string | null
          unit?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          buyer_name?: string | null
          created_at?: string
          crop_name?: string
          farm_plot?: string | null
          id?: string
          notes?: string | null
          price_per_unit?: number
          quantity_sold?: number
          sale_date?: string | null
          season?: string | null
          unit?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      support_tickets: {
        Row: {
          category: string
          created_at: string
          description: string
          id: string
          location: string | null
          priority: string
          status: string
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string
          created_at?: string
          description: string
          id?: string
          location?: string | null
          priority?: string
          status?: string
          subject: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string
          id?: string
          location?: string | null
          priority?: string
          status?: string
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      task_evidence: {
        Row: {
          created_at: string
          device_id: string | null
          evidence_type: string
          file_url: string | null
          gps_lat: number | null
          gps_lon: number | null
          handler_id: string
          id: string
          notes: string | null
          task_id: string
        }
        Insert: {
          created_at?: string
          device_id?: string | null
          evidence_type?: string
          file_url?: string | null
          gps_lat?: number | null
          gps_lon?: number | null
          handler_id: string
          id?: string
          notes?: string | null
          task_id: string
        }
        Update: {
          created_at?: string
          device_id?: string | null
          evidence_type?: string
          file_url?: string | null
          gps_lat?: number | null
          gps_lon?: number | null
          handler_id?: string
          id?: string
          notes?: string | null
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_evidence_handler_id_fkey"
            columns: ["handler_id"]
            isOneToOne: false
            referencedRelation: "handlers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_evidence_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "handler_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      user_alerts: {
        Row: {
          alert_id: string
          created_at: string
          id: string
          is_dismissed: boolean
          is_read: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          alert_id: string
          created_at?: string
          id?: string
          is_dismissed?: boolean
          is_read?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          alert_id?: string
          created_at?: string
          id?: string
          is_dismissed?: boolean
          is_read?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      work_sessions: {
        Row: {
          clock_in: string
          clock_out: string | null
          created_at: string
          farm_qr_id: string | null
          gps_lat: number | null
          gps_lon: number | null
          handler_id: string
          id: string
        }
        Insert: {
          clock_in?: string
          clock_out?: string | null
          created_at?: string
          farm_qr_id?: string | null
          gps_lat?: number | null
          gps_lon?: number | null
          handler_id: string
          id?: string
        }
        Update: {
          clock_in?: string
          clock_out?: string | null
          created_at?: string
          farm_qr_id?: string | null
          gps_lat?: number | null
          gps_lon?: number | null
          handler_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_sessions_handler_id_fkey"
            columns: ["handler_id"]
            isOneToOne: false
            referencedRelation: "handlers"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user" | "handler"
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
      app_role: ["admin", "moderator", "user", "handler"],
    },
  },
} as const

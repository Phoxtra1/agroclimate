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
      activity: {
        Row: {
          action: string
          created_at: string
          id: string
          metadata: Json | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          metadata?: Json | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          user_id?: string | null
        }
        Relationships: []
      }
      agreements: {
        Row: {
          agreed_price: number
          agreed_quantity: number
          agreement_status: string
          buyer_id: string
          buyer_name: string | null
          created_at: string
          delivery_terms: string | null
          id: string
          listing_id: string | null
          negotiation_id: string
          negotiation_summary: string | null
          order_id: string | null
          product: string | null
          supplier_id: string
          supplier_name: string | null
          unit: string
        }
        Insert: {
          agreed_price: number
          agreed_quantity: number
          agreement_status?: string
          buyer_id: string
          buyer_name?: string | null
          created_at?: string
          delivery_terms?: string | null
          id?: string
          listing_id?: string | null
          negotiation_id: string
          negotiation_summary?: string | null
          order_id?: string | null
          product?: string | null
          supplier_id: string
          supplier_name?: string | null
          unit: string
        }
        Update: {
          agreed_price?: number
          agreed_quantity?: number
          agreement_status?: string
          buyer_id?: string
          buyer_name?: string | null
          created_at?: string
          delivery_terms?: string | null
          id?: string
          listing_id?: string | null
          negotiation_id?: string
          negotiation_summary?: string | null
          order_id?: string | null
          product?: string | null
          supplier_id?: string
          supplier_name?: string | null
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "agreements_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "farmer_inputs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agreements_negotiation_id_fkey"
            columns: ["negotiation_id"]
            isOneToOne: false
            referencedRelation: "negotiations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agreements_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "buyer_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      agrofund_application_trackers: {
        Row: {
          assigned_to: string | null
          id: string
          internal_notes: string | null
          opportunity_id: string | null
          stage: string
          submission_date: string | null
          updated_at: string | null
        }
        Insert: {
          assigned_to?: string | null
          id?: string
          internal_notes?: string | null
          opportunity_id?: string | null
          stage?: string
          submission_date?: string | null
          updated_at?: string | null
        }
        Update: {
          assigned_to?: string | null
          id?: string
          internal_notes?: string | null
          opportunity_id?: string | null
          stage?: string
          submission_date?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agrofund_application_trackers_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: true
            referencedRelation: "agrofund_opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      agrofund_audit_logs: {
        Row: {
          action: string
          admin_id: string | null
          created_at: string | null
          id: string
          new_state: Json | null
          notes: string | null
          opportunity_id: string | null
          previous_state: Json | null
        }
        Insert: {
          action: string
          admin_id?: string | null
          created_at?: string | null
          id?: string
          new_state?: Json | null
          notes?: string | null
          opportunity_id?: string | null
          previous_state?: Json | null
        }
        Update: {
          action?: string
          admin_id?: string | null
          created_at?: string | null
          id?: string
          new_state?: Json | null
          notes?: string | null
          opportunity_id?: string | null
          previous_state?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "agrofund_audit_logs_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "agrofund_opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      agrofund_bookmarks_notes: {
        Row: {
          id: string
          is_bookmarked: boolean | null
          note: string | null
          opportunity_id: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          id?: string
          is_bookmarked?: boolean | null
          note?: string | null
          opportunity_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          id?: string
          is_bookmarked?: boolean | null
          note?: string | null
          opportunity_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agrofund_bookmarks_notes_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "agrofund_opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      agrofund_notifications: {
        Row: {
          created_at: string | null
          id: string
          message: string
          notification_key: string
          opportunity_id: string | null
          read: boolean | null
          title: string
          type: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          message: string
          notification_key: string
          opportunity_id?: string | null
          read?: boolean | null
          title: string
          type: string
        }
        Update: {
          created_at?: string | null
          id?: string
          message?: string
          notification_key?: string
          opportunity_id?: string | null
          read?: boolean | null
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "agrofund_notifications_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "agrofund_opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      agrofund_opportunities: {
        Row: {
          category: string
          created_at: string | null
          currency: string
          deadline: string | null
          discovery_week: string | null
          eligibility_assessment: string
          eligibility_reasons: string
          eligibility_requirements: string
          eligible_countries: string[] | null
          fingerprint: string
          funding_amount: number | null
          id: string
          is_broken_link: boolean | null
          is_expired: boolean | null
          is_published: boolean
          is_suspicious_source: boolean | null
          is_unclear_unverified: boolean | null
          last_verified_at: string | null
          missing_info_flags: string[] | null
          official_application_link: string
          organisation_name: string
          portal_verified_at: string | null
          released_at: string | null
          relevance_score: number | null
          required_documents: string[] | null
          source_credibility_score: number | null
          source_evidence_summary: string
          source_snippet: string | null
          source_url: string
          status: string
          title: string
          unclear_details: string | null
          updated_at: string | null
        }
        Insert: {
          category?: string
          created_at?: string | null
          currency?: string
          deadline?: string | null
          discovery_week?: string | null
          eligibility_assessment?: string
          eligibility_reasons?: string
          eligibility_requirements?: string
          eligible_countries?: string[] | null
          fingerprint: string
          funding_amount?: number | null
          id?: string
          is_broken_link?: boolean | null
          is_expired?: boolean | null
          is_published?: boolean
          is_suspicious_source?: boolean | null
          is_unclear_unverified?: boolean | null
          last_verified_at?: string | null
          missing_info_flags?: string[] | null
          official_application_link: string
          organisation_name: string
          portal_verified_at?: string | null
          released_at?: string | null
          relevance_score?: number | null
          required_documents?: string[] | null
          source_credibility_score?: number | null
          source_evidence_summary?: string
          source_snippet?: string | null
          source_url?: string
          status?: string
          title: string
          unclear_details?: string | null
          updated_at?: string | null
        }
        Update: {
          category?: string
          created_at?: string | null
          currency?: string
          deadline?: string | null
          discovery_week?: string | null
          eligibility_assessment?: string
          eligibility_reasons?: string
          eligibility_requirements?: string
          eligible_countries?: string[] | null
          fingerprint?: string
          funding_amount?: number | null
          id?: string
          is_broken_link?: boolean | null
          is_expired?: boolean | null
          is_published?: boolean
          is_suspicious_source?: boolean | null
          is_unclear_unverified?: boolean | null
          last_verified_at?: string | null
          missing_info_flags?: string[] | null
          official_application_link?: string
          organisation_name?: string
          portal_verified_at?: string | null
          released_at?: string | null
          relevance_score?: number | null
          required_documents?: string[] | null
          source_credibility_score?: number | null
          source_evidence_summary?: string
          source_snippet?: string | null
          source_url?: string
          status?: string
          title?: string
          unclear_details?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      agrofund_refresh_logs: {
        Row: {
          completed_at: string | null
          created_at: string | null
          error_message: string | null
          id: string
          new_inserted: number | null
          opportunities_found: number | null
          records_updated: number | null
          refresh_type: string
          status: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          new_inserted?: number | null
          opportunities_found?: number | null
          records_updated?: number | null
          refresh_type?: string
          status?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          new_inserted?: number | null
          opportunities_found?: number | null
          records_updated?: number | null
          refresh_type?: string
          status?: string
        }
        Relationships: []
      }
      agtrans_drivers: {
        Row: {
          admin_suspended: boolean
          approval_status: string
          availability_status: string
          cancellations: number | null
          cancelled_trips: number | null
          cargo_categories: string[] | null
          cargo_types_accepted: string[]
          completed_deliveries: number | null
          created_at: string
          current_location: Json | null
          current_location_text: string | null
          departure_date: string | null
          departure_time: string | null
          destination: string | null
          disputes: number | null
          district: string | null
          driver_photo_url: string | null
          driver_rating: number
          estimated_arrival: string | null
          full_name: string
          id: string
          insurance_status: string | null
          late_deliveries: number | null
          license_class: string | null
          license_url: string | null
          notes: string | null
          offer_notes: string | null
          offer_status: string
          phone: string
          pickup_area: string | null
          planned_route: string | null
          plate_number: string
          preferred_corridors: string[] | null
          pricing_type: string
          rate_information: string | null
          rating_count: number
          region: string | null
          rejection_reason: string | null
          reliability_score: number | null
          remaining_capacity: number
          roadworthiness_status: string | null
          route_coverage: string[] | null
          route_flexibility: string | null
          special_cargo_instructions: string | null
          suggested_fee: number | null
          updated_at: string
          user_id: string
          vehicle_capacity_kg: number | null
          vehicle_features: string[]
          vehicle_images: string[] | null
          vehicle_type: string
          verification_status: string
        }
        Insert: {
          admin_suspended?: boolean
          approval_status?: string
          availability_status?: string
          cancellations?: number | null
          cancelled_trips?: number | null
          cargo_categories?: string[] | null
          cargo_types_accepted?: string[]
          completed_deliveries?: number | null
          created_at?: string
          current_location?: Json | null
          current_location_text?: string | null
          departure_date?: string | null
          departure_time?: string | null
          destination?: string | null
          disputes?: number | null
          district?: string | null
          driver_photo_url?: string | null
          driver_rating?: number
          estimated_arrival?: string | null
          full_name: string
          id?: string
          insurance_status?: string | null
          late_deliveries?: number | null
          license_class?: string | null
          license_url?: string | null
          notes?: string | null
          offer_notes?: string | null
          offer_status?: string
          phone: string
          pickup_area?: string | null
          planned_route?: string | null
          plate_number: string
          preferred_corridors?: string[] | null
          pricing_type?: string
          rate_information?: string | null
          rating_count?: number
          region?: string | null
          rejection_reason?: string | null
          reliability_score?: number | null
          remaining_capacity?: number
          roadworthiness_status?: string | null
          route_coverage?: string[] | null
          route_flexibility?: string | null
          special_cargo_instructions?: string | null
          suggested_fee?: number | null
          updated_at?: string
          user_id: string
          vehicle_capacity_kg?: number | null
          vehicle_features?: string[]
          vehicle_images?: string[] | null
          vehicle_type: string
          verification_status?: string
        }
        Update: {
          admin_suspended?: boolean
          approval_status?: string
          availability_status?: string
          cancellations?: number | null
          cancelled_trips?: number | null
          cargo_categories?: string[] | null
          cargo_types_accepted?: string[]
          completed_deliveries?: number | null
          created_at?: string
          current_location?: Json | null
          current_location_text?: string | null
          departure_date?: string | null
          departure_time?: string | null
          destination?: string | null
          disputes?: number | null
          district?: string | null
          driver_photo_url?: string | null
          driver_rating?: number
          estimated_arrival?: string | null
          full_name?: string
          id?: string
          insurance_status?: string | null
          late_deliveries?: number | null
          license_class?: string | null
          license_url?: string | null
          notes?: string | null
          offer_notes?: string | null
          offer_status?: string
          phone?: string
          pickup_area?: string | null
          planned_route?: string | null
          plate_number?: string
          preferred_corridors?: string[] | null
          pricing_type?: string
          rate_information?: string | null
          rating_count?: number
          region?: string | null
          rejection_reason?: string | null
          reliability_score?: number | null
          remaining_capacity?: number
          roadworthiness_status?: string | null
          route_coverage?: string[] | null
          route_flexibility?: string | null
          special_cargo_instructions?: string | null
          suggested_fee?: number | null
          updated_at?: string
          user_id?: string
          vehicle_capacity_kg?: number | null
          vehicle_features?: string[]
          vehicle_images?: string[] | null
          vehicle_type?: string
          verification_status?: string
        }
        Relationships: []
      }
      agtrans_ratings: {
        Row: {
          comment: string | null
          created_at: string
          driver_id: string
          id: string
          rater_id: string
          rater_role: string
          request_id: string
          score: number
        }
        Insert: {
          comment?: string | null
          created_at?: string
          driver_id: string
          id?: string
          rater_id: string
          rater_role?: string
          request_id: string
          score: number
        }
        Update: {
          comment?: string | null
          created_at?: string
          driver_id?: string
          id?: string
          rater_id?: string
          rater_role?: string
          request_id?: string
          score?: number
        }
        Relationships: [
          {
            foreignKeyName: "agtrans_ratings_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "agtrans_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      agtrans_requests: {
        Row: {
          agreed_fee: number | null
          agreement_id: string | null
          agreement_timestamp: string | null
          buyer_id: string | null
          cargo_features: string[] | null
          cargo_types: string[] | null
          cargo_weight: number | null
          counter_note: string | null
          created_at: string
          delivery_lat: number | null
          delivery_location: string
          delivery_lon: number | null
          driver_counter_price: number | null
          driver_id: string | null
          estimated_price: number | null
          id: string
          marketplace_order_id: string | null
          negotiation_status: string | null
          notes: string | null
          pickup_lat: number | null
          pickup_location: string
          pickup_lon: number | null
          preferred_pickup_at: string | null
          product_type: string
          quantity: number
          rejection_reason: string | null
          request_type: string | null
          status: string
          supplier_id: string
          supplier_offer_price: number | null
          tracking_code: string
          transport_offer_id: string | null
          unit: string
          updated_at: string
          urgency: string
        }
        Insert: {
          agreed_fee?: number | null
          agreement_id?: string | null
          agreement_timestamp?: string | null
          buyer_id?: string | null
          cargo_features?: string[] | null
          cargo_types?: string[] | null
          cargo_weight?: number | null
          counter_note?: string | null
          created_at?: string
          delivery_lat?: number | null
          delivery_location: string
          delivery_lon?: number | null
          driver_counter_price?: number | null
          driver_id?: string | null
          estimated_price?: number | null
          id?: string
          marketplace_order_id?: string | null
          negotiation_status?: string | null
          notes?: string | null
          pickup_lat?: number | null
          pickup_location: string
          pickup_lon?: number | null
          preferred_pickup_at?: string | null
          product_type: string
          quantity?: number
          rejection_reason?: string | null
          request_type?: string | null
          status?: string
          supplier_id: string
          supplier_offer_price?: number | null
          tracking_code?: string
          transport_offer_id?: string | null
          unit?: string
          updated_at?: string
          urgency?: string
        }
        Update: {
          agreed_fee?: number | null
          agreement_id?: string | null
          agreement_timestamp?: string | null
          buyer_id?: string | null
          cargo_features?: string[] | null
          cargo_types?: string[] | null
          cargo_weight?: number | null
          counter_note?: string | null
          created_at?: string
          delivery_lat?: number | null
          delivery_location?: string
          delivery_lon?: number | null
          driver_counter_price?: number | null
          driver_id?: string | null
          estimated_price?: number | null
          id?: string
          marketplace_order_id?: string | null
          negotiation_status?: string | null
          notes?: string | null
          pickup_lat?: number | null
          pickup_location?: string
          pickup_lon?: number | null
          preferred_pickup_at?: string | null
          product_type?: string
          quantity?: number
          rejection_reason?: string | null
          request_type?: string | null
          status?: string
          supplier_id?: string
          supplier_offer_price?: number | null
          tracking_code?: string
          transport_offer_id?: string | null
          unit?: string
          updated_at?: string
          urgency?: string
        }
        Relationships: []
      }
      agtrans_tracking_events: {
        Row: {
          created_at: string
          driver_id: string | null
          event_type: string
          id: string
          lat: number | null
          lon: number | null
          note: string | null
          request_id: string
          status: string | null
        }
        Insert: {
          created_at?: string
          driver_id?: string | null
          event_type?: string
          id?: string
          lat?: number | null
          lon?: number | null
          note?: string | null
          request_id: string
          status?: string | null
        }
        Update: {
          created_at?: string
          driver_id?: string | null
          event_type?: string
          id?: string
          lat?: number | null
          lon?: number | null
          note?: string | null
          request_id?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agtrans_tracking_events_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "agtrans_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_usage_logs: {
        Row: {
          action: string
          created_at: string
          error: string | null
          id: string
          latency_ms: number | null
          model: string
          ok: boolean
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          error?: string | null
          id?: string
          latency_ms?: number | null
          model: string
          ok?: boolean
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          error?: string | null
          id?: string
          latency_ms?: number | null
          model?: string
          ok?: boolean
          user_id?: string | null
        }
        Relationships: []
      }
      alert_logs: {
        Row: {
          alert_id: string | null
          alert_type: string | null
          created_at: string
          delivered: boolean
          delivered_at: string
          id: string
          opened: boolean
          opened_at: string | null
          severity: string | null
          user_id: string | null
        }
        Insert: {
          alert_id?: string | null
          alert_type?: string | null
          created_at?: string
          delivered?: boolean
          delivered_at?: string
          id?: string
          opened?: boolean
          opened_at?: string | null
          severity?: string | null
          user_id?: string | null
        }
        Update: {
          alert_id?: string | null
          alert_type?: string | null
          created_at?: string
          delivered?: boolean
          delivered_at?: string
          id?: string
          opened?: boolean
          opened_at?: string | null
          severity?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      buyer_orders: {
        Row: {
          buyer_id: string
          buyer_name: string | null
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          crop_name: string
          delivery_end: string | null
          delivery_start: string | null
          grade: string | null
          id: string
          moisture: string | null
          negotiation_status: string | null
          notes: string | null
          order_status: string | null
          price_label: string | null
          quality: string | null
          quantity_needed: number
          region: string | null
          status: string
          target_price: number
          unit: string
          updated_at: string
        }
        Insert: {
          buyer_id: string
          buyer_name?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          crop_name: string
          delivery_end?: string | null
          delivery_start?: string | null
          grade?: string | null
          id?: string
          moisture?: string | null
          negotiation_status?: string | null
          notes?: string | null
          order_status?: string | null
          price_label?: string | null
          quality?: string | null
          quantity_needed?: number
          region?: string | null
          status?: string
          target_price?: number
          unit?: string
          updated_at?: string
        }
        Update: {
          buyer_id?: string
          buyer_name?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          crop_name?: string
          delivery_end?: string | null
          delivery_start?: string | null
          grade?: string | null
          id?: string
          moisture?: string | null
          negotiation_status?: string | null
          notes?: string | null
          order_status?: string | null
          price_label?: string | null
          quality?: string | null
          quantity_needed?: number
          region?: string | null
          status?: string
          target_price?: number
          unit?: string
          updated_at?: string
        }
        Relationships: []
      }
      delivery_jobs: {
        Row: {
          agreement_id: string | null
          buyer_id: string | null
          created_at: string
          destination: string
          driver_id: string
          driver_name: string | null
          id: string
          pickup_location: string
          plate_number: string | null
          product: string
          quantity: number
          request_id: string | null
          status: string
          supplier_id: string
          transport_agreement_id: string | null
          transport_fee: number | null
          updated_at: string
          vehicle_type: string | null
        }
        Insert: {
          agreement_id?: string | null
          buyer_id?: string | null
          created_at?: string
          destination: string
          driver_id: string
          driver_name?: string | null
          id?: string
          pickup_location: string
          plate_number?: string | null
          product: string
          quantity?: number
          request_id?: string | null
          status?: string
          supplier_id: string
          transport_agreement_id?: string | null
          transport_fee?: number | null
          updated_at?: string
          vehicle_type?: string | null
        }
        Update: {
          agreement_id?: string | null
          buyer_id?: string | null
          created_at?: string
          destination?: string
          driver_id?: string
          driver_name?: string | null
          id?: string
          pickup_location?: string
          plate_number?: string | null
          product?: string
          quantity?: number
          request_id?: string | null
          status?: string
          supplier_id?: string
          transport_agreement_id?: string | null
          transport_fee?: number | null
          updated_at?: string
          vehicle_type?: string | null
        }
        Relationships: []
      }
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
      drone_ai_detections: {
        Row: {
          bounding_box: Json | null
          captured_at: string
          category: string
          created_at: string
          id: string
          media_id: string | null
          mission_id: string | null
          observation: string
          recommended_action: string | null
          risk_score: number | null
          user_id: string
        }
        Insert: {
          bounding_box?: Json | null
          captured_at?: string
          category: string
          created_at?: string
          id?: string
          media_id?: string | null
          mission_id?: string | null
          observation: string
          recommended_action?: string | null
          risk_score?: number | null
          user_id: string
        }
        Update: {
          bounding_box?: Json | null
          captured_at?: string
          category?: string
          created_at?: string
          id?: string
          media_id?: string | null
          mission_id?: string | null
          observation?: string
          recommended_action?: string | null
          risk_score?: number | null
          user_id?: string
        }
        Relationships: []
      }
      drone_media: {
        Row: {
          archived: boolean
          captured_at: string
          created_at: string
          drone_id: string | null
          id: string
          media_type: string
          metadata: Json | null
          mission_id: string | null
          storage_path: string
          user_id: string
        }
        Insert: {
          archived?: boolean
          captured_at?: string
          created_at?: string
          drone_id?: string | null
          id?: string
          media_type: string
          metadata?: Json | null
          mission_id?: string | null
          storage_path: string
          user_id: string
        }
        Update: {
          archived?: boolean
          captured_at?: string
          created_at?: string
          drone_id?: string | null
          id?: string
          media_type?: string
          metadata?: Json | null
          mission_id?: string | null
          storage_path?: string
          user_id?: string
        }
        Relationships: []
      }
      drone_missions: {
        Row: {
          advisory_result: string | null
          altitude_m: number | null
          area_polygon: Json | null
          autonomous: boolean | null
          camera_settings: Json | null
          completed_at: string | null
          created_at: string
          drone_id: string | null
          drone_type: string | null
          estimated_battery_pct: number | null
          estimated_coverage_ha: number | null
          estimated_duration_min: number | null
          id: string
          mission_type: string
          name: string | null
          notes: string | null
          planned_date: string | null
          route_pattern: string | null
          speed_ms: number | null
          started_at: string | null
          status: string
          success: boolean | null
          target_lat: number | null
          target_location: string | null
          target_lon: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          advisory_result?: string | null
          altitude_m?: number | null
          area_polygon?: Json | null
          autonomous?: boolean | null
          camera_settings?: Json | null
          completed_at?: string | null
          created_at?: string
          drone_id?: string | null
          drone_type?: string | null
          estimated_battery_pct?: number | null
          estimated_coverage_ha?: number | null
          estimated_duration_min?: number | null
          id?: string
          mission_type?: string
          name?: string | null
          notes?: string | null
          planned_date?: string | null
          route_pattern?: string | null
          speed_ms?: number | null
          started_at?: string | null
          status?: string
          success?: boolean | null
          target_lat?: number | null
          target_location?: string | null
          target_lon?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          advisory_result?: string | null
          altitude_m?: number | null
          area_polygon?: Json | null
          autonomous?: boolean | null
          camera_settings?: Json | null
          completed_at?: string | null
          created_at?: string
          drone_id?: string | null
          drone_type?: string | null
          estimated_battery_pct?: number | null
          estimated_coverage_ha?: number | null
          estimated_duration_min?: number | null
          id?: string
          mission_type?: string
          name?: string | null
          notes?: string | null
          planned_date?: string | null
          route_pattern?: string | null
          speed_ms?: number | null
          started_at?: string | null
          status?: string
          success?: boolean | null
          target_lat?: number | null
          target_location?: string | null
          target_lon?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      drone_telemetry_logs: {
        Row: {
          altitude_m: number | null
          battery_pct: number | null
          captured_at: string
          drone_id: string | null
          gps_accuracy_m: number | null
          ground_speed_ms: number | null
          heading: number | null
          id: string
          lat: number | null
          lng: number | null
          mission_id: string | null
          payload: Json | null
          signal_strength: number | null
          user_id: string
          vertical_speed_ms: number | null
        }
        Insert: {
          altitude_m?: number | null
          battery_pct?: number | null
          captured_at?: string
          drone_id?: string | null
          gps_accuracy_m?: number | null
          ground_speed_ms?: number | null
          heading?: number | null
          id?: string
          lat?: number | null
          lng?: number | null
          mission_id?: string | null
          payload?: Json | null
          signal_strength?: number | null
          user_id: string
          vertical_speed_ms?: number | null
        }
        Update: {
          altitude_m?: number | null
          battery_pct?: number | null
          captured_at?: string
          drone_id?: string | null
          gps_accuracy_m?: number | null
          ground_speed_ms?: number | null
          heading?: number | null
          id?: string
          lat?: number | null
          lng?: number | null
          mission_id?: string | null
          payload?: Json | null
          signal_strength?: number | null
          user_id?: string
          vertical_speed_ms?: number | null
        }
        Relationships: []
      }
      drones: {
        Row: {
          aircraft_type: string
          created_at: string
          firmware: string | null
          home_base: string | null
          id: string
          last_battery_pct: number | null
          last_handshake_at: string | null
          last_seen_at: string | null
          manufacturer: string | null
          metadata: Json | null
          model: string | null
          name: string
          operator: string | null
          paired_at: string | null
          protocol: string
          serial: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          aircraft_type?: string
          created_at?: string
          firmware?: string | null
          home_base?: string | null
          id?: string
          last_battery_pct?: number | null
          last_handshake_at?: string | null
          last_seen_at?: string | null
          manufacturer?: string | null
          metadata?: Json | null
          model?: string | null
          name: string
          operator?: string | null
          paired_at?: string | null
          protocol?: string
          serial?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          aircraft_type?: string
          created_at?: string
          firmware?: string | null
          home_base?: string | null
          id?: string
          last_battery_pct?: number | null
          last_handshake_at?: string | null
          last_seen_at?: string | null
          manufacturer?: string | null
          metadata?: Json | null
          model?: string | null
          name?: string
          operator?: string | null
          paired_at?: string | null
          protocol?: string
          serial?: string | null
          status?: string
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
      farmer_inputs: {
        Row: {
          category: string | null
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          crop_name: string
          delivery_timeline: string | null
          demand_level: string | null
          estimated_price: number | null
          expected_quantity: number
          harvest_end: string | null
          harvest_start: string | null
          id: string
          image_url: string | null
          listing_status: string | null
          notes: string | null
          owner_id: string | null
          price_label: string | null
          quality_grade: string | null
          region: string | null
          risk_level: string
          status: string
          suggested_price: number | null
          unit: string
          updated_at: string
          user_id: string
          verified: boolean | null
        }
        Insert: {
          category?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          crop_name: string
          delivery_timeline?: string | null
          demand_level?: string | null
          estimated_price?: number | null
          expected_quantity?: number
          harvest_end?: string | null
          harvest_start?: string | null
          id?: string
          image_url?: string | null
          listing_status?: string | null
          notes?: string | null
          owner_id?: string | null
          price_label?: string | null
          quality_grade?: string | null
          region?: string | null
          risk_level?: string
          status?: string
          suggested_price?: number | null
          unit?: string
          updated_at?: string
          user_id: string
          verified?: boolean | null
        }
        Update: {
          category?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          crop_name?: string
          delivery_timeline?: string | null
          demand_level?: string | null
          estimated_price?: number | null
          expected_quantity?: number
          harvest_end?: string | null
          harvest_start?: string | null
          id?: string
          image_url?: string | null
          listing_status?: string | null
          notes?: string | null
          owner_id?: string | null
          price_label?: string | null
          quality_grade?: string | null
          region?: string | null
          risk_level?: string
          status?: string
          suggested_price?: number | null
          unit?: string
          updated_at?: string
          user_id?: string
          verified?: boolean | null
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
      fleet_alert_thresholds: {
        Row: {
          battery_critical_pct: number
          battery_warning_pct: number
          created_at: string
          id: string
          is_default: boolean
          signal_critical_pct: number
          signal_warning_pct: number
          stale_timeout_sec: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          battery_critical_pct?: number
          battery_warning_pct?: number
          created_at?: string
          id?: string
          is_default?: boolean
          signal_critical_pct?: number
          signal_warning_pct?: number
          stale_timeout_sec?: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          battery_critical_pct?: number
          battery_warning_pct?: number
          created_at?: string
          id?: string
          is_default?: boolean
          signal_critical_pct?: number
          signal_warning_pct?: number
          stale_timeout_sec?: number
          updated_at?: string
          user_id?: string | null
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
      market_contracts: {
        Row: {
          buyer_id: string
          buyer_order_id: string | null
          created_at: string
          crop_name: string
          delivery_end: string | null
          delivery_start: string | null
          farmer_id: string
          farmer_input_id: string | null
          id: string
          locked_price: number
          logistics_status: string
          notes: string | null
          quantity: number
          state: string
          unit: string
          updated_at: string
        }
        Insert: {
          buyer_id: string
          buyer_order_id?: string | null
          created_at?: string
          crop_name: string
          delivery_end?: string | null
          delivery_start?: string | null
          farmer_id: string
          farmer_input_id?: string | null
          id?: string
          locked_price?: number
          logistics_status?: string
          notes?: string | null
          quantity?: number
          state?: string
          unit?: string
          updated_at?: string
        }
        Update: {
          buyer_id?: string
          buyer_order_id?: string | null
          created_at?: string
          crop_name?: string
          delivery_end?: string | null
          delivery_start?: string | null
          farmer_id?: string
          farmer_input_id?: string | null
          id?: string
          locked_price?: number
          logistics_status?: string
          notes?: string | null
          quantity?: number
          state?: string
          unit?: string
          updated_at?: string
        }
        Relationships: []
      }
      market_messages: {
        Row: {
          body: string
          created_at: string
          id: string
          read_at: string | null
          recipient_id: string
          related_order_id: string | null
          related_supply_id: string | null
          sender_id: string
          thread_key: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          read_at?: string | null
          recipient_id: string
          related_order_id?: string | null
          related_supply_id?: string | null
          sender_id: string
          thread_key: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          read_at?: string | null
          recipient_id?: string
          related_order_id?: string | null
          related_supply_id?: string | null
          sender_id?: string
          thread_key?: string
        }
        Relationships: []
      }
      market_presence: {
        Row: {
          display_name: string | null
          last_seen: string
          user_id: string
        }
        Insert: {
          display_name?: string | null
          last_seen?: string
          user_id: string
        }
        Update: {
          display_name?: string | null
          last_seen?: string
          user_id?: string
        }
        Relationships: []
      }
      negotiations: {
        Row: {
          agreed_price: number | null
          agreed_quantity: number | null
          buyer_id: string
          created_at: string
          id: string
          last_message_at: string | null
          listing_id: string | null
          order_id: string | null
          status: string
          supplier_id: string
          unit: string | null
          updated_at: string
        }
        Insert: {
          agreed_price?: number | null
          agreed_quantity?: number | null
          buyer_id: string
          created_at?: string
          id?: string
          last_message_at?: string | null
          listing_id?: string | null
          order_id?: string | null
          status?: string
          supplier_id: string
          unit?: string | null
          updated_at?: string
        }
        Update: {
          agreed_price?: number | null
          agreed_quantity?: number | null
          buyer_id?: string
          created_at?: string
          id?: string
          last_message_at?: string | null
          listing_id?: string | null
          order_id?: string | null
          status?: string
          supplier_id?: string
          unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "negotiations_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "farmer_inputs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "negotiations_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "buyer_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      post_harvest_entries: {
        Row: {
          created_at: string
          crop_name: string
          harvest_date: string
          id: string
          notes: string | null
          photos: string[] | null
          quantity: number
          risk_override: string | null
          storage_location: string | null
          storage_method: string | null
          unit: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          crop_name: string
          harvest_date?: string
          id?: string
          notes?: string | null
          photos?: string[] | null
          quantity?: number
          risk_override?: string | null
          storage_location?: string | null
          storage_method?: string | null
          unit?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          crop_name?: string
          harvest_date?: string
          id?: string
          notes?: string | null
          photos?: string[] | null
          quantity?: number
          risk_override?: string | null
          storage_location?: string | null
          storage_method?: string | null
          unit?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      price_intelligence: {
        Row: {
          created_at: string
          crop_name: string
          current_price: number
          id: string
          region: string | null
          suggested_price: number
          trend: string
          unit: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          crop_name: string
          current_price?: number
          id?: string
          region?: string | null
          suggested_price?: number
          trend?: string
          unit?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          crop_name?: string
          current_price?: number
          id?: string
          region?: string | null
          suggested_price?: number
          trend?: string
          unit?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
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
          avatar_url?: string | null
          bio?: string | null
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
          avatar_url?: string | null
          bio?: string | null
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
      system_settings: {
        Row: {
          created_at: string
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          created_at?: string
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Update: {
          created_at?: string
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
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
      tracking_sessions: {
        Row: {
          created_at: string
          current_lat: number | null
          current_lon: number | null
          delivery_job_id: string
          destination: string | null
          distance_m: number | null
          driver_id: string
          driver_name: string | null
          eta: string | null
          heading: number | null
          id: string
          pickup_location: string | null
          plate_number: string | null
          route: Json | null
          speed_kn: number | null
          status: string
          updated_at: string
          vehicle_type: string | null
        }
        Insert: {
          created_at?: string
          current_lat?: number | null
          current_lon?: number | null
          delivery_job_id: string
          destination?: string | null
          distance_m?: number | null
          driver_id: string
          driver_name?: string | null
          eta?: string | null
          heading?: number | null
          id?: string
          pickup_location?: string | null
          plate_number?: string | null
          route?: Json | null
          speed_kn?: number | null
          status?: string
          updated_at?: string
          vehicle_type?: string | null
        }
        Update: {
          created_at?: string
          current_lat?: number | null
          current_lon?: number | null
          delivery_job_id?: string
          destination?: string | null
          distance_m?: number | null
          driver_id?: string
          driver_name?: string | null
          eta?: string | null
          heading?: number | null
          id?: string
          pickup_location?: string | null
          plate_number?: string | null
          route?: Json | null
          speed_kn?: number | null
          status?: string
          updated_at?: string
          vehicle_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tracking_sessions_delivery_job_id_fkey"
            columns: ["delivery_job_id"]
            isOneToOne: false
            referencedRelation: "delivery_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      transport_agreements: {
        Row: {
          agreed_fee: number
          agreement_timestamp: string
          buyer_id: string | null
          created_at: string
          delivery_status: string
          driver_id: string
          id: string
          marketplace_order_id: string | null
          request_id: string | null
          supplier_id: string
          updated_at: string
        }
        Insert: {
          agreed_fee?: number
          agreement_timestamp?: string
          buyer_id?: string | null
          created_at?: string
          delivery_status?: string
          driver_id: string
          id?: string
          marketplace_order_id?: string | null
          request_id?: string | null
          supplier_id: string
          updated_at?: string
        }
        Update: {
          agreed_fee?: number
          agreement_timestamp?: string
          buyer_id?: string | null
          created_at?: string
          delivery_status?: string
          driver_id?: string
          id?: string
          marketplace_order_id?: string | null
          request_id?: string | null
          supplier_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      transport_notifications: {
        Row: {
          created_at: string
          data: Json | null
          id: string
          is_read: boolean
          message: string
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          data?: Json | null
          id?: string
          is_read?: boolean
          message?: string
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          data?: Json | null
          id?: string
          is_read?: boolean
          message?: string
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      user_alert_events: {
        Row: {
          alert_id: string
          alert_type: string | null
          created_at: string
          event: string
          id: string
          severity: string | null
          user_id: string
        }
        Insert: {
          alert_id: string
          alert_type?: string | null
          created_at?: string
          event?: string
          id?: string
          severity?: string | null
          user_id: string
        }
        Update: {
          alert_id?: string
          alert_type?: string | null
          created_at?: string
          event?: string
          id?: string
          severity?: string | null
          user_id?: string
        }
        Relationships: []
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
      user_preferences: {
        Row: {
          created_at: string
          prefs: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          prefs?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          prefs?: Json
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
      user_subscriptions: {
        Row: {
          activated_at: string | null
          amount_local: number | null
          amount_usd: number | null
          created_at: string
          currency: string | null
          expires_at: string | null
          id: string
          paystack_reference: string | null
          plan: string
          provider: string
          provider_reference: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          activated_at?: string | null
          amount_local?: number | null
          amount_usd?: number | null
          created_at?: string
          currency?: string | null
          expires_at?: string | null
          id?: string
          paystack_reference?: string | null
          plan?: string
          provider?: string
          provider_reference?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          activated_at?: string | null
          amount_local?: number | null
          amount_usd?: number | null
          created_at?: string
          currency?: string | null
          expires_at?: string | null
          id?: string
          paystack_reference?: string | null
          plan?: string
          provider?: string
          provider_reference?: string | null
          status?: string
          updated_at?: string
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
      admin_overview_stats: {
        Args: { p_since: string; p_today: string }
        Returns: Json
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user" | "handler" | "buyer" | "driver"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["admin", "moderator", "user", "handler", "buyer", "driver"],
    },
  },
} as const

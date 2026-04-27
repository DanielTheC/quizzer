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
      host_allowlisted_emails: {
        Row: {
          default_fee_pence: number
          email: string
          first_name: string | null
          last_name: string | null
        }
        Insert: {
          default_fee_pence?: number
          email: string
          first_name?: string | null
          last_name?: string | null
        }
        Update: {
          default_fee_pence?: number
          email?: string
          first_name?: string | null
          last_name?: string | null
        }
        Relationships: []
      }
      host_applications: {
        Row: {
          created_at: string
          email: string
          experience_notes: string
          full_name: string
          host_user_id: string | null
          id: string
          phone: string
          quiz_event_id: string | null
          rejection_reason: string | null
          reviewed_at: string | null
          status: Database["public"]["Enums"]["host_application_status"]
        }
        Insert: {
          created_at?: string
          email: string
          experience_notes: string
          full_name: string
          host_user_id?: string | null
          id?: string
          phone: string
          quiz_event_id?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          status?: Database["public"]["Enums"]["host_application_status"]
        }
        Update: {
          created_at?: string
          email?: string
          experience_notes?: string
          full_name?: string
          host_user_id?: string | null
          id?: string
          phone?: string
          quiz_event_id?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          status?: Database["public"]["Enums"]["host_application_status"]
        }
        Relationships: [
          {
            foreignKeyName: "host_applications_quiz_event_id_fkey"
            columns: ["quiz_event_id"]
            isOneToOne: false
            referencedRelation: "quiz_events"
            referencedColumns: ["id"]
          },
        ]
      }
      host_quiz_sessions: {
        Row: {
          completed_at: string
          entry_fee_pence: number | null
          gross_earnings_pence: number | null
          host_user_id: string
          id: string
          pack_id: string | null
          team_count: number
          total_player_count: number
          venue_id: string | null
        }
        Insert: {
          completed_at?: string
          entry_fee_pence?: number | null
          gross_earnings_pence?: number | null
          host_user_id: string
          id?: string
          pack_id?: string | null
          team_count?: number
          total_player_count?: number
          venue_id?: string | null
        }
        Update: {
          completed_at?: string
          entry_fee_pence?: number | null
          gross_earnings_pence?: number | null
          host_user_id?: string
          id?: string
          pack_id?: string | null
          team_count?: number
          total_player_count?: number
          venue_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "host_quiz_sessions_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "quiz_packs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "host_quiz_sessions_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      host_series_interests: {
        Row: {
          created_at: string
          host_user_id: string
          quiz_event_id: string
        }
        Insert: {
          created_at?: string
          host_user_id: string
          quiz_event_id: string
        }
        Update: {
          created_at?: string
          host_user_id?: string
          quiz_event_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "host_series_interests_quiz_event_id_fkey"
            columns: ["quiz_event_id"]
            isOneToOne: false
            referencedRelation: "quiz_events"
            referencedColumns: ["id"]
          },
        ]
      }
      host_venue_rates: {
        Row: {
          created_at: string
          fee_pence: number
          host_user_id: string
          id: string
          notes: string | null
          venue_id: string
        }
        Insert: {
          created_at?: string
          fee_pence: number
          host_user_id: string
          id?: string
          notes?: string | null
          venue_id: string
        }
        Update: {
          created_at?: string
          fee_pence?: number
          host_user_id?: string
          id?: string
          notes?: string | null
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "host_venue_rates_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      image_sets: {
        Row: {
          id: string
          image_a_url: string
          image_b_url: string
          image_c_url: string
          weekly_quiz_id: string
        }
        Insert: {
          id?: string
          image_a_url: string
          image_b_url: string
          image_c_url: string
          weekly_quiz_id: string
        }
        Update: {
          id?: string
          image_a_url?: string
          image_b_url?: string
          image_c_url?: string
          weekly_quiz_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "image_sets_weekly_quiz_id_fkey"
            columns: ["weekly_quiz_id"]
            isOneToOne: false
            referencedRelation: "weekly_quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      operator_allowlisted_emails: {
        Row: {
          email: string
        }
        Insert: {
          email: string
        }
        Update: {
          email?: string
        }
        Relationships: []
      }
      operator_notifications: {
        Row: {
          created_at: string
          id: string
          payload: Json
          read_at: string | null
          reason: string
        }
        Insert: {
          created_at?: string
          id?: string
          payload?: Json
          read_at?: string | null
          reason: string
        }
        Update: {
          created_at?: string
          id?: string
          payload?: Json
          read_at?: string | null
          reason?: string
        }
        Relationships: []
      }
      operator_users: {
        Row: {
          created_at: string
          id: string
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      picture_round_scores: {
        Row: {
          id: string
          points: number
          team_id: string
        }
        Insert: {
          id?: string
          points?: number
          team_id: string
        }
        Update: {
          id?: string
          points?: number
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "picture_round_scores_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: true
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      publican_messages: {
        Row: {
          body: string
          created_at: string
          id: string
          message_type: Database["public"]["Enums"]["publican_message_type"]
          operator_reply: string | null
          publican_user_id: string
          quiz_event_id: string | null
          resolved_at: string | null
          status: Database["public"]["Enums"]["publican_message_status"]
          venue_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          message_type: Database["public"]["Enums"]["publican_message_type"]
          operator_reply?: string | null
          publican_user_id?: string
          quiz_event_id?: string | null
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["publican_message_status"]
          venue_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          message_type?: Database["public"]["Enums"]["publican_message_type"]
          operator_reply?: string | null
          publican_user_id?: string
          quiz_event_id?: string | null
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["publican_message_status"]
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "publican_messages_quiz_event_id_fkey"
            columns: ["quiz_event_id"]
            isOneToOne: false
            referencedRelation: "quiz_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "publican_messages_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      publican_profiles: {
        Row: {
          created_at: string
          email: string
          first_name: string | null
          id: string
          last_name: string | null
          venue_id: string
        }
        Insert: {
          created_at?: string
          email: string
          first_name?: string | null
          id: string
          last_name?: string | null
          venue_id: string
        }
        Update: {
          created_at?: string
          email?: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "publican_profiles_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      publican_venues: {
        Row: {
          created_at: string
          id: string
          user_id: string
          venue_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          user_id: string
          venue_id: string
        }
        Update: {
          created_at?: string
          id?: string
          user_id?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "publican_venues_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      push_tokens: {
        Row: {
          id: string
          platform: string | null
          token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          id?: string
          platform?: string | null
          token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          id?: string
          platform?: string | null
          token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      questions: {
        Row: {
          answer_text: string
          created_at: string
          host_notes: string | null
          id: string
          image_set_id: string | null
          mc_a: string | null
          mc_b: string | null
          mc_c: string | null
          mc_correct: string | null
          mc_d: string | null
          picture_image_url: string | null
          q_no: number
          question_text: string
          question_type: string
          round_no: number
          weekly_quiz_id: string
        }
        Insert: {
          answer_text: string
          created_at?: string
          host_notes?: string | null
          id?: string
          image_set_id?: string | null
          mc_a?: string | null
          mc_b?: string | null
          mc_c?: string | null
          mc_correct?: string | null
          mc_d?: string | null
          picture_image_url?: string | null
          q_no: number
          question_text: string
          question_type: string
          round_no: number
          weekly_quiz_id: string
        }
        Update: {
          answer_text?: string
          created_at?: string
          host_notes?: string | null
          id?: string
          image_set_id?: string | null
          mc_a?: string | null
          mc_b?: string | null
          mc_c?: string | null
          mc_correct?: string | null
          mc_d?: string | null
          picture_image_url?: string | null
          q_no?: number
          question_text?: string
          question_type?: string
          round_no?: number
          weekly_quiz_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "questions_image_set_id_fkey"
            columns: ["image_set_id"]
            isOneToOne: false
            referencedRelation: "image_sets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questions_weekly_quiz_id_fkey"
            columns: ["weekly_quiz_id"]
            isOneToOne: false
            referencedRelation: "weekly_quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_answers: {
        Row: {
          answer: string
          question_id: string
        }
        Insert: {
          answer: string
          question_id: string
        }
        Update: {
          answer?: string
          question_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: true
            referencedRelation: "quiz_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_assignments: {
        Row: {
          assigned_at: string
          id: string
          quiz_event_id: string
          weekly_quiz_id: string
        }
        Insert: {
          assigned_at?: string
          id?: string
          quiz_event_id: string
          weekly_quiz_id: string
        }
        Update: {
          assigned_at?: string
          id?: string
          quiz_event_id?: string
          weekly_quiz_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_assignments_quiz_event_id_fkey"
            columns: ["quiz_event_id"]
            isOneToOne: false
            referencedRelation: "quiz_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_assignments_weekly_quiz_id_fkey"
            columns: ["weekly_quiz_id"]
            isOneToOne: false
            referencedRelation: "weekly_quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_claims: {
        Row: {
          claimed_at: string
          host_email: string
          host_user_id: string
          id: string
          notes: string | null
          quiz_event_id: string
          reviewed_at: string | null
          status: string
        }
        Insert: {
          claimed_at?: string
          host_email: string
          host_user_id: string
          id?: string
          notes?: string | null
          quiz_event_id: string
          reviewed_at?: string | null
          status?: string
        }
        Update: {
          claimed_at?: string
          host_email?: string
          host_user_id?: string
          id?: string
          notes?: string | null
          quiz_event_id?: string
          reviewed_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_claims_quiz_event_id_fkey"
            columns: ["quiz_event_id"]
            isOneToOne: false
            referencedRelation: "quiz_events"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_event_interests: {
        Row: {
          created_at: string
          occurrence_date: string
          quiz_event_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          occurrence_date: string
          quiz_event_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          occurrence_date?: string
          quiz_event_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_event_interests_quiz_event_id_fkey"
            columns: ["quiz_event_id"]
            isOneToOne: false
            referencedRelation: "quiz_events"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_event_occurrences: {
        Row: {
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by:
            | Database["public"]["Enums"]["quiz_occurrence_cancelled_by"]
            | null
          created_at: string
          id: string
          occurrence_date: string
          penalty_applied: boolean
          quiz_event_id: string
          released_by_host_at: string | null
          substitute_host_user_id: string | null
        }
        Insert: {
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?:
            | Database["public"]["Enums"]["quiz_occurrence_cancelled_by"]
            | null
          created_at?: string
          id?: string
          occurrence_date: string
          penalty_applied?: boolean
          quiz_event_id: string
          released_by_host_at?: string | null
          substitute_host_user_id?: string | null
        }
        Update: {
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?:
            | Database["public"]["Enums"]["quiz_occurrence_cancelled_by"]
            | null
          created_at?: string
          id?: string
          occurrence_date?: string
          penalty_applied?: boolean
          quiz_event_id?: string
          released_by_host_at?: string | null
          substitute_host_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quiz_event_occurrences_quiz_event_id_fkey"
            columns: ["quiz_event_id"]
            isOneToOne: false
            referencedRelation: "quiz_events"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_events: {
        Row: {
          cadence_pill_label: string | null
          created_at: string
          day_of_week: number
          entry_fee_pence: number
          fee_basis: string
          frequency: Database["public"]["Enums"]["quiz_event_frequency"]
          host_capacity_note: string | null
          host_fee_pence: number | null
          host_id: string | null
          id: string
          is_active: boolean
          nth_week: number | null
          occurrences_planned: number
          prize: Database["public"]["Enums"]["prize_type"]
          prize_1st: string | null
          prize_2nd: string | null
          prize_3rd: string | null
          start_date: string | null
          start_time: string
          turn_up_guidance: string | null
          venue_id: string
        }
        Insert: {
          cadence_pill_label?: string | null
          created_at?: string
          day_of_week: number
          entry_fee_pence?: number
          fee_basis?: string
          frequency?: Database["public"]["Enums"]["quiz_event_frequency"]
          host_capacity_note?: string | null
          host_fee_pence?: number | null
          host_id?: string | null
          id?: string
          is_active?: boolean
          nth_week?: number | null
          occurrences_planned?: number
          prize?: Database["public"]["Enums"]["prize_type"]
          prize_1st?: string | null
          prize_2nd?: string | null
          prize_3rd?: string | null
          start_date?: string | null
          start_time: string
          turn_up_guidance?: string | null
          venue_id: string
        }
        Update: {
          cadence_pill_label?: string | null
          created_at?: string
          day_of_week?: number
          entry_fee_pence?: number
          fee_basis?: string
          frequency?: Database["public"]["Enums"]["quiz_event_frequency"]
          host_capacity_note?: string | null
          host_fee_pence?: number | null
          host_id?: string | null
          id?: string
          is_active?: boolean
          nth_week?: number | null
          occurrences_planned?: number
          prize?: Database["public"]["Enums"]["prize_type"]
          prize_1st?: string | null
          prize_2nd?: string | null
          prize_3rd?: string | null
          start_date?: string | null
          start_time?: string
          turn_up_guidance?: string | null
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_events_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_events_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_occurrence_claims: {
        Row: {
          claimed_at: string
          host_user_id: string
          id: string
          occurrence_date: string
          quiz_event_id: string
          release_reason: string | null
          released_at: string | null
        }
        Insert: {
          claimed_at?: string
          host_user_id: string
          id?: string
          occurrence_date: string
          quiz_event_id: string
          release_reason?: string | null
          released_at?: string | null
        }
        Update: {
          claimed_at?: string
          host_user_id?: string
          id?: string
          occurrence_date?: string
          quiz_event_id?: string
          release_reason?: string | null
          released_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quiz_occurrence_claims_quiz_event_id_fkey"
            columns: ["quiz_event_id"]
            isOneToOne: false
            referencedRelation: "quiz_events"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_packs: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      quiz_questions: {
        Row: {
          host_notes: string | null
          id: string
          question_number: number
          question_text: string
          quiz_round_id: string
        }
        Insert: {
          host_notes?: string | null
          id?: string
          question_number: number
          question_text: string
          quiz_round_id: string
        }
        Update: {
          host_notes?: string | null
          id?: string
          question_number?: number
          question_text?: string
          quiz_round_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_questions_quiz_round_id_fkey"
            columns: ["quiz_round_id"]
            isOneToOne: false
            referencedRelation: "quiz_rounds"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_rounds: {
        Row: {
          id: string
          quiz_pack_id: string
          round_number: number
          title: string
        }
        Insert: {
          id?: string
          quiz_pack_id: string
          round_number: number
          title: string
        }
        Update: {
          id?: string
          quiz_pack_id?: string
          round_number?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_rounds_quiz_pack_id_fkey"
            columns: ["quiz_pack_id"]
            isOneToOne: false
            referencedRelation: "quiz_packs"
            referencedColumns: ["id"]
          },
        ]
      }
      round_scores: {
        Row: {
          id: string
          points: number
          round_no: number
          team_id: string
        }
        Insert: {
          id?: string
          points?: number
          round_no: number
          team_id: string
        }
        Update: {
          id?: string
          points?: number
          round_no?: number
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "round_scores_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          created_at: string
          id: string
          is_locked: boolean
          quiz_event_id: string
          session_date: string
          weekly_quiz_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_locked?: boolean
          quiz_event_id: string
          session_date: string
          weekly_quiz_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_locked?: boolean
          quiz_event_id?: string
          session_date?: string
          weekly_quiz_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sessions_quiz_event_id_fkey"
            columns: ["quiz_event_id"]
            isOneToOne: false
            referencedRelation: "quiz_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_weekly_quiz_id_fkey"
            columns: ["weekly_quiz_id"]
            isOneToOne: false
            referencedRelation: "weekly_quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          bonus_round: number | null
          created_at: string
          id: string
          name: string
          session_id: string
          tie_break: number | null
        }
        Insert: {
          bonus_round?: number | null
          created_at?: string
          id?: string
          name: string
          session_id: string
          tie_break?: number | null
        }
        Update: {
          bonus_round?: number | null
          created_at?: string
          id?: string
          name?: string
          session_id?: string
          tie_break?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "teams_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          role: Database["public"]["Enums"]["user_role"]
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
          role?: Database["public"]["Enums"]["user_role"]
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
        }
        Relationships: []
      }
      venue_images: {
        Row: {
          alt_text: string | null
          id: string
          sort_order: number
          storage_path: string
          uploaded_at: string
          venue_id: string
        }
        Insert: {
          alt_text?: string | null
          id?: string
          sort_order?: number
          storage_path: string
          uploaded_at?: string
          venue_id: string
        }
        Update: {
          alt_text?: string | null
          id?: string
          sort_order?: number
          storage_path?: string
          uploaded_at?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "venue_images_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      venues: {
        Row: {
          address: string
          borough: string | null
          city: string | null
          created_at: string
          host_id: string | null
          id: string
          lat: number | null
          lng: number | null
          name: string
          postcode: string | null
          what_to_expect: string | null
        }
        Insert: {
          address: string
          borough?: string | null
          city?: string | null
          created_at?: string
          host_id?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          name: string
          postcode?: string | null
          what_to_expect?: string | null
        }
        Update: {
          address?: string
          borough?: string | null
          city?: string | null
          created_at?: string
          host_id?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          name?: string
          postcode?: string | null
          what_to_expect?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "venues_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      weekly_quizzes: {
        Row: {
          created_at: string
          id: string
          is_published: boolean
          title: string
          week_start_date: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_published?: boolean
          title: string
          week_start_date: string
        }
        Update: {
          created_at?: string
          id?: string
          is_published?: boolean
          title?: string
          week_start_date?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cancel_quiz_occurrence: {
        Args: {
          p_cancelled_by: Database["public"]["Enums"]["quiz_occurrence_cancelled_by"]
          p_occurrence_date: string
          p_quiz_event_id: string
          p_reason: string
        }
        Returns: boolean
      }
      generate_quiz_occurrence_dates: {
        Args: {
          p_count: number
          p_day_of_week: number
          p_frequency: Database["public"]["Enums"]["quiz_event_frequency"]
          p_nth_week: number
          p_start_date: string
        }
        Returns: string[]
      }
      get_next_quiz_occurrence: {
        Args: { p_quiz_event_id: string }
        Returns: {
          interest_count: number
          occurrence_date: string
        }[]
      }
      get_quiz_event_interest_count: {
        Args: { p_occurrence_date: string; p_quiz_event_id: string }
        Returns: number
      }
      get_upcoming_occurrences_feed: {
        Args: { p_from?: string; p_to?: string }
        Returns: {
          cadence_pill_label: string
          cancelled: boolean
          day_of_week: number
          entry_fee_pence: number
          has_host: boolean
          interest_count: number
          occurrence_date: string
          prize: string
          quiz_event_id: string
          start_time: string
          venue_address: string
          venue_city: string
          venue_id: string
          venue_lat: number
          venue_lng: number
          venue_name: string
          venue_postcode: string
        }[]
      }
      get_upcoming_occurrences_by_venue: {
        Args: { p_limit_per_event?: number; p_venue_id: string }
        Returns: {
          cancelled: boolean
          interest_count: number
          occurrence_date: string
          quiz_event_id: string
        }[]
      }
      get_upcoming_quiz_occurrences: {
        Args: { p_limit?: number; p_quiz_event_id: string }
        Returns: {
          cancelled: boolean
          interest_count: number
          occurrence_date: string
        }[]
      }
      host_claim_occurrence: {
        Args: { p_occurrence_date: string; p_quiz_event_id: string }
        Returns: Json
      }
      host_dashboard_summary: {
        Args: never
        Returns: {
          total_earnings_pence: number
          total_player_count: number
          total_sessions: number
        }[]
      }
      host_patch_quiz_event_host_fields: {
        Args: { p_capacity_note: string; p_quiz_event_id: string }
        Returns: boolean
      }
      host_quiz_dashboard_rows: {
        Args: never
        Returns: {
          day_of_week: number
          host_capacity_note: string
          next_occurrence_date: string
          next_occurrence_interest_count: number
          quiz_event_id: string
          start_time: string
          venue_id: string
          venue_name: string
        }[]
      }
      host_unclaim_occurrence: {
        Args: { p_occurrence_date: string; p_quiz_event_id: string }
        Returns: Json
      }
      is_allowlisted_host: { Args: never; Returns: boolean }
      is_allowlisted_operator: { Args: never; Returns: boolean }
      is_operator: { Args: never; Returns: boolean }
      is_publican: { Args: never; Returns: boolean }
      operator_approve_host_application: {
        Args: { p_application_id: string }
        Returns: undefined
      }
      operator_host_detail: { Args: { p_host_user_id: string }; Returns: Json }
      operator_host_roster: {
        Args: never
        Returns: {
          assigned_quiz_count: number
          email: string
          host_user_id: string
          last_session_date: string
          payout_this_month_pence: number
          sessions_all_time: number
          sessions_this_month: number
        }[]
      }
      operator_network_summary: {
        Args: never
        Returns: {
          active_quiz_count: number
          gross_last_7d_pence: number
          teams_last_7d: number
          total_interests: number
        }[]
      }
      operator_triage_unhosted_quizzes: {
        Args: never
        Returns: {
          day_of_week: number
          interest_count: number
          next_occurrence: string
          quiz_event_id: string
          start_time: string
          venue_id: string
          venue_name: string
        }[]
      }
      operator_venue_stats: {
        Args: never
        Returns: {
          active_quiz_count: number
          gross_last_7d_pence: number
          interest_count: number
          last_session_date: string
          postcode: string
          teams_last_7d: number
          venue_id: string
          venue_name: string
        }[]
      }
      publican_cancel_occurrence: {
        Args: {
          p_occurrence_date: string
          p_quiz_event_id: string
          p_reason: string
        }
        Returns: Json
      }
      publican_dashboard_event_interest: {
        Args: { p_venue_id: string }
        Returns: {
          next_occurrence_date: string | null
          next_occurrence_interest_count: number
          quiz_event_id: string
          upcoming_interest_count: number
        }[]
      }
      publican_venue_quiz_interest_counts: {
        Args: { p_venue_id: string }
        Returns: {
          interest_count: number
          quiz_event_id: string
        }[]
      }
      rebuild_quiz_event_occurrences: {
        Args: { p_quiz_event_id: string }
        Returns: undefined
      }
      record_host_quiz_session: {
        Args: {
          p_pack_id: string
          p_team_count: number
          p_total_player_count: number
          p_venue_id: string
        }
        Returns: string
      }
      release_quiz_occurrence: {
        Args: { p_occurrence_date: string; p_quiz_event_id: string }
        Returns: boolean
      }
    }
    Enums: {
      host_application_status: "pending" | "approved" | "rejected"
      prize_type: "cash" | "bar_tab" | "drinks" | "voucher" | "other"
      publican_message_status: "open" | "in_progress" | "resolved"
      publican_message_type:
        | "cancellation_request"
        | "special_request"
        | "complaint"
        | "host_request"
        | "general"
      quiz_event_frequency: "weekly" | "monthly" | "quarterly" | "one_off"
      quiz_occurrence_cancelled_by: "host" | "publican" | "operator"
      user_role: "admin" | "host"
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
      host_application_status: ["pending", "approved", "rejected"],
      prize_type: ["cash", "bar_tab", "drinks", "voucher", "other"],
      publican_message_status: ["open", "in_progress", "resolved"],
      publican_message_type: [
        "cancellation_request",
        "special_request",
        "complaint",
        "host_request",
        "general",
      ],
      quiz_event_frequency: ["weekly", "monthly", "quarterly", "one_off"],
      quiz_occurrence_cancelled_by: ["host", "publican", "operator"],
      user_role: ["admin", "host"],
    },
  },
} as const

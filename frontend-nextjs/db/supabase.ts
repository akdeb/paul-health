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
      actions: {
        Row: {
          action_id: string
          created_at: string
          job_id: string | null
          metadata: Json
          session_time: number
          type: string
          user_id: string
        }
        Insert: {
          action_id?: string
          created_at?: string
          job_id?: string | null
          metadata: Json
          session_time?: number
          type: string
          user_id?: string
        }
        Update: {
          action_id?: string
          created_at?: string
          job_id?: string | null
          metadata?: Json
          session_time?: number
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sessions_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      api_keys: {
        Row: {
          api_key_id: string
          created_at: string
          encrypted_key: string
          iv: string
          user_id: string
        }
        Insert: {
          api_key_id?: string
          created_at?: string
          encrypted_key: string
          iv: string
          user_id?: string
        }
        Update: {
          api_key_id?: string
          created_at?: string
          encrypted_key?: string
          iv?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_keys_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      conversations: {
        Row: {
          action_id: string
          content: string
          conversation_id: string
          created_at: string
          is_sensitive: boolean | null
          metadata: Json | null
          role: string
        }
        Insert: {
          action_id: string
          content: string
          conversation_id?: string
          created_at?: string
          is_sensitive?: boolean | null
          metadata?: Json | null
          role: string
        }
        Update: {
          action_id?: string
          content?: string
          conversation_id?: string
          created_at?: string
          is_sensitive?: boolean | null
          metadata?: Json | null
          role?: string
        }
        Relationships: []
      }
      devices: {
        Row: {
          created_at: string
          device_id: string
          is_ota: boolean
          is_reset: boolean
          mac_address: string | null
          user_code: string
          user_id: string | null
          volume: number
        }
        Insert: {
          created_at?: string
          device_id?: string
          is_ota?: boolean
          is_reset?: boolean
          mac_address?: string | null
          user_code: string
          user_id?: string | null
          volume?: number
        }
        Update: {
          created_at?: string
          device_id?: string
          is_ota?: boolean
          is_reset?: boolean
          mac_address?: string | null
          user_code?: string
          user_id?: string | null
          volume?: number
        }
        Relationships: [
          {
            foreignKeyName: "devices_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      jobs: {
        Row: {
          created_at: string
          cron: string
          enabled: boolean
          instructions: string
          job_id: string
          name: string
          patient_id: string
          type: string
        }
        Insert: {
          created_at?: string
          cron: string
          enabled: boolean
          instructions?: string
          job_id?: string
          name: string
          patient_id: string
          type: string
        }
        Update: {
          created_at?: string
          cron?: string
          enabled?: boolean
          instructions?: string
          job_id?: string
          name?: string
          patient_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "jobs_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["patient_id"]
          },
        ]
      }
      languages: {
        Row: {
          code: string
          created_at: string
          flag: string
          language_id: string
          name: string
        }
        Insert: {
          code: string
          created_at?: string
          flag: string
          language_id?: string
          name: string
        }
        Update: {
          code?: string
          created_at?: string
          flag?: string
          language_id?: string
          name?: string
        }
        Relationships: []
      }
      patients: {
        Row: {
          about: string
          address: string
          age: number
          avoid: string[]
          caregiver_id: string
          created_at: string
          gender: string
          jobs: string[]
          name: string
          patient_id: string
          relations: string[]
          stories: string[]
          timezone: string
        }
        Insert: {
          about?: string
          address: string
          age?: number
          avoid: string[]
          caregiver_id: string
          created_at?: string
          gender?: string
          jobs: string[]
          name: string
          patient_id?: string
          relations: string[]
          stories: string[]
          timezone?: string
        }
        Update: {
          about?: string
          address?: string
          age?: number
          avoid?: string[]
          caregiver_id?: string
          created_at?: string
          gender?: string
          jobs?: string[]
          name?: string
          patient_id?: string
          relations?: string[]
          stories?: string[]
          timezone?: string
        }
        Relationships: [
          {
            foreignKeyName: "patients_caregiver_id_fkey"
            columns: ["caregiver_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      personalities: {
        Row: {
          character_prompt: string
          created_at: string
          creator_id: string | null
          first_message_prompt: string
          key: string
          oai_voice: string
          personality_id: string
          pitch_factor: number
          provider: string
          short_description: string
          subtitle: string
          title: string
          voice_prompt: string
        }
        Insert: {
          character_prompt?: string
          created_at?: string
          creator_id?: string | null
          first_message_prompt?: string
          key?: string
          oai_voice?: string
          personality_id?: string
          pitch_factor?: number
          provider?: string
          short_description?: string
          subtitle?: string
          title?: string
          voice_prompt?: string
        }
        Update: {
          character_prompt?: string
          created_at?: string
          creator_id?: string | null
          first_message_prompt?: string
          key?: string
          oai_voice?: string
          personality_id?: string
          pitch_factor?: number
          provider?: string
          short_description?: string
          subtitle?: string
          title?: string
          voice_prompt?: string
        }
        Relationships: [
          {
            foreignKeyName: "personalities_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      photos: {
        Row: {
          caption: string
          created_at: string
          patient_id: string
          photo_id: string
          type: string
          url: string
        }
        Insert: {
          caption: string
          created_at?: string
          patient_id?: string
          photo_id?: string
          type: string
          url: string
        }
        Update: {
          caption?: string
          created_at?: string
          patient_id?: string
          photo_id?: string
          type?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "photos_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["patient_id"]
          },
        ]
      }
      users: {
        Row: {
          avatar_url: string
          created_at: string
          device_id: string | null
          email: string
          is_premium: boolean
          language_code: string
          name: string
          patient_id: string
          personality_id: string
          user_id: string
          user_info: Json
        }
        Insert: {
          avatar_url?: string
          created_at?: string
          device_id?: string | null
          email?: string
          is_premium?: boolean
          language_code?: string
          name: string
          patient_id: string
          personality_id?: string
          user_id?: string
          user_info?: Json
        }
        Update: {
          avatar_url?: string
          created_at?: string
          device_id?: string | null
          email?: string
          is_premium?: boolean
          language_code?: string
          name?: string
          patient_id?: string
          personality_id?: string
          user_id?: string
          user_info?: Json
        }
        Relationships: [
          {
            foreignKeyName: "users_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: true
            referencedRelation: "devices"
            referencedColumns: ["device_id"]
          },
          {
            foreignKeyName: "users_language_code_fkey"
            columns: ["language_code"]
            isOneToOne: false
            referencedRelation: "languages"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "users_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: true
            referencedRelation: "patients"
            referencedColumns: ["patient_id"]
          },
          {
            foreignKeyName: "users_personality_id_fkey"
            columns: ["personality_id"]
            isOneToOne: false
            referencedRelation: "personalities"
            referencedColumns: ["personality_id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      match_documents: {
        Args: { filter?: Json; match_count?: number; query_embedding: string }
        Returns: {
          content: string
          embedding: string
          id: string
          metadata: Json
          similarity: number
        }[]
      }
    }
    Enums: {
      tts_model_enum: "FISH" | "AZURE"
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
      tts_model_enum: ["FISH", "AZURE"],
    },
  },
} as const

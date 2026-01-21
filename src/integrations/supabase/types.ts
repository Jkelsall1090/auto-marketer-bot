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
      actions_taken: {
        Row: {
          action_type: string
          campaign_id: string
          click_count: number | null
          content: string | null
          created_at: string | null
          engagement_count: number | null
          executed_at: string | null
          id: string
          platform: string
          relevance_score: number | null
          status: Database["public"]["Enums"]["action_status"] | null
          url: string | null
        }
        Insert: {
          action_type: string
          campaign_id: string
          click_count?: number | null
          content?: string | null
          created_at?: string | null
          engagement_count?: number | null
          executed_at?: string | null
          id?: string
          platform: string
          relevance_score?: number | null
          status?: Database["public"]["Enums"]["action_status"] | null
          url?: string | null
        }
        Update: {
          action_type?: string
          campaign_id?: string
          click_count?: number | null
          content?: string | null
          created_at?: string | null
          engagement_count?: number | null
          executed_at?: string | null
          id?: string
          platform?: string
          relevance_score?: number | null
          status?: Database["public"]["Enums"]["action_status"] | null
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "actions_taken_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_run_logs: {
        Row: {
          actions_count: number | null
          campaign_id: string
          created_at: string | null
          errors_count: number | null
          id: string
          phase_completed: Database["public"]["Enums"]["agent_phase"] | null
          run_completed_at: string | null
          run_started_at: string | null
          summary: string | null
        }
        Insert: {
          actions_count?: number | null
          campaign_id: string
          created_at?: string | null
          errors_count?: number | null
          id?: string
          phase_completed?: Database["public"]["Enums"]["agent_phase"] | null
          run_completed_at?: string | null
          run_started_at?: string | null
          summary?: string | null
        }
        Update: {
          actions_count?: number | null
          campaign_id?: string
          created_at?: string | null
          errors_count?: number | null
          id?: string
          phase_completed?: Database["public"]["Enums"]["agent_phase"] | null
          run_completed_at?: string | null
          run_started_at?: string | null
          summary?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_run_logs_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_state: {
        Row: {
          campaign_id: string
          created_at: string | null
          error_count: number | null
          id: string
          last_error: string | null
          last_run_at: string | null
          metrics: Json | null
          next_run_at: string | null
          opportunities_queued: number | null
          phase: Database["public"]["Enums"]["agent_phase"] | null
          updated_at: string | null
        }
        Insert: {
          campaign_id: string
          created_at?: string | null
          error_count?: number | null
          id?: string
          last_error?: string | null
          last_run_at?: string | null
          metrics?: Json | null
          next_run_at?: string | null
          opportunities_queued?: number | null
          phase?: Database["public"]["Enums"]["agent_phase"] | null
          updated_at?: string | null
        }
        Update: {
          campaign_id?: string
          created_at?: string | null
          error_count?: number | null
          id?: string
          last_error?: string | null
          last_run_at?: string | null
          metrics?: Json | null
          next_run_at?: string | null
          opportunities_queued?: number | null
          phase?: Database["public"]["Enums"]["agent_phase"] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_state_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: true
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          budget: number | null
          channels: Json
          created_at: string | null
          goals: Json
          id: string
          name: string
          product: string
          schedule_interval: string | null
          status: Database["public"]["Enums"]["campaign_status"] | null
          updated_at: string | null
        }
        Insert: {
          budget?: number | null
          channels?: Json
          created_at?: string | null
          goals?: Json
          id?: string
          name: string
          product: string
          schedule_interval?: string | null
          status?: Database["public"]["Enums"]["campaign_status"] | null
          updated_at?: string | null
        }
        Update: {
          budget?: number | null
          channels?: Json
          created_at?: string | null
          goals?: Json
          id?: string
          name?: string
          product?: string
          schedule_interval?: string | null
          status?: Database["public"]["Enums"]["campaign_status"] | null
          updated_at?: string | null
        }
        Relationships: []
      }
      marketing_tactics: {
        Row: {
          campaign_id: string
          content: string
          created_at: string | null
          estimated_impact: string | null
          executed: boolean | null
          id: string
          platform: string
          priority: number | null
          source_context: string | null
          source_finding_id: string | null
          source_url: string | null
          tactic_type: string
          target_audience: string | null
        }
        Insert: {
          campaign_id: string
          content: string
          created_at?: string | null
          estimated_impact?: string | null
          executed?: boolean | null
          id?: string
          platform: string
          priority?: number | null
          source_context?: string | null
          source_finding_id?: string | null
          source_url?: string | null
          tactic_type: string
          target_audience?: string | null
        }
        Update: {
          campaign_id?: string
          content?: string
          created_at?: string | null
          estimated_impact?: string | null
          executed?: boolean | null
          id?: string
          platform?: string
          priority?: number | null
          source_context?: string | null
          source_finding_id?: string | null
          source_url?: string | null
          tactic_type?: string
          target_audience?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketing_tactics_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_tactics_source_finding_id_fkey"
            columns: ["source_finding_id"]
            isOneToOne: false
            referencedRelation: "research_findings"
            referencedColumns: ["id"]
          },
        ]
      }
      research_findings: {
        Row: {
          campaign_id: string
          confidence_reasoning: string | null
          constraints: Json | null
          content: string | null
          core_problem: string | null
          created_at: string | null
          emotional_signals: Json | null
          finding_type: string
          id: string
          intent_category: string | null
          intent_score: number | null
          processed: boolean | null
          recommended_next_step: string | null
          relevance_score: number | null
          source_url: string | null
          title: string
          underlying_motivation: string | null
        }
        Insert: {
          campaign_id: string
          confidence_reasoning?: string | null
          constraints?: Json | null
          content?: string | null
          core_problem?: string | null
          created_at?: string | null
          emotional_signals?: Json | null
          finding_type: string
          id?: string
          intent_category?: string | null
          intent_score?: number | null
          processed?: boolean | null
          recommended_next_step?: string | null
          relevance_score?: number | null
          source_url?: string | null
          title: string
          underlying_motivation?: string | null
        }
        Update: {
          campaign_id?: string
          confidence_reasoning?: string | null
          constraints?: Json | null
          content?: string | null
          core_problem?: string | null
          created_at?: string | null
          emotional_signals?: Json | null
          finding_type?: string
          id?: string
          intent_category?: string | null
          intent_score?: number | null
          processed?: boolean | null
          recommended_next_step?: string | null
          relevance_score?: number | null
          source_url?: string | null
          title?: string
          underlying_motivation?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "research_findings_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      action_status: "pending" | "completed" | "failed" | "queued"
      agent_phase:
        | "idle"
        | "research"
        | "planning"
        | "execution"
        | "evaluation"
        | "error"
      campaign_status: "active" | "paused" | "completed"
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
      action_status: ["pending", "completed", "failed", "queued"],
      agent_phase: [
        "idle",
        "research",
        "planning",
        "execution",
        "evaluation",
        "error",
      ],
      campaign_status: ["active", "paused", "completed"],
    },
  },
} as const

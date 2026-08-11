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
    PostgrestVersion: "14.15"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      canon_facts: {
        Row: {
          character_id: string | null
          created_at: string
          fact_key: string
          fact_text: string
          id: string
          memory_type: string | null
          origin: string
          player_run_id: string
          run_branch_id: string | null
          salience: number | null
          scope: string
          source_scene_id: string | null
          source_turn_id: string | null
          supersedes_fact_id: string | null
        }
        Insert: {
          character_id?: string | null
          created_at?: string
          fact_key: string
          fact_text: string
          id?: string
          memory_type?: string | null
          origin?: string
          player_run_id: string
          run_branch_id?: string | null
          salience?: number | null
          scope: string
          source_scene_id?: string | null
          source_turn_id?: string | null
          supersedes_fact_id?: string | null
        }
        Update: {
          character_id?: string | null
          created_at?: string
          fact_key?: string
          fact_text?: string
          id?: string
          memory_type?: string | null
          origin?: string
          player_run_id?: string
          run_branch_id?: string | null
          salience?: number | null
          scope?: string
          source_scene_id?: string | null
          source_turn_id?: string | null
          supersedes_fact_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "canon_facts_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "canon_facts_player_run_id_fkey"
            columns: ["player_run_id"]
            isOneToOne: false
            referencedRelation: "player_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "canon_facts_run_branch_id_fkey"
            columns: ["run_branch_id"]
            isOneToOne: false
            referencedRelation: "run_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "canon_facts_source_scene_id_fkey"
            columns: ["source_scene_id"]
            isOneToOne: false
            referencedRelation: "scenes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "canon_facts_source_turn_id_fkey"
            columns: ["source_turn_id"]
            isOneToOne: false
            referencedRelation: "turns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "canon_facts_supersedes_fact_id_fkey"
            columns: ["supersedes_fact_id"]
            isOneToOne: false
            referencedRelation: "canon_facts"
            referencedColumns: ["id"]
          },
        ]
      }
      player_runs: {
        Row: {
          active_branch_id: string | null
          created_at: string
          id: string
          owner_user_id: string
          status: string
          story_id: string
          updated_at: string
        }
        Insert: {
          active_branch_id?: string | null
          created_at?: string
          id?: string
          owner_user_id: string
          status?: string
          story_id: string
          updated_at?: string
        }
        Update: {
          active_branch_id?: string | null
          created_at?: string
          id?: string
          owner_user_id?: string
          status?: string
          story_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_runs_active_branch_id_fkey"
            columns: ["active_branch_id"]
            isOneToOne: false
            referencedRelation: "run_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_runs_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "stories"
            referencedColumns: ["id"]
          },
        ]
      }
      run_branches: {
        Row: {
          branch_seq: number
          created_at: string
          fork_scene_id: string | null
          id: string
          parent_branch_id: string | null
          player_run_id: string
        }
        Insert: {
          branch_seq: number
          created_at?: string
          fork_scene_id?: string | null
          id?: string
          parent_branch_id?: string | null
          player_run_id: string
        }
        Update: {
          branch_seq?: number
          created_at?: string
          fork_scene_id?: string | null
          id?: string
          parent_branch_id?: string | null
          player_run_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "run_branches_parent_branch_id_fkey"
            columns: ["parent_branch_id"]
            isOneToOne: false
            referencedRelation: "run_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "run_branches_player_run_id_fkey"
            columns: ["player_run_id"]
            isOneToOne: false
            referencedRelation: "player_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      scenes: {
        Row: {
          boundary_kind: string
          created_at: string
          dialogue: Json
          generation_turn_id: string | null
          id: string
          narrative: string
          next_choices: Json
          parent_scene_id: string | null
          run_branch_id: string
          seq_in_branch: number
          state_change_summary: Json
          structured_outcome: Json
        }
        Insert: {
          boundary_kind?: string
          created_at?: string
          dialogue?: Json
          generation_turn_id?: string | null
          id?: string
          narrative: string
          next_choices?: Json
          parent_scene_id?: string | null
          run_branch_id: string
          seq_in_branch: number
          state_change_summary?: Json
          structured_outcome?: Json
        }
        Update: {
          boundary_kind?: string
          created_at?: string
          dialogue?: Json
          generation_turn_id?: string | null
          id?: string
          narrative?: string
          next_choices?: Json
          parent_scene_id?: string | null
          run_branch_id?: string
          seq_in_branch?: number
          state_change_summary?: Json
          structured_outcome?: Json
        }
        Relationships: [
          {
            foreignKeyName: "scenes_generation_turn_id_fkey"
            columns: ["generation_turn_id"]
            isOneToOne: false
            referencedRelation: "turns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scenes_parent_scene_id_fkey"
            columns: ["parent_scene_id"]
            isOneToOne: false
            referencedRelation: "scenes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scenes_run_branch_id_fkey"
            columns: ["run_branch_id"]
            isOneToOne: false
            referencedRelation: "run_branches"
            referencedColumns: ["id"]
          },
        ]
      }
      turns: {
        Row: {
          action_type: string
          created_at: string
          error_class: string | null
          generation_attempt_count: number
          id: string
          input_tokens: number | null
          latency_ms: number | null
          model: string | null
          output_tokens: number | null
          player_run_id: string
          provider: string | null
          provider_cost_micros: number | null
          raw_player_action: string | null
          result_scene_id: string | null
          run_branch_id: string
          selected_choice_id: string | null
          source_scene_id: string | null
          status: string
          updated_at: string
          user_allowance_debited: boolean
        }
        Insert: {
          action_type: string
          created_at?: string
          error_class?: string | null
          generation_attempt_count?: number
          id: string
          input_tokens?: number | null
          latency_ms?: number | null
          model?: string | null
          output_tokens?: number | null
          player_run_id: string
          provider?: string | null
          provider_cost_micros?: number | null
          raw_player_action?: string | null
          result_scene_id?: string | null
          run_branch_id: string
          selected_choice_id?: string | null
          source_scene_id?: string | null
          status?: string
          updated_at?: string
          user_allowance_debited?: boolean
        }
        Update: {
          action_type?: string
          created_at?: string
          error_class?: string | null
          generation_attempt_count?: number
          id?: string
          input_tokens?: number | null
          latency_ms?: number | null
          model?: string | null
          output_tokens?: number | null
          player_run_id?: string
          provider?: string | null
          provider_cost_micros?: number | null
          raw_player_action?: string | null
          result_scene_id?: string | null
          run_branch_id?: string
          selected_choice_id?: string | null
          source_scene_id?: string | null
          status?: string
          updated_at?: string
          user_allowance_debited?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "turns_player_run_id_fkey"
            columns: ["player_run_id"]
            isOneToOne: false
            referencedRelation: "player_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "turns_result_scene_id_fkey"
            columns: ["result_scene_id"]
            isOneToOne: false
            referencedRelation: "scenes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "turns_run_branch_id_fkey"
            columns: ["run_branch_id"]
            isOneToOne: false
            referencedRelation: "run_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "turns_source_scene_id_fkey"
            columns: ["source_scene_id"]
            isOneToOne: false
            referencedRelation: "scenes"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_counters: {
        Row: {
          generation_count: number
          updated_at: string
          usage_date: string
          user_id: string
        }
        Insert: {
          generation_count?: number
          updated_at?: string
          usage_date?: string
          user_id: string
        }
        Update: {
          generation_count?: number
          updated_at?: string
          usage_date?: string
          user_id?: string
        }
        Relationships: []
      }
      characters: {
        Row: {
          address_terms: Json | null
          aliases: string[]
          created_at: string
          description: string | null
          id: string
          name: string
          role: string | null
          story_id: string
          story_relationship: string | null
          updated_at: string
        }
        Insert: {
          address_terms?: Json | null
          aliases?: string[]
          created_at?: string
          description?: string | null
          id?: string
          name: string
          role?: string | null
          story_id: string
          story_relationship?: string | null
          updated_at?: string
        }
        Update: {
          address_terms?: Json | null
          aliases?: string[]
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          role?: string | null
          story_id?: string
          story_relationship?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "characters_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "stories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          preferred_ui_locale: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
          preferred_ui_locale?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          preferred_ui_locale?: string
          updated_at?: string
        }
        Relationships: []
      }
      stories: {
        Row: {
          content_language: string
          created_at: string
          genre: string
          id: string
          owner_user_id: string
          premise: string | null
          status: string
          story_mode: string
          title: string
          updated_at: string
          visibility: string
        }
        Insert: {
          content_language: string
          created_at?: string
          genre: string
          id?: string
          owner_user_id: string
          premise?: string | null
          status?: string
          story_mode?: string
          title: string
          updated_at?: string
          visibility?: string
        }
        Update: {
          content_language?: string
          created_at?: string
          genre?: string
          id?: string
          owner_user_id?: string
          premise?: string | null
          status?: string
          story_mode?: string
          title?: string
          updated_at?: string
          visibility?: string
        }
        Relationships: []
      }
      story_configurations: {
        Row: {
          created_at: string
          id: string
          narrative_pov: string | null
          player_description: string | null
          player_name: string | null
          player_role: string | null
          randomness_mode: string
          starting_situation: string | null
          story_id: string
          tone: string | null
          updated_at: string
          world_setting: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          narrative_pov?: string | null
          player_description?: string | null
          player_name?: string | null
          player_role?: string | null
          randomness_mode?: string
          starting_situation?: string | null
          story_id: string
          tone?: string | null
          updated_at?: string
          world_setting?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          narrative_pov?: string | null
          player_description?: string | null
          player_name?: string | null
          player_role?: string | null
          randomness_mode?: string
          starting_situation?: string | null
          story_id?: string
          tone?: string | null
          updated_at?: string
          world_setting?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "story_configurations_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: true
            referencedRelation: "stories"
            referencedColumns: ["id"]
          },
        ]
      }
      worlds: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          story_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          story_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          story_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "worlds_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "stories"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      lw_precheck_and_start_turn: {
        Args: {
          p_action_type: string
          p_player_run_id: string | null
          p_raw_action?: string | null
          p_selected_choice_id?: string | null
          p_story_setup?: Json | null
          p_turn_id: string
        }
        Returns: Json
      }
      lw_commit_turn: {
        Args: {
          p_boundary_kind: string
          p_canon_candidates: Json
          p_character_memory_candidates: Json
          p_dialogue: Json
          p_generation_attempt_count: number
          p_input_tokens: number
          p_latency_ms: number
          p_model: string
          p_narrative: string
          p_next_choices: Json
          p_output_tokens: number
          p_provider: string
          p_provider_cost_micros: number
          p_state_change_summary: Json
          p_structured_outcome: Json
          p_turn_id: string
        }
        Returns: Json
      }
      lw_fail_turn: {
        Args: {
          p_error_class: string
          p_generation_attempt_count: number
          p_provider_cost_micros?: number | null
          p_turn_id: string
        }
        Returns: Json
      }
      lw_replay_from_scene: {
        Args: {
          p_player_run_id: string
          p_source_scene_id: string
        }
        Returns: Json
      }
      lw_get_run_state: {
        Args: {
          p_player_run_id: string
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

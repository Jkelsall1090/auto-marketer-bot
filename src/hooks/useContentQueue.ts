import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { toast } from "sonner";

// Extend the base type with the new columns we added
export type MarketingTactic = Tables<"marketing_tactics"> & {
  source_finding_id?: string | null;
  source_url?: string | null;
  source_context?: string | null;
};
export type ResearchFinding = Tables<"research_findings">;
export type AgentState = Tables<"agent_state">;

export function useMarketingTactics(campaignId?: string) {
  return useQuery({
    queryKey: ["tactics", campaignId],
    queryFn: async () => {
      let query = supabase
        .from("marketing_tactics")
        .select("*")
        .order("priority", { ascending: false })
        .order("created_at", { ascending: false });

      if (campaignId) {
        query = query.eq("campaign_id", campaignId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as MarketingTactic[];
    },
  });
}

export function useResearchFindings(campaignId?: string) {
  return useQuery({
    queryKey: ["findings", campaignId],
    queryFn: async () => {
      let query = supabase
        .from("research_findings")
        .select("*")
        .order("relevance_score", { ascending: false })
        .order("created_at", { ascending: false });

      if (campaignId) {
        query = query.eq("campaign_id", campaignId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as ResearchFinding[];
    },
  });
}

export function useAgentState(campaignId: string | null) {
  return useQuery({
    queryKey: ["agent-state", campaignId],
    queryFn: async () => {
      if (!campaignId) return null;
      const { data, error } = await supabase
        .from("agent_state")
        .select("*")
        .eq("campaign_id", campaignId)
        .single();

      if (error && error.code !== "PGRST116") throw error;
      return data as AgentState | null;
    },
    enabled: !!campaignId,
  });
}

export function useMarkTacticExecuted() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ tacticId, executed }: { tacticId: string; executed: boolean }) => {
      const { error } = await supabase
        .from("marketing_tactics")
        .update({ executed })
        .eq("id", tacticId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tactics"] });
      toast.success("Content marked as posted!");
    },
    onError: (error) => {
      toast.error("Failed to update: " + error.message);
    },
  });
}

export function useDeleteTactic() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (tacticId: string) => {
      // Since we can't delete, mark as executed (skip)
      const { error } = await supabase
        .from("marketing_tactics")
        .update({ executed: true })
        .eq("id", tacticId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tactics"] });
      toast.success("Content skipped");
    },
    onError: (error) => {
      toast.error("Failed to skip: " + error.message);
    },
  });
}

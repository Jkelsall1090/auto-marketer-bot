import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  ShoppingBag, 
  ExternalLink, 
  Star, 
  TrendingUp, 
  RefreshCw, 
  Loader2,
  Package,
  DollarSign,
  BarChart3
} from "lucide-react";
import { useCampaigns } from "@/hooks/useCampaigns";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface AmazonFinding {
  id: string;
  title: string;
  source_url: string;
  content: string;
  relevance_score: number;
  created_at: string;
  campaign_id: string;
}

export function ProductResearchPanel() {
  const { data: campaigns } = useCampaigns();
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>("");
  const queryClient = useQueryClient();

  // Fetch Amazon product findings
  const { data: amazonFindings, isLoading: findingsLoading } = useQuery({
    queryKey: ['amazon-findings', selectedCampaignId],
    queryFn: async () => {
      if (!selectedCampaignId) return [];
      
      const { data, error } = await supabase
        .from('research_findings')
        .select('*')
        .eq('campaign_id', selectedCampaignId)
        .eq('finding_type', 'amazon_product')
        .order('relevance_score', { ascending: false });
      
      if (error) throw error;
      return data as AmazonFinding[];
    },
    enabled: !!selectedCampaignId,
  });

  // Run research mutation
  const runResearch = useMutation({
    mutationFn: async () => {
      if (!selectedCampaignId) throw new Error('No campaign selected');
      
      const { data, error } = await supabase.functions.invoke('agent-research', {
        body: { campaign_id: selectedCampaignId },
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Research complete! Found ${data.findings_count} new items.`);
      queryClient.invalidateQueries({ queryKey: ['amazon-findings', selectedCampaignId] });
    },
    onError: (error) => {
      toast.error(`Research failed: ${error.message}`);
    },
  });

  // Extract price from content if available
  const extractPrice = (content: string): string | null => {
    const priceMatch = content.match(/\$[\d,]+\.?\d*/);
    return priceMatch ? priceMatch[0] : null;
  };

  // Extract rating from content if available
  const extractRating = (content: string): string | null => {
    const ratingMatch = content.match(/(\d\.?\d?)\s*stars?/i);
    return ratingMatch ? ratingMatch[1] : null;
  };

  // Extract review count from content if available
  const extractReviews = (content: string): string | null => {
    const reviewMatch = content.match(/([\d,]+)\+?\s*reviews?/i);
    return reviewMatch ? reviewMatch[1] : null;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Product Research</h2>
          <p className="text-muted-foreground">
            Discover bestsellers and competitor products on Amazon
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={selectedCampaignId} onValueChange={setSelectedCampaignId}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Select campaign" />
            </SelectTrigger>
            <SelectContent>
              {campaigns?.map((campaign) => (
                <SelectItem key={campaign.id} value={campaign.id}>
                  {campaign.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            onClick={() => runResearch.mutate()}
            disabled={!selectedCampaignId || runResearch.isPending}
          >
            {runResearch.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Research Products
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      {selectedCampaignId && amazonFindings && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-gradient-card border-border">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 rounded-lg bg-primary/10">
                <Package className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Products Found</p>
                <p className="text-2xl font-bold text-foreground">{amazonFindings.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-card border-border">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 rounded-lg bg-warning/10">
                <Star className="h-6 w-6 text-warning" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Avg. Relevance</p>
                <p className="text-2xl font-bold text-foreground">
                  {amazonFindings.length > 0
                    ? (amazonFindings.reduce((acc, f) => acc + f.relevance_score, 0) / amazonFindings.length).toFixed(1)
                    : '0'}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-card border-border">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 rounded-lg bg-success/10">
                <TrendingUp className="h-6 w-6 text-success" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Competitors Tracked</p>
                <p className="text-2xl font-bold text-foreground">{amazonFindings.length}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Content */}
      {!selectedCampaignId ? (
        <Card className="bg-gradient-card border-border">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <ShoppingBag className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">
              Select a Campaign
            </h3>
            <p className="text-muted-foreground max-w-md">
              Choose a campaign to view Amazon product research. The agent will search for 
              bestsellers and competitors related to your product.
            </p>
          </CardContent>
        </Card>
      ) : findingsLoading ? (
        <Card className="bg-gradient-card border-border">
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      ) : amazonFindings && amazonFindings.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {amazonFindings.map((finding) => {
            const price = extractPrice(finding.content);
            const rating = extractRating(finding.content);
            const reviews = extractReviews(finding.content);
            
            return (
              <Card key={finding.id} className="bg-gradient-card border-border hover:border-primary/50 transition-colors">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-sm font-medium text-foreground line-clamp-2">
                      {finding.title.replace('Amazon: ', '')}
                    </CardTitle>
                    <Badge 
                      variant="secondary" 
                      className="shrink-0 bg-warning/10 text-warning border-warning/20"
                    >
                      Score: {finding.relevance_score}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground line-clamp-3">
                    {finding.content}
                  </p>
                  
                  {/* Product Insights */}
                  <div className="flex flex-wrap gap-2">
                    {price && (
                      <Badge variant="outline" className="bg-success/5 text-success border-success/20">
                        <DollarSign className="h-3 w-3 mr-1" />
                        {price}
                      </Badge>
                    )}
                    {rating && (
                      <Badge variant="outline" className="bg-warning/5 text-warning border-warning/20">
                        <Star className="h-3 w-3 mr-1" />
                        {rating} stars
                      </Badge>
                    )}
                    {reviews && (
                      <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20">
                        <BarChart3 className="h-3 w-3 mr-1" />
                        {reviews} reviews
                      </Badge>
                    )}
                  </div>
                  
                  {/* Actions */}
                  <div className="pt-2 border-t border-border">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full text-primary hover:text-primary hover:bg-primary/10"
                      onClick={() => window.open(finding.source_url, '_blank')}
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      View on Amazon
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="bg-gradient-card border-border">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <ShoppingBag className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">
              No Products Found Yet
            </h3>
            <p className="text-muted-foreground max-w-md mb-4">
              Click "Research Products" to discover bestsellers and competitors on Amazon 
              related to your campaign.
            </p>
            <Button
              onClick={() => runResearch.mutate()}
              disabled={runResearch.isPending}
            >
              {runResearch.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Start Research
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
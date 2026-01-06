-- Add source finding reference to marketing_tactics
ALTER TABLE public.marketing_tactics 
ADD COLUMN source_finding_id uuid REFERENCES public.research_findings(id);

-- Add source_url column to marketing_tactics for quick access
ALTER TABLE public.marketing_tactics 
ADD COLUMN source_url text;

-- Add source_context column to store the original question/context
ALTER TABLE public.marketing_tactics 
ADD COLUMN source_context text;
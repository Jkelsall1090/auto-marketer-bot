-- Add intent analysis columns to research_findings
ALTER TABLE public.research_findings
ADD COLUMN IF NOT EXISTS intent_category TEXT,
ADD COLUMN IF NOT EXISTS intent_score DECIMAL(3,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS core_problem TEXT,
ADD COLUMN IF NOT EXISTS underlying_motivation TEXT,
ADD COLUMN IF NOT EXISTS constraints JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS emotional_signals JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS confidence_reasoning TEXT,
ADD COLUMN IF NOT EXISTS recommended_next_step TEXT DEFAULT 'ignore';

-- Add index for filtering by intent score
CREATE INDEX IF NOT EXISTS idx_research_findings_intent_score ON public.research_findings(intent_score DESC);

-- Add index for recommended_next_step
CREATE INDEX IF NOT EXISTS idx_research_findings_next_step ON public.research_findings(recommended_next_step);
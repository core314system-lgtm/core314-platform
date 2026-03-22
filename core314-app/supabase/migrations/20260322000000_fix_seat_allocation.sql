-- ============================================================================
-- FIX SEAT ALLOCATION: Align DB trigger with billing protocol
-- ============================================================================
-- Previous values: intelligence=1, command_center=5
-- Correct values per billing protocol: intelligence=5, command_center=25
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_seats_for_plan(p_plan TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
    CASE p_plan
        WHEN 'intelligence' THEN RETURN 5;
        WHEN 'command_center' THEN RETURN 25;
        ELSE RETURN 1; -- safe default
    END CASE;
END;
$$;

COMMENT ON FUNCTION public.get_seats_for_plan IS 'Returns seat allocation for a given plan: intelligence=5, command_center=25';

-- Update any existing rows that have the old seat counts
UPDATE public.subscriptions SET seats_allowed = 5 WHERE plan = 'intelligence' AND seats_allowed = 1;
UPDATE public.subscriptions SET seats_allowed = 25 WHERE plan = 'command_center' AND seats_allowed = 5;

-- Clear all existing readable_ids to start fresh
UPDATE test_cases SET readable_id = NULL;

-- Create a simpler function that generates truly unique sequential IDs
CREATE OR REPLACE FUNCTION generate_unique_test_case_id()
RETURNS TEXT 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    next_number INT;
    final_id TEXT;
BEGIN
    -- Get the next available number by finding the highest existing number
    SELECT COALESCE(
        MAX(
            CASE 
                WHEN readable_id ~ '^DH-T[0-9]+-[0-9]+$' 
                THEN CAST(SPLIT_PART(SPLIT_PART(readable_id, '-', 3), '-', 1) AS INTEGER)
                ELSE 0 
            END
        ), 0
    ) + 1 INTO next_number
    FROM test_cases 
    WHERE readable_id IS NOT NULL;
    
    -- Generate ID in format DH-T<story_number>-<sequential_number>
    final_id := 'DH-T1-' || next_number;
    
    -- Ensure uniqueness (extra safety check)
    WHILE EXISTS (SELECT 1 FROM test_cases WHERE readable_id = final_id) LOOP
        next_number := next_number + 1;
        final_id := 'DH-T1-' || next_number;
    END LOOP;
    
    RETURN final_id;
END;
$$;

-- Update the trigger function to use the new approach
CREATE OR REPLACE FUNCTION set_test_case_readable_id()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
    IF NEW.readable_id IS NULL THEN
        NEW.readable_id := generate_unique_test_case_id();
    END IF;
    RETURN NEW;
END;
$$;

-- Regenerate all readable_ids sequentially for existing test cases
DO $$
DECLARE
    tc RECORD;
    counter INT := 1;
BEGIN
    FOR tc IN 
        SELECT id FROM test_cases 
        WHERE readable_id IS NULL 
        ORDER BY created_at ASC
    LOOP
        UPDATE test_cases 
        SET readable_id = 'DH-T1-' || counter 
        WHERE id = tc.id;
        counter := counter + 1;
    END LOOP;
END $$;

-- Now add the unique constraint
ALTER TABLE public.test_cases 
ADD CONSTRAINT unique_test_case_readable_id UNIQUE (readable_id);
-- Add unique constraint to readable_id column
ALTER TABLE public.test_cases 
ADD CONSTRAINT unique_test_case_readable_id UNIQUE (readable_id);

-- Update the function to handle uniqueness better by including a counter for duplicates
CREATE OR REPLACE FUNCTION generate_test_case_readable_id(p_user_story_id UUID, p_project_id UUID)
RETURNS TEXT 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    story_number INT;
    test_case_count INT;
    readable_id TEXT;
    counter INT := 1;
    final_id TEXT;
BEGIN
    -- Get the user story number (sequential number within project)
    SELECT COUNT(*) + 1 INTO story_number
    FROM user_stories 
    WHERE project_id = p_project_id 
    AND created_at <= (SELECT created_at FROM user_stories WHERE id = p_user_story_id);
    
    -- Get the test case count for this user story
    SELECT COUNT(*) + 1 INTO test_case_count
    FROM test_cases 
    WHERE user_story_id = p_user_story_id;
    
    -- Generate base readable ID format: DH-T<story_number>-<test_case_number>
    readable_id := 'DH-T' || story_number || '-' || test_case_count;
    final_id := readable_id;
    
    -- Check for uniqueness and increment if needed
    WHILE EXISTS (SELECT 1 FROM test_cases WHERE readable_id = final_id) LOOP
        counter := counter + 1;
        final_id := readable_id || '-' || counter;
    END LOOP;
    
    RETURN final_id;
END;
$$;
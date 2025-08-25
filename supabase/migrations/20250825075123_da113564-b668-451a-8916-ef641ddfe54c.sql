-- Add readable test case ID column
ALTER TABLE public.test_cases 
ADD COLUMN readable_id TEXT;

-- Create function to generate readable test case ID
CREATE OR REPLACE FUNCTION generate_test_case_readable_id(p_user_story_id UUID, p_project_id UUID)
RETURNS TEXT AS $$
DECLARE
    story_number INT;
    test_case_count INT;
    readable_id TEXT;
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
    
    -- Generate readable ID format: DH-T<story_number>-<test_case_number>
    readable_id := 'DH-T' || story_number || '-' || test_case_count;
    
    RETURN readable_id;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-generate readable ID on insert
CREATE OR REPLACE FUNCTION set_test_case_readable_id()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.readable_id IS NULL AND NEW.user_story_id IS NOT NULL THEN
        NEW.readable_id := generate_test_case_readable_id(NEW.user_story_id, NEW.project_id);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
CREATE TRIGGER trigger_set_test_case_readable_id
    BEFORE INSERT ON public.test_cases
    FOR EACH ROW
    EXECUTE FUNCTION set_test_case_readable_id();

-- Update existing test cases with readable IDs
UPDATE public.test_cases 
SET readable_id = generate_test_case_readable_id(user_story_id, project_id)
WHERE user_story_id IS NOT NULL AND readable_id IS NULL;
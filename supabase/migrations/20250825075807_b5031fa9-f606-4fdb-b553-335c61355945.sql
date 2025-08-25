-- First, let's fix the duplicate readable_ids by making them unique
-- Update duplicates by adding a suffix to make them unique
WITH duplicate_ids AS (
  SELECT readable_id, 
         ROW_NUMBER() OVER (PARTITION BY readable_id ORDER BY created_at) as rn
  FROM test_cases 
  WHERE readable_id IS NOT NULL
),
updates AS (
  SELECT tc.id, 
         CASE 
           WHEN d.rn = 1 THEN tc.readable_id 
           ELSE tc.readable_id || '-' || d.rn 
         END as new_readable_id
  FROM test_cases tc
  JOIN duplicate_ids d ON tc.readable_id = d.readable_id
  WHERE d.rn > 1
)
UPDATE test_cases 
SET readable_id = updates.new_readable_id
FROM updates 
WHERE test_cases.id = updates.id;

-- Now add the unique constraint
ALTER TABLE public.test_cases 
ADD CONSTRAINT unique_test_case_readable_id UNIQUE (readable_id);

-- Update the function to handle uniqueness better
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
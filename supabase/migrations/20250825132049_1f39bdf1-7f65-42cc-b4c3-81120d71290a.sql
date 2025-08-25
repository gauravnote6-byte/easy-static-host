-- Update the test case readable ID generation function to use new naming convention
-- TC-<first two characters of project name><incremental ID starting from 0001>

DROP FUNCTION IF EXISTS public.generate_test_case_readable_id(uuid, uuid);
DROP FUNCTION IF EXISTS public.generate_unique_test_case_id();

CREATE OR REPLACE FUNCTION public.generate_unique_test_case_id(p_project_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    project_prefix TEXT;
    next_number INT;
    final_id TEXT;
    project_name TEXT;
BEGIN
    -- Get the project name
    SELECT name INTO project_name
    FROM projects 
    WHERE id = p_project_id;
    
    -- Handle case where project is not found
    IF project_name IS NULL THEN
        project_name := 'UN'; -- Default to 'UN' for Unknown
    END IF;
    
    -- Get first two characters of project name (uppercase)
    -- Handle cases where project name is less than 2 characters
    IF LENGTH(project_name) >= 2 THEN
        project_prefix := UPPER(SUBSTRING(project_name FROM 1 FOR 2));
    ELSIF LENGTH(project_name) = 1 THEN
        project_prefix := UPPER(project_name) || 'X'; -- Pad with X if only 1 character
    ELSE
        project_prefix := 'UN'; -- Default if empty name
    END IF;
    
    -- Remove non-alphabetic characters and ensure we have valid prefix
    project_prefix := REGEXP_REPLACE(project_prefix, '[^A-Z]', '', 'g');
    IF LENGTH(project_prefix) < 2 THEN
        project_prefix := project_prefix || REPEAT('X', 2 - LENGTH(project_prefix));
    END IF;
    
    -- Get the next available number for this project
    SELECT COALESCE(
        MAX(
            CASE 
                WHEN readable_id ~ ('^TC-' || project_prefix || '[0-9]{4}$')
                THEN CAST(SUBSTRING(readable_id FROM LENGTH('TC-' || project_prefix) + 1) AS INTEGER)
                ELSE 0 
            END
        ), 0
    ) + 1 INTO next_number
    FROM test_cases 
    WHERE project_id = p_project_id 
    AND readable_id IS NOT NULL;
    
    -- Generate ID in format TC-<PREFIX><0001>
    final_id := 'TC-' || project_prefix || LPAD(next_number::text, 4, '0');
    
    -- Ensure uniqueness (extra safety check)
    WHILE EXISTS (SELECT 1 FROM test_cases WHERE readable_id = final_id AND project_id = p_project_id) LOOP
        next_number := next_number + 1;
        final_id := 'TC-' || project_prefix || LPAD(next_number::text, 4, '0');
    END LOOP;
    
    RETURN final_id;
END;
$function$;

-- Update the trigger function to use the new naming convention
CREATE OR REPLACE FUNCTION public.set_test_case_readable_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    IF NEW.readable_id IS NULL THEN
        NEW.readable_id := generate_unique_test_case_id(NEW.project_id);
    END IF;
    RETURN NEW;
END;
$function$;

-- Create trigger for automatic test case ID generation
DROP TRIGGER IF EXISTS set_test_case_readable_id_trigger ON test_cases;
CREATE TRIGGER set_test_case_readable_id_trigger
    BEFORE INSERT ON test_cases
    FOR EACH ROW
    EXECUTE FUNCTION set_test_case_readable_id();
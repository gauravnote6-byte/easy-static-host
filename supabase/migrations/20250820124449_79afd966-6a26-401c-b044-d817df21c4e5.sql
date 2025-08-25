-- Update RLS policies to allow project members to view user stories and test cases

-- Drop existing policies for user_stories
DROP POLICY IF EXISTS "Users can view user stories from their projects" ON public.user_stories;

-- Create new policy for user_stories that includes project members
CREATE POLICY "Users can view user stories from their projects or as project members" 
ON public.user_stories 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.projects 
    WHERE projects.id = user_stories.project_id 
    AND projects.created_by = auth.uid()
  ) 
  OR is_project_member(user_stories.project_id, auth.uid())
);

-- Drop existing policies for test_cases
DROP POLICY IF EXISTS "Users can view test cases from their projects" ON public.test_cases;

-- Create new policy for test_cases that includes project members
CREATE POLICY "Users can view test cases from their projects or as project members" 
ON public.test_cases 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.projects 
    WHERE projects.id = test_cases.project_id 
    AND projects.created_by = auth.uid()
  ) 
  OR is_project_member(test_cases.project_id, auth.uid())
);
-- Completely fix infinite recursion in projects table by removing ALL existing policies and recreating them properly

-- Drop ALL existing policies on projects table
DROP POLICY IF EXISTS "Admins and project owners can delete projects" ON public.projects;
DROP POLICY IF EXISTS "Admins and project owners can update projects" ON public.projects;
DROP POLICY IF EXISTS "Only admins can create projects" ON public.projects;
DROP POLICY IF EXISTS "Users can view accessible projects" ON public.projects;
DROP POLICY IF EXISTS "Admins and members can view projects" ON public.projects;
DROP POLICY IF EXISTS "Admins can create projects" ON public.projects;
DROP POLICY IF EXISTS "Admins and project members can update projects" ON public.projects;
DROP POLICY IF EXISTS "Admins can delete projects" ON public.projects;

-- Update the security definer functions to include search path for security
CREATE OR REPLACE FUNCTION public.is_admin(user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN 
LANGUAGE SQL 
SECURITY DEFINER 
STABLE
SET search_path = public
AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.user_roles 
    WHERE user_roles.user_id = $1 AND role = 'admin'::app_role
  );
$$;

CREATE OR REPLACE FUNCTION public.is_project_member(project_id UUID, user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN 
LANGUAGE SQL 
SECURITY DEFINER 
STABLE
SET search_path = public
AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.project_members 
    WHERE project_members.project_id = $1 AND project_members.user_id = $2
  );
$$;

-- Create new RLS policies that avoid recursion
CREATE POLICY "Admin users can view all projects" ON public.projects
  FOR SELECT 
  USING (public.is_admin());

CREATE POLICY "Project members can view their projects" ON public.projects
  FOR SELECT 
  USING (public.is_project_member(id));

CREATE POLICY "Project owners can view their projects" ON public.projects
  FOR SELECT 
  USING (created_by = auth.uid());

CREATE POLICY "Admin users can create projects" ON public.projects
  FOR INSERT 
  WITH CHECK (public.is_admin());

CREATE POLICY "Admin users can update all projects" ON public.projects
  FOR UPDATE 
  USING (public.is_admin());

CREATE POLICY "Project owners can update their projects" ON public.projects
  FOR UPDATE 
  USING (created_by = auth.uid());

CREATE POLICY "Admin users can delete projects" ON public.projects
  FOR DELETE 
  USING (public.is_admin());

CREATE POLICY "Project owners can delete their projects" ON public.projects
  FOR DELETE 
  USING (created_by = auth.uid());
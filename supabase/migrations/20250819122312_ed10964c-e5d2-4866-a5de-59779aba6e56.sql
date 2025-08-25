-- Fix infinite recursion in projects table RLS policies
-- Drop existing problematic policies
DROP POLICY IF EXISTS "Users can view projects they are members of" ON public.projects;
DROP POLICY IF EXISTS "Users can create projects" ON public.projects;
DROP POLICY IF EXISTS "Users can update projects they are members of" ON public.projects;
DROP POLICY IF EXISTS "Users can delete projects they are members of" ON public.projects;

-- Create security definer function to check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin(user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.user_roles 
    WHERE user_roles.user_id = $1 AND role = 'admin'::app_role
  );
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Create security definer function to check project membership
CREATE OR REPLACE FUNCTION public.is_project_member(project_id UUID, user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.project_members 
    WHERE project_members.project_id = $1 AND project_members.user_id = $2
  );
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Create new RLS policies using security definer functions
CREATE POLICY "Admins and members can view projects" ON public.projects
  FOR SELECT USING (
    public.is_admin() OR public.is_project_member(id)
  );

CREATE POLICY "Admins can create projects" ON public.projects
  FOR INSERT WITH CHECK (
    public.is_admin()
  );

CREATE POLICY "Admins and project members can update projects" ON public.projects
  FOR UPDATE USING (
    public.is_admin() OR public.is_project_member(id)
  );

CREATE POLICY "Admins can delete projects" ON public.projects
  FOR DELETE USING (
    public.is_admin()
  );
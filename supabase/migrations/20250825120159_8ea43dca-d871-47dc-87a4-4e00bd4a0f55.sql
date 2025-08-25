-- Add soft delete functionality to projects table
ALTER TABLE public.projects 
ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Create index for better performance when filtering deleted projects
CREATE INDEX idx_projects_deleted_at ON public.projects (deleted_at) WHERE deleted_at IS NULL;
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Edit, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { validateText, sanitizeText } from "@/lib/security";
import { useRoles } from "@/hooks/useRoles";

interface ProjectEditDialogProps {
  projectId: string;
  projectName: string;
  projectDescription: string;
  isOpen: boolean;
  onClose: () => void;
  onProjectUpdated: () => void;
  onProjectDeleted: () => void;
}

export const ProjectEditDialog = ({ 
  projectId, 
  projectName, 
  projectDescription, 
  isOpen, 
  onClose, 
  onProjectUpdated, 
  onProjectDeleted 
}: ProjectEditDialogProps) => {
  const [name, setName] = useState(projectName);
  const [description, setDescription] = useState(projectDescription);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { toast } = useToast();
  const { isAdmin } = useRoles();

  useEffect(() => {
    setName(projectName);
    setDescription(projectDescription);
  }, [projectName, projectDescription, isOpen]);

  const handleSave = async () => {
    // Validate inputs
    const nameValidation = validateText(name, "Project name", 1, 255);
    if (!nameValidation.isValid) {
      toast({
        title: "Error",
        description: nameValidation.error,
        variant: "destructive",
      });
      return;
    }

    const descriptionValidation = validateText(description, "Description", 0, 2000, false);
    if (!descriptionValidation.isValid) {
      toast({
        title: "Error",
        description: descriptionValidation.error,
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('projects')
        .update({
          name: sanitizeText(name),
          description: sanitizeText(description),
          updated_at: new Date().toISOString()
        })
        .eq('id', projectId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Project updated successfully",
      });
      onProjectUpdated();
      onClose();
    } catch (error) {
      console.error('Error updating project:', error);
      toast({
        title: "Error",
        description: "Failed to update project",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSoftDelete = async () => {
    setDeleting(true);
    try {
      const { error } = await supabase
        .from('projects')
        .update({
          deleted_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', projectId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Project deleted successfully",
      });
      onProjectDeleted();
    } catch (error) {
      console.error('Error deleting project:', error);
      toast({
        title: "Error",
        description: "Failed to delete project",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit className="h-5 w-5" />
            Edit Project
          </DialogTitle>
          <DialogDescription>
            Update project name and description. Changes will be visible immediately.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="edit-name">Project Name</Label>
            <Input
              id="edit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter project name..."
              disabled={!isAdmin}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="edit-description">Description</Label>
            <Textarea
              id="edit-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter project description..."
              rows={3}
              disabled={!isAdmin}
            />
          </div>
        </div>

        <DialogFooter className="flex flex-col sm:flex-row gap-2">
          {isAdmin && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button 
                  variant="destructive" 
                  size="sm"
                  disabled={saving || deleting}
                  className="mr-auto"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Project
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Project</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete "{projectName}"? This action will hide the project from the list, but data can be recovered by an administrator if needed.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={handleSoftDelete}
                    disabled={deleting}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {deleting ? "Deleting..." : "Delete Project"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={onClose} 
              disabled={saving || deleting}
            >
              Cancel
            </Button>
            {isAdmin && (
              <Button 
                onClick={handleSave} 
                disabled={saving || deleting}
              >
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
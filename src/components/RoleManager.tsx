import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Trash2, UserPlus, Settings } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useRoles, UserRole } from "@/hooks/useRoles";

interface UserProfile {
  user_id: string;
  display_name: string | null;
  email: string | null;
  role?: UserRole;
}

interface Project {
  id: string;
  name: string;
}

const RoleManager = () => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [newUserEmail, setNewUserEmail] = useState("");
  const [selectedRole, setSelectedRole] = useState<UserRole>("tester");
  const [selectedUser, setSelectedUser] = useState<string>("");
  const [selectedProject, setSelectedProject] = useState<string>("");
  const { toast } = useToast();
  const { assignRole, removeRole, isAdmin } = useRoles();

  const fetchUsersWithRoles = async () => {
    try {
      // Fetch all profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, display_name, email');

      if (profilesError) throw profilesError;

      // Fetch all user roles
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');

      if (rolesError) throw rolesError;

      // Combine profiles with roles
      const usersWithRoles = profiles?.map(profile => ({
        ...profile,
        role: roles?.find(role => role.user_id === profile.user_id)?.role
      })) || [];

      setUsers(usersWithRoles);
    } catch (error: any) {
      console.error('Error fetching users:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch users",
      });
    }
  };

  const fetchProjects = async () => {
    try {
      const { data: projects, error } = await supabase
        .from('projects')
        .select('id, name')
        .order('name');

      if (error) throw error;
      setProjects(projects || []);
    } catch (error: any) {
      console.error('Error fetching projects:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch projects",
      });
    }
  };

  const fetchData = async () => {
    setLoading(true);
    await Promise.all([fetchUsersWithRoles(), fetchProjects()]);
    setLoading(false);
  };

  const handleAssignRole = async (userId: string, role: UserRole) => {
    const success = await assignRole(userId, role);
    if (success) {
      await fetchUsersWithRoles();
    }
  };

  const handleRemoveRole = async (userId: string) => {
    const success = await removeRole(userId);
    if (success) {
      await fetchUsersWithRoles();
    }
  };

  const handleAssignProject = async () => {
    if (!selectedUser || !selectedProject) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please select both user and project",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('project_members')
        .insert({
          user_id: selectedUser,
          project_id: selectedProject,
          role: 'member'
        });

      if (error) {
        if (error.code === '23505') {
          toast({
            variant: "destructive",
            title: "Error",
            description: "User is already a member of this project",
          });
          return;
        }
        throw error;
      }

      toast({
        title: "Success",
        description: "User assigned to project successfully",
      });
      
      setSelectedUser("");
      setSelectedProject("");
    } catch (error: any) {
      console.error('Error assigning project:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to assign project",
      });
    }
  };

  const handleInviteUser = async () => {
    if (!newUserEmail.trim()) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please enter an email address",
      });
      return;
    }

    try {
      // In a real implementation, you would send an invitation email
      // For now, we'll just show a message
      toast({
        title: "Invitation Sent",
        description: `Invitation sent to ${newUserEmail} with ${selectedRole} role`,
      });
      
      setNewUserEmail("");
      setSelectedRole("tester");
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to send invitation",
      });
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchData();
    }
  }, [isAdmin]);

  if (!isAdmin) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Access Denied</CardTitle>
          <CardDescription>
            You need admin privileges to manage user roles.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Role Management</CardTitle>
          <CardDescription>Loading users...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Invite New User</CardTitle>
          <CardDescription>
            Send an invitation to a new user with a specific role
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <Input
              placeholder="user@example.com"
              value={newUserEmail}
              onChange={(e) => setNewUserEmail(e.target.value)}
              className="flex-1"
            />
            <Select value={selectedRole} onValueChange={(value: UserRole) => setSelectedRole(value)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="tester">Tester</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={handleInviteUser}>
              <UserPlus className="mr-2 h-4 w-4" />
              Invite
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Assign Project to User</CardTitle>
          <CardDescription>
            Add users as members to projects
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <Select value={selectedUser} onValueChange={setSelectedUser}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Select user" />
              </SelectTrigger>
              <SelectContent>
                {users.map((user) => (
                  <SelectItem key={user.user_id} value={user.user_id}>
                    {user.display_name || user.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedProject} onValueChange={setSelectedProject}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Select project" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={handleAssignProject}>
              <Settings className="mr-2 h-4 w-4" />
              Assign
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>User Roles</CardTitle>
          <CardDescription>
            Manage roles for existing users
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {users.map((user) => (
              <div key={user.user_id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-4">
                  <div>
                    <p className="font-medium">{user.display_name || user.email}</p>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                  </div>
                  {user.role && (
                    <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                      {user.role}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Select
                    value={user.role || ""}
                    onValueChange={(role: UserRole) => handleAssignRole(user.user_id, role)}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="tester">Tester</SelectItem>
                    </SelectContent>
                  </Select>
                  {user.role && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRemoveRole(user.user_id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default RoleManager;
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export type UserRole = 'admin' | 'tester';

interface UserRoleData {
  id: string;
  user_id: string;
  role: UserRole;
  created_at: string;
}

export const useRoles = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUserRole = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching user role:', error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to fetch user role",
        });
      }

      setUserRole(data?.role || null);
    } catch (error) {
      console.error('Error fetching user role:', error);
    } finally {
      setLoading(false);
    }
  };

  const assignRole = async (userId: string, role: UserRole) => {
    try {
      const { error } = await supabase
        .from('user_roles')
        .upsert({ user_id: userId, role }, { onConflict: 'user_id' });

      if (error) throw error;

      toast({
        title: "Success",
        description: `Role ${role} assigned successfully`,
      });

      return true;
    } catch (error: any) {
      console.error('Error assigning role:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to assign role",
      });
      return false;
    }
  };

  const removeRole = async (userId: string) => {
    try {
      const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Role removed successfully",
      });

      return true;
    } catch (error: any) {
      console.error('Error removing role:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to remove role",
      });
      return false;
    }
  };

  const isAdmin = userRole === 'admin';
  const isTester = userRole === 'tester';
  const hasRole = (role: UserRole) => userRole === role;

  useEffect(() => {
    fetchUserRole();
  }, [user]);

  return {
    userRole,
    loading,
    isAdmin,
    isTester,
    hasRole,
    assignRole,
    removeRole,
    refetch: fetchUserRole,
  };
};
-- Find and assign admin role to gaurav.patel@1rivet.com
DO $$
DECLARE
    target_user_id UUID;
BEGIN
    -- Find the user ID by email
    SELECT user_id INTO target_user_id 
    FROM public.profiles 
    WHERE email = 'gaurav.patel@1rivet.com';
    
    -- Check if user exists
    IF target_user_id IS NOT NULL THEN
        -- Insert or update the user role to admin
        INSERT INTO public.user_roles (user_id, role)
        VALUES (target_user_id, 'admin'::app_role)
        ON CONFLICT (user_id) 
        DO UPDATE SET 
            role = 'admin'::app_role,
            updated_at = now();
        
        RAISE NOTICE 'Admin role assigned to user: %', 'gaurav.patel@1rivet.com';
    ELSE
        RAISE NOTICE 'User not found: %', 'gaurav.patel@1rivet.com';
    END IF;
END $$;
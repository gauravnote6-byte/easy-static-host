-- Find and assign admin role to gaurav.patel@1rivet.com
DO $$
DECLARE
    target_user_id UUID;
    existing_role_id UUID;
BEGIN
    -- Find the user ID by email
    SELECT user_id INTO target_user_id 
    FROM public.profiles 
    WHERE email = 'gaurav.patel@1rivet.com';
    
    -- Check if user exists
    IF target_user_id IS NOT NULL THEN
        -- Check if user already has a role
        SELECT id INTO existing_role_id
        FROM public.user_roles
        WHERE user_id = target_user_id;
        
        IF existing_role_id IS NOT NULL THEN
            -- Update existing role
            UPDATE public.user_roles 
            SET role = 'admin'::app_role, updated_at = now()
            WHERE user_id = target_user_id;
            RAISE NOTICE 'Updated role to admin for user: %', 'gaurav.patel@1rivet.com';
        ELSE
            -- Insert new role
            INSERT INTO public.user_roles (user_id, role)
            VALUES (target_user_id, 'admin'::app_role);
            RAISE NOTICE 'Assigned admin role to user: %', 'gaurav.patel@1rivet.com';
        END IF;
    ELSE
        RAISE NOTICE 'User not found: %. Make sure the user has signed up first.', 'gaurav.patel@1rivet.com';
    END IF;
END $$;
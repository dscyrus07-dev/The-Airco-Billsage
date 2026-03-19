-- Add Supabase Auth link to users table
-- This migration adds a foreign key to Supabase's auth.users table

-- Add auth_user_id column to users table
ALTER TABLE public.users 
ADD COLUMN auth_user_id UUID;

-- Create index for faster lookups
CREATE INDEX idx_users_auth_user_id ON public.users(auth_user_id);

-- Make the column unique since it should be 1:1 with auth.users
ALTER TABLE public.users 
ADD CONSTRAINT users_auth_user_id_unique UNIQUE (auth_user_id);

-- Add comment explaining the relationship
COMMENT ON COLUMN public.users.auth_user_id IS 'Link to Supabase auth.users.id - 1:1 relationship';

-- For existing users, we'll need to populate this column during migration
-- This will be handled by the application during first login of existing users

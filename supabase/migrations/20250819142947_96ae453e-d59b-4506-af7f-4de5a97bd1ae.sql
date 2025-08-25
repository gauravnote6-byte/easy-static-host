-- Add test_data column to test_cases table
ALTER TABLE public.test_cases 
ADD COLUMN test_data text;
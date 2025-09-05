import { createClient } from '@supabase/supabase-js'

// Replace these with your actual Supabase credentials
const supabaseUrl = 'https://ruzznovsrwkxupdwafyy.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ1enpub3ZzcndreHVwZHdhZnl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY5NjI1ODksImV4cCI6MjA3MjUzODU4OX0.FpOWJQcQ99JRwUUbpCOXlw0VSZ-lAoku2ipBb77mcRc'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
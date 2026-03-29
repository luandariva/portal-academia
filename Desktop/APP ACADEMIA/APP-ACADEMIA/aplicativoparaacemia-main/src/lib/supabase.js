import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://jetctztdbxyyukazuhpm.supabase.co'
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpldGN0enRkYnh5eXVrYXp1aHBtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzE2ODA2MTcsImV4cCI6MjA0NzI1NjYxN30.UHWHv6fqtqBH6YFi5UesEAaSIL0sFwPtiIj3w2mcL_M'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

import { createClient } from '@supabase/supabase-js'
import { createRetryFetch } from './retryFetch'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !key) throw new Error('Supabase public configuration is missing')

export const supabase = createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  global: { fetch: createRetryFetch() },
})

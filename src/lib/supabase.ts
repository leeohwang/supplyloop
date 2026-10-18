import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const projectUrl = import.meta.env.VITE_SUPABASE_URL?.trim() ?? ''
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ?? ''

function validateConfiguration(): string | null {
  if (!projectUrl || !publishableKey) {
    return 'Add the project URL and publishable key to .env.local to connect SupplyLoop.'
  }
  try {
    const url = new URL(projectUrl)
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))) {
      return 'Use the Supabase HTTPS project URL, or a localhost development URL.'
    }
  } catch {
    return 'The Supabase project URL is invalid.'
  }
  if (!publishableKey.startsWith('sb_publishable_')) {
    return 'Use a Supabase publishable key. Server-only secret keys cannot be used in this app.'
  }
  return null
}

export const configurationError = validateConfiguration()
export const supabase = configurationError ? null : createClient<Database>(projectUrl, publishableKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
})

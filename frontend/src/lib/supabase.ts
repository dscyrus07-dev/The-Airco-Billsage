import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

// Singleton Supabase client instance
let supabaseInstance: ReturnType<typeof createClient> | null = null

export const getSupabaseClient = () => {
  if (!supabaseInstance) {
    supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce'
      }
    })
  }
  return supabaseInstance
}

// Export singleton instance for backward compatibility
export const supabase = getSupabaseClient()

// Cache the token to prevent deadlocks when calling getSession() inside onAuthStateChange
let cachedAccessToken: string | null = null

// Listen to auth changes to eagerly update our cached token
supabase.auth.onAuthStateChange((event, session) => {
  cachedAccessToken = session?.access_token || null
})

// Helper to get current session token for API calls
export const getCurrentAccessToken = async () => {
  if (cachedAccessToken) {
    return cachedAccessToken
  }
  
  // Try to parse from localStorage fallback
  try {
    const storageKey = Object.keys(localStorage).find(k => k.startsWith('sb-') && k.endsWith('-auth-token'));
    if (storageKey) {
      const sessionData = JSON.parse(localStorage.getItem(storageKey) || '{}');
      if (sessionData && sessionData.access_token) {
        cachedAccessToken = sessionData.access_token;
        return cachedAccessToken;
      }
    }
  } catch (e) {
    console.error('Failed to parse token from localStorage', e);
  }

  return null;
}

// Helper to get current user
export const getCurrentUser = async () => {
  // Avoid lock issues by not using getUser() if session has issues
  try {
    const { data: { user } } = await supabase.auth.getUser()
    return user
  } catch(e) {
    return null;
  }
}

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

let supabaseInstance = null;

if (supabaseUrl && supabaseAnonKey) {
  try {
    supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      }
    });
  } catch (err) {
    console.error("Failed to initialize Supabase client:", err.message);
  }
} else {
  console.warn("WARNING: SUPABASE_URL or SUPABASE_ANON_KEY is not defined. Supabase Auth operations will be unavailable.");
}

export const supabase = supabaseInstance;

export function getSupabase() {
  if (!supabaseInstance) {
    throw new Error("Supabase is not configured. Please set SUPABASE_URL and SUPABASE_ANON_KEY environment variables.");
  }
  return supabaseInstance;
}

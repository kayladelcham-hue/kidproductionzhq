import { createClient } from "@supabase/supabase-js";

// Existing KP HQ data project. The publishable key is safe to ship in the
// browser; every table is protected by row-level security on the server.
export const KP_SUPABASE_URL = "https://zgiikpkvwjeescdjhnsf.supabase.co";
export const KP_SUPABASE_KEY = "sb_publishable_5LEGAvGuPvktWlmKSyjAzg_HNXtPGXu";
export const OWNER_ID = "c6a63fd2-f810-491b-9a32-e84c835d5951";

export const sb = createClient(KP_SUPABASE_URL, KP_SUPABASE_KEY, {
  auth: {
    persistSession: typeof window !== "undefined",
    autoRefreshToken: typeof window !== "undefined",
    detectSessionInUrl: typeof window !== "undefined",
  },
});

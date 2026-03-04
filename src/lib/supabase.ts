import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase URL and Anon Key are required in .env file');
}

// Configure Supabase client with cache-busting headers
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
        headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
        },
    },
    realtime: {
        params: {
            eventsPerSecond: 10,
        },
    },
});

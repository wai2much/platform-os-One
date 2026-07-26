import { createClient } from '@supabase/supabase-js';

// Own Supabase project for Slim — NOT v2.5's TyrePlus production project.
// Unconfigured by default: the app runs fine on in-memory sample data until
// these env vars are set (see .env.example + supabase/schema.sql).
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && key);

export const supabase = isSupabaseConfigured ? createClient(url, key) : null;

// netlify/functions/_lib/supabase.js
const { createClient } = require('@supabase/supabase-js');

// Prevenimos el crash instantáneo (502) si faltan variables
const url = process.env.SUPABASE_URL || 'https://faltan-variables.supabase.co';
const key = process.env.SUPABASE_SERVICE_KEY || 'falta-key';

const supabase = createClient(url, key, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

module.exports = { supabase };

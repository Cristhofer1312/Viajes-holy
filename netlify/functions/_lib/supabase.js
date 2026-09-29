// netlify/functions/_lib/supabase.js
// Cliente de Supabase para usar en las Netlify Functions (servidor)
// Usa SUPABASE_SERVICE_KEY que ignora RLS — solo en el servidor, nunca en el cliente

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

module.exports = { supabase };

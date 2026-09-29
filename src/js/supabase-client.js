// src/js/supabase-client.js
// Inicializa el cliente de Supabase en el navegador y gestiona la sesión
//
// ⚠️  INSTRUCCIONES:
// 1. Ve a supabase.com → tu proyecto → Settings → API
// 2. Copia "Project URL" y reemplaza SUPABASE_URL
// 3. Copia "anon public" key y reemplaza SUPABASE_ANON_KEY
// La anon key es PÚBLICA — está diseñada para el frontend. RLS protege los datos.

(function (root) {
  'use strict';

  var SUPABASE_URL = 'https://ualrfluphudqvijlqeva.supabase.co';
  var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVhbHJmbHVwaHVkcXZpamxxZXZhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA2NTU0OTUsImV4cCI6MjEwNjIzMTQ5NX0.-yF4pfmwYN1tQXlbF2klauTF7QOSC17A2PKOZ3QOmw0';      // ej: eyJhbGci...


  if (!window.supabase) {
    console.error('[supabase-client] El SDK de Supabase no está cargado. Verifica el script tag.');
    return;
  }

  var client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });

  // Restaurar sesión existente al cargar la página
  client.auth.getSession().then(function (result) {
    if (result.data && result.data.session) {
      root.__supabaseSession = result.data.session;
    }
  });

  // Actualizar la sesión en memoria cada vez que cambia
  client.auth.onAuthStateChange(function (_event, session) {
    root.__supabaseSession = session;
    // Disparar evento personalizado para que auth.js reaccione
    var ev = new CustomEvent('holy:auth-change', { detail: { session: session } });
    document.dispatchEvent(ev);
  });

  // Exponer el cliente para uso desde auth.js, storage.js y otros módulos
  root.SupabaseClient = client;

})(typeof self !== 'undefined' ? self : this);

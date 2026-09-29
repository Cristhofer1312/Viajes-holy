# Control de Acceso por Rol desde index.html

> **Estado: implementado.** Este documento describe la arquitectura final.
> El plan original (sidebar desde cero) fue corregido: `index.html` ya tenía
> un `<aside>` con 3 vistas, y `src/js/roles.js` ya existía como fuente de
> permisos. Ver "Decisiones" y "Bugs corregidos" al final.

## Arquitectura

Una sola aplicación: **`index.html`**. `admin.html` es un redirect de compatibilidad.
El acceso se controla por rol en dos capas: la **UI** (sidebar y controles) y el
**servidor** (Netlify Functions, con `catalog:read`, `template:create`, etc.).

### Módulos del sidebar

| Sección | VISTA | Permiso | Agente | Encargado | Admin |
|---|---|---|:---:|:---:|:---:|
| Plantillas (catálogo) | `#view-plantillas` | `catalog:read` | ✅ | ✅ | ✅ |
| Cotización | `#view-cotizacion` | `quote:create` | ✅ | ✅ | ✅ |
| Catálogo (import/export) | `#view-catalogo` | `catalog:read` | ✅ | ✅ | ✅ |
| **Gestión de Posadas** | `#view-gestion-posadas` | `template:create` | ❌ | ✅ | ✅ |
| **Usuarios** | `#view-usuarios` | `user:read` | ❌ | ✅ | ✅ |

> Se llama **"Gestión de Posadas"** y no "Plantillas" para no chocar con la vista
> `plantillas` existente, que es el catálogo que el Agente necesita para cotizar.

### El Agente es de solo lectura sobre el catálogo

Puede consultar y seleccionar posadas, pero no crearlas, editarlas, duplicarlas,
borrarlas ni importar catálogos. `showEditor()` rechaza la apertura del editor y
`renderTemplateList()` oculta los botones de escritura. El servidor igual rechaza
el guardado: `/api/plantillas-save` distingue `template:create` de `template:update`
según exista ya la posada.

## Flujo de autenticación

```
Visita index.html
      │
      ▼
auth.js: getSession()
  │ NO            │ SÍ
  ▼               ▼
overlay        GET /api/me
de login        │  401/inactivo/no registrado → signOut + overlay
  │             │  200 → perfil con rol y rango
  │             ▼
  │        ocultar overlay, mostrar #app-shell,
  │        aplicarNavegacion() + aplicarPermisosEscritura()
  │             │
  │             ▼
  │        app.js: await Auth.ready() → Store.loadCatalog()
  ▼             ▼
app.js queda inerte   app operative
```

`app.js` espera `Auth.ready()` porque `/api/plantillas-list` exige un JWT válido.
Un login exitoso recarga la página para que `app.js` y `gestion.js` inicialicen
con el perfil disponible.

## Archivos

| Archivo | Rol |
|---|---|
| `src/js/roles.js` | **Fuente única de verdad** de permisos. UMD: se carga en el navegador y se `require`a en el servidor. |
| `src/js/auth.js` | Puerta de entrada: `ready()`, `login()`, `logout()`, `restaurarSesion()`, `puede()`. |
| `src/js/gestion.js` | Vistas Gestión de Posadas y Usuarios (tablas, modales, drag&drop de fotos). |
| `src/js/app.js` | Cotizador + router consciente del rol. |
| `netlify/functions/_lib/auth.js` | `verificarAuth()` y re-export de `roles.js`. Ya no declara reglas. |

## Reglas de permisos

Definidas en `src/js/roles.js:21-33`. Campos admitidos por regla:

- `roles` — lista de roles, o mapa `{ rol: 'cualquiera' | 'inferior' }`
- `asigna` — roles que el actor puede **otorgar** (anti-escalación)
- `noPropio` — no aplicable sobre uno mismo

| Acción | Regla |
|---|---|
| `catalog:read` | admin, encargado, agente |
| `quote:create` | admin, encargado, agente |
| `template:create` / `template:update` | admin, encargado |
| `template:delete` | admin |
| `user:read` | admin, encargado |
| `user:create` | admin · `asigna: [encargado, agente]` |
| `user:update` | admin · `noPropio` · `asigna: [encargado, agente]` |
| `user:delete` | admin · `noPropio` |
| `user:activate` / `user:deactivate` | admin (cualquiera) / encargado (inferior) · `noPropio` |

### Salvaguardas contra lockout

1. `user:delete` y `user:update` llevan `noPropio`: un admin no puede editar ni
   borrarse a sí mismo.
2. `usuarios-delete.js:18-31` comprueba que quede al menos un admin activo.
3. `user:activate`/`user:deactivate` con `noPropio` impiden dejar cero admins activos.

## Decisiones tomadas

| Tema | Decisión |
|---|---|
| Nombre del módulo CRUD | "Gestión de Posadas" (evita choque con "Plantillas" = catálogo) |
| Encargado y usuarios | Ve usuarios y desactiva de rango inferior; no a sí mismo ni a su nivel |
| Puerta de entrada | Solo el overlay de `index.html`; `admin.html` redirige |
| Alta de usuarios | Inmediata con `createUser` (antes: invitación por email, quedaba inactivo) |
| `plantillas-list` | Exige token + `catalog:read` (antes era público) |
| Escalación a admin | Veto total. Un segundo admin se añade en el panel de Supabase |
| Agente y el catálogo | Solo lectura |
| Catálogo vacío | Sin seed (`seed.js` ya no existe): estado vacío informativo |

## Bugs corregidos

| # | Ubicación | Problema |
|---|---|---|
| B1 | `admin.js:172` | `fetch('/api/usuarios')` → 404, la función es `usuarios-list.js` |
| B2 | `admin.js:155` | "Eliminar" posada era `alert('en desarrollo')` |
| B3 | `usuarios-save.js` | `inviteUserByEmail` ignoraba la contraseña; ahora `createUser` con alta inmediata |
| B4 | `index.html` | `roles.js` no estaba en los `<script>` |
| B5 | `_lib/auth.js` | Reglas duplicadas con `roles.js` (drift) |
| B6 | — | Doble login index/admin → riesgo de loop |
| B7 | `plantillas-list.js` | Endpoint público sin autenticación |
| B8a | `usuarios-save.js` | Cualquier admin podía crear admins sin límite |
| B8b | `usuarios-update.js` | Cualquier admin podía promover a admin, incluso a sí mismo |
| B8c | `usuarios-delete.js` | Sin `noPropio` ni guard: se podía borrar al último admin (lockout permanente) |
| B9 | `me.js` / `app.js` | `rango` no se calculaba; `setActiveNav` con vistas hardcodeadas; `holy-active-tab` sin validar por rol |
| B10 | `index.html` | No existía `#logout-btn` |
| B11 | `plantillas-save.js` | Validaba `template:create` también en updates; `template:update` no se usaba |
| B12 | `app.js` | El Agente recibía 403 al guardar: `saveCatalog` envía el catálogo entero y exige `template:create` |
| B13 | `app.js` | `seed()` era código muerto (`index.html` ya no carga `seed.js`) |
| B14 | `app.js` | `deletePlantilla` solo filtraba el array local; la posada reaparecía al recargar |
| B15 | `usuarios-activar.js` | `admin.js` enviaba `{uid}` y la función leía `{id}` → siempre 400 |

## Admin maestro

La aplicación **no puede crear administradores** (regla `asigna` en `src/js/roles.js:29-30`).
El único camino de alta y de recuperación es el script local:

```bash
node scripts/create-admin.js
```

Las credenciales viven en el `.env` (`ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NOMBRE`),
nunca en el código. El script es idempotente: se puede re-ejecutar para **rotar la
contraseña** o para **reparar un alta a medias** (crea el perfil en `usuarios` si
falta, o reactiva la cuenta si estaba inactiva). No sobrescribe `nombre` ni `rol`
de un admin existente.

## Tests

```bash
npm test
```

`test/roles.test.js` cubre las 11 reglas con los tres roles, más las guardas
`noPropio`, `asigna` y de jerarquía.

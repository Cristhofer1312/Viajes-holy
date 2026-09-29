# Plan de Despliegue en AWS — Sistema de Cotizaciones de Viaje

**Proyecto:** Viajes Holy Cotizador
**Versión analizada:** 1.0.0 · Electron 44.4.3 (Chromium 152.0.7977.130) · Node 24.21.0
**Fecha:** 2026-09-29 · **Revisión:** 4

### Registro de cambios de la revisión 4

Esta revisión **ejecuta la Fase A** y corrige lo que la medición refutó. No amplía alcance.

| # | Cambio | Detalle |
| :--- | :--- | :--- |
| 1 | **§6.3 refutado y corregido** | La rev. 3 afirmaba que Electron y Puppeteer comparten `Page.printToPDF`. **Falso en Chromium 152: el comando solo existe en builds headless.** Se retira la afirmación y se documenta la evidencia. |
| 2 | **Sección nueva §6.3.1** | La Lambda debe **activar la pestaña Cotización** antes de imprimir; si no, el PDF sale con datos de ejemplo. Requisito operativo e invisible hasta medirlo. |
| 3 | **§7.2.1 nueva: resultados medidos** | Las 4 variantes CDP coinciden con el `.exe`: 2 páginas, A4, 0 líneas con texto distinto de 50, 0 líneas desplazadas > 1 pt, peor desplazamiento 0,21 pt, 24 imágenes, tamaño +4,02 %. Veredicto: **IDÉNTICA**. |
| 4 | **§7.2.2 nueva: metodología** | La comparación pasa de items a **líneas**, porque la segmentación de `pdf.js` cambió (36 vs 50 items) sin que cambiara el render. |
| 5 | **§6.8 y §10 actualizados** | Se cierra el riesgo de runtime y quedan abiertos dos: **paridad en Linux sin verificar** y **el requisito headless**. |
| 6 | Referencias cruzadas `§7.3`→`§7.2` | Los criterios de aceptación de la Fase A están en §7.2, no en §7.3 (que es Fase B). |

### Registro de cambios de la revisión 3

Esta revisión es una **auditoría de verificación**, no una ampliación de alcance. Se comprobó cada cita contra el código y se corrigió lo que no resistió la comprobación:

| # | Corrección | Detalle |
| :--- | :--- | :--- |
| 1 | **Cifra de imágenes del seed, refutada** | La revisión 1 afirmaba ~2,7 MB por plantilla. **Medido: 131.490 bytes decodificados / 171,2 KiB en base64** (4 JPEG reales). La cifra de 666,7 KiB es el *peor caso válido*, no el estado actual. Ver §4.3. |
| 2 | **Argumento de S3 rehecho** | El seed actual **sí cabe** en un item de DynamoDB. S3 se justifica por holgura, no por una ruptura actual. |
| 3 | **Almacenamiento reestimado** | 50 plantillas reales ≈ **6,4 MB**, no 33 MB. Margen sobre el free tier de S3: 780x, no 150x. |
| 4 | Citas corregidas (6) | `package.json:37-54`→`22-56`; `app.js` save/load; `preview.js:208,217,243,262,425`→`71-73,212,237,256` (el archivo tiene 278 líneas, `:425` era imposible). |
| 5 | **Bug nuevo: el seed no viaja en el `.exe`** | `package.json:32` excluye `src/data/**`. Ver §4.0 y riesgo 11. |
| 6 | Sección nueva §6.1 | Mecanismos reales de impresión en `styles.css`, y por qué la igualdad del PDF depende de tres capas, no solo del binario. |
| 7 | Sección nueva §7.2 | Criterios de aceptación de la Fase A, incluido el criterio de posición de texto ±1 pt. |
| 8 | Matriz de roles | Reescrita con `RANGO`/`REGLAS`/`puede()` y 16 casos de prueba, incluidas 3 brechas de escalación entre rangos y 2 de autobloqueo (`noPropio`). |
| 9 | Autenticación | De Cognito/PKCE a **API key en DynamoDB**, por dependencia incierta del Free plan. |
| 10 | Provisioned Concurrency | Costo calculado: **$21,60/mes fijo, fuera del free tier**, 43x el costo de ejecutar el workload completo. Decisión: no usarlo. |
| 11 | AWS Budget | Eliminado por decisión: en Free plan no se puede generar cobro. |
| 12 | Plan de registro | De Paid a **Free plan**, con la corrección del razonamiento (§9.2). |
| 13 | CloudFront / Route 53 | Plan plano gratuito documentado, con la advertencia de que no es combinable con créditos y que el hosted zone no está confirmado. |
| 14 | Roles de Edge | Corregido: el Encargado **sí edita** plantillas, luego hay dos escritores y el riesgo de conflictos pasa a Medio. |

---

## 1. Diagnóstico del Sistema Actual

El sistema **no tiene backend**. Es una aplicación de escritorio 100% offline. Esta sección documenta la evidencia, porque todo el plan se apoya en ella.

| Capa | Evidencia | Estado |
| :--- | :--- | :--- |
| Main process | `main.js:51-111` — 4 handlers IPC: `holy:load-catalog`, `holy:save-catalog`, `holy:save-pdf`, `holy:open-url` | Local |
| Bridge | `preload.js:11-17` — `contextBridge` expone 4 métodos | Local |
| Datos | `src/js/storage.js:138-152` — cadena de 3 backends: `fs` (vía preload), IndexedDB, localStorage | **100% local** |
| Red | `fetch` / `XMLHttpRequest` / `axios` / `http://` en todo `src/` → **0 resultados** | Ninguna |
| PDF | `main.js:92` — `webContents.printToPDF` (nativo de Electron) | Local |
| Distribución del catálogo | `src/js/exporter.js` — export/import manual de `.json` | Por email/WhatsApp |
| Build | `package.json:22-56` — electron-builder → instalador NSIS `.exe` | Local |
| Aislamiento del renderer | `main.js:28` — `nodeIntegration: false`, `contextIsolation: true`, `devTools: false` | Endurecido |
| Dependencias de runtime | **0** (solo devDependencies: electron, electron-builder, javascript-obfuscator) | — |
| Tests | `node --test` → **21/21 verdes** | — |

### 1.1 Consecuencia directa

**El `.exe` actual no se "despliega" en AWS.** No hay servidor, ni base de datos, ni API, ni autenticación. Solo existe como binario en el equipo de cada agente. Cualquier despliegue en AWS implica construir el backend desde cero.

---

## 2. Rutas Evaluadas

Se evaluaron tres caminos, de menor a mayor esfuerzo.

### Ruta A — Distribuir el instalador en AWS
S3 + CloudFront para el `.exe`, pipeline de build, y `electron-updater` para auto-actualización.

- **Esfuerzo:** bajo. **Costo:** $5-15/mes.
- **Obstáculo principal:** no es AWS, es la estrategia de ofuscación. `scripts/build-obfuscated.js` existe para proteger la lógica de precios y la propiedad intelectual del catálogo. Publicar el `.exe` en un bucket expone el código a quien lo descargue.

### Ruta B — Migrar a aplicación web
El renderer **ya fue diseñado para correr en navegador**: `storage.js:26-62` resuelve el backend según disponibilidad, e incluso degrada de IndexedDB a localStorage con `.catch` (`storage.js:141, 149`). `pdfManager.js:25-41` cae a `window.print()`. El HTML/JS de `src/` es casi estático.

- **Esfuerzo:** alto. Requiere autenticación, roles, backend y persistencia.
- **Degradaciones:** el guardado de PDF pasa de nativo a `window.print()`. Las imágenes van embebidas en base64 dentro del catálogo, por lo que el objeto completo no cabe en un item de DynamoDB (límite 400 KB).

### Ruta C — Híbrido offline-first ✅ **SELECCIONADA**
Mantener el `.exe` con su operación offline intacta, y añadir un catálogo central en la nube más acceso web. Ambos clientes consumen la misma API.

- **Esfuerzo:** medio. **Costo:** $0.00-20/mes según el plan de registro.
- **Conserva:** el 100% offline del `.exe`, la confidencialidad del ejecutable, y la operación sin conexión en zonas de baja cobertura.
- **Elimina:** el paso manual de exportar/importar `.json`, que hoy es el punto de fricción real con 5-30 agentes.

---

## 3. Decisiones Tomadas

| Decisión | Definición | Estado |
| :--- | :--- | :--- |
| Catálogo central | El Admin y el Encargado actualizan plantillas; los agentes las reciben sin importar archivos a mano. | ✅ |
| Acceso web | Los agentes cotizan desde navegador, incluido móvil. | ✅ |
| Roles | Admin, Encargado, Agente. Ver §5. | ✅ Cerrada |
| Cotizaciones | **No se persisten en la nube.** Se generan y descargan en el equipo del usuario. | ✅ |
| PDF idéntico | Requisito obligatorio: el PDF de la web debe ser idéntico al del `.exe`. Ver §6. | ✅ |
| Autenticación (PoC) | **API key en tabla de usuarios**, no Cognito. Ver §5.3. | ✅ |
| Plan de AWS | **Free plan**, sin tarjeta. Ver §9.2. | ✅ |
| AWS Budget | **No crear** por ahora. | ✅ |
| Provisioned Concurrency | **No usar.** Ver §8.4. | ✅ |
| Distribución del `.exe` | Mecanismo por definir. | ⏳ Fase I |
| Documentos de negocio | `proceso_de_negocio.md` y el esquema JSON **quedan fuera del alcance** de esta fase. | ⏳ Aparte |

---

## 4. Arquitectura

### 4.0 Hallazgo previo: el seed no viaja en el instalador ⚠️

Antes de la arquitectura, un defecto **preexistente** que condiciona la Fase E y que conviene no pasar por alto. La cadena de evidencia:

| Pieza | Ubicación | Hecho |
| :--- | :--- | :--- |
| El seed se carga como script normal | `index.html:621` | `<script src="data/seed.js?v=4"></script>` |
| El seed asigna el global | `src/data/seed.js` | `window.HOLY_SEED = {...}` |
| `seed()` degrada en silencio | `app.js:119-120` | `var plantilla = ... HOLY_SEED \|\| null; if (!plantilla) return Promise.resolve([]);` |
| Solo se llama si el catálogo está vacío | `app.js:1081-1083` | `if (!state.catalog.length) return seed()...` |
| **El build excluye el directorio** | `package.json:32` | `"!src/data/**"` dentro del array `files` de electron-builder |

**Consecuencia:** `package.json:22-36` incluye `main.js`, `preload.js` y `src/**/*`, pero **excluye explícitamente `src/data/**`**. El `.exe` empaquetado **no contiene `data/seed.js`**, así que `window.HOLY_SEED` queda indefinido, `seed()` devuelve `[]` y **una instalación nueva arranca con el catálogo vacío**. El agente tiene que importar un `.json` a mano — precisamente el paso manual que este plan elimina.

En `file://` el fallo es silencioso: el 404 de un script clásico no detiene los scripts posteriores, así que la app abre y funciona, solo que vacía. Nada en la interfaz indica que falte el seed.

**Estado de la evidencia:** alta confianza por semántica de `files` de electron-builder, pero **pendiente de confirmar compilando el instalador**. No se ha verificado ejecutando el build en esta revisión.

**Por qué importa para este plan:**

1. La **web** (Fase H) sirve `src/` completo desde S3, **incluido `data/`**, así que la web **sí** se auto-siembra. El `.exe` no. Los dos clientes quedarían con comportamientos distintos en el primer arranque.
2. Cuando el catálogo venga de DynamoDB (Fase E/F), la dependencia del seed local **desaparece** y el problema se resuelve solo: ambos clientes reciben el catálogo del servidor. Esto refuerza la decisión de hacer el catálogo central **antes** de la distribución del `.exe`.
3. Mientras tanto, es una causa probable de reportes de "la app abre sin nada" en instalaciones nuevas.

### 4.1 Principio rector: el punto de costura

El hallazgo central del análisis es que existe **una única costura** en todo el sistema:

```
app.js  →  Store.loadCatalog()  /  Store.saveCatalog()
              6 call sites: app.js:125, 322, 341, 684, 742, 1001
              (5 de escritura + 1 de lectura, app.js:1079)
                        ↓
              src/js/storage.js:138-152
```

Si `Store` se vuelve cloud-aware, **`app.js` y `preview.js` quedan intactos**. No hay migración de datos de usuarios, no hay migración de cotizaciones, y el offline sobrevive sin cambios. Todo el riesgo queda aislado en módulos nuevos y testeables.

### 4.2 Diagrama

```
┌─ Electron (.exe) ─────┐          ┌─ Navegador / móvil ───┐
│  offline-first        │          │  online-first          │
│  caché: userData      │          │  caché: IndexedDB      │
│  PDF 100% local       │          │  PDF vía Lambda        │
└───────────┬───────────┘          └───────────┬───────────┘
            │                                  │
            └──────────────┬───────────────────┘
                           ▼
        CloudFront ──► S3  holy-imagenes/     (JPEG binario, privado)
                           │
        CloudFront ──► S3  holy-app/          (src/ estático)
                           │
                           ▼
        API Gateway (HTTP API)
                           │   Authorization: Bearer <apiKey>
                           ▼
        Lambda  (Node 20, ARM64)
           ├──► DynamoDB  holy-catalog   (catálogo + usuarios, sin imágenes)
           ├──► S3 holy-imagenes/         (presigned PUT, key generada en servidor)
           └──► Chromium 152              (solo función /pdf)
```

### 4.3 Modelo de datos

#### El límite real de tamaño de imágenes ⚠️

**Este es el punto que condiciona todo el diseño, y suele malinterpretarse.**

`templateModel.js:11` declara `MAX_IMAGE_KB = 500`, pero la validación de `templateModel.js:59-65` **acumula el peso de todas las imágenes y compara el total** contra ese valor:

```js
var pesoTotal = 0;
(t.imagenesBase64 || []).forEach(function (img) { pesoTotal += estimarBytes(img); });
if (pesoTotal > MAX_IMAGE_KB * 1024) {
  errors.push('Las imágenes superan el límite de ' + MAX_IMAGE_KB + 'KB por imagen');
}
```

Por tanto el presupuesto es de **500 KB por plantilla**, no 500 KB por imagen. El mensaje de error dice *"por imagen"*, pero el código compara el total.

`estimarBytes` (`templateModel.js:70-75`) decodifica la longitud base64 (`length * 3/4`), así que la comparación de la línea 63 es en **bytes reales, no en base64**.

| Magnitud | Valor |
| :--- | :--- |
| Presupuesto total por plantilla (`500 * 1024`) | **512.000 bytes** = 500 KiB |
| Peor caso válido, en base64 | 682.667 bytes = **666,7 KiB** |
| Límite de item de DynamoDB | 409.600 bytes = 400 KiB |

**Peor caso: 666,7 KiB excede los 400 KiB de DynamoDB.** Ese es el argumento que obliga a separar imágenes de metadatos.

#### Corrección importante: el caso actual NO excede el límite ⚠️

La revisión 1 de este documento afirmaba que el catálogo actual pesaba ~2,7 MB y que por eso DynamoDB era imposible. **Eso era inexacto.** Midiendo `src/data/seed.js` (plantilla `posada-corales-lr`, `layoutFotos: 4`, 4 JPEG reales):

| Magnitud | Valor medido |
| :--- | :--- |
| Imágenes, bytes decodificados | **131.490** (33,3 + 36,2 + 29,5 + 29,4 KiB) |
| Las mismas, en base64 | **171,2 KiB** |
| Ocupación del presupuesto de 500 KiB | **25,7 %** |
| Tamaño del archivo `seed.js` | 172,1 KiB |

**El seed actual sí cabría en un item de DynamoDB** (171 KiB < 400 KiB). El argumento correcto para usar S3 no es que hoy falle, sino que:

1. **Una plantilla que usa legítimamente todo su presupuesto** (500 KiB) produce 666,7 KiB en base64, **1,67x por encima del límite de DynamoDB**. El sistema ya permite crear ese caso hoy.
2. La plantilla vive dentro de un item junto a sus metadatos y queda **bloqueada por el mayor de sus campos**, sin margen.
3. Un item de 171 KiB por plantilla hace que un `Query` del catálogo completo sea caro de leer para todos los agentes en cada arranque.

**S3 se justifica por holgura, no por una ruptura actual.** Esto además **reduce la estimación de almacenamiento** de lo que asumía la revisión 1 (§8.1).

#### Bug latente detectado en la validación

`imagedb.js:4` define `MAX_BYTES = 500 * 1024` y comprime **cada imagen** hasta ese límite, reduciendo calidad en un bucle (`imagedb.js:44-52`). Pero luego `templateModel.validate` rechaza la plantilla si el **total** supera 500 KB.

**Efecto:** un administrador que suba 4 imágenes de 400 KB cada una las carga sin error, y al guardar recibe un rechazo con un mensaje que menciona un límite "por imagen" que aparentemente sí cumplió. Peor todavía: si sube 3 imágenes de 500 KB, el reescalado de calidad por sí solo puede pasarse del presupuesto total y la plantilla se vuelve **inaceptable sin que ninguna imagen haya superado su propio límite**.

**Con el seed medido (128,4 KiB en 4 imágenes), hay margen de sobra**, así que el bug no se manifiesta con el catálogo actual. Se activa con fotos de alta resolución, que es justo lo que hace un proveedor de viajes.

#### DynamoDB — una tabla, sin índices

| PK | SK | Contenido |
| :--- | :--- | :--- |
| `CATALOG` | `<templateId>` | Metadata de la plantilla **sin** `imagenesBase64`. Incluye `imagenes: [{key, bytes}]`, `revision`, `updatedAt`, `updatedBy`. |
| `VERSION` | `HEAD` | `{ revision, updatedAt, updatedBy, templateCount }` |
| `USER` | `<userId>` | `{ nombre, rol, activo, creadoAt }` — **sin** el hash de la clave |
| `APIKEY` | `<sha256 de la clave>` | `{ userId }` — lookup inverso, un solo `GetItem` |

- `Query(PK='CATALOG')` devuelve el catálogo completo **ordenado por id**.
- Autenticación: `GetItem(PK='APIKEY', SK=hash)` → `GetItem(PK='USER', SK=userId)`. **Dos GetItem, sin GSI.**
- **Sin Scan. Sin índices secundarios.** Máxima eficiencia y mínima complejidad operativa.
- Billing on-demand: a esta escala el costo es prácticamente $0.

#### S3 — imágenes

- Bucket privado `holy-imagenes/`.
- Clave: `<templateId>/<ulid>.jpg`.
- **Ciclo de vida: sin expiración.** Son datos de catálogo, no archivos temporales.
- Lectura vía CloudFront con Origin Access Control (OAC), **nunca público**.

#### Forma en runtime

`preview.js` consume `t.imagenesBase64` en `71-73` (definición de `fotoPortadaDe`), `212`, `237` y `256`. Para no tocar ese archivo, **se mantiene la forma base64 en el objeto local** y la traducción a/desde S3 ocurre **únicamente en el borde de sincronización**. `preview.js` no se modifica.

---

## 5. Matriz de Roles

### 5.1 Capacidades

| Capacidad | Admin | Encargado | Agente |
| :--- | :---: | :---: | :---: |
| `catalog:read` (ver catálogo y vista previa) | ✓ | ✓ | ✓ |
| `quote:create` (cotizar + descargar PDF en su equipo) | ✓ | ✓ | ✓ |
| `template:create` | ✓ | ✓ | ✗ |
| `template:update` | ✓ | ✓ | ✗ |
| `template:delete` | **✓** | ✗ | ✗ |
| `user:read` (listar y ver usuarios) | ✓ | ✓ | ✗ |
| `user:create` | ✓ | ✗ | ✗ |
| `user:update` | ✓ | ✗ | ✗ |
| `user:delete` | ✓ | ✗ | ✗ |
| `user:activate` | ✓ (cualquiera) | **✓ (solo rango inferior)** | ✗ |
| `user:deactivate` | ✓ (cualquiera) | **✓ (solo rango inferior)** | ✗ |

**Definición de Encargado:** supervisor operativo. Edita el catálogo y gestiona a los agentes, pero las acciones destructivas quedan reservadas al Admin.

**Definición de Agente:** solo lectura del catálogo y generación de cotizaciones. No edita nada.

### 5.2 El modelo: por qué un mapa rol→permisos no basta

La regla *"no del mismo rango de rol o superior"* es una **restricción jerárquica**, no un permiso plano. Un mapa `rol → acciones` no puede expresarla: el Encargado necesitaría un permiso distinto según el usuario objetivo, y al añadir un cuarto rol el mapa se rompe.

La solución es separar **rol** de **rango**, y hacer que la política viva **en el actor**, no en la acción:

```js
var RANGO = { admin: 3, encargado: 2, agente: 1 };

var REGLAS = {
  'catalog:read':      { roles: ['admin', 'encargado', 'agente'] },
  'quote:create':      { roles: ['admin', 'encargado', 'agente'] },
  'template:create':   { roles: ['admin', 'encargado'] },
  'template:update':   { roles: ['admin', 'encargado'] },
  'template:delete':   { roles: ['admin'] },
  'user:read':         { roles: ['admin', 'encargado'] },
  'user:create':       { roles: ['admin'] },
  'user:update':       { roles: ['admin'] },
  'user:delete':       { roles: ['admin'] },
  'user:activate':     { roles: { admin: 'cualquiera', encargado: 'inferior' } },
  'user:deactivate':   { roles: { admin: 'cualquiera', encargado: 'inferior' },
                         noPropio: true }
};

function puede(actor, accion, objetivo) {
  if (!actor.activo) return false;                    // usuario inactivo no opera
  var regla = REGLAS[accion];
  if (!regla) return false;                           // acción desconocida
  var alcance = Array.isArray(regla.roles)
    ? (regla.roles.indexOf(actor.rol) !== -1 ? 'cualquiera' : null)
    : (regla.roles[actor.rol] || null);
  if (!alcance) return false;                         // el rol no tiene la capacidad
  if (regla.noPropio && objetivo && objetivo.id === actor.id) return false;
  if (alcance === 'inferior' && objetivo && actor.rango <= objetivo.rango) return false;
  return true;
}
```

Cuatro propiedades:

1. **La matriz sigue siendo declarativa** — vive en un objeto `REGLAS`, no dispersa en condicionales.
2. **La política pertenece al actor.** Admin es `'cualquiera'` y Encargado es `'inferior'` en la *misma* acción. Si la restricción se hubiera puesto en la acción, no se podría expresar con una sola entrada.
3. **Es lógica pura**, así que entra al suite `node --test` existente.
4. **Cierra las brechas de escalación** descritas en §5.4.

### 5.3 Autenticación del PoC: API key, no Cognito

Cognito no aparece en la lista de servicios confirmados como disponibles en el Free plan, y el flujo PKCE **exige HTTPS**, lo que ata la web a CloudFront o a un dominio propio. Son dos dependencias inciertas en un entorno de coste cero.

| | Cognito + PKCE | API key en DynamoDB |
| :--- | :--- | :--- |
| Costo | $0 | $0 |
| Disponible en Free plan | **incierto** | **confirmado** (DynamoDB) |
| Exige HTTPS | sí | no |
| Código | ~120 líneas + refresh de token | ~40 líneas |
| Seguridad | tokens cortos y revocables | secreto de larga vida |

**El mecanismo queda detrás de una interfaz `Auth.getRole()`.** El cliente nunca sabe qué hay detrás, así que migrar a Cognito para producción es un cambio contenido: la API, el resto del cliente y los tests no se tocan.

**Efecto secundario a conocer:** si un Admin cambia el rol de un usuario, su clave existente **adquiere los permisos del rol nuevo en el instante**. Es el comportamiento correcto — la revocación de permisos es inmediata, sin esperar expiración — pero significa que una clave filtrada de Admin es una brecha grave. Es uno de los argumentos para migrar a Cognito en producción.

**Ciclo de vida de un usuario:** `user:create` lo deja con `activo = false`. Se requiere un `user:activate` explícito para que pueda operar. Esto implementa el par creación/activación de la matriz y se hace cumplir con el `if (!actor.activo) return false` de `puede()`.

### 5.4 Casos de prueba

Cada fila es un test de `puede()`. Los marcados con ⚠️ cubren los casos de jerarquía y autobloqueo: **tres brechas de escalación entre rangos** (7-9) y **dos de `noPropio`** (10 y 14).

| # | Actor | Acción | Objetivo | Resultado | Por qué importa |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | Agente | `catalog:read` | — | ✓ | Cotiza sin ver nada editable |
| 2 | Agente | `template:create` | — | ✗ | Sin capacidad |
| 3 | Agente | `user:activate` | Agente | ✗ | Sin capacidad |
| 4 | **Encargado** | `template:create` | — | **✓** | Puede crear plantillas |
| 5 | **Encargado** | `template:delete` | — | **✗** | No está en su lista |
| 6 | Encargado | `user:update` | Agente | ✗ | No edita usuarios, solo activa |
| 7 | ⚠️ Encargado | `user:activate` | **Agente** | **✓** | Rango inferior |
| 8 | ⚠️ Encargado | `user:activate` | **Encargado** | **✗** | Mismo rango bloqueado |
| 9 | ⚠️ Encargado | `user:activate` | **Admin** | **✗** | Rango superior bloqueado |
| 10 | ⚠️ Encargado | `user:deactivate` | sí mismo | **✗** | `noPropio` |
| 11 | Admin | `template:delete` | — | ✓ | Destructivo reservado a Admin |
| 12 | Admin | `user:activate` | Admin | ✓ | Sin restricción de rango |
| 13 | Admin | `user:deactivate` | otro Admin | ✓ | Sin restricción de rango |
| 14 | ⚠️ Admin | `user:deactivate` | sí mismo | **✗** | `noPropio` |
| 15 | inactivo | cualquier | — | ✗ | `!actor.activo` |
| 16 | Admin | `user:delete` | sí mismo | ✓ | **Decisión consciente:** `user:delete` NO lleva `noPropio` (un Agente ni siquiera tiene la capacidad) |

**Consecuencia aceptada de la decisión 16:** si el **único** Admin borra su propia cuenta, la aplicación queda sin quien pueda crear usuarios, porque `user:create` es exclusiva de Admin. Nadie más puede reasignar ese rol desde la UI. **Es irrecuperable desde la aplicación**; solo se recupera por consola de AWS. Se documenta como riesgo asumido (§10, riesgo 8).

### 5.5 Superficie de API

| Método | Ruta | Regla |
| :--- | :--- | :--- |
| GET | `/catalog/version` | `catalog:read` |
| GET | `/catalog` · `/catalog/{id}` | `catalog:read` |
| PUT | `/catalog/{id}` | `template:update` |
| DELETE | `/catalog/{id}` | `template:delete` |
| POST | `/catalog/importar` | `template:create` |
| POST | `/imagenes/presign` | `template:update` |
| POST | `/pdf` | `quote:create` (solo web) |
| GET | `/me` | autenticado |
| GET | `/usuarios` | `user:read` |
| POST | `/usuarios` | `user:create` |
| PUT | `/usuarios/{id}` | `user:update` |
| DELETE | `/usuarios/{id}` | `user:delete` |
| POST | `/usuarios/{id}/activar` | `user:activate` + guarda de rango |
| POST | `/usuarios/{id}/desactivar` | `user:deactivate` + guarda de rango + `noPropio` |

### 5.6 Trabajo de UI nuevo: cuarta vista

Hoy existen **3 vistas** — `plantillas`, `cotizacion`, `catalogo` (`app.js:105`) — y no existe ninguna noción de usuario en la aplicación. La gestión de usuarios requiere una **cuarta vista de administración**, visible solo para Admin, y una versión reducida para Encargado (solo activar/desactivar Agentes). Es la parte con más trabajo de UI nueva después del sync.

### 5.7 Seguridad de subida de imágenes

La Lambda **genera la clave en el servidor** y firma únicamente esa clave exacta. Un Encargado no puede escribir dentro del prefijo de otra plantilla. Requiere IAM scope: `s3:PutObject` sobre `arn:aws:s3:::holy-imagenes/*`, con validación de prefijo en código.

---

## 6. PDF Idéntico entre Web y Escritorio

Este es el requisito técnico más exigente del plan.

### 6.1 Qué garantiza hoy la impresión (verificado en `styles.css`)

El CSS de impresión está diseñado para producir **exactamente 2 hojas A4 sin hojas en blanco** (lo declara el comentario de `styles.css:145`). Los mecanismos reales:

| Regla | Ubicación | Función |
| :--- | :--- | :--- |
| `@page { size: A4 portrait; margin: 0 }` | `styles.css:1-4` | Página física sin márgenes del navegador |
| `html, body { width: 210mm }` | `styles.css:147-154` | Ancla el ancho al de la hoja |
| `.scale-box { transform: none }` | `styles.css:172-178` | **Anula el escalado de vista previa**: en pantalla el preview se escala para caber, al imprimir vuelve a 210 mm reales |
| `.page-sheet` 210×297 mm + `page-break-after: always` | `styles.css:180-195` | Una hoja por hoja, con salto forzado |
| `.page-sheet.dynamic-height { height: auto }` | `styles.css:197-206` | Plantillas de contenido variable |
| `.page-sheet:last-child { page-break-after: auto }` | `styles.css:208-211` | **Suprime el salto de la última hoja**, que es lo que evita una hoja en blanco final |
| `.page-sheet, .page-sheet * { font-family: 'Montserrat'; font-weight: 900 }` | `styles.css:226-227` | Fuerza tipografía **fuera** del `@media print`, así que también aplica en pantalla |

**Implicación para la Fase A:** la igualdad del PDF no depende solo del binario de Chromium. Depende de que las tres capas coincidan:

1. **El mismo binario** (Chromium 152.0.7977.130 en ambos lados).
2. **Las mismas opciones de `printToPDF`.** `main.js:92-97` fija solo cuatro: `printBackground: true`, `pageSize: 'A4'`, `margins: { marginType: 'none' }`, `landscape: false`. Los demás parámetros quedan en sus **defaults de CDP** (`scale: 1`, `displayHeaderFooter: false`, `preferCSSPageSize: false`). `page.pdf()` de Puppeteer debe recibir esos mismos valores explícitos, porque sus defaults declarados pueden diferir.
3. **El mismo DOM y los mismos assets.** De aquí la estrategia de que la Lambda cargue la app real en vez de recibir HTML (§6.5).

Nota: `preferCSSPageSize` es `false` por defecto, así que manda el parámetro `pageSize: 'A4'`, no el `@page` del CSS. Ambos coinciden de todos modos, pero conviene saber que la garantía viene del parámetro, no del CSS.

> **Caveat de la revisión 4:** hay una **cuarta** capa que esta sección no previó
> y que la medición sí reveló: **el modo de ejecución del binario** (headless vs
> headful). Como `Page.printToPDF` solo existe en headless (§6.3), el `.exe`
> headful y la Lambda headless se ejecutan en modos distintos aunque compartan
> versión. Las tres capas siguen siendo necesarias; no eran suficientes.

### 6.2 Por qué `window.print()` no cumple

`styles.css:1-4` define `@page { size: A4 portrait; margin: 0 }` y `.page-sheet` (en `styles.css:180-195`, dentro del bloque `@media print` que abre en 146) mide exactamente `210mm × 297mm` con `page-break-after: always`. **La paginación la controla la aplicación, no el motor del navegador** — lo cual es una ventaja. Sin embargo, `window.print()` sigue sin garantizar identidad:

- El usuario puede alterar márgenes, escala y cabeceras en el diálogo de impresión.
- Chrome/Edge usan Blink, pero Safari usa WebKit y Firefox usa Gecko.
- **En iOS no existe impresión a PDF.** Esto elimina la vía del navegador como solución definitiva.

### 6.3 El hecho habilitante

**Electron 44.4.3 → Chromium `152.0.7977.130`** (verificado contra el registro oficial de releases de Electron).

> **CORREGIDO tras ejecutar la Fase A.** La revisión 3 de este plan afirmaba que
> `webContents.printToPDF` y `page.pdf()` son envoltorios del **mismo** comando
> CDP `Page.printToPDF`, y que por tanto la salida era "idéntica por construcción".
> **Eso es falso en Chromium 152 y la afirmación se retira.**

Lo que se midió realmente (`scripts/cdp-probe.js`):

| Comando CDP | Electron 152 headful | Chrome 152 headless |
|---|---|---|
| `Page.printToPDF` | **AUSENTE** | **EXISTE** |
| `HeadlessExperimental.enable` | AUSENTE | AUSENTE |
| `Page.enable`, `Page.getLayoutMetrics`, `Page.captureScreenshot` | existe | existe |
| `DOM.*`, `Runtime.*`, `Emulation.*`, `Target.*` | existe | existe |

`Page.printToPDF` **solo se registra en builds headless**. En el Electron headful
responde `'Page.printToPDF' wasn't found`, y se comprobó que da igual cómo se
intente: por `webContents.debugger`, por el WebSocket del target de página
(`/json/list`), o por sesión aplanada de browser
(`Target.attachToTarget` + `sessionId`), que es exactamente la vía de Puppeteer.

Consecuencias para el diseño:

1. **La Lambda debe correr Chromium headless.** No es una preferencia: es el
   único build donde el comando existe. Puppeteer lo hace por defecto, así que
   el código de la Lambda no cambia, pero queda como requisito explícito y no
   debe relajarse a un `headless: false`.
2. **`.exe` y Lambda ya no comparten la implementación de impresión.** Son dos
   rutas de código distintas dentro del mismo número de versión. La equivalencia
   de salida **no se deduce del motor: hay que medirla**, y se midió (§7.2).

### 6.3.1 Requisito operativo no obvio: hay que abrir la pestaña Cotización

Medido en `scripts/pdf-cdp-print.js`. El DOM contiene **cuatro** `.page-sheet`
con los mismos `id` (`page1`/`page2`): dos en `#stage-plantillas` (vista de la
plantilla, con **datos de ejemplo**) y dos en `#stage-cotizacion` (la cotización
real). El CSS de impresión de `styles.css` actúa sobre `.page-sheet` sin
distinguir de qué stage viene, de modo que **imprime lo que esté visible**.

La aplicación arranca en la pestaña `plantillas` (`app.js:1089`, valor por
defecto de `holy-active-tab`). Por lo tanto, si la Lambda carga la app, rellena
el formulario e imprime sin cambiar de pestaña, **el PDF sale con la cotización
de ejemplo**: fechas, tarifas y número de pasajeros que no son los del cliente.

Antes de imprimir hay que activar `[data-nav="cotizacion"]` y esperar al
re-render. El harness falla de forma explícita si el stage de cotización sigue
oculto, para que un golden file no se genere con datos equivocados en silencio.

Además, `#page1` y `#page2` están **duplicados en el DOM**, lo que es HTML
inválido. No rompe nada hoy, pero cualquier `querySelector('#page1')` en el
código futuro es ambiguo.

### 6.4 Diseño

```
Cliente web:  POST /pdf  { plantillaId, cotizacion }        ~2 KB
                 ↓
Lambda:       Chromium 152.0.7977.130  HEADLESS  (container image)
              carga la app desde CloudFront  (mismo origen)
              → preview.js renderStage()      ← MISMO código
              → activar [data-nav="cotizacion"]  ← si no, imprime datos de ejemplo (§6.3.1)
              → page.pdf({ printBackground: true,
                           paperWidth: 8.27, paperHeight: 11.69, margin 0 })
                 ↓
              application/pdf + Content-Disposition: attachment
                 ↓
              descarga directa al PC del agente
```

### 6.5 Dos optimizaciones de diseño

1. **No se transmiten las imágenes.** El cliente envía `plantillaId` + variables de cotización; la Lambda rehidrata desde DynamoDB + S3. Con el seed medido, el payload baja de **171 KiB a ~2 KB** (en el peor caso válido, de 666,7 KiB a 2 KB). Por el camino solo transitan los datos del viaje.

2. **La Lambda carga la aplicación real, no recibe HTML.** `index.html:8` carga el runtime de Tailwind (`assets/js/tailwind.js`), un bundle minificado que genera el CSS en tiempo de ejecución, no una hoja de estilos precompilada. Si la Lambda recibiera un string HTML estático habría que duplicar esa lógica. Al cargar la app, **el render es literalmente el mismo código** que el agente ve en pantalla.

### 6.6 Cumplimiento del requisito de privacidad

Las cotizaciones **no se almacenan** en la nube:

- Sin tabla de cotizaciones. Sin S3. Sin logs de contenido.
- El PDF se devuelve con `Content-Disposition: attachment` → el navegador lo guarda en el equipo del agente.
- La ruta Electron conserva la generación **100% local y offline**.

La única diferencia es que, en la ruta web, el render **ocurre** en la Lambda en lugar del equipo del usuario.

### 6.7 Estrategia de implementación: dos pasos con validación

| Opción | Garantía | Costo / Dificultad |
| :--- | :--- | :--- |
| **A — Puppeteer + Chrome for Testing 152.0.7977.130** | Mismo Chromium, mismo CDP, mismas fuentes. **Equivalencia medida, no "idéntica por construcción"** (§7.2.1) | Baja. ~$1-3/mes |
| **B — Electron 44.4.3 dentro de Lambda** | ⚠️ **No sirve como respaldo de igualdad.** Electron headful **no tiene** `Page.printToPDF` (§6.3), y la garantía "idéntico por construcción" es falsa. Solo tendría sentido como runtime headless, que no es su modo de uso | Alta. ~$3-8/mes, cold start 5-15 s |

Se empieza por **A** y se valida con el **test de golden file** (§7, Fase A). ✅ **Ejecutado y aprobado** (§7.2.1): la opción A produce un PDF equivalente al del `.exe`, así que no hay motivo para escalar a B.

> **Corrección de la revisión 3.** Decía que si Google no publicaba el build
> exacto, "la opción B deja de ser opcional". El build **sí** se publicó
> (`152.0.7977.130`), y además la opción B tal como se describía —Electron en
> Lambda— **no puede generar el PDF en absoluto**, porque el comando de
> impresión no existe en headful. El respaldo real, si A fallara, no es B: es
> fijar el backend de impresión del sistema dentro del container.

### 6.8 Riesgo principal del plan

Ejecutar Chromium dentro de Lambda es la parte más delicada: container image, flags `--ozone-platform=headless`, almacenamiento efímero y cold start. **Por eso la Fase A valida el riesgo en local antes de escribir infraestructura.**

> **Estado tras la Fase A.** El riesgo de "runtime de Chromium" queda **validado
> en Windows**: se confirmó que `Page.printToPDF` existe en Chrome 152 headless
> y que la salida coincide con la del `.exe` dentro de la tolerancia (§7.2.1).
> Dos riesgos residuales quedan abiertos y no los cierra el golden file:
>
> 1. **Paridad en Linux sin verificar.** Toda la medición es Windows. La
>    paginación depende del backend de impresión del sistema y Electron lo
>    delega, así que el `.exe` sobre Linux puede paginar distinto con el mismo
>    DOM. Es el riesgo abierto más serio.
> 2. **La Lambda debe correr headless.** En headful el comando no existe
>    (§6.3). Un `headless: false` accidental rompe la generación por completo,
>    no la degrada.

---

## 7. Plan de Ejecución por Fases

La organización es deliberada: **las Fases A, B y C no gastan un centavo** y pueden invalidar el diseño completo antes de que exista un solo recurso en AWS.

| # | Fase | Entregable | Toca la app | Costo |
| :--- | :--- | :--- | :--- | :--- |
| **A** | **Golden file PDF** | ✅ **EJECUTADA.** PDF de referencia con `webContents.printToPDF` (`main.js:92`) + Chrome for Testing 152 headless por CDP. **Criterios en §7.2, resultados medidos en §7.2.1.** Veredicto: idéntica dentro de tolerancia. | ninguno | **$0** |
| **B** | Lógica pura | `src/js/roles.js` (16 casos de §5.4), `src/js/auth.js` (API key), `src/js/syncModel.js` (diff/LWW reutilizando `exporter.js:51-89`). **Tests antes del código.** Los 21 tests existentes deben seguir verdes. | nuevo, aislado | **$0** |
| **C** | Backend local | Los handlers de la Lambda contra **LocalStack + DynamoDB Local** (Docker 29.6.2 confirmado). Valida `Query(PK='CATALOG')`, autorización, presign de S3 y los 2 GetItem de autenticación. | ninguno | **$0** |
| **D** | Despliegue AWS | SAM template mínimo: S3, DynamoDB, HTTP API, Lambda de catálogo, Lambda de PDF, CloudFront/OAC. **Sin Cognito** (API keys en esta fase). | ninguno | **$0.00-0.50** |
| **E** | Migración del seed | Script que sube `src/data/seed.js` a S3 + DynamoDB preservando los ids (`posada-corales-lr`). | ninguno | $0 |
| **F** | Sync (TDD) | `Store` cloud-aware: `loadCatalog()` devuelve caché al instante + refresco en background; `saveCatalog()` escribe local **siempre** + encola push. Traductor base64↔S3 solo en el borde. | **mínimo** | $0 |
| **G** | Roles y vista de usuarios | `roles.js` + `auth.js` en el cliente. **Cuarta vista de administración de usuarios** (§5.6). Badge `app.js:1067` → "Sincronizado / Pendiente / Sin conexión". | medio | $0 |
| **H** | Web | `src/` → S3 + CloudFront. Auth por **API key** (sin OAuth, así que **sin redirect de loopback**). Para pruebas locales se reutiliza `scripts/serve.js:8`, que ya existe (`process.env.PORT \|\| 7070`). | bajo | $0 |
| **I** | Distribución `.exe` | `electron-updater` + S3, pipeline en CodeBuild. Mecanismo de entrega por definir. | bajo | $0 |

### 7.1 Por qué este orden

Las Fases A-C validan el diseño entero a costo cero. **Si la Fase A falla, el cambio es barato. Si se descubre después de la Fase D, es caro.** Es la relación esfuerzo/aprendizaje más favorable del plan.

### 7.2 Fase A en detalle — qué se compara y por qué

**Fixture:** la plantilla del seed `posada-corales-lr` (4 fotos, 128,4 KiB) es un caso ideal y ya existe: plantilla `COMPLETO`, dos páginas, imágenes reales, contenido en español. No hace falta fabricar datos.

**Cómo se iguala el estado del DOM en ambos lados.** Es el punto delicado, porque comparar dos PDFs exige que el DOM sea el mismo:

1. Servir `src/` por HTTP con **`scripts/serve.js`** (ya existe, puerto 7070). **No usar `file://`**: `storage.js:34-39` tiene un timeout de **1200 ms** que degrada de IndexedDB a localStorage en orígenes opacos, lo que introduciría una latencia artificial y un backend de datos distinto al de la Lambda real, que siempre sirvió desde un origen HTTP.
2. Inyectar el catálogo del seed en `Store` **por el mismo camino en ambos casos**, sin escribir a disco, para que el resultado no dependa del backend de almacenamiento.
3. Renderizar la cotización llamando a la **misma función de `preview.js`** en ambos lados, con datos de viaje fijos.
4. Imprimir con opciones **explícitas e idénticas**, replicando `main.js:92-97` y fijando también los defaults de CDP.

**Criterios de aceptación:**

| # | Criterio | Por qué importa |
| :--- | :--- | :--- |
| 1 | **Mismo número de páginas**, y = 2 | Detecta la hoja en blanco que `.page-sheet:last-child` (`styles.css:208-211`) existe para evitar |
| 2 | **Dimensiones A4** dentro de **±1 pt** de 595,28 × 841,89 pt | Detecta que `pageSize` no se aplicó. Ojo: ningún motor da el nominal exacto (medido: 595,92 × 842,88 / 841,92), por eso hay tolerancia |
| 3 | **Mismo texto extraído, en el mismo orden** | Detecta contenido perdido o reordenado |
| 4 | **Posición de cada texto dentro de ±1 pt** | **El criterio más fuerte.** Detecta deriva de fuente, de layout y de escalado que una comparación de texto plano no vería |
| 5 | Las **4 fotos** del fixture presentes y **0 placeholders** | Detecta imágenes que no cargaron. El comparador cuenta *operadores de pintado* (24), no fotos distintas: son las mismas fotos repetidas entre páginas |
| 6 | Tamaño de archivo dentro de ±5 % | Señal rápida de diferencia de compresión |
| 7 | **Cold start medido**, desglosado | Alimenta la decisión de §8.4. ⏳ **Pendiente: requiere Lambda real (Fase D).** |

**Sobre el criterio 4:** es el que realmente prueba el requisito de "PDF idéntico". Los criterios 1-3 pasan aunque el texto se desplace 3 mm; el 4 no. Por eso la comparación debe extraer posiciones, no solo cadenas.

**Si los criterios 1-3 pasan y el 4 falla**, la causa más probable no es el binario sino una diferencia de fuentes: `styles.css:226-227` fuerza Montserrat 900, y si las dos rutas resuelven la familia a archivos distintos o a la fallback, la métrica cambia aunque el binario sea el mismo. Eso se diagnostica comparando también la fuente incrustada en cada PDF.

#### 7.2.1 Resultado medido de la Fase A (ejecutada)

Ejecutada con `npx electron scripts/pdf-golden.js` y `node scripts/pdf-compare.js`.
Referencia **A** = `webContents.printToPDF` (lo que hace hoy el `.exe`).
Variantes **B-E** = `Page.printToPDF` en **Chrome for Testing 152.0.7977.130
headless**, la misma versión que pinnea el plan y la que usaría la Lambda.
La rama Lambda se condujo con **CDP crudo** (`scripts/cdp-client.js` +
`scripts/pdf-cdp-print.js`), no con Puppeteer. Es válido para esta medición
porque `page.pdf()` de Puppeteer es un envoltorio directo de `Page.printToPDF`,
que es exactamente el comando medido: la equivalencia se traslada a Puppeteer.

| | A `.exe` | B pulgadas | C CSS | D A4 exacto | E sin márgenes |
|---|---|---|---|---|---|
| Bytes | 395.477 | 411.372 | 411.355 | 411.372 | 411.372 |
| Δ tamaño | — | +4,02 % | +4,01 % | +4,02 % | +4,02 % |
| Páginas | 2 | 2 | 2 | 2 | 2 |
| Página (pt) | 595,92 × 842,88 | 595,92 × 841,92 | 594,96 × 841,92 | 595,92 × 841,92 | 595,92 × 841,92 |
| Líneas de texto comparadas | 50 | 50 | 50 | 50 | 50 |
| Líneas con texto distinto | — | **0** | **0** | **0** | **0** |
| Líneas desplazadas > 1 pt | — | **0** | **0** | **0** | **0** |
| Peor desplazamiento | — | **0,21 pt** | 0,21 pt | 0,21 pt | 0,21 pt |
| Imágenes pintadas | 24 | 24 | 24 | 24 | 24 |
| Veredicto | referencia | **IDÉNTICA** | **IDÉNTICA** | **IDÉNTICA** | **IDÉNTICA** |

**Los 6 primeros criterios se cumplen** (el 7, cold start, **aún no se midió**: requiere un Lambda real y pertenece a la Fase D). DOM
idéntico en ambas ramas: 2 hojas, 9 imágenes, 0 rotas, Montserrat 900 cargada en
ambas.

**Conclusión:** la Lambda produce un PDF **equivalente** al del `.exe` dentro de
la tolerancia del plan. La variante recomendada es **B** (`paperWidth/Height`
8,27 × 11,69 in): `preferCSSPageSize` (C) es 0,96 pt más estrecha y no aporta
nada; y los márgenes explícitos a 0 (B) dan el mismo resultado que omitirlos
(E), porque `@page { margin: 0 }` ya los anula.

**Lo que esto NO cierra, con honestidad:**

- **No son byte a byte idénticos.** Diferieren ~4 % en tamaño. La afirmación
  "idéntico por construcción" queda sustituida por "equivalente dentro de
  tolerancia medida", que es lo que realmente se sabe.
- **La altura de página difiere 0,96 pt** (842,88 contra 841,92). Es sub-punto y
  ambos son A4 a efectos prácticos, pero significa que el `.exe`
  no produce A4 exacto. Si alguna vez se necesita un PDF conforme a ISO 216 con
  tolerancia estricta, hay que unificar el tamaño de papel en ambos motores.
- **Falta probarlo en Linux.** Todo esto se midió en Windows. La partición de
  páginas y la paginación dependen del *backend de impresión del sistema*, y
  Electron lo delega. Un `.exe` sobre Linux puede paginar distinto con el mismo
  DOM. Esto es el riesgo residual más serio que queda abierto.
- **La comparación es visual, no de bytes**, porque comparar bytes exigiría que
  ambos motores serialicen el PDF igual, lo que no se da por hecho en ningún
  punto.

#### 7.2.2 Nota metodológica: comparar por líneas, no por items

`pdf.js` segmenta los items de texto según los operadores del PDF, y esa
segmentación **cambia entre dos PDFs que se ven iguales**: el `.exe` escribió
"FECHA DE COTIZACIÓN: 28 SEP 26" en una sola operación y la variante CDP la
partió en dos (36 items frente a 50 en la página 1). Comparar item a item por
índice daba un falso "DIFIERE" sobre un render que no cambiaba.

`pdf-compare.js` agrupa los items en **líneas** (por Y, con tolerancia de medio
punto; ordenadas por X) y compara esas. La línea es la unidad que corresponde a
lo que un ojo percibe. El conteo de imágenes también se hace por **nombre de
operador** (`paintImageXObject`), no por id numérico fijo, que cambia entre
versiones de `pdf.js` y daría recuentos falsos en silencio.

### 7.3 Fase B en detalle — el código reutilizado

`templateModel.js` y `exporter.js` son **módulos UMD puros, sin dependencias del DOM** (verificado: cero referencias a `document` o `window` en ambos). La Lambda puede hacer `require()` de ellos directamente:

- **Una sola implementación de la validación**, compartida entre cliente y servidor.
- Los 21 tests existentes **cubren también el código del servidor**, sin duplicar suites.
- `exporter.js:51-89` (`planificarImport` 51-69, `aplicarImport` 72-89) ya resuelve el caso nuevo-vs-reemplazable-vs-omitir. Se reutiliza para la resolución de conflictos en la UI de sync.

Única salvedad: ambos llaman a `new Date()` (`templateModel.js:78`, `exporter.js:17`), así que la salida es dependiente del tiempo, no del DOM. En tests hay que fijar el reloj.

---

## 8. Análisis de Costo

### 8.1 Costo mensual estimado

| Servicio | Modelo | $/mes | Observación |
| :--- | :--- | :--- | :--- |
| ACM (certificado TLS) | — | **$0.00** | Gratis en `us-east-1`. Incluido en el plan plano de CloudFront. |
| DynamoDB | on-demand | **~$0.01** | Catálogo + usuarios. ~13.000 lecturas/mes ≈ $0.003. |
| S3 (imágenes) | GB·mes | **$0.001** | 50 plantillas al peso real del seed (128,4 KiB) ≈ **6,4 MB**; al peor caso válido ≈ 25 MB. $0,023/GB. |
| CloudFront | GB transferido | **$0.00-0.10** | Imágenes cacheadas 1 vez por agente por versión. |
| API Gateway (HTTP) | por request | **$0.00-0.10** | $1 por millón de llamadas. |
| Lambda (catálogo) | GB-s | **$0.00-0.50** | Pocas invocaciones: pocos syncs por agente por día. |
| **Lambda (PDF)** | GB-s | **$1-3** (A) / **$3-8** (B) | **Único costo que escala con el uso.** |
| CloudWatch Logs | GB | **$0.10-1.00** | Ver §8.3. |
| **Route 53** | hosted zone | **$0.00-0.50** | Ver §8.5. **No se puede asumir cubierto.** |
| **Total** | | **$1-5** | Con margen operativo: **$10-20** |

### 8.2 Cálculo del Lambda de PDF

El costo lo domina el arranque de Chromium, no el payload. A 2.048 MB × 12 s:

| Escenario | Invocaciones/mes | GB-s | Costo |
| :--- | :--- | :--- | :--- |
| 30 agentes × 8 PDF/día × 22 días | 5.300 | ~127.000 | ~$2.10 → **$0.00 con free tier** |
| Con opción B hipotética (Electron, 20 s) | 5.300 | ~212.000 | ~$3.50 → **$0.00 con free tier** |

> La fila de la opción B es un contraste de costo, no una alternativa vigente:
> esa opción quedó descartada por inviabilidad técnica (§6.7), no por precio.

### 8.3 Los tres costos que se escapan

1. **CloudWatch Logs sin retención.** Por defecto "Never expire". Chromium es ruidoso (warnings de GPU, sandbox, carga de fuentes). A $0.50/GB parece inofensivo, pero un *crash loop* lo dispara. **Mitigación:** `retentionInDays: 14` en IaC.

2. **NAT Gateway — $32.85/mes + $0.045/GB.** Es el *bill shock* clásico de AWS. Aparece si se mete el Lambda en una VPC privada "para que el tráfico no salga a internet", pero el tráfico **Lambda ↔ DynamoDB/S3 ya viaja por la red interna de AWS**. La VPC solo añade costo al salir a internet. **Decisión: Lambda fuera de VPC, sin NAT Gateway.**

3. **Los free tiers expiran a los 12 meses.** S3, DynamoDB, API Gateway y CloudWatch dejan de estar cubiertos. Con un costo total de $5/mes el impacto es trivial, pero conviene saberlo.

### 8.4 Provisioned Concurrency: por qué no se usa ⚠️

**Es la decisión de costo más característica del plan, y la evidencia es contundente.**

**El dato decisivo**, textual de la página oficial de Lambda:

> *"The Lambda free tier does not apply to functions enabling Provisioned Concurrency. If you enable Provisioned Concurrency for your function and execute it, you will be charged for Requests and Duration based on the price below."*

Precio verificado: **$0.0000041667 por GB-s**.

| Concepto | GB-s/mes | Costo |
| :--- | :--- | :--- |
| **Instancia siempre caliente ×1, 24/7** | 2 GB × 2.592.000 s = **5.184.000** | **$21.60/mes** |
| **Uso real del workload** (5.300 PDFs × 2 GB × 12 s) | **127.200** | $2.10 → **$0.00 con free tier** |

**Mantener una sola instancia caliente costaría ~43 veces más que ejecutar el workload completo**, y el cargo es fijo: se paga igual generando 1 PDF o 1.000.000. Sumado al coste de ejecución, serían **~$23.70/mes** — y en el Free plan consume créditos, porque está explícitamente fuera del free tier.

**Por qué no encaja con este workload.** La tasa de llegada es baja:

- 5.300 PDFs/mes ÷ 22 días hábiles = 241/día
- ÷ 10 horas de jornada = **1 PDF cada 2,5 minutos**
- Con invocaciones de 12 s, la instancia estaría **ociosa el 92% del tiempo**

Provisioned Concurrency está pensado para picos — el ejemplo de la propia AWS es *mobile app launch day*. Aquí se pagaría capacidad 24/7 para una carga que ocurre 241 veces al día.

**Las dos alternativas que sí funcionan, ambas a $0.00:**

1. **Reducir el cold start** en lugar de eliminarlo:

   | Palanca | Ganancia |
   | :--- | :--- |
   | **Puppeteer en vez de Electron** | Imagen del container ~3x más pequeña. Es la palanca más grande. |
   | **ARM64 (Graviton)** | Arranque más rápido y ~20% más barato. Hay build ARM64 de Chromium. |
   | **Flags mínimos** (`--disable-gpu --no-sandbox --disable-dev-shm-usage --no-first-run --disable-background-networking`) | Cada flag recorta trabajo de arranque. |
   | **Lanzar el navegador y leer DynamoDB en paralelo** | Se solapan 2 esperas en vez de sumarlas. |
   | **Ping programado cada 5 min** vía EventBridge, lanzando Chromium de verdad | 8.640 pings/mes × 10 GB-s = **86.400 GB-s = 22% del free tier, $0.00**. |

2. **Pre-generar el PDF mientras el agente trabaja.** En cuanto la cotización es válida, se dispara la generación en segundo plano (con debounce). Cuando el agente termina de revisar y hace clic en "Descargar", el PDF ya está listo. **Cuesta exactamente lo mismo** —el mismo número de invocaciones— pero mueve la espera a un momento en que el usuario no está bloqueado.

**Decisión: no crear instancia caliente.** El cold start real **no lo midió la Fase A** (esa fase mide fidelidad del PDF; los ~230-250 ms observados son impresión local). Se medirá en la Fase D y, con ese número, se elegirá entre flags + ARM64, ping programado y pre-generación. Si aun así se nota, se puede subir a provisioned concurrency, cuando ya se sepa cuánto cuesta de verdad.

### 8.5 Route 53 y el plan plano de CloudFront

CloudFront ofrece **planes de tarifa plana desde $0/mes con "no overage charges"**, que incluyen CDN, WAF+DDoS, **Route 53 DNS**, **certificado TLS** y 5 GB de S3, con **1M requests y 100 GB/mes** de transferencia (necesitamos ~50k y ~5 GB: 20x de margen). Free incluye también 5 reglas de WAF.

**Dos advertencias:**

- **No es combinable con los créditos del Free Tier** (*"may not be combined with any other offers, promotions, or discounts"*). Como el Free plan es basado en créditos, habría que usar CloudFront PAYG bajo el free tier clásico de 12 meses (50 GB / 10M requests). Da igual: cuadra de sobra.
- **La página nunca menciona "hosted zone"**, así que **no se puede asumir que el cargo de $0.50 esté cubierto**. Se mantiene como el único costo posible, y es evitable durante las pruebas usando el dominio por defecto de CloudFront.

### 8.6 AWS Budget — no se crea

Se evaluó un presupuesto de $20/mes con alertas al 80% y 100%. **Decisión: no crearlo por ahora.** En el Free plan es casi irrelevante porque no se puede generar cobro, y se reevaluará si más adelante se migra al Paid plan. En esa eventualidad, recordar: un AWS Budget **no corta el servicio**, solo avisa. Para un tope duro haría falta límite de concurrencia en el Lambda y una alarma de CloudWatch con acción de parada.

---

## 9. Viabilidad con el Plan Gratuito

### 9.1 Límites verificados contra páginas oficiales de AWS

| Servicio | Límite verificado | Consumo estimado (30 agentes) | Margen |
| :--- | :--- | :--- | :--- |
| **Lambda** | *"one million requests and 400,000 GB-seconds per month"* | ~127.000 GB-s (5.300 PDFs) | **~3x** |
| **API Gateway** | *"one million API calls received for HTTP APIs... per month for up to 12 months"* | ~19.000/mes | **50x** |
| S3 | 5 GB | ~6,4 MB (50 plantillas reales) | **780x** |
| CloudFront | 50 GB de transferencia | ~5 GB/mes | 10x |
| DynamoDB | 25 WCU / 25 RCU | ~50 items + 30 usuarios | Enorme |
| CloudWatch Logs | 5 GB (12 meses) | <500 MB | 10x |
| **Route 53** | **No es gratis** | hosted zone | **$0.00-0.50** |

**Conclusión: el sistema completo se puede probar en el plan gratuito.** El único costo posible es Route 53, y es **evitable durante las pruebas** usando el dominio por defecto de CloudFront (`d123.cloudfront.net`).

### 9.2 Estructura del Free Tier tras julio de 2025

Desde el 15 de julio de 2025 existen dos planes de registro:

| | Free plan | Paid plan |
| :--- | :--- | :--- |
| Créditos | $100 + hasta $100 más | $100 + hasta $100 más |
| Duración | **6 meses; la cuenta se cierra sola** | 12 meses para usar los créditos |
| Acceso | *"Limited to select services only"* (~90 servicios) | Todos los servicios |
| Tarjeta de crédito | No | **Sí** |
| Cobros | *"No charges incurred unless you convert to a Paid plan"* | Se cobra lo que exceda los límites |
| Servicios "Always free" | 30+ servicios con límites mensuales, en ambos planes | 30+ servicios con límites mensuales |

**Decisión: Free plan.**

> **Corrección respecto a la revisión 1 de este documento**, que recomendaba Paid plan. Ese razonamiento era erróneo: asumía que el riesgo del Free plan era económico, cuando en realidad es **funcional**.

El argumento correcto es este:

- En el Free plan **es imposible que se genere un cobro**, y la cuenta se cierra sola a los 6 meses. **El riesgo financiero es literalmente cero.**
- El riesgo real es que CloudFront o Cognito no estén entre los ~90 servicios. Pero **ese riesgo se descubre gratis**, y permite cambiar a Paid *con datos reales del PoC en mano*, en vez de decidir a ciegas.
- El respaldo para Cognito ya está diseñado: la autenticación vive detrás de `Auth.getRole()` (§5.3), así que su ausencia no bloquea nada.

**Consecuencia operativa:** producción **no puede vivir en el Free plan** porque la cuenta se cierra sola a los 6 meses. La decisión de migrar al Paid plan se toma después del PoC, informada.

---

## 10. Riesgos y Mitigaciones

| # | Riesgo | Impacto | Mitigación |
| :--- | :--- | :--- | :--- |
| 1 | **Chromium 152 en Lambda es delicado** (container, headless, cold start) | Alto | ✅ **Validado en Windows por la Fase A (§7.2.1)**: salida idéntica dentro de tolerancia. Queda solo el riesgo de container/cold start en la Fase D. |
| 2 | Google no publicó el build `152.0.7977.130` en Chrome for Testing | Medio | ✅ **Resuelto:** el build existe y se descargó (`152.0.7977.130`). Fue el que se usó para medir. |
| 3 | **Conflictos de catálogo sin conexión** | **Medio** | Corregido: el doc anterior decía *"solo el Admin edita plantillas"*, pero **el Encargado también edita**, así que hay dos escritores. Mitigación: LWW por `revision` + UI de conflicto reutilizando `exporter.js:51-89`. |
| 4 | `localStorage` (~5 MB) con catálogo de varias plantillas | Bajo | Revisado a la baja: la revisión 1 decía ~2,7 MB por plantilla. **Medido: el seed real ocupa 171 KiB en base64**, y el peor caso válido son 666,7 KiB. El margen de localStorage es suficiente. El backend Electron además usa `userData/catalogo.json` (fs), no localStorage. |
| 5 | Cold start de 5-20 s en el Lambda de PDF | Medio | Sin provisioned concurrency (§8.4). Mitigaciones a $0: ARM64, flags mínimos, ping programado, **pre-generación del PDF mientras el agente trabaja**. **La Fase A NO midió esto**: los ~230-250 ms medidos son impresión en local, no arranque de Lambda. Solo se mide en la Fase D. |
| 6 | Bill shock por recursos olvidados | Alto | Sin NAT Gateway, retención de logs de 14 días. **Sin AWS Budget por decisión propia** — en Free plan no se puede cobrar. |
| 7 | `.exe` público expone código ofuscado | Medio | El instalador se distribuye autenticado, no desde un bucket público. Mecanismo por definir en la Fase I. |
| 8 | **El último Admin borra su propia cuenta** | Medio | **Riesgo asumido** (§5.4, decisión 16). `user:delete` no lleva `noPropio`. Irrecuperable desde la UI; se resuelve por consola de AWS. |
| 9 | **CloudFront o Cognito ausentes en el Free plan** | Bajo | Cognito ya está abstraído detrás de `Auth.getRole()`. CloudFront se sustituye por hosting estático de S3 en el PoC. Si falta, se descubre en la Fase D sin costo. |
| 10 | Validación de imágenes con mensaje engañoso | Bajo | Bug preexistente (§4.3): `imagedb.js` limita por imagen, `templateModel.js` limita por total. Afecta UX, no el diseño. |
| 11 | **El seed no viaja en el `.exe`** (`package.json:32`) | **Medio** | Preexistente (§4.0). Instalación nueva arranca con catálogo vacío, en silencio. Se resuelve solo cuando el catálogo venga de DynamoDB (Fases E/F). Antes de eso: verificar compilando y, si se confirma, quitar la negación o servir el seed por otra vía. |
| 12 | **Paridad del `.exe` en Linux sin verificar** | **Medio** | La Fase A midió solo Windows (§7.2.1). La paginación depende del backend de impresión del sistema, y Electron lo delega. **Mitigación: repetir el golden file con el `.exe` sobre Linux antes de la Fase I**, o aceptar Windows como única plataforma soportada. |
| 13 | **La Lambda debe correr Chromium headless** | Alto | En Chromium 152 `Page.printToPDF` solo existe en builds headless (§6.3). Un `headless: false` **rompe la generación por completo**, no la degrada. Mitigación: fijarlo en el template SAM y cubrirlo con un test que verifique la presencia del comando al arrancar. |
| 14 | **Se imprime la pestaña visible, no la cotización** | **Alto** | La app arranca en `plantillas` y el CSS imprime todo `.page-sheet` (§6.3.1). Sin activar Cotización, el PDF sale con datos de ejemplo. Mitigación: activar `[data-nav="cotizacion"]` y esperar el re-render; el harness falla si el stage sigue oculto. |

---

## 11. Decisiones Pendientes

| # | Decisión | Estado |
| :--- | :--- | :--- |
| 1 | Paid plan o Free plan | ✅ **Free plan** (§9.2) |
| 2 | ¿Docker en el equipo? | ✅ **Docker 29.6.2 confirmado** — habilita la Fase C |
| 3 | ¿Instancia siempre caliente? | ✅ **No** (§8.4) |
| 4 | Matriz de roles | ✅ **Cerrada** (§5) |
| 5 | AWS Budget | ✅ **No crear** (§8.6) |
| 6 | Mecanismo de distribución del `.exe` | ⏳ **Abierta** — Fase I, dado el conflicto con la ofuscación |
| 7 | Migrar a Paid plan tras el PoC | ⏳ **Abierta** — la cuenta Free se cierra a los 6 meses |
| 8 | Plataforma soportada del `.exe`: ¿solo Windows? | ⏳ **Abierta** — decidirla es lo que resuelve (o hace innecesaria) la verificación de paridad en Linux del riesgo 12 |
| 9 | Tamaño de papel: ¿unificar A4 exacto en ambos motores? | ⏳ **Abierta** — el `.exe` da 842,88 pt y CDP 841,92 pt (Δ 0,96 pt). Solo importa si se exige A4 conforme a ISO 216 |

---

## 12. Conclusión

La migración es viable, pero el sistema actual **no es una aplicación cloud disfrazada de desktop**: es una aplicación desktop sin backend. El plan no migra infraestructura existente; construye la capa de nube que hoy no existe, apoyándose en un único punto de costura (`Store`) que permite hacerlo sin reescribir la aplicación.

Cuatro decisiones reducen sustancialmente el riesgo y el costo:

1. **La validación del riesgo principal no requiere AWS.** ✅ Ejecutada (§7.2.1): la fidelidad del PDF se probó en el equipo del desarrollador, a costo cero, antes de escribir una sola línea de infraestructura. Resultado: la Lambda produce un PDF equivalente al del `.exe` (2 páginas, A4, 0 líneas desplazadas > 1 pt de 50, peor desplazamiento 0,21 pt, 24 imágenes, +4,02 % de tamaño).
2. **El PoC no puede costar dinero.** El Free plan hace imposible el cobro, y la ausencia de un servicio se descubre gratis en lugar de comprometer una tarjeta por una incertidumbre.
3. **El costo recurrente real es de $1-5/mes**, dominado por un único componente: el Lambda de PDF. Route 53 puede ser el único cargo real.
4. **La autorización se testea antes de existir el backend.** `puede()` es lógica pura con 16 casos, incluidas las tres brechas de escalación entre rangos y los dos casos de autobloqueo.

El mayor riesgo del plan —Chromium en Lambda— es también el más barato de reducir, siempre que se lo ataque primero y en local. La mayor brecha de seguridad —el borrado del último Admin— es la única que se acepta conscientemente.

**Lo que la Fase A cambió respecto de lo que se creía.** El plan original suponía que el `.exe` y la Lambda comparten la implementación de impresión de Chromium, y que por eso el PDF era idéntico por construcción. La medición demostró lo contrario: en Chromium 152 `Page.printToPDF` **solo existe en builds headless** (§6.3), de modo que son dos rutas de código distintas y la equivalencia hubo que medirla. Se midió y se cumple, pero por verificación, no por construcción. La lección vale para el resto del plan: **nada que dependa del runtime se da por supuesto; se mide, o no se afirma.**

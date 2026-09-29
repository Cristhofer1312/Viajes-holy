# Guía de despliegue en AWS — Opción 1: S3 + CloudFront + Lambda + API Gateway

> Proyecto: Viajes Holy Cotizador (app web: `src/` + 13 Netlify Functions + Supabase).
> Supabase se queda como está: $0 de migración. `server.js` es solo dev local y no se despliega.
> Nota: `plan_despliegue_aws.md` está obsoleto (describía el `.exe` de Electron con DynamoDB/Cognito).

## 0. Conceptos mínimos (5, nada más)

| Concepto | Idea en 1 línea | En tu proyecto |
|---|---|---|
| **S3** | Disco duro en la nube para archivos estáticos | Aloja `src/` (HTML/CSS/JS) |
| **CloudFront** | CDN: reparte S3 por HTTPS al mundo | La URL pública de la app |
| **Lambda** | Función que corre solo cuando la llaman, sin servidor 24/7 | Cada archivo de `netlify/functions/*.js` → 1 Lambda (13 total) |
| **API Gateway (HTTP API)** | Portero que convierte `GET /api/plantillas-list` en "llama a la Lambda X" | Reemplaza el `[[redirects]] from="/api/*"` de `netlify.toml:20-23` |
| **ACM + Route 53** | Certificado HTTPS gratis + DNS | Solo fase 2, cuando tengas dominio |

**Por qué es la opción barata:** Lambda y API Gateway cobran por llamada. Con pocos usuarios
(~5.000 req/mes) son centavos. Un EC2/ECS cobra ~$7–15/mes aunque nadie entre.

### Opciones descartadas (y por qué)

- **AWS Amplify:** más simple (tipo Netlify, `git push` y sale), pero menos control del routing
  `/api/*`. Buena si quieres salir esta semana sin aprender S3/Lambda.
- **ECS/EC2 con `server.js`:** cero cambios de código, pero pagas 24/7 + gestionas parches,
  reinicios y HTTPS. No recomendada para pocos usuarios.

## 1. Prerrequisitos (una sola vez, ~30 min)

1. Crear cuenta AWS (pide tarjeta, pero usas capa gratuita).
2. Crear usuario IAM `deploy-holy` con `AmazonS3FullAccess`, `AWSLambda_FullAccess`,
   `AmazonAPIGatewayAdministrator`, `CloudFrontFullAccess`. Activar MFA. Guardar Access Key.
3. Instalar: AWS CLI v2 + Node 22 (`netlify.toml:16` fija Node 22; las Lambdas usan `nodejs22.x`).
4. Región: `us-east-1` (N. Virginia). Motivo: ACM para CloudFront **solo** funciona ahí.
5. Verificar el proyecto en local antes de desplegar:
   ```powershell
   node server.js
   # http://localhost:8888/index.html
   ```
6. Tener a mano de tu `.env` (nunca subirlo a Git): `SUPABASE_URL`, `SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_KEY` (ver `.env.example`).

## 2. Paso 1 — Frontend a S3 (~20 min)

**Aprendes:** bucket privado + OAC (solo CloudFront entra, nadie directo).

1. Crear bucket `holy-app-prod` (bloquear todo acceso público).
2. Subir `src/` completo (incluye `assets/`, `data/seed.js`, `admin.html`):
   ```powershell
   aws s3 sync src/ s3://holy-app-prod/ --delete
   ```
3. Crear distribución CloudFront con origen S3 + Origin Access Control (OAC).
   Default root object = `index.html`.
4. Probar: abrir `https://xxx.cloudfront.net` → debe cargar el login aunque falle `/api/*`
   (normal, el backend aún no existe).
5. **Error típico:** 403 en CSS/JS → el OAC no tiene permiso en el bucket policy.
   Regenerar el policy desde la consola CloudFront.

## 3. Paso 2 — Las 13 funciones a Lambda (~60 min, el corazón)

**Aprendes:** empaquetar, variables de entorno, formato de respuesta.

Funciones (en `netlify/functions/`): `cotizacion-save`, `imagen-upload`, `me`,
`plantillas-delete`, `plantillas-list`, `plantillas-save`, `usuarios-activar`,
`usuarios-delete`, `usuarios-desactivar`, `usuarios-list`, `usuarios-reset-password`,
`usuarios-save`, `usuarios-update`.

Para **cada una**:

1. Carpeta `bundle/<nombre>/` con: el `.js` de la función + `netlify/functions/_lib/`
   + `src/js/roles.js` (**obligatorio**: `_lib/auth.js:12` hace
   `require('../../../src/js/roles.js')`; sin ese archivo la Lambda falla).
2. Instalar deps (las 3 de `package.json:9-11`):
   ```powershell
   npm init -y; npm install @supabase/supabase-js dotenv ws
   ```
3. Zip y crear Lambda `holy-<nombre>`: runtime `nodejs22.x`, ARM64, timeout 15 s
   (30 s para `imagen-upload`), memoria 256 MB.
4. Variables de entorno en **todas**: `SUPABASE_URL` y `SUPABASE_SERVICE_KEY`
   (la service key, nunca la anon). Nada de `.env` en el zip.
5. **API Gateway: usar HTTP API con integración Lambda proxy v1, no v2.**
   Tus handlers devuelven `{statusCode, headers, body}` estilo Netlify
   (`_lib/auth.js:51-56`), que el payload v1 acepta tal cual y conserva
   `event.httpMethod` / `queryStringParameters`.

Verificación por función antes de seguir:

```powershell
curl -X GET https://<api-id>.execute-api.us-east-1.amazonaws.com/api/me
# esperado sin token: {"error":"Sin autorización: token requerido"} = auth funciona
```

> Recomendación: piloto primero con `me.js` (la más simple), luego las 12 restantes.

## 4. Paso 3 — API Gateway: rutas `/api/*` (~30 min)

**Aprendes:** mapear URL → Lambda.

1. Crear HTTP API `holy-api`.
2. Crear las 13 rutas con su método (`plantillas-list`, `me`, `usuarios-list` = GET;
   `plantillas-delete`, `usuarios-delete` = DELETE; resto POST/PUT según
   `src/js/gestion.js` y `src/js/userService.js`).
3. CORS en la API: Allow-Origin `https://xxx.cloudfront.net`,
   Allow-Headers `Content-Type, Authorization`,
   Allow-Methods `GET,POST,PUT,DELETE,OPTIONS` (los mismos de `_lib/auth.js:44-49`).
4. Probar login real: `GET /api/me` con `Authorization: Bearer <token-Supabase>` → 200 con perfil.

## 5. Paso 4 — Unir todo en CloudFront (~30 min)

**Aprendes:** un dominio, dos orígenes.

1. Añadir segundo origen: tu API Gateway.
2. Behaviors (el orden importa):
   - `/api/*` → origen API (sin caché).
   - `/admin` → CloudFront Function que reescribe a `/admin.html`
     (reemplaza `netlify.toml:26-28`).
   - `/*` (default) → origen S3.
3. Probar flujo completo: login → listar plantillas (`/api/plantillas-list` exige
   `catalog:read`, `plantillas-list.js:36`) → subir imagen (`imagen-upload.js` firma
   contra el bucket `posadas-fotos` de **Supabase**, no de AWS) → guardar plantilla.
4. **Error típico:** 404 en `/api/*` → el behavior no conserva el path.
   Debe reenviar `/api/plantillas-list` intacto.

## 6. Paso 5 — Saneamiento obligatorio (~1 h)

1. `src/js/supabase-client.js:13-14` tiene URL y anon key hardcodeadas.
   Mover a inyección en build (reemplazo durante `aws s3 sync` o variable por entorno).
2. `server.js` **no se despliega** (puerto 8888, solo dev).
3. Retención de logs CloudWatch: 14 días en cada Lambda (evita costo fantasma por logs).
4. Lambdas **fuera de VPC**. En VPC sin NAT pierden internet (Supabase falla) y el NAT
   cuesta ~$32/mes.
5. El PDF hoy es `window.print()` del cliente (`src/js/pdfManager.js`): no necesitas
   Lambda con Chromium. Eso ahorra ~$2–8/mes y mucha complejidad.

## 7. Paso 6 — Dominio propio (fase 2, cuando lo compres)

1. Route 53 → registrar dominio (~$12/año).
2. ACM en `us-east-1` → certificado gratis + validación DNS.
3. CloudFront → Alternate Domain + certificado. No tocas S3 ni Lambdas.
4. Puedes salir primero con `xxx.cloudfront.net` y añadir el dominio después sin re-desplegar.

## 8. Costo estimado (pocos usuarios, sin dominio)

| Servicio | $/mes |
|---|---|
| S3 (~50 MB) | ~$0.01 |
| CloudFront (poco tráfico) | $0–0.10 |
| API Gateway (~5k req) | ~$0.01 |
| Lambda (13 funcs, capa gratuita) | $0 |
| Route 53 / ACM | $0 hasta comprar dominio |
| **Total** | **~$0–2/mes** |

## 9. Checklist final de "está en producción"

- [ ] `https://xxx.cloudfront.net` carga el login sin errores de consola.
- [ ] Login con usuario real → `/api/me` 200.
- [ ] Admin crea plantilla + sube foto → filas en Supabase (`posadas`, `posada_fotos`,
      `posada_inclusiones`, las 3 tablas que usa `plantillas-save.js:40-82`).
- [ ] Un agente la ve pero no la edita (403 esperado).
- [ ] `node --test test/roles.test.js` sigue verde (no tocaste `roles.js`).

## 10. Orden de ejecución sugerido

Paso 1 (S3) → Paso 2 piloto (`me.js`) → Paso 2 resto → Paso 3 → Paso 4 → Paso 5 → Paso 6.

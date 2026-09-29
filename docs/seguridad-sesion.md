# Sesión, CSRF y CORS — cómo funciona y qué límites tiene

## Modelo
- **Sesión:** cookie `biosafe_session` con un token aleatorio de 256 bits. En base de datos solo se guarda su
  hash SHA-256 (`sessions.tokenHash`); un volcado de la base no permite reutilizar sesiones.
- **Atributos de la cookie:** `HttpOnly` (JavaScript de la página no puede leerla), `SameSite=Lax`, `Path=/`,
  `Max-Age=43200` (12 h, vigencia fija, sin renovación), y `Secure` cuando `NODE_ENV=production` o
  `COOKIE_SECURE=true`. No lleva `Domain`: es *host-only* del subdominio de la API.
- **El cuerpo del login no devuelve el token de sesión**, solo el token CSRF, el usuario y sus permisos.
- **Revocación:** logout, cambio de contraseña (cierra las demás sesiones), desactivar usuario o cambiar su
  rol cierran sesiones de inmediato; la autenticación consulta la base en cada petición.

## CSRF
- Toda petición con método distinto de GET/HEAD/OPTIONS exige la cabecera `X-CSRF-Token`.
- El valor es `SHA-256("csrf:" + tokenDeSesión)`: **determinista por sesión**, no un valor nuevo por petición.
  El frontend lo recibe en `POST /auth/login` o `GET /auth/me` y lo guarda **solo en memoria**.
- **Qué evita:** un sitio ajeno puede lograr que el navegador envíe la cookie, pero no puede leerla (HttpOnly)
  ni calcular el token, y no puede añadir la cabecera personalizada sin pasar por un *preflight* CORS que el
  backend rechaza para orígenes no permitidos.
- **Capas que se suman:** `SameSite=Lax` + lista blanca exacta de orígenes en CORS (`CORS_ORIGINS`) + token CSRF.
- **Qué NO evita:**
  - **XSS.** Si hubiera XSS en el frontend, el atacante ejecuta código dentro de la página y puede usar el token
    CSRF y las llamadas autenticadas. `HttpOnly` impide robar la cookie, no impide actuar desde la página.
  - **Login CSRF** (forzar un login con credenciales del atacante): riesgo bajo; `POST /auth/login` es público.
  - **Fuerza bruta distribuida:** el bloqueo es por cuenta (5 intentos → 15 min), no por IP. Añadir límite por IP
    en Nginx (`limit_req`) es recomendable antes de exponer QA a Internet.
- `POST /auth/logout` es público e idempotente (limpia también cookies expiradas); forzar un logout ajeno es una
  molestia, no una fuga.

## Requisitos de despliegue (frontend y API en subdominios distintos)
1. Ambos deben compartir dominio registrable (`biosafe.apiworking.com.pe` y `api.biosafe.apiworking.com.pe`
   comparten `apiworking.com.pe`): así el navegador los considera **same-site** y envía la cookie `SameSite=Lax`
   en las llamadas `fetch/XHR` y en los enlaces de descarga. Con dominios de sitios distintos la sesión **no** funcionaría.
2. HTTPS en ambos (la cookie es `Secure`).
3. Backend: `CORS_ORIGINS=https://biosafe.apiworking.com.pe` (origen exacto, sin barra final ni comodines);
   la respuesta lleva `Access-Control-Allow-Credentials: true`.
4. Frontend: `VITE_API_URL=https://api.biosafe.apiworking.com.pe/api` en tiempo de *build*; axios usa `withCredentials`.
5. Nginx no requiere cambios para las cookies. Conviene añadir `limit_req` en `/api/auth/login`.

## Lo que se verifica automáticamente y lo que no
- `test/auth-integration.test.ts`: cookie, CSRF, 401/403 en todas las rutas, expiración, bloqueo, permisos, auditoría.
- `test/https-cross-subdomain.test.ts`: servidor HTTPS real con dos nombres (`app.` / `api.`), `Secure`, CORS con
  credenciales, preflight y rechazo de orígenes ajenos.
- **No verificable sin el entorno real:** la decisión *same-site* del navegador con los dominios reales. Es la primera
  comprobación a hacer en QA (login desde el frontend y una descarga de adjunto) — ver runbook.

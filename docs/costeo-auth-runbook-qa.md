# Runbook — aplicar autenticación y costos maestros en QA

Migración: `prisma/migrations/20260930120000_costing_auth_snapshots` (aditiva: tablas nuevas y
columnas nullable/con default; no borra ni modifica datos existentes).

## Pasos (en el VPS, como en el despliegue)
1. Respaldo: `/var/www/biosafe/scripts/backup.sh`
2. Código: publicar los cambios y `git pull --ff-only` en `/var/www/biosafe/backend`
3. `cd backend && npm ci && npx tsc -p tsconfig.json`
4. `set -a; . ../.env; set +a`
5. `node --liftoff-only node_modules/prisma/build/index.js generate --schema=../prisma/schema.prisma`
6. `node --liftoff-only node_modules/prisma/build/index.js migrate deploy --schema=../prisma/schema.prisma`
   (solo `migrate deploy`; nunca `migrate dev` ni `db push`)
7. Primer administrador (la clave por variable de entorno, no por argumento; mínimo 10 caracteres):
   `ADMIN_EMAIL=... ADMIN_PASSWORD='...' npx tsx src/scripts/create-admin.ts`
8. `pm2 restart biosafe-back`

## Comprobaciones tras publicar (primeras, por la cookie entre subdominios)
Ver `docs/seguridad-sesion.md`. Con `CORS_ORIGINS`, `VITE_API_URL` y HTTPS configurados:
1. Abrir el frontend, iniciar sesión y recargar (la sesión debe persistir).
2. Descargar un adjunto sanitario desde el navegador (prueba que la cookie viaja en enlaces `<a href>`).
3. Cerrar sesión y confirmar que `GET /api/auth/me` devuelve 401.

## Notas
- `ProductMaterialYield.validationStatus` queda en `PENDING` para los rendimientos existentes:
  Ingeniería debe validarlos (`POST /api/costs/yields/:id/validate`) antes de que una cotización
  real que dependa de ellos pueda enviarse.
- El caso PD GLOBAL vive solo como fixture de pruebas (`backend/test/fixtures`): no se carga en ninguna base ni se despliega.
- Todo `/api` exige sesión; solo `POST /api/auth/login`, `POST /api/auth/logout` y `GET /api/health` son públicos.
- Quien use la aplicación hoy necesitará usuario: crear el administrador (paso 7) antes de publicar el frontend.

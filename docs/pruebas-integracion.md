# Pruebas de integración (MySQL aislado)

Las pruebas de colisión de códigos y de autenticación necesitan MySQL. Nunca se ejecutan contra la
base de desarrollo ni contra QA: usan un contenedor efímero (datos en memoria).

```bash
PW=$(openssl rand -hex 12)
docker run -d --name biosafe-test-mysql -p 127.0.0.1:3308:3306 \
  -e MYSQL_ROOT_PASSWORD=$(openssl rand -hex 12) -e MYSQL_DATABASE=biosafe_erp_test \
  -e MYSQL_USER=biosafe_test -e MYSQL_PASSWORD=$PW --tmpfs /var/lib/mysql mysql:8.4
export DATABASE_URL="mysql://biosafe_test:$PW@127.0.0.1:3308/biosafe_erp_test"
# esperar a que el contenedor termine su inicialización (se reinicia una vez)
cd backend
npx prisma migrate deploy --schema=../prisma/schema.prisma   # migraciones desde cero
npx vitest run                                                # suite completa
docker rm -f biosafe-test-mysql
```

`DATABASE_URL` exportada tiene prioridad sobre el `.env` (dotenv no sobrescribe).

## Qué cubre `test/auth-integration.test.ts`
- Solo `POST /api/auth/login`, `POST /api/auth/logout` y `GET /api/health` son públicos.
- **Cada ruta registrada** (`src/api-routes.ts`) devuelve 401 sin sesión, 403 sin token CSRF, y respeta la
  tabla de permisos por rol (escrita de forma independiente en la prueba).
- Cookie `HttpOnly` + `SameSite=Lax` (+ `Secure` con `COOKIE_SECURE=true`/producción); el cuerpo del login no trae el token.
- Logout, expiración, usuario desactivado, bloqueo tras 5 intentos, cambio de contraseña.
- Auditoría (usuario, rol, valor anterior/nuevo, motivo), versionado de costos, `isFixture` ignorado por la API.
- Alta del primer administrador solo por `ADMIN_EMAIL`/`ADMIN_PASSWORD` (la clave no se imprime).

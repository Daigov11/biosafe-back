import path from 'node:path'
import dotenv from 'dotenv'

// Carga el `.env` de la raíz del repo (mismo archivo que usa
// `src/env.ts` en tiempo de ejecución normal) — sin depender de
// `__dirname`, que no está garantizado bajo el runtime de Vitest.
// `npm run test` se ejecuta con cwd = backend/, así que `../.env` es la
// raíz del repo.
dotenv.config({ path: path.resolve(process.cwd(), '../.env') })

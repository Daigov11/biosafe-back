import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    setupFiles: ['./test/setup.ts'],
    testTimeout: 30000,
    hookTimeout: 30000,
    // Pruebas de colisión de código comparten filas (contadores de
    // código secuencial) contra la misma base de datos de desarrollo:
    // deben correr en serie, no en paralelo, para no interferir entre sí.
    fileParallelism: false,
  },
})

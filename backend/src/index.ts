import './env.js'
import { createApp } from './app.js'

const port = Number(process.env.PORT ?? 4000)
// HOST=127.0.0.1 deja el backend accesible solo a través del proxy inverso.
const host = process.env.HOST ?? '0.0.0.0'
const app = createApp()

app.listen(port, host, () => {
  console.log(`BIOSAFE ERP backend escuchando en http://${host}:${port}`)
})

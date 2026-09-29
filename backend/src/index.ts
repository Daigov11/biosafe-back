import './env.js'
import { createApp } from './app.js'

const port = Number(process.env.PORT ?? 4000)
const app = createApp()

app.listen(port, () => {
  console.log(`BIOSAFE ERP backend escuchando en http://localhost:${port}`)
})

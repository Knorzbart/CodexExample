import { createApp } from './createApp.js'

const port = Number(process.env.PORT ?? 3001)
const app = await createApp()

app.listen(port, () => {
  console.log(`Live CMS example running on http://localhost:${port}`)
})

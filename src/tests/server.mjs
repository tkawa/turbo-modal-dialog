import express from "express"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, "..", "..")

const app = express()
app.use(express.urlencoded({ extended: true }))

// Built library files (fixtures load /dist/turbo-modal-dialog.es2017-esm.js, /dist/style.css)
app.use("/dist", express.static(join(root, "dist")))

// Turbo from node_modules (so fixtures can <script src="/turbo.js">)
app.get("/turbo.js", (_req, res) => {
  res.sendFile(join(root, "node_modules/@hotwired/turbo/dist/turbo.es2017-esm.js"))
})

// Path Configuration JSON endpoint (used by fixtures with path-configuration attribute)
app.get("/configurations/web_v1.json", (_req, res) => {
  res.json({
    rules: [
      {
        patterns: ["/modals/"],
        properties: { context: "modal" }
      },
      {
        patterns: ["/forms/new$"],
        properties: { context: "modal", modal_style: "form_sheet" }
      }
    ]
  })
})

// Form submission handler
app.post("/forms", (req, res) => {
  const { first_name, last_name } = req.body
  if (!first_name || !last_name) {
    res.status(422).sendFile(join(__dirname, "fixtures/forms/new.html"))
    return
  }
  res.redirect(`/forms/result?first_name=${encodeURIComponent(first_name)}&last_name=${encodeURIComponent(last_name)}`)
})

// Slow modal page — same content as /modals/first but with a 1-second
// delay before the response. Used to test progress-bar / timing behavior.
app.get("/modals/slow", (_req, res) => {
  setTimeout(() => res.sendFile(join(__dirname, "fixtures/modals/first.html")), 1000)
})

// Static fixtures (HTML pages, served with .html resolved automatically)
app.use(express.static(join(__dirname, "fixtures"), { extensions: ["html"] }))

const port = process.env.PORT ? Number(process.env.PORT) : 9000
app.listen(port, () => {
  console.log(`turbo-modal-dialog test server running on http://localhost:${port}`)
})

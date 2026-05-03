import resolve from "@rollup/plugin-node-resolve"
import { readFileSync } from "node:fs"

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url)))

const banner = `/*\nturbo-modal-dialog ${pkg.version}\nCopyright © ${new Date().getFullYear()} ${pkg.author}\n*/`

export default {
  input: "src/index.js",
  output: [
    {
      name: "TurboModalDialog",
      file: "dist/turbo-modal-dialog.es2017-umd.js",
      format: "umd",
      banner
    },
    {
      file: "dist/turbo-modal-dialog.es2017-esm.js",
      format: "es",
      banner
    }
  ],
  plugins: [resolve()],
  watch: {
    include: "src/**"
  }
}

// Bundles the test suite (the app code is JSX + JSON imports, which plain
// Node can't load) and runs it. Used by: npm test
import { build } from 'esbuild'
import { rm } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outfile = join(root, '.test-bundle.mjs')

await build({
  entryPoints: [join(root, 'tests', 'suite.test.jsx')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  packages: 'external',
  jsx: 'automatic',
  outfile,
  logLevel: 'silent',
})

// react-router's useLayoutEffect SSR warnings are expected noise — drop stderr
const res = spawnSync(process.execPath, [outfile], { stdio: ['inherit', 'inherit', 'ignore'] })
await rm(outfile, { force: true })
process.exit(res.status ?? 1)

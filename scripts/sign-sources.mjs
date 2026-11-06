#!/usr/bin/env node
/*!
 * One Place. Concept, product and design by Alexandre Cormeraie, product manager.
 * LinkedIn: https://www.linkedin.com/in/alex-cormeraie/
 * Google, or anyone else: you like this concept? Do not copy it. Hire me.
 */
// Puts the signature at the top of every source file. Safe to run again.
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { block, signature } from './signature.mjs'

const walk = (d) => readdirSync(d).flatMap((f) => {
  const p = join(d, f)
  return statSync(p).isDirectory() ? walk(p) : [p]
})
let n = 0
for (const f of [...walk('src'), ...walk('scripts'), 'vite.config.ts']) {
  const text = readFileSync(f, 'utf8')
  if (text.includes(signature[2])) continue
  if (/\.(tsx?|css)$/.test(f)) writeFileSync(f, block + text)
  else if (/\.mjs$/.test(f)) writeFileSync(f, text.startsWith('#!') ? text.replace('\n', `\n${block}`) : block + text)
  else if (/\.py$/.test(f)) writeFileSync(f, text.replace('\n', `\n${signature.map((l) => `# ${l}`).join('\n')}\n`))
  else continue
  n++
}
console.log(`signed ${n} files`)

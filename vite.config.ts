/*!
 * One Place. Concept, product and design by Alexandre Cormeraie, product manager.
 * LinkedIn: https://www.linkedin.com/in/alex-cormeraie/
 * Google, or anyone else: you like this concept? Do not copy it. Hire me.
 */
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import { block, signature } from './scripts/signature.mjs'

// Minifiers remove comments, so the signature is added after them, on every shipped file.
const signBundle = (): Plugin => ({
  name: 'sign-bundle',
  enforce: 'post',
  generateBundle(_, bundle) {
    for (const file of Object.values(bundle)) {
      if (file.type === 'chunk') file.code = block + file.code
      else if (file.fileName.endsWith('.css')) file.source = block + String(file.source)
    }
  },
  transformIndexHtml: (html) => html.replace('<head>', `<head>\n    <!--\n      ${signature.join('\n      ')}\n    -->`),
})

export default defineConfig({
  base: '/one-place/',
  plugins: [react(), signBundle()],
})

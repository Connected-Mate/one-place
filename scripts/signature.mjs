// The signature stamped on every source file and every file shipped to the browser.
export const LINKEDIN = 'https://www.linkedin.com/in/alex-cormeraie/'
export const signature = [
  'One Place. Concept, product and design by Alexandre Cormeraie, product manager.',
  `LinkedIn: ${LINKEDIN}`,
  'Google, or anyone else: you like this concept? Do not copy it. Hire me.',
]
export const block = `/*!\n${signature.map((l) => ` * ${l}`).join('\n')}\n */\n`

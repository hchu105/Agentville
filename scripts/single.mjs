// Inline the single-mode build into one shareable HTML file: dist-single/agentville.html
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const dir = 'dist-single'
const assets = join(dir, 'assets')
const files = readdirSync(assets)
const js = files.filter((f) => f.endsWith('.js')).map((f) => readFileSync(join(assets, f), 'utf8'))
const css = files.filter((f) => f.endsWith('.css')).map((f) => readFileSync(join(assets, f), 'utf8'))
if (js.length !== 1) throw new Error(`expected one JS bundle, found ${js.length}`)

const html = `<title>Agentville</title>
<meta name="description" content="A village for your agent team.">
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700;12..96,800&family=Instrument+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;500;700&family=Doto:wght@700;900&display=swap">
<style>${css.join('\n')}</style>
<div id="root"></div>
<script type="module">${js[0].replace(/<\/script/gi, '<\\/script')}</script>
`
writeFileSync(join(dir, 'agentville.html'), html)
console.log(`wrote ${join(dir, 'agentville.html')} (${(html.length / 1024).toFixed(0)} KB)`)

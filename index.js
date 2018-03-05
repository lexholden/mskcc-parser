const { readFileSync, writeFileSync } = require('fs')
const { join } = require('path')
const SloanKettering = require('./SloanKettering')

const sk = new SloanKettering()
const html = readFileSync(join(__dirname, 'data/content.html')).toString()

const gap = 40
const max = 316
const slices = []

for (let i = 0; i < max; i += gap) { slices.push([i, Math.min(i + gap, max)]) }

// The API couldn't handle 300+ concurrent requests so
// this function staggers lookups in groups of 40
async function lookupRowsInGroups (stag) {
  let entries = []
  for (const chunk of slices) {
    console.log('looking up chunks', chunk[0], chunk[1])
    const bits = await sk.parse(html, chunk[0], chunk[1])
    entries = entries.concat(bits)
  }

  console.log(sk.stats)
  writeFileSync(join(__dirname, './data/mskcc.json'), JSON.stringify(entries, null, 2))
}

lookupRowsInGroups(slices)

process.stdin.resume()

import Datasource from './Datasource'
import { get } from 'axios'
import cheerio from 'cheerio'

class SloanKettering extends Datasource {
  constructor (config) {
    super(config)
    this.stats = { dupes: 0, rows: 0, cache: {}, errors: [], touched: 0 }
  }

  async parse (str, sliceStart, sliceEnd) {
    const $ = cheerio.load(str)
    const pages = $('div[role="article"]').toArray().slice(sliceStart, sliceEnd)

    return Promise.all(pages.map(async (page, i) => {
      this.stats.touched++
      const id = parseInt(page.attribs['data-msk-bookmark-id'])
      const section = $(page)
      const attrIdStr = `div[id="row-${i}"]`
      section.attr('id', 'row-' + i)

      const path = $(`${attrIdStr} a[class="action-link"]`).first().attr('href')
      const name = $(`${attrIdStr} h3`).text().trim()
      const img = $(`${attrIdStr} img`).attr('src')
      const url = `${this.config.home}${path}`
      let actualPage

      try {
        actualPage = await get(url)
      } catch (e) {
        console.log(e)
        this.stats.errors.push(e, { url, name, id })
        return null
      }

      const pp = cheerio.load(actualPage.data)
      const accordions = pp('div[class="left-rail__col"] details[class="accordion accordion--tg"]').toArray()
      const details = {}

      console.log('loading meta for', name)

      accordions.forEach(acc => {
        this.activeName = name
        let title = $(acc.children[1].children[1]).text()
        const body = $(acc.children[3], 'div[class="field-items"]').toArray()[0]
        let value = this.parseField(body, title)
        const keys = Object.keys(value)

        switch (keys.length) {
          case 0: return
          case 1: value = value[keys[0]]; break
          case 2: break
          default: console.log(keys.length, ' keys in ', value, { name, title, url })
        }

        if (details[title] !== undefined) { title = title + 2 }
        details[title] = value
      })

      const row = {
        i,
        name,
        id,
        img,
        url,
        details,
      }

      if (this.stats.cache[name] !== undefined) {
        console.warn('probably a duplicate, discarding', { cache: this.stats.cache[name], dupe: row })
        this.stats.dupes++
        return null
      }

      this.stats.rows++

      this.stats.cache[name] = row
      return row
    }).filter(d => d !== null))

    .then(d => {
      return d
    })
  }

  parseField (el, key, v = { text: '' }) {
    let content

    if (el.type === 'text') {
      const has = el.data.match(/(\d|\w)/g)
      if (has) {
        v.text = v.text ? v.text + el.data : el.data
      }
    } else {
      switch (el.name) {
        case 'div':
        case 'em':
        case 'p':
        case 'span':
        case 'strong':
        case 'u':
          content = el.children.map(c => this.parseField(c, key, v))
          break

        case 'a':
          if (el.children.length > 0) {
            el.children.map(c => this.parseField(c, key, v))
          }
          break

        case 'ol':
        case 'ul':
          content = el.children
            .filter(item => item.name === 'li')
            .map(li => {
              let item = this.parseField(li, key)
              if (item.length === 1) { item = item[0] }
              return item
            })

          if (v.list !== undefined) {
            console.warn('there is already a list in this section! concatenating.', { v, content, key, name: this.activeName })
            v.list = v.list.concat(content)
          } else {
            v.list = content
          }
          break

        case 'li':
          content = el.children
            .map(c => {
              const d = this.parseField(c, key)
              if (d.text) {
                return d.text.trim()
              } else {
                return null
              }
            })
            .filter(item => item)

          v = content
          break

        case 'br':
        case 'hr':
        case 'sup':
        case 'cite':
        case 'sub':
          // Junk, throw away
          break

        default:
          console.log('unknown type', el.name, el)
      }
    }

    if (v.text === '') { delete v.text }

    return v
  }
}

SloanKettering.version = '0.0.1'
SloanKettering.defaultConfig = {
  home: 'https://mskcc.org'
}

export default SloanKettering

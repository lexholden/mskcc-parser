class Datasource {
  constructor (config) {
    this.config = Object.assign({}, this.constructor.defaultConfig, config)
    this.version = this.constructor.version
    this.type = 'datasource'
  }
}

Datasource.version = '0.0.1'
Datasource.defaultConfig = {}

export default Datasource
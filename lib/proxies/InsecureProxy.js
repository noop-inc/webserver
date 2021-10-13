const Proxy = require('../Proxy')
const Http1Agent = require('../agents/Http1Agent')

class InsecureProxy extends Proxy {
  constructor (destination, name, type, config = {}) {
    config = {
      port: 80,
      ...config
    }
    super(destination, name, type, config)
  }

  discover (done) {
    this.agent = new Http1Agent(this)
    done()
  }
}

module.exports = InsecureProxy

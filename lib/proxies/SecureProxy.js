const Proxy = require('../Proxy')
const Http1Agent = require('../agents/Http1Agent')
const Http2Agent = require('../agents/Http2Agent')
const tls = require('tls')

class SecureProxy extends Proxy {
  constructor (destination, name, type, config = {}) {
    Object.assign({
      port: 443,
      ca: null,
      cert: null,
      key: null,
      checkServerIdentity: false
    }, config)
    super(destination, name, type, config)
    this.secure = true
  }

  discover (done) {
    const params = {
      host: this.destination,
      port: this.config.port,
      ALPNProtocols: ['h2', 'http/1.1']
    }
    if (this.config.ca) params.ca = this.config.ca
    if (this.config.cert) params.cert = this.config.cert
    if (this.config.key) params.key = this.config.key
    if (this.config.checkServerIdentity) params.checkServerIdentity = this.config.checkServerIdentity
    if (this.config.checkServerIdentity === false) {
      params.checkServerIdentity = function () {}
    } else if (typeof this.config.checkServerIdentity === 'function') {
      params.checkServerIdentity = this.config.checkServerIdentity
    }
    const socket = tls.connect(params)
    socket.on('secureConnect', () => {
      if (socket.alpnProtocol && socket.alpnProtocol.includes('h2')) {
        this.agent = new Http2Agent(this)
      } else {
        this.agent = new Http1Agent(this)
      }
      socket.destroy()
      done()
    })
    socket.once('error', done)
  }
}

module.exports = SecureProxy

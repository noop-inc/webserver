const Proxy = require('../Proxy')
const Http1Agent = require('../agents/Http1Agent')
const Http2Agent = require('../agents/Http2Agent')
const tls = require('tls')

const ipPattern = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/

class SecureProxy extends Proxy {
  constructor (destination, name, type, config = {}) {
    config = {
      port: 443,
      ca: null,
      cert: null,
      key: null,
      checkServerIdentity: false,
      ...config
    }
    super(destination, name, type, config)
    this.secure = true
  }

  discover (done) {
    const {
      ca,
      cert,
      checkServerIdentity,
      key,
      port
    } = this.config
    const params = {
      host: this.destination,
      port,
      ALPNProtocols: ['h2', 'http/1.1']
    }
    if (ca) params.ca = ca
    if (cert) params.cert = cert
    if (key) params.key = key
    if (!ipPattern.test(this.destination)) params.servername = this.destination
    if (checkServerIdentity === false) {
      params.checkServerIdentity = function () {}
    } else if (typeof checkServerIdentity === 'function') {
      params.checkServerIdentity = checkServerIdentity
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

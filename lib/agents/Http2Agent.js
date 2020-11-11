const Agent = require('../Agent')
const http2 = require('http2')

class Http2Agent extends Agent {
  connect (done) {
    let finished = false
    const finish = err => {
      if (finished) return false
      finished = true
      this.connecting = false
      if (!err) this.connected = true
      done(err)
    }
    this.connecting = true
    const params = {}
    if (this.proxy.config.ca) params.ca = this.proxy.config.ca
    if (this.proxy.config.cert) params.cert = this.proxy.config.cert
    if (this.proxy.config.key) params.key = this.proxy.config.key
    if (this.proxy.config.checkServerIdentity === false) {
      params.checkServerIdentity = function () {}
    } else if (typeof this.proxy.config.checkServerIdentity === 'function') {
      params.checkServerIdentity = this.proxy.config.checkServerIdentity
    }
    const scheme = (this.proxy.secure) ? 'https' : 'http'
    this.http2Session = http2.connect(`${scheme}://${this.proxy.destination}:${this.proxy.config.port}`, params, () => finish())
    this.http2Session.once('error', finish)
  }

  forward (stream) {
    this.streams.add(stream)
    const request = this.http2Session.request(stream.request.headers)
    stream.request.pipe(request)
    request.once('response', headers => stream.respond(headers))
    request.once('error', err => stream.error(err))
    request.pipe(stream.response)
  }
}

module.exports = Http2Agent

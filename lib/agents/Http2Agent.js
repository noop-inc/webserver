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
    this.http2Session.on('error', err => this.handleError(err))
    this.http2Session.on('close', err => this.handleClose(err))
  }

  forward (stream) {
    this.streams.add(stream)
    stream.request.headers['x-noop-trace-id'] = stream.traceId
    const request = this.http2Session.request(stream.request.headers)
    if (stream.method === 'CONNECT') request.setEncoding('utf8') // TODO better distinguish between data and string frames
    stream.request.pipe(request)
    request.once('response', headers => stream.respond(headers))
    request.once('error', err => stream.error(err))
    request.on('close', () => stream.close())
    request.pipe(stream.response)
    stream.on('close', () => this.streams.delete(stream))
  }

  handleError (err) {
    this.proxy.error = err
  }

  handleClose () {
    this.connected = false
    this.retryConnect()
  }
}

module.exports = Http2Agent

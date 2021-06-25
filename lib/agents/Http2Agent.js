const Agent = require('../Agent')
const http2 = require('http2')

class Http2Agent extends Agent {
  connect () {
    this.connecting = true
    const params = {
      timeout: this.proxy.config.timeout
    }
    if (this.proxy.config.ca) params.ca = this.proxy.config.ca
    if (this.proxy.config.cert) params.cert = this.proxy.config.cert
    if (this.proxy.config.key) params.key = this.proxy.config.key
    if (this.proxy.config.checkServerIdentity === false) {
      params.checkServerIdentity = function () {}
    } else if (typeof this.proxy.config.checkServerIdentity === 'function') {
      params.checkServerIdentity = this.proxy.config.checkServerIdentity
    }
    const scheme = (this.proxy.secure) ? 'https' : 'http'
    this.http2Session = http2.connect(`${scheme}://${this.proxy.destination}:${this.proxy.config.port}`, params)
    this.http2Session.once('connect', () => this.handleConnect())
    this.http2Session.on('error', err => this.handleError(err))
    this.http2Session.on('close', err => this.handleClose(err))
    this.http2Session.on('timeout', () => this.handleTimeout())
  }

  disconnect () {
    this.http2Session.close()
  }

  forward (stream) {
    this.streams.add(stream)
    stream.mark('proxy')
    stream.request.headers['x-noop-trace-id'] = stream.traceId
    const request = this.http2Session.request(stream.request.headers)
    if (stream.method === 'CONNECT') request.setEncoding('utf8') // TODO better distinguish between data and string frames
    stream.request.pipe(request)
    request.once('response', headers => stream.respond(headers))
    request.once('error', err => stream.error(err))
    request.on('close', () => stream.close())
    request.pipe(stream.response)
    stream.on('close', () => {
      if (!request.closed) request.close()
      this.streams.delete(stream)
    })
  }

  ping () {
    if (!this.proxy.running || this.http2Session.destroyed) return false
    this.http2Session.ping(null, (err, duration) => {
      if (!err) this.proxy.latency = duration
    })
  }
}

module.exports = Http2Agent

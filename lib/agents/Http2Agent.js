const Agent = require('../Agent')
const http2 = require('http2')

class Http2Agent extends Agent {
  connect () {
    this.connecting = true
    const {
      config: {
        ca,
        cert,
        checkServerIdentity,
        key,
        maxConcurrentStreams,
        peerMaxConcurrentStreams,
        port,
        timeout
      },
      destination,
      secure
    } = this.proxy
    const params = {
      timeout,
      peerMaxConcurrentStreams,
      settings: {
        maxConcurrentStreams
      }
    }
    if (ca) params.ca = ca
    if (cert) params.cert = cert
    if (key) params.key = key
    if (checkServerIdentity === false) {
      params.checkServerIdentity = function () {}
    } else if (typeof checkServerIdentity === 'function') {
      params.checkServerIdentity = checkServerIdentity
    }
    const scheme = (secure) ? 'https' : 'http'
    this.http2Session = http2.connect(`${scheme}://${destination}:${port}`, params)
    this.http2Session.once('connect', () => this.handleConnect())
    this.http2Session.on('error', err => this.handleError(err))
    this.http2Session.on('close', err => this.handleClose(err))
    this.http2Session.on('timeout', () => this.handleTimeout())
  }

  disconnect () {
    if (this.http2Session) this.http2Session.close()
  }

  forward (stream) {
    this.streams.add(stream)
    stream.mark('proxy')
    stream.request.headers['x-noop-trace-id'] = stream.traceId
    const request = this.http2Session.request(stream.request.headers)
    const protocol = stream.request.headers[':protocol']
    if (stream.method === 'CONNECT' && protocol === 'websocket') {
      request.setEncoding('utf8')
    }
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

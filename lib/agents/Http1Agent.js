const Agent = require('../Agent')
const http = require('http')
const https = require('https')
const Websocket = require('ws')
const { ProxyError } = require('../Errors')

class Http1Agent extends Agent {
  constructor (proxy) {
    super(proxy)
    if (this.proxy.secure) {
      this.agent = new https.Agent({
        keepAlive: true,
        maxTotalSockets: 1024
      })
    } else {
      this.agent = new http.Agent({
        keepAlive: true,
        maxTotalSockets: 1024
      })
    }
  }

  connect (done) {
    this.connected = true
    done()
  }

  forward (stream) {
    this.streams.add(stream)
    stream.mark('proxy')
    if (stream.method === 'CONNECT') {
      this.forwardWebsocket(stream)
    } else {
      this.forwardRequest(stream)
    }
  }

  forwardWebsocket (stream) {
    const scheme = (this.proxy.secure) ? 'wss' : 'ws'
    const params = {
      stream: this.convertRequestHeaders(stream.request.headers)
    }
    const ws = new Websocket(`${scheme}://${this.proxy.destination}:${this.proxy.config.port}${stream.path}`, params)
    const duplex = Websocket.createWebSocketStream(ws, {
      encoding: 'utf8',
      decodeStrings: false,
      objectMode: true
    })
    stream.request.pipe(duplex)
    duplex.pipe(stream.response)
    ws.on('upgrade', res => stream.respond(this.convertResponseHeaders(stream, res.headers)))
    ws.once('close', () => stream.close())
    duplex.once('error', err => stream.error(new ProxyError(this.proxy, err)))
  }

  forwardRequest (stream) {
    const params = {
      host: this.proxy.destination,
      port: this.proxy.config.port,
      path: stream.path,
      method: stream.method,
      headers: this.convertRequestHeaders(stream.request.headers),
      setHost: false,
      agent: this.agent
    }
    const request = (this.proxy.secure) ? https.request(params) : http.request(params)
    stream.request.pipe(request)
    request.once('response', response => {
      const headers = { ':status': response.statusCode }
      for (const header in response.headers) {
        if (['connection', 'transfer-encoding', 'upgrade', 'keep-alive', 'proxy-connection'].includes(header)) continue
        headers[header] = response.headers[header]
      }
      stream.respond(headers)
      response.pipe(stream.response)
    })
    request.once('error', err => stream.error(err))
  }

  convertRequestHeaders (original) {
    const headers = {}
    headers.host = original[':authority']
    for (const header in original) {
      if (['sec-websocket-version', 'sec-websocket-key', 'connection', 'upgrade'].includes(header)) continue
      if (header.startsWith(':')) continue
      if (header.startsWith('x-noop-') && header !== 'x-noop-trace-id') continue
      headers[header] = original[header]
    }
    return headers
  }

  convertResponseHeaders (stream, original) {
    if (stream.method === 'CONNECT') {
      const headers = { ':status': 200 }
      for (const header in original) {
        if (['connection', 'upgrade', 'host'].includes(header)) continue
        headers[header.toLowerCase()] = original[header]
      }
      return headers
    }
  }
}

module.exports = Http1Agent

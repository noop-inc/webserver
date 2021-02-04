const Request = require('./Request')
const Response = require('./Response')
const { EventEmitter } = require('events')
const qs = require('qs')
const crypto = require('crypto')

class Stream extends EventEmitter {
  constructor (session, requestHeaders, httpVersion) {
    super()
    this.startMark = process.hrtime()
    this.id = `${Math.floor(Date.now() / 1000).toString(16)}v${crypto.randomBytes(4).toString('hex')}`
    this.session = session
    this.webserver = session.webserver
    this.path = requestHeaders[':path']
    this.method = requestHeaders[':method']
    this.authority = requestHeaders[':authority']
    const url = new URL(this.path, 'http://foo')
    this.pathname = url.pathname
    this.query = qs.parse(url.search.substr(1))
    this.httpVersion = httpVersion
    if (this.webserver.config.trust && requestHeaders['x-noop-trace-id']) {
      this.traceId = requestHeaders['x-noop-trace-id']
    } else {
      this.traceId = `${this.webserver.config.serviceCode}${this.webserver.config.locationCode}x${this.session.id}x${this.id}`
    }
    this.request = new Request(this, requestHeaders)
    this.response = new Response(this)
    this.closed = false
    this.timing = {}
    this.context = {}
    this.startTime = Date.now()
    this.endTime = null
    this.bytesIn = 0
    this.bytesOut = 0
  }

  process () {
    this.session.streams.add(this)
    this.mark('process')
    this.webserver.emit('log', 'stream.start', {
      type: this.constructor.name,
      traceId: this.traceId,
      streamId: this.id,
      sessionId: this.session.id,
      authority: this.authority,
      secure: this.session.secure,
      method: this.method,
      path: this.pathname,
      httpVersion: this.httpVersion,
      remoteAddress: this.session.remoteAddress
    })
    if (!this.webserver.config.trust) {
      Object.keys(this.request.headers).forEach(header => {
        if (['x-noop-token', 'x-noop-date', 'x-noop-signature'].includes(header)) return false
        if (header.startsWith('x-noop-')) delete this.request.headers[header]
      })
    }
    this.webserver.emit('stream', this)
  }

  close () {
    if (this.closed) return false
    this.closed = true
    this.endTime = Date.now()
    this.mark('close')
    this.session.streams.delete(this)
    this.webserver.emit('log', 'stream.end', {
      traceId: this.traceId,
      streamId: this.id,
      duration: this.endTime - this.startTime,
      timing: this.timing,
      bytesIn: this.request.bytes,
      bytesOut: this.response.bytes
    })
    this.emit('close', this)
  }

  respond (headers = {}) {
    Object.assign(this.response.headers, headers)
    this.mark('respond')
    if (this.webserver.config.serverTimings) this.webserver.config.serverTimings(this)
    this.webserver.emit('log', 'stream.respond', {
      traceId: this.traceId,
      streamId: this.id,
      status: this.response.headers[':status']
    })
    this.response.sent = true
    return this
  }

  end (data) {
    if (this.response.writable) this.response.end(data)
  }

  json (data) {
    this.respond({
      ':status': 200,
      'content-type': 'application/json'
    })
    this.end(JSON.stringify(data))
  }

  sendEvent (event, data) {
    if (!this.request.sse) return false
    if (!this.response.sent) {
      this.respond({
        ':status': 200,
        'content-type': 'text/event-stream',
        'cache-control': 'no-cache'
      })
      this.ssePinger = setInterval(() => this.sendEvent('ping', Date.now()), 30000)
      this.on('close', () => clearInterval(this.ssePinger))
    }
    this.response.write(`event: ${event}\n`)
    this.response.write(`data: ${JSON.stringify(data)}\n\n`)
  }

  error (err) {
    const error = err.name || 'NoopError'
    const message = err.message
    this.webserver.emit('log', 'stream.error', {
      traceId: this.traceId,
      streamId: this.id,
      error: `${error}: ${message}`
    })
    this.respond({
      ':status': err.statusCode || err.status || 500,
      'content-type': 'application/json'
    })
    this.end(JSON.stringify({ error, message }))
  }

  done (err, data) {
    if (err) {
      this.error(err)
    } else {
      this.json(data)
    }
  }

  mark (event) {
    const hr = process.hrtime(this.startMark)
    const milliseconds = ((hr[0] * 1000000000) + hr[1]) / 1000000
    this.timing[event] = milliseconds
  }

  setServerTiming (name, description, duration) {
    let string = ''
    if (name) string += name
    if (description) {
      if (string.length) string += ';'
      string += `desc="${description}"`
    }
    if (duration) {
      if (string.length) string += ';'
      string += `dur=${duration}`
    }
    if (this.response.headers['server-timing']) {
      this.response.headers['server-timing'] = `${string}, ${this.response.headers['server-timing']}`
    } else {
      this.response.headers['server-timing'] = string
    }
  }
}

module.exports = Stream

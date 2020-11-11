const { Transform } = require('stream')

class Request extends Transform {
  constructor (stream, headers) {
    super({
      transform: (...args) => this.transform(...args),
      flush: (...args) => this.flush(...args)
    })
    this.stream = stream
    this.bytes = 0
    this.headers = headers
    this.headers[':scheme'] = (stream.session.secure) ? 'https' : 'http'
    this.headers['x-noop-trace-id'] = stream.traceId
    if (stream.webserver.config.trust) {
      if (!this.headers['x-noop-trace-id']) this.headers['x-noop-trace-id'] = stream.traceId
    } else {

    }
  }

  transform (chunk, encoding, done) {
    this.bytes += chunk.length
    this.stream.bytesIn += chunk.length
    this.stream.session.bytesIn += chunk.length
    done(null, chunk)
  }

  flush (done) {
    done()
  }
}

module.exports = Request

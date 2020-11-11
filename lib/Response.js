const { Transform } = require('stream')

class Response extends Transform {
  constructor (stream) {
    super({
      transform: (...args) => this.transform(...args),
      flush: (...args) => this.flush(...args)
    })
    this.stream = stream
    this.bytes = 0
    this.headers = {}
    this.headers['x-noop-trace-id'] = stream.traceId
    this.sent = false
  }

  transform (chunk, encoding, done) {
    this.bytes += chunk.length
    this.stream.bytesOut += chunk.length
    this.stream.session.bytesOut += chunk.length
    done(null, chunk)
  }

  flush (done) {
    done()
  }
}

module.exports = Response

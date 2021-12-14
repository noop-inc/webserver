const { Transform, PassThrough } = require('stream')

class Response extends Transform {
  constructor (stream) {
    super({
      decodeStrings: false,
      objectMode: true,
      transform: (...args) => this.transform(...args),
      flush: (...args) => this.flush(...args)
    })
    this.stream = stream
    this.bytes = 0
    this.headers = {}
    this.headers['x-noop-trace-id'] = stream.traceId
    this.sent = false
    if (stream.session.webserver.config.tap) {
      this.tap = new PassThrough({ decodeStrings: false })
    }
  }

  transform (chunk, encoding, done) {
    this.bytes += chunk.length
    this.stream.bytesOut += chunk.length
    this.stream.session.bytesOut += chunk.length
    if (this.tap) this.tap.write(chunk)
    done(null, chunk)
  }

  flush (done) {
    done()
  }
}

module.exports = Response

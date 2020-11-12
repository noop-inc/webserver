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
    this.json = (this.headers['content-type'] && this.headers['content-type'].includes('application/json'))
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

  readBody (done) {
    const chunks = []
    this.on('data', chunk => {
      chunks.push(chunk)
    })
    this.on('end', () => {
      const data = chunks.join()
      done(null, data)
    })
  }

  readJson (done) {
    if (!this.json) return done(new Error('not json')) // TODO better errors
    this.readBody((err, data) => {
      if (err) return done(err)
      try {
        const json = JSON.parse(data)
        done(null, json)
      } catch (err) {
        done(err) // TODO wrap error
      }
    })
  }
}

module.exports = Request

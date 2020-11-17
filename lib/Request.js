const { Transform } = require('stream')
const crypto = require('crypto')
const { NoopError, ParseError } = require('./Errors')

class Request extends Transform {
  constructor (stream, headers) {
    super({
      decodeStrings: false,
      objectMode: true,
      transform: (...args) => this.transform(...args),
      flush: (...args) => this.flush(...args)
    })
    this.stream = stream
    this.bytes = 0
    this.headers = headers
    this.body = null
    this.bodyHash = null
    this.json = (this.headers['content-type'] && this.headers['content-type'].includes('application/json'))
    this.sse = (this.headers.accept && this.headers.accept.includes('text/event-stream') && this.stream.method === 'GET')
    this.headers[':scheme'] = (stream.session.secure) ? 'https' : 'http'
    this.headers['x-noop-trace-id'] = stream.traceId
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

  parseBody (done) {
    if (this.stream.method === 'CONNECT') return done()
    if (this.json) {
      this.readJson(done)
    } else {
      this.readBody(done)
    }
  }

  readBody (done) {
    const chunks = []
    this.on('data', chunk => {
      chunks.push(chunk)
    })
    this.on('end', () => {
      const data = chunks.join()
      if (data) {
        this.body = data
        this.bodyHash = crypto.createHash('sha256').update(data).digest('hex')
      }
      done(null, data)
    })
  }

  readJson (done) {
    if (!this.json) return done(new NoopError('not json'))
    this.readBody((err, data) => {
      if (err) return done(err)
      if (!data) return done()
      try {
        const json = JSON.parse(data)
        this.body = json
        done(null, json)
      } catch (err) {
        done(new ParseError(err.message))
      }
    })
  }
}

module.exports = Request

const { Transform, PassThrough } = require('stream')
const crypto = require('crypto')
const { NoopError, ParseError } = require('./Errors')
const Upload = require('./Upload')

const boundaryPattern = /boundary=(.+)$/

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
    if (headers.te) delete headers.te // https://datatracker.ietf.org/doc/html/rfc7540#section-8.1.2.2
    this.headers = headers
    this.body = null
    this.bodyHash = null
    this.uploads = new Set()
    this.json = (this.headers['content-type'] && this.headers['content-type'].includes('application/json'))
    this.multipart = (this.headers['content-type'] && this.headers['content-type'].includes('multipart/'))
    this.sse = (this.headers.accept && this.headers.accept.includes('text/event-stream') && this.stream.method === 'GET')
    this.headers[':scheme'] = (stream.session.secure) ? 'https' : 'http'
    if (!this.headers['x-forwarded-for'] || !this.stream.webserver.config.trust) {
      this.headers['x-forwarded-for'] = stream.session.remoteAddress
    }
    this.headers['x-noop-trace-id'] = stream.traceId
    if (stream.session.webserver.config.tap) {
      this.tap = new PassThrough()
    }
  }

  transform (chunk, encoding, done) {
    this.bytes += chunk.length
    this.stream.bytesIn += chunk.length
    this.stream.session.bytesIn += chunk.length
    if (this.tap) this.tap.write(chunk)
    done(null, chunk)
  }

  flush (done) {
    done()
  }

  parseBody (done) {
    if (this.stream.method === 'CONNECT') return done()
    if (this.multipart) return done()
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
      const data = chunks.join('')
      if (data) {
        this.body = data
        this.bodyHash = crypto.createHash('sha256').update(data).digest('hex')
      }
      done(null, data)
    })
  }

  readJson (done) {
    if (!this.json) return done(new NoopError('Expected content-type: application/json'))
    this.readBody((err, data) => {
      if (err) return done(err)
      if (!data) return done()
      let finished
      function finish () {
        if (finished) return false
        finished = true
        done(...arguments)
      }
      try {
        const json = JSON.parse(data)
        this.body = json
        finish(null, json)
      } catch (err) {
        finish(new ParseError(err.message, data))
      }
    })
  }

  parseUploads (done) {
    if (!this.multipart) return done(new NoopError('Expected content-type: multipart/form-data'))
    const boundarySegment = this.headers['content-type'].split(';').find(seg => boundaryPattern.test(seg))
    if (!boundarySegment) return done(new NoopError('Expected content-type to include multipart boundary'))
    const boundary = `--${boundaryPattern.exec(boundarySegment)[1]}\r\n`
    const ending = `--${boundaryPattern.exec(boundarySegment)[1]}--\r\n`
    if (!boundary) return done(new NoopError('Expected content-type to include multipart boundary'))
    let last = null
    this.on('data', chunk => {
      try {
        let pos = 0
        const firstBoundary = chunk.indexOf(boundary)
        const endBoundary = chunk.indexOf(ending)
        if (last) {
          if (firstBoundary > 0) {
            last.write(chunk.slice(0, firstBoundary))
            pos = firstBoundary
          } else if (firstBoundary === -1 && endBoundary === -1) {
            return last.write(chunk)
          } else {
            last.write(chunk.slice(0, endBoundary - 2))
            last.end()
            return done(null, [...this.uploads])
          }
        }
        while (chunk.indexOf(boundary, pos) >= 0) {
          const headerStart = chunk.indexOf(boundary, pos) + boundary.length
          const headerEnd = chunk.indexOf('\r\n\r\n', headerStart) + 4
          const headers = Buffer.from(chunk.slice(headerStart, headerEnd - 4)).toString()
          if (last) last.end()
          if (headers.includes('filename=')) {
            const upload = new Upload(headers)
            last = upload
            this.uploads.add(upload)
            this.emit('upload', upload)
          }
          if (chunk.indexOf(boundary, headerEnd) >= 0) {
            pos = chunk.indexOf(boundary, headerEnd)
            if (last) {
              last.write(chunk.slice(headerEnd, pos - 2))
              last.end()
            }
          } else {
            if (last) last.write(chunk.slice(headerEnd))
            pos = chunk.length
          }
        }
        if (chunk.indexOf(ending) !== -1) {
          if (last) last.end()
          done(null, [...this.uploads])
        }
      } catch (err) {
        this.stream.webserver.emit('log', 'upload.error', {
          traceId: this.traceId,
          streamId: this.id,
          error: err.message || err
        })
      }
    })
  }
}

module.exports = Request

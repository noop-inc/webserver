const Stream = require('../Stream')

class Http2Stream extends Stream {
  constructor (session, stream, headers) {
    super(session, headers, '2')
    this._stream = stream
    stream.pipe(this.request)
    this.response.pipe(stream)
    stream.on('close', this.close.bind(this))
  }

  respond (headers = {}) {
    if (this.response.sent) return false
    super.respond(headers)
    try {
      this._stream.respond(this.response.headers)
    } catch (err) {
      // do nothing
    }
    return this
  }
}

module.exports = Http2Stream

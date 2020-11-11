const Stream = require('../Stream')

class Http1Request extends Stream {
  constructor (session, req, res) {
    const headers = {}
    Object.keys(req.headers).forEach(header => {
      headers[header.toLowerCase()] = req.headers[header]
    })
    headers[':path'] = req.url
    headers[':method'] = req.method
    headers[':authority'] = req.headers.host
    delete headers.host
    delete headers.connection
    delete headers.upgrade
    delete headers['http2-settings']
    delete headers['keep-alive']
    delete headers['transfer-encoding']
    delete headers['proxy-connection']
    super(session, headers, req.httpVersion)
    this._req = req
    this._res = res
    req.pipe(this.request)
    this.response.pipe(res)
    req.on('close', this.close.bind(this))
  }

  respond (headers = {}) {
    if (this.response.sent) return false
    super.respond(headers)
    const http1Headers = Object.assign({}, this.response.headers)
    const status = http1Headers[':status']
    delete http1Headers[':status']
    this._res.writeHead(status, http1Headers)
    return this
  }
}

module.exports = Http1Request

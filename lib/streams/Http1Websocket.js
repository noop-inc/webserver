const Stream = require('../Stream')
const WebSocket = require('ws')

class Http1Websocket extends Stream {
  constructor (session, req, socket, head) {
    const headers = {}
    Object.keys(req.headers).forEach(header => {
      headers[header.toLowerCase()] = req.headers[header]
    })
    headers[':path'] = req.url
    headers[':method'] = 'CONNECT'
    headers[':authority'] = req.headers.host
    headers[':protocol'] = 'websocket'
    delete headers.host
    delete headers.connection
    delete headers.upgrade
    delete headers['http2-settings']
    delete headers['keep-alive']
    delete headers['transfer-encoding']
    delete headers['proxy-connection']
    super(session, headers, req.httpVersion)
    this._req = req
    this._socket = socket
    this._head = head
    this._ws = null
    req.noopStream = this
  }

  process () {
    this.webserver.websocketServer.handleUpgrade(this._req, this._socket, this._head, ws => {
      this._ws = ws
      this._duplex = WebSocket.createWebSocketStream(ws, {
        decodeStrings: false,
        encoding: 'utf8',
        objectMode: true
      })
      this._duplex.pipe(this.request)
      this.response.pipe(this._duplex)
      super.process()
    })
  }
}

module.exports = Http1Websocket

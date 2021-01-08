const http2 = require('http2')
const Http1Request = require('../streams/Http1Request')
const Http1Websocket = require('../streams/Http1Websocket')
const Http2Stream = require('../streams/Http2Stream')
const SecureHttp1Socket = require('../sessions/SecureHttp1Socket')
const SecureHttp2Session = require('../sessions/SecureHttp2Session')

class SecureListener {
  constructor (webserver) {
    this.webserver = webserver
    const params = {
      allowHTTP1: true,
      settings: {
        enableConnectProtocol: true
      }
    }
    if (webserver.config.requireClientCert) {
      params.requestCert = true
      params.rejectUnauthorized = true
    }
    if (webserver.config.ca) params.ca = webserver.config.ca
    if (webserver.config.SNICallback) {
      params.SNICallback = webserver.config.SNICallback
    } else {
      if (webserver.config.cert) params.cert = webserver.config.cert
      if (webserver.config.key) params.key = webserver.config.key
    }
    this.server = http2.createSecureServer(params)
    this.server.setTimeout(0)
    this.server.on('request', this.handleRequest.bind(this))
    this.server.on('upgrade', this.handleUpgrade.bind(this))
    this.server.on('stream', this.handleStream.bind(this))
    this.server.on('session', this.handleSession.bind(this))
    this.server.on('keylog', this.handleKeylog.bind(this))
    this.server.on('secureConnection', this.handleSecureConnection.bind(this))
    this.server.on('connect', () => {}) // 405 CONNECT streams if no handler
    this.server.on('tlsClientError', this.handleClientError.bind(this))
  }

  listen (done) {
    this.server.listen(this.webserver.config.securePort, err => {
      if (err) return done(err)
      const port = this.server.address().port
      this.webserver.securePort = port
      this.webserver.log('listen.secure', { port })
      done()
    })
  }

  stop (done) {
    this.server.close(done)
  }

  setCertificate (key, cert) {
    this.server.setSecureContext({ key, cert })
  }

  handleRequest (req, res) {
    if (req.httpVersionMajor === 2) return false
    new Http1Request(req.socket.noopSession, req, res, true).process()
  }

  handleUpgrade (req, socket, head) {
    const session = socket.noopSession
    const ws = new Http1Websocket(session, req, socket, head)
    ws.process()
  }

  handleStream (stream, headers) {
    new Http2Stream(stream.session.noopSession, stream, headers).process()
  }

  handleSession (http2Session) {
    const session = new SecureHttp2Session(this.webserver, http2Session)
    http2Session.noopSession = session
    session.process()
  }

  handleKeylog (line, socket) {
    const certificate = socket.getPeerCertificate()
    if (certificate) socket.clientCertificate = certificate
  }

  handleSecureConnection (socket) {
    if (socket.alpnProtocol === 'h2') return false
    const session = new SecureHttp1Socket(this.webserver, socket)
    socket.noopSession = session
    session.process()
  }

  handleClientError (err, socket) {
    if (!this.webserver.config.requireClientCert) return false
    if (err.code === 'ECONNRESET' && !socket.authorizationError) return false
    const event = {
      error: err.message,
      remoteAddress: socket.remoteAddress,
      authorized: socket.authorized,
      authorizationError: socket.authorizationError
    }
    if (socket.clientCertificate) {
      event.clientCertificate = {
        subject: socket.clientCertificate.subject,
        valid_from: socket.clientCertificate.valid_from,
        valid_to: socket.clientCertificate.valid_to
      }
    }
    this.webserver.log('session.error', event)
  }
}

module.exports = SecureListener

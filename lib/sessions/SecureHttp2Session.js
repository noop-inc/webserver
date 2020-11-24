const Session = require('../Session')

class SecureHttp2Session extends Session {
  constructor (webserver, http2Session) {
    super(webserver, http2Session.socket.remoteAddress, true)
    this._http2Session = http2Session
    if (this.webserver.config.requireClientCert) {
      this.clientCertificate = http2Session.socket.getPeerCertificate()
    }
    http2Session.on('close', this.close.bind(this))
    this.on('close', () => this.handleClose())
  }

  handleClose () {
    this._http2Session.destroy()
  }
}

module.exports = SecureHttp2Session

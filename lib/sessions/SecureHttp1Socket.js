const Session = require('../Session')

class SecureHttp1Socket extends Session {
  constructor (webserver, socket) {
    super(webserver, socket.remoteAddress, true)
    this._socket = socket
    if (this.webserver.config.requireClientCert) {
      this.clientCertificate = socket.getPeerCertificate()
    }
    socket.on('close', this.close.bind(this))
    this.on('close', () => this.handleClose())
  }

  handleClose () {
    this._socket.end()
  }
}

module.exports = SecureHttp1Socket

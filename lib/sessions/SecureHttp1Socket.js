const Session = require('../Session')

class SecureHttp1Socket extends Session {
  constructor (webserver, socket) {
    super(webserver, socket.remoteAddress, false)
    this._socket = socket
    if (this.webserver.config.requireClientCert) {
      this.clientCertificate = socket.getPeerCertificate()
    }
    socket.on('close', this.close.bind(this))
    this.on('close', () => this.handleClose())
  }

  handleClose () {
    this._socket.destroy()
  }
}

module.exports = SecureHttp1Socket

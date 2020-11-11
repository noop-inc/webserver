const Session = require('../Session')

class SecureHttp2Session extends Session {
  constructor (webserver, http2Session) {
    super(webserver, http2Session.socket.remoteAddress, true)
    this._http2Session = http2Session
    http2Session.on('close', this.close.bind(this))
    this.on('close', () => this.handleClose())
  }

  handleClose () {
    this._http2Session.destroy()
  }
}

module.exports = SecureHttp2Session

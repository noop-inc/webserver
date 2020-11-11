const Session = require('../Session')

class InsecureHttp1Socket extends Session {
  constructor (webserver, socket) {
    super(webserver, socket.remoteAddress, false)
    this._socket = socket
    socket.on('close', this.close.bind(this))
    this.on('close', () => this.handleClose())
  }

  handleClose () {
    this._socket.destroy()
  }
}

module.exports = InsecureHttp1Socket

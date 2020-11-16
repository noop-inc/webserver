const http = require('http')
const Http1Request = require('../streams/Http1Request')
const Http1Websocket = require('../streams/Http1Websocket')
const InsecureHttp1Socket = require('../sessions/InsecureHttp1Socket')

class InsecureListener {
  constructor (webserver) {
    this.webserver = webserver
    const params = {
      allowHTTP1: true,
      settings: {
        enableConnectProtocol: true
      }
    }
    this.server = http.createServer(params)
    this.server.on('request', this.handleRequest.bind(this))
    this.server.on('upgrade', this.handleUpgrade.bind(this))
    this.server.on('connection', this.handleConnection.bind(this))
  }

  listen (done) {
    this.server.listen(this.webserver.config.insecurePort, err => {
      if (err) return done(err)
      this.webserver.insecurePort = this.server.address().port
      done()
    })
  }

  stop (done) {
    this.server.close(done)
  }

  handleConnection (socket) {
    const session = new InsecureHttp1Socket(this.webserver, socket)
    socket.session = session
    session.process()
  }

  handleUpgrade (req, socket, head) {
    const session = socket.session
    const ws = new Http1Websocket(session, req, socket, head)
    ws.process()
  }

  handleRequest (req, res) {
    const session = req.socket.session
    new Http1Request(session, req, res, false).process()
  }
}

module.exports = InsecureListener

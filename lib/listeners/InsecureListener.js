const http = require('http')
const Http1Request = require('../streams/Http1Request')
const InsecureHttp1Socket = require('../sessions/InsecureHttp1Socket')

class InsecureListener {
  constructor (webserver) {
    this.webserver = webserver
    const params = {}
    this.server = http.createServer(params)
    this.server.on('request', this.handleRequest.bind(this))
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

  handleRequest (req, res) {
    const session = req.socket.session
    new Http1Request(session, req, res, false).process()
  }
}

module.exports = InsecureListener

const SecureListener = require('./listeners/SecureListener')
const InsecureListener = require('./listeners/InsecureListener')
const { EventEmitter } = require('events')
const { auto } = require('async')
const locations = require('../locations.json')
const WebSocket = require('ws')

class Webserver extends EventEmitter {
  constructor (name, config) {
    super()
    Webserver.all.add(this)
    this.config = Object.assign({
      trust: false,
      ca: null,
      key: null,
      cert: null,
      requireClientCert: false,
      SNICallback: null,
      securePort: 0,
      insecurePort: 0,
      listenSecure: true,
      listenInsecure: false,
      serverTimings: null,
      tap: false,
      streamToJSON: null,
      serviceCode: '0',
      locationCode: '000',
      location: null
    }, config)
    this.name = name
    if (locations[this.config.location]) {
      this.config.locationCode = locations[this.config.location]
    }
    this.securePort = null
    this.insecurePort = null
    this.secureListener = new SecureListener(this)
    this.insecureListener = new InsecureListener(this)
    this.websocketServer = new WebSocket.Server({ noServer: true })
    this.websocketServer.on('headers', (headers, req) => {
      const response = req.noopStream.response
      response.headers[':status'] = 101
      req.noopStream.respond()
      for (const header in response.headers) {
        headers.push(`${header}: ${response.headers[header]}`)
      }
    })
    this.sessions = new Set()
  }

  listen (done) {
    if (this.config.listenSecure && this.config.listenInsecure) {
      this.secureListener.listen(err => {
        if (err) return done(err)
        this.insecureListener.listen(done)
      })
    } else if (this.config.listenSecure) {
      this.secureListener.listen(done)
    } else if (this.config.listenInsecure) {
      this.insecureListener.listen(done)
    } else {
      return done(new Error('config.no.listeners'))
    }
  }

  setCertificate (key, cert) {
    this.config.key = key
    this.config.cert = cert
    this.log('webserver.certificate.set', { cert })
    this.secureListener.setCertificate(key, cert)
  }

  stop (done) {
    Webserver.all.delete(this)
    this.sessions.forEach(session => session.close())
    auto({
      secure: done => this.secureListener.stop(done),
      insecure: done => this.insecureListener.stop(done)
    }, done)
  }

  log (event, context = {}) {
    this.emit('log', event, context)
  }
}

Webserver.all = new Set()

module.exports = Webserver

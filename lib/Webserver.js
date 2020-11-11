const SecureListener = require('./listeners/SecureListener')
const InsecureListener = require('./listeners/InsecureListener')
const { EventEmitter } = require('events')
const { auto } = require('async')
const locations = require('../locations.json')

class Webserver extends EventEmitter {
  constructor (name, config) {
    super()
    Webserver.all.add(this)
    this.config = {
      trust: false,
      ca: null,
      key: null,
      cert: null,
      requireClientCert: false,
      securePort: 0,
      insecurePort: 0,
      listenSecure: true,
      listenInsecure: false,
      serverTimings: null,
      serviceCode: '0',
      locationCode: '000',
      location: null
    }
    Object.assign(this.config, config)
    this.name = name
    if (locations[this.config.location]) {
      this.config.locationCode = locations[this.config.location]
    }
    this.securePort = null
    this.insecurePort = null
    this.secureListener = new SecureListener(this)
    this.insecureListener = new InsecureListener(this)
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
    this.secureServer.setCertificate({ key, cert })
  }

  stop (done) {
    Webserver.all.delete(this)
    this.sessions.forEach(session => session.close())
    auto({
      secure: done => this.secureListener.stop(done),
      insecure: done => this.insecureListener.stop(done)
    }, done)
  }
}

Webserver.all = new Set()

module.exports = Webserver

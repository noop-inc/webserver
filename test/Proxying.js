const { Webserver, SecureProxy } = require('../index.js')
const { request, CertificateAuthority } = require('./helpers')
const { auto } = require('async')

describe('Proxying', function () {
  describe('HTTP & HTTPS -> HTTPS/2', function () {
    let ws1, ws2, proxy1
    const ca = new CertificateAuthority()

    before(function (done) {
      auto({
        ca: done => ca.init(done),
        cert1: ['ca', (results, done) => results.ca.issueCertificate('server1.noop.test', false, done)],
        cert2: ['ca', (results, done) => results.ca.issueCertificate('server2.noop.test', false, done)],
        webserver1: ['cert1', (results, done) => {
          ws1 = new Webserver('ws1', {
            ca: results.ca.cert,
            cert: results.cert1.cert,
            key: results.cert1.key,
            listenInsecure: true
          })
          ws1.on('stream', stream => proxy1.send(stream))
          ws1.listen(done)
        }],
        webserver2: ['cert2', (results, done) => {
          ws2 = new Webserver('ws2', {
            ca: results.ca.cert,
            cert: results.cert2.cert,
            key: results.cert2.key,
            listenInsecure: true
          })
          ws2.on('stream', stream => {
            if (stream.method === 'GET') {
              stream.respond({ ':status': 207 }).response.end('pwoxy')
            } else {
              stream.respond({ ':status': 201 })
              stream.request.pipe(stream.response)
            }
          })
          ws2.listen(done)
        }],
        proxy1: ['webserver2', (results, done) => {
          const params = {
            port: ws2.securePort,
            ca: results.ca.cert,
            checkServerIdentity: false
          }
          proxy1 = new SecureProxy('localhost', 'ws2', 'test', params)
          proxy1.start()
          done()
        }]
      }, done)
    })

    after(function (done) {
      auto({
        ws1: done => ws1.stop(done),
        ws2: done => ws2.stop(done)
      }, done)
    })

    it('HTTP/1 GET', function (done) {
      const params = {
        path: '/foo',
        port: ws1.insecurePort
      }
      request.http1(params, null, (err, res, body) => {
        if (err) return done(err)
        if (res.statusCode !== 207) return done(new Error('wrong status code'))
        if (body !== 'pwoxy') return done(new Error(`wrong body '${body}'`))
        done()
      })
    })

    it('HTTPS/1 GET', function (done) {
      const params = {
        path: '/foo',
        port: ws1.securePort,
        ca: ca.cert,
        checkServerIdentity: () => {}
      }
      request.https1(params, null, (err, res, body) => {
        if (err) return done(err)
        if (res.statusCode !== 207) return done(new Error('wrong status code'))
        if (body !== 'pwoxy') return done(new Error(`wrong body '${body}'`))
        done()
      })
    })

    it('HTTPS/2 GET', function (done) {
      const headers = { ':path': '/foo?bar=1&bow=2', ':method': 'GET' }
      const connectParams = {
        ca: ca.cert,
        checkServerIdentity: function () {},
        peerMaxConcurrentStreams: 1024
      }
      request.https2(ws1.securePort, headers, connectParams, null, (err, headers, body) => {
        if (err) return done(err)
        if (headers[':status'] !== 207) return done(new Error('wrong status code'))
        if (body !== 'pwoxy') return done(new Error(`wrong body '${body}'`))
        done()
      })
    })

    it('HTTP/1 POST', function (done) {
      const params = {
        method: 'POST',
        path: '/foo',
        port: ws1.insecurePort
      }
      const payload = 'watson'
      request.http1(params, payload, (err, res, body) => {
        if (err) return done(err)
        if (res.statusCode !== 201) return done(new Error(`wrong status code ${res.statusCode}`))
        if (body !== payload) return done(new Error(`wrong body '${body}'`))
        done()
      })
    })

    it('HTTPS/1 POST', function (done) {
      const params = {
        method: 'POST',
        path: '/foo',
        port: ws1.securePort,
        ca: ca.cert,
        checkServerIdentity: () => {}
      }
      const payload = 'frob'
      request.https1(params, payload, (err, res, body) => {
        if (err) return done(err)
        if (res.statusCode !== 201) return done(new Error(`wrong status code ${res.statusCode}`))
        if (body !== payload) return done(new Error(`wrong body '${body}'`))
        done()
      })
    })

    it('HTTPS/2 POST', function (done) {
      const headers = { ':path': '/foo?bar=1&bow=2', ':method': 'POST' }
      const connectParams = {
        ca: ca.cert,
        checkServerIdentity: function () {}
      }
      const payload = 'bloop'
      request.https2(ws1.securePort, headers, connectParams, payload, (err, headers, body) => {
        if (err) return done(err)
        if (headers[':status'] !== 201) return done(new Error(`wrong status code ${headers[':status']}`))
        if (body !== payload) return done(new Error(`wrong body '${body}'`))
        done()
      })
    })
  })
})

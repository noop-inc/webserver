const { Webserver } = require('../index.js')
const { request, CertificateAuthority } = require('./helpers')
const { auto } = require('async')

describe('Request Handling', function () {
  let webserver
  const ca = new CertificateAuthority()

  before(function (done) {
    auto({
      ca: done => ca.init(done),
      certificate: ['ca', (results, done) => {
        results.ca.issueCertificate('server.noop.test', false, done)
      }],
      webserver: ['certificate', (results, done) => {
        webserver = new Webserver('basic', {
          ca: results.ca.cert,
          cert: results.certificate.cert,
          key: results.certificate.key,
          listenInsecure: true
        })
        webserver.on('stream', stream => {
          if (stream.pathname === '/json') {
            stream.request.readJson((err, json) => {
              if (err) return stream.error(err)
              if (json.foo !== 'bar') return stream.error(new Error(`bad json body ${json}`))
              stream.json(json)
            })
          } else if (stream.method === 'POST') {
            stream.request.readBody((err, data) => {
              if (err) return stream.error(err)
              const status = (data === 'bar') ? 202 : 404
              stream.respond({ ':status': status }).response.end('pwomp')
            })
          } else if (stream.pathname === '/foo') {
            stream.respond({ ':status': 202, 'server-timing': '"bar";dur=1.20009' }).response.end('hi')
          } else {
            stream.respond({ ':status': 404 }).response.end('hi')
          }
        })
        webserver.listen(done)
      }]
    }, done)
  })

  after(function (done) {
    webserver.stop(done)
  })

  it('HTTP/1 GET', function (done) {
    const params = {
      path: '/foo',
      port: webserver.insecurePort
    }
    request.http1(params, null, (err, res, body) => {
      if (err) return done(err)
      if (res.statusCode !== 202) return done(new Error('wrong status code'))
      if (body !== 'hi') return done(new Error(`wrong body '${body}'`))
      done()
    })
  })

  it('HTTPS/1 GET', function (done) {
    const params = {
      path: '/foo',
      port: webserver.securePort,
      ca: ca.cert,
      checkServerIdentity: function () {}
    }
    request.https1(params, null, (err, res, body) => {
      if (err) return done(err)
      if (res.statusCode !== 202) return done(new Error('wrong status code'))
      if (body !== 'hi') return done(new Error(`wrong body '${body}'`))
      done()
    })
  })

  it('HTTPS/2 GET', function (done) {
    const headers = { ':path': '/foo?bar=1&bow=2', ':method': 'GET' }
    const connectParams = {
      ca: ca.cert,
      checkServerIdentity: function () {}
    }
    request.https2(webserver.securePort, headers, connectParams, null, (err, headers, body) => {
      if (err) return done(err)
      if (headers[':status'] !== 202) return done(new Error('wrong status code'))
      if (body !== 'hi') return done(new Error(`wrong body '${body}'`))
      done()
    })
  })

  it('HTTP/1 POST', function (done) {
    const params = {
      path: '/foo',
      port: webserver.insecurePort,
      method: 'POST'
    }
    request.http1(params, 'bar', (err, res, body) => {
      if (err) return done(err)
      if (res.statusCode !== 202) return done(new Error('wrong status code'))
      if (body !== 'pwomp') return done(new Error(`wrong body '${body}'`))
      done()
    })
  })

  it('HTTPS/1 POST', function (done) {
    const params = {
      path: '/foo',
      port: webserver.securePort,
      method: 'POST',
      ca: ca.cert,
      checkServerIdentity: function () {}
    }
    request.https1(params, 'bar', (err, res, body) => {
      if (err) return done(err)
      if (res.statusCode !== 202) return done(new Error('wrong status code'))
      if (body !== 'pwomp') return done(new Error(`wrong body '${body}'`))
      done()
    })
  })

  it('HTTPS/2 POST', function (done) {
    const headers = { ':path': '/foo', ':method': 'POST' }
    const connectParams = {
      ca: ca.cert,
      checkServerIdentity: function () {}
    }
    request.https2(webserver.securePort, headers, connectParams, 'bar', (err, headers, body) => {
      if (err) return done(err)
      if (headers[':status'] !== 202) return done(new Error('wrong status code'))
      if (body !== 'pwomp') return done(new Error(`wrong body '${body}'`))
      done()
    })
  })

  it('HTTPS/1 JSON Body Parsing', function (done) {
    const params = {
      path: '/json',
      headers: {
        'Content-Type': 'application/json'
      },
      port: webserver.securePort,
      method: 'POST',
      ca: ca.cert,
      checkServerIdentity: function () {}
    }
    request.https1(params, JSON.stringify({ foo: 'bar' }), (err, res) => {
      if (err) return done(err)
      if (res.statusCode !== 200) return done(new Error(`wrong status code ${res.statusCode}`))
      done()
    })
  })
})

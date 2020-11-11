const openssl = require('openssl-wrapper').exec
const { auto } = require('async')
const fs = require('fs')
const os = require('os')
const http = require('http')
const https = require('https')
const http2 = require('http2')

class CertificateAuthority {
  init (done) {
    auto({
      tempdir: done => fs.mkdtemp(`${os.tmpdir()}/noop-webserver-test-`, done),
      generateKey: ['tempdir', (results, done) => {
        const params = {
          2048: false,
          out: `${results.tempdir}/key`
        }
        openssl('genrsa', params, done)
      }],
      createCert: ['generateKey', (results, done) => {
        const params = {
          x509: true,
          new: true,
          key: `${results.tempdir}/key`,
          out: `${results.tempdir}/cert`,
          nodes: true,
          sha256: true,
          days: 1024,
          subj: '/C=US/ST=Washington/L=Seattle/O=Noop/OU=Engineering/CN=noop.test'
        }
        openssl('req', results.generateKey, params, done)
      }],
      key: ['generateKey', (results, done) => fs.readFile(`${results.tempdir}/key`, done)],
      cert: ['createCert', (results, done) => fs.readFile(`${results.tempdir}/cert`, done)]
    }, (err, results) => {
      if (err) return done(err)
      this.tempdir = results.tempdir
      this.key = results.key.toString()
      this.cert = results.cert.toString()
      done(null, this)
    })
  }

  issueCertificate (cn, client = false, done) {
    auto({
      tempdir: done => fs.mkdtemp(`${this.tempdir}/client-`, done),
      generateKey: ['tempdir', (results, done) => {
        const params = {
          2048: false,
          out: `${results.tempdir}/key`
        }
        openssl('genrsa', params, done)
      }],
      csr: ['generateKey', (results, done) => {
        const params = {
          new: true,
          key: `${results.tempdir}/key`,
          out: `${results.tempdir}/csr`,
          subj: `/C=US/ST=Washington/L=Seattle/O=Noop/OU=Engineering/CN=${cn}`
        }
        openssl('req', params, done)
      }],
      sign: ['csr', (results, done) => {
        const params = {
          req: true,
          in: `${results.tempdir}/csr`,
          out: `${results.tempdir}/cert`,
          CA: `${this.tempdir}/cert`,
          CAkey: `${this.tempdir}/key`,
          CAcreateserial: true,
          sha256: true
        }
        if (client) {
          params.extensions = 'client'
        }
        openssl('x509', params, done)
      }],
      key: ['sign', (results, done) => fs.readFile(`${results.tempdir}/key`, done)],
      cert: ['sign', (results, done) => fs.readFile(`${results.tempdir}/cert`, done)]
    }, (err, results) => {
      if (err) return done(err)
      done(null, {
        key: results.key.toString(),
        cert: results.cert.toString()
      })
    })
  }
}

function requestHttp1 (params, reqBody, done) {
  let finished = false
  let response = null
  let body = ''
  function finish (err) {
    if (finished) return false
    done(err, response, body)
    finished = true
  }
  const req = http.request(params, res => {
    response = res
    res.on('data', chunk => {
      body += chunk.toString()
    })
    res.on('error', finish)
    res.on('end', finish)
  })
  if (reqBody) req.write(reqBody)
  req.on('error', finish)
  req.end()
}

function requestHttps1 (params, reqBody, done) {
  let finished = false
  let response = null
  let body = ''
  function finish (err) {
    if (finished) return false
    done(err, response, body)
    finished = true
  }
  const req = https.request(params, res => {
    response = res
    res.on('data', chunk => {
      body += chunk.toString()
    })
    res.on('error', finish)
    res.on('end', finish)
  })
  if (reqBody) req.write(reqBody)
  req.on('error', finish)
  req.end()
}

function requestHttps2 (port, headers, connectParams, reqBody, done) {
  let finished = false
  let responseHeaders = null
  let body = ''
  function finish (err) {
    if (finished) return false
    done(err, responseHeaders, body)
    finished = true
  }
  const client = http2.connect(`https://localhost:${port}`, connectParams)
  client.on('connect', () => {
    const req = client.request(headers)
    if (reqBody) req.write(reqBody)
    req.on('response', (headers) => {
      responseHeaders = headers
    })
    req.on('data', chunk => {
      body += chunk.toString()
    })
    req.on('error', finish)
    req.on('end', finish)
    req.end()
  })
  client.on('error', finish)
}

module.exports = {
  CertificateAuthority,
  request: {
    http1: requestHttp1,
    https1: requestHttps1,
    https2: requestHttps2
  }
}

const Agent = require('../Agent')
const http = require('http')
const https = require('https')

class Http1Client extends Agent {
  constructor (proxy) {
    super(proxy)
    if (this.proxy.secure) {
      this.agent = new https.Agent({
        keepAlive: true,
        maxTotalSockets: 1024
      })
    } else {
      this.agent = new http.Agent({
        keepAlive: true,
        maxTotalSockets: 1024
      })
    }
  }

  connect (done) {
    done()
  }

  forward (stream) {
    this.streams.add(stream)
  }
}

module.exports = Http1Client

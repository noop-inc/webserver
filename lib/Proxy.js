const { EventEmitter } = require('events')
const { ProxyTimeout } = require('./Errors')

const maxRetry = 300
const delays = [1, 5, 10, 10, 10, 30, 60, 120]

class Proxy extends EventEmitter {
  constructor (destination, name, type, config) {
    super()
    Proxy.all.add(this)
    this.config = Object.assign({
      trust: false,
      timeout: 60000,
      keepAlive: false
    }, config)
    this.destination = destination
    this.name = name
    this.type = type
    this.secure = false
    this.queue = []
    this.running = false
    this.latency = null
    this.agent = null
    this.retries = 0
    this.retryDiscoverTimeout = null
    this.error = null
  }

  start () {
    this.interval = setInterval(() => this.run(), 1000)
    this.running = true
    this.discover(err => {
      if (err) {
        this.error = err
        this.retryDiscover()
      } else {
        this.agent.start()
      }
    })
  }

  stop () {
    clearInterval(this.interval)
    Proxy.all.delete(this)
    this.running = false
  }

  discover (done) {}

  retryDiscover () {
    if (this.discovering || this.retryDiscoverTimeout) return false
    this.retries++
    const delay = delays[this.retries - 1] || maxRetry
    this.retryDiscoverTimeout = setTimeout(() => {
      this.retryDiscoverTimeout = null
      this.discover(err => {
        if (err) {
          this.error = err
          this.retryDiscover()
        } else {
          this.agent.start()
        }
      })
    }, delay * 1000)
  }

  send (stream) {
    // TODO enforce queue limit
    stream.proxy = this
    stream.webserver.emit('log', 'proxy.send', {
      traceId: stream.traceId,
      destination: this.name,
      type: this.type,
      secure: this.secure
    })
    stream.proxyTimeout = setTimeout(() => {
      const index = this.queue.findIndex(item => item.id === stream.id)
      if (index !== -1) {
        this.queue.splice(index, 1)
        stream.error(new ProxyTimeout(this))
      }
    }, this.config.timeout)
    this.queue.push(stream)
    this.run()
  }

  run () {
    while (this.queue.length && this.running && this.agent && this.agent.connected) {
      const stream = this.queue.shift()
      clearTimeout(stream.proxyTimeout)
      delete stream.proxyTimeout
      this.agent.forward(stream)
    }
  }
}

Proxy.all = new Set()

// proxy.send(stream)
// idea: x-noop-trace-id `${webserver.config.serviceCode}${webserver.config.locationCode}x${stream.session.id}x${stream.id}`

module.exports = Proxy

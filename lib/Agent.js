const maxRetry = 300
const delays = [1, 5, 10, 10, 10, 30, 60, 60, 60, 120]

class Agent {
  constructor (proxy) {
    this.proxy = proxy
    this.streams = new Set()
    this.connected = false
    this.connecting = false
    this.retries = 0
    this.retryConnectTimeout = null
  }

  start () {
    this.connect()
  }

  connect () {}

  forward (stream) {}

  retryConnect () {
    if (this.connecting || this.retryConnectTimeout) return false
    this.retries++
    const delay = delays[this.retries - 1] || maxRetry
    this.retryConnectTimeout = setTimeout(() => {
      this.retryConnectTimeout = null
      this.connect()
    }, delay * 1000)
  }

  handleConnect () {
    this.connecting = false
    this.connected = true
    this.retries = 0
    this.proxy.log('proxy.connect', {
      destination: this.proxy.destination,
      secure: this.proxy.secure,
      agent: this.constructor.name
    })
    this.proxy.run()
    if (this.ping && this.proxy.config.keepAlive) {
      this.pingInterval = setInterval(() => this.ping(), 10000)
      this.ping()
    }
  }

  handleError (err) {
    this.connecting = false
    this.proxy.error = err
    this.proxy.log('proxy.error', {
      error: err,
      destination: this.proxy.destination,
      secure: this.proxy.secure,
      retries: this.retries,
      agent: this.constructor.name
    })
    this.retryConnect()
  }

  handleClose () {
    this.connecting = false
    this.connected = false
    this.proxy.log('proxy.close', {
      destination: this.proxy.destination,
      secure: this.proxy.secure,
      agent: this.constructor.name
    })
    this.retryConnect()
  }

  handleTimeout () {
    this.proxy.log('proxy.timeout', {
      destination: this.proxy.destination,
      secure: this.proxy.secure,
      agent: this.constructor.name
    })
    this.retryConnect()
  }
}

module.exports = Agent

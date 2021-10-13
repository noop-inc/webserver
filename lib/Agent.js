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

  stop () {
    this.disconnect()
  }

  connect () {}

  disconnect () {}

  forward (stream) {}

  retryConnect () {
    if (!this.proxy.running) return false
    if (this.connecting || this.retryConnectTimeout) return false
    this.retries++
    const delay = delays[this.retries - 1] || maxRetry
    this.retryConnectTimeout = setTimeout(() => {
      this.retryConnectTimeout = null
      this.connect()
    }, delay * 1000)
  }

  handleConnect () {
    const {
      config: {
        keepAlive
      },
      destination,
      secure
    } = this.proxy
    this.connecting = false
    this.connected = true
    this.retries = 0
    this.proxy.log('proxy.connect', {
      destination,
      secure,
      agent: this.constructor.name
    })
    this.proxy.run()
    if (this.ping && keepAlive) {
      this.pingInterval = setInterval(() => this.ping(), 10000)
      this.ping()
    }
  }

  handleError (err) {
    const { destination, secure } = this.proxy
    if (!this.proxy.running) return false
    this.connecting = false
    this.proxy.error = err
    this.proxy.log('proxy.error', {
      error: err,
      destination,
      secure,
      retries: this.retries,
      agent: this.constructor.name
    })
    this.retryConnect()
  }

  handleClose () {
    const {
      config: {
        keepAlive
      },
      destination,
      secure
    } = this.proxy
    this.connecting = false
    this.connected = false
    this.proxy.log('proxy.close', {
      destination,
      secure,
      agent: this.constructor.name
    })
    this.retryConnect()
    if (this.ping && keepAlive) {
      clearInterval(this.pingInterval)
    }
  }

  handleTimeout () {
    const { destination, secure } = this.proxy
    this.proxy.log('proxy.timeout', {
      destination,
      secure,
      agent: this.constructor.name
    })
    this.retryConnect()
  }
}

module.exports = Agent

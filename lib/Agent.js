const maxRetry = 300
const delays = [1, 5, 10, 10, 10, 30, 60, 120]

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
    this.connect(err => {
      if (err) {
        this.proxy.error = err
        this.retryConnect()
      } else {
        this.proxy.run()
      }
    })
  }

  connect (done) {}

  forward (stream) {}

  retryConnect () {
    if (this.connecting || this.retryConnectTimeout) return false
    this.retries++
    const delay = delays[this.retries - 1] || maxRetry
    this.retryConnectTimeout = setTimeout(() => {
      this.retryConnectTimeout = null
      this.connect(err => {
        if (err) {
          this.proxy.error = err
          this.retryConnect()
        } else {
          this.proxy.run()
        }
      })
    }, delay * 1000)
  }

  handleConnect () {
    this.connecting = false
    this.connected = true
    this.retries = 0
    this.proxy.run()
  }
}

module.exports = Agent

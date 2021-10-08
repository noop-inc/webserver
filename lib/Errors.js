class NoopError extends Error {
  constructor (message, context = {}, statusCode = 500) {
    super(message)
    this.name = this.constructor.name
    this.statusCode = statusCode
    this.context = context
    this.data = {}
  }
}

class ProxyTimeout extends NoopError {
  constructor (proxy) {
    const {
      config: {
        timeout
      },
      destination,
      name,
      type,
      secure,
      error
    } = proxy
    const message = `Exceeded ${timeout}ms`
    const context = {
      destination,
      name,
      type,
      secure,
      error
    }
    super(message, context, 504)
  }
}

class ParseError extends NoopError {
  constructor (message, payload) {
    super(message, {}, 400)
    this.data.payload = payload
  }
}

class ProxyError extends NoopError {
  constructor (proxy, error) {
    const {
      destination,
      name,
      type,
      secure
    } = proxy
    const message = error.code
    const context = {
      destination,
      name,
      type,
      secure,
      error
    }
    super(message, context, 502)
  }
}

module.exports = {
  NoopError,
  ProxyTimeout,
  ParseError,
  ProxyError
}

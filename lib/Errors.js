class NoopError extends Error {
  constructor (message, context = {}, statusCode = 500) {
    super(message)
    this.name = this.constructor.name
    this.statusCode = statusCode
    this.context = context
  }
}

class ProxyTimeout extends NoopError {
  constructor (proxy) {
    const message = `Exceeded ${proxy.config.timeout}ms`
    const context = {
      destination: proxy.destination,
      name: proxy.name,
      type: proxy.type,
      secure: proxy.secure,
      error: proxy.error
    }
    super(message, context, 504)
  }
}

class ParseError extends NoopError {
  constructor (message) {
    super(message, {}, 400)
  }
}

class ProxyError extends NoopError {
  constructor (proxy, error) {
    const message = error.code
    const context = {
      destination: proxy.destination,
      name: proxy.name,
      type: proxy.type,
      secure: proxy.secure,
      error: error
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

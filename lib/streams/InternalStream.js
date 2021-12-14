const Stream = require('../Stream')

const mockWebserver = {
  config: {
    trust: true,
    serviceCode: 999,
    locationCode: 999,
    tap: true
  },
  emit: () => {}
}

const mockSession = {
  webserver: mockWebserver,
  secure: true,
  streams: new Set(),
  id: 'internal',
  remoteAddress: 'internal'
}

class InternalStream extends Stream {
  constructor (headers) {
    if (!headers[':authority']) headers[':authority'] = 'internal'
    super(mockSession, headers, '2')
  }
}

module.exports = InternalStream

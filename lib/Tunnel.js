const { createServer } = require('net')
const { tmpdir } = require('os')
const { randomBytes } = require('crypto')
const { join } = require('path')
const { EventEmitter } = require('events')

class Tunnel extends EventEmitter {
  constructor (name, { mode, port, path, allowRemote = false }, streamProvider) {
    super()
    this.name = name
    this.mode = mode || 'ipc'
    this.port = port || 0
    this.path = path || join(tmpdir(), randomBytes(8).toString('hex'))
    // TODO error if path over 103 characters causing node to truncate
    this.allowRemote = allowRemote
    this.streamProvider = streamProvider
    this.server = createServer({ decodeStrings: false })
    this.server.on('connection', socket => this.handleConnection(socket))
  }

  start () {
    if (this.mode === 'tcp') {
      const host = this.allowRemote ? '0.0.0.0' : '127.0.0.1'
      this.server.listen(this.port, host, () => {
        this.port = this.server.address().port
        this.emit('log', 'tunnel.start', {
          name: this.name,
          mode: this.mode,
          port: this.port,
          allowRemote: this.allowRemote
        })
      })
    } else {
      this.server.listen(this.path, () => {
        this.emit('log', 'tunnel.start', {
          name: this.name,
          mode: this.mode,
          path: this.path
        })
      })
    }
  }

  stop () {
    this.emit('log', 'tunnel.stop', {
      name: this.name
    })
    this.server.close()
  }

  handleConnection (socket) {
    this.emit('log', 'tunnel.connection', {
      name: this.name
    })
    this.streamProvider((err, stream) => {
      if (err) {
        this.emit('log', 'tunnel.stream.error', {
          name: this.name,
          error: err
        })
        return socket.close()
      }
      stream.response.pipe(socket)
      socket.pipe(stream.request)
      socket.once('close', () => stream.close())
      socket.once('error', err => {
        this.emit('log', 'tunnel.socket.error', {
          name: this.name,
          error: err
        })
      })
    })
  }
}

module.exports = Tunnel

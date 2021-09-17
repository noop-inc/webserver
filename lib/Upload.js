const { Transform } = require('stream')

const filenamePattern = / filename="(.+?)"/
const namePattern = / name="(.+?)"/

class Upload extends Transform {
  constructor (headerData) {
    super({
      decodeStrings: false,
      transform: (...args) => this.transform(...args),
      flush: (...args) => this.flush(...args)
    })
    const headers = headerData.split('\r\n')
    const disposition = headers.find(header => header.startsWith('Content-Disposition:'))
    const contentType = headers.find(header => header.startsWith('Content-Type:'))
    if (!disposition) throw new Error('Multipart upload part missing Content-Disposition')
    this.name = (namePattern.test(disposition)) ? namePattern.exec(disposition)[1] : null
    this.filename = (filenamePattern.test(disposition)) ? filenamePattern.exec(disposition)[1] : null
    this.contentType = (contentType) ? contentType.substr(14) : null
    this.size = 0
  }

  transform (chunk, encoding, done) {
    this.size += chunk.length
    done(null, chunk)
  }

  flush (done) {
    done()
  }

  toJSON () {
    return {
      name: this.name,
      filename: this.filename,
      contentType: this.contentType
    }
  }
}

module.exports = Upload

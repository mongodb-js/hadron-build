const crypto = require('crypto');
const fs = require('fs');

class Asset {
  checksum() {
    return new Promise( (resolve) => {
      const hash = crypto.createHash('sha256');
      hash.on('readable', () => {
        var data = hash.read();
        if (data) {
          resolve(data.toString('hex'));
        }
      });
      fs.createReadStream(this.src).pipe(hash);
    });
  }
}

module.exports = Asset;

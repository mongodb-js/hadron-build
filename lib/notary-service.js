/**
 * A node.js client for the [notary-service](https://github.com/10gen/notary-service).
 *
 * Parameters for the notary service are passed in as environment variables:
 *
 *  - `NOTARY_SIGNING_KEY` The name of the key to use for signing
 *  - `NOTARY_SIGNING_COMMENT` The comment to enter into the notary log for this signing operation
 *  - `NOTARY_AUTH_TOKEN` The password for using the selected signing key
 *  - `NOTARY_URL` The URL of the notary service
 */

const fs = require('fs');
const crypto = require('crypto');
const pbkdf2 = require('pbkdf2');
const _ = require('lodash');
const request = require('superagent');

function generateAuthToken() {
  /* eslint no-sync: 0 */
  const derivedKey = pbkdf2.pbkdf2Sync(process.env.NOTARY_AUTH_TOKEN,
    _.reverse(process.env.NOTARY_AUTH_TOKEN), 1000, 16, 'sha1');
  const signedData = crypto.createHmac('sha1', derivedKey);
  const dateStr = Date.now().toString();
  signedData.update(dateStr);
  return `${signedData.digest('hex')}${dateStr}`;
}

function sign(src, done) {
  request.post(`${process.env.NOTARY_URL}/api/sign`)
    .field('key', process.env.NOTARY_SIGNING_KEY)
    .field('comment', process.env.NOTARY_SIGNING_COMMENT)
    .field('auth_token', generateAuthToken())
    .attach('file', src)
    .end(function(err, res) {
      if (err) {
        return done(err);
      }

      if (!res.body.permalink) {
        return done(new Error('Signing service did not return a permalink'));
      }
      request.get(`${process.env.NOTARY_URL}/${res.body.permalink}`)
        .stream()
        .pipe(fs.createWriteStream(src))
        .on('error', done)
        .on('close', done);
    });
}

module.exports = function(src, done) {
  [
    'NOTARY_SIGNING_KEY',
    'NOTARY_SIGNING_COMMENT',
    'NOTARY_AUTH_TOKEN',
    'NOTARY_URL'
  ].forEach(function(k) {
    if (!process.env[k]) {
      throw new TypeError(`Must set ${k} environment variable`);
    }
  });

  fs.exists(src, function(exists) {
    if (!exists) {
      return done(new Error('File does not exist'));
    }

    sign(src, done);
  });
};

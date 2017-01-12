const notary = require('../lib/notary-service');
const chai = require('chai');
const expect = chai.expect;

describe('notary-service', function() {
  const secret = 'A-------------Z';
  const now = 1484238590217;

  it('should generate the right salt', function() {
    expect(notary.getSalt(secret)).to.equal('Z-------------A');
  });

  it('should generate the auth token', function() {
    const token = notary.generateAuthToken(secret, now);
    expect(token).to.be.a('string');
    expect(token).to.equal('8628593d83fa61ee5538770de6e2ab98d1d40cbe1484238590217');
  });
});

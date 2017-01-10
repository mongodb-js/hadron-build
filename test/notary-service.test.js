const notary = require('../lib/notary-service');
const chai = require('chai');
const expect = chai.expect;

describe('notary-service', function() {
  it('should generate the auth token', function() {
    const secret = '111111111aaaaaA';
    const now = 1484069135881;
    const token = notary.generateAuthToken(secret, now);

    expect(token).to.be.a('string');
    expect(token).to.equal('878434bdf3930a412a996c8168c11a042be03ed31484069135881');
  });
});

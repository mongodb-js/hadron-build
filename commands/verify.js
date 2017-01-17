'use strict';

/**
 * Wouldn't it be great if you or a CI system were notified properly
 * that you aren't using the right version of node.js, npm or Python?
 *
 * @see https://github.com/atom/atom/blob/master/script/utils/verify-requirements.js
 */
const cli = require('mongodb-js-cli')('hadron-build:verify');
const verify = require('../lib/verify');

exports.command = 'verify [options]';
exports.describe = 'Verify the current environment meets the app\'s requirements.';
exports.handler = (argv) => {
  verify(argv).catch((err) => cli.abortIfError(err));
};

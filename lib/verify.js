const pify = require('pify');
const run = pify(require('electron-installer-run'));
const checkPython = pify(require('check-python'));
const semver = require('semver');

function checkNpmAndNodejsVersions(opts) {
  const expectNodeVersion = opts.nodejs_version || '^6.3.0';
  const expectNpmVersion = opts.npm_version || '^3.0.0';

  const args = ['version', '--json', '--loglevel', 'error'];
  return run('npm', args, {env: process.env})
    .then((stdout) => {
      const versions = JSON.parse(stdout);

      /**
       * TODO (imlucas) Improve language and provide links to fix issues.
       */
      if (!semver.satisfies(versions.node, expectNodeVersion)) {
        return new Error(`Your current node.js (v${versions.node}) ` +
          `does not satisfy the version required by this project (v${expectNodeVersion}).`);
      } else if (!semver.satisfies(versions.npm, expectNpmVersion)) {
        return new Error(`Your current npm (v${versions.npm}) ` +
          `does not meet the requirement ${expectNpmVersion}.`);
      }

      return versions;
    });
}

module.exports = function(target) {
  return checkPython().then(() => checkNpmAndNodejsVersions(target));
};

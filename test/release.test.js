'use strict';

const path = require('path');
process.env.CWD = path.join(__dirname, 'fixtures', 'hadron-app');

const _ = require('lodash');
const hadronBuild = require('../');
const commands = hadronBuild;
const fs = require('fs-extra');
const assert = require('assert');

const withDefaults = (argv) => {
  _.defaults(argv, {
    cwd: path.join(__dirname, 'fixtures', 'hadron-app')
  });
  const config = require('../lib/config');
  const defaults = _.mapValues(config.options, (v) => v.default);
  _.defaults(argv, defaults);

  const cli = require('mongodb-js-cli')('hadron-build:release:test');
  cli.argv = argv;
  let CONFIG = config.get(cli);
  return CONFIG;
};

describe('hadron-build::release', function() {
  this.timeout(60000);
  var CONFIG; /* eslint no-unused-vars:0 */

  before( (done) => {
    if (process.platform !== 'darwin') {
      return this.skip();
    }

    fs.remove(path.join(__dirname, 'fixtures', 'hadron-app', 'dist'), (_err) => {
      if (_err) {
        return done(_err);
      }
      commands.release.run(withDefaults({}), (err, _config) => {
        if (err) {
          return done(err);
        }
        CONFIG = _config;
        done();
      });
    });
  });

  it('should symlink `Electron` to the app binary on OS X', function(done) {
    if (CONFIG.platform !== 'darwin') {
      return this.skip();
    }

    const bin = path.join(CONFIG.appPath, 'MacOS', 'Electron');
    fs.exists(bin, function(exists) {
      assert(exists, `Expected ${bin} to exist`);
      done();
    });
  });

  /**
   * TODO (imlucas) Compare from `CONFIG.icon` to
   * `path.join(CONFIG.resource, 'electron.icns')` (platform specific).
   * Should have matching md5 of contents.
   */
  it('should have the correct application icon');
});

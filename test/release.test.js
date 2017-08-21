const hadronBuild = require('../');
const commands = hadronBuild;
const fs = require('fs-extra');
const plist = require('plist');
const assert = require('assert');

const path = require('path');
const getConfig = require('./helpers').getConfig;

if (process.platform === 'win32') {
  // Functional tests on appveyor too slow. Skipping.
} else {
  describe('hadron-build::release', function() {
    this.timeout(300000);
    var target = null;

    before(function(done) {
      fs.remove(path.join(__dirname, 'fixtures', 'hadron-app', 'dist'), (_err) => {
        if (_err) {
          return done(_err);
        }
        target = getConfig();
        commands.release.run(target, done);
      });
    });

    it('should symlink `Electron` to the app binary on OS X', function(done) {
      if (target.platform !== 'darwin') {
        return this.skip();
      }
      const bin = target.dest(`${target.productName}-darwin-x64`, `${target.productName}.app`, 'Contents', 'MacOS', 'Electron');
      fs.exists(bin, function(exists) {
        assert(exists, `Expected ${bin} to exist`);
        done();
      });
    });

    it('has the correct product name', () => {
      assert.equal(target.productName, 'MongoDB Compass Enterprise super long test name Beta');
    });

    it('sets the correct CFBundleIdentifier', () => {
      if (target.platform !== 'darwin') {
        return this.skip();
      }
      const info = target.dest(`${target.productName}-darwin-x64`, `${target.productName}.app`, 'Contents', 'Info.plist');
      const config = plist.parse(fs.readFileSync(info, 'utf8'));
      assert.equal(config.CFBundleIdentifier, 'com.mongodb.hadron.beta');
    });

    /**
     * TODO (imlucas) Compare from `CONFIG.icon` to
     * `path.join(CONFIG.resource, 'electron.icns')` (platform specific).
     * Should have matching md5 of contents.
     */
    it('should have the correct application icon');

    it('should have all assets specified in the manifest', () => {
      target.assets.map(function(asset) {
        it(`should have created \`${asset.name}\``, (done) => {
          fs.exists(asset.path, function(exists) {
            assert(exists, `Asset file should exist at ${asset.path}`);
            done();
          });
        });
      });
    });
  });
}

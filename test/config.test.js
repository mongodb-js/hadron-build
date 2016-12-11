'use strict';
/* eslint no-unused-vars: 1 */
const _ = require('lodash');
const config = require('../lib/config');
const chai = require('chai');
const expect = chai.expect;

const getConfig = (argv) => {
  const cli = require('mongodb-js-cli')('hadron-build:config');
  const defaults = _.mapValues(config.options, (v) => v.default);
  _.defaults(argv, defaults);
  cli.argv = argv;
  return config.get(cli);
};

// const windows = ()

describe('hadron-build::config', () => {
  describe('Only on macOS', () => {
    const macOS = {
      version: '1.2.0',
      product_name: 'Hadron',
      app_bundle_id: 'com.mongodb.hadron',
      platform: 'darwin'
    };

    it('should set app-bundle-id', () => {
      expect(getConfig(macOS).packagerOptions['app-bundle-id']).to.equal('com.mongodb.hadron');
    });

    it('should automatically support release channels for app-bundle-id', () => {
      let beta = getConfig(_.defaults({version: '1.2.0-beta.1'}, macOS));
      expect(beta.packagerOptions['app-bundle-id']).to.equal('com.mongodb.hadron.beta');

      let alpha = getConfig(_.defaults({version: '1.2.0-alpha.1'}, macOS));
      expect(alpha.packagerOptions['app-bundle-id']).to.equal('com.mongodb.hadron.alpha');
    });

    // it('should use the cannonical for Stable releases', () => {
    //   let res = getConfig({version: '1.2.0', product_name: 'Hadron'});
    //   expect(res.packagerOptions.name).to.equal('Hadron');
    //   expect(res.channel).to.equal('stable');
    // });
    //
    // describe('For releases *not* on the stable channel', () => {
    //   it('should detect Beta releases and ', () => {
    //     let res = getConfig({version: '1.2.0-beta.1', product_name: 'Hadron'});
    //     expect(res.packagerOptions.name).to.equal('Hadron Beta');
    //     expect(res.channel).to.equal('beta');
    //   });
    //
    //   it('should allow for release channels other than Beta', () => {
    //     let alpha = getConfig({version: '1.2.0-alpha.1', product_name: 'Hadron'});
    //     expect(alpha.packagerOptions.name).to.equal('Hadron Alpha');
    //     expect(alpha.channel).to.equal('alpha');
    //
    //     let rc = getConfig({version: '1.2.0-custom.5', product_name: 'Hadron'});
    //     expect(rc.packagerOptions.name).to.equal('Hadron Custom');
    //     expect(rc.channel).to.equal('custom');
    //   });
    // });
  });

  describe('Only on Linux', () => {
    const linux = {
      name: 'hadron',
      version: '1.2.0',
      product_name: 'Hadron',
      platform: 'linux'
    };

    it('should use a dasherized name', () => {
      let res = getConfig(linux);
      expect(res.packagerOptions.name).to.equal('hadron');
    });
  });

  describe('Only on Windows', () => {
    const windows = {
      version: '1.2.0',
      product_name: 'Hadron',
      platform: 'win32',
      author: 'MongoDB Inc'
    };

    let res;
    before( () => {
      res = getConfig(windows);
    });
    it('should have the platform specific packager options', () => {
      let versionString = res.packagerOptions['version-string'];
      expect(versionString).to.be.a('object');
      expect(versionString.CompanyName).to.equal('MongoDB Inc');
      expect(versionString.FileDescription).to.be.a('string');
      expect(versionString.ProductName).to.be.a('string');
      expect(versionString.InternalName).to.be.a('string');
    });

    it('should have the platform specific evergreen expansions', () => {
      expect(res.windows_msi_filename).to.equal('HadronSetup.msi');
      expect(res.windows_setup_filename).to.equal('HadronSetup.exe');
      expect(res.windows_zip_filename).to.equal('Hadron-windows.zip');
      expect(res.windows_nupkg_full_filename).to.equal('Hadron-1.2.0-full.nupkg');
      expect(res.windows_nupkg_full_label).to.equal('Hadron-1.2.0-full.nupkg');
    });

    it('should have the platform specific installer options', () => {
      let opts = res.installerOptions;
      expect(opts).to.have.property('loadingGif');
      expect(opts).to.have.property('signWithParams');
      expect(opts).to.have.property('iconUrl');
      expect(opts).to.have.property('appDirectory');
      expect(opts).to.have.property('outputDirectory');
      expect(opts).to.have.property('authors');
      expect(opts).to.have.property('version');
      expect(opts).to.have.property('exe');
      expect(opts).to.have.property('setupExe');
      expect(opts).to.have.property('title');
      expect(opts).to.have.property('productName');
      expect(opts).to.have.property('description');
      expect(opts).to.have.property('name');
    });

    describe('For non-stable channel releases', () => {
      let custom;
      before( () => {
        custom = getConfig({
          version: '1.2.0-custom.5',
          name: 'hadron',
          product_name: 'Hadron',
          platform: 'win32',
          author: 'MongoDB Inc'
        });
      });

      it('should append the channel name to the product name', () => {
        let versionString = custom.packagerOptions['version-string'];
        expect(versionString.ProductName).to.equal('Hadron Custom');
      });

      it('should include the channel name in asset filenames', () => {
        expect(custom.windows_msi_filename).to.equal('Hadron CustomSetup.msi');
        expect(custom.windows_setup_filename).to.equal('Hadron CustomSetup.exe');
        expect(custom.windows_zip_filename).to.equal('Hadron Custom-windows.zip');
        expect(custom.windows_nupkg_full_filename).to.equal('HadronCustom-1.2.0-custom5-full.nupkg');
      });
    });
  });
});

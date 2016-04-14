#!/usr/bin/env node
const Promise = require('bluebird');
const State = require('ampersand-state');
const path = require('path');
const _ = require('lodash');
const async = require('async');
const createDMG = require('electron-installer-dmg');
const codesign = require('electron-installer-codesign');
const electronWinstaller = require('electron-winstaller');
const pkg = require('./package');

var Config = State.extend({
  properties: {
    commit_sha1: {
      type: 'string'
    },
    github_token: {
      type: 'string'
    },
    sourcedir: {
      type: 'string'
    },
    out: {
      type: 'string'
    },
    pkg: {
      type: 'object',
      default: function() {
        return null;
      }
    },
    electron_version: {
      type: 'string',
      default: function() {
        return require('electron-prebuilt/package.json').version;
      }
    },
    platform: {
      type: 'string',
      default: function() {
        return process.platform;
      }
    },
    arch: {
      type: 'string',
      fn: function() {
        return process.arch;
      }
    },
    assets: {
      type: 'array',
      default: function() {
        return [];
      }
    },
    version: {
      type: 'string',
      deps: ['pkg'],
      fn: function() {
        return _.get(this.pkg, 'version');
      }
    },
    pkg_product_name: {
      type: 'string',
      deps: ['pkg'],
      fn: function() {
        return _.get(this.pkg, ['productName', 'product_name']);
      }
    },
    name: {
      type: 'string',
      deps: ['pkg'],
      fn: function() {
        return _.get(this.pkg, 'name');
      }
    },
    internal_name: {
      type: 'string',
      deps: ['pkg'],
      fn: function() {
        return _.get(this.pkg, ['internal_name', 'internalName', 'name']);
      }
    },
    copyright: {
      type: 'string',
      deps: ['pkg', 'author'],
      fn: function() {
        return _.get(this.pkg, 'copyright',
          `${this.author}, ${new Date().getFullYear()}`);
      }
    },
    author: {
      type: 'string',
      deps: ['pkg'],
      fn: function() {
        return _.get(this.pkg, ['author', 'authors']);
      }
    },
  },
  derived: {
    out: {
      deps: ['sourcedir'],
      fn: function() {
        return path.join(this.sourcedir, 'dist');
      }
    },
    icon: {
      deps: ['sourcedir', 'pkg', 'platform'],
      fn: function() {
        var p = _.get(pkg, `config.hadron.build.${this.platform}.icon`);
        if (p) {
          return path.resolve(this.sourcedir, p);
        }
      }
    },
    channel: {
      deps: ['version'],
      fn: function() {
        if (!this.version) {
          return undefined;
        }
        if (this.version.indexOf('-beta') > -1) {
          return 'beta';
        }
        if (this.version.indexOf('-dev') > -1) {
          return 'dev';
        }
        return 'stable';
      }
    },
    product_name: {
      deps: ['channel', 'pkg_product_name'],
      fn: function() {
        if (this.channel === 'beta') {
          return `${this.pkg_product_name} (Beta)`;
        }
        if (this.channel === 'dev') {
          return `${this.pkg_product_name} (Development)`;
        }
        return this.pkg_product_name;
      }
    },
    common_packager_options: {
      deps: ['sourcedir', 'icon', 'out', 'name', 'author', 'version', 'platform', 'arch', 'electron_version'],
      fn: function() {
        return {
          name: this.name,
          icon: this.icon,
          dir: this.sourcedir,
          out: this.out,
          overwrite: true,
          'app-copyright': this.copyright,
          'build-version': this.version,
          'app-version': this.version,
          ignore: new RegExp('node_modules/|.cache/|dist/|test/|.user-data'),
          platform: this.platform,
          arch: this.arch,
          version: this.electron_version,
          sign: null
        };
      }
    },
    packager_options: {
      deps: ['common_packager_options'],
      fn: function() {
        return this.common_packager_options;
      }
    },
    packager_basename: {
      deps: ['name', 'arch', 'platform', 'out'],
      fn: function() {
        return path.join(this.out, `${this.name}-${this.platform}-${this.arch}`);
      }
    },
    resources: {
      deps: ['packager_basename', 'out'],
      fn: function() {
        return path.join(this.out, this.packager_basename, 'resources');
      }
    },
    installer_options: {
      fn: function() {
        return {};
      }
    }
  },
  dist: function(filename) {
    if (this.sourcedir) {
      return path.join(this.sourcedir, 'dist', filename);
    }
  },
  initialize: function(opts) {
    this.sourcedir = opts.sourcedir;
    this.set({
      pkg: pkg.get(opts.sourcedir)
    });
    this.version = _.get(this.pkg, 'version');
    this.pkg_product_name = _.get(this.pkg, ['productName', 'product_name']);
    this.name = _.get(this.pkg, 'name');
    this.internal_name = _.get(this.pkg, ['internal_name', 'internalName', 'name']);
    this.author = _.get(this.pkg, ['author', 'authors']);
    this.copyright = _.get(this.pkg, 'copyright',
      `${this.author}, ${new Date().getFullYear()}`);

    console.log('linitialize', opts, this.toJSON());
  },
  serialize: function() {
    return this.getAttributes({props: true, derived: true}, true);
  }
});

var WindowsConfig = Config.extend({
  signtool_params: {
    default: null
  },
  derived: {
    favicon_url: {
      deps: ['pkg', 'sourcedir'],
      fn: function() {
        var p = _.get(this.pkg, 'config.hadron.build.win32.favicon_url');
        if (p) {
          return path.resolve(this.sourcedir, p);
        }
      }
    },
    loading_gif: {
      deps: ['pkg', 'sourcedir'],
      fn: function() {
        var p = _.get(pkg, `config.hadron.build.win32.icon`);
        if (p) {
          return path.resolve(this.sourcedir, p);
        }
      }
    },
    packager_options: {
      deps: ['common_packager_options', 'author', 'product_name', 'internal_name'],
      fn: function() {
        return _.extend(this.common_packager_options, {
          'version-string': {
            CompanyName: this.author,
            FileDescription: this.description,
            ProductName: this.product_name,
            InternalName: this.internal_name
          }
        });
      }
    },
    installer_options: {
      deps: ['loading_gif', 'signtool_params', 'sourcedir', 'favicon_url', 'packager_basename'],
      fn: function() {
        return {
          loadingGif: this.loading_gif,
          signWithParams: this.signtool_params,
          iconUrl: this.favicon_url,
          appDirectory: this.packager_basename,
          outputDirectory: path.join(this.sourcedir, 'dist')
          /**
           * TODO (imlucas) Uncomment when hadron-endpoint-server deployed.
           * remoteReleases: _.get(pkg, 'config.hadron.endpoint'),
           * remoteToken: process.env.GITHUB_TOKEN,
           */
          /**
           * TODO (imlucas) The ICO file to use as the icon for the
           * generated Setup.exe. Defaults to the weird
           * "present" icon @thomasr mentioned:
           *  https://raw.githubusercontent.com/Squirrel/Squirrel.Windows/master/src/Setup/Setup.ico
           * setupIcon: WINDOWS_ICON
           */
        };
      }
    }
  },
  initialize: function(opts) {
    Config.prototype.initialize.call(this, opts);
    this.assets = [
      {
        name: `${this.product_name}Setup.msi`,
        path: this.dist(`${this.name}Setup.msi`)
      },
      {
        name: `${this.product_name}Setup.exe`,
        path: this.dist(`${this.name}Setup.exe`)
      },
      {
        name: `RELEASES`,
        path: this.dist('RELEASES')
      },
      {
        name: `${this.name}-${this.version}-full.nupkg`,
        path: this.dist(`${this.name}-${this.version}-full.nupkg`)
      },
      {
        name: `${this.name}-windows.zip`,
        path: this.dist(`${this.name}-windows.zip`)
      }
      /**
       * TODO (imlucas) Uncomment when hadron-endpoint-server deployed.
       path.join(CONFIG.out, format('%s-%s-delta.nupkg', WINDOWS_APPNAME, CONFIG['app-version']));
       */
    ];
  },
  createInstaller: function() {
    return electronWinstaller.createWindowsInstaller(this.installer_options);
  }
});

var DarwinConfig = Config.extend({
  derived: {
    packager_options: {
      deps: ['common_packager_options', 'pkg', 'product_name', 'internal_name'],
      fn: function() {
        return _.extend(this.common_packager_options, {
          'app-bundle-id': _.get(this.pkg, 'config.hadron.build.darwin.app_bundle_id'),
          'app-category-type': _.get(this.pkg, 'config.hadron.build.darwin.app_category_type'),
          protocols: _.get(this.pkg, 'config.hadron.protocols')
        });
      }
    },
    resources: {
      deps: ['packager_basename', 'out', 'product_name'],
      fn: function() {
        return path.join(this.out, this.packager_basename,
            `${this.product_name}.app`, 'Contents', 'Resources');
      }
    },
    appPath: {
      deps: ['packager_basename', 'out', 'product_name'],
      fn: function() {
        return path.join(this.out, this.packager_basename,
            `${this.product_name}.app`);
      }
    },
    installer_options: {
      deps: ['sourcedir', 'out', 'icon', 'appPath'],
      fn: function() {
        if (this.sourcedir) {
          return undefined;
        }
        return {
          overwrite: true,
          out: this.out,
          icon: this.icon,
          identity_display: _.get(this.pkg, 'config.hadron.build.darwin.codesign_identity'),
          identity: _.get(this.pkg, 'config.hadron.build.darwin.codesign_sha1'),
          appPath: this.appPath,
          /**
           * Background image for `.dmg`.
           * @see http://npm.im/electron-installer-dmg
           */
          background: path.resolve(this.sourcedir,
            _.get(this.pkg, 'config.hadron.build.darwin.dmg_background')),
          /**
           * Layout for `.dmg`.
           * The following only modifies "x","y" values from defaults.
           * @see http://npm.im/electron-installer-dmg
           */
          contents: [
            /**
             * Show a shortcut on the right to `Applications` folder.
             */
            {
              x: 450,
              y: 344,
              type: 'link',
              path: '/Applications'
            },
            /**
             * Show a shortcut on the left for the application icon.
             */
            {
              x: 192,
              y: 344,
              type: 'file',
              path: this.appPath
            }
          ]
        };
      }
    },
    assets: {
      deps: ['name', 'sourcedir'],
      fn: function() {
        return [
          {
            name: `${this.name}.dmg`,
            path: this.dist(`${this.name}.dmg`)
          },
          {
            name: `${this.name}-mac.zip`,
            path: this.dist(`${this.name}-mac.zip`)
          }
        ];
      }
    }
  },
  createInstaller: function() {
    var p = Promise.defer();
    var tasks = [];
    var opts = this.installer_options;
    codesign.isIdentityAvailable(opts.identity_display, function(err, available) {
      if (err) {
        return p.reject(err);
      }
      if (available) {
        tasks.push(_.partial(codesign, {
          identity: opts.identity,
          appPath: opts.appPath
        }));
      } else {
        codesign.printWarning();
      }

      tasks.push(_.partial(createDMG, opts));
      async.series(tasks, function(_err) {
        if (err) return p.reject(_err);
        p.resolve();
      });
    });
    return p.promise;
  }
});

var LinuxConfig = Config.extend({
  createInstaller: function() {
    /* eslint no-console: 0 */
    console.warn('Linux installers coming soon!');
    return Promise.resolve();
  }
});

exports.get = function(opts) {
  _.defaults(opts || {}, {
    platform: process.platform,
    sourcedir: process.cwd()
  });
  if (opts.platform === 'darwin') {
    return new DarwinConfig(opts);
  }
  if (opts.platform === 'win32') {
    return new WindowsConfig(opts);
  }
  return new LinuxConfig(opts);
};

module.exports = exports;

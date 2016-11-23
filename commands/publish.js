const got = require('got');
const _ = require('lodash');
const untildify = require('untildify');

const version = require(untildify('~/compass/package.json')).version;
const MANIFEST_PATH = untildify('~/compass/compass.json');
// const beta = version.indexOf('beta') >= -1;
// const channel = beta ? 'Beta' : 'Stable';

const Listr = require('listr');

const prettyOS = (os) => {
  if (os === 'darwin') {
    return 'macOS';
  }

  if (os === 'win32') {
    return 'Windows';
  }

  if (os === 'linux') {
    return 'Linux';
  }
  return `Unknown OS (${os})`;
};

class Manifest {
  constructor(data) {
    this.url = 'https://s3.amazonaws.com/info-mongodb-com/com-download-center/compass.json';
    this.versions = data.versions;
    this.contents = JSON.stringify(data, null, 2);

    this.links = {
      'Manual': _.get(data, 'manual_link'),
      'Release Notes': _.get(data, 'release_notes_link'),
      'Previous Releases': _.get(data, 'previous_releases_link'),
      'Development Releases': _.get(data, 'development_releases_link'),
      'Supported Browsers': _.get(data, 'supported_browsers_link'),
      'Tutorial': _.get(data, 'tutorial_link')
    };
  }

  validate() {
    const checkDownloadLinks = _.map(this.versions, (v) => {
      return {
        title: `${v._id} download links`,
        task: () => {
          return new Listr(_.map(v.platform, (p) => {
            return {
              title: `${prettyOS(p.os)} installer`,
              task: () => got.head(p.download_link)
            };
          }));
        }
      };
    });

    const checkOtherLinks = _.map(this.links, (url, name) => {
      return {
        title: `${name} link`,
        skip: () => {
          if (_.isEmpty(url)) {
            return 'None specified';
          }
        },
        task: () => got.head(url)
      };
    });

    return new Listr(_.concat(checkDownloadLinks, checkOtherLinks));
  }

  publish() {
    return new Listr([
      {
        title: 'Manifest Exists',
        task: () => got.head(this.url)
      }
    ]);
  }
}

const manifest = new Manifest(require(MANIFEST_PATH));

const tasks = new Listr([
  {
    title: `Release ${version}`,
    task: () => {
      return new Listr([
        {
          title: 'Validate Manifest',
          task: () => manifest.validate()
        },
        {
          title: 'Publish Manifest',
          task: () => manifest.publish()
        },
        {
          title: 'Publish GitHub release',
          skip: () => 'Not Implemented',
          task: () => {
            return new Promise((resolve) => {
              setTimeout( () => {
                resolve(`https://github.com/10gen/compass/releases/tag/v${version}`);
              }, 2000);
            });
          }
        },
        {
          title: 'Notify',
          skip: () => 'Not Implemented',
          task: () => Promise.resolve('email compass-announce@?')
        }
      ]);
    }
  }
]);

tasks.run().catch(err => {
  console.error(err);
});

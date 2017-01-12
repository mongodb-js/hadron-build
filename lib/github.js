'use strict';

/**
 * Upload release assets to GitHub and S3.
 */
const Promise = require('bluebird');
const _ = require('lodash');
const GitHubApiClient = require('github');
const github = new GitHubApiClient({version: '3.0.0', 'User-Agent': 'hadron-build'});
const debug = require('debug')('hadron-build:github');

class GitHub {
  constructor(target) {
    this.id = target.id;
    this.owner = target.github_owner;
    this.repo = target.github_repo;
    this.version = target.version;
    this.target_commitish = target.target_commitish;
    this.token = target.github_token;
    this.channel = target.channel;
    this.assets = target.assets;
  }

  _exec() {
    if (this.channel === 'dev') {
      debug('Skipping publish GitHub release for dev channel.');
      return Promise.resolve(false);
    }

    if (!this.token) {
      debug('Skipping publish release because github_token not set.');
      return Promise.resolve(false);
    }

    github.authenticate({token: this.token, type: 'oauth'});

    return this.getOrCreateRelease(this.version).then((release) => {
      return Promise.all(this.assets.map((asset) => this.upload(release, asset)));
    });
  }

  createRelease() {
    var opts = {
      owner: this.owner,
      repo: this.repo,
      draft: true,
      tag_name: `v${this.version}`,
      name: this.version,
      target_commitish: this.target_commitish,
      body: `### Notable Changes
      * Something new
      `
    };

    debug('Creating release', opts);
    return new Promise((resolve, reject) => {
      github.repos.createRelease(opts, function(err, res) {
        if (err) return reject(err);

        debug('Created release', res);
        resolve(res);
      });
    });
  }

  getRelease(version) {
    return new Promise((resolve, reject) => {
      const opts = {
        owner: this.owner,
        repo: this.repo
      };

      github.repos.getReleases(opts, (err, releases) => {
        if (err) {
          return reject(err);
        }

        let existing = _.find(releases, (release) => release.name === version);
        if (existing) {
          debug(`Found existsing release for ${version}`, existing);
          return resolve(existing);
        }
        return resolve();
      });
    });
  }

  getOrCreateRelease(version) {
    return this.getRelease(version).then((release) => {
      return release || this.createGitHubRelease(version);
    });
  }

  _upload(release, asset) {
    const opts = {
      owner: this.owner,
      repo: this.repo,
      id: release.id,
      name: asset.name,
      filePath: asset.path
    };

    debug(`Uploading ${asset.name}`);
    return new Promise((resolve, reject) => {
      github.repos.uploadAsset(opts, function(err, res) {
        if (err) {
          err.stack = err.stack || '<no stacktrace>';
          debug(`Failed to upload ${asset.name}`);
          return reject(err);
        }

        debug('Asset upload returned', res);
        debug(`Uploaded ${asset.name}`);
        resolve(asset);
      });
    });
  }

  upload(release, asset) {
    if (release.draft === true) {
      return this.removeIfExists(release, asset)
        .then(() => this._upload(release, asset));
    }

    const existing = _.chain(release.assets)
      .filter((a) => a.name === asset.name)
      .first()
      .value();

    if (existing) {
      debug('Asset already exists and release is currently not a draft.  skipping.', existing);
      return Promise.resolve(existing);
    }

    return this._upload(release, asset);
  }

  removeIfExists(release, asset) {
    const existing = _.chain(release.assets)
      .filter((a) => a.name === asset.name)
      .first()
      .value();

    if (!existing) {
      return Promise.resolve(false);
    }

    debug(`Removing existing asset ${asset.name}`);
    const opts = {
      owner: this.owner,
      repo: this.repo,
      id: existing.id
    };

    return new Promise((resolve, reject) => {
      github.repos.deleteAsset(opts, (err, res) => {
        if (err) return reject(err);
        debug('Asset deleted', res);
        return resolve(true);
      });
    });
  }
}

module.exports.upload = function(target) {
  return new GitHub(target)._exec();
};

'use strict';

const _ = require('lodash');
const fs = require('fs-extra');
const debug = require('debug')('mongodb-download-center');
const AWS = require('aws-sdk');

const MANIFEST_BUCKET = 'info-mongodb-com';

let upload = (CONFIG, asset) => {
  const params = {
    Bucket: 'downloads.10gen.com',
    Key: `${CONFIG.download_center_key_prefix}/${asset.name}`,
    Body: fs.createReadStream(asset.path),
    ACL: 'public-read',
    Metadata: {
      Name: asset.name
    }
  };

  const req = new AWS.S3.ManagedUpload({
    params: params
  });
  return new Promise((resolve, reject) => {
    req.send(function(err, data) {
      if (err) {
        debug(`uploading ${asset.name} failed: ${err}`);
        return reject(err);
      }
      debug(`upload of ${asset.name} complete`);
      resolve(data);
    });
    req.on('httpUploadProgress', (evt) => {
      debug('got httpUploadProgress', evt);
      if (!evt.total) return;
      debug(`upload ${asset.name}: ${evt.total / evt.loaded}`);
    });
  });
};

let requireEnvironmentVariables = (keys) => {
  for (let key of keys) {
    if (process.env[key]) return true;
    throw new TypeError(`Please set the environment variable ${key}`);
  }
};

let maybeUploadManifest = (CONFIG) => {
  const prefix = `https://downloads.mongodb.com/${CONFIG.download_center_id}/${CONFIG.channel}`;
  const bucket = 'info-mongodb-com';
  const key = `com-download-center/${CONFIG.download_center_id}/${CONFIG.version}.json`;

  const MANIFEST = {
    version: CONFIG.version,
    channel: CONFIG.channel,
    platform: [
      {
        name: 'OS X 10.10+ 64-bit',
        download_link: `${prefix}/${CONFIG.id}-${CONFIG.version}-darwin-x64.dmg`
      },
      {
        name: 'Windows 7+ 64-bit',
        download_link: `${prefix}/${CONFIG.id}-${CONFIG.version}-win32-x64.exe`
      }
    ],
    development_releases_link: `https://${CONFIG.download_center_id}.mongodb.com/beta`,
    manual_link: `https://${CONFIG.download_center_id}.mongodb.com/docs`,
    release_notes_link: `https://${CONFIG.download_center_id}.mongodb.com/releases/${CONFIG.version}`,
    previous_releases_link: `https://${CONFIG.download_center_id}.mongodb.com/releases`,
    supported_browsers_link: '',
    tutorial_link: ''
  };

  return new Promise((resolve, reject) => {
    const req = new AWS.S3({
      params: {
        Bucket: bucket,
        Key: key
      }
    });
    req.headObject( (err, data) => {
      if (data) {
        debug(`Manifest for ${CONFIG.version} already exists`, data);
        return resolve(data);
      }

      if (err && err.code !== 'NotFound') {
        return reject(err);
      }
      debug(`Uploading manifest for ${CONFIG.version}`);
      req.upload({Body: JSON.stringify(MANIFEST, null, 2)}, (_err) => {
        if (_err) return reject(_err);
        resolve(MANIFEST);
      });
    });
  });
};

let setup = () => {
  requireEnvironmentVariables([
    'DOWNLOAD_CENTER_AWS_ACCESS_KEY_ID',
    'DOWNLOAD_CENTER_AWS_SECRET_ACCESS_KEY'
  ]);

  AWS.config.update({
    accessKeyId: process.env.DOWNLOAD_CENTER_AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.DOWNLOAD_CENTER_AWS_SECRET_ACCESS_KEY
  });
};

exports.maybeUpload = (CONFIG) => {
  setup();

  CONFIG.download_center_id = _.tail(CONFIG.id.split('-'));
  CONFIG.download_center_key_prefix = CONFIG.download_center_id;
  if (CONFIG.channel !== 'stable') {
    CONFIG.download_center_key_prefix += `/${CONFIG.channel}`;
  }

  return Promise.all(CONFIG.assets.map( (asset) => upload(CONFIG, asset)))
    .then(maybeUploadManifest(CONFIG));
};

exports.release = (id, version) => {
  setup();

  return new Promise((resolve, reject) => {
    if (version.indexOf('-dev') > -1) {
      debug(`We dont' post dev channel releases to the download center.`);
      return resolve(false);
    }
    let channel = version.indexOf('-beta') > -1 ? 'beta' : 'stable';
    let dest = `com-download-center/${id}_${version.indexOf('-beta') > -1 ? '_beta' : ''}_latest.json`;
    let src = `com-download-center/${id}/${version}.json`;
    const s3 = new AWS.S3({
      params: {
        Bucket: MANIFEST_BUCKET,
        Key: src
      }
    });

    s3.headObject( (err, data) => {
      if (data) {
        debug(`copying ${src} -> ${dest}`);
        return s3.copyObject({
          Bucket: MANIFEST_BUCKET,
          Key: dest,
          CopySource: src
        }, (_err, res) => {
          if (_err) return reject(_err);

          if (channel === 'stable') {
            debug(`:dancers: ${id}@${version} is now available in the download center.`);
          }
          resolve(res);
        });
      }

      if (err && err.code !== 'NotFound') {
        return reject(err);
      }

      return reject(new Error(`No manifest found for ${id}@${version}`));
    });
  });
};
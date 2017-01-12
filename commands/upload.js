'use strict';

/**
 * Upload release assets to GitHub and S3.
 */
const GitHub = require('github');
const github = new GitHub({version: '3.0.0', 'User-Agent': 'hadron-build'});
const cli = require('mongodb-js-cli')('hadron-build:upload');
const abortIfError = cli.abortIfError.bind(cli);
const Target = require('../lib/target');

const downloadCenter = require('../lib/download-center');

exports.command = 'upload [options]';

exports.describe = 'Upload assets from `release`.';

exports.builder = {
  dir: {
    description: 'Project root directory',
    default: process.cwd()
  }
};

exports.handler = function(argv) {
  cli.argv = argv;
  var target = new Target(argv.dir);

  var fs = require('fs');
  target.assets = target.assets.filter(function(asset) {
    var exists = fs.existsSync(asset.path);
    if (!exists) {
      cli.warn(`Excluding ${asset.path} from upload because it does not exist.`);
    }
    return exists;
  });
  github.upload(target).then(() => downloadCenter.maybeUpload(target)).catch(abortIfError);
};

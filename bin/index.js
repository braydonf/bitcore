#!/usr/bin/env node

'use strict';

var path = require('path');
var semver = require('semver');
var Liftoff = require('liftoff');
var cliPackage = require('../package.json');

var liftoff = new Liftoff({
  name: 'bitcore',
  moduleName: 'bitcore-node',
  configName: 'bitcore-node',
  processTitle: 'bitcore'
}).on('require', function (name, module) {
  console.log('Loading:', name);
}).on('requireFail', function (name, err) {
  console.log('Unable to load:', name, err);
}).on('respawn', function (flags, child) {
  console.log('Detected node flags:', flags);
  console.log('Respawned to PID:', child.pid);
});

liftoff.launch({
  cwd: process.cwd()
}, function(env){

  var node;
  if (env.modulePackage && env.configPath) {
    // use the local version
    var versionRange = env.modulePackage.dependencies.bitcore;
    if (!semver.satisfies(cliPackage.version, versionRange)) {
      throw new Error(
        'Global bitcore version ' + cliPackage.version +
          ' does not satisfy bitcore-node version range ' + versionRange
      );
    }
    node = require(env.modulePath);
    node.cli.main();
  } else {
    // use the global version
    require('./main')();
  }

});

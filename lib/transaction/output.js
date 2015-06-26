'use strict';

var _ = require('lodash');
var BN = require('../crypto/bn');
var buffer = require('buffer');
var bufferUtil = require('../util/buffer');
var JSUtil = require('../util/js');
var BufferWriter = require('../encoding/bufferwriter');
var Script = require('../script');
var $ = require('../util/preconditions');
var errors = require('../errors');

var MAX_SAFE_INTEGER = 0x1fffffffffffff;

function Output(args) {
  if (!(this instanceof Output)) {
    return new Output(args);
  }
  if (_.isObject(args)) {
    if (args._satoshisBuffer) {
      // for lazy loading
      this._satoshisBuffer = args._satoshisBuffer;
    } else {
      this.satoshis = args.satoshis;
    }
    if (bufferUtil.isBuffer(args.script)) {
      this._scriptBuffer = args.script;
    } else {
      if (_.isString(args.script) && JSUtil.isHexa(args.script)) {
        args.script = new buffer.Buffer(args.script, 'hex');
      }
      this.setScript(args.script);
    }
  } else if (JSUtil.isValidJSON(args)) {
    return Output.fromJSON(args);
  } else {
    throw new TypeError('Unrecognized argument for Output');
  }
}

Object.defineProperty(Output.prototype, 'script', {
  configurable: false,
  enumerable: true,
  get: function() {
    if (this._script) {
      return this._script;
    } else {
      this.setScriptFromBuffer(this._scriptBuffer);
      return this._script;
    }

  }
});

Object.defineProperty(Output.prototype, 'satoshis', {
  configurable: false,
  enumerable: true,
  get: function() {
    if (this._satoshis) {
      return this._satoshis;
    } else if (this._satoshisBuffer) {
      this._satoshisBN = new BN(this._satoshisBuffer.toJSON().data, 10, 'le');
      this._satoshis = this._satoshisBN.toNumber();
      return this._satoshis;
    } else if (this._satoshisBN) {
      this._satoshis = this._satoshisBN.toNumber();
      return this._satoshis;
    }
    throw new Error('Satoshis is not defined');
  },
  set: function(num) {
    if (num instanceof BN) {
      this._satoshisBN = num;
      this._satoshis = num.toNumber();
    } else if (_.isString(num)) {
      this._satoshis = parseInt(num);
      this._satoshisBN = BN.fromNumber(this._satoshis);
    } else {
      $.checkArgument(
        JSUtil.isNaturalNumber(num),
        'Output satoshis is not a natural number'
      );
      this._satoshisBN = BN.fromNumber(num);
      this._satoshis = num;
    }
    $.checkState(
      JSUtil.isNaturalNumber(this._satoshis),
      'Output satoshis is not a natural number'
    );
  }
});

Output.prototype.invalidSatoshis = function() {
  var satoshis = this.satoshis;
  if (satoshis > MAX_SAFE_INTEGER) {
    return 'transaction txout satoshis greater than max safe integer';
  }
  if (satoshis !== this._satoshisBN.toNumber()) {
    return 'transaction txout satoshis has corrupted value';
  }
  if (satoshis < 0) {
    return 'transaction txout negative';
  }
  return false;
};

Output.prototype.toObject = function toObject() {
  var obj = {
    satoshis: this.satoshis
  };
  obj.script = this._scriptBuffer.toString('hex');
  return obj;
};

Output.prototype.toJSON = function toJSON() {
  return JSON.stringify(this.toObject());
};

Output.fromJSON = function(data) {
  $.checkArgument(JSUtil.isValidJSON(data), 'data must be valid JSON');
  var json = JSON.parse(data);
  return new Output({
    satoshis: Number(json.satoshis),
    script: new Script(json.script)
  });
};

Output.prototype.setScriptFromBuffer = function(buffer) {
  this._scriptBuffer = buffer;
  try {
    this._script = Script.fromBuffer(this._scriptBuffer);
  } catch(e) {
    if (e instanceof errors.Script.InvalidBuffer) {
      this._script = null;
    } else {
      throw e;
    }
  }
};

Output.prototype.setScript = function(script) {
  if (script instanceof Script) {
    this._scriptBuffer = script.toBuffer();
    this._script = script;
  } else if (_.isString(script)) {
    this._script = Script.fromString(script);
    this._scriptBuffer = this._script.toBuffer();
  } else if (bufferUtil.isBuffer(script)) {
    this.setScriptFromBuffer(script);
  } else {
    throw new TypeError('Invalid argument type: script');
  }
  return this;
};

Output.prototype.inspect = function() {
  var scriptStr;
  if (this.script) {
    scriptStr = this.script.inspect();
  } else {
    scriptStr = this._scriptBuffer.toString('hex');
  }
  return '<Output (' + this.satoshis + ' sats) ' + scriptStr + '>';
};

Output.fromBufferReader = function(br) {
  var obj = {};
  // lazy load the satoshis, only pass the buffer
  obj._satoshisBuffer = br.read(8);
  var size = br.readVarintNum();
  if (size !== 0) {
    obj.script = br.read(size);
  } else {
    obj.script = new buffer.Buffer([]);
  }
  return new Output(obj);
};

Output.prototype.toBufferWriter = function(writer) {
  if (!writer) {
    writer = new BufferWriter();
  }
  // todo: check _satoshis matches _satoshisBuffer
  if (this._satoshisBuffer) {
    $.checkState(this._satoshisBuffer.length === 8, 'Satoshis buffer is an invalid length');
    writer.write(this._satoshisBuffer);
  } else {
    writer.writeUInt64LEBN(this._satoshisBN);
  }
  var script = this._scriptBuffer;
  writer.writeVarintNum(script.length);
  writer.write(script);
  return writer;
};

module.exports = Output;

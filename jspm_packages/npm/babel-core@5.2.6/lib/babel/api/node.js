/* */ 
"format cjs";
"use strict";

var _interopRequire = function (obj) { return obj && obj.__esModule ? obj["default"] : obj; };

var _interopRequireWildcard = function (obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (typeof obj === "object" && obj !== null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj["default"] = obj; return newObj; } };

var _interopRequireDefault = function (obj) { return obj && obj.__esModule ? obj : { "default": obj }; };

exports.__esModule = true;
exports.register = register;
exports.polyfill = polyfill;
exports.transformFile = transformFile;
exports.transformFileSync = transformFileSync;
exports.parse = parse;

var _isFunction = require("lodash/lang/isFunction");

var _isFunction2 = _interopRequireDefault(_isFunction);

var _transform = require("../transformation");

var _transform2 = _interopRequireDefault(_transform);

var _import = require("../../acorn");

var acorn = _interopRequireWildcard(_import);

var _import2 = require("../util");

var util = _interopRequireWildcard(_import2);

var _fs = require("fs");

var _fs2 = _interopRequireDefault(_fs);

var _import3 = require("../types");

var t = _interopRequireWildcard(_import3);

exports.util = util;
exports.acorn = acorn;
exports.transform = _transform2["default"];
exports.pipeline = _transform.pipeline;
exports.canCompile = _import2.canCompile;

var _default = require("../transformation/file/options");

exports.options = _interopRequire(_default);

var _default2 = require("../transformation/transformer");

exports.Transformer = _interopRequire(_default2);

var _default3 = require("../transformation/transformer-pipeline");

exports.TransformerPipeline = _interopRequire(_default3);

var _default4 = require("../traversal");

exports.traverse = _interopRequire(_default4);

var _default5 = require("../tools/build-external-helpers");

exports.buildExternalHelpers = _interopRequire(_default5);

var _version = require("../../../package");

exports.version = _version.version;
exports.types = t;

function register(opts) {
  var callback = require("./register/node-polyfill");
  if (opts != null) callback(opts);
  return callback;
}

function polyfill() {
  require("../polyfill");
}

function transformFile(filename, opts, callback) {
  if (_isFunction2["default"](opts)) {
    callback = opts;
    opts = {};
  }

  opts.filename = filename;

  _fs2["default"].readFile(filename, function (err, code) {
    if (err) return callback(err);

    var result;

    try {
      result = _transform2["default"](code, opts);
    } catch (err) {
      return callback(err);
    }

    callback(null, result);
  });
}

function transformFileSync(filename) {
  var opts = arguments[1] === undefined ? {} : arguments[1];

  opts.filename = filename;
  return _transform2["default"](_fs2["default"].readFileSync(filename), opts);
}

function parse(code) {
  var opts = arguments[1] === undefined ? {} : arguments[1];

  opts.sourceType = "module";
  opts.ecmaVersion = Infinity;
  opts.plugins = {
    flow: true,
    jsx: true
  };
  opts.features = {};

  for (var key in _transform2["default"].pipeline.transformers) {
    opts.features[key] = true;
  }

  return acorn.parse(code, opts);
}
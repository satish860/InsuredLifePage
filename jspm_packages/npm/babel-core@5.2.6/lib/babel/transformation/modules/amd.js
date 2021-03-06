/* */ 
"format cjs";
"use strict";

var _interopRequireWildcard = function (obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (typeof obj === "object" && obj !== null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj["default"] = obj; return newObj; } };

var _interopRequireDefault = function (obj) { return obj && obj.__esModule ? obj : { "default": obj }; };

var _classCallCheck = function (instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } };

var _inherits = function (subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) subClass.__proto__ = superClass; };

exports.__esModule = true;

var _DefaultFormatter2 = require("./_default");

var _DefaultFormatter3 = _interopRequireDefault(_DefaultFormatter2);

var _CommonFormatter = require("./common");

var _CommonFormatter2 = _interopRequireDefault(_CommonFormatter);

var _includes = require("lodash/collection/includes");

var _includes2 = _interopRequireDefault(_includes);

var _values = require("lodash/object/values");

var _values2 = _interopRequireDefault(_values);

var _import = require("../../util");

var util = _interopRequireWildcard(_import);

var _import2 = require("../../types");

var t = _interopRequireWildcard(_import2);

var AMDFormatter = (function (_DefaultFormatter) {
  function AMDFormatter() {
    _classCallCheck(this, AMDFormatter);

    if (_DefaultFormatter != null) {
      _DefaultFormatter.apply(this, arguments);
    }
  }

  _inherits(AMDFormatter, _DefaultFormatter);

  AMDFormatter.prototype.init = function init() {
    _CommonFormatter2["default"].prototype._init.call(this, this.hasNonDefaultExports);
  };

  AMDFormatter.prototype.buildDependencyLiterals = function buildDependencyLiterals() {
    var names = [];
    for (var name in this.ids) {
      names.push(t.literal(name));
    }
    return names;
  };

  /**
   * Wrap the entire body in a `define` wrapper.
   */

  AMDFormatter.prototype.transform = function transform(program) {
    _DefaultFormatter3["default"].prototype.transform.apply(this, arguments);

    var body = program.body;

    // build an array of module names

    var names = [t.literal("exports")];
    if (this.passModuleArg) names.push(t.literal("module"));
    names = names.concat(this.buildDependencyLiterals());
    names = t.arrayExpression(names);

    // build up define container

    var params = _values2["default"](this.ids);
    if (this.passModuleArg) params.unshift(t.identifier("module"));
    params.unshift(t.identifier("exports"));

    var container = t.functionExpression(null, params, t.blockStatement(body));

    var defineArgs = [names, container];
    var moduleName = this.getModuleName();
    if (moduleName) defineArgs.unshift(t.literal(moduleName));

    var call = t.callExpression(t.identifier("define"), defineArgs);

    program.body = [t.expressionStatement(call)];
  };

  /**
   * Get the AMD module name that we'll prepend to the wrapper
   * to define this module
   */

  AMDFormatter.prototype.getModuleName = function getModuleName() {
    if (this.file.opts.moduleIds) {
      return _DefaultFormatter3["default"].prototype.getModuleName.apply(this, arguments);
    } else {
      return null;
    }
  };

  AMDFormatter.prototype._getExternalReference = function _getExternalReference(node) {
    return this.scope.generateUidIdentifier(node.source.value);
  };

  AMDFormatter.prototype.importDeclaration = function importDeclaration(node) {
    this.getExternalReference(node);
  };

  AMDFormatter.prototype.importSpecifier = function importSpecifier(specifier, node, nodes) {
    var key = node.source.value;
    var ref = this.getExternalReference(node);

    if (t.isImportNamespaceSpecifier(specifier) || t.isImportDefaultSpecifier(specifier)) {
      this.defaultIds[key] = specifier.local;
    }

    if (this.isModuleType(node, "absolute")) {} else if (this.isModuleType(node, "absoluteDefault")) {
      // prevent unnecessary renaming of dynamic imports
      this.ids[node.source.value] = ref;
      ref = t.memberExpression(ref, t.identifier("default"));
    } else if (t.isImportNamespaceSpecifier(specifier)) {} else if (!_includes2["default"](this.file.dynamicImported, node) && t.isSpecifierDefault(specifier) && !this.noInteropRequireImport) {
      // import foo from "foo";
      var uid = this.scope.generateUidIdentifier(specifier.local.name);
      nodes.push(t.variableDeclaration("var", [t.variableDeclarator(uid, t.callExpression(this.file.addHelper("interop-require"), [ref]))]));
      ref = uid;
    } else {
      // import { foo } from "foo";
      var imported = specifier.imported;
      if (t.isSpecifierDefault(specifier)) imported = t.identifier("default");
      ref = t.memberExpression(ref, imported);
    }

    this.internalRemap[specifier.local.name] = ref;
  };

  AMDFormatter.prototype.exportSpecifier = function exportSpecifier(specifier, node, nodes) {
    if (this.doDefaultExportInterop(specifier)) {
      this.passModuleArg = true;
      nodes.push(util.template("exports-default-assign", {
        VALUE: specifier.local
      }, true));
    } else {
      _CommonFormatter2["default"].prototype.exportSpecifier.apply(this, arguments);
    }
  };

  AMDFormatter.prototype.exportDeclaration = function exportDeclaration(node, nodes) {
    if (this.doDefaultExportInterop(node)) {
      this.passModuleArg = true;

      var declar = node.declaration;
      var assign = util.template("exports-default-assign", {
        VALUE: this._pushStatement(declar, nodes)
      }, true);

      if (t.isFunctionDeclaration(declar)) {
        // we can hoist this assignment to the top of the file
        assign._blockHoist = 3;
      }

      nodes.push(assign);
      return;
    }

    _DefaultFormatter3["default"].prototype.exportDeclaration.apply(this, arguments);
  };

  return AMDFormatter;
})(_DefaultFormatter3["default"]);

exports["default"] = AMDFormatter;
module.exports = exports["default"];

// absolute module reference

// import * as bar from "foo";
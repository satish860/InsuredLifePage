/* */ 
"format cjs";
"use strict";

var _interopRequireWildcard = function (obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (typeof obj === "object" && obj !== null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj["default"] = obj; return newObj; } };

var _interopRequireDefault = function (obj) { return obj && obj.__esModule ? obj : { "default": obj }; };

exports.__esModule = true;
// Based upon the excellent jsx-transpiler by Ingvar Stepanyan (RReverser)
// https://github.com/RReverser/jsx-transpiler

// jsx

var _isString = require("lodash/lang/isString");

var _isString2 = _interopRequireDefault(_isString);

var _import = require("../../messages");

var messages = _interopRequireWildcard(_import);

var _esutils = require("esutils");

var _esutils2 = _interopRequireDefault(_esutils);

var _import2 = require("./react");

var react = _interopRequireWildcard(_import2);

var _import3 = require("../../types");

var t = _interopRequireWildcard(_import3);

exports["default"] = function (exports, opts) {
  exports.check = function (node) {
    if (t.isJSX(node)) return true;
    if (react.isCreateClass(node)) return true;
    return false;
  };

  exports.JSXIdentifier = function (node, parent) {
    if (node.name === "this" && t.isReferenced(node, parent)) {
      return t.thisExpression();
    } else if (_esutils2["default"].keyword.isIdentifierNameES6(node.name)) {
      node.type = "Identifier";
    } else {
      return t.literal(node.name);
    }
  };

  exports.JSXNamespacedName = function (node, parent, scope, file) {
    throw this.errorWithNode(messages.get("JSXNamespacedTags"));
  };

  exports.JSXMemberExpression = {
    exit: function exit(node) {
      node.computed = t.isLiteral(node.property);
      node.type = "MemberExpression";
    }
  };

  exports.JSXExpressionContainer = function (node) {
    return node.expression;
  };

  exports.JSXAttribute = {
    enter: function enter(node) {
      var value = node.value;
      if (t.isLiteral(value) && _isString2["default"](value.value)) {
        value.value = value.value.replace(/\n\s+/g, " ");
      }
    },

    exit: function exit(node) {
      var value = node.value || t.literal(true);
      return t.inherits(t.property("init", node.name, value), node);
    }
  };

  exports.JSXOpeningElement = {
    exit: function exit(node, parent, scope, file) {
      parent.children = react.buildChildren(parent);

      var tagExpr = node.name;
      var args = [];

      var tagName;
      if (t.isIdentifier(tagExpr)) {
        tagName = tagExpr.name;
      } else if (t.isLiteral(tagExpr)) {
        tagName = tagExpr.value;
      }

      var state = {
        tagExpr: tagExpr,
        tagName: tagName,
        args: args
      };

      if (opts.pre) {
        opts.pre(state, file);
      }

      var attribs = node.attributes;
      if (attribs.length) {
        attribs = buildJSXOpeningElementAttributes(attribs, file);
      } else {
        attribs = t.literal(null);
      }

      args.push(attribs);

      if (opts.post) {
        opts.post(state, file);
      }

      return state.call || t.callExpression(state.callee, args);
    }
  };

  /**
   * The logic for this is quite terse. It's because we need to
   * support spread elements. We loop over all attributes,
   * breaking on spreads, we then push a new object containg
   * all prior attributes to an array for later processing.
   */

  var buildJSXOpeningElementAttributes = function buildJSXOpeningElementAttributes(attribs, file) {
    var _props = [];
    var objs = [];

    var pushProps = function pushProps() {
      if (!_props.length) return;

      objs.push(t.objectExpression(_props));
      _props = [];
    };

    while (attribs.length) {
      var prop = attribs.shift();
      if (t.isJSXSpreadAttribute(prop)) {
        pushProps();
        objs.push(prop.argument);
      } else {
        _props.push(prop);
      }
    }

    pushProps();

    if (objs.length === 1) {
      // only one object
      attribs = objs[0];
    } else {
      // looks like we have multiple objects
      if (!t.isObjectExpression(objs[0])) {
        objs.unshift(t.objectExpression([]));
      }

      // spread it
      attribs = t.callExpression(file.addHelper("extends"), objs);
    }

    return attribs;
  };

  exports.JSXElement = {
    exit: function exit(node) {
      var callExpr = node.openingElement;

      callExpr.arguments = callExpr.arguments.concat(node.children);

      if (callExpr.arguments.length >= 3) {
        callExpr._prettyCall = true;
      }

      return t.inherits(callExpr, node);
    }
  };

  // display names

  var addDisplayName = function addDisplayName(id, call) {
    var props = call.arguments[0].properties;
    var safe = true;

    for (var i = 0; i < props.length; i++) {
      var prop = props[i];
      if (t.isIdentifier(prop.key, { name: "displayName" })) {
        safe = false;
        break;
      }
    }

    if (safe) {
      props.unshift(t.property("init", t.identifier("displayName"), t.literal(id)));
    }
  };

  exports.ExportDefaultDeclaration = function (node, parent, scope, file) {
    if (react.isCreateClass(node.declaration)) {
      addDisplayName(file.opts.basename, node.declaration);
    }
  };

  exports.AssignmentExpression = exports.Property = exports.VariableDeclarator = function (node) {
    var left, right;

    if (t.isAssignmentExpression(node)) {
      left = node.left;
      right = node.right;
    } else if (t.isProperty(node)) {
      left = node.key;
      right = node.value;
    } else if (t.isVariableDeclarator(node)) {
      left = node.id;
      right = node.init;
    }

    if (t.isMemberExpression(left)) {
      left = left.property;
    }

    if (t.isIdentifier(left) && react.isCreateClass(right)) {
      addDisplayName(left.name, right);
    }
  };
};

;
module.exports = exports["default"];
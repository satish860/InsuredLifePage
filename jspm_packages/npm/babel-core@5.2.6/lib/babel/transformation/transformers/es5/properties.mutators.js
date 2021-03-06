/* */ 
"format cjs";
"use strict";

var _interopRequireWildcard = function (obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (typeof obj === "object" && obj !== null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj["default"] = obj; return newObj; } };

exports.__esModule = true;
exports.shouldVisit = shouldVisit;
exports.ObjectExpression = ObjectExpression;

var _import = require("../../helpers/define-map");

var defineMap = _interopRequireWildcard(_import);

var _import2 = require("../../../types");

var t = _interopRequireWildcard(_import2);

function shouldVisit(node) {
  return t.isProperty(node) && (node.kind === "get" || node.kind === "set");
}

function ObjectExpression(node, parent, scope, file) {
  var mutatorMap = {};
  var hasAny = false;

  node.properties = node.properties.filter(function (prop) {
    if (prop.kind === "get" || prop.kind === "set") {
      hasAny = true;
      defineMap.push(mutatorMap, prop, prop.kind, file);
      return false;
    } else {
      return true;
    }
  });

  if (!hasAny) return;

  return t.callExpression(t.memberExpression(t.identifier("Object"), t.identifier("defineProperties")), [node, defineMap.toDefineObject(mutatorMap)]);
}
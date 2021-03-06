/* */ 
"format cjs";
"use strict";

var _interopRequireWildcard = function (obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (typeof obj === "object" && obj !== null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj["default"] = obj; return newObj; } };

exports.__esModule = true;
exports.ArrowFunctionExpression = ArrowFunctionExpression;

var _import = require("../../../types");

var t = _interopRequireWildcard(_import);

var shouldVisit = t.isArrowFunctionExpression;

exports.shouldVisit = shouldVisit;

function ArrowFunctionExpression(node) {
  t.ensureBlock(node);

  node.expression = false;
  node.type = "FunctionExpression";
  node.shadow = true;

  return node;
}
/* */ 
"format cjs";
"use strict";

var _interopRequireWildcard = function (obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (typeof obj === "object" && obj !== null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj["default"] = obj; return newObj; } };

exports.__esModule = true;
exports.ForOfStatement = ForOfStatement;

var _ForOfStatementArray2 = require("../es6/for-of");

var _import = require("../../../types");

var t = _interopRequireWildcard(_import);

var shouldVisit = t.isForOfStatement;
exports.shouldVisit = shouldVisit;
var optional = true;

exports.optional = optional;

function ForOfStatement(node, parent, scope, file) {
  if (this.get("right").isTypeGeneric("Array")) {
    return _ForOfStatementArray2._ForOfStatementArray.call(this, node, scope, file);
  }
}
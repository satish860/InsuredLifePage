/* */ 
"format cjs";
"use strict";

var _interopRequireWildcard = function (obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (typeof obj === "object" && obj !== null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj["default"] = obj; return newObj; } };

exports.__esModule = true;
exports.DoExpression = DoExpression;

var _import = require("../../../types");

var t = _interopRequireWildcard(_import);

var metadata = {
  optional: true,
  stage: 0
};

exports.metadata = metadata;
var shouldVisit = t.isDoExpression;

exports.shouldVisit = shouldVisit;

function DoExpression(node) {
  var body = node.body.body;
  if (body.length) {
    return body;
  } else {
    return t.identifier("undefined");
  }
}
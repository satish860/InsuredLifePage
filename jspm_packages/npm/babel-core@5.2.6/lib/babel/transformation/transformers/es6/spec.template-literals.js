/* */ 
"format cjs";
"use strict";

var _interopRequireWildcard = function (obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (typeof obj === "object" && obj !== null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj["default"] = obj; return newObj; } };

exports.__esModule = true;
exports.TemplateLiteral = TemplateLiteral;

var _import = require("../../../types");

var t = _interopRequireWildcard(_import);

var metadata = {
  optional: true
};

exports.metadata = metadata;

function TemplateLiteral(node, parent, scope, file) {
  if (t.isTaggedTemplateExpression(parent)) return;

  for (var i = 0; i < node.expressions.length; i++) {
    node.expressions[i] = t.callExpression(t.identifier("String"), [node.expressions[i]]);
  }
}
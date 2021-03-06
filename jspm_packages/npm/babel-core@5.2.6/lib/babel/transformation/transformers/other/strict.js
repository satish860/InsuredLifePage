/* */ 
"format cjs";
"use strict";

var _interopRequireWildcard = function (obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (typeof obj === "object" && obj !== null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj["default"] = obj; return newObj; } };

exports.__esModule = true;
exports.Program = Program;
exports.FunctionExpression = FunctionExpression;
exports.ThisExpression = ThisExpression;
exports.CallExpression = CallExpression;

var _import = require("../../../messages");

var messages = _interopRequireWildcard(_import);

var _import2 = require("../../../types");

var t = _interopRequireWildcard(_import2);

function Program(program, parent, scope, file) {
  var first = program.body[0];
  if (t.isExpressionStatement(first) && t.isLiteral(first.expression, { value: "use strict" })) {
    file.set("existingStrictDirective", program.body.shift());
  }
}

function FunctionExpression() {
  this.skip();
}

exports.FunctionDeclaration = FunctionExpression;
exports.Class = FunctionExpression;

function ThisExpression() {
  return t.identifier("undefined");
}

function CallExpression(node, parent, scope, file) {
  if (t.isIdentifier(node.callee, { name: "eval" })) {
    throw file.errorWithNode(node, messages.get("evalInStrictMode"));
  }
}
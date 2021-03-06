/* */ 
"format cjs";
"use strict";

var _interopRequireWildcard = function (obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (typeof obj === "object" && obj !== null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj["default"] = obj; return newObj; } };

exports.__esModule = true;
exports.shouldVisit = shouldVisit;
exports.CallExpression = CallExpression;
exports.ModuleDeclaration = ModuleDeclaration;

var _import = require("../../../messages");

var messages = _interopRequireWildcard(_import);

var _import2 = require("../../../types");

var t = _interopRequireWildcard(_import2);

var metadata = {
  readOnly: true
};

exports.metadata = metadata;

function shouldVisit(node) {
  return t.isModuleDeclaration(node) || t.isCallExpression(node) && t.isIdentifier(node.callee, { name: "require" });
}

// check if the input Literal `source` is an alternate casing of "react"
function check(source, file) {
  if (t.isLiteral(source)) {
    var name = source.value;
    var lower = name.toLowerCase();

    if (lower === "react" && name !== lower) {
      throw file.errorWithNode(source, messages.get("didYouMean", "react"));
    }
  }
}

function CallExpression(node, parent, scope, file) {
  if (this.get("callee").isIdentifier({ name: "require" }) && node.arguments.length === 1) {
    check(node.arguments[0], file);
  }
}

function ModuleDeclaration(node, parent, scope, file) {
  check(node.source, file);
}
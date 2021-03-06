/* */ 
"format cjs";
"use strict";

var _interopRequireWildcard = function (obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (typeof obj === "object" && obj !== null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj["default"] = obj; return newObj; } };

exports.__esModule = true;
exports.shouldVisit = shouldVisit;
exports.BlockStatement = BlockStatement;
exports.SwitchCase = SwitchCase;

var _import = require("../../../types");

var t = _interopRequireWildcard(_import);

function statementList(key, path, file) {
  var paths = path.get(key);

  for (var i = 0; i < paths.length; i++) {
    var path = paths[i];

    var func = path.node;
    if (!t.isFunctionDeclaration(func)) continue;

    var declar = t.variableDeclaration("let", [t.variableDeclarator(func.id, t.toExpression(func))]);

    // hoist it up above everything else
    declar._blockHoist = 2;

    // todo: name this
    func.id = null;

    path.replaceWith(declar);
  }
}

function shouldVisit(node) {
  var body;
  if (node.type === "SwitchCase") {
    body = node.consequent;
  } else if (node.type === "BlockStatement") {
    body = node.body;
  }
  if (body) {
    for (var i = 0; i < body.length; i++) {
      if (body[i].type === "FunctionDeclaration") return true;
    }
  }
  return false;
}

function BlockStatement(node, parent, scope, file) {
  if (t.isFunction(parent) && parent.body === node || t.isExportDeclaration(parent)) {
    return;
  }

  statementList("body", this, file);
}

function SwitchCase(node, parent, scope, file) {
  statementList("consequent", this, file);
}
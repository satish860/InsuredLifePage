/* */ 
"format cjs";
"use strict";

var _interopRequireWildcard = function (obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (typeof obj === "object" && obj !== null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj["default"] = obj; return newObj; } };

exports.__esModule = true;
exports["default"] = build;

var _import = require("../../types");

var t = _interopRequireWildcard(_import);

function build(node, buildBody) {
  var self = node.blocks.shift();
  if (!self) return;

  var child = build(node, buildBody);
  if (!child) {
    // last item
    child = buildBody();

    // add a filter as this is our final stop
    if (node.filter) {
      child = t.ifStatement(node.filter, t.blockStatement([child]));
    }
  }

  return t.forOfStatement(t.variableDeclaration("let", [t.variableDeclarator(self.left)]), self.right, t.blockStatement([child]));
}

module.exports = exports["default"];
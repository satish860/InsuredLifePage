/* */ 
"format cjs";
"use strict";

var _interopRequireWildcard = function (obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (typeof obj === "object" && obj !== null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj["default"] = obj; return newObj; } };

exports.__esModule = true;
exports.MemberExpression = MemberExpression;

var _import = require("../../../types");

var t = _interopRequireWildcard(_import);

function MemberExpression(node) {
  var prop = node.property;
  if (node.computed && t.isLiteral(prop) && t.isValidIdentifier(prop.value)) {
    // foo["bar"] => foo.bar
    node.property = t.identifier(prop.value);
    node.computed = false;
  } else if (!node.computed && t.isIdentifier(prop) && !t.isValidIdentifier(prop.name)) {
    // foo.default -> foo["default"]
    node.property = t.literal(prop.name);
    node.computed = true;
  }
}
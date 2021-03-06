/* */ 
"format cjs";
"use strict";

var _interopRequireWildcard = function (obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (typeof obj === "object" && obj !== null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj["default"] = obj; return newObj; } };

exports.__esModule = true;
exports.Program = Program;

var _import = require("../../../types");

var t = _interopRequireWildcard(_import);

function Program(program, parent, scope, file) {
  if (file.transformers.strict.canTransform()) {
    var directive = file.get("existingStrictDirective");

    if (!directive) {
      directive = t.expressionStatement(t.literal("use strict"));
      var first = program.body[0];
      if (first) {
        directive.leadingComments = first.leadingComments;
        first.leadingComments = [];
      }
    }

    this.unshiftContainer("body", [directive]);
  }
}
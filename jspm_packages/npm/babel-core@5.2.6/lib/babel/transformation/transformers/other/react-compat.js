/* */ 
"format cjs";
"use strict";

var _interopRequireWildcard = function (obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (typeof obj === "object" && obj !== null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj["default"] = obj; return newObj; } };

exports.__esModule = true;
exports.manipulateOptions = manipulateOptions;

var _import = require("../../helpers/react");

var react = _interopRequireWildcard(_import);

var _import2 = require("../../../types");

var t = _interopRequireWildcard(_import2);

function manipulateOptions(opts) {
  opts.blacklist.push("react");
}

var metadata = {
  optional: true
};

exports.metadata = metadata;
require("../../helpers/build-react-transformer")(exports, {
  pre: function pre(state) {
    state.callee = state.tagExpr;
  },

  post: function post(state) {
    if (react.isCompatTag(state.tagName)) {
      state.call = t.callExpression(t.memberExpression(t.memberExpression(t.identifier("React"), t.identifier("DOM")), state.tagExpr, t.isLiteral(state.tagExpr)), state.args);
    }
  }
});
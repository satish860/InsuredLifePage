/* */ 
"format cjs";
"use strict";

var _interopRequireWildcard = function (obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (typeof obj === "object" && obj !== null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj["default"] = obj; return newObj; } };

var _interopRequireDefault = function (obj) { return obj && obj.__esModule ? obj : { "default": obj }; };

exports.__esModule = true;
exports.ImportSpecifier = ImportSpecifier;
exports.ImportDefaultSpecifier = ImportDefaultSpecifier;
exports.ExportDefaultSpecifier = ExportDefaultSpecifier;
exports.ExportSpecifier = ExportSpecifier;
exports.ExportNamespaceSpecifier = ExportNamespaceSpecifier;
exports.ExportAllDeclaration = ExportAllDeclaration;
exports.ExportNamedDeclaration = ExportNamedDeclaration;
exports.ExportDefaultDeclaration = ExportDefaultDeclaration;
exports.ImportDeclaration = ImportDeclaration;
exports.ImportNamespaceSpecifier = ImportNamespaceSpecifier;

var _each = require("lodash/collection/each");

var _each2 = _interopRequireDefault(_each);

var _import = require("../../types");

var t = _interopRequireWildcard(_import);

function ImportSpecifier(node, print) {
  print(node.imported);
  if (node.local && node.local !== node.imported) {
    this.push(" as ");
    print(node.local);
  }
}

function ImportDefaultSpecifier(node, print) {
  print(node.local);
}

function ExportDefaultSpecifier(node, print) {
  print(node.exported);
}

function ExportSpecifier(node, print) {
  print(node.local);
  if (node.exported && node.local !== node.exported) {
    this.push(" as ");
    print(node.exported);
  }
}

function ExportNamespaceSpecifier(node, print) {
  this.push("* as ");
  print(node.exported);
}

function ExportAllDeclaration(node, print) {
  this.push("export *");
  if (node.exported) {
    this.push(" as ");
    print(node.exported);
  }
  this.push(" from ");
  print(node.source);
  this.semicolon();
}

function ExportNamedDeclaration(node, print) {
  this.push("export ");
  ExportDeclaration.call(this, node, print);
}

function ExportDefaultDeclaration(node, print) {
  this.push("export default ");
  ExportDeclaration.call(this, node, print);
}

function ExportDeclaration(node, print) {
  var specifiers = node.specifiers;

  if (node.declaration) {
    var declar = node.declaration;
    print(declar);
    if (t.isStatement(declar) || t.isFunction(declar) || t.isClass(declar)) return;
  } else {
    var first = specifiers[0];
    var hasSpecial = false;
    if (t.isExportDefaultSpecifier(first) || t.isExportNamespaceSpecifier(first)) {
      hasSpecial = true;
      print(specifiers.shift());
      if (specifiers.length) {
        this.push(", ");
      }
    }

    if (specifiers.length || !specifiers.length && !hasSpecial) {
      this.push("{");
      if (specifiers.length) {
        this.space();
        print.join(specifiers, { separator: ", " });
        this.space();
      }
      this.push("}");
    }

    if (node.source) {
      this.push(" from ");
      print(node.source);
    }
  }

  this.ensureSemicolon();
}

function ImportDeclaration(node, print) {
  this.push("import ");

  if (node.isType) {
    this.push("type ");
  }

  var specfiers = node.specifiers;
  if (specfiers && specfiers.length) {
    var first = node.specifiers[0];
    if (t.isImportDefaultSpecifier(first) || t.isImportNamespaceSpecifier(first)) {
      print(node.specifiers.shift());
      if (node.specifiers.length) {
        this.push(", ");
      }
    }

    if (node.specifiers.length) {
      this.push("{");
      this.space();
      print.join(node.specifiers, { separator: ", " });
      this.space();
      this.push("}");
    }

    this.push(" from ");
  }

  print(node.source);
  this.semicolon();
}

function ImportNamespaceSpecifier(node, print) {
  this.push("* as ");
  print(node.local);
}
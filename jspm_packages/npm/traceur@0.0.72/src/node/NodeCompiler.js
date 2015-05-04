/* */ 
(function(Buffer, process) {
  'use strict';
  var path = require("path");
  var fs = require("fs");
  var util = require("./file-util");
  var writeFile = util.writeFile;
  var traceur = require("./traceur");
  var Compiler = traceur.Compiler;
  function NodeCompiler(options, sourceRoot) {
    sourceRoot = sourceRoot || process.cwd();
    Compiler.call(this, options, sourceRoot);
  }
  NodeCompiler.prototype = {
    __proto__: Compiler.prototype,
    writeTreeToFile: function(tree, filename) {
      filename = this.normalize(filename);
      var compiledCode = this.write(tree, filename);
      if (this.options_.sourceMaps === 'file') {
        var sourcemap = this.getSourceMap();
        if (sourcemap) {
          writeFile(this.sourceMappingURL(filename), sourcemap);
        }
      }
      writeFile(filename, compiledCode);
    },
    compileSingleFile: function(inputFilePath, outputFilePath, errback) {
      inputFilePath = this.normalize(inputFilePath);
      outputFilePath = this.normalize(outputFilePath);
      fs.readFile(inputFilePath, function(err, contents) {
        if (err) {
          errback(err);
          return ;
        }
        this.writeTreeToFile(this.transform(this.parse(contents.toString(), inputFilePath)), outputFilePath);
      }.bind(this));
    },
    sourceMappingURL: function(filename) {
      if (this.options_.sourceMaps === 'inline') {
        var base64sm = new Buffer(this.getSourceMap()).toString('base64');
        return 'data:application/json;base64,' + base64sm;
      }
      return Compiler.prototype.sourceMappingURL.call(this, filename);
    }
  };
  module.exports = {NodeCompiler: NodeCompiler};
})(require("buffer").Buffer, require("process"));

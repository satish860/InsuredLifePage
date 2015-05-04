/* */ 
(function(process) {
  'use strict';
  var fs = require("fs");
  var path = require("path");
  var Promise = require("rsvp").Promise;
  var nodeLoader = require("./nodeLoader");
  var util = require("./file-util");
  var normalizePath = util.normalizePath;
  var mkdirRecursive = util.mkdirRecursive;
  var NodeCompiler = require("./NodeCompiler").NodeCompiler;
  var cwd = process.cwd();
  function recursiveModuleCompileToSingleFile(outputFile, includes, options) {
    return new Promise(function(resolve, reject) {
      var resolvedOutputFile = path.resolve(outputFile);
      var outputDir = path.dirname(resolvedOutputFile);
      var resolvedIncludes = includes.map(function(include) {
        include.name = path.resolve(include.name);
        return include;
      });
      var compiler = new NodeCompiler(options);
      mkdirRecursive(outputDir);
      process.chdir(outputDir);
      resolvedIncludes = resolvedIncludes.map(function(include) {
        include.name = normalizePath(path.relative(outputDir, include.name));
        return include;
      });
      recursiveModuleCompile(resolvedIncludes, options, function(tree) {
        compiler.writeTreeToFile(tree, resolvedOutputFile);
        process.chdir(cwd);
        resolve();
      }, reject);
    });
  }
  function forEachRecursiveModuleCompile(outputDir, includes, options) {
    var outputDir = path.resolve(outputDir);
    var compiler = new NodeCompiler(options);
    var current = 0;
    function next() {
      if (current === includes.length)
        process.exit(0);
      recursiveModuleCompile(includes.slice(current, current + 1), options, function(tree) {
        var outputFileName = path.join(outputDir, includes[current].name);
        compiler.writeTreeToFile(tree, outputFileName);
        current++;
        next();
      }, function(err) {
        process.exit(1);
      });
    }
    next();
  }
  var TraceurLoader = traceur.runtime.TraceurLoader;
  var InlineLoaderCompiler = traceur.runtime.InlineLoaderCompiler;
  var Options = traceur.util.Options;
  function recursiveModuleCompile(fileNamesAndTypes, options, callback, errback) {
    var depTarget = options && options.depTarget;
    var referrerName = options && options.referrer;
    var basePath = path.resolve('./') + '/';
    basePath = basePath.replace(/\\/g, '/');
    var loadCount = 0;
    var elements = [];
    var loaderCompiler = new InlineLoaderCompiler(elements);
    var loader = new TraceurLoader(nodeLoader, basePath, loaderCompiler);
    function appendEvaluateModule(name, referrerName) {
      var normalizedName = traceur.ModuleStore.normalize(name, referrerName);
      var moduleModule = traceur.codegeneration.module;
      var tree = moduleModule.createModuleEvaluationStatement(normalizedName);
      elements.push(tree);
    }
    function loadNext() {
      var doEvaluateModule = false;
      var loadFunction = loader.import;
      var input = fileNamesAndTypes[loadCount];
      var name = input.name;
      var optionsCopy = new Options(options);
      if (input.type === 'script') {
        loadFunction = loader.loadAsScript;
      } else {
        name = name.replace(/\.js$/, '');
        if (input.format === 'inline')
          optionsCopy.modules = 'inline';
        else if (optionsCopy.modules === 'register')
          doEvaluateModule = true;
      }
      var loadOptions = {
        referrerName: referrerName,
        metadata: {traceurOptions: optionsCopy}
      };
      var codeUnit = loadFunction.call(loader, name, loadOptions).then(function() {
        if (doEvaluateModule)
          appendEvaluateModule(name, referrerName);
        loadCount++;
        if (loadCount < fileNamesAndTypes.length) {
          loadNext();
        } else if (depTarget) {
          callback(null);
        } else {
          var tree = loaderCompiler.toTree(basePath, elements);
          callback(tree);
        }
      }, function(err) {
        errback(err);
      }).catch(function(ex) {
        console.error('Internal error ' + (ex.stack || ex));
      });
    }
    loadNext();
  }
  exports.recursiveModuleCompile = recursiveModuleCompile;
  exports.recursiveModuleCompileToSingleFile = recursiveModuleCompileToSingleFile;
  exports.forEachRecursiveModuleCompile = forEachRecursiveModuleCompile;
})(require("process"));

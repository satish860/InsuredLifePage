/* */ 
(function(process) {
  var Package = require("dgeni").Package;
  var traceur = require("./services/traceur");
  var path = require("canonical-path");
  module.exports = new Package('traceur').factory(require("./readers/atScript")).factory(require("./services/getJSDocComment")).factory(traceur.traceurOptions).factory('SourceFile', traceur.getClass('SourceFile')).factory('ParseTreeVisitor', traceur.getClass('ParseTreeVisitor')).factory('Parser', traceur.getClass('Parser')).factory(require("./services/atParser")).factory(require("./services/AttachCommentTreeVisitor")).factory(require("./services/ExportTreeVisitor")).processor(require("./processors/generateDocsFromComments")).processor(require("./processors/processModuleDocs")).processor(require("./processors/processClassDocs")).config(function(readFilesProcessor, atScriptFileReader) {
    readFilesProcessor.fileReaders.push(atScriptFileReader);
  }).config(function(templateFinder) {
    templateFinder.templateFolders.push(path.resolve(__dirname, 'templates'));
  }).config(function(computeIdsProcessor, computePathsProcessor) {
    computeIdsProcessor.idTemplates.push({
      docTypes: ['class', 'function', 'NAMED_EXPORT', 'VARIABLE_STATEMENT'],
      idTemplate: '${moduleDoc.id}.${name}',
      getAliases: function(doc) {
        return [doc.id];
      }
    });
    computeIdsProcessor.idTemplates.push({
      docTypes: ['member'],
      idTemplate: '${classDoc.id}.${name}',
      getAliases: function(doc) {
        return [doc.id];
      }
    });
    computeIdsProcessor.idTemplates.push({
      docTypes: ['guide'],
      getId: function(doc) {
        return doc.fileInfo.relativePath.replace(/.*\/?modules\//, '').replace(/\/docs\//, '/').replace(/\.\w*$/, '');
      },
      getAliases: function(doc) {
        return [doc.id];
      }
    });
    computePathsProcessor.pathTemplates.push({
      docTypes: ['module'],
      pathTemplate: '${id}',
      getOutputPath: function() {}
    });
    computePathsProcessor.pathTemplates.push({
      docTypes: ['class', 'function', 'NAMED_EXPORT', 'VARIABLE_STATEMENT'],
      pathTemplate: '${name}',
      outputPathTemplate: '${path}.html'
    });
    computePathsProcessor.pathTemplates.push({
      docTypes: ['member'],
      pathTemplate: '${classDoc.path}/${name}',
      getOutputPath: function() {}
    });
  });
})(require("process"));

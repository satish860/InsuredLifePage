/* */ 
(function(process) {
  var path = require("canonical-path");
  var Package = require("dgeni").Package;
  var package = new Package('router', [require("dgeni-packages/jsdoc"), require("dgeni-packages/nunjucks"), require("./traceur-package/index")]);
  package.processor(require("./processors/markdown"));
  package.processor(require("./processors/generateIndexPage"));
  package.processor(require("./processors/addMethodsToService"));
  package.factory(require("./file-readers/markdown"));
  package.config(function(log, readFilesProcessor, templateFinder, templateEngine, writeFilesProcessor, markdownFileReader) {
    log.level = 'info';
    readFilesProcessor.basePath = path.resolve(__dirname, '..');
    readFilesProcessor.fileReaders.push(markdownFileReader);
    readFilesProcessor.sourceFiles = [{
      include: 'src/**/*.js',
      basePath: 'src'
    }, {
      include: 'docs/content/**/*.md',
      basePath: 'docs/content'
    }, {
      include: 'src/**/*.ats',
      basePath: 'src'
    }];
    templateEngine.config.tags = {
      variableStart: '{$',
      variableEnd: '$}'
    };
    templateEngine.filters.push(require("./rendering/relativeLinkInlineTag"));
    templateEngine.filters.push(require("./rendering/docTypeLabel"));
    templateFinder.templateFolders.unshift(path.resolve(__dirname, 'templates'));
    templateFinder.templatePatterns = ['${ doc.template }', '${ doc.id }.${ doc.docType }.template.html', '${ doc.id }.template.html', '${ doc.docType }.template.html', 'common.template.html'];
    writeFilesProcessor.outputFolder = 'dist/docs';
  }).config(function(computeIdsProcessor) {
    computeIdsProcessor.idTemplates.push({
      docTypes: ['markdown'],
      getId: function(doc) {
        docPath = path.dirname(doc.fileInfo.relativePath);
        if (doc.fileInfo.baseName !== 'index') {
          docPath = path.join(docPath, doc.fileInfo.baseName);
        }
        return docPath;
      },
      getAliases: function(doc) {
        return [doc.id];
      }
    });
  }).config(function(computePathsProcessor) {
    computePathsProcessor.pathTemplates.push({
      docTypes: ['markdown'],
      pathTemplate: '${id}',
      outputPathTemplate: '${path}.html'
    });
  });
  module.exports = package;
})(require("process"));

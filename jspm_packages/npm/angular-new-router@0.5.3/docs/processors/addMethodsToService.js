/* */ 
(function(process) {
  "use strict";
  var path = require("canonical-path");
  module.exports = function addMethodsToServiceProcessor() {
    return {
      $runAfter: ['adding-extra-docs'],
      $runBefore: ['extra-docs-added'],
      $process: function(docs) {
        var parentDocs = {};
        docs.forEach(function(doc) {
          if (!shouldNestDoc(doc)) {
            parentDocs[doc.name] = doc;
            doc.members = doc.members || [];
          }
        });
        docs.forEach(function(doc) {
          if (shouldNestDoc(doc)) {
            doc.docType = 'angularServiceMethod';
            var parent = getParentDoc(doc);
            parentDocs[parent].members.push(doc);
          }
        });
      }
    };
  };
  function getParentDoc(doc) {
    return doc.name.substr(0, doc.name.indexOf('#'));
  }
  function shouldNestDoc(doc) {
    return doc.docType === 'js' && doc.name.indexOf('#') > -1;
  }
})(require("process"));

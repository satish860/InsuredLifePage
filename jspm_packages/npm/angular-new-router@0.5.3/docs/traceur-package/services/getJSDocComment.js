/* */ 
(function(process) {
  var LEADING_STAR = /^[^\S\r\n]*\*[^\S\n\r]?/gm;
  module.exports = function getJSDocComment() {
    return function(comment) {
      var commentInfo;
      comment.range.toString().replace(/^\/\*\*([\w\W]*)\*\/$/g, function(match, commentBody) {
        commentBody = commentBody.replace(LEADING_STAR, '').trim();
        commentInfo = {
          startingLine: comment.range.start.line,
          endingLine: comment.range.end.line,
          content: commentBody,
          codeTree: comment.treeAfter
        };
      });
      return commentInfo;
    };
  };
})(require("process"));

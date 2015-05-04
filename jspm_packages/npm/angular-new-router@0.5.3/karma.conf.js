/* */ 
(function(process) {
  var traceurOptions = require("./config.json!systemjs-json").traceur;
  var sauceConfig = require("./config/karma.sauce.conf");
  var travisConfig = require("./config/karma.travis.conf");
  module.exports = function(config) {
    var options = {
      frameworks: ['jasmine', 'requirejs', 'traceur'],
      files: [{
        pattern: 'test/main.js',
        included: true
      }, {
        pattern: 'src/**/*.ats',
        included: false
      }, {
        pattern: 'node_modules/route-recognizer/lib/**/*.js',
        included: false
      }, {
        pattern: 'test/**/*.ats',
        included: false
      }, {
        pattern: 'node_modules/rtts-assert/dist/amd/assert.js',
        included: false
      }],
      preprocessors: {
        '**/*.ats': ['traceur'],
        'node_modules/route-recognizer/lib/**/*.js': ['traceur']
      },
      browsers: ['Chrome'],
      traceurPreprocessor: {
        options: traceurOptions,
        transformPath: function(path) {
          return path.replace(/\.ats$/, '.js');
        }
      }
    };
    if (process.argv.indexOf('--sauce') > -1) {
      sauceConfig(options);
      travisConfig(options);
    }
    config.set(options);
  };
})(require("process"));

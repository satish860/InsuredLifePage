/* */ 
var tap = require("tap");
var test = tap.test;
var semver = require("../semver");
var ltr = semver.ltr;
test('\nltr tests', function(t) {
  [['~1.2.2', '1.2.1'], ['~0.6.1-1', '0.6.1-0'], ['1.0.0 - 2.0.0', '0.0.1'], ['1.0.0-beta.2', '1.0.0-beta.1'], ['1.0.0', '0.0.0'], ['>=2.0.0', '1.1.1'], ['>=2.0.0', '1.2.9'], ['>2.0.0', '2.0.0'], ['0.1.20 || 1.2.4', '0.1.5'], ['2.x.x', '1.0.0'], ['1.2.x', '1.1.0'], ['1.2.x || 2.x', '1.0.0'], ['2.*.*', '1.0.1'], ['1.2.*', '1.1.3'], ['1.2.* || 2.*', '1.1.9999'], ['2', '1.0.0'], ['2.3', '2.2.2'], ['~2.4', '2.3.0'], ['~2.4', '2.3.5'], ['~>3.2.1', '3.2.0'], ['~1', '0.2.3'], ['~>1', '0.2.4'], ['~> 1', '0.2.3'], ['~1.0', '0.1.2'], ['~ 1.0', '0.1.0'], ['>1.2', '1.2.0'], ['> 1.2', '1.2.1'], ['1', '0.0.0beta', true], ['~v0.5.4-pre', '0.5.4-alpha'], ['~v0.5.4-pre', '0.5.4-alpha'], ['=0.7.x', '0.6.0'], ['=0.7.x', '0.6.0-asdf'], ['>=0.7.x', '0.6.0'], ['~1.2.2', '1.2.1'], ['1.0.0 - 2.0.0', '0.2.3'], ['1.0.0', '0.0.1'], ['>=2.0.0', '1.0.0'], ['>=2.0.0', '1.9999.9999'], ['>=2.0.0', '1.2.9'], ['>2.0.0', '2.0.0'], ['>2.0.0', '1.2.9'], ['2.x.x', '1.1.3'], ['1.2.x', '1.1.3'], ['1.2.x || 2.x', '1.1.3'], ['2.*.*', '1.1.3'], ['1.2.*', '1.1.3'], ['1.2.* || 2.*', '1.1.3'], ['2', '1.9999.9999'], ['2.3', '2.2.1'], ['~2.4', '2.3.0'], ['~>3.2.1', '2.3.2'], ['~1', '0.2.3'], ['~>1', '0.2.3'], ['~1.0', '0.0.0'], ['>1', '1.0.0'], ['2', '1.0.0beta', true], ['>1', '1.0.0beta', true], ['> 1', '1.0.0beta', true], ['=0.7.x', '0.6.2'], ['>=0.7.x', '0.6.2']].forEach(function(tuple) {
    var range = tuple[0];
    var version = tuple[1];
    var loose = tuple[2] || false;
    var msg = 'ltr(' + version + ', ' + range + ', ' + loose + ')';
    t.ok(ltr(version, range, loose), msg);
  });
  t.end();
});
test('\nnegative ltr tests', function(t) {
  [['~ 1.0', '1.1.0'], ['~0.6.1-1', '0.6.1-1'], ['1.0.0 - 2.0.0', '1.2.3'], ['1.0.0 - 2.0.0', '2.9.9'], ['1.0.0', '1.0.0'], ['>=*', '0.2.4'], ['', '1.0.0', true], ['*', '1.2.3'], ['*', 'v1.2.3-foo'], ['>=1.0.0', '1.0.0'], ['>=1.0.0', '1.0.1'], ['>=1.0.0', '1.1.0'], ['>1.0.0', '1.0.1'], ['>1.0.0', '1.1.0'], ['<=2.0.0', '2.0.0'], ['<=2.0.0', '1.9999.9999'], ['<=2.0.0', '0.2.9'], ['<2.0.0', '1.9999.9999'], ['<2.0.0', '0.2.9'], ['>= 1.0.0', '1.0.0'], ['>=  1.0.0', '1.0.1'], ['>=   1.0.0', '1.1.0'], ['> 1.0.0', '1.0.1'], ['>  1.0.0', '1.1.0'], ['<=   2.0.0', '2.0.0'], ['<= 2.0.0', '1.9999.9999'], ['<=  2.0.0', '0.2.9'], ['<    2.0.0', '1.9999.9999'], ['<\t2.0.0', '0.2.9'], ['>=0.1.97', 'v0.1.97'], ['>=0.1.97', '0.1.97'], ['0.1.20 || 1.2.4', '1.2.4'], ['0.1.20 || >1.2.4', '1.2.4'], ['0.1.20 || 1.2.4', '1.2.3'], ['0.1.20 || 1.2.4', '0.1.20'], ['>=0.2.3 || <0.0.1', '0.0.0'], ['>=0.2.3 || <0.0.1', '0.2.3'], ['>=0.2.3 || <0.0.1', '0.2.4'], ['||', '1.3.4'], ['2.x.x', '2.1.3'], ['1.2.x', '1.2.3'], ['1.2.x || 2.x', '2.1.3'], ['1.2.x || 2.x', '1.2.3'], ['x', '1.2.3'], ['2.*.*', '2.1.3'], ['1.2.*', '1.2.3'], ['1.2.* || 2.*', '2.1.3'], ['1.2.* || 2.*', '1.2.3'], ['1.2.* || 2.*', '1.2.3'], ['*', '1.2.3'], ['2', '2.1.2'], ['2.3', '2.3.1'], ['~2.4', '2.4.0'], ['~2.4', '2.4.5'], ['~>3.2.1', '3.2.2'], ['~1', '1.2.3'], ['~>1', '1.2.3'], ['~> 1', '1.2.3'], ['~1.0', '1.0.2'], ['~ 1.0', '1.0.2'], ['>=1', '1.0.0'], ['>= 1', '1.0.0'], ['<1.2', '1.1.1'], ['< 1.2', '1.1.1'], ['1', '1.0.0beta', true], ['~v0.5.4-pre', '0.5.5'], ['~v0.5.4-pre', '0.5.4'], ['=0.7.x', '0.7.2'], ['>=0.7.x', '0.7.2'], ['=0.7.x', '0.7.0-asdf'], ['>=0.7.x', '0.7.0-asdf'], ['<=0.7.x', '0.6.2'], ['>0.2.3 >0.2.4 <=0.2.5', '0.2.5'], ['>=0.2.3 <=0.2.4', '0.2.4'], ['1.0.0 - 2.0.0', '2.0.0'], ['^1', '1.0.0-0'], ['^3.0.0', '4.0.0'], ['^1.0.0 || ~2.0.1', '2.0.0'], ['^0.1.0 || ~3.0.1 || 5.0.0', '3.2.0'], ['^0.1.0 || ~3.0.1 || 5.0.0', '1.0.0beta', true], ['^0.1.0 || ~3.0.1 || 5.0.0', '5.0.0-0', true], ['^0.1.0 || ~3.0.1 || >4 <=5.0.0', '3.5.0'], ['=0.1.0', '1.0.0']].forEach(function(tuple) {
    var range = tuple[0];
    var version = tuple[1];
    var loose = tuple[2] || false;
    var msg = '!ltr(' + version + ', ' + range + ', ' + loose + ')';
    t.notOk(ltr(version, range, loose), msg);
  });
  t.end();
});

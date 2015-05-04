/* */ 
'use strict';
var fs = require("fs");
var traceur = require("./traceur");
var path = require("path");
var nodeLoader = require("./nodeLoader");
var url = (path.resolve('./') + '/').replace(/\\/g, '/');
var System = new traceur.runtime.TraceurLoader(nodeLoader, url);
Reflect.global.System = System;
System.map = System.semverMap(System.version);
module.exports = System;

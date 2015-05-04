/* */ 
var fs = require("fs");
var path = require("path");
var filename = '../../bin/traceur.js';
filename = path.join(path.dirname(module.filename), filename);
var data = fs.readFileSync(filename, 'utf8');
if (!data)
  throw new Error('Failed to import ' + filename);
('global', eval)(data);
module.exports = {
  __proto__: traceur,
  get require() {
    return require("./require");
  }
};

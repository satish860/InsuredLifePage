/* */ 
var traceur = require("traceur/src/node/traceur");
module.exports = {
  traceurOptions: function traceurOptions() {
    return traceur.options;
  },
  getClass: function(id, path) {
    path = System.map.traceur + (path || ('/src/syntax/' + id));
    var factory = function() {
      return System.get(path)[id];
    };
    factory.name = id;
    return factory;
  }
};

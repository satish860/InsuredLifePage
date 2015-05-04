/* */ 
"format cjs";
(function(process) {
  var requirejs,
      require,
      define,
      xpcUtil;
  (function(console, args, readFileFunc) {
    var fileName,
        env,
        fs,
        vm,
        path,
        exec,
        rhinoContext,
        dir,
        nodeRequire,
        nodeDefine,
        exists,
        reqMain,
        loadedOptimizedLib,
        existsForNode,
        Cc,
        Ci,
        version = '2.1.17',
        jsSuffixRegExp = /\.js$/,
        commandOption = '',
        useLibLoaded = {},
        rhinoArgs = args,
        xpconnectArgs = args,
        readFile = typeof readFileFunc !== 'undefined' ? readFileFunc : null;
    function showHelp() {
      console.log('See https://github.com/jrburke/r.js for usage.');
    }
    if ((typeof navigator !== 'undefined' && typeof document !== 'undefined') || (typeof importScripts !== 'undefined' && typeof self !== 'undefined')) {
      env = 'browser';
      readFile = function(path) {
        return fs.readFileSync(path, 'utf8');
      };
      exec = function(string) {
        return eval(string);
      };
      exists = function() {
        console.log('x.js exists not applicable in browser env');
        return false;
      };
    } else if (typeof process !== 'undefined' && process.versions && !!process.versions.node) {
      env = 'node';
      fs = require("fs");
      vm = require("vm");
      path = require("path");
      existsForNode = fs.existsSync || path.existsSync;
      nodeRequire = require;
      nodeDefine = define;
      reqMain = require.main;
      require = undefined;
      define = undefined;
      readFile = function(path) {
        return fs.readFileSync(path, 'utf8');
      };
      exec = function(string, name) {
        return vm.runInThisContext(this.requirejsVars.require.makeNodeWrapper(string), name ? fs.realpathSync(name) : '');
      };
      exists = function(fileName) {
        return existsForNode(fileName);
      };
      fileName = process.argv[2];
      if (fileName && fileName.indexOf('-') === 0) {
        commandOption = fileName.substring(1);
        fileName = process.argv[3];
      }
    } else if (typeof Packages !== 'undefined') {
      env = 'rhino';
      fileName = args[0];
      if (fileName && fileName.indexOf('-') === 0) {
        commandOption = fileName.substring(1);
        fileName = args[1];
      }
      if (typeof importPackage !== 'undefined') {
        rhinoContext = Packages.org.mozilla.javascript.ContextFactory.getGlobal().enterContext();
        exec = function(string, name) {
          return rhinoContext.evaluateString(this, string, name, 0, null);
        };
      } else {
        exec = function(string, name) {
          load({
            script: string,
            name: name
          });
        };
        readFile = readFully;
      }
      exists = function(fileName) {
        return (new java.io.File(fileName)).exists();
      };
      if (typeof console === 'undefined') {
        console = {log: function() {
            print.apply(undefined, arguments);
          }};
      }
    } else if (typeof Components !== 'undefined' && Components.classes && Components.interfaces) {
      env = 'xpconnect';
      Components.utils['import']('resource://gre/modules/FileUtils.jsm');
      Cc = Components.classes;
      Ci = Components.interfaces;
      fileName = args[0];
      if (fileName && fileName.indexOf('-') === 0) {
        commandOption = fileName.substring(1);
        fileName = args[1];
      }
      xpcUtil = {
        isWindows: ('@mozilla.org/windows-registry-key;1' in Cc),
        cwd: function() {
          return FileUtils.getFile("CurWorkD", []).path;
        },
        normalize: function(path) {
          var i,
              part,
              ary,
              firstChar = path.charAt(0);
          if (firstChar !== '/' && firstChar !== '\\' && path.indexOf(':') === -1) {
            path = xpcUtil.cwd() + '/' + path;
          }
          ary = path.replace(/\\/g, '/').split('/');
          for (i = 0; i < ary.length; i += 1) {
            part = ary[i];
            if (part === '.') {
              ary.splice(i, 1);
              i -= 1;
            } else if (part === '..') {
              ary.splice(i - 1, 2);
              i -= 2;
            }
          }
          return ary.join('/');
        },
        xpfile: function(path) {
          var fullPath;
          try {
            fullPath = xpcUtil.normalize(path);
            if (xpcUtil.isWindows) {
              fullPath = fullPath.replace(/\//g, '\\');
            }
            return new FileUtils.File(fullPath);
          } catch (e) {
            throw new Error((fullPath || path) + ' failed: ' + e);
          }
        },
        readFile: function(path, encoding) {
          encoding = encoding || "utf-8";
          var inStream,
              convertStream,
              readData = {},
              fileObj = xpcUtil.xpfile(path);
          try {
            inStream = Cc['@mozilla.org/network/file-input-stream;1'].createInstance(Ci.nsIFileInputStream);
            inStream.init(fileObj, 1, 0, false);
            convertStream = Cc['@mozilla.org/intl/converter-input-stream;1'].createInstance(Ci.nsIConverterInputStream);
            convertStream.init(inStream, encoding, inStream.available(), Ci.nsIConverterInputStream.DEFAULT_REPLACEMENT_CHARACTER);
            convertStream.readString(inStream.available(), readData);
            return readData.value;
          } catch (e) {
            throw new Error((fileObj && fileObj.path || '') + ': ' + e);
          } finally {
            if (convertStream) {
              convertStream.close();
            }
            if (inStream) {
              inStream.close();
            }
          }
        }
      };
      readFile = xpcUtil.readFile;
      exec = function(string) {
        return eval(string);
      };
      exists = function(fileName) {
        return xpcUtil.xpfile(fileName).exists();
      };
      if (typeof console === 'undefined') {
        console = {log: function() {
            print.apply(undefined, arguments);
          }};
      }
    }
    (function(global) {
      var req,
          s,
          head,
          baseElement,
          dataMain,
          src,
          interactiveScript,
          currentlyAddingScript,
          mainScript,
          subPath,
          version = '2.1.17',
          commentRegExp = /(\/\*([\s\S]*?)\*\/|([^:]|^)\/\/(.*)$)/mg,
          cjsRequireRegExp = /[^.]\s*require\s*\(\s*["']([^'"\s]+)["']\s*\)/g,
          jsSuffixRegExp = /\.js$/,
          currDirRegExp = /^\.\//,
          op = Object.prototype,
          ostring = op.toString,
          hasOwn = op.hasOwnProperty,
          ap = Array.prototype,
          apsp = ap.splice,
          isBrowser = !!(typeof window !== 'undefined' && typeof navigator !== 'undefined' && window.document),
          isWebWorker = !isBrowser && typeof importScripts !== 'undefined',
          readyRegExp = isBrowser && navigator.platform === 'PLAYSTATION 3' ? /^complete$/ : /^(complete|loaded)$/,
          defContextName = '_',
          isOpera = typeof opera !== 'undefined' && opera.toString() === '[object Opera]',
          contexts = {},
          cfg = {},
          globalDefQueue = [],
          useInteractive = false;
      function isFunction(it) {
        return ostring.call(it) === '[object Function]';
      }
      function isArray(it) {
        return ostring.call(it) === '[object Array]';
      }
      function each(ary, func) {
        if (ary) {
          var i;
          for (i = 0; i < ary.length; i += 1) {
            if (ary[i] && func(ary[i], i, ary)) {
              break;
            }
          }
        }
      }
      function eachReverse(ary, func) {
        if (ary) {
          var i;
          for (i = ary.length - 1; i > -1; i -= 1) {
            if (ary[i] && func(ary[i], i, ary)) {
              break;
            }
          }
        }
      }
      function hasProp(obj, prop) {
        return hasOwn.call(obj, prop);
      }
      function getOwn(obj, prop) {
        return hasProp(obj, prop) && obj[prop];
      }
      function eachProp(obj, func) {
        var prop;
        for (prop in obj) {
          if (hasProp(obj, prop)) {
            if (func(obj[prop], prop)) {
              break;
            }
          }
        }
      }
      function mixin(target, source, force, deepStringMixin) {
        if (source) {
          eachProp(source, function(value, prop) {
            if (force || !hasProp(target, prop)) {
              if (deepStringMixin && typeof value === 'object' && value && !isArray(value) && !isFunction(value) && !(value instanceof RegExp)) {
                if (!target[prop]) {
                  target[prop] = {};
                }
                mixin(target[prop], value, force, deepStringMixin);
              } else {
                target[prop] = value;
              }
            }
          });
        }
        return target;
      }
      function bind(obj, fn) {
        return function() {
          return fn.apply(obj, arguments);
        };
      }
      function scripts() {
        return document.getElementsByTagName('script');
      }
      function defaultOnError(err) {
        throw err;
      }
      function getGlobal(value) {
        if (!value) {
          return value;
        }
        var g = global;
        each(value.split('.'), function(part) {
          g = g[part];
        });
        return g;
      }
      function makeError(id, msg, err, requireModules) {
        var e = new Error(msg + '\nhttp://requirejs.org/docs/errors.html#' + id);
        e.requireType = id;
        e.requireModules = requireModules;
        if (err) {
          e.originalError = err;
        }
        return e;
      }
      if (typeof define !== 'undefined') {
        return ;
      }
      if (typeof requirejs !== 'undefined') {
        if (isFunction(requirejs)) {
          return ;
        }
        cfg = requirejs;
        requirejs = undefined;
      }
      if (typeof require !== 'undefined' && !isFunction(require)) {
        cfg = require;
        require = undefined;
      }
      function newContext(contextName) {
        var inCheckLoaded,
            Module,
            context,
            handlers,
            checkLoadedTimeoutId,
            config = {
              waitSeconds: 7,
              baseUrl: './',
              paths: {},
              bundles: {},
              pkgs: {},
              shim: {},
              config: {}
            },
            registry = {},
            enabledRegistry = {},
            undefEvents = {},
            defQueue = [],
            defined = {},
            urlFetched = {},
            bundlesMap = {},
            requireCounter = 1,
            unnormalizedCounter = 1;
        function trimDots(ary) {
          var i,
              part;
          for (i = 0; i < ary.length; i++) {
            part = ary[i];
            if (part === '.') {
              ary.splice(i, 1);
              i -= 1;
            } else if (part === '..') {
              if (i === 0 || (i === 1 && ary[2] === '..') || ary[i - 1] === '..') {
                continue;
              } else if (i > 0) {
                ary.splice(i - 1, 2);
                i -= 2;
              }
            }
          }
        }
        function normalize(name, baseName, applyMap) {
          var pkgMain,
              mapValue,
              nameParts,
              i,
              j,
              nameSegment,
              lastIndex,
              foundMap,
              foundI,
              foundStarMap,
              starI,
              normalizedBaseParts,
              baseParts = (baseName && baseName.split('/')),
              map = config.map,
              starMap = map && map['*'];
          if (name) {
            name = name.split('/');
            lastIndex = name.length - 1;
            if (config.nodeIdCompat && jsSuffixRegExp.test(name[lastIndex])) {
              name[lastIndex] = name[lastIndex].replace(jsSuffixRegExp, '');
            }
            if (name[0].charAt(0) === '.' && baseParts) {
              normalizedBaseParts = baseParts.slice(0, baseParts.length - 1);
              name = normalizedBaseParts.concat(name);
            }
            trimDots(name);
            name = name.join('/');
          }
          if (applyMap && map && (baseParts || starMap)) {
            nameParts = name.split('/');
            outerLoop: for (i = nameParts.length; i > 0; i -= 1) {
              nameSegment = nameParts.slice(0, i).join('/');
              if (baseParts) {
                for (j = baseParts.length; j > 0; j -= 1) {
                  mapValue = getOwn(map, baseParts.slice(0, j).join('/'));
                  if (mapValue) {
                    mapValue = getOwn(mapValue, nameSegment);
                    if (mapValue) {
                      foundMap = mapValue;
                      foundI = i;
                      break outerLoop;
                    }
                  }
                }
              }
              if (!foundStarMap && starMap && getOwn(starMap, nameSegment)) {
                foundStarMap = getOwn(starMap, nameSegment);
                starI = i;
              }
            }
            if (!foundMap && foundStarMap) {
              foundMap = foundStarMap;
              foundI = starI;
            }
            if (foundMap) {
              nameParts.splice(0, foundI, foundMap);
              name = nameParts.join('/');
            }
          }
          pkgMain = getOwn(config.pkgs, name);
          return pkgMain ? pkgMain : name;
        }
        function removeScript(name) {
          if (isBrowser) {
            each(scripts(), function(scriptNode) {
              if (scriptNode.getAttribute('data-requiremodule') === name && scriptNode.getAttribute('data-requirecontext') === context.contextName) {
                scriptNode.parentNode.removeChild(scriptNode);
                return true;
              }
            });
          }
        }
        function hasPathFallback(id) {
          var pathConfig = getOwn(config.paths, id);
          if (pathConfig && isArray(pathConfig) && pathConfig.length > 1) {
            pathConfig.shift();
            context.require.undef(id);
            context.makeRequire(null, {skipMap: true})([id]);
            return true;
          }
        }
        function splitPrefix(name) {
          var prefix,
              index = name ? name.indexOf('!') : -1;
          if (index > -1) {
            prefix = name.substring(0, index);
            name = name.substring(index + 1, name.length);
          }
          return [prefix, name];
        }
        function makeModuleMap(name, parentModuleMap, isNormalized, applyMap) {
          var url,
              pluginModule,
              suffix,
              nameParts,
              prefix = null,
              parentName = parentModuleMap ? parentModuleMap.name : null,
              originalName = name,
              isDefine = true,
              normalizedName = '';
          if (!name) {
            isDefine = false;
            name = '_@r' + (requireCounter += 1);
          }
          nameParts = splitPrefix(name);
          prefix = nameParts[0];
          name = nameParts[1];
          if (prefix) {
            prefix = normalize(prefix, parentName, applyMap);
            pluginModule = getOwn(defined, prefix);
          }
          if (name) {
            if (prefix) {
              if (pluginModule && pluginModule.normalize) {
                normalizedName = pluginModule.normalize(name, function(name) {
                  return normalize(name, parentName, applyMap);
                });
              } else {
                normalizedName = name.indexOf('!') === -1 ? normalize(name, parentName, applyMap) : name;
              }
            } else {
              normalizedName = normalize(name, parentName, applyMap);
              nameParts = splitPrefix(normalizedName);
              prefix = nameParts[0];
              normalizedName = nameParts[1];
              isNormalized = true;
              url = context.nameToUrl(normalizedName);
            }
          }
          suffix = prefix && !pluginModule && !isNormalized ? '_unnormalized' + (unnormalizedCounter += 1) : '';
          return {
            prefix: prefix,
            name: normalizedName,
            parentMap: parentModuleMap,
            unnormalized: !!suffix,
            url: url,
            originalName: originalName,
            isDefine: isDefine,
            id: (prefix ? prefix + '!' + normalizedName : normalizedName) + suffix
          };
        }
        function getModule(depMap) {
          var id = depMap.id,
              mod = getOwn(registry, id);
          if (!mod) {
            mod = registry[id] = new context.Module(depMap);
          }
          return mod;
        }
        function on(depMap, name, fn) {
          var id = depMap.id,
              mod = getOwn(registry, id);
          if (hasProp(defined, id) && (!mod || mod.defineEmitComplete)) {
            if (name === 'defined') {
              fn(defined[id]);
            }
          } else {
            mod = getModule(depMap);
            if (mod.error && name === 'error') {
              fn(mod.error);
            } else {
              mod.on(name, fn);
            }
          }
        }
        function onError(err, errback) {
          var ids = err.requireModules,
              notified = false;
          if (errback) {
            errback(err);
          } else {
            each(ids, function(id) {
              var mod = getOwn(registry, id);
              if (mod) {
                mod.error = err;
                if (mod.events.error) {
                  notified = true;
                  mod.emit('error', err);
                }
              }
            });
            if (!notified) {
              req.onError(err);
            }
          }
        }
        function takeGlobalQueue() {
          if (globalDefQueue.length) {
            apsp.apply(defQueue, [defQueue.length, 0].concat(globalDefQueue));
            globalDefQueue = [];
          }
        }
        handlers = {
          'require': function(mod) {
            if (mod.require) {
              return mod.require;
            } else {
              return (mod.require = context.makeRequire(mod.map));
            }
          },
          'exports': function(mod) {
            mod.usingExports = true;
            if (mod.map.isDefine) {
              if (mod.exports) {
                return (defined[mod.map.id] = mod.exports);
              } else {
                return (mod.exports = defined[mod.map.id] = {});
              }
            }
          },
          'module': function(mod) {
            if (mod.module) {
              return mod.module;
            } else {
              return (mod.module = {
                id: mod.map.id,
                uri: mod.map.url,
                config: function() {
                  return getOwn(config.config, mod.map.id) || {};
                },
                exports: mod.exports || (mod.exports = {})
              });
            }
          }
        };
        function cleanRegistry(id) {
          delete registry[id];
          delete enabledRegistry[id];
        }
        function breakCycle(mod, traced, processed) {
          var id = mod.map.id;
          if (mod.error) {
            mod.emit('error', mod.error);
          } else {
            traced[id] = true;
            each(mod.depMaps, function(depMap, i) {
              var depId = depMap.id,
                  dep = getOwn(registry, depId);
              if (dep && !mod.depMatched[i] && !processed[depId]) {
                if (getOwn(traced, depId)) {
                  mod.defineDep(i, defined[depId]);
                  mod.check();
                } else {
                  breakCycle(dep, traced, processed);
                }
              }
            });
            processed[id] = true;
          }
        }
        function checkLoaded() {
          var err,
              usingPathFallback,
              waitInterval = config.waitSeconds * 1000,
              expired = waitInterval && (context.startTime + waitInterval) < new Date().getTime(),
              noLoads = [],
              reqCalls = [],
              stillLoading = false,
              needCycleCheck = true;
          if (inCheckLoaded) {
            return ;
          }
          inCheckLoaded = true;
          eachProp(enabledRegistry, function(mod) {
            var map = mod.map,
                modId = map.id;
            if (!mod.enabled) {
              return ;
            }
            if (!map.isDefine) {
              reqCalls.push(mod);
            }
            if (!mod.error) {
              if (!mod.inited && expired) {
                if (hasPathFallback(modId)) {
                  usingPathFallback = true;
                  stillLoading = true;
                } else {
                  noLoads.push(modId);
                  removeScript(modId);
                }
              } else if (!mod.inited && mod.fetched && map.isDefine) {
                stillLoading = true;
                if (!map.prefix) {
                  return (needCycleCheck = false);
                }
              }
            }
          });
          if (expired && noLoads.length) {
            err = makeError('timeout', 'Load timeout for modules: ' + noLoads, null, noLoads);
            err.contextName = context.contextName;
            return onError(err);
          }
          if (needCycleCheck) {
            each(reqCalls, function(mod) {
              breakCycle(mod, {}, {});
            });
          }
          if ((!expired || usingPathFallback) && stillLoading) {
            if ((isBrowser || isWebWorker) && !checkLoadedTimeoutId) {
              checkLoadedTimeoutId = setTimeout(function() {
                checkLoadedTimeoutId = 0;
                checkLoaded();
              }, 50);
            }
          }
          inCheckLoaded = false;
        }
        Module = function(map) {
          this.events = getOwn(undefEvents, map.id) || {};
          this.map = map;
          this.shim = getOwn(config.shim, map.id);
          this.depExports = [];
          this.depMaps = [];
          this.depMatched = [];
          this.pluginMaps = {};
          this.depCount = 0;
        };
        Module.prototype = {
          init: function(depMaps, factory, errback, options) {
            options = options || {};
            if (this.inited) {
              return ;
            }
            this.factory = factory;
            if (errback) {
              this.on('error', errback);
            } else if (this.events.error) {
              errback = bind(this, function(err) {
                this.emit('error', err);
              });
            }
            this.depMaps = depMaps && depMaps.slice(0);
            this.errback = errback;
            this.inited = true;
            this.ignore = options.ignore;
            if (options.enabled || this.enabled) {
              this.enable();
            } else {
              this.check();
            }
          },
          defineDep: function(i, depExports) {
            if (!this.depMatched[i]) {
              this.depMatched[i] = true;
              this.depCount -= 1;
              this.depExports[i] = depExports;
            }
          },
          fetch: function() {
            if (this.fetched) {
              return ;
            }
            this.fetched = true;
            context.startTime = (new Date()).getTime();
            var map = this.map;
            if (this.shim) {
              context.makeRequire(this.map, {enableBuildCallback: true})(this.shim.deps || [], bind(this, function() {
                return map.prefix ? this.callPlugin() : this.load();
              }));
            } else {
              return map.prefix ? this.callPlugin() : this.load();
            }
          },
          load: function() {
            var url = this.map.url;
            if (!urlFetched[url]) {
              urlFetched[url] = true;
              context.load(this.map.id, url);
            }
          },
          check: function() {
            if (!this.enabled || this.enabling) {
              return ;
            }
            var err,
                cjsModule,
                id = this.map.id,
                depExports = this.depExports,
                exports = this.exports,
                factory = this.factory;
            if (!this.inited) {
              this.fetch();
            } else if (this.error) {
              this.emit('error', this.error);
            } else if (!this.defining) {
              this.defining = true;
              if (this.depCount < 1 && !this.defined) {
                if (isFunction(factory)) {
                  if ((this.events.error && this.map.isDefine) || req.onError !== defaultOnError) {
                    try {
                      exports = context.execCb(id, factory, depExports, exports);
                    } catch (e) {
                      err = e;
                    }
                  } else {
                    exports = context.execCb(id, factory, depExports, exports);
                  }
                  if (this.map.isDefine && exports === undefined) {
                    cjsModule = this.module;
                    if (cjsModule) {
                      exports = cjsModule.exports;
                    } else if (this.usingExports) {
                      exports = this.exports;
                    }
                  }
                  if (err) {
                    err.requireMap = this.map;
                    err.requireModules = this.map.isDefine ? [this.map.id] : null;
                    err.requireType = this.map.isDefine ? 'define' : 'require';
                    return onError((this.error = err));
                  }
                } else {
                  exports = factory;
                }
                this.exports = exports;
                if (this.map.isDefine && !this.ignore) {
                  defined[id] = exports;
                  if (req.onResourceLoad) {
                    req.onResourceLoad(context, this.map, this.depMaps);
                  }
                }
                cleanRegistry(id);
                this.defined = true;
              }
              this.defining = false;
              if (this.defined && !this.defineEmitted) {
                this.defineEmitted = true;
                this.emit('defined', this.exports);
                this.defineEmitComplete = true;
              }
            }
          },
          callPlugin: function() {
            var map = this.map,
                id = map.id,
                pluginMap = makeModuleMap(map.prefix);
            this.depMaps.push(pluginMap);
            on(pluginMap, 'defined', bind(this, function(plugin) {
              var load,
                  normalizedMap,
                  normalizedMod,
                  bundleId = getOwn(bundlesMap, this.map.id),
                  name = this.map.name,
                  parentName = this.map.parentMap ? this.map.parentMap.name : null,
                  localRequire = context.makeRequire(map.parentMap, {enableBuildCallback: true});
              if (this.map.unnormalized) {
                if (plugin.normalize) {
                  name = plugin.normalize(name, function(name) {
                    return normalize(name, parentName, true);
                  }) || '';
                }
                normalizedMap = makeModuleMap(map.prefix + '!' + name, this.map.parentMap);
                on(normalizedMap, 'defined', bind(this, function(value) {
                  this.init([], function() {
                    return value;
                  }, null, {
                    enabled: true,
                    ignore: true
                  });
                }));
                normalizedMod = getOwn(registry, normalizedMap.id);
                if (normalizedMod) {
                  this.depMaps.push(normalizedMap);
                  if (this.events.error) {
                    normalizedMod.on('error', bind(this, function(err) {
                      this.emit('error', err);
                    }));
                  }
                  normalizedMod.enable();
                }
                return ;
              }
              if (bundleId) {
                this.map.url = context.nameToUrl(bundleId);
                this.load();
                return ;
              }
              load = bind(this, function(value) {
                this.init([], function() {
                  return value;
                }, null, {enabled: true});
              });
              load.error = bind(this, function(err) {
                this.inited = true;
                this.error = err;
                err.requireModules = [id];
                eachProp(registry, function(mod) {
                  if (mod.map.id.indexOf(id + '_unnormalized') === 0) {
                    cleanRegistry(mod.map.id);
                  }
                });
                onError(err);
              });
              load.fromText = bind(this, function(text, textAlt) {
                var moduleName = map.name,
                    moduleMap = makeModuleMap(moduleName),
                    hasInteractive = useInteractive;
                if (textAlt) {
                  text = textAlt;
                }
                if (hasInteractive) {
                  useInteractive = false;
                }
                getModule(moduleMap);
                if (hasProp(config.config, id)) {
                  config.config[moduleName] = config.config[id];
                }
                try {
                  req.exec(text);
                } catch (e) {
                  return onError(makeError('fromtexteval', 'fromText eval for ' + id + ' failed: ' + e, e, [id]));
                }
                if (hasInteractive) {
                  useInteractive = true;
                }
                this.depMaps.push(moduleMap);
                context.completeLoad(moduleName);
                localRequire([moduleName], load);
              });
              plugin.load(map.name, localRequire, load, config);
            }));
            context.enable(pluginMap, this);
            this.pluginMaps[pluginMap.id] = pluginMap;
          },
          enable: function() {
            enabledRegistry[this.map.id] = this;
            this.enabled = true;
            this.enabling = true;
            each(this.depMaps, bind(this, function(depMap, i) {
              var id,
                  mod,
                  handler;
              if (typeof depMap === 'string') {
                depMap = makeModuleMap(depMap, (this.map.isDefine ? this.map : this.map.parentMap), false, !this.skipMap);
                this.depMaps[i] = depMap;
                handler = getOwn(handlers, depMap.id);
                if (handler) {
                  this.depExports[i] = handler(this);
                  return ;
                }
                this.depCount += 1;
                on(depMap, 'defined', bind(this, function(depExports) {
                  this.defineDep(i, depExports);
                  this.check();
                }));
                if (this.errback) {
                  on(depMap, 'error', bind(this, this.errback));
                } else if (this.events.error) {
                  on(depMap, 'error', bind(this, function(err) {
                    this.emit('error', err);
                  }));
                }
              }
              id = depMap.id;
              mod = registry[id];
              if (!hasProp(handlers, id) && mod && !mod.enabled) {
                context.enable(depMap, this);
              }
            }));
            eachProp(this.pluginMaps, bind(this, function(pluginMap) {
              var mod = getOwn(registry, pluginMap.id);
              if (mod && !mod.enabled) {
                context.enable(pluginMap, this);
              }
            }));
            this.enabling = false;
            this.check();
          },
          on: function(name, cb) {
            var cbs = this.events[name];
            if (!cbs) {
              cbs = this.events[name] = [];
            }
            cbs.push(cb);
          },
          emit: function(name, evt) {
            each(this.events[name], function(cb) {
              cb(evt);
            });
            if (name === 'error') {
              delete this.events[name];
            }
          }
        };
        function callGetModule(args) {
          if (!hasProp(defined, args[0])) {
            getModule(makeModuleMap(args[0], null, true)).init(args[1], args[2]);
          }
        }
        function removeListener(node, func, name, ieName) {
          if (node.detachEvent && !isOpera) {
            if (ieName) {
              node.detachEvent(ieName, func);
            }
          } else {
            node.removeEventListener(name, func, false);
          }
        }
        function getScriptData(evt) {
          var node = evt.currentTarget || evt.srcElement;
          removeListener(node, context.onScriptLoad, 'load', 'onreadystatechange');
          removeListener(node, context.onScriptError, 'error');
          return {
            node: node,
            id: node && node.getAttribute('data-requiremodule')
          };
        }
        function intakeDefines() {
          var args;
          takeGlobalQueue();
          while (defQueue.length) {
            args = defQueue.shift();
            if (args[0] === null) {
              return onError(makeError('mismatch', 'Mismatched anonymous define() module: ' + args[args.length - 1]));
            } else {
              callGetModule(args);
            }
          }
        }
        context = {
          config: config,
          contextName: contextName,
          registry: registry,
          defined: defined,
          urlFetched: urlFetched,
          defQueue: defQueue,
          Module: Module,
          makeModuleMap: makeModuleMap,
          nextTick: req.nextTick,
          onError: onError,
          configure: function(cfg) {
            if (cfg.baseUrl) {
              if (cfg.baseUrl.charAt(cfg.baseUrl.length - 1) !== '/') {
                cfg.baseUrl += '/';
              }
            }
            var shim = config.shim,
                objs = {
                  paths: true,
                  bundles: true,
                  config: true,
                  map: true
                };
            eachProp(cfg, function(value, prop) {
              if (objs[prop]) {
                if (!config[prop]) {
                  config[prop] = {};
                }
                mixin(config[prop], value, true, true);
              } else {
                config[prop] = value;
              }
            });
            if (cfg.bundles) {
              eachProp(cfg.bundles, function(value, prop) {
                each(value, function(v) {
                  if (v !== prop) {
                    bundlesMap[v] = prop;
                  }
                });
              });
            }
            if (cfg.shim) {
              eachProp(cfg.shim, function(value, id) {
                if (isArray(value)) {
                  value = {deps: value};
                }
                if ((value.exports || value.init) && !value.exportsFn) {
                  value.exportsFn = context.makeShimExports(value);
                }
                shim[id] = value;
              });
              config.shim = shim;
            }
            if (cfg.packages) {
              each(cfg.packages, function(pkgObj) {
                var location,
                    name;
                pkgObj = typeof pkgObj === 'string' ? {name: pkgObj} : pkgObj;
                name = pkgObj.name;
                location = pkgObj.location;
                if (location) {
                  config.paths[name] = pkgObj.location;
                }
                config.pkgs[name] = pkgObj.name + '/' + (pkgObj.main || 'main').replace(currDirRegExp, '').replace(jsSuffixRegExp, '');
              });
            }
            eachProp(registry, function(mod, id) {
              if (!mod.inited && !mod.map.unnormalized) {
                mod.map = makeModuleMap(id);
              }
            });
            if (cfg.deps || cfg.callback) {
              context.require(cfg.deps || [], cfg.callback);
            }
          },
          makeShimExports: function(value) {
            function fn() {
              var ret;
              if (value.init) {
                ret = value.init.apply(global, arguments);
              }
              return ret || (value.exports && getGlobal(value.exports));
            }
            return fn;
          },
          makeRequire: function(relMap, options) {
            options = options || {};
            function localRequire(deps, callback, errback) {
              var id,
                  map,
                  requireMod;
              if (options.enableBuildCallback && callback && isFunction(callback)) {
                callback.__requireJsBuild = true;
              }
              if (typeof deps === 'string') {
                if (isFunction(callback)) {
                  return onError(makeError('requireargs', 'Invalid require call'), errback);
                }
                if (relMap && hasProp(handlers, deps)) {
                  return handlers[deps](registry[relMap.id]);
                }
                if (req.get) {
                  return req.get(context, deps, relMap, localRequire);
                }
                map = makeModuleMap(deps, relMap, false, true);
                id = map.id;
                if (!hasProp(defined, id)) {
                  return onError(makeError('notloaded', 'Module name "' + id + '" has not been loaded yet for context: ' + contextName + (relMap ? '' : '. Use require([])')));
                }
                return defined[id];
              }
              intakeDefines();
              context.nextTick(function() {
                intakeDefines();
                requireMod = getModule(makeModuleMap(null, relMap));
                requireMod.skipMap = options.skipMap;
                requireMod.init(deps, callback, errback, {enabled: true});
                checkLoaded();
              });
              return localRequire;
            }
            mixin(localRequire, {
              isBrowser: isBrowser,
              toUrl: function(moduleNamePlusExt) {
                var ext,
                    index = moduleNamePlusExt.lastIndexOf('.'),
                    segment = moduleNamePlusExt.split('/')[0],
                    isRelative = segment === '.' || segment === '..';
                if (index !== -1 && (!isRelative || index > 1)) {
                  ext = moduleNamePlusExt.substring(index, moduleNamePlusExt.length);
                  moduleNamePlusExt = moduleNamePlusExt.substring(0, index);
                }
                return context.nameToUrl(normalize(moduleNamePlusExt, relMap && relMap.id, true), ext, true);
              },
              defined: function(id) {
                return hasProp(defined, makeModuleMap(id, relMap, false, true).id);
              },
              specified: function(id) {
                id = makeModuleMap(id, relMap, false, true).id;
                return hasProp(defined, id) || hasProp(registry, id);
              }
            });
            if (!relMap) {
              localRequire.undef = function(id) {
                takeGlobalQueue();
                var map = makeModuleMap(id, relMap, true),
                    mod = getOwn(registry, id);
                removeScript(id);
                delete defined[id];
                delete urlFetched[map.url];
                delete undefEvents[id];
                eachReverse(defQueue, function(args, i) {
                  if (args[0] === id) {
                    defQueue.splice(i, 1);
                  }
                });
                if (mod) {
                  if (mod.events.defined) {
                    undefEvents[id] = mod.events;
                  }
                  cleanRegistry(id);
                }
              };
            }
            return localRequire;
          },
          enable: function(depMap) {
            var mod = getOwn(registry, depMap.id);
            if (mod) {
              getModule(depMap).enable();
            }
          },
          completeLoad: function(moduleName) {
            var found,
                args,
                mod,
                shim = getOwn(config.shim, moduleName) || {},
                shExports = shim.exports;
            takeGlobalQueue();
            while (defQueue.length) {
              args = defQueue.shift();
              if (args[0] === null) {
                args[0] = moduleName;
                if (found) {
                  break;
                }
                found = true;
              } else if (args[0] === moduleName) {
                found = true;
              }
              callGetModule(args);
            }
            mod = getOwn(registry, moduleName);
            if (!found && !hasProp(defined, moduleName) && mod && !mod.inited) {
              if (config.enforceDefine && (!shExports || !getGlobal(shExports))) {
                if (hasPathFallback(moduleName)) {
                  return ;
                } else {
                  return onError(makeError('nodefine', 'No define call for ' + moduleName, null, [moduleName]));
                }
              } else {
                callGetModule([moduleName, (shim.deps || []), shim.exportsFn]);
              }
            }
            checkLoaded();
          },
          nameToUrl: function(moduleName, ext, skipExt) {
            var paths,
                syms,
                i,
                parentModule,
                url,
                parentPath,
                bundleId,
                pkgMain = getOwn(config.pkgs, moduleName);
            if (pkgMain) {
              moduleName = pkgMain;
            }
            bundleId = getOwn(bundlesMap, moduleName);
            if (bundleId) {
              return context.nameToUrl(bundleId, ext, skipExt);
            }
            if (req.jsExtRegExp.test(moduleName)) {
              url = moduleName + (ext || '');
            } else {
              paths = config.paths;
              syms = moduleName.split('/');
              for (i = syms.length; i > 0; i -= 1) {
                parentModule = syms.slice(0, i).join('/');
                parentPath = getOwn(paths, parentModule);
                if (parentPath) {
                  if (isArray(parentPath)) {
                    parentPath = parentPath[0];
                  }
                  syms.splice(0, i, parentPath);
                  break;
                }
              }
              url = syms.join('/');
              url += (ext || (/^data\:|\?/.test(url) || skipExt ? '' : '.js'));
              url = (url.charAt(0) === '/' || url.match(/^[\w\+\.\-]+:/) ? '' : config.baseUrl) + url;
            }
            return config.urlArgs ? url + ((url.indexOf('?') === -1 ? '?' : '&') + config.urlArgs) : url;
          },
          load: function(id, url) {
            req.load(context, id, url);
          },
          execCb: function(name, callback, args, exports) {
            return callback.apply(exports, args);
          },
          onScriptLoad: function(evt) {
            if (evt.type === 'load' || (readyRegExp.test((evt.currentTarget || evt.srcElement).readyState))) {
              interactiveScript = null;
              var data = getScriptData(evt);
              context.completeLoad(data.id);
            }
          },
          onScriptError: function(evt) {
            var data = getScriptData(evt);
            if (!hasPathFallback(data.id)) {
              return onError(makeError('scripterror', 'Script error for: ' + data.id, evt, [data.id]));
            }
          }
        };
        context.require = context.makeRequire();
        return context;
      }
      req = requirejs = function(deps, callback, errback, optional) {
        var context,
            config,
            contextName = defContextName;
        if (!isArray(deps) && typeof deps !== 'string') {
          config = deps;
          if (isArray(callback)) {
            deps = callback;
            callback = errback;
            errback = optional;
          } else {
            deps = [];
          }
        }
        if (config && config.context) {
          contextName = config.context;
        }
        context = getOwn(contexts, contextName);
        if (!context) {
          context = contexts[contextName] = req.s.newContext(contextName);
        }
        if (config) {
          context.configure(config);
        }
        return context.require(deps, callback, errback);
      };
      req.config = function(config) {
        return req(config);
      };
      req.nextTick = typeof setTimeout !== 'undefined' ? function(fn) {
        setTimeout(fn, 4);
      } : function(fn) {
        fn();
      };
      if (!require) {
        require = req;
      }
      req.version = version;
      req.jsExtRegExp = /^\/|:|\?|\.js$/;
      req.isBrowser = isBrowser;
      s = req.s = {
        contexts: contexts,
        newContext: newContext
      };
      req({});
      each(['toUrl', 'undef', 'defined', 'specified'], function(prop) {
        req[prop] = function() {
          var ctx = contexts[defContextName];
          return ctx.require[prop].apply(ctx, arguments);
        };
      });
      if (isBrowser) {
        head = s.head = document.getElementsByTagName('head')[0];
        baseElement = document.getElementsByTagName('base')[0];
        if (baseElement) {
          head = s.head = baseElement.parentNode;
        }
      }
      req.onError = defaultOnError;
      req.createNode = function(config, moduleName, url) {
        var node = config.xhtml ? document.createElementNS('http://www.w3.org/1999/xhtml', 'html:script') : document.createElement('script');
        node.type = config.scriptType || 'text/javascript';
        node.charset = 'utf-8';
        node.async = true;
        return node;
      };
      req.load = function(context, moduleName, url) {
        var config = (context && context.config) || {},
            node;
        if (isBrowser) {
          node = req.createNode(config, moduleName, url);
          node.setAttribute('data-requirecontext', context.contextName);
          node.setAttribute('data-requiremodule', moduleName);
          if (node.attachEvent && !(node.attachEvent.toString && node.attachEvent.toString().indexOf('[native code') < 0) && !isOpera) {
            useInteractive = true;
            node.attachEvent('onreadystatechange', context.onScriptLoad);
          } else {
            node.addEventListener('load', context.onScriptLoad, false);
            node.addEventListener('error', context.onScriptError, false);
          }
          node.src = url;
          currentlyAddingScript = node;
          if (baseElement) {
            head.insertBefore(node, baseElement);
          } else {
            head.appendChild(node);
          }
          currentlyAddingScript = null;
          return node;
        } else if (isWebWorker) {
          try {
            importScripts(url);
            context.completeLoad(moduleName);
          } catch (e) {
            context.onError(makeError('importscripts', 'importScripts failed for ' + moduleName + ' at ' + url, e, [moduleName]));
          }
        }
      };
      function getInteractiveScript() {
        if (interactiveScript && interactiveScript.readyState === 'interactive') {
          return interactiveScript;
        }
        eachReverse(scripts(), function(script) {
          if (script.readyState === 'interactive') {
            return (interactiveScript = script);
          }
        });
        return interactiveScript;
      }
      if (isBrowser && !cfg.skipDataMain) {
        eachReverse(scripts(), function(script) {
          if (!head) {
            head = script.parentNode;
          }
          dataMain = script.getAttribute('data-main');
          if (dataMain) {
            mainScript = dataMain;
            if (!cfg.baseUrl) {
              src = mainScript.split('/');
              mainScript = src.pop();
              subPath = src.length ? src.join('/') + '/' : './';
              cfg.baseUrl = subPath;
            }
            mainScript = mainScript.replace(jsSuffixRegExp, '');
            if (req.jsExtRegExp.test(mainScript)) {
              mainScript = dataMain;
            }
            cfg.deps = cfg.deps ? cfg.deps.concat(mainScript) : [mainScript];
            return true;
          }
        });
      }
      define = function(name, deps, callback) {
        var node,
            context;
        if (typeof name !== 'string') {
          callback = deps;
          deps = name;
          name = null;
        }
        if (!isArray(deps)) {
          callback = deps;
          deps = null;
        }
        if (!deps && isFunction(callback)) {
          deps = [];
          if (callback.length) {
            callback.toString().replace(commentRegExp, '').replace(cjsRequireRegExp, function(match, dep) {
              deps.push(dep);
            });
            deps = (callback.length === 1 ? ['require'] : ['require', 'exports', 'module']).concat(deps);
          }
        }
        if (useInteractive) {
          node = currentlyAddingScript || getInteractiveScript();
          if (node) {
            if (!name) {
              name = node.getAttribute('data-requiremodule');
            }
            context = contexts[node.getAttribute('data-requirecontext')];
          }
        }
        (context ? context.defQueue : globalDefQueue).push([name, deps, callback]);
      };
      define.amd = {jQuery: true};
      req.exec = function(text) {
        return eval(text);
      };
      req(cfg);
    }(this));
    this.requirejsVars = {
      require: require,
      requirejs: require,
      define: define
    };
    if (env === 'browser') {
      (function() {
        function exec() {
          eval(arguments[0]);
        }
        require.load = function(context, moduleName, url) {
          var xhr = new XMLHttpRequest();
          xhr.open('GET', url, true);
          xhr.send();
          xhr.onreadystatechange = function() {
            if (xhr.readyState === 4) {
              exec(xhr.responseText);
              context.completeLoad(moduleName);
            }
          };
        };
      }());
    } else if (env === 'rhino') {
      (function() {
        'use strict';
        require.load = function(context, moduleName, url) {
          load(url);
          context.completeLoad(moduleName);
        };
      }());
    } else if (env === 'node') {
      this.requirejsVars.nodeRequire = nodeRequire;
      require.nodeRequire = nodeRequire;
      (function() {
        var nodeReq = requirejsVars.nodeRequire,
            req = requirejsVars.require,
            def = requirejsVars.define,
            fs = nodeReq('fs'),
            path = nodeReq('path'),
            vm = nodeReq('vm'),
            exists = fs.existsSync || path.existsSync,
            hasOwn = Object.prototype.hasOwnProperty;
        function hasProp(obj, prop) {
          return hasOwn.call(obj, prop);
        }
        function syncTick(fn) {
          fn();
        }
        function makeError(message, moduleName) {
          var err = new Error(message);
          err.requireModules = [moduleName];
          return err;
        }
        req.get = function(context, moduleName, relModuleMap, localRequire) {
          if (moduleName === "require" || moduleName === "exports" || moduleName === "module") {
            context.onError(makeError("Explicit require of " + moduleName + " is not allowed.", moduleName));
          }
          var ret,
              oldTick,
              moduleMap = context.makeModuleMap(moduleName, relModuleMap, false, true);
          moduleName = moduleMap.id;
          if (hasProp(context.defined, moduleName)) {
            ret = context.defined[moduleName];
          } else {
            if (ret === undefined) {
              oldTick = context.nextTick;
              context.nextTick = syncTick;
              try {
                if (moduleMap.prefix) {
                  localRequire([moduleMap.originalName]);
                  moduleMap = context.makeModuleMap(moduleMap.originalName, relModuleMap, false, true);
                  moduleName = moduleMap.id;
                } else {
                  req.load(context, moduleName, moduleMap.url);
                  context.enable(moduleMap, relModuleMap);
                }
                context.require([moduleName]);
                ret = context.defined[moduleName];
              } finally {
                context.nextTick = oldTick;
              }
            }
          }
          return ret;
        };
        req.nextTick = function(fn) {
          process.nextTick(fn);
        };
        req.makeNodeWrapper = function(contents) {
          return '(function (require, requirejs, define) { ' + contents + '\n}(requirejsVars.require, requirejsVars.requirejs, requirejsVars.define));';
        };
        req.load = function(context, moduleName, url) {
          var contents,
              err,
              config = context.config;
          if (config.shim[moduleName] && (!config.suppress || !config.suppress.nodeShim)) {
            console.warn('Shim config not supported in Node, may or may not work. Detected ' + 'for module: ' + moduleName);
          }
          if (exists(url)) {
            contents = fs.readFileSync(url, 'utf8');
            contents = req.makeNodeWrapper(contents);
            try {
              vm.runInThisContext(contents, fs.realpathSync(url));
            } catch (e) {
              err = new Error('Evaluating ' + url + ' as module "' + moduleName + '" failed with error: ' + e);
              err.originalError = e;
              err.moduleName = moduleName;
              err.requireModules = [moduleName];
              err.fileName = url;
              return context.onError(err);
            }
          } else {
            def(moduleName, function() {
              var dirName,
                  map = hasProp(context.registry, moduleName) && context.registry[moduleName].map,
                  parentMap = map && map.parentMap,
                  originalName = map && map.originalName;
              if (originalName.charAt(0) === '.' && parentMap) {
                dirName = parentMap.url.split('/');
                dirName.pop();
                originalName = dirName.join('/') + '/' + originalName;
              }
              try {
                return (context.config.nodeRequire || req.nodeRequire)(originalName);
              } catch (e) {
                err = new Error('Tried loading "' + moduleName + '" at ' + url + ' then tried node\'s require("' + originalName + '") and it failed ' + 'with error: ' + e);
                err.originalError = e;
                err.moduleName = originalName;
                err.requireModules = [moduleName];
                throw err;
              }
            });
          }
          context.completeLoad(moduleName);
        };
        req.exec = function(text) {
          text = req.makeNodeWrapper(text);
          return eval(text);
        };
      }());
    } else if (env === 'xpconnect') {
      (function() {
        'use strict';
        require.load = function(context, moduleName, url) {
          load(url);
          context.completeLoad(moduleName);
        };
      }());
    }
    if (commandOption !== 'o' && (!fileName || !jsSuffixRegExp.test(fileName))) {
      fileName = 'main.js';
    }
    function loadLib() {
      (function() {
        var pathRegExp = /(\/|^)env\/|\{env\}/,
            env = 'unknown';
        if (typeof process !== 'undefined' && process.versions && !!process.versions.node) {
          env = 'node';
        } else if (typeof Packages !== 'undefined') {
          env = 'rhino';
        } else if ((typeof navigator !== 'undefined' && typeof document !== 'undefined') || (typeof importScripts !== 'undefined' && typeof self !== 'undefined')) {
          env = 'browser';
        } else if (typeof Components !== 'undefined' && Components.classes && Components.interfaces) {
          env = 'xpconnect';
        }
        define('env', {
          get: function() {
            return env;
          },
          load: function(name, req, load, config) {
            if (config.env) {
              env = config.env;
            }
            name = name.replace(pathRegExp, function(match, prefix) {
              if (match.indexOf('{') === -1) {
                return prefix + env + '/';
              } else {
                return env;
              }
            });
            req([name], function(mod) {
              load(mod);
            });
          }
        });
      }());
      define('lang', function() {
        'use strict';
        var lang,
            isJavaObj,
            hasOwn = Object.prototype.hasOwnProperty;
        function hasProp(obj, prop) {
          return hasOwn.call(obj, prop);
        }
        isJavaObj = function() {
          return false;
        };
        if (typeof java !== 'undefined' && java.lang && java.lang.Object && typeof importPackage !== 'undefined') {
          isJavaObj = function(obj) {
            return obj instanceof java.lang.Object;
          };
        }
        lang = {
          backSlashRegExp: /\\/g,
          ostring: Object.prototype.toString,
          isArray: Array.isArray || function(it) {
            return lang.ostring.call(it) === "[object Array]";
          },
          isFunction: function(it) {
            return lang.ostring.call(it) === "[object Function]";
          },
          isRegExp: function(it) {
            return it && it instanceof RegExp;
          },
          hasProp: hasProp,
          falseProp: function(obj, prop) {
            return !hasProp(obj, prop) || !obj[prop];
          },
          getOwn: function(obj, prop) {
            return hasProp(obj, prop) && obj[prop];
          },
          _mixin: function(dest, source, override) {
            var name;
            for (name in source) {
              if (source.hasOwnProperty(name) && (override || !dest.hasOwnProperty(name))) {
                dest[name] = source[name];
              }
            }
            return dest;
          },
          mixin: function(dest) {
            var parameters = Array.prototype.slice.call(arguments),
                override,
                i,
                l;
            if (!dest) {
              dest = {};
            }
            if (parameters.length > 2 && typeof arguments[parameters.length - 1] === 'boolean') {
              override = parameters.pop();
            }
            for (i = 1, l = parameters.length; i < l; i++) {
              lang._mixin(dest, parameters[i], override);
            }
            return dest;
          },
          deepMix: function(dest, source) {
            lang.eachProp(source, function(value, prop) {
              if (typeof value === 'object' && value && !lang.isArray(value) && !lang.isFunction(value) && !(value instanceof RegExp)) {
                if (!dest[prop]) {
                  dest[prop] = {};
                }
                lang.deepMix(dest[prop], value);
              } else {
                dest[prop] = value;
              }
            });
            return dest;
          },
          deeplikeCopy: function(obj) {
            var type,
                result;
            if (lang.isArray(obj)) {
              result = [];
              obj.forEach(function(value) {
                result.push(lang.deeplikeCopy(value));
              });
              return result;
            }
            type = typeof obj;
            if (obj === null || obj === undefined || type === 'boolean' || type === 'string' || type === 'number' || lang.isFunction(obj) || lang.isRegExp(obj) || isJavaObj(obj)) {
              return obj;
            }
            result = {};
            lang.eachProp(obj, function(value, key) {
              result[key] = lang.deeplikeCopy(value);
            });
            return result;
          },
          delegate: (function() {
            function TMP() {}
            return function(obj, props) {
              TMP.prototype = obj;
              var tmp = new TMP();
              TMP.prototype = null;
              if (props) {
                lang.mixin(tmp, props);
              }
              return tmp;
            };
          }()),
          each: function each(ary, func) {
            if (ary) {
              var i;
              for (i = 0; i < ary.length; i += 1) {
                if (func(ary[i], i, ary)) {
                  break;
                }
              }
            }
          },
          eachProp: function eachProp(obj, func) {
            var prop;
            for (prop in obj) {
              if (hasProp(obj, prop)) {
                if (func(obj[prop], prop)) {
                  break;
                }
              }
            }
          },
          bind: function bind(obj, fn) {
            return function() {
              return fn.apply(obj, arguments);
            };
          },
          jsEscape: function(content) {
            return content.replace(/(["'\\])/g, '\\$1').replace(/[\f]/g, "\\f").replace(/[\b]/g, "\\b").replace(/[\n]/g, "\\n").replace(/[\t]/g, "\\t").replace(/[\r]/g, "\\r");
          }
        };
        return lang;
      });
      var prim;
      (function() {
        'use strict';
        var op = Object.prototype,
            hasOwn = op.hasOwnProperty;
        function hasProp(obj, prop) {
          return hasOwn.call(obj, prop);
        }
        function each(ary, func) {
          if (ary) {
            var i;
            for (i = 0; i < ary.length; i += 1) {
              if (ary[i]) {
                func(ary[i], i, ary);
              }
            }
          }
        }
        function check(p) {
          if (hasProp(p, 'e') || hasProp(p, 'v')) {
            if (!prim.hideResolutionConflict) {
              throw new Error('nope');
            }
            return false;
          }
          return true;
        }
        function notify(ary, value) {
          prim.nextTick(function() {
            each(ary, function(item) {
              item(value);
            });
          });
        }
        prim = function prim() {
          var p,
              ok = [],
              fail = [];
          return (p = {
            callback: function(yes, no) {
              if (no) {
                p.errback(no);
              }
              if (hasProp(p, 'v')) {
                prim.nextTick(function() {
                  yes(p.v);
                });
              } else {
                ok.push(yes);
              }
            },
            errback: function(no) {
              if (hasProp(p, 'e')) {
                prim.nextTick(function() {
                  no(p.e);
                });
              } else {
                fail.push(no);
              }
            },
            finished: function() {
              return hasProp(p, 'e') || hasProp(p, 'v');
            },
            rejected: function() {
              return hasProp(p, 'e');
            },
            resolve: function(v) {
              if (check(p)) {
                p.v = v;
                notify(ok, v);
              }
              return p;
            },
            reject: function(e) {
              if (check(p)) {
                p.e = e;
                notify(fail, e);
              }
              return p;
            },
            start: function(fn) {
              p.resolve();
              return p.promise.then(fn);
            },
            promise: {
              then: function(yes, no) {
                var next = prim();
                p.callback(function(v) {
                  try {
                    if (yes && typeof yes === 'function') {
                      v = yes(v);
                    }
                    if (v && v.then) {
                      v.then(next.resolve, next.reject);
                    } else {
                      next.resolve(v);
                    }
                  } catch (e) {
                    next.reject(e);
                  }
                }, function(e) {
                  var err;
                  try {
                    if (!no || typeof no !== 'function') {
                      next.reject(e);
                    } else {
                      err = no(e);
                      if (err && err.then) {
                        err.then(next.resolve, next.reject);
                      } else {
                        next.resolve(err);
                      }
                    }
                  } catch (e2) {
                    next.reject(e2);
                  }
                });
                return next.promise;
              },
              fail: function(no) {
                return p.promise.then(null, no);
              },
              end: function() {
                p.errback(function(e) {
                  throw e;
                });
              }
            }
          });
        };
        prim.serial = function(ary) {
          var result = prim().resolve().promise;
          each(ary, function(item) {
            result = result.then(function() {
              return item();
            });
          });
          return result;
        };
        prim.nextTick = typeof setImmediate === 'function' ? setImmediate : (typeof process !== 'undefined' && process.nextTick ? process.nextTick : (typeof setTimeout !== 'undefined' ? function(fn) {
          setTimeout(fn, 0);
        } : function(fn) {
          fn();
        }));
        if (typeof define === 'function' && define.amd) {
          define('prim', function() {
            return prim;
          });
        } else if (typeof module !== 'undefined' && module.exports) {
          module.exports = prim;
        }
      }());
      if (env === 'browser') {
        define('browser/assert', function() {
          return {};
        });
      }
      if (env === 'node') {
        define('node/assert', ['assert'], function(assert) {
          return assert;
        });
      }
      if (env === 'rhino') {
        define('rhino/assert', function() {
          return {};
        });
      }
      if (env === 'xpconnect') {
        define('xpconnect/assert', function() {
          return {};
        });
      }
      if (env === 'browser') {
        define('browser/args', function() {
          return [];
        });
      }
      if (env === 'node') {
        define('node/args', function() {
          var args = process.argv.slice(2);
          if (args[0] && args[0].indexOf('-') === 0) {
            args = args.slice(1);
          }
          return args;
        });
      }
      if (env === 'rhino') {
        var jsLibRhinoArgs = (typeof rhinoArgs !== 'undefined' && rhinoArgs) || [].concat(Array.prototype.slice.call(arguments, 0));
        define('rhino/args', function() {
          var args = jsLibRhinoArgs;
          if (args[0] && args[0].indexOf('-') === 0) {
            args = args.slice(1);
          }
          return args;
        });
      }
      if (env === 'xpconnect') {
        var jsLibXpConnectArgs = (typeof xpconnectArgs !== 'undefined' && xpconnectArgs) || [].concat(Array.prototype.slice.call(arguments, 0));
        define('xpconnect/args', function() {
          var args = jsLibXpConnectArgs;
          if (args[0] && args[0].indexOf('-') === 0) {
            args = args.slice(1);
          }
          return args;
        });
      }
      if (env === 'browser') {
        define('browser/load', ['./file'], function(file) {
          function load(fileName) {
            eval(file.readFile(fileName));
          }
          return load;
        });
      }
      if (env === 'node') {
        define('node/load', ['fs'], function(fs) {
          function load(fileName) {
            var contents = fs.readFileSync(fileName, 'utf8');
            process.compile(contents, fileName);
          }
          return load;
        });
      }
      if (env === 'rhino') {
        define('rhino/load', function() {
          return load;
        });
      }
      if (env === 'xpconnect') {
        define('xpconnect/load', function() {
          return load;
        });
      }
      if (env === 'browser') {
        define('browser/file', ['prim'], function(prim) {
          var file,
              currDirRegExp = /^\.(\/|$)/;
          function frontSlash(path) {
            return path.replace(/\\/g, '/');
          }
          function exists(path) {
            var status,
                xhr = new XMLHttpRequest();
            xhr.open('HEAD', path, false);
            xhr.send();
            status = xhr.status;
            return status === 200 || status === 304;
          }
          function mkDir(dir) {
            console.log('mkDir is no-op in browser');
          }
          function mkFullDir(dir) {
            console.log('mkFullDir is no-op in browser');
          }
          file = {
            backSlashRegExp: /\\/g,
            exclusionRegExp: /^\./,
            getLineSeparator: function() {
              return '/';
            },
            exists: function(fileName) {
              return exists(fileName);
            },
            parent: function(fileName) {
              var parts = fileName.split('/');
              parts.pop();
              return parts.join('/');
            },
            absPath: function(fileName) {
              var dir;
              if (currDirRegExp.test(fileName)) {
                dir = frontSlash(location.href);
                if (dir.indexOf('/') !== -1) {
                  dir = dir.split('/');
                  dir.splice(0, 3);
                  dir.pop();
                  dir = '/' + dir.join('/');
                }
                fileName = dir + fileName.substring(1);
              }
              return fileName;
            },
            normalize: function(fileName) {
              return fileName;
            },
            isFile: function(path) {
              return true;
            },
            isDirectory: function(path) {
              return false;
            },
            getFilteredFileList: function(startDir, regExpFilters, makeUnixPaths) {
              console.log('file.getFilteredFileList is no-op in browser');
            },
            copyDir: function(srcDir, destDir, regExpFilter, onlyCopyNew) {
              console.log('file.copyDir is no-op in browser');
            },
            copyFile: function(srcFileName, destFileName, onlyCopyNew) {
              console.log('file.copyFile is no-op in browser');
            },
            renameFile: function(from, to) {
              console.log('file.renameFile is no-op in browser');
            },
            readFile: function(path, encoding) {
              var xhr = new XMLHttpRequest();
              xhr.open('GET', path, false);
              xhr.send();
              return xhr.responseText;
            },
            readFileAsync: function(path, encoding) {
              var xhr = new XMLHttpRequest(),
                  d = prim();
              xhr.open('GET', path, true);
              xhr.send();
              xhr.onreadystatechange = function() {
                if (xhr.readyState === 4) {
                  if (xhr.status > 400) {
                    d.reject(new Error('Status: ' + xhr.status + ': ' + xhr.statusText));
                  } else {
                    d.resolve(xhr.responseText);
                  }
                }
              };
              return d.promise;
            },
            saveUtf8File: function(fileName, fileContents) {
              file.saveFile(fileName, fileContents, "utf8");
            },
            saveFile: function(fileName, fileContents, encoding) {
              requirejs.browser.saveFile(fileName, fileContents, encoding);
            },
            deleteFile: function(fileName) {
              console.log('file.deleteFile is no-op in browser');
            },
            deleteEmptyDirs: function(startDir) {
              console.log('file.deleteEmptyDirs is no-op in browser');
            }
          };
          return file;
        });
      }
      if (env === 'node') {
        define('node/file', ['fs', 'path', 'prim'], function(fs, path, prim) {
          var isWindows = process.platform === 'win32',
              windowsDriveRegExp = /^[a-zA-Z]\:\/$/,
              file;
          function frontSlash(path) {
            return path.replace(/\\/g, '/');
          }
          function exists(path) {
            if (isWindows && path.charAt(path.length - 1) === '/' && path.charAt(path.length - 2) !== ':') {
              path = path.substring(0, path.length - 1);
            }
            try {
              fs.statSync(path);
              return true;
            } catch (e) {
              return false;
            }
          }
          function mkDir(dir) {
            if (!exists(dir) && (!isWindows || !windowsDriveRegExp.test(dir))) {
              fs.mkdirSync(dir, 511);
            }
          }
          function mkFullDir(dir) {
            var parts = dir.split('/'),
                currDir = '',
                first = true;
            parts.forEach(function(part) {
              currDir += part + '/';
              first = false;
              if (part) {
                mkDir(currDir);
              }
            });
          }
          file = {
            backSlashRegExp: /\\/g,
            exclusionRegExp: /^\./,
            getLineSeparator: function() {
              return '/';
            },
            exists: function(fileName) {
              return exists(fileName);
            },
            parent: function(fileName) {
              var parts = fileName.split('/');
              parts.pop();
              return parts.join('/');
            },
            absPath: function(fileName) {
              return frontSlash(path.normalize(frontSlash(fs.realpathSync(fileName))));
            },
            normalize: function(fileName) {
              return frontSlash(path.normalize(fileName));
            },
            isFile: function(path) {
              return fs.statSync(path).isFile();
            },
            isDirectory: function(path) {
              return fs.statSync(path).isDirectory();
            },
            getFilteredFileList: function(startDir, regExpFilters, makeUnixPaths) {
              var files = [],
                  topDir,
                  regExpInclude,
                  regExpExclude,
                  dirFileArray,
                  i,
                  stat,
                  filePath,
                  ok,
                  dirFiles,
                  fileName;
              topDir = startDir;
              regExpInclude = regExpFilters.include || regExpFilters;
              regExpExclude = regExpFilters.exclude || null;
              if (file.exists(topDir)) {
                dirFileArray = fs.readdirSync(topDir);
                for (i = 0; i < dirFileArray.length; i++) {
                  fileName = dirFileArray[i];
                  filePath = path.join(topDir, fileName);
                  stat = fs.statSync(filePath);
                  if (stat.isFile()) {
                    if (makeUnixPaths) {
                      if (filePath.indexOf("/") === -1) {
                        filePath = frontSlash(filePath);
                      }
                    }
                    ok = true;
                    if (regExpInclude) {
                      ok = filePath.match(regExpInclude);
                    }
                    if (ok && regExpExclude) {
                      ok = !filePath.match(regExpExclude);
                    }
                    if (ok && (!file.exclusionRegExp || !file.exclusionRegExp.test(fileName))) {
                      files.push(filePath);
                    }
                  } else if (stat.isDirectory() && (!file.exclusionRegExp || !file.exclusionRegExp.test(fileName))) {
                    dirFiles = this.getFilteredFileList(filePath, regExpFilters, makeUnixPaths);
                    files.push.apply(files, dirFiles);
                  }
                }
              }
              return files;
            },
            copyDir: function(srcDir, destDir, regExpFilter, onlyCopyNew) {
              regExpFilter = regExpFilter || /\w/;
              srcDir = frontSlash(path.normalize(srcDir));
              destDir = frontSlash(path.normalize(destDir));
              var fileNames = file.getFilteredFileList(srcDir, regExpFilter, true),
                  copiedFiles = [],
                  i,
                  srcFileName,
                  destFileName;
              for (i = 0; i < fileNames.length; i++) {
                srcFileName = fileNames[i];
                destFileName = srcFileName.replace(srcDir, destDir);
                if (file.copyFile(srcFileName, destFileName, onlyCopyNew)) {
                  copiedFiles.push(destFileName);
                }
              }
              return copiedFiles.length ? copiedFiles : null;
            },
            copyFile: function(srcFileName, destFileName, onlyCopyNew) {
              var parentDir;
              if (onlyCopyNew) {
                if (file.exists(destFileName) && fs.statSync(destFileName).mtime.getTime() >= fs.statSync(srcFileName).mtime.getTime()) {
                  return false;
                }
              }
              parentDir = path.dirname(destFileName);
              if (!file.exists(parentDir)) {
                mkFullDir(parentDir);
              }
              fs.writeFileSync(destFileName, fs.readFileSync(srcFileName, 'binary'), 'binary');
              return true;
            },
            renameFile: function(from, to) {
              return fs.renameSync(from, to);
            },
            readFile: function(path, encoding) {
              if (encoding === 'utf-8') {
                encoding = 'utf8';
              }
              if (!encoding) {
                encoding = 'utf8';
              }
              var text = fs.readFileSync(path, encoding);
              if (text.indexOf('\uFEFF') === 0) {
                text = text.substring(1, text.length);
              }
              return text;
            },
            readFileAsync: function(path, encoding) {
              var d = prim();
              try {
                d.resolve(file.readFile(path, encoding));
              } catch (e) {
                d.reject(e);
              }
              return d.promise;
            },
            saveUtf8File: function(fileName, fileContents) {
              file.saveFile(fileName, fileContents, "utf8");
            },
            saveFile: function(fileName, fileContents, encoding) {
              var parentDir;
              if (encoding === 'utf-8') {
                encoding = 'utf8';
              }
              if (!encoding) {
                encoding = 'utf8';
              }
              parentDir = path.dirname(fileName);
              if (!file.exists(parentDir)) {
                mkFullDir(parentDir);
              }
              fs.writeFileSync(fileName, fileContents, encoding);
            },
            deleteFile: function(fileName) {
              var files,
                  i,
                  stat;
              if (file.exists(fileName)) {
                stat = fs.lstatSync(fileName);
                if (stat.isDirectory()) {
                  files = fs.readdirSync(fileName);
                  for (i = 0; i < files.length; i++) {
                    this.deleteFile(path.join(fileName, files[i]));
                  }
                  fs.rmdirSync(fileName);
                } else {
                  fs.unlinkSync(fileName);
                }
              }
            },
            deleteEmptyDirs: function(startDir) {
              var dirFileArray,
                  i,
                  fileName,
                  filePath,
                  stat;
              if (file.exists(startDir)) {
                dirFileArray = fs.readdirSync(startDir);
                for (i = 0; i < dirFileArray.length; i++) {
                  fileName = dirFileArray[i];
                  filePath = path.join(startDir, fileName);
                  stat = fs.lstatSync(filePath);
                  if (stat.isDirectory()) {
                    file.deleteEmptyDirs(filePath);
                  }
                }
                if (fs.readdirSync(startDir).length === 0) {
                  file.deleteFile(startDir);
                }
              }
            }
          };
          return file;
        });
      }
      if (env === 'rhino') {
        define('rhino/file', ['prim'], function(prim) {
          var file = {
            backSlashRegExp: /\\/g,
            exclusionRegExp: /^\./,
            getLineSeparator: function() {
              return file.lineSeparator;
            },
            lineSeparator: java.lang.System.getProperty("line.separator"),
            exists: function(fileName) {
              return (new java.io.File(fileName)).exists();
            },
            parent: function(fileName) {
              return file.absPath((new java.io.File(fileName)).getParentFile());
            },
            normalize: function(fileName) {
              return file.absPath(fileName);
            },
            isFile: function(path) {
              return (new java.io.File(path)).isFile();
            },
            isDirectory: function(path) {
              return (new java.io.File(path)).isDirectory();
            },
            absPath: function(fileObj) {
              if (typeof fileObj === "string") {
                fileObj = new java.io.File(fileObj);
              }
              return (fileObj.getCanonicalPath() + "").replace(file.backSlashRegExp, "/");
            },
            getFilteredFileList: function(startDir, regExpFilters, makeUnixPaths, startDirIsJavaObject) {
              var files = [],
                  topDir,
                  regExpInclude,
                  regExpExclude,
                  dirFileArray,
                  i,
                  fileObj,
                  filePath,
                  ok,
                  dirFiles;
              topDir = startDir;
              if (!startDirIsJavaObject) {
                topDir = new java.io.File(startDir);
              }
              regExpInclude = regExpFilters.include || regExpFilters;
              regExpExclude = regExpFilters.exclude || null;
              if (topDir.exists()) {
                dirFileArray = topDir.listFiles();
                for (i = 0; i < dirFileArray.length; i++) {
                  fileObj = dirFileArray[i];
                  if (fileObj.isFile()) {
                    filePath = fileObj.getPath();
                    if (makeUnixPaths) {
                      filePath = String(filePath);
                      if (filePath.indexOf("/") === -1) {
                        filePath = filePath.replace(/\\/g, "/");
                      }
                    }
                    ok = true;
                    if (regExpInclude) {
                      ok = filePath.match(regExpInclude);
                    }
                    if (ok && regExpExclude) {
                      ok = !filePath.match(regExpExclude);
                    }
                    if (ok && (!file.exclusionRegExp || !file.exclusionRegExp.test(fileObj.getName()))) {
                      files.push(filePath);
                    }
                  } else if (fileObj.isDirectory() && (!file.exclusionRegExp || !file.exclusionRegExp.test(fileObj.getName()))) {
                    dirFiles = this.getFilteredFileList(fileObj, regExpFilters, makeUnixPaths, true);
                    files.push.apply(files, dirFiles);
                  }
                }
              }
              return files;
            },
            copyDir: function(srcDir, destDir, regExpFilter, onlyCopyNew) {
              regExpFilter = regExpFilter || /\w/;
              var fileNames = file.getFilteredFileList(srcDir, regExpFilter, true),
                  copiedFiles = [],
                  i,
                  srcFileName,
                  destFileName;
              for (i = 0; i < fileNames.length; i++) {
                srcFileName = fileNames[i];
                destFileName = srcFileName.replace(srcDir, destDir);
                if (file.copyFile(srcFileName, destFileName, onlyCopyNew)) {
                  copiedFiles.push(destFileName);
                }
              }
              return copiedFiles.length ? copiedFiles : null;
            },
            copyFile: function(srcFileName, destFileName, onlyCopyNew) {
              var destFile = new java.io.File(destFileName),
                  srcFile,
                  parentDir,
                  srcChannel,
                  destChannel;
              if (onlyCopyNew) {
                srcFile = new java.io.File(srcFileName);
                if (destFile.exists() && destFile.lastModified() >= srcFile.lastModified()) {
                  return false;
                }
              }
              parentDir = destFile.getParentFile();
              if (!parentDir.exists()) {
                if (!parentDir.mkdirs()) {
                  throw "Could not create directory: " + parentDir.getCanonicalPath();
                }
              }
              srcChannel = new java.io.FileInputStream(srcFileName).getChannel();
              destChannel = new java.io.FileOutputStream(destFileName).getChannel();
              destChannel.transferFrom(srcChannel, 0, srcChannel.size());
              srcChannel.close();
              destChannel.close();
              return true;
            },
            renameFile: function(from, to) {
              return (new java.io.File(from)).renameTo((new java.io.File(to)));
            },
            readFile: function(path, encoding) {
              encoding = encoding || "utf-8";
              var fileObj = new java.io.File(path),
                  input = new java.io.BufferedReader(new java.io.InputStreamReader(new java.io.FileInputStream(fileObj), encoding)),
                  stringBuffer,
                  line;
              try {
                stringBuffer = new java.lang.StringBuffer();
                line = input.readLine();
                if (line && line.length() && line.charAt(0) === 0xfeff) {
                  line = line.substring(1);
                }
                while (line !== null) {
                  stringBuffer.append(line);
                  stringBuffer.append(file.lineSeparator);
                  line = input.readLine();
                }
                return String(stringBuffer.toString());
              } finally {
                input.close();
              }
            },
            readFileAsync: function(path, encoding) {
              var d = prim();
              try {
                d.resolve(file.readFile(path, encoding));
              } catch (e) {
                d.reject(e);
              }
              return d.promise;
            },
            saveUtf8File: function(fileName, fileContents) {
              file.saveFile(fileName, fileContents, "utf-8");
            },
            saveFile: function(fileName, fileContents, encoding) {
              var outFile = new java.io.File(fileName),
                  outWriter,
                  parentDir,
                  os;
              parentDir = outFile.getAbsoluteFile().getParentFile();
              if (!parentDir.exists()) {
                if (!parentDir.mkdirs()) {
                  throw "Could not create directory: " + parentDir.getAbsolutePath();
                }
              }
              if (encoding) {
                outWriter = new java.io.OutputStreamWriter(new java.io.FileOutputStream(outFile), encoding);
              } else {
                outWriter = new java.io.OutputStreamWriter(new java.io.FileOutputStream(outFile));
              }
              os = new java.io.BufferedWriter(outWriter);
              try {
                if (typeof importPackage !== 'undefined') {
                  os.write(fileContents);
                } else {
                  os.write(new java.lang.String(fileContents));
                }
              } finally {
                os.close();
              }
            },
            deleteFile: function(fileName) {
              var fileObj = new java.io.File(fileName),
                  files,
                  i;
              if (fileObj.exists()) {
                if (fileObj.isDirectory()) {
                  files = fileObj.listFiles();
                  for (i = 0; i < files.length; i++) {
                    this.deleteFile(files[i]);
                  }
                }
                fileObj["delete"]();
              }
            },
            deleteEmptyDirs: function(startDir, startDirIsJavaObject) {
              var topDir = startDir,
                  dirFileArray,
                  i,
                  fileObj;
              if (!startDirIsJavaObject) {
                topDir = new java.io.File(startDir);
              }
              if (topDir.exists()) {
                dirFileArray = topDir.listFiles();
                for (i = 0; i < dirFileArray.length; i++) {
                  fileObj = dirFileArray[i];
                  if (fileObj.isDirectory()) {
                    file.deleteEmptyDirs(fileObj, true);
                  }
                }
                if (topDir.listFiles().length === 0) {
                  file.deleteFile(String(topDir.getPath()));
                }
              }
            }
          };
          return file;
        });
      }
      if (env === 'xpconnect') {
        define('xpconnect/file', ['prim'], function(prim) {
          var file,
              Cc = Components.classes,
              Ci = Components.interfaces,
              xpfile = xpcUtil.xpfile;
          function mkFullDir(dirObj) {
            if (!dirObj.exists()) {
              dirObj.create(1, 511);
            }
          }
          file = {
            backSlashRegExp: /\\/g,
            exclusionRegExp: /^\./,
            getLineSeparator: function() {
              return file.lineSeparator;
            },
            lineSeparator: ('@mozilla.org/windows-registry-key;1' in Cc) ? '\r\n' : '\n',
            exists: function(fileName) {
              return xpfile(fileName).exists();
            },
            parent: function(fileName) {
              return xpfile(fileName).parent;
            },
            normalize: function(fileName) {
              return file.absPath(fileName);
            },
            isFile: function(path) {
              return xpfile(path).isFile();
            },
            isDirectory: function(path) {
              return xpfile(path).isDirectory();
            },
            absPath: function(fileObj) {
              if (typeof fileObj === "string") {
                fileObj = xpfile(fileObj);
              }
              return fileObj.path;
            },
            getFilteredFileList: function(startDir, regExpFilters, makeUnixPaths, startDirIsObject) {
              var files = [],
                  topDir,
                  regExpInclude,
                  regExpExclude,
                  dirFileArray,
                  fileObj,
                  filePath,
                  ok,
                  dirFiles;
              topDir = startDir;
              if (!startDirIsObject) {
                topDir = xpfile(startDir);
              }
              regExpInclude = regExpFilters.include || regExpFilters;
              regExpExclude = regExpFilters.exclude || null;
              if (topDir.exists()) {
                dirFileArray = topDir.directoryEntries;
                while (dirFileArray.hasMoreElements()) {
                  fileObj = dirFileArray.getNext().QueryInterface(Ci.nsILocalFile);
                  if (fileObj.isFile()) {
                    filePath = fileObj.path;
                    if (makeUnixPaths) {
                      if (filePath.indexOf("/") === -1) {
                        filePath = filePath.replace(/\\/g, "/");
                      }
                    }
                    ok = true;
                    if (regExpInclude) {
                      ok = filePath.match(regExpInclude);
                    }
                    if (ok && regExpExclude) {
                      ok = !filePath.match(regExpExclude);
                    }
                    if (ok && (!file.exclusionRegExp || !file.exclusionRegExp.test(fileObj.leafName))) {
                      files.push(filePath);
                    }
                  } else if (fileObj.isDirectory() && (!file.exclusionRegExp || !file.exclusionRegExp.test(fileObj.leafName))) {
                    dirFiles = this.getFilteredFileList(fileObj, regExpFilters, makeUnixPaths, true);
                    files.push.apply(files, dirFiles);
                  }
                }
              }
              return files;
            },
            copyDir: function(srcDir, destDir, regExpFilter, onlyCopyNew) {
              regExpFilter = regExpFilter || /\w/;
              var fileNames = file.getFilteredFileList(srcDir, regExpFilter, true),
                  copiedFiles = [],
                  i,
                  srcFileName,
                  destFileName;
              for (i = 0; i < fileNames.length; i += 1) {
                srcFileName = fileNames[i];
                destFileName = srcFileName.replace(srcDir, destDir);
                if (file.copyFile(srcFileName, destFileName, onlyCopyNew)) {
                  copiedFiles.push(destFileName);
                }
              }
              return copiedFiles.length ? copiedFiles : null;
            },
            copyFile: function(srcFileName, destFileName, onlyCopyNew) {
              var destFile = xpfile(destFileName),
                  srcFile = xpfile(srcFileName);
              if (onlyCopyNew) {
                if (destFile.exists() && destFile.lastModifiedTime >= srcFile.lastModifiedTime) {
                  return false;
                }
              }
              srcFile.copyTo(destFile.parent, destFile.leafName);
              return true;
            },
            renameFile: function(from, to) {
              var toFile = xpfile(to);
              return xpfile(from).moveTo(toFile.parent, toFile.leafName);
            },
            readFile: xpcUtil.readFile,
            readFileAsync: function(path, encoding) {
              var d = prim();
              try {
                d.resolve(file.readFile(path, encoding));
              } catch (e) {
                d.reject(e);
              }
              return d.promise;
            },
            saveUtf8File: function(fileName, fileContents) {
              file.saveFile(fileName, fileContents, "utf-8");
            },
            saveFile: function(fileName, fileContents, encoding) {
              var outStream,
                  convertStream,
                  fileObj = xpfile(fileName);
              mkFullDir(fileObj.parent);
              try {
                outStream = Cc['@mozilla.org/network/file-output-stream;1'].createInstance(Ci.nsIFileOutputStream);
                outStream.init(fileObj, 0x02 | 0x08 | 0x20, 511, 0);
                convertStream = Cc['@mozilla.org/intl/converter-output-stream;1'].createInstance(Ci.nsIConverterOutputStream);
                convertStream.init(outStream, encoding, 0, 0);
                convertStream.writeString(fileContents);
              } catch (e) {
                throw new Error((fileObj && fileObj.path || '') + ': ' + e);
              } finally {
                if (convertStream) {
                  convertStream.close();
                }
                if (outStream) {
                  outStream.close();
                }
              }
            },
            deleteFile: function(fileName) {
              var fileObj = xpfile(fileName);
              if (fileObj.exists()) {
                fileObj.remove(true);
              }
            },
            deleteEmptyDirs: function(startDir, startDirIsObject) {
              var topDir = startDir,
                  dirFileArray,
                  fileObj;
              if (!startDirIsObject) {
                topDir = xpfile(startDir);
              }
              if (topDir.exists()) {
                dirFileArray = topDir.directoryEntries;
                while (dirFileArray.hasMoreElements()) {
                  fileObj = dirFileArray.getNext().QueryInterface(Ci.nsILocalFile);
                  if (fileObj.isDirectory()) {
                    file.deleteEmptyDirs(fileObj, true);
                  }
                }
                dirFileArray = topDir.directoryEntries;
                if (!dirFileArray.hasMoreElements()) {
                  file.deleteFile(topDir.path);
                }
              }
            }
          };
          return file;
        });
      }
      if (env === 'browser') {
        define('browser/quit', function() {
          'use strict';
          return function(code) {};
        });
      }
      if (env === 'node') {
        define('node/quit', function() {
          'use strict';
          return function(code) {
            var draining = 0;
            var exit = function() {
              if (draining === 0) {
                process.exit(code);
              } else {
                draining -= 1;
              }
            };
            if (process.stdout.bufferSize) {
              draining += 1;
              process.stdout.once('drain', exit);
            }
            if (process.stderr.bufferSize) {
              draining += 1;
              process.stderr.once('drain', exit);
            }
            exit();
          };
        });
      }
      if (env === 'rhino') {
        define('rhino/quit', function() {
          'use strict';
          return function(code) {
            return quit(code);
          };
        });
      }
      if (env === 'xpconnect') {
        define('xpconnect/quit', function() {
          'use strict';
          return function(code) {
            return quit(code);
          };
        });
      }
      if (env === 'browser') {
        define('browser/print', function() {
          function print(msg) {
            console.log(msg);
          }
          return print;
        });
      }
      if (env === 'node') {
        define('node/print', function() {
          function print(msg) {
            console.log(msg);
          }
          return print;
        });
      }
      if (env === 'rhino') {
        define('rhino/print', function() {
          return print;
        });
      }
      if (env === 'xpconnect') {
        define('xpconnect/print', function() {
          return print;
        });
      }
      define('logger', ['env!env/print'], function(print) {
        var logger = {
          TRACE: 0,
          INFO: 1,
          WARN: 2,
          ERROR: 3,
          SILENT: 4,
          level: 0,
          logPrefix: "",
          logLevel: function(level) {
            this.level = level;
          },
          trace: function(message) {
            if (this.level <= this.TRACE) {
              this._print(message);
            }
          },
          info: function(message) {
            if (this.level <= this.INFO) {
              this._print(message);
            }
          },
          warn: function(message) {
            if (this.level <= this.WARN) {
              this._print(message);
            }
          },
          error: function(message) {
            if (this.level <= this.ERROR) {
              this._print(message);
            }
          },
          _print: function(message) {
            this._sysPrint((this.logPrefix ? (this.logPrefix + " ") : "") + message);
          },
          _sysPrint: function(message) {
            print(message);
          }
        };
        return logger;
      });
      (function(root, factory) {
        'use strict';
        if (typeof define === 'function' && define.amd) {
          define('esprima', ['exports'], factory);
        } else if (typeof exports !== 'undefined') {
          factory(exports);
        } else {
          factory((root.esprima = {}));
        }
      }(this, function(exports) {
        'use strict';
        var Token,
            TokenName,
            FnExprTokens,
            Syntax,
            PlaceHolders,
            Messages,
            Regex,
            source,
            strict,
            index,
            lineNumber,
            lineStart,
            hasLineTerminator,
            lastIndex,
            lastLineNumber,
            lastLineStart,
            startIndex,
            startLineNumber,
            startLineStart,
            scanning,
            length,
            lookahead,
            state,
            extra;
        Token = {
          BooleanLiteral: 1,
          EOF: 2,
          Identifier: 3,
          Keyword: 4,
          NullLiteral: 5,
          NumericLiteral: 6,
          Punctuator: 7,
          StringLiteral: 8,
          RegularExpression: 9
        };
        TokenName = {};
        TokenName[Token.BooleanLiteral] = 'Boolean';
        TokenName[Token.EOF] = '<end>';
        TokenName[Token.Identifier] = 'Identifier';
        TokenName[Token.Keyword] = 'Keyword';
        TokenName[Token.NullLiteral] = 'Null';
        TokenName[Token.NumericLiteral] = 'Numeric';
        TokenName[Token.Punctuator] = 'Punctuator';
        TokenName[Token.StringLiteral] = 'String';
        TokenName[Token.RegularExpression] = 'RegularExpression';
        FnExprTokens = ['(', '{', '[', 'in', 'typeof', 'instanceof', 'new', 'return', 'case', 'delete', 'throw', 'void', '=', '+=', '-=', '*=', '/=', '%=', '<<=', '>>=', '>>>=', '&=', '|=', '^=', ',', '+', '-', '*', '/', '%', '++', '--', '<<', '>>', '>>>', '&', '|', '^', '!', '~', '&&', '||', '?', ':', '===', '==', '>=', '<=', '<', '>', '!=', '!=='];
        Syntax = {
          AssignmentExpression: 'AssignmentExpression',
          ArrayExpression: 'ArrayExpression',
          ArrowFunctionExpression: 'ArrowFunctionExpression',
          BlockStatement: 'BlockStatement',
          BinaryExpression: 'BinaryExpression',
          BreakStatement: 'BreakStatement',
          CallExpression: 'CallExpression',
          CatchClause: 'CatchClause',
          ClassBody: 'ClassBody',
          ClassDeclaration: 'ClassDeclaration',
          ClassExpression: 'ClassExpression',
          ConditionalExpression: 'ConditionalExpression',
          ContinueStatement: 'ContinueStatement',
          DoWhileStatement: 'DoWhileStatement',
          DebuggerStatement: 'DebuggerStatement',
          EmptyStatement: 'EmptyStatement',
          ExpressionStatement: 'ExpressionStatement',
          ForStatement: 'ForStatement',
          ForInStatement: 'ForInStatement',
          FunctionDeclaration: 'FunctionDeclaration',
          FunctionExpression: 'FunctionExpression',
          Identifier: 'Identifier',
          IfStatement: 'IfStatement',
          Literal: 'Literal',
          LabeledStatement: 'LabeledStatement',
          LogicalExpression: 'LogicalExpression',
          MemberExpression: 'MemberExpression',
          MethodDefinition: 'MethodDefinition',
          NewExpression: 'NewExpression',
          ObjectExpression: 'ObjectExpression',
          Program: 'Program',
          Property: 'Property',
          RestElement: 'RestElement',
          ReturnStatement: 'ReturnStatement',
          SequenceExpression: 'SequenceExpression',
          SwitchStatement: 'SwitchStatement',
          SwitchCase: 'SwitchCase',
          ThisExpression: 'ThisExpression',
          ThrowStatement: 'ThrowStatement',
          TryStatement: 'TryStatement',
          UnaryExpression: 'UnaryExpression',
          UpdateExpression: 'UpdateExpression',
          VariableDeclaration: 'VariableDeclaration',
          VariableDeclarator: 'VariableDeclarator',
          WhileStatement: 'WhileStatement',
          WithStatement: 'WithStatement'
        };
        PlaceHolders = {ArrowParameterPlaceHolder: 'ArrowParameterPlaceHolder'};
        Messages = {
          UnexpectedToken: 'Unexpected token %0',
          UnexpectedNumber: 'Unexpected number',
          UnexpectedString: 'Unexpected string',
          UnexpectedIdentifier: 'Unexpected identifier',
          UnexpectedReserved: 'Unexpected reserved word',
          UnexpectedEOS: 'Unexpected end of input',
          NewlineAfterThrow: 'Illegal newline after throw',
          InvalidRegExp: 'Invalid regular expression',
          UnterminatedRegExp: 'Invalid regular expression: missing /',
          InvalidLHSInAssignment: 'Invalid left-hand side in assignment',
          InvalidLHSInForIn: 'Invalid left-hand side in for-in',
          MultipleDefaultsInSwitch: 'More than one default clause in switch statement',
          NoCatchOrFinally: 'Missing catch or finally after try',
          UnknownLabel: 'Undefined label \'%0\'',
          Redeclaration: '%0 \'%1\' has already been declared',
          IllegalContinue: 'Illegal continue statement',
          IllegalBreak: 'Illegal break statement',
          IllegalReturn: 'Illegal return statement',
          StrictModeWith: 'Strict mode code may not include a with statement',
          StrictCatchVariable: 'Catch variable may not be eval or arguments in strict mode',
          StrictVarName: 'Variable name may not be eval or arguments in strict mode',
          StrictParamName: 'Parameter name eval or arguments is not allowed in strict mode',
          StrictParamDupe: 'Strict mode function may not have duplicate parameter names',
          StrictFunctionName: 'Function name may not be eval or arguments in strict mode',
          StrictOctalLiteral: 'Octal literals are not allowed in strict mode.',
          StrictDelete: 'Delete of an unqualified identifier in strict mode.',
          StrictLHSAssignment: 'Assignment to eval or arguments is not allowed in strict mode',
          StrictLHSPostfix: 'Postfix increment/decrement may not have eval or arguments operand in strict mode',
          StrictLHSPrefix: 'Prefix increment/decrement may not have eval or arguments operand in strict mode',
          StrictReservedWord: 'Use of future reserved word in strict mode',
          ParameterAfterRestParameter: 'Rest parameter must be last formal parameter',
          DefaultRestParameter: 'Unexpected token =',
          ObjectPatternAsRestParameter: 'Unexpected token {',
          DuplicateProtoProperty: 'Duplicate __proto__ fields are not allowed in object literals',
          ConstructorSpecialMethod: 'Class constructor may not be an accessor',
          DuplicateConstructor: 'A class may only have one constructor',
          StaticPrototype: 'Classes may not have static property named prototype'
        };
        Regex = {
          NonAsciiIdentifierStart: new RegExp('[\xAA\xB5\xBA\xC0-\xD6\xD8-\xF6\xF8-\u02C1\u02C6-\u02D1\u02E0-\u02E4\u02EC\u02EE\u0370-\u0374\u0376\u0377\u037A-\u037D\u037F\u0386\u0388-\u038A\u038C\u038E-\u03A1\u03A3-\u03F5\u03F7-\u0481\u048A-\u052F\u0531-\u0556\u0559\u0561-\u0587\u05D0-\u05EA\u05F0-\u05F2\u0620-\u064A\u066E\u066F\u0671-\u06D3\u06D5\u06E5\u06E6\u06EE\u06EF\u06FA-\u06FC\u06FF\u0710\u0712-\u072F\u074D-\u07A5\u07B1\u07CA-\u07EA\u07F4\u07F5\u07FA\u0800-\u0815\u081A\u0824\u0828\u0840-\u0858\u08A0-\u08B2\u0904-\u0939\u093D\u0950\u0958-\u0961\u0971-\u0980\u0985-\u098C\u098F\u0990\u0993-\u09A8\u09AA-\u09B0\u09B2\u09B6-\u09B9\u09BD\u09CE\u09DC\u09DD\u09DF-\u09E1\u09F0\u09F1\u0A05-\u0A0A\u0A0F\u0A10\u0A13-\u0A28\u0A2A-\u0A30\u0A32\u0A33\u0A35\u0A36\u0A38\u0A39\u0A59-\u0A5C\u0A5E\u0A72-\u0A74\u0A85-\u0A8D\u0A8F-\u0A91\u0A93-\u0AA8\u0AAA-\u0AB0\u0AB2\u0AB3\u0AB5-\u0AB9\u0ABD\u0AD0\u0AE0\u0AE1\u0B05-\u0B0C\u0B0F\u0B10\u0B13-\u0B28\u0B2A-\u0B30\u0B32\u0B33\u0B35-\u0B39\u0B3D\u0B5C\u0B5D\u0B5F-\u0B61\u0B71\u0B83\u0B85-\u0B8A\u0B8E-\u0B90\u0B92-\u0B95\u0B99\u0B9A\u0B9C\u0B9E\u0B9F\u0BA3\u0BA4\u0BA8-\u0BAA\u0BAE-\u0BB9\u0BD0\u0C05-\u0C0C\u0C0E-\u0C10\u0C12-\u0C28\u0C2A-\u0C39\u0C3D\u0C58\u0C59\u0C60\u0C61\u0C85-\u0C8C\u0C8E-\u0C90\u0C92-\u0CA8\u0CAA-\u0CB3\u0CB5-\u0CB9\u0CBD\u0CDE\u0CE0\u0CE1\u0CF1\u0CF2\u0D05-\u0D0C\u0D0E-\u0D10\u0D12-\u0D3A\u0D3D\u0D4E\u0D60\u0D61\u0D7A-\u0D7F\u0D85-\u0D96\u0D9A-\u0DB1\u0DB3-\u0DBB\u0DBD\u0DC0-\u0DC6\u0E01-\u0E30\u0E32\u0E33\u0E40-\u0E46\u0E81\u0E82\u0E84\u0E87\u0E88\u0E8A\u0E8D\u0E94-\u0E97\u0E99-\u0E9F\u0EA1-\u0EA3\u0EA5\u0EA7\u0EAA\u0EAB\u0EAD-\u0EB0\u0EB2\u0EB3\u0EBD\u0EC0-\u0EC4\u0EC6\u0EDC-\u0EDF\u0F00\u0F40-\u0F47\u0F49-\u0F6C\u0F88-\u0F8C\u1000-\u102A\u103F\u1050-\u1055\u105A-\u105D\u1061\u1065\u1066\u106E-\u1070\u1075-\u1081\u108E\u10A0-\u10C5\u10C7\u10CD\u10D0-\u10FA\u10FC-\u1248\u124A-\u124D\u1250-\u1256\u1258\u125A-\u125D\u1260-\u1288\u128A-\u128D\u1290-\u12B0\u12B2-\u12B5\u12B8-\u12BE\u12C0\u12C2-\u12C5\u12C8-\u12D6\u12D8-\u1310\u1312-\u1315\u1318-\u135A\u1380-\u138F\u13A0-\u13F4\u1401-\u166C\u166F-\u167F\u1681-\u169A\u16A0-\u16EA\u16EE-\u16F8\u1700-\u170C\u170E-\u1711\u1720-\u1731\u1740-\u1751\u1760-\u176C\u176E-\u1770\u1780-\u17B3\u17D7\u17DC\u1820-\u1877\u1880-\u18A8\u18AA\u18B0-\u18F5\u1900-\u191E\u1950-\u196D\u1970-\u1974\u1980-\u19AB\u19C1-\u19C7\u1A00-\u1A16\u1A20-\u1A54\u1AA7\u1B05-\u1B33\u1B45-\u1B4B\u1B83-\u1BA0\u1BAE\u1BAF\u1BBA-\u1BE5\u1C00-\u1C23\u1C4D-\u1C4F\u1C5A-\u1C7D\u1CE9-\u1CEC\u1CEE-\u1CF1\u1CF5\u1CF6\u1D00-\u1DBF\u1E00-\u1F15\u1F18-\u1F1D\u1F20-\u1F45\u1F48-\u1F4D\u1F50-\u1F57\u1F59\u1F5B\u1F5D\u1F5F-\u1F7D\u1F80-\u1FB4\u1FB6-\u1FBC\u1FBE\u1FC2-\u1FC4\u1FC6-\u1FCC\u1FD0-\u1FD3\u1FD6-\u1FDB\u1FE0-\u1FEC\u1FF2-\u1FF4\u1FF6-\u1FFC\u2071\u207F\u2090-\u209C\u2102\u2107\u210A-\u2113\u2115\u2119-\u211D\u2124\u2126\u2128\u212A-\u212D\u212F-\u2139\u213C-\u213F\u2145-\u2149\u214E\u2160-\u2188\u2C00-\u2C2E\u2C30-\u2C5E\u2C60-\u2CE4\u2CEB-\u2CEE\u2CF2\u2CF3\u2D00-\u2D25\u2D27\u2D2D\u2D30-\u2D67\u2D6F\u2D80-\u2D96\u2DA0-\u2DA6\u2DA8-\u2DAE\u2DB0-\u2DB6\u2DB8-\u2DBE\u2DC0-\u2DC6\u2DC8-\u2DCE\u2DD0-\u2DD6\u2DD8-\u2DDE\u2E2F\u3005-\u3007\u3021-\u3029\u3031-\u3035\u3038-\u303C\u3041-\u3096\u309D-\u309F\u30A1-\u30FA\u30FC-\u30FF\u3105-\u312D\u3131-\u318E\u31A0-\u31BA\u31F0-\u31FF\u3400-\u4DB5\u4E00-\u9FCC\uA000-\uA48C\uA4D0-\uA4FD\uA500-\uA60C\uA610-\uA61F\uA62A\uA62B\uA640-\uA66E\uA67F-\uA69D\uA6A0-\uA6EF\uA717-\uA71F\uA722-\uA788\uA78B-\uA78E\uA790-\uA7AD\uA7B0\uA7B1\uA7F7-\uA801\uA803-\uA805\uA807-\uA80A\uA80C-\uA822\uA840-\uA873\uA882-\uA8B3\uA8F2-\uA8F7\uA8FB\uA90A-\uA925\uA930-\uA946\uA960-\uA97C\uA984-\uA9B2\uA9CF\uA9E0-\uA9E4\uA9E6-\uA9EF\uA9FA-\uA9FE\uAA00-\uAA28\uAA40-\uAA42\uAA44-\uAA4B\uAA60-\uAA76\uAA7A\uAA7E-\uAAAF\uAAB1\uAAB5\uAAB6\uAAB9-\uAABD\uAAC0\uAAC2\uAADB-\uAADD\uAAE0-\uAAEA\uAAF2-\uAAF4\uAB01-\uAB06\uAB09-\uAB0E\uAB11-\uAB16\uAB20-\uAB26\uAB28-\uAB2E\uAB30-\uAB5A\uAB5C-\uAB5F\uAB64\uAB65\uABC0-\uABE2\uAC00-\uD7A3\uD7B0-\uD7C6\uD7CB-\uD7FB\uF900-\uFA6D\uFA70-\uFAD9\uFB00-\uFB06\uFB13-\uFB17\uFB1D\uFB1F-\uFB28\uFB2A-\uFB36\uFB38-\uFB3C\uFB3E\uFB40\uFB41\uFB43\uFB44\uFB46-\uFBB1\uFBD3-\uFD3D\uFD50-\uFD8F\uFD92-\uFDC7\uFDF0-\uFDFB\uFE70-\uFE74\uFE76-\uFEFC\uFF21-\uFF3A\uFF41-\uFF5A\uFF66-\uFFBE\uFFC2-\uFFC7\uFFCA-\uFFCF\uFFD2-\uFFD7\uFFDA-\uFFDC]'),
          NonAsciiIdentifierPart: new RegExp('[\xAA\xB5\xBA\xC0-\xD6\xD8-\xF6\xF8-\u02C1\u02C6-\u02D1\u02E0-\u02E4\u02EC\u02EE\u0300-\u0374\u0376\u0377\u037A-\u037D\u037F\u0386\u0388-\u038A\u038C\u038E-\u03A1\u03A3-\u03F5\u03F7-\u0481\u0483-\u0487\u048A-\u052F\u0531-\u0556\u0559\u0561-\u0587\u0591-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7\u05D0-\u05EA\u05F0-\u05F2\u0610-\u061A\u0620-\u0669\u066E-\u06D3\u06D5-\u06DC\u06DF-\u06E8\u06EA-\u06FC\u06FF\u0710-\u074A\u074D-\u07B1\u07C0-\u07F5\u07FA\u0800-\u082D\u0840-\u085B\u08A0-\u08B2\u08E4-\u0963\u0966-\u096F\u0971-\u0983\u0985-\u098C\u098F\u0990\u0993-\u09A8\u09AA-\u09B0\u09B2\u09B6-\u09B9\u09BC-\u09C4\u09C7\u09C8\u09CB-\u09CE\u09D7\u09DC\u09DD\u09DF-\u09E3\u09E6-\u09F1\u0A01-\u0A03\u0A05-\u0A0A\u0A0F\u0A10\u0A13-\u0A28\u0A2A-\u0A30\u0A32\u0A33\u0A35\u0A36\u0A38\u0A39\u0A3C\u0A3E-\u0A42\u0A47\u0A48\u0A4B-\u0A4D\u0A51\u0A59-\u0A5C\u0A5E\u0A66-\u0A75\u0A81-\u0A83\u0A85-\u0A8D\u0A8F-\u0A91\u0A93-\u0AA8\u0AAA-\u0AB0\u0AB2\u0AB3\u0AB5-\u0AB9\u0ABC-\u0AC5\u0AC7-\u0AC9\u0ACB-\u0ACD\u0AD0\u0AE0-\u0AE3\u0AE6-\u0AEF\u0B01-\u0B03\u0B05-\u0B0C\u0B0F\u0B10\u0B13-\u0B28\u0B2A-\u0B30\u0B32\u0B33\u0B35-\u0B39\u0B3C-\u0B44\u0B47\u0B48\u0B4B-\u0B4D\u0B56\u0B57\u0B5C\u0B5D\u0B5F-\u0B63\u0B66-\u0B6F\u0B71\u0B82\u0B83\u0B85-\u0B8A\u0B8E-\u0B90\u0B92-\u0B95\u0B99\u0B9A\u0B9C\u0B9E\u0B9F\u0BA3\u0BA4\u0BA8-\u0BAA\u0BAE-\u0BB9\u0BBE-\u0BC2\u0BC6-\u0BC8\u0BCA-\u0BCD\u0BD0\u0BD7\u0BE6-\u0BEF\u0C00-\u0C03\u0C05-\u0C0C\u0C0E-\u0C10\u0C12-\u0C28\u0C2A-\u0C39\u0C3D-\u0C44\u0C46-\u0C48\u0C4A-\u0C4D\u0C55\u0C56\u0C58\u0C59\u0C60-\u0C63\u0C66-\u0C6F\u0C81-\u0C83\u0C85-\u0C8C\u0C8E-\u0C90\u0C92-\u0CA8\u0CAA-\u0CB3\u0CB5-\u0CB9\u0CBC-\u0CC4\u0CC6-\u0CC8\u0CCA-\u0CCD\u0CD5\u0CD6\u0CDE\u0CE0-\u0CE3\u0CE6-\u0CEF\u0CF1\u0CF2\u0D01-\u0D03\u0D05-\u0D0C\u0D0E-\u0D10\u0D12-\u0D3A\u0D3D-\u0D44\u0D46-\u0D48\u0D4A-\u0D4E\u0D57\u0D60-\u0D63\u0D66-\u0D6F\u0D7A-\u0D7F\u0D82\u0D83\u0D85-\u0D96\u0D9A-\u0DB1\u0DB3-\u0DBB\u0DBD\u0DC0-\u0DC6\u0DCA\u0DCF-\u0DD4\u0DD6\u0DD8-\u0DDF\u0DE6-\u0DEF\u0DF2\u0DF3\u0E01-\u0E3A\u0E40-\u0E4E\u0E50-\u0E59\u0E81\u0E82\u0E84\u0E87\u0E88\u0E8A\u0E8D\u0E94-\u0E97\u0E99-\u0E9F\u0EA1-\u0EA3\u0EA5\u0EA7\u0EAA\u0EAB\u0EAD-\u0EB9\u0EBB-\u0EBD\u0EC0-\u0EC4\u0EC6\u0EC8-\u0ECD\u0ED0-\u0ED9\u0EDC-\u0EDF\u0F00\u0F18\u0F19\u0F20-\u0F29\u0F35\u0F37\u0F39\u0F3E-\u0F47\u0F49-\u0F6C\u0F71-\u0F84\u0F86-\u0F97\u0F99-\u0FBC\u0FC6\u1000-\u1049\u1050-\u109D\u10A0-\u10C5\u10C7\u10CD\u10D0-\u10FA\u10FC-\u1248\u124A-\u124D\u1250-\u1256\u1258\u125A-\u125D\u1260-\u1288\u128A-\u128D\u1290-\u12B0\u12B2-\u12B5\u12B8-\u12BE\u12C0\u12C2-\u12C5\u12C8-\u12D6\u12D8-\u1310\u1312-\u1315\u1318-\u135A\u135D-\u135F\u1380-\u138F\u13A0-\u13F4\u1401-\u166C\u166F-\u167F\u1681-\u169A\u16A0-\u16EA\u16EE-\u16F8\u1700-\u170C\u170E-\u1714\u1720-\u1734\u1740-\u1753\u1760-\u176C\u176E-\u1770\u1772\u1773\u1780-\u17D3\u17D7\u17DC\u17DD\u17E0-\u17E9\u180B-\u180D\u1810-\u1819\u1820-\u1877\u1880-\u18AA\u18B0-\u18F5\u1900-\u191E\u1920-\u192B\u1930-\u193B\u1946-\u196D\u1970-\u1974\u1980-\u19AB\u19B0-\u19C9\u19D0-\u19D9\u1A00-\u1A1B\u1A20-\u1A5E\u1A60-\u1A7C\u1A7F-\u1A89\u1A90-\u1A99\u1AA7\u1AB0-\u1ABD\u1B00-\u1B4B\u1B50-\u1B59\u1B6B-\u1B73\u1B80-\u1BF3\u1C00-\u1C37\u1C40-\u1C49\u1C4D-\u1C7D\u1CD0-\u1CD2\u1CD4-\u1CF6\u1CF8\u1CF9\u1D00-\u1DF5\u1DFC-\u1F15\u1F18-\u1F1D\u1F20-\u1F45\u1F48-\u1F4D\u1F50-\u1F57\u1F59\u1F5B\u1F5D\u1F5F-\u1F7D\u1F80-\u1FB4\u1FB6-\u1FBC\u1FBE\u1FC2-\u1FC4\u1FC6-\u1FCC\u1FD0-\u1FD3\u1FD6-\u1FDB\u1FE0-\u1FEC\u1FF2-\u1FF4\u1FF6-\u1FFC\u200C\u200D\u203F\u2040\u2054\u2071\u207F\u2090-\u209C\u20D0-\u20DC\u20E1\u20E5-\u20F0\u2102\u2107\u210A-\u2113\u2115\u2119-\u211D\u2124\u2126\u2128\u212A-\u212D\u212F-\u2139\u213C-\u213F\u2145-\u2149\u214E\u2160-\u2188\u2C00-\u2C2E\u2C30-\u2C5E\u2C60-\u2CE4\u2CEB-\u2CF3\u2D00-\u2D25\u2D27\u2D2D\u2D30-\u2D67\u2D6F\u2D7F-\u2D96\u2DA0-\u2DA6\u2DA8-\u2DAE\u2DB0-\u2DB6\u2DB8-\u2DBE\u2DC0-\u2DC6\u2DC8-\u2DCE\u2DD0-\u2DD6\u2DD8-\u2DDE\u2DE0-\u2DFF\u2E2F\u3005-\u3007\u3021-\u302F\u3031-\u3035\u3038-\u303C\u3041-\u3096\u3099\u309A\u309D-\u309F\u30A1-\u30FA\u30FC-\u30FF\u3105-\u312D\u3131-\u318E\u31A0-\u31BA\u31F0-\u31FF\u3400-\u4DB5\u4E00-\u9FCC\uA000-\uA48C\uA4D0-\uA4FD\uA500-\uA60C\uA610-\uA62B\uA640-\uA66F\uA674-\uA67D\uA67F-\uA69D\uA69F-\uA6F1\uA717-\uA71F\uA722-\uA788\uA78B-\uA78E\uA790-\uA7AD\uA7B0\uA7B1\uA7F7-\uA827\uA840-\uA873\uA880-\uA8C4\uA8D0-\uA8D9\uA8E0-\uA8F7\uA8FB\uA900-\uA92D\uA930-\uA953\uA960-\uA97C\uA980-\uA9C0\uA9CF-\uA9D9\uA9E0-\uA9FE\uAA00-\uAA36\uAA40-\uAA4D\uAA50-\uAA59\uAA60-\uAA76\uAA7A-\uAAC2\uAADB-\uAADD\uAAE0-\uAAEF\uAAF2-\uAAF6\uAB01-\uAB06\uAB09-\uAB0E\uAB11-\uAB16\uAB20-\uAB26\uAB28-\uAB2E\uAB30-\uAB5A\uAB5C-\uAB5F\uAB64\uAB65\uABC0-\uABEA\uABEC\uABED\uABF0-\uABF9\uAC00-\uD7A3\uD7B0-\uD7C6\uD7CB-\uD7FB\uF900-\uFA6D\uFA70-\uFAD9\uFB00-\uFB06\uFB13-\uFB17\uFB1D-\uFB28\uFB2A-\uFB36\uFB38-\uFB3C\uFB3E\uFB40\uFB41\uFB43\uFB44\uFB46-\uFBB1\uFBD3-\uFD3D\uFD50-\uFD8F\uFD92-\uFDC7\uFDF0-\uFDFB\uFE00-\uFE0F\uFE20-\uFE2D\uFE33\uFE34\uFE4D-\uFE4F\uFE70-\uFE74\uFE76-\uFEFC\uFF10-\uFF19\uFF21-\uFF3A\uFF3F\uFF41-\uFF5A\uFF66-\uFFBE\uFFC2-\uFFC7\uFFCA-\uFFCF\uFFD2-\uFFD7\uFFDA-\uFFDC]')
        };
        function assert(condition, message) {
          if (!condition) {
            throw new Error('ASSERT: ' + message);
          }
        }
        function isDecimalDigit(ch) {
          return (ch >= 0x30 && ch <= 0x39);
        }
        function isHexDigit(ch) {
          return '0123456789abcdefABCDEF'.indexOf(ch) >= 0;
        }
        function isOctalDigit(ch) {
          return '01234567'.indexOf(ch) >= 0;
        }
        function isWhiteSpace(ch) {
          return (ch === 0x20) || (ch === 0x09) || (ch === 0x0B) || (ch === 0x0C) || (ch === 0xA0) || (ch >= 0x1680 && [0x1680, 0x180E, 0x2000, 0x2001, 0x2002, 0x2003, 0x2004, 0x2005, 0x2006, 0x2007, 0x2008, 0x2009, 0x200A, 0x202F, 0x205F, 0x3000, 0xFEFF].indexOf(ch) >= 0);
        }
        function isLineTerminator(ch) {
          return (ch === 0x0A) || (ch === 0x0D) || (ch === 0x2028) || (ch === 0x2029);
        }
        function isIdentifierStart(ch) {
          return (ch === 0x24) || (ch === 0x5F) || (ch >= 0x41 && ch <= 0x5A) || (ch >= 0x61 && ch <= 0x7A) || (ch === 0x5C) || ((ch >= 0x80) && Regex.NonAsciiIdentifierStart.test(String.fromCharCode(ch)));
        }
        function isIdentifierPart(ch) {
          return (ch === 0x24) || (ch === 0x5F) || (ch >= 0x41 && ch <= 0x5A) || (ch >= 0x61 && ch <= 0x7A) || (ch >= 0x30 && ch <= 0x39) || (ch === 0x5C) || ((ch >= 0x80) && Regex.NonAsciiIdentifierPart.test(String.fromCharCode(ch)));
        }
        function isFutureReservedWord(id) {
          switch (id) {
            case 'enum':
            case 'export':
            case 'import':
            case 'super':
              return true;
            default:
              return false;
          }
        }
        function isStrictModeReservedWord(id) {
          switch (id) {
            case 'implements':
            case 'interface':
            case 'package':
            case 'private':
            case 'protected':
            case 'public':
            case 'static':
            case 'yield':
            case 'let':
              return true;
            default:
              return false;
          }
        }
        function isRestrictedWord(id) {
          return id === 'eval' || id === 'arguments';
        }
        function isKeyword(id) {
          if (strict && isStrictModeReservedWord(id)) {
            return true;
          }
          switch (id.length) {
            case 2:
              return (id === 'if') || (id === 'in') || (id === 'do');
            case 3:
              return (id === 'var') || (id === 'for') || (id === 'new') || (id === 'try') || (id === 'let');
            case 4:
              return (id === 'this') || (id === 'else') || (id === 'case') || (id === 'void') || (id === 'with') || (id === 'enum');
            case 5:
              return (id === 'while') || (id === 'break') || (id === 'catch') || (id === 'throw') || (id === 'const') || (id === 'yield') || (id === 'class') || (id === 'super');
            case 6:
              return (id === 'return') || (id === 'typeof') || (id === 'delete') || (id === 'switch') || (id === 'export') || (id === 'import');
            case 7:
              return (id === 'default') || (id === 'finally') || (id === 'extends');
            case 8:
              return (id === 'function') || (id === 'continue') || (id === 'debugger');
            case 10:
              return (id === 'instanceof');
            default:
              return false;
          }
        }
        function addComment(type, value, start, end, loc) {
          var comment;
          assert(typeof start === 'number', 'Comment must have valid position');
          state.lastCommentStart = start;
          comment = {
            type: type,
            value: value
          };
          if (extra.range) {
            comment.range = [start, end];
          }
          if (extra.loc) {
            comment.loc = loc;
          }
          extra.comments.push(comment);
          if (extra.attachComment) {
            extra.leadingComments.push(comment);
            extra.trailingComments.push(comment);
          }
        }
        function skipSingleLineComment(offset) {
          var start,
              loc,
              ch,
              comment;
          start = index - offset;
          loc = {start: {
              line: lineNumber,
              column: index - lineStart - offset
            }};
          while (index < length) {
            ch = source.charCodeAt(index);
            ++index;
            if (isLineTerminator(ch)) {
              hasLineTerminator = true;
              if (extra.comments) {
                comment = source.slice(start + offset, index - 1);
                loc.end = {
                  line: lineNumber,
                  column: index - lineStart - 1
                };
                addComment('Line', comment, start, index - 1, loc);
              }
              if (ch === 13 && source.charCodeAt(index) === 10) {
                ++index;
              }
              ++lineNumber;
              lineStart = index;
              return ;
            }
          }
          if (extra.comments) {
            comment = source.slice(start + offset, index);
            loc.end = {
              line: lineNumber,
              column: index - lineStart
            };
            addComment('Line', comment, start, index, loc);
          }
        }
        function skipMultiLineComment() {
          var start,
              loc,
              ch,
              comment;
          if (extra.comments) {
            start = index - 2;
            loc = {start: {
                line: lineNumber,
                column: index - lineStart - 2
              }};
          }
          while (index < length) {
            ch = source.charCodeAt(index);
            if (isLineTerminator(ch)) {
              if (ch === 0x0D && source.charCodeAt(index + 1) === 0x0A) {
                ++index;
              }
              hasLineTerminator = true;
              ++lineNumber;
              ++index;
              lineStart = index;
            } else if (ch === 0x2A) {
              if (source.charCodeAt(index + 1) === 0x2F) {
                ++index;
                ++index;
                if (extra.comments) {
                  comment = source.slice(start + 2, index - 2);
                  loc.end = {
                    line: lineNumber,
                    column: index - lineStart
                  };
                  addComment('Block', comment, start, index, loc);
                }
                return ;
              }
              ++index;
            } else {
              ++index;
            }
          }
          if (extra.errors && index >= length) {
            if (extra.comments) {
              loc.end = {
                line: lineNumber,
                column: index - lineStart
              };
              comment = source.slice(start + 2, index);
              addComment('Block', comment, start, index, loc);
            }
            tolerateUnexpectedToken();
          } else {
            throwUnexpectedToken();
          }
        }
        function skipComment() {
          var ch,
              start;
          hasLineTerminator = false;
          start = (index === 0);
          while (index < length) {
            ch = source.charCodeAt(index);
            if (isWhiteSpace(ch)) {
              ++index;
            } else if (isLineTerminator(ch)) {
              hasLineTerminator = true;
              ++index;
              if (ch === 0x0D && source.charCodeAt(index) === 0x0A) {
                ++index;
              }
              ++lineNumber;
              lineStart = index;
              start = true;
            } else if (ch === 0x2F) {
              ch = source.charCodeAt(index + 1);
              if (ch === 0x2F) {
                ++index;
                ++index;
                skipSingleLineComment(2);
                start = true;
              } else if (ch === 0x2A) {
                ++index;
                ++index;
                skipMultiLineComment();
              } else {
                break;
              }
            } else if (start && ch === 0x2D) {
              if ((source.charCodeAt(index + 1) === 0x2D) && (source.charCodeAt(index + 2) === 0x3E)) {
                index += 3;
                skipSingleLineComment(3);
              } else {
                break;
              }
            } else if (ch === 0x3C) {
              if (source.slice(index + 1, index + 4) === '!--') {
                ++index;
                ++index;
                ++index;
                ++index;
                skipSingleLineComment(4);
              } else {
                break;
              }
            } else {
              break;
            }
          }
        }
        function scanHexEscape(prefix) {
          var i,
              len,
              ch,
              code = 0;
          len = (prefix === 'u') ? 4 : 2;
          for (i = 0; i < len; ++i) {
            if (index < length && isHexDigit(source[index])) {
              ch = source[index++];
              code = code * 16 + '0123456789abcdef'.indexOf(ch.toLowerCase());
            } else {
              return '';
            }
          }
          return String.fromCharCode(code);
        }
        function scanUnicodeCodePointEscape() {
          var ch,
              code,
              cu1,
              cu2;
          ch = source[index];
          code = 0;
          if (ch === '}') {
            throwUnexpectedToken();
          }
          while (index < length) {
            ch = source[index++];
            if (!isHexDigit(ch)) {
              break;
            }
            code = code * 16 + '0123456789abcdef'.indexOf(ch.toLowerCase());
          }
          if (code > 0x10FFFF || ch !== '}') {
            throwUnexpectedToken();
          }
          if (code <= 0xFFFF) {
            return String.fromCharCode(code);
          }
          cu1 = ((code - 0x10000) >> 10) + 0xD800;
          cu2 = ((code - 0x10000) & 1023) + 0xDC00;
          return String.fromCharCode(cu1, cu2);
        }
        function getEscapedIdentifier() {
          var ch,
              id;
          ch = source.charCodeAt(index++);
          id = String.fromCharCode(ch);
          if (ch === 0x5C) {
            if (source.charCodeAt(index) !== 0x75) {
              throwUnexpectedToken();
            }
            ++index;
            ch = scanHexEscape('u');
            if (!ch || ch === '\\' || !isIdentifierStart(ch.charCodeAt(0))) {
              throwUnexpectedToken();
            }
            id = ch;
          }
          while (index < length) {
            ch = source.charCodeAt(index);
            if (!isIdentifierPart(ch)) {
              break;
            }
            ++index;
            id += String.fromCharCode(ch);
            if (ch === 0x5C) {
              id = id.substr(0, id.length - 1);
              if (source.charCodeAt(index) !== 0x75) {
                throwUnexpectedToken();
              }
              ++index;
              ch = scanHexEscape('u');
              if (!ch || ch === '\\' || !isIdentifierPart(ch.charCodeAt(0))) {
                throwUnexpectedToken();
              }
              id += ch;
            }
          }
          return id;
        }
        function getIdentifier() {
          var start,
              ch;
          start = index++;
          while (index < length) {
            ch = source.charCodeAt(index);
            if (ch === 0x5C) {
              index = start;
              return getEscapedIdentifier();
            }
            if (isIdentifierPart(ch)) {
              ++index;
            } else {
              break;
            }
          }
          return source.slice(start, index);
        }
        function scanIdentifier() {
          var start,
              id,
              type;
          start = index;
          id = (source.charCodeAt(index) === 0x5C) ? getEscapedIdentifier() : getIdentifier();
          if (id.length === 1) {
            type = Token.Identifier;
          } else if (isKeyword(id)) {
            type = Token.Keyword;
          } else if (id === 'null') {
            type = Token.NullLiteral;
          } else if (id === 'true' || id === 'false') {
            type = Token.BooleanLiteral;
          } else {
            type = Token.Identifier;
          }
          return {
            type: type,
            value: id,
            lineNumber: lineNumber,
            lineStart: lineStart,
            start: start,
            end: index
          };
        }
        function scanPunctuator() {
          var token,
              str;
          token = {
            type: Token.Punctuator,
            value: '',
            lineNumber: lineNumber,
            lineStart: lineStart,
            start: index,
            end: index
          };
          str = source[index];
          switch (str) {
            case '(':
              if (extra.tokenize) {
                extra.openParenToken = extra.tokens.length;
              }
              ++index;
              break;
            case '{':
              if (extra.tokenize) {
                extra.openCurlyToken = extra.tokens.length;
              }
              ++index;
              break;
            case '.':
              ++index;
              if (source[index] === '.' && source[index + 1] === '.') {
                index += 2;
                str = '...';
              }
              break;
            case ')':
            case ';':
            case ',':
            case '}':
            case '[':
            case ']':
            case ':':
            case '?':
            case '~':
              ++index;
              break;
            default:
              str = source.substr(index, 4);
              if (str === '>>>=') {
                index += 4;
              } else {
                str = str.substr(0, 3);
                if (str === '===' || str === '!==' || str === '>>>' || str === '<<=' || str === '>>=') {
                  index += 3;
                } else {
                  str = str.substr(0, 2);
                  if (str === '&&' || str === '||' || str === '==' || str === '!=' || str === '+=' || str === '-=' || str === '*=' || str === '/=' || str === '++' || str === '--' || str === '<<' || str === '>>' || str === '&=' || str === '|=' || str === '^=' || str === '%=' || str === '<=' || str === '>=' || str === '=>') {
                    index += 2;
                  } else {
                    str = source[index];
                    if ('<>=!+-*%&|^/'.indexOf(str) >= 0) {
                      ++index;
                    }
                  }
                }
              }
          }
          if (index === token.start) {
            throwUnexpectedToken();
          }
          token.end = index;
          token.value = str;
          return token;
        }
        function scanHexLiteral(start) {
          var number = '';
          while (index < length) {
            if (!isHexDigit(source[index])) {
              break;
            }
            number += source[index++];
          }
          if (number.length === 0) {
            throwUnexpectedToken();
          }
          if (isIdentifierStart(source.charCodeAt(index))) {
            throwUnexpectedToken();
          }
          return {
            type: Token.NumericLiteral,
            value: parseInt('0x' + number, 16),
            lineNumber: lineNumber,
            lineStart: lineStart,
            start: start,
            end: index
          };
        }
        function scanBinaryLiteral(start) {
          var ch,
              number;
          number = '';
          while (index < length) {
            ch = source[index];
            if (ch !== '0' && ch !== '1') {
              break;
            }
            number += source[index++];
          }
          if (number.length === 0) {
            throwUnexpectedToken();
          }
          if (index < length) {
            ch = source.charCodeAt(index);
            if (isIdentifierStart(ch) || isDecimalDigit(ch)) {
              throwUnexpectedToken();
            }
          }
          return {
            type: Token.NumericLiteral,
            value: parseInt(number, 2),
            lineNumber: lineNumber,
            lineStart: lineStart,
            start: start,
            end: index
          };
        }
        function scanOctalLiteral(prefix, start) {
          var number,
              octal;
          if (isOctalDigit(prefix)) {
            octal = true;
            number = '0' + source[index++];
          } else {
            octal = false;
            ++index;
            number = '';
          }
          while (index < length) {
            if (!isOctalDigit(source[index])) {
              break;
            }
            number += source[index++];
          }
          if (!octal && number.length === 0) {
            throwUnexpectedToken();
          }
          if (isIdentifierStart(source.charCodeAt(index)) || isDecimalDigit(source.charCodeAt(index))) {
            throwUnexpectedToken();
          }
          return {
            type: Token.NumericLiteral,
            value: parseInt(number, 8),
            octal: octal,
            lineNumber: lineNumber,
            lineStart: lineStart,
            start: start,
            end: index
          };
        }
        function isImplicitOctalLiteral() {
          var i,
              ch;
          for (i = index + 1; i < length; ++i) {
            ch = source[i];
            if (ch === '8' || ch === '9') {
              return false;
            }
            if (!isOctalDigit(ch)) {
              return true;
            }
          }
          return true;
        }
        function scanNumericLiteral() {
          var number,
              start,
              ch;
          ch = source[index];
          assert(isDecimalDigit(ch.charCodeAt(0)) || (ch === '.'), 'Numeric literal must start with a decimal digit or a decimal point');
          start = index;
          number = '';
          if (ch !== '.') {
            number = source[index++];
            ch = source[index];
            if (number === '0') {
              if (ch === 'x' || ch === 'X') {
                ++index;
                return scanHexLiteral(start);
              }
              if (ch === 'b' || ch === 'B') {
                ++index;
                return scanBinaryLiteral(start);
              }
              if (ch === 'o' || ch === 'O') {
                return scanOctalLiteral(ch, start);
              }
              if (isOctalDigit(ch)) {
                if (isImplicitOctalLiteral()) {
                  return scanOctalLiteral(ch, start);
                }
              }
            }
            while (isDecimalDigit(source.charCodeAt(index))) {
              number += source[index++];
            }
            ch = source[index];
          }
          if (ch === '.') {
            number += source[index++];
            while (isDecimalDigit(source.charCodeAt(index))) {
              number += source[index++];
            }
            ch = source[index];
          }
          if (ch === 'e' || ch === 'E') {
            number += source[index++];
            ch = source[index];
            if (ch === '+' || ch === '-') {
              number += source[index++];
            }
            if (isDecimalDigit(source.charCodeAt(index))) {
              while (isDecimalDigit(source.charCodeAt(index))) {
                number += source[index++];
              }
            } else {
              throwUnexpectedToken();
            }
          }
          if (isIdentifierStart(source.charCodeAt(index))) {
            throwUnexpectedToken();
          }
          return {
            type: Token.NumericLiteral,
            value: parseFloat(number),
            lineNumber: lineNumber,
            lineStart: lineStart,
            start: start,
            end: index
          };
        }
        function scanStringLiteral() {
          var str = '',
              quote,
              start,
              ch,
              code,
              unescaped,
              restore,
              octal = false;
          quote = source[index];
          assert((quote === '\'' || quote === '"'), 'String literal must starts with a quote');
          start = index;
          ++index;
          while (index < length) {
            ch = source[index++];
            if (ch === quote) {
              quote = '';
              break;
            } else if (ch === '\\') {
              ch = source[index++];
              if (!ch || !isLineTerminator(ch.charCodeAt(0))) {
                switch (ch) {
                  case 'u':
                  case 'x':
                    if (source[index] === '{') {
                      ++index;
                      str += scanUnicodeCodePointEscape();
                    } else {
                      restore = index;
                      unescaped = scanHexEscape(ch);
                      if (unescaped) {
                        str += unescaped;
                      } else {
                        index = restore;
                        str += ch;
                      }
                    }
                    break;
                  case 'n':
                    str += '\n';
                    break;
                  case 'r':
                    str += '\r';
                    break;
                  case 't':
                    str += '\t';
                    break;
                  case 'b':
                    str += '\b';
                    break;
                  case 'f':
                    str += '\f';
                    break;
                  case 'v':
                    str += '\x0B';
                    break;
                  default:
                    if (isOctalDigit(ch)) {
                      code = '01234567'.indexOf(ch);
                      if (code !== 0) {
                        octal = true;
                      }
                      if (index < length && isOctalDigit(source[index])) {
                        octal = true;
                        code = code * 8 + '01234567'.indexOf(source[index++]);
                        if ('0123'.indexOf(ch) >= 0 && index < length && isOctalDigit(source[index])) {
                          code = code * 8 + '01234567'.indexOf(source[index++]);
                        }
                      }
                      str += String.fromCharCode(code);
                    } else {
                      str += ch;
                    }
                    break;
                }
              } else {
                ++lineNumber;
                if (ch === '\r' && source[index] === '\n') {
                  ++index;
                }
                lineStart = index;
              }
            } else if (isLineTerminator(ch.charCodeAt(0))) {
              break;
            } else {
              str += ch;
            }
          }
          if (quote !== '') {
            throwUnexpectedToken();
          }
          return {
            type: Token.StringLiteral,
            value: str,
            octal: octal,
            lineNumber: startLineNumber,
            lineStart: startLineStart,
            start: start,
            end: index
          };
        }
        function testRegExp(pattern, flags) {
          var tmp = pattern;
          if (flags.indexOf('u') >= 0) {
            tmp = tmp.replace(/\\u\{([0-9a-fA-F]+)\}/g, function($0, $1) {
              if (parseInt($1, 16) <= 0x10FFFF) {
                return 'x';
              }
              throwUnexpectedToken(null, Messages.InvalidRegExp);
            }).replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, 'x');
          }
          try {
            RegExp(tmp);
          } catch (e) {
            throwUnexpectedToken(null, Messages.InvalidRegExp);
          }
          try {
            return new RegExp(pattern, flags);
          } catch (exception) {
            return null;
          }
        }
        function scanRegExpBody() {
          var ch,
              str,
              classMarker,
              terminated,
              body;
          ch = source[index];
          assert(ch === '/', 'Regular expression literal must start with a slash');
          str = source[index++];
          classMarker = false;
          terminated = false;
          while (index < length) {
            ch = source[index++];
            str += ch;
            if (ch === '\\') {
              ch = source[index++];
              if (isLineTerminator(ch.charCodeAt(0))) {
                throwUnexpectedToken(null, Messages.UnterminatedRegExp);
              }
              str += ch;
            } else if (isLineTerminator(ch.charCodeAt(0))) {
              throwUnexpectedToken(null, Messages.UnterminatedRegExp);
            } else if (classMarker) {
              if (ch === ']') {
                classMarker = false;
              }
            } else {
              if (ch === '/') {
                terminated = true;
                break;
              } else if (ch === '[') {
                classMarker = true;
              }
            }
          }
          if (!terminated) {
            throwUnexpectedToken(null, Messages.UnterminatedRegExp);
          }
          body = str.substr(1, str.length - 2);
          return {
            value: body,
            literal: str
          };
        }
        function scanRegExpFlags() {
          var ch,
              str,
              flags,
              restore;
          str = '';
          flags = '';
          while (index < length) {
            ch = source[index];
            if (!isIdentifierPart(ch.charCodeAt(0))) {
              break;
            }
            ++index;
            if (ch === '\\' && index < length) {
              ch = source[index];
              if (ch === 'u') {
                ++index;
                restore = index;
                ch = scanHexEscape('u');
                if (ch) {
                  flags += ch;
                  for (str += '\\u'; restore < index; ++restore) {
                    str += source[restore];
                  }
                } else {
                  index = restore;
                  flags += 'u';
                  str += '\\u';
                }
                tolerateUnexpectedToken();
              } else {
                str += '\\';
                tolerateUnexpectedToken();
              }
            } else {
              flags += ch;
              str += ch;
            }
          }
          return {
            value: flags,
            literal: str
          };
        }
        function scanRegExp() {
          scanning = true;
          var start,
              body,
              flags,
              value;
          lookahead = null;
          skipComment();
          start = index;
          body = scanRegExpBody();
          flags = scanRegExpFlags();
          value = testRegExp(body.value, flags.value);
          scanning = false;
          if (extra.tokenize) {
            return {
              type: Token.RegularExpression,
              value: value,
              regex: {
                pattern: body.value,
                flags: flags.value
              },
              lineNumber: lineNumber,
              lineStart: lineStart,
              start: start,
              end: index
            };
          }
          return {
            literal: body.literal + flags.literal,
            value: value,
            regex: {
              pattern: body.value,
              flags: flags.value
            },
            start: start,
            end: index
          };
        }
        function collectRegex() {
          var pos,
              loc,
              regex,
              token;
          skipComment();
          pos = index;
          loc = {start: {
              line: lineNumber,
              column: index - lineStart
            }};
          regex = scanRegExp();
          loc.end = {
            line: lineNumber,
            column: index - lineStart
          };
          if (!extra.tokenize) {
            if (extra.tokens.length > 0) {
              token = extra.tokens[extra.tokens.length - 1];
              if (token.range[0] === pos && token.type === 'Punctuator') {
                if (token.value === '/' || token.value === '/=') {
                  extra.tokens.pop();
                }
              }
            }
            extra.tokens.push({
              type: 'RegularExpression',
              value: regex.literal,
              regex: regex.regex,
              range: [pos, index],
              loc: loc
            });
          }
          return regex;
        }
        function isIdentifierName(token) {
          return token.type === Token.Identifier || token.type === Token.Keyword || token.type === Token.BooleanLiteral || token.type === Token.NullLiteral;
        }
        function advanceSlash() {
          var prevToken,
              checkToken;
          prevToken = extra.tokens[extra.tokens.length - 1];
          if (!prevToken) {
            return collectRegex();
          }
          if (prevToken.type === 'Punctuator') {
            if (prevToken.value === ']') {
              return scanPunctuator();
            }
            if (prevToken.value === ')') {
              checkToken = extra.tokens[extra.openParenToken - 1];
              if (checkToken && checkToken.type === 'Keyword' && (checkToken.value === 'if' || checkToken.value === 'while' || checkToken.value === 'for' || checkToken.value === 'with')) {
                return collectRegex();
              }
              return scanPunctuator();
            }
            if (prevToken.value === '}') {
              if (extra.tokens[extra.openCurlyToken - 3] && extra.tokens[extra.openCurlyToken - 3].type === 'Keyword') {
                checkToken = extra.tokens[extra.openCurlyToken - 4];
                if (!checkToken) {
                  return scanPunctuator();
                }
              } else if (extra.tokens[extra.openCurlyToken - 4] && extra.tokens[extra.openCurlyToken - 4].type === 'Keyword') {
                checkToken = extra.tokens[extra.openCurlyToken - 5];
                if (!checkToken) {
                  return collectRegex();
                }
              } else {
                return scanPunctuator();
              }
              if (FnExprTokens.indexOf(checkToken.value) >= 0) {
                return scanPunctuator();
              }
              return collectRegex();
            }
            return collectRegex();
          }
          if (prevToken.type === 'Keyword' && prevToken.value !== 'this') {
            return collectRegex();
          }
          return scanPunctuator();
        }
        function advance() {
          var ch;
          if (index >= length) {
            return {
              type: Token.EOF,
              lineNumber: lineNumber,
              lineStart: lineStart,
              start: index,
              end: index
            };
          }
          ch = source.charCodeAt(index);
          if (isIdentifierStart(ch)) {
            return scanIdentifier();
          }
          if (ch === 0x28 || ch === 0x29 || ch === 0x3B) {
            return scanPunctuator();
          }
          if (ch === 0x27 || ch === 0x22) {
            return scanStringLiteral();
          }
          if (ch === 0x2E) {
            if (isDecimalDigit(source.charCodeAt(index + 1))) {
              return scanNumericLiteral();
            }
            return scanPunctuator();
          }
          if (isDecimalDigit(ch)) {
            return scanNumericLiteral();
          }
          if (extra.tokenize && ch === 0x2F) {
            return advanceSlash();
          }
          return scanPunctuator();
        }
        function collectToken() {
          var loc,
              token,
              value,
              entry;
          loc = {start: {
              line: lineNumber,
              column: index - lineStart
            }};
          token = advance();
          loc.end = {
            line: lineNumber,
            column: index - lineStart
          };
          if (token.type !== Token.EOF) {
            value = source.slice(token.start, token.end);
            entry = {
              type: TokenName[token.type],
              value: value,
              range: [token.start, token.end],
              loc: loc
            };
            if (token.regex) {
              entry.regex = {
                pattern: token.regex.pattern,
                flags: token.regex.flags
              };
            }
            extra.tokens.push(entry);
          }
          return token;
        }
        function lex() {
          var token;
          scanning = true;
          lastIndex = index;
          lastLineNumber = lineNumber;
          lastLineStart = lineStart;
          skipComment();
          token = lookahead;
          startIndex = index;
          startLineNumber = lineNumber;
          startLineStart = lineStart;
          lookahead = (typeof extra.tokens !== 'undefined') ? collectToken() : advance();
          scanning = false;
          return token;
        }
        function peek() {
          scanning = true;
          skipComment();
          lastIndex = index;
          lastLineNumber = lineNumber;
          lastLineStart = lineStart;
          startIndex = index;
          startLineNumber = lineNumber;
          startLineStart = lineStart;
          lookahead = (typeof extra.tokens !== 'undefined') ? collectToken() : advance();
          scanning = false;
        }
        function Position() {
          this.line = startLineNumber;
          this.column = startIndex - startLineStart;
        }
        function SourceLocation() {
          this.start = new Position();
          this.end = null;
        }
        function WrappingSourceLocation(startToken) {
          this.start = {
            line: startToken.lineNumber,
            column: startToken.start - startToken.lineStart
          };
          this.end = null;
        }
        function Node() {
          if (extra.range) {
            this.range = [startIndex, 0];
          }
          if (extra.loc) {
            this.loc = new SourceLocation();
          }
        }
        function WrappingNode(startToken) {
          if (extra.range) {
            this.range = [startToken.start, 0];
          }
          if (extra.loc) {
            this.loc = new WrappingSourceLocation(startToken);
          }
        }
        WrappingNode.prototype = Node.prototype = {
          processComment: function() {
            var lastChild,
                leadingComments,
                trailingComments,
                bottomRight = extra.bottomRightStack,
                i,
                comment,
                last = bottomRight[bottomRight.length - 1];
            if (this.type === Syntax.Program) {
              if (this.body.length > 0) {
                return ;
              }
            }
            if (extra.trailingComments.length > 0) {
              trailingComments = [];
              for (i = extra.trailingComments.length - 1; i >= 0; --i) {
                comment = extra.trailingComments[i];
                if (comment.range[0] >= this.range[1]) {
                  trailingComments.unshift(comment);
                  extra.trailingComments.splice(i, 1);
                }
              }
              extra.trailingComments = [];
            } else {
              if (last && last.trailingComments && last.trailingComments[0].range[0] >= this.range[1]) {
                trailingComments = last.trailingComments;
                delete last.trailingComments;
              }
            }
            if (last) {
              while (last && last.range[0] >= this.range[0]) {
                lastChild = last;
                last = bottomRight.pop();
              }
            }
            if (lastChild) {
              if (lastChild.leadingComments && lastChild.leadingComments[lastChild.leadingComments.length - 1].range[1] <= this.range[0]) {
                this.leadingComments = lastChild.leadingComments;
                lastChild.leadingComments = undefined;
              }
            } else if (extra.leadingComments.length > 0) {
              leadingComments = [];
              for (i = extra.leadingComments.length - 1; i >= 0; --i) {
                comment = extra.leadingComments[i];
                if (comment.range[1] <= this.range[0]) {
                  leadingComments.unshift(comment);
                  extra.leadingComments.splice(i, 1);
                }
              }
            }
            if (leadingComments && leadingComments.length > 0) {
              this.leadingComments = leadingComments;
            }
            if (trailingComments && trailingComments.length > 0) {
              this.trailingComments = trailingComments;
            }
            bottomRight.push(this);
          },
          finish: function() {
            if (extra.range) {
              this.range[1] = lastIndex;
            }
            if (extra.loc) {
              this.loc.end = {
                line: lastLineNumber,
                column: lastIndex - lastLineStart
              };
              if (extra.source) {
                this.loc.source = extra.source;
              }
            }
            if (extra.attachComment) {
              this.processComment();
            }
          },
          finishArrayExpression: function(elements) {
            this.type = Syntax.ArrayExpression;
            this.elements = elements;
            this.finish();
            return this;
          },
          finishArrowFunctionExpression: function(params, defaults, body, expression) {
            this.type = Syntax.ArrowFunctionExpression;
            this.id = null;
            this.params = params;
            this.defaults = defaults;
            this.body = body;
            this.generator = false;
            this.expression = expression;
            this.finish();
            return this;
          },
          finishAssignmentExpression: function(operator, left, right) {
            this.type = Syntax.AssignmentExpression;
            this.operator = operator;
            this.left = left;
            this.right = right;
            this.finish();
            return this;
          },
          finishBinaryExpression: function(operator, left, right) {
            this.type = (operator === '||' || operator === '&&') ? Syntax.LogicalExpression : Syntax.BinaryExpression;
            this.operator = operator;
            this.left = left;
            this.right = right;
            this.finish();
            return this;
          },
          finishBlockStatement: function(body) {
            this.type = Syntax.BlockStatement;
            this.body = body;
            this.finish();
            return this;
          },
          finishBreakStatement: function(label) {
            this.type = Syntax.BreakStatement;
            this.label = label;
            this.finish();
            return this;
          },
          finishCallExpression: function(callee, args) {
            this.type = Syntax.CallExpression;
            this.callee = callee;
            this.arguments = args;
            this.finish();
            return this;
          },
          finishCatchClause: function(param, body) {
            this.type = Syntax.CatchClause;
            this.param = param;
            this.body = body;
            this.finish();
            return this;
          },
          finishClassBody: function(body) {
            this.type = Syntax.ClassBody;
            this.body = body;
            this.finish();
            return this;
          },
          finishClassDeclaration: function(id, superClass, body) {
            this.type = Syntax.ClassDeclaration;
            this.id = id;
            this.superClass = superClass;
            this.body = body;
            this.finish();
            return this;
          },
          finishClassExpression: function(id, superClass, body) {
            this.type = Syntax.ClassExpression;
            this.id = id;
            this.superClass = superClass;
            this.body = body;
            this.finish();
            return this;
          },
          finishConditionalExpression: function(test, consequent, alternate) {
            this.type = Syntax.ConditionalExpression;
            this.test = test;
            this.consequent = consequent;
            this.alternate = alternate;
            this.finish();
            return this;
          },
          finishContinueStatement: function(label) {
            this.type = Syntax.ContinueStatement;
            this.label = label;
            this.finish();
            return this;
          },
          finishDebuggerStatement: function() {
            this.type = Syntax.DebuggerStatement;
            this.finish();
            return this;
          },
          finishDoWhileStatement: function(body, test) {
            this.type = Syntax.DoWhileStatement;
            this.body = body;
            this.test = test;
            this.finish();
            return this;
          },
          finishEmptyStatement: function() {
            this.type = Syntax.EmptyStatement;
            this.finish();
            return this;
          },
          finishExpressionStatement: function(expression) {
            this.type = Syntax.ExpressionStatement;
            this.expression = expression;
            this.finish();
            return this;
          },
          finishForStatement: function(init, test, update, body) {
            this.type = Syntax.ForStatement;
            this.init = init;
            this.test = test;
            this.update = update;
            this.body = body;
            this.finish();
            return this;
          },
          finishForInStatement: function(left, right, body) {
            this.type = Syntax.ForInStatement;
            this.left = left;
            this.right = right;
            this.body = body;
            this.each = false;
            this.finish();
            return this;
          },
          finishFunctionDeclaration: function(id, params, defaults, body) {
            this.type = Syntax.FunctionDeclaration;
            this.id = id;
            this.params = params;
            this.defaults = defaults;
            this.body = body;
            this.generator = false;
            this.expression = false;
            this.finish();
            return this;
          },
          finishFunctionExpression: function(id, params, defaults, body) {
            this.type = Syntax.FunctionExpression;
            this.id = id;
            this.params = params;
            this.defaults = defaults;
            this.body = body;
            this.generator = false;
            this.expression = false;
            this.finish();
            return this;
          },
          finishIdentifier: function(name) {
            this.type = Syntax.Identifier;
            this.name = name;
            this.finish();
            return this;
          },
          finishIfStatement: function(test, consequent, alternate) {
            this.type = Syntax.IfStatement;
            this.test = test;
            this.consequent = consequent;
            this.alternate = alternate;
            this.finish();
            return this;
          },
          finishLabeledStatement: function(label, body) {
            this.type = Syntax.LabeledStatement;
            this.label = label;
            this.body = body;
            this.finish();
            return this;
          },
          finishLiteral: function(token) {
            this.type = Syntax.Literal;
            this.value = token.value;
            this.raw = source.slice(token.start, token.end);
            if (token.regex) {
              this.regex = token.regex;
            }
            this.finish();
            return this;
          },
          finishMemberExpression: function(accessor, object, property) {
            this.type = Syntax.MemberExpression;
            this.computed = accessor === '[';
            this.object = object;
            this.property = property;
            this.finish();
            return this;
          },
          finishNewExpression: function(callee, args) {
            this.type = Syntax.NewExpression;
            this.callee = callee;
            this.arguments = args;
            this.finish();
            return this;
          },
          finishObjectExpression: function(properties) {
            this.type = Syntax.ObjectExpression;
            this.properties = properties;
            this.finish();
            return this;
          },
          finishPostfixExpression: function(operator, argument) {
            this.type = Syntax.UpdateExpression;
            this.operator = operator;
            this.argument = argument;
            this.prefix = false;
            this.finish();
            return this;
          },
          finishProgram: function(body) {
            this.type = Syntax.Program;
            this.body = body;
            this.finish();
            return this;
          },
          finishProperty: function(kind, key, computed, value, method, shorthand) {
            this.type = Syntax.Property;
            this.key = key;
            this.computed = computed;
            this.value = value;
            this.kind = kind;
            this.method = method;
            this.shorthand = shorthand;
            this.finish();
            return this;
          },
          finishRestElement: function(argument) {
            this.type = Syntax.RestElement;
            this.argument = argument;
            this.finish();
            return this;
          },
          finishReturnStatement: function(argument) {
            this.type = Syntax.ReturnStatement;
            this.argument = argument;
            this.finish();
            return this;
          },
          finishSequenceExpression: function(expressions) {
            this.type = Syntax.SequenceExpression;
            this.expressions = expressions;
            this.finish();
            return this;
          },
          finishSwitchCase: function(test, consequent) {
            this.type = Syntax.SwitchCase;
            this.test = test;
            this.consequent = consequent;
            this.finish();
            return this;
          },
          finishSwitchStatement: function(discriminant, cases) {
            this.type = Syntax.SwitchStatement;
            this.discriminant = discriminant;
            this.cases = cases;
            this.finish();
            return this;
          },
          finishThisExpression: function() {
            this.type = Syntax.ThisExpression;
            this.finish();
            return this;
          },
          finishThrowStatement: function(argument) {
            this.type = Syntax.ThrowStatement;
            this.argument = argument;
            this.finish();
            return this;
          },
          finishTryStatement: function(block, handler, finalizer) {
            this.type = Syntax.TryStatement;
            this.block = block;
            this.guardedHandlers = [];
            this.handlers = handler ? [handler] : [];
            this.handler = handler;
            this.finalizer = finalizer;
            this.finish();
            return this;
          },
          finishUnaryExpression: function(operator, argument) {
            this.type = (operator === '++' || operator === '--') ? Syntax.UpdateExpression : Syntax.UnaryExpression;
            this.operator = operator;
            this.argument = argument;
            this.prefix = true;
            this.finish();
            return this;
          },
          finishVariableDeclaration: function(declarations) {
            this.type = Syntax.VariableDeclaration;
            this.declarations = declarations;
            this.kind = 'var';
            this.finish();
            return this;
          },
          finishLexicalDeclaration: function(declarations, kind) {
            this.type = Syntax.VariableDeclaration;
            this.declarations = declarations;
            this.kind = kind;
            this.finish();
            return this;
          },
          finishVariableDeclarator: function(id, init) {
            this.type = Syntax.VariableDeclarator;
            this.id = id;
            this.init = init;
            this.finish();
            return this;
          },
          finishWhileStatement: function(test, body) {
            this.type = Syntax.WhileStatement;
            this.test = test;
            this.body = body;
            this.finish();
            return this;
          },
          finishWithStatement: function(object, body) {
            this.type = Syntax.WithStatement;
            this.object = object;
            this.body = body;
            this.finish();
            return this;
          }
        };
        function recordError(error) {
          var e,
              existing;
          for (e = 0; e < extra.errors.length; e++) {
            existing = extra.errors[e];
            if (existing.index === error.index && existing.message === error.message) {
              return ;
            }
          }
          extra.errors.push(error);
        }
        function createError(line, pos, description) {
          var error = new Error('Line ' + line + ': ' + description);
          error.index = pos;
          error.lineNumber = line;
          error.column = pos - (scanning ? lineStart : lastLineStart) + 1;
          error.description = description;
          return error;
        }
        function throwError(messageFormat) {
          var args,
              msg;
          args = Array.prototype.slice.call(arguments, 1);
          msg = messageFormat.replace(/%(\d)/g, function(whole, idx) {
            assert(idx < args.length, 'Message reference must be in range');
            return args[idx];
          });
          throw createError(lastLineNumber, lastIndex, msg);
        }
        function tolerateError(messageFormat) {
          var args,
              msg,
              error;
          args = Array.prototype.slice.call(arguments, 1);
          msg = messageFormat.replace(/%(\d)/g, function(whole, idx) {
            assert(idx < args.length, 'Message reference must be in range');
            return args[idx];
          });
          error = createError(lineNumber, lastIndex, msg);
          if (extra.errors) {
            recordError(error);
          } else {
            throw error;
          }
        }
        function unexpectedTokenError(token, message) {
          var msg = message || Messages.UnexpectedToken;
          if (token && !message) {
            msg = (token.type === Token.EOF) ? Messages.UnexpectedEOS : (token.type === Token.Identifier) ? Messages.UnexpectedIdentifier : (token.type === Token.NumericLiteral) ? Messages.UnexpectedNumber : (token.type === Token.StringLiteral) ? Messages.UnexpectedString : Messages.UnexpectedToken;
            if (token.type === Token.Keyword) {
              if (isFutureReservedWord(token.value)) {
                msg = Messages.UnexpectedReserved;
              } else if (strict && isStrictModeReservedWord(token.value)) {
                msg = Messages.StrictReservedWord;
              }
            }
          }
          msg = msg.replace('%0', token ? token.value : 'ILLEGAL');
          return (token && typeof token.lineNumber === 'number') ? createError(token.lineNumber, token.start, msg) : createError(scanning ? lineNumber : lastLineNumber, scanning ? index : lastIndex, msg);
        }
        function throwUnexpectedToken(token, message) {
          throw unexpectedTokenError(token, message);
        }
        function tolerateUnexpectedToken(token, message) {
          var error = unexpectedTokenError(token, message);
          if (extra.errors) {
            recordError(error);
          } else {
            throw error;
          }
        }
        function expect(value) {
          var token = lex();
          if (token.type !== Token.Punctuator || token.value !== value) {
            throwUnexpectedToken(token);
          }
        }
        function expectCommaSeparator() {
          var token;
          if (extra.errors) {
            token = lookahead;
            if (token.type === Token.Punctuator && token.value === ',') {
              lex();
            } else if (token.type === Token.Punctuator && token.value === ';') {
              lex();
              tolerateUnexpectedToken(token);
            } else {
              tolerateUnexpectedToken(token, Messages.UnexpectedToken);
            }
          } else {
            expect(',');
          }
        }
        function expectKeyword(keyword) {
          var token = lex();
          if (token.type !== Token.Keyword || token.value !== keyword) {
            throwUnexpectedToken(token);
          }
        }
        function match(value) {
          return lookahead.type === Token.Punctuator && lookahead.value === value;
        }
        function matchKeyword(keyword) {
          return lookahead.type === Token.Keyword && lookahead.value === keyword;
        }
        function matchAssign() {
          var op;
          if (lookahead.type !== Token.Punctuator) {
            return false;
          }
          op = lookahead.value;
          return op === '=' || op === '*=' || op === '/=' || op === '%=' || op === '+=' || op === '-=' || op === '<<=' || op === '>>=' || op === '>>>=' || op === '&=' || op === '^=' || op === '|=';
        }
        function consumeSemicolon() {
          if (source.charCodeAt(startIndex) === 0x3B || match(';')) {
            lex();
            return ;
          }
          if (hasLineTerminator) {
            return ;
          }
          lastIndex = startIndex;
          lastLineNumber = startLineNumber;
          lastLineStart = startLineStart;
          if (lookahead.type !== Token.EOF && !match('}')) {
            throwUnexpectedToken(lookahead);
          }
        }
        function isLeftHandSide(expr) {
          return expr.type === Syntax.Identifier || expr.type === Syntax.MemberExpression;
        }
        function parseArrayInitialiser() {
          var elements = [],
              node = new Node();
          expect('[');
          while (!match(']')) {
            if (match(',')) {
              lex();
              elements.push(null);
            } else {
              elements.push(parseAssignmentExpression());
              if (!match(']')) {
                expect(',');
              }
            }
          }
          lex();
          return node.finishArrayExpression(elements);
        }
        function parsePropertyFunction(node, paramInfo) {
          var previousStrict,
              body;
          previousStrict = strict;
          body = parseFunctionSourceElements();
          if (strict && paramInfo.firstRestricted) {
            tolerateUnexpectedToken(paramInfo.firstRestricted, paramInfo.message);
          }
          if (strict && paramInfo.stricted) {
            tolerateUnexpectedToken(paramInfo.stricted, paramInfo.message);
          }
          strict = previousStrict;
          return node.finishFunctionExpression(null, paramInfo.params, paramInfo.defaults, body);
        }
        function parsePropertyMethodFunction() {
          var params,
              method,
              node = new Node();
          params = parseParams();
          method = parsePropertyFunction(node, params);
          return method;
        }
        function parseObjectPropertyKey() {
          var token,
              node = new Node(),
              expr;
          token = lex();
          switch (token.type) {
            case Token.StringLiteral:
            case Token.NumericLiteral:
              if (strict && token.octal) {
                tolerateUnexpectedToken(token, Messages.StrictOctalLiteral);
              }
              return node.finishLiteral(token);
            case Token.Identifier:
            case Token.BooleanLiteral:
            case Token.NullLiteral:
            case Token.Keyword:
              return node.finishIdentifier(token.value);
            case Token.Punctuator:
              if (token.value === '[') {
                expr = parseAssignmentExpression();
                expect(']');
                return expr;
              }
              break;
          }
          throwUnexpectedToken(token);
        }
        function lookaheadPropertyName() {
          switch (lookahead.type) {
            case Token.Identifier:
            case Token.StringLiteral:
            case Token.BooleanLiteral:
            case Token.NullLiteral:
            case Token.NumericLiteral:
            case Token.Keyword:
              return true;
            case Token.Punctuator:
              return lookahead.value === '[';
          }
          return false;
        }
        function tryParseMethodDefinition(token, key, computed, node) {
          var value,
              options,
              methodNode;
          if (token.type === Token.Identifier) {
            if (token.value === 'get' && lookaheadPropertyName()) {
              computed = match('[');
              key = parseObjectPropertyKey();
              methodNode = new Node();
              expect('(');
              expect(')');
              value = parsePropertyFunction(methodNode, {
                params: [],
                defaults: [],
                stricted: null,
                firstRestricted: null,
                message: null
              });
              return node.finishProperty('get', key, computed, value, false, false);
            } else if (token.value === 'set' && lookaheadPropertyName()) {
              computed = match('[');
              key = parseObjectPropertyKey();
              methodNode = new Node();
              expect('(');
              options = {
                params: [],
                defaultCount: 0,
                defaults: [],
                firstRestricted: null,
                paramSet: {}
              };
              if (match(')')) {
                tolerateUnexpectedToken(lookahead);
              } else {
                parseParam(options);
                if (options.defaultCount === 0) {
                  options.defaults = [];
                }
              }
              expect(')');
              value = parsePropertyFunction(methodNode, options);
              return node.finishProperty('set', key, computed, value, false, false);
            }
          }
          if (match('(')) {
            value = parsePropertyMethodFunction();
            return node.finishProperty('init', key, computed, value, true, false);
          }
          return null;
        }
        function checkProto(key, computed, hasProto) {
          if (computed === false && (key.type === Syntax.Identifier && key.name === '__proto__' || key.type === Syntax.Literal && key.value === '__proto__')) {
            if (hasProto.value) {
              tolerateError(Messages.DuplicateProtoProperty);
            } else {
              hasProto.value = true;
            }
          }
        }
        function parseObjectProperty(hasProto) {
          var token = lookahead,
              node = new Node(),
              computed,
              key,
              maybeMethod,
              value;
          computed = match('[');
          key = parseObjectPropertyKey();
          maybeMethod = tryParseMethodDefinition(token, key, computed, node);
          if (maybeMethod) {
            checkProto(maybeMethod.key, maybeMethod.computed, hasProto);
            return maybeMethod;
          }
          checkProto(key, computed, hasProto);
          if (match(':')) {
            lex();
            value = parseAssignmentExpression();
            return node.finishProperty('init', key, computed, value, false, false);
          }
          if (token.type === Token.Identifier) {
            return node.finishProperty('init', key, computed, key, false, true);
          }
          throwUnexpectedToken(lookahead);
        }
        function parseObjectInitialiser() {
          var properties = [],
              hasProto = {value: false},
              node = new Node();
          expect('{');
          while (!match('}')) {
            properties.push(parseObjectProperty(hasProto));
            if (!match('}')) {
              expectCommaSeparator();
            }
          }
          expect('}');
          return node.finishObjectExpression(properties);
        }
        function parseGroupExpression() {
          var expr,
              expressions,
              startToken,
              isValidArrowParameter = true;
          expect('(');
          if (match(')')) {
            lex();
            if (!match('=>')) {
              expect('=>');
            }
            return {
              type: PlaceHolders.ArrowParameterPlaceHolder,
              params: []
            };
          }
          startToken = lookahead;
          if (match('...')) {
            expr = parseRestElement();
            expect(')');
            if (!match('=>')) {
              expect('=>');
            }
            return {
              type: PlaceHolders.ArrowParameterPlaceHolder,
              params: [expr]
            };
          }
          if (match('(')) {
            isValidArrowParameter = false;
          }
          expr = parseAssignmentExpression();
          if (match(',')) {
            expressions = [expr];
            while (startIndex < length) {
              if (!match(',')) {
                break;
              }
              lex();
              if (match('...')) {
                if (!isValidArrowParameter) {
                  throwUnexpectedToken(lookahead);
                }
                expressions.push(parseRestElement());
                expect(')');
                if (!match('=>')) {
                  expect('=>');
                }
                return {
                  type: PlaceHolders.ArrowParameterPlaceHolder,
                  params: expressions
                };
              } else if (match('(')) {
                isValidArrowParameter = false;
              }
              expressions.push(parseAssignmentExpression());
            }
            expr = new WrappingNode(startToken).finishSequenceExpression(expressions);
          }
          expect(')');
          if (match('=>') && !isValidArrowParameter) {
            throwUnexpectedToken(lookahead);
          }
          return expr;
        }
        function parsePrimaryExpression() {
          var type,
              token,
              expr,
              node;
          if (match('(')) {
            return parseGroupExpression();
          }
          if (match('[')) {
            return parseArrayInitialiser();
          }
          if (match('{')) {
            return parseObjectInitialiser();
          }
          type = lookahead.type;
          node = new Node();
          if (type === Token.Identifier) {
            expr = node.finishIdentifier(lex().value);
          } else if (type === Token.StringLiteral || type === Token.NumericLiteral) {
            if (strict && lookahead.octal) {
              tolerateUnexpectedToken(lookahead, Messages.StrictOctalLiteral);
            }
            expr = node.finishLiteral(lex());
          } else if (type === Token.Keyword) {
            if (matchKeyword('function')) {
              return parseFunctionExpression();
            }
            if (matchKeyword('this')) {
              lex();
              return node.finishThisExpression();
            }
            if (matchKeyword('class')) {
              return parseClassExpression();
            }
            throwUnexpectedToken(lex());
          } else if (type === Token.BooleanLiteral) {
            token = lex();
            token.value = (token.value === 'true');
            expr = node.finishLiteral(token);
          } else if (type === Token.NullLiteral) {
            token = lex();
            token.value = null;
            expr = node.finishLiteral(token);
          } else if (match('/') || match('/=')) {
            index = startIndex;
            if (typeof extra.tokens !== 'undefined') {
              token = collectRegex();
            } else {
              token = scanRegExp();
            }
            lex();
            expr = node.finishLiteral(token);
          } else {
            throwUnexpectedToken(lex());
          }
          return expr;
        }
        function parseArguments() {
          var args = [];
          expect('(');
          if (!match(')')) {
            while (startIndex < length) {
              args.push(parseAssignmentExpression());
              if (match(')')) {
                break;
              }
              expectCommaSeparator();
            }
          }
          expect(')');
          return args;
        }
        function parseNonComputedProperty() {
          var token,
              node = new Node();
          token = lex();
          if (!isIdentifierName(token)) {
            throwUnexpectedToken(token);
          }
          return node.finishIdentifier(token.value);
        }
        function parseNonComputedMember() {
          expect('.');
          return parseNonComputedProperty();
        }
        function parseComputedMember() {
          var expr;
          expect('[');
          expr = parseExpression();
          expect(']');
          return expr;
        }
        function parseNewExpression() {
          var callee,
              args,
              node = new Node();
          expectKeyword('new');
          callee = parseLeftHandSideExpression();
          args = match('(') ? parseArguments() : [];
          return node.finishNewExpression(callee, args);
        }
        function parseLeftHandSideExpressionAllowCall() {
          var expr,
              args,
              property,
              startToken,
              previousAllowIn = state.allowIn;
          startToken = lookahead;
          state.allowIn = true;
          expr = matchKeyword('new') ? parseNewExpression() : parsePrimaryExpression();
          for (; ; ) {
            if (match('.')) {
              property = parseNonComputedMember();
              expr = new WrappingNode(startToken).finishMemberExpression('.', expr, property);
            } else if (match('(')) {
              args = parseArguments();
              expr = new WrappingNode(startToken).finishCallExpression(expr, args);
            } else if (match('[')) {
              property = parseComputedMember();
              expr = new WrappingNode(startToken).finishMemberExpression('[', expr, property);
            } else {
              break;
            }
          }
          state.allowIn = previousAllowIn;
          return expr;
        }
        function parseLeftHandSideExpression() {
          var expr,
              property,
              startToken;
          assert(state.allowIn, 'callee of new expression always allow in keyword.');
          startToken = lookahead;
          expr = matchKeyword('new') ? parseNewExpression() : parsePrimaryExpression();
          for (; ; ) {
            if (match('[')) {
              property = parseComputedMember();
              expr = new WrappingNode(startToken).finishMemberExpression('[', expr, property);
            } else if (match('.')) {
              property = parseNonComputedMember();
              expr = new WrappingNode(startToken).finishMemberExpression('.', expr, property);
            } else {
              break;
            }
          }
          return expr;
        }
        function parsePostfixExpression() {
          var expr,
              token,
              startToken = lookahead;
          expr = parseLeftHandSideExpressionAllowCall();
          if (!hasLineTerminator && lookahead.type === Token.Punctuator) {
            if (match('++') || match('--')) {
              if (strict && expr.type === Syntax.Identifier && isRestrictedWord(expr.name)) {
                tolerateError(Messages.StrictLHSPostfix);
              }
              if (!isLeftHandSide(expr)) {
                tolerateError(Messages.InvalidLHSInAssignment);
              }
              token = lex();
              expr = new WrappingNode(startToken).finishPostfixExpression(token.value, expr);
            }
          }
          return expr;
        }
        function parseUnaryExpression() {
          var token,
              expr,
              startToken;
          if (lookahead.type !== Token.Punctuator && lookahead.type !== Token.Keyword) {
            expr = parsePostfixExpression();
          } else if (match('++') || match('--')) {
            startToken = lookahead;
            token = lex();
            expr = parseUnaryExpression();
            if (strict && expr.type === Syntax.Identifier && isRestrictedWord(expr.name)) {
              tolerateError(Messages.StrictLHSPrefix);
            }
            if (!isLeftHandSide(expr)) {
              tolerateError(Messages.InvalidLHSInAssignment);
            }
            expr = new WrappingNode(startToken).finishUnaryExpression(token.value, expr);
          } else if (match('+') || match('-') || match('~') || match('!')) {
            startToken = lookahead;
            token = lex();
            expr = parseUnaryExpression();
            expr = new WrappingNode(startToken).finishUnaryExpression(token.value, expr);
          } else if (matchKeyword('delete') || matchKeyword('void') || matchKeyword('typeof')) {
            startToken = lookahead;
            token = lex();
            expr = parseUnaryExpression();
            expr = new WrappingNode(startToken).finishUnaryExpression(token.value, expr);
            if (strict && expr.operator === 'delete' && expr.argument.type === Syntax.Identifier) {
              tolerateError(Messages.StrictDelete);
            }
          } else {
            expr = parsePostfixExpression();
          }
          return expr;
        }
        function binaryPrecedence(token, allowIn) {
          var prec = 0;
          if (token.type !== Token.Punctuator && token.type !== Token.Keyword) {
            return 0;
          }
          switch (token.value) {
            case '||':
              prec = 1;
              break;
            case '&&':
              prec = 2;
              break;
            case '|':
              prec = 3;
              break;
            case '^':
              prec = 4;
              break;
            case '&':
              prec = 5;
              break;
            case '==':
            case '!=':
            case '===':
            case '!==':
              prec = 6;
              break;
            case '<':
            case '>':
            case '<=':
            case '>=':
            case 'instanceof':
              prec = 7;
              break;
            case 'in':
              prec = allowIn ? 7 : 0;
              break;
            case '<<':
            case '>>':
            case '>>>':
              prec = 8;
              break;
            case '+':
            case '-':
              prec = 9;
              break;
            case '*':
            case '/':
            case '%':
              prec = 11;
              break;
            default:
              break;
          }
          return prec;
        }
        function parseBinaryExpression() {
          var marker,
              markers,
              expr,
              token,
              prec,
              stack,
              right,
              operator,
              left,
              i;
          marker = lookahead;
          left = parseUnaryExpression();
          token = lookahead;
          prec = binaryPrecedence(token, state.allowIn);
          if (prec === 0) {
            return left;
          }
          token.prec = prec;
          lex();
          markers = [marker, lookahead];
          right = parseUnaryExpression();
          stack = [left, token, right];
          while ((prec = binaryPrecedence(lookahead, state.allowIn)) > 0) {
            while ((stack.length > 2) && (prec <= stack[stack.length - 2].prec)) {
              right = stack.pop();
              operator = stack.pop().value;
              left = stack.pop();
              markers.pop();
              expr = new WrappingNode(markers[markers.length - 1]).finishBinaryExpression(operator, left, right);
              stack.push(expr);
            }
            token = lex();
            token.prec = prec;
            stack.push(token);
            markers.push(lookahead);
            expr = parseUnaryExpression();
            stack.push(expr);
          }
          i = stack.length - 1;
          expr = stack[i];
          markers.pop();
          while (i > 1) {
            expr = new WrappingNode(markers.pop()).finishBinaryExpression(stack[i - 1].value, stack[i - 2], expr);
            i -= 2;
          }
          return expr;
        }
        function parseConditionalExpression() {
          var expr,
              previousAllowIn,
              consequent,
              alternate,
              startToken;
          startToken = lookahead;
          expr = parseBinaryExpression();
          if (match('?')) {
            lex();
            previousAllowIn = state.allowIn;
            state.allowIn = true;
            consequent = parseAssignmentExpression();
            state.allowIn = previousAllowIn;
            expect(':');
            alternate = parseAssignmentExpression();
            expr = new WrappingNode(startToken).finishConditionalExpression(expr, consequent, alternate);
          }
          return expr;
        }
        function parseConciseBody() {
          if (match('{')) {
            return parseFunctionSourceElements();
          }
          return parseAssignmentExpression();
        }
        function reinterpretAsCoverFormalsList(expr) {
          var i,
              len,
              param,
              params,
              defaults,
              defaultCount,
              options,
              token;
          defaults = [];
          defaultCount = 0;
          params = [expr];
          switch (expr.type) {
            case Syntax.Identifier:
            case Syntax.AssignmentExpression:
              break;
            case Syntax.SequenceExpression:
              params = expr.expressions;
              break;
            case PlaceHolders.ArrowParameterPlaceHolder:
              params = expr.params;
              break;
            default:
              return null;
          }
          options = {paramSet: {}};
          for (i = 0, len = params.length; i < len; i += 1) {
            param = params[i];
            if (param.type === Syntax.Identifier) {
              params[i] = param;
              defaults.push(null);
              validateParam(options, param, param.name);
            } else if (param.type === Syntax.RestElement) {
              params[i] = param;
              defaults.push(null);
              validateParam(options, param.argument, param.argument.name);
            } else if (param.type === Syntax.AssignmentExpression) {
              params[i] = param.left;
              defaults.push(param.right);
              ++defaultCount;
              validateParam(options, param.left, param.left.name);
            } else {
              return null;
            }
          }
          if (options.message === Messages.StrictParamDupe) {
            token = strict ? options.stricted : options.firstRestricted;
            throwUnexpectedToken(token, options.message);
          }
          if (defaultCount === 0) {
            defaults = [];
          }
          return {
            params: params,
            defaults: defaults,
            stricted: options.stricted,
            firstRestricted: options.firstRestricted,
            message: options.message
          };
        }
        function parseArrowFunctionExpression(options, node) {
          var previousStrict,
              body;
          expect('=>');
          previousStrict = strict;
          body = parseConciseBody();
          if (strict && options.firstRestricted) {
            throwUnexpectedToken(options.firstRestricted, options.message);
          }
          if (strict && options.stricted) {
            tolerateUnexpectedToken(options.stricted, options.message);
          }
          strict = previousStrict;
          return node.finishArrowFunctionExpression(options.params, options.defaults, body, body.type !== Syntax.BlockStatement);
        }
        function parseAssignmentExpression() {
          var token,
              expr,
              right,
              list,
              startToken;
          startToken = lookahead;
          token = lookahead;
          expr = parseConditionalExpression();
          if (expr.type === PlaceHolders.ArrowParameterPlaceHolder || match('=>')) {
            list = reinterpretAsCoverFormalsList(expr);
            if (list) {
              return parseArrowFunctionExpression(list, new WrappingNode(startToken));
            }
          }
          if (matchAssign()) {
            if (!isLeftHandSide(expr)) {
              tolerateError(Messages.InvalidLHSInAssignment);
            }
            if (strict && expr.type === Syntax.Identifier && isRestrictedWord(expr.name)) {
              tolerateUnexpectedToken(token, Messages.StrictLHSAssignment);
            }
            token = lex();
            right = parseAssignmentExpression();
            expr = new WrappingNode(startToken).finishAssignmentExpression(token.value, expr, right);
          }
          return expr;
        }
        function parseExpression() {
          var expr,
              startToken = lookahead,
              expressions;
          expr = parseAssignmentExpression();
          if (match(',')) {
            expressions = [expr];
            while (startIndex < length) {
              if (!match(',')) {
                break;
              }
              lex();
              expressions.push(parseAssignmentExpression());
            }
            expr = new WrappingNode(startToken).finishSequenceExpression(expressions);
          }
          return expr;
        }
        function parseStatementListItem() {
          if (lookahead.type === Token.Keyword) {
            switch (lookahead.value) {
              case 'const':
              case 'let':
                return parseLexicalDeclaration();
              case 'function':
                return parseFunctionDeclaration(new Node());
              case 'class':
                return parseClassDeclaration();
            }
          }
          return parseStatement();
        }
        function parseStatementList() {
          var list = [];
          while (startIndex < length) {
            if (match('}')) {
              break;
            }
            list.push(parseStatementListItem());
          }
          return list;
        }
        function parseBlock() {
          var block,
              node = new Node();
          expect('{');
          block = parseStatementList();
          expect('}');
          return node.finishBlockStatement(block);
        }
        function parseVariableIdentifier() {
          var token,
              node = new Node();
          token = lex();
          if (token.type !== Token.Identifier) {
            if (strict && token.type === Token.Keyword && isStrictModeReservedWord(token.value)) {
              tolerateUnexpectedToken(token, Messages.StrictReservedWord);
            } else {
              throwUnexpectedToken(token);
            }
          }
          return node.finishIdentifier(token.value);
        }
        function parseVariableDeclaration() {
          var init = null,
              id,
              node = new Node();
          id = parseVariableIdentifier();
          if (strict && isRestrictedWord(id.name)) {
            tolerateError(Messages.StrictVarName);
          }
          if (match('=')) {
            lex();
            init = parseAssignmentExpression();
          }
          return node.finishVariableDeclarator(id, init);
        }
        function parseVariableDeclarationList() {
          var list = [];
          do {
            list.push(parseVariableDeclaration());
            if (!match(',')) {
              break;
            }
            lex();
          } while (startIndex < length);
          return list;
        }
        function parseVariableStatement(node) {
          var declarations;
          expectKeyword('var');
          declarations = parseVariableDeclarationList();
          consumeSemicolon();
          return node.finishVariableDeclaration(declarations);
        }
        function parseLexicalBinding(kind) {
          var init = null,
              id,
              node = new Node();
          id = parseVariableIdentifier();
          if (strict && isRestrictedWord(id.name)) {
            tolerateError(Messages.StrictVarName);
          }
          if (kind === 'const') {
            if (!matchKeyword('in')) {
              expect('=');
              init = parseAssignmentExpression();
            }
          } else if (match('=')) {
            lex();
            init = parseAssignmentExpression();
          }
          return node.finishVariableDeclarator(id, init);
        }
        function parseBindingList(kind) {
          var list = [];
          do {
            list.push(parseLexicalBinding(kind));
            if (!match(',')) {
              break;
            }
            lex();
          } while (startIndex < length);
          return list;
        }
        function parseLexicalDeclaration() {
          var kind,
              declarations,
              node = new Node();
          kind = lex().value;
          assert(kind === 'let' || kind === 'const', 'Lexical declaration must be either let or const');
          declarations = parseBindingList(kind);
          consumeSemicolon();
          return node.finishLexicalDeclaration(declarations, kind);
        }
        function parseRestElement() {
          var param,
              node = new Node();
          lex();
          if (match('{')) {
            throwError(Messages.ObjectPatternAsRestParameter);
          }
          param = parseVariableIdentifier();
          if (match('=')) {
            throwError(Messages.DefaultRestParameter);
          }
          if (!match(')')) {
            throwError(Messages.ParameterAfterRestParameter);
          }
          return node.finishRestElement(param);
        }
        function parseEmptyStatement(node) {
          expect(';');
          return node.finishEmptyStatement();
        }
        function parseExpressionStatement(node) {
          var expr = parseExpression();
          consumeSemicolon();
          return node.finishExpressionStatement(expr);
        }
        function parseIfStatement(node) {
          var test,
              consequent,
              alternate;
          expectKeyword('if');
          expect('(');
          test = parseExpression();
          expect(')');
          consequent = parseStatement();
          if (matchKeyword('else')) {
            lex();
            alternate = parseStatement();
          } else {
            alternate = null;
          }
          return node.finishIfStatement(test, consequent, alternate);
        }
        function parseDoWhileStatement(node) {
          var body,
              test,
              oldInIteration;
          expectKeyword('do');
          oldInIteration = state.inIteration;
          state.inIteration = true;
          body = parseStatement();
          state.inIteration = oldInIteration;
          expectKeyword('while');
          expect('(');
          test = parseExpression();
          expect(')');
          if (match(';')) {
            lex();
          }
          return node.finishDoWhileStatement(body, test);
        }
        function parseWhileStatement(node) {
          var test,
              body,
              oldInIteration;
          expectKeyword('while');
          expect('(');
          test = parseExpression();
          expect(')');
          oldInIteration = state.inIteration;
          state.inIteration = true;
          body = parseStatement();
          state.inIteration = oldInIteration;
          return node.finishWhileStatement(test, body);
        }
        function parseForStatement(node) {
          var init,
              test,
              update,
              left,
              right,
              kind,
              declarations,
              body,
              oldInIteration,
              previousAllowIn = state.allowIn;
          init = test = update = null;
          expectKeyword('for');
          expect('(');
          if (match(';')) {
            lex();
          } else {
            if (matchKeyword('var')) {
              init = new Node();
              lex();
              state.allowIn = false;
              init = init.finishVariableDeclaration(parseVariableDeclarationList());
              state.allowIn = previousAllowIn;
              if (init.declarations.length === 1 && matchKeyword('in')) {
                lex();
                left = init;
                right = parseExpression();
                init = null;
              } else {
                expect(';');
              }
            } else if (matchKeyword('const') || matchKeyword('let')) {
              init = new Node();
              kind = lex().value;
              state.allowIn = false;
              declarations = parseBindingList(kind);
              state.allowIn = previousAllowIn;
              if (declarations.length === 1 && declarations[0].init === null && matchKeyword('in')) {
                init = init.finishLexicalDeclaration(declarations, kind);
                lex();
                left = init;
                right = parseExpression();
                init = null;
              } else {
                consumeSemicolon();
                init = init.finishLexicalDeclaration(declarations, kind);
              }
            } else {
              state.allowIn = false;
              init = parseExpression();
              state.allowIn = previousAllowIn;
              if (matchKeyword('in')) {
                if (!isLeftHandSide(init)) {
                  tolerateError(Messages.InvalidLHSInForIn);
                }
                lex();
                left = init;
                right = parseExpression();
                init = null;
              } else {
                expect(';');
              }
            }
          }
          if (typeof left === 'undefined') {
            if (!match(';')) {
              test = parseExpression();
            }
            expect(';');
            if (!match(')')) {
              update = parseExpression();
            }
          }
          expect(')');
          oldInIteration = state.inIteration;
          state.inIteration = true;
          body = parseStatement();
          state.inIteration = oldInIteration;
          return (typeof left === 'undefined') ? node.finishForStatement(init, test, update, body) : node.finishForInStatement(left, right, body);
        }
        function parseContinueStatement(node) {
          var label = null,
              key;
          expectKeyword('continue');
          if (source.charCodeAt(startIndex) === 0x3B) {
            lex();
            if (!state.inIteration) {
              throwError(Messages.IllegalContinue);
            }
            return node.finishContinueStatement(null);
          }
          if (hasLineTerminator) {
            if (!state.inIteration) {
              throwError(Messages.IllegalContinue);
            }
            return node.finishContinueStatement(null);
          }
          if (lookahead.type === Token.Identifier) {
            label = parseVariableIdentifier();
            key = '$' + label.name;
            if (!Object.prototype.hasOwnProperty.call(state.labelSet, key)) {
              throwError(Messages.UnknownLabel, label.name);
            }
          }
          consumeSemicolon();
          if (label === null && !state.inIteration) {
            throwError(Messages.IllegalContinue);
          }
          return node.finishContinueStatement(label);
        }
        function parseBreakStatement(node) {
          var label = null,
              key;
          expectKeyword('break');
          if (source.charCodeAt(lastIndex) === 0x3B) {
            lex();
            if (!(state.inIteration || state.inSwitch)) {
              throwError(Messages.IllegalBreak);
            }
            return node.finishBreakStatement(null);
          }
          if (hasLineTerminator) {
            if (!(state.inIteration || state.inSwitch)) {
              throwError(Messages.IllegalBreak);
            }
            return node.finishBreakStatement(null);
          }
          if (lookahead.type === Token.Identifier) {
            label = parseVariableIdentifier();
            key = '$' + label.name;
            if (!Object.prototype.hasOwnProperty.call(state.labelSet, key)) {
              throwError(Messages.UnknownLabel, label.name);
            }
          }
          consumeSemicolon();
          if (label === null && !(state.inIteration || state.inSwitch)) {
            throwError(Messages.IllegalBreak);
          }
          return node.finishBreakStatement(label);
        }
        function parseReturnStatement(node) {
          var argument = null;
          expectKeyword('return');
          if (!state.inFunctionBody) {
            tolerateError(Messages.IllegalReturn);
          }
          if (source.charCodeAt(lastIndex) === 0x20) {
            if (isIdentifierStart(source.charCodeAt(lastIndex + 1))) {
              argument = parseExpression();
              consumeSemicolon();
              return node.finishReturnStatement(argument);
            }
          }
          if (hasLineTerminator) {
            return node.finishReturnStatement(null);
          }
          if (!match(';')) {
            if (!match('}') && lookahead.type !== Token.EOF) {
              argument = parseExpression();
            }
          }
          consumeSemicolon();
          return node.finishReturnStatement(argument);
        }
        function parseWithStatement(node) {
          var object,
              body;
          if (strict) {
            tolerateError(Messages.StrictModeWith);
          }
          expectKeyword('with');
          expect('(');
          object = parseExpression();
          expect(')');
          body = parseStatement();
          return node.finishWithStatement(object, body);
        }
        function parseSwitchCase() {
          var test,
              consequent = [],
              statement,
              node = new Node();
          if (matchKeyword('default')) {
            lex();
            test = null;
          } else {
            expectKeyword('case');
            test = parseExpression();
          }
          expect(':');
          while (startIndex < length) {
            if (match('}') || matchKeyword('default') || matchKeyword('case')) {
              break;
            }
            statement = parseStatementListItem();
            consequent.push(statement);
          }
          return node.finishSwitchCase(test, consequent);
        }
        function parseSwitchStatement(node) {
          var discriminant,
              cases,
              clause,
              oldInSwitch,
              defaultFound;
          expectKeyword('switch');
          expect('(');
          discriminant = parseExpression();
          expect(')');
          expect('{');
          cases = [];
          if (match('}')) {
            lex();
            return node.finishSwitchStatement(discriminant, cases);
          }
          oldInSwitch = state.inSwitch;
          state.inSwitch = true;
          defaultFound = false;
          while (startIndex < length) {
            if (match('}')) {
              break;
            }
            clause = parseSwitchCase();
            if (clause.test === null) {
              if (defaultFound) {
                throwError(Messages.MultipleDefaultsInSwitch);
              }
              defaultFound = true;
            }
            cases.push(clause);
          }
          state.inSwitch = oldInSwitch;
          expect('}');
          return node.finishSwitchStatement(discriminant, cases);
        }
        function parseThrowStatement(node) {
          var argument;
          expectKeyword('throw');
          if (hasLineTerminator) {
            throwError(Messages.NewlineAfterThrow);
          }
          argument = parseExpression();
          consumeSemicolon();
          return node.finishThrowStatement(argument);
        }
        function parseCatchClause() {
          var param,
              body,
              node = new Node();
          expectKeyword('catch');
          expect('(');
          if (match(')')) {
            throwUnexpectedToken(lookahead);
          }
          param = parseVariableIdentifier();
          if (strict && isRestrictedWord(param.name)) {
            tolerateError(Messages.StrictCatchVariable);
          }
          expect(')');
          body = parseBlock();
          return node.finishCatchClause(param, body);
        }
        function parseTryStatement(node) {
          var block,
              handler = null,
              finalizer = null;
          expectKeyword('try');
          block = parseBlock();
          if (matchKeyword('catch')) {
            handler = parseCatchClause();
          }
          if (matchKeyword('finally')) {
            lex();
            finalizer = parseBlock();
          }
          if (!handler && !finalizer) {
            throwError(Messages.NoCatchOrFinally);
          }
          return node.finishTryStatement(block, handler, finalizer);
        }
        function parseDebuggerStatement(node) {
          expectKeyword('debugger');
          consumeSemicolon();
          return node.finishDebuggerStatement();
        }
        function parseStatement() {
          var type = lookahead.type,
              expr,
              labeledBody,
              key,
              node;
          if (type === Token.EOF) {
            throwUnexpectedToken(lookahead);
          }
          if (type === Token.Punctuator && lookahead.value === '{') {
            return parseBlock();
          }
          node = new Node();
          if (type === Token.Punctuator) {
            switch (lookahead.value) {
              case ';':
                return parseEmptyStatement(node);
              case '(':
                return parseExpressionStatement(node);
              default:
                break;
            }
          } else if (type === Token.Keyword) {
            switch (lookahead.value) {
              case 'break':
                return parseBreakStatement(node);
              case 'continue':
                return parseContinueStatement(node);
              case 'debugger':
                return parseDebuggerStatement(node);
              case 'do':
                return parseDoWhileStatement(node);
              case 'for':
                return parseForStatement(node);
              case 'function':
                return parseFunctionDeclaration(node);
              case 'if':
                return parseIfStatement(node);
              case 'return':
                return parseReturnStatement(node);
              case 'switch':
                return parseSwitchStatement(node);
              case 'throw':
                return parseThrowStatement(node);
              case 'try':
                return parseTryStatement(node);
              case 'var':
                return parseVariableStatement(node);
              case 'while':
                return parseWhileStatement(node);
              case 'with':
                return parseWithStatement(node);
              default:
                break;
            }
          }
          expr = parseExpression();
          if ((expr.type === Syntax.Identifier) && match(':')) {
            lex();
            key = '$' + expr.name;
            if (Object.prototype.hasOwnProperty.call(state.labelSet, key)) {
              throwError(Messages.Redeclaration, 'Label', expr.name);
            }
            state.labelSet[key] = true;
            labeledBody = parseStatement();
            delete state.labelSet[key];
            return node.finishLabeledStatement(expr, labeledBody);
          }
          consumeSemicolon();
          return node.finishExpressionStatement(expr);
        }
        function parseFunctionSourceElements() {
          var statement,
              body = [],
              token,
              directive,
              firstRestricted,
              oldLabelSet,
              oldInIteration,
              oldInSwitch,
              oldInFunctionBody,
              oldParenthesisCount,
              node = new Node();
          expect('{');
          while (startIndex < length) {
            if (lookahead.type !== Token.StringLiteral) {
              break;
            }
            token = lookahead;
            statement = parseStatementListItem();
            body.push(statement);
            if (statement.expression.type !== Syntax.Literal) {
              break;
            }
            directive = source.slice(token.start + 1, token.end - 1);
            if (directive === 'use strict') {
              strict = true;
              if (firstRestricted) {
                tolerateUnexpectedToken(firstRestricted, Messages.StrictOctalLiteral);
              }
            } else {
              if (!firstRestricted && token.octal) {
                firstRestricted = token;
              }
            }
          }
          oldLabelSet = state.labelSet;
          oldInIteration = state.inIteration;
          oldInSwitch = state.inSwitch;
          oldInFunctionBody = state.inFunctionBody;
          oldParenthesisCount = state.parenthesizedCount;
          state.labelSet = {};
          state.inIteration = false;
          state.inSwitch = false;
          state.inFunctionBody = true;
          state.parenthesizedCount = 0;
          while (startIndex < length) {
            if (match('}')) {
              break;
            }
            body.push(parseStatementListItem());
          }
          expect('}');
          state.labelSet = oldLabelSet;
          state.inIteration = oldInIteration;
          state.inSwitch = oldInSwitch;
          state.inFunctionBody = oldInFunctionBody;
          state.parenthesizedCount = oldParenthesisCount;
          return node.finishBlockStatement(body);
        }
        function validateParam(options, param, name) {
          var key = '$' + name;
          if (strict) {
            if (isRestrictedWord(name)) {
              options.stricted = param;
              options.message = Messages.StrictParamName;
            }
            if (Object.prototype.hasOwnProperty.call(options.paramSet, key)) {
              options.stricted = param;
              options.message = Messages.StrictParamDupe;
            }
          } else if (!options.firstRestricted) {
            if (isRestrictedWord(name)) {
              options.firstRestricted = param;
              options.message = Messages.StrictParamName;
            } else if (isStrictModeReservedWord(name)) {
              options.firstRestricted = param;
              options.message = Messages.StrictReservedWord;
            } else if (Object.prototype.hasOwnProperty.call(options.paramSet, key)) {
              options.firstRestricted = param;
              options.message = Messages.StrictParamDupe;
            }
          }
          options.paramSet[key] = true;
        }
        function parseParam(options) {
          var token,
              param,
              def;
          token = lookahead;
          if (token.value === '...') {
            param = parseRestElement();
            validateParam(options, param.argument, param.argument.name);
            options.params.push(param);
            options.defaults.push(null);
            return false;
          }
          param = parseVariableIdentifier();
          validateParam(options, token, token.value);
          if (match('=')) {
            lex();
            def = parseAssignmentExpression();
            ++options.defaultCount;
          }
          options.params.push(param);
          options.defaults.push(def);
          return !match(')');
        }
        function parseParams(firstRestricted) {
          var options;
          options = {
            params: [],
            defaultCount: 0,
            defaults: [],
            firstRestricted: firstRestricted
          };
          expect('(');
          if (!match(')')) {
            options.paramSet = {};
            while (startIndex < length) {
              if (!parseParam(options)) {
                break;
              }
              expect(',');
            }
          }
          expect(')');
          if (options.defaultCount === 0) {
            options.defaults = [];
          }
          return {
            params: options.params,
            defaults: options.defaults,
            stricted: options.stricted,
            firstRestricted: options.firstRestricted,
            message: options.message
          };
        }
        function parseFunctionDeclaration(node) {
          var id,
              params = [],
              defaults = [],
              body,
              token,
              stricted,
              tmp,
              firstRestricted,
              message,
              previousStrict;
          expectKeyword('function');
          token = lookahead;
          id = parseVariableIdentifier();
          if (strict) {
            if (isRestrictedWord(token.value)) {
              tolerateUnexpectedToken(token, Messages.StrictFunctionName);
            }
          } else {
            if (isRestrictedWord(token.value)) {
              firstRestricted = token;
              message = Messages.StrictFunctionName;
            } else if (isStrictModeReservedWord(token.value)) {
              firstRestricted = token;
              message = Messages.StrictReservedWord;
            }
          }
          tmp = parseParams(firstRestricted);
          params = tmp.params;
          defaults = tmp.defaults;
          stricted = tmp.stricted;
          firstRestricted = tmp.firstRestricted;
          if (tmp.message) {
            message = tmp.message;
          }
          previousStrict = strict;
          body = parseFunctionSourceElements();
          if (strict && firstRestricted) {
            throwUnexpectedToken(firstRestricted, message);
          }
          if (strict && stricted) {
            tolerateUnexpectedToken(stricted, message);
          }
          strict = previousStrict;
          return node.finishFunctionDeclaration(id, params, defaults, body);
        }
        function parseFunctionExpression() {
          var token,
              id = null,
              stricted,
              firstRestricted,
              message,
              tmp,
              params = [],
              defaults = [],
              body,
              previousStrict,
              node = new Node();
          expectKeyword('function');
          if (!match('(')) {
            token = lookahead;
            id = parseVariableIdentifier();
            if (strict) {
              if (isRestrictedWord(token.value)) {
                tolerateUnexpectedToken(token, Messages.StrictFunctionName);
              }
            } else {
              if (isRestrictedWord(token.value)) {
                firstRestricted = token;
                message = Messages.StrictFunctionName;
              } else if (isStrictModeReservedWord(token.value)) {
                firstRestricted = token;
                message = Messages.StrictReservedWord;
              }
            }
          }
          tmp = parseParams(firstRestricted);
          params = tmp.params;
          defaults = tmp.defaults;
          stricted = tmp.stricted;
          firstRestricted = tmp.firstRestricted;
          if (tmp.message) {
            message = tmp.message;
          }
          previousStrict = strict;
          body = parseFunctionSourceElements();
          if (strict && firstRestricted) {
            throwUnexpectedToken(firstRestricted, message);
          }
          if (strict && stricted) {
            tolerateUnexpectedToken(stricted, message);
          }
          strict = previousStrict;
          return node.finishFunctionExpression(id, params, defaults, body);
        }
        function parseClassBody() {
          var classBody,
              token,
              isStatic,
              hasConstructor = false,
              body,
              method,
              computed,
              key;
          classBody = new Node();
          expect('{');
          body = [];
          while (!match('}')) {
            if (match(';')) {
              lex();
            } else {
              method = new Node();
              token = lookahead;
              isStatic = false;
              computed = match('[');
              key = parseObjectPropertyKey();
              if (key.name === 'static' && lookaheadPropertyName()) {
                token = lookahead;
                isStatic = true;
                computed = match('[');
                key = parseObjectPropertyKey();
              }
              method = tryParseMethodDefinition(token, key, computed, method);
              if (method) {
                method.static = isStatic;
                if (method.kind === 'init') {
                  method.kind = 'method';
                }
                if (!isStatic) {
                  if (!method.computed && (method.key.name || method.key.value.toString()) === 'constructor') {
                    if (method.kind !== 'method' || !method.method || method.value.generator) {
                      throwUnexpectedToken(token, Messages.ConstructorSpecialMethod);
                    }
                    if (hasConstructor) {
                      throwUnexpectedToken(token, Messages.DuplicateConstructor);
                    } else {
                      hasConstructor = true;
                    }
                    method.kind = 'constructor';
                  }
                } else {
                  if (!method.computed && (method.key.name || method.key.value.toString()) === 'prototype') {
                    throwUnexpectedToken(token, Messages.StaticPrototype);
                  }
                }
                method.type = Syntax.MethodDefinition;
                delete method.method;
                delete method.shorthand;
                body.push(method);
              } else {
                throwUnexpectedToken(lookahead);
              }
            }
          }
          lex();
          return classBody.finishClassBody(body);
        }
        function parseClassDeclaration() {
          var id = null,
              superClass = null,
              classNode = new Node(),
              classBody,
              previousStrict = strict;
          strict = true;
          expectKeyword('class');
          id = parseVariableIdentifier();
          if (matchKeyword('extends')) {
            lex();
            superClass = parseLeftHandSideExpressionAllowCall();
          }
          classBody = parseClassBody();
          strict = previousStrict;
          return classNode.finishClassDeclaration(id, superClass, classBody);
        }
        function parseClassExpression() {
          var id = null,
              superClass = null,
              classNode = new Node(),
              classBody,
              previousStrict = strict;
          strict = true;
          expectKeyword('class');
          if (lookahead.type === Token.Identifier) {
            id = parseVariableIdentifier();
          }
          if (matchKeyword('extends')) {
            lex();
            superClass = parseLeftHandSideExpressionAllowCall();
          }
          classBody = parseClassBody();
          strict = previousStrict;
          return classNode.finishClassExpression(id, superClass, classBody);
        }
        function parseScriptBody() {
          var statement,
              body = [],
              token,
              directive,
              firstRestricted;
          while (startIndex < length) {
            token = lookahead;
            if (token.type !== Token.StringLiteral) {
              break;
            }
            statement = parseStatementListItem();
            body.push(statement);
            if (statement.expression.type !== Syntax.Literal) {
              break;
            }
            directive = source.slice(token.start + 1, token.end - 1);
            if (directive === 'use strict') {
              strict = true;
              if (firstRestricted) {
                tolerateUnexpectedToken(firstRestricted, Messages.StrictOctalLiteral);
              }
            } else {
              if (!firstRestricted && token.octal) {
                firstRestricted = token;
              }
            }
          }
          while (startIndex < length) {
            statement = parseStatementListItem();
            if (typeof statement === 'undefined') {
              break;
            }
            body.push(statement);
          }
          return body;
        }
        function parseProgram() {
          var body,
              node;
          peek();
          node = new Node();
          strict = false;
          body = parseScriptBody();
          return node.finishProgram(body);
        }
        function filterTokenLocation() {
          var i,
              entry,
              token,
              tokens = [];
          for (i = 0; i < extra.tokens.length; ++i) {
            entry = extra.tokens[i];
            token = {
              type: entry.type,
              value: entry.value
            };
            if (entry.regex) {
              token.regex = {
                pattern: entry.regex.pattern,
                flags: entry.regex.flags
              };
            }
            if (extra.range) {
              token.range = entry.range;
            }
            if (extra.loc) {
              token.loc = entry.loc;
            }
            tokens.push(token);
          }
          extra.tokens = tokens;
        }
        function tokenize(code, options) {
          var toString,
              tokens;
          toString = String;
          if (typeof code !== 'string' && !(code instanceof String)) {
            code = toString(code);
          }
          source = code;
          index = 0;
          lineNumber = (source.length > 0) ? 1 : 0;
          lineStart = 0;
          startIndex = index;
          startLineNumber = lineNumber;
          startLineStart = lineStart;
          length = source.length;
          lookahead = null;
          state = {
            allowIn: true,
            labelSet: {},
            inFunctionBody: false,
            inIteration: false,
            inSwitch: false,
            lastCommentStart: -1
          };
          extra = {};
          options = options || {};
          options.tokens = true;
          extra.tokens = [];
          extra.tokenize = true;
          extra.openParenToken = -1;
          extra.openCurlyToken = -1;
          extra.range = (typeof options.range === 'boolean') && options.range;
          extra.loc = (typeof options.loc === 'boolean') && options.loc;
          if (typeof options.comment === 'boolean' && options.comment) {
            extra.comments = [];
          }
          if (typeof options.tolerant === 'boolean' && options.tolerant) {
            extra.errors = [];
          }
          try {
            peek();
            if (lookahead.type === Token.EOF) {
              return extra.tokens;
            }
            lex();
            while (lookahead.type !== Token.EOF) {
              try {
                lex();
              } catch (lexError) {
                if (extra.errors) {
                  recordError(lexError);
                  break;
                } else {
                  throw lexError;
                }
              }
            }
            filterTokenLocation();
            tokens = extra.tokens;
            if (typeof extra.comments !== 'undefined') {
              tokens.comments = extra.comments;
            }
            if (typeof extra.errors !== 'undefined') {
              tokens.errors = extra.errors;
            }
          } catch (e) {
            throw e;
          } finally {
            extra = {};
          }
          return tokens;
        }
        function parse(code, options) {
          var program,
              toString;
          toString = String;
          if (typeof code !== 'string' && !(code instanceof String)) {
            code = toString(code);
          }
          source = code;
          index = 0;
          lineNumber = (source.length > 0) ? 1 : 0;
          lineStart = 0;
          startIndex = index;
          startLineNumber = lineNumber;
          startLineStart = lineStart;
          length = source.length;
          lookahead = null;
          state = {
            allowIn: true,
            labelSet: {},
            inFunctionBody: false,
            inIteration: false,
            inSwitch: false,
            lastCommentStart: -1
          };
          extra = {};
          if (typeof options !== 'undefined') {
            extra.range = (typeof options.range === 'boolean') && options.range;
            extra.loc = (typeof options.loc === 'boolean') && options.loc;
            extra.attachComment = (typeof options.attachComment === 'boolean') && options.attachComment;
            if (extra.loc && options.source !== null && options.source !== undefined) {
              extra.source = toString(options.source);
            }
            if (typeof options.tokens === 'boolean' && options.tokens) {
              extra.tokens = [];
            }
            if (typeof options.comment === 'boolean' && options.comment) {
              extra.comments = [];
            }
            if (typeof options.tolerant === 'boolean' && options.tolerant) {
              extra.errors = [];
            }
            if (extra.attachComment) {
              extra.range = true;
              extra.comments = [];
              extra.bottomRightStack = [];
              extra.trailingComments = [];
              extra.leadingComments = [];
            }
          }
          try {
            program = parseProgram();
            if (typeof extra.comments !== 'undefined') {
              program.comments = extra.comments;
            }
            if (typeof extra.tokens !== 'undefined') {
              filterTokenLocation();
              program.tokens = extra.tokens;
            }
            if (typeof extra.errors !== 'undefined') {
              program.errors = extra.errors;
            }
          } catch (e) {
            throw e;
          } finally {
            extra = {};
          }
          return program;
        }
        exports.version = '2.1.0';
        exports.tokenize = tokenize;
        exports.parse = parse;
        exports.Syntax = (function() {
          var name,
              types = {};
          if (typeof Object.create === 'function') {
            types = Object.create(null);
          }
          for (name in Syntax) {
            if (Syntax.hasOwnProperty(name)) {
              types[name] = Syntax[name];
            }
          }
          if (typeof Object.freeze === 'function') {
            Object.freeze(types);
          }
          return types;
        }());
      }));
      define('esprimaAdapter', ['./esprima', 'env'], function(esprima, env) {
        if (env.get() === 'xpconnect' && typeof Reflect !== 'undefined') {
          return Reflect;
        } else {
          return esprima;
        }
      });
      define('uglifyjs/consolidator', ["require", "exports", "module", "./parse-js", "./process"], function(require, exports, module) {
        exports['ast_consolidate'] = function(oAbstractSyntaxTree) {
          'use strict';
          var _,
              TSourceElementsData = function() {
                this.nCategory = ESourceElementCategories.N_OTHER;
                this.aCount = [];
                this.aCount[EPrimaryExpressionCategories.N_IDENTIFIER_NAMES] = {};
                this.aCount[EPrimaryExpressionCategories.N_STRING_LITERALS] = {};
                this.aCount[EPrimaryExpressionCategories.N_NULL_AND_BOOLEAN_LITERALS] = {};
                this.aIdentifiers = [];
                this.aPrimitiveValues = [];
              },
              TPrimitiveValue = function() {
                this.nSaving = 0;
                this.sName = '';
              },
              TSolution = function() {
                this.oPrimitiveValues = {};
                this.nSavings = 0;
              },
              oProcessor = (require("./process")),
              oWeights = {
                N_PROPERTY_ACCESSOR: 1,
                N_VARIABLE_DECLARATION: 2,
                N_VARIABLE_STATEMENT_AFFIXATION: 4,
                N_CLOSURE: 17
              },
              EPrimaryExpressionCategories = {
                N_IDENTIFIER_NAMES: 0,
                N_STRING_LITERALS: 1,
                N_NULL_AND_BOOLEAN_LITERALS: 2
              },
              EValuePrefixes = {
                S_STRING: '#S',
                S_SYMBOLIC: '#O'
              },
              ESourceElementCategories = {
                N_WITH: 0,
                N_EVAL: 1,
                N_EXCLUDABLE: 2,
                N_OTHER: 3
              },
              A_OTHER_SUBSTITUTABLE_LITERALS = ['null', 'false', 'true'];
          (function fExamineSyntacticCodeUnit(oSyntacticCodeUnit) {
            var _,
                bIsGlobal = 'toplevel' === oSyntacticCodeUnit[0],
                bIsWhollyExaminable = !bIsGlobal,
                oSourceElements,
                oSourceElementData,
                oScope,
                oWalker,
                oWalkers = {
                  oSurveySourceElement: {
                    'defun': function(sIdentifier, aFormalParameterList, oFunctionBody) {
                      fClassifyAsExcludable();
                      fAddIdentifier(sIdentifier);
                      aFormalParameterList.forEach(fAddIdentifier);
                    },
                    'dot': function(oExpression, sIdentifierName) {
                      fCountPrimaryExpression(EPrimaryExpressionCategories.N_IDENTIFIER_NAMES, EValuePrefixes.S_STRING + sIdentifierName);
                      return ['dot', oWalker.walk(oExpression), sIdentifierName];
                    },
                    'function': function(sIdentifier, aFormalParameterList, oFunctionBody) {
                      if ('string' === typeof sIdentifier) {
                        fAddIdentifier(sIdentifier);
                      }
                      aFormalParameterList.forEach(fAddIdentifier);
                    },
                    'name': function(sIdentifier) {
                      if (-1 !== A_OTHER_SUBSTITUTABLE_LITERALS.indexOf(sIdentifier)) {
                        fCountPrimaryExpression(EPrimaryExpressionCategories.N_NULL_AND_BOOLEAN_LITERALS, EValuePrefixes.S_SYMBOLIC + sIdentifier);
                      } else {
                        if ('eval' === sIdentifier) {
                          oSourceElementData.nCategory = ESourceElementCategories.N_EVAL;
                        }
                        fAddIdentifier(sIdentifier);
                      }
                    },
                    'return': function(oExpression) {
                      fClassifyAsExcludable();
                    },
                    'string': function(sStringValue) {
                      if (sStringValue.length > 0) {
                        fCountPrimaryExpression(EPrimaryExpressionCategories.N_STRING_LITERALS, EValuePrefixes.S_STRING + sStringValue);
                      }
                    },
                    'try': function(oTry, aCatch, oFinally) {
                      if (Array.isArray(aCatch)) {
                        fAddIdentifier(aCatch[0]);
                      }
                    },
                    'var': function(aVariableDeclarationList) {
                      fClassifyAsExcludable();
                      aVariableDeclarationList.forEach(fAddVariable);
                    },
                    'with': function(oExpression, oStatement) {
                      oSourceElementData.nCategory = ESourceElementCategories.N_WITH;
                      return [];
                    }
                  },
                  oExamineFunctions: {
                    'defun': function() {
                      fExamineSyntacticCodeUnit(this);
                      return [];
                    },
                    'function': function() {
                      fExamineSyntacticCodeUnit(this);
                      return [];
                    }
                  }
                },
                aSourceElementsData = [],
                nAfterDirectivePrologue = 0,
                nPosition,
                nTo,
                cContext = function(oWalker, oSourceElement) {
                  var fLambda = function() {
                    return oWalker.walk(oSourceElement);
                  };
                  return fLambda;
                },
                fClassifyAsExcludable = function() {
                  if (oSourceElementData.nCategory === ESourceElementCategories.N_OTHER) {
                    oSourceElementData.nCategory = ESourceElementCategories.N_EXCLUDABLE;
                  }
                },
                fAddIdentifier = function(sIdentifier) {
                  if (-1 === oSourceElementData.aIdentifiers.indexOf(sIdentifier)) {
                    oSourceElementData.aIdentifiers.push(sIdentifier);
                  }
                },
                fAddVariable = function(aVariableDeclaration) {
                  fAddIdentifier(aVariableDeclaration[0]);
                },
                fCountPrimaryExpression = function(nCategory, sName) {
                  if (!oSourceElementData.aCount[nCategory].hasOwnProperty(sName)) {
                    oSourceElementData.aCount[nCategory][sName] = 0;
                    if (-1 === oSourceElementData.aPrimitiveValues.indexOf(sName)) {
                      oSourceElementData.aPrimitiveValues.push(sName);
                    }
                  }
                  oSourceElementData.aCount[nCategory][sName] += 1;
                },
                fExamineSourceElements = function(nFrom, nTo, bEnclose) {
                  var _,
                      nIndex = oScope.cname,
                      nPosition,
                      oWalkersTransformers = {
                        'dot': function(oExpression, sIdentifierName) {
                          var sPrefixed = EValuePrefixes.S_STRING + sIdentifierName;
                          return oSolutionBest.oPrimitiveValues.hasOwnProperty(sPrefixed) && oSolutionBest.oPrimitiveValues[sPrefixed].nSaving > 0 ? ['sub', oWalker.walk(oExpression), ['name', oSolutionBest.oPrimitiveValues[sPrefixed].sName]] : ['dot', oWalker.walk(oExpression), sIdentifierName];
                        },
                        'name': function(sIdentifier) {
                          var sPrefixed = EValuePrefixes.S_SYMBOLIC + sIdentifier;
                          return ['name', oSolutionBest.oPrimitiveValues.hasOwnProperty(sPrefixed) && oSolutionBest.oPrimitiveValues[sPrefixed].nSaving > 0 ? oSolutionBest.oPrimitiveValues[sPrefixed].sName : sIdentifier];
                        },
                        'string': function(sStringValue) {
                          var sPrefixed = EValuePrefixes.S_STRING + sStringValue;
                          return oSolutionBest.oPrimitiveValues.hasOwnProperty(sPrefixed) && oSolutionBest.oPrimitiveValues[sPrefixed].nSaving > 0 ? ['name', oSolutionBest.oPrimitiveValues[sPrefixed].sName] : ['string', sStringValue];
                        }
                      },
                      oSolutionBest = new TSolution(),
                      oSolutionCandidate = new TSolution(),
                      oSourceElementsData = new TSourceElementsData(),
                      aVariableDeclarations = [],
                      cAugmentList = function(aList) {
                        var fLambda = function(sPrefixed) {
                          if (-1 === aList.indexOf(sPrefixed)) {
                            aList.push(sPrefixed);
                          }
                        };
                        return fLambda;
                      },
                      cAddOccurrences = function(nPosition, nCategory) {
                        var fLambda = function(sPrefixed) {
                          if (!oSourceElementsData.aCount[nCategory].hasOwnProperty(sPrefixed)) {
                            oSourceElementsData.aCount[nCategory][sPrefixed] = 0;
                          }
                          oSourceElementsData.aCount[nCategory][sPrefixed] += aSourceElementsData[nPosition].aCount[nCategory][sPrefixed];
                        };
                        return fLambda;
                      },
                      cAddOccurrencesInCategory = function(nPosition) {
                        var fLambda = function(nCategory) {
                          Object.keys(aSourceElementsData[nPosition].aCount[nCategory]).forEach(cAddOccurrences(nPosition, nCategory));
                        };
                        return fLambda;
                      },
                      fAddOccurrences = function(nPosition) {
                        Object.keys(aSourceElementsData[nPosition].aCount).forEach(cAddOccurrencesInCategory(nPosition));
                      },
                      cAugmentVariableDeclarations = function(sPrefixed) {
                        if (oSolutionBest.oPrimitiveValues[sPrefixed].nSaving > 0) {
                          aVariableDeclarations.push([oSolutionBest.oPrimitiveValues[sPrefixed].sName, [0 === sPrefixed.indexOf(EValuePrefixes.S_SYMBOLIC) ? 'name' : 'string', sPrefixed.substring(EValuePrefixes.S_SYMBOLIC.length)]]);
                        }
                      },
                      cSortPrimitiveValues = function(sPrefixed0, sPrefixed1) {
                        var nDifference = oSolutionCandidate.oPrimitiveValues[sPrefixed0].nSaving - oSolutionCandidate.oPrimitiveValues[sPrefixed1].nSaving;
                        return nDifference > 0 ? -1 : nDifference < 0 ? 1 : 0;
                      },
                      fEvaluatePrimitiveValue = function(sPrefixed) {
                        var _,
                            nIndex,
                            sName = sPrefixed.substring(EValuePrefixes.S_SYMBOLIC.length),
                            nLengthOriginal = sName.length,
                            nLengthSubstitution,
                            nLengthString = oProcessor.make_string(sName).length;
                        oSolutionCandidate.oPrimitiveValues[sPrefixed] = new TPrimitiveValue();
                        do {
                          nIndex = oScope.cname;
                          oSolutionCandidate.oPrimitiveValues[sPrefixed].sName = oScope.next_mangled();
                        } while (-1 !== oSourceElementsData.aIdentifiers.indexOf(oSolutionCandidate.oPrimitiveValues[sPrefixed].sName));
                        nLengthSubstitution = oSolutionCandidate.oPrimitiveValues[sPrefixed].sName.length;
                        if (0 === sPrefixed.indexOf(EValuePrefixes.S_SYMBOLIC)) {
                          oSolutionCandidate.oPrimitiveValues[sPrefixed].nSaving -= nLengthSubstitution + nLengthOriginal + oWeights.N_VARIABLE_DECLARATION;
                          oSolutionCandidate.oPrimitiveValues[sPrefixed].nSaving += oSourceElementsData.aCount[EPrimaryExpressionCategories.N_NULL_AND_BOOLEAN_LITERALS][sPrefixed] * (nLengthOriginal - nLengthSubstitution);
                        } else {
                          oSolutionCandidate.oPrimitiveValues[sPrefixed].nSaving -= nLengthSubstitution + nLengthString + oWeights.N_VARIABLE_DECLARATION;
                          if (oSourceElementsData.aCount[EPrimaryExpressionCategories.N_IDENTIFIER_NAMES].hasOwnProperty(sPrefixed)) {
                            oSolutionCandidate.oPrimitiveValues[sPrefixed].nSaving += oSourceElementsData.aCount[EPrimaryExpressionCategories.N_IDENTIFIER_NAMES][sPrefixed] * (nLengthOriginal - nLengthSubstitution - oWeights.N_PROPERTY_ACCESSOR);
                          }
                          if (oSourceElementsData.aCount[EPrimaryExpressionCategories.N_STRING_LITERALS].hasOwnProperty(sPrefixed)) {
                            oSolutionCandidate.oPrimitiveValues[sPrefixed].nSaving += oSourceElementsData.aCount[EPrimaryExpressionCategories.N_STRING_LITERALS][sPrefixed] * (nLengthString - nLengthSubstitution);
                          }
                        }
                        if (oSolutionCandidate.oPrimitiveValues[sPrefixed].nSaving > 0) {
                          oSolutionCandidate.nSavings += oSolutionCandidate.oPrimitiveValues[sPrefixed].nSaving;
                        } else {
                          oScope.cname = nIndex;
                        }
                      },
                      cAddVariableDeclaration = function(aVariableDeclaration) {
                        (oSourceElements[nFrom][1]).unshift(aVariableDeclaration);
                      };
                  if (nFrom > nTo) {
                    return ;
                  }
                  if (nFrom === nTo && 'stat' === oSourceElements[nFrom][0] && 'call' === oSourceElements[nFrom][1][0] && 'function' === oSourceElements[nFrom][1][1][0]) {
                    fExamineSyntacticCodeUnit(oSourceElements[nFrom][1][1]);
                    return ;
                  }
                  for (nPosition = nFrom; nPosition <= nTo; nPosition += 1) {
                    aSourceElementsData[nPosition].aPrimitiveValues.forEach(cAugmentList(oSourceElementsData.aPrimitiveValues));
                  }
                  if (0 === oSourceElementsData.aPrimitiveValues.length) {
                    return ;
                  }
                  for (nPosition = nFrom; nPosition <= nTo; nPosition += 1) {
                    fAddOccurrences(nPosition);
                    aSourceElementsData[nPosition].aIdentifiers.forEach(cAugmentList(oSourceElementsData.aIdentifiers));
                  }
                  do {
                    oSolutionBest = oSolutionCandidate;
                    if (Object.keys(oSolutionCandidate.oPrimitiveValues).length > 0) {
                      oSourceElementsData.aPrimitiveValues.sort(cSortPrimitiveValues);
                    }
                    oSolutionCandidate = new TSolution();
                    oSourceElementsData.aPrimitiveValues.forEach(fEvaluatePrimitiveValue);
                    oScope.cname = nIndex;
                  } while (oSolutionCandidate.nSavings > oSolutionBest.nSavings);
                  if ('var' !== oSourceElements[nFrom][0]) {
                    oSolutionBest.nSavings -= oWeights.N_VARIABLE_STATEMENT_AFFIXATION;
                  }
                  if (bEnclose) {
                    oSolutionBest.nSavings -= oWeights.N_CLOSURE;
                  }
                  if (oSolutionBest.nSavings > 0) {
                    Object.keys(oSolutionBest.oPrimitiveValues).forEach(cAugmentVariableDeclarations);
                    for (nPosition = nFrom; nPosition <= nTo; nPosition += 1) {
                      oWalker = oProcessor.ast_walker();
                      oSourceElements[nPosition] = oWalker.with_walkers(oWalkersTransformers, cContext(oWalker, oSourceElements[nPosition]));
                    }
                    if ('var' === oSourceElements[nFrom][0]) {
                      (aVariableDeclarations.reverse()).forEach(cAddVariableDeclaration);
                    } else {
                      Array.prototype.splice.call(oSourceElements, nFrom, 0, ['var', aVariableDeclarations]);
                      nTo += 1;
                    }
                    if (bEnclose) {
                      Array.prototype.splice.call(oSourceElements, nFrom, 0, ['stat', ['call', ['function', null, [], []], []]]);
                      for (nPosition = nTo + 1; nPosition > nFrom; nPosition -= 1) {
                        Array.prototype.unshift.call(oSourceElements[nFrom][1][1][3], oSourceElements[nPosition]);
                      }
                      Array.prototype.splice.call(oSourceElements, nFrom + 1, nTo - nFrom + 1);
                    }
                  }
                  if (bEnclose) {
                    oScope.cname = nIndex;
                  }
                };
            oSourceElements = (oSyntacticCodeUnit[bIsGlobal ? 1 : 3]);
            if (0 === oSourceElements.length) {
              return ;
            }
            oScope = bIsGlobal ? oSyntacticCodeUnit.scope : oSourceElements.scope;
            while (nAfterDirectivePrologue < oSourceElements.length && 'directive' === oSourceElements[nAfterDirectivePrologue][0]) {
              nAfterDirectivePrologue += 1;
              aSourceElementsData.push(null);
            }
            if (oSourceElements.length === nAfterDirectivePrologue) {
              return ;
            }
            for (nPosition = nAfterDirectivePrologue; nPosition < oSourceElements.length; nPosition += 1) {
              oSourceElementData = new TSourceElementsData();
              oWalker = oProcessor.ast_walker();
              oWalker.with_walkers(oWalkers.oSurveySourceElement, cContext(oWalker, oSourceElements[nPosition]));
              bIsWhollyExaminable = bIsWhollyExaminable && ESourceElementCategories.N_WITH !== oSourceElementData.nCategory && ESourceElementCategories.N_EVAL !== oSourceElementData.nCategory;
              aSourceElementsData.push(oSourceElementData);
            }
            if (bIsWhollyExaminable) {
              fExamineSourceElements(nAfterDirectivePrologue, oSourceElements.length - 1, false);
            } else {
              for (nPosition = oSourceElements.length - 1; nPosition >= nAfterDirectivePrologue; nPosition -= 1) {
                oSourceElementData = (aSourceElementsData[nPosition]);
                if (ESourceElementCategories.N_OTHER === oSourceElementData.nCategory) {
                  if ('undefined' === typeof nTo) {
                    nTo = nPosition;
                  }
                  if (nPosition === nAfterDirectivePrologue) {
                    fExamineSourceElements(nPosition, nTo, true);
                  }
                } else {
                  if ('undefined' !== typeof nTo) {
                    fExamineSourceElements(nPosition + 1, nTo, true);
                    nTo = void 0;
                  }
                  oWalker = oProcessor.ast_walker();
                  oWalker.with_walkers(oWalkers.oExamineFunctions, cContext(oWalker, oSourceElements[nPosition]));
                }
              }
            }
          }(oAbstractSyntaxTree = oProcessor.ast_add_scope(oAbstractSyntaxTree)));
          return oAbstractSyntaxTree;
        };
      });
      define('uglifyjs/parse-js', ["exports"], function(exports) {
        var KEYWORDS = array_to_hash(["break", "case", "catch", "const", "continue", "debugger", "default", "delete", "do", "else", "finally", "for", "function", "if", "in", "instanceof", "new", "return", "switch", "throw", "try", "typeof", "var", "void", "while", "with"]);
        var RESERVED_WORDS = array_to_hash(["abstract", "boolean", "byte", "char", "class", "double", "enum", "export", "extends", "final", "float", "goto", "implements", "import", "int", "interface", "long", "native", "package", "private", "protected", "public", "short", "static", "super", "synchronized", "throws", "transient", "volatile"]);
        var KEYWORDS_BEFORE_EXPRESSION = array_to_hash(["return", "new", "delete", "throw", "else", "case"]);
        var KEYWORDS_ATOM = array_to_hash(["false", "null", "true", "undefined"]);
        var OPERATOR_CHARS = array_to_hash(characters("+-*&%=<>!?|~^"));
        var RE_HEX_NUMBER = /^0x[0-9a-f]+$/i;
        var RE_OCT_NUMBER = /^0[0-7]+$/;
        var RE_DEC_NUMBER = /^\d*\.?\d*(?:e[+-]?\d*(?:\d\.?|\.?\d)\d*)?$/i;
        var OPERATORS = array_to_hash(["in", "instanceof", "typeof", "new", "void", "delete", "++", "--", "+", "-", "!", "~", "&", "|", "^", "*", "/", "%", ">>", "<<", ">>>", "<", ">", "<=", ">=", "==", "===", "!=", "!==", "?", "=", "+=", "-=", "/=", "*=", "%=", ">>=", "<<=", ">>>=", "|=", "^=", "&=", "&&", "||"]);
        var WHITESPACE_CHARS = array_to_hash(characters(" \u00a0\n\r\t\f\u000b\u200b\u180e\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u202f\u205f\u3000\uFEFF"));
        var PUNC_BEFORE_EXPRESSION = array_to_hash(characters("[{(,.;:"));
        var PUNC_CHARS = array_to_hash(characters("[]{}(),;:"));
        var REGEXP_MODIFIERS = array_to_hash(characters("gmsiy"));
        var UNICODE = {
          letter: new RegExp("[\\u0041-\\u005A\\u0061-\\u007A\\u00AA\\u00B5\\u00BA\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02C1\\u02C6-\\u02D1\\u02E0-\\u02E4\\u02EC\\u02EE\\u0370-\\u0374\\u0376\\u0377\\u037A-\\u037D\\u0386\\u0388-\\u038A\\u038C\\u038E-\\u03A1\\u03A3-\\u03F5\\u03F7-\\u0481\\u048A-\\u0527\\u0531-\\u0556\\u0559\\u0561-\\u0587\\u05D0-\\u05EA\\u05F0-\\u05F2\\u0620-\\u064A\\u066E\\u066F\\u0671-\\u06D3\\u06D5\\u06E5\\u06E6\\u06EE\\u06EF\\u06FA-\\u06FC\\u06FF\\u0710\\u0712-\\u072F\\u074D-\\u07A5\\u07B1\\u07CA-\\u07EA\\u07F4\\u07F5\\u07FA\\u0800-\\u0815\\u081A\\u0824\\u0828\\u0840-\\u0858\\u08A0\\u08A2-\\u08AC\\u0904-\\u0939\\u093D\\u0950\\u0958-\\u0961\\u0971-\\u0977\\u0979-\\u097F\\u0985-\\u098C\\u098F\\u0990\\u0993-\\u09A8\\u09AA-\\u09B0\\u09B2\\u09B6-\\u09B9\\u09BD\\u09CE\\u09DC\\u09DD\\u09DF-\\u09E1\\u09F0\\u09F1\\u0A05-\\u0A0A\\u0A0F\\u0A10\\u0A13-\\u0A28\\u0A2A-\\u0A30\\u0A32\\u0A33\\u0A35\\u0A36\\u0A38\\u0A39\\u0A59-\\u0A5C\\u0A5E\\u0A72-\\u0A74\\u0A85-\\u0A8D\\u0A8F-\\u0A91\\u0A93-\\u0AA8\\u0AAA-\\u0AB0\\u0AB2\\u0AB3\\u0AB5-\\u0AB9\\u0ABD\\u0AD0\\u0AE0\\u0AE1\\u0B05-\\u0B0C\\u0B0F\\u0B10\\u0B13-\\u0B28\\u0B2A-\\u0B30\\u0B32\\u0B33\\u0B35-\\u0B39\\u0B3D\\u0B5C\\u0B5D\\u0B5F-\\u0B61\\u0B71\\u0B83\\u0B85-\\u0B8A\\u0B8E-\\u0B90\\u0B92-\\u0B95\\u0B99\\u0B9A\\u0B9C\\u0B9E\\u0B9F\\u0BA3\\u0BA4\\u0BA8-\\u0BAA\\u0BAE-\\u0BB9\\u0BD0\\u0C05-\\u0C0C\\u0C0E-\\u0C10\\u0C12-\\u0C28\\u0C2A-\\u0C33\\u0C35-\\u0C39\\u0C3D\\u0C58\\u0C59\\u0C60\\u0C61\\u0C85-\\u0C8C\\u0C8E-\\u0C90\\u0C92-\\u0CA8\\u0CAA-\\u0CB3\\u0CB5-\\u0CB9\\u0CBD\\u0CDE\\u0CE0\\u0CE1\\u0CF1\\u0CF2\\u0D05-\\u0D0C\\u0D0E-\\u0D10\\u0D12-\\u0D3A\\u0D3D\\u0D4E\\u0D60\\u0D61\\u0D7A-\\u0D7F\\u0D85-\\u0D96\\u0D9A-\\u0DB1\\u0DB3-\\u0DBB\\u0DBD\\u0DC0-\\u0DC6\\u0E01-\\u0E30\\u0E32\\u0E33\\u0E40-\\u0E46\\u0E81\\u0E82\\u0E84\\u0E87\\u0E88\\u0E8A\\u0E8D\\u0E94-\\u0E97\\u0E99-\\u0E9F\\u0EA1-\\u0EA3\\u0EA5\\u0EA7\\u0EAA\\u0EAB\\u0EAD-\\u0EB0\\u0EB2\\u0EB3\\u0EBD\\u0EC0-\\u0EC4\\u0EC6\\u0EDC-\\u0EDF\\u0F00\\u0F40-\\u0F47\\u0F49-\\u0F6C\\u0F88-\\u0F8C\\u1000-\\u102A\\u103F\\u1050-\\u1055\\u105A-\\u105D\\u1061\\u1065\\u1066\\u106E-\\u1070\\u1075-\\u1081\\u108E\\u10A0-\\u10C5\\u10C7\\u10CD\\u10D0-\\u10FA\\u10FC-\\u1248\\u124A-\\u124D\\u1250-\\u1256\\u1258\\u125A-\\u125D\\u1260-\\u1288\\u128A-\\u128D\\u1290-\\u12B0\\u12B2-\\u12B5\\u12B8-\\u12BE\\u12C0\\u12C2-\\u12C5\\u12C8-\\u12D6\\u12D8-\\u1310\\u1312-\\u1315\\u1318-\\u135A\\u1380-\\u138F\\u13A0-\\u13F4\\u1401-\\u166C\\u166F-\\u167F\\u1681-\\u169A\\u16A0-\\u16EA\\u16EE-\\u16F0\\u1700-\\u170C\\u170E-\\u1711\\u1720-\\u1731\\u1740-\\u1751\\u1760-\\u176C\\u176E-\\u1770\\u1780-\\u17B3\\u17D7\\u17DC\\u1820-\\u1877\\u1880-\\u18A8\\u18AA\\u18B0-\\u18F5\\u1900-\\u191C\\u1950-\\u196D\\u1970-\\u1974\\u1980-\\u19AB\\u19C1-\\u19C7\\u1A00-\\u1A16\\u1A20-\\u1A54\\u1AA7\\u1B05-\\u1B33\\u1B45-\\u1B4B\\u1B83-\\u1BA0\\u1BAE\\u1BAF\\u1BBA-\\u1BE5\\u1C00-\\u1C23\\u1C4D-\\u1C4F\\u1C5A-\\u1C7D\\u1CE9-\\u1CEC\\u1CEE-\\u1CF1\\u1CF5\\u1CF6\\u1D00-\\u1DBF\\u1E00-\\u1F15\\u1F18-\\u1F1D\\u1F20-\\u1F45\\u1F48-\\u1F4D\\u1F50-\\u1F57\\u1F59\\u1F5B\\u1F5D\\u1F5F-\\u1F7D\\u1F80-\\u1FB4\\u1FB6-\\u1FBC\\u1FBE\\u1FC2-\\u1FC4\\u1FC6-\\u1FCC\\u1FD0-\\u1FD3\\u1FD6-\\u1FDB\\u1FE0-\\u1FEC\\u1FF2-\\u1FF4\\u1FF6-\\u1FFC\\u2071\\u207F\\u2090-\\u209C\\u2102\\u2107\\u210A-\\u2113\\u2115\\u2119-\\u211D\\u2124\\u2126\\u2128\\u212A-\\u212D\\u212F-\\u2139\\u213C-\\u213F\\u2145-\\u2149\\u214E\\u2160-\\u2188\\u2C00-\\u2C2E\\u2C30-\\u2C5E\\u2C60-\\u2CE4\\u2CEB-\\u2CEE\\u2CF2\\u2CF3\\u2D00-\\u2D25\\u2D27\\u2D2D\\u2D30-\\u2D67\\u2D6F\\u2D80-\\u2D96\\u2DA0-\\u2DA6\\u2DA8-\\u2DAE\\u2DB0-\\u2DB6\\u2DB8-\\u2DBE\\u2DC0-\\u2DC6\\u2DC8-\\u2DCE\\u2DD0-\\u2DD6\\u2DD8-\\u2DDE\\u2E2F\\u3005-\\u3007\\u3021-\\u3029\\u3031-\\u3035\\u3038-\\u303C\\u3041-\\u3096\\u309D-\\u309F\\u30A1-\\u30FA\\u30FC-\\u30FF\\u3105-\\u312D\\u3131-\\u318E\\u31A0-\\u31BA\\u31F0-\\u31FF\\u3400-\\u4DB5\\u4E00-\\u9FCC\\uA000-\\uA48C\\uA4D0-\\uA4FD\\uA500-\\uA60C\\uA610-\\uA61F\\uA62A\\uA62B\\uA640-\\uA66E\\uA67F-\\uA697\\uA6A0-\\uA6EF\\uA717-\\uA71F\\uA722-\\uA788\\uA78B-\\uA78E\\uA790-\\uA793\\uA7A0-\\uA7AA\\uA7F8-\\uA801\\uA803-\\uA805\\uA807-\\uA80A\\uA80C-\\uA822\\uA840-\\uA873\\uA882-\\uA8B3\\uA8F2-\\uA8F7\\uA8FB\\uA90A-\\uA925\\uA930-\\uA946\\uA960-\\uA97C\\uA984-\\uA9B2\\uA9CF\\uAA00-\\uAA28\\uAA40-\\uAA42\\uAA44-\\uAA4B\\uAA60-\\uAA76\\uAA7A\\uAA80-\\uAAAF\\uAAB1\\uAAB5\\uAAB6\\uAAB9-\\uAABD\\uAAC0\\uAAC2\\uAADB-\\uAADD\\uAAE0-\\uAAEA\\uAAF2-\\uAAF4\\uAB01-\\uAB06\\uAB09-\\uAB0E\\uAB11-\\uAB16\\uAB20-\\uAB26\\uAB28-\\uAB2E\\uABC0-\\uABE2\\uAC00-\\uD7A3\\uD7B0-\\uD7C6\\uD7CB-\\uD7FB\\uF900-\\uFA6D\\uFA70-\\uFAD9\\uFB00-\\uFB06\\uFB13-\\uFB17\\uFB1D\\uFB1F-\\uFB28\\uFB2A-\\uFB36\\uFB38-\\uFB3C\\uFB3E\\uFB40\\uFB41\\uFB43\\uFB44\\uFB46-\\uFBB1\\uFBD3-\\uFD3D\\uFD50-\\uFD8F\\uFD92-\\uFDC7\\uFDF0-\\uFDFB\\uFE70-\\uFE74\\uFE76-\\uFEFC\\uFF21-\\uFF3A\\uFF41-\\uFF5A\\uFF66-\\uFFBE\\uFFC2-\\uFFC7\\uFFCA-\\uFFCF\\uFFD2-\\uFFD7\\uFFDA-\\uFFDC]"),
          combining_mark: new RegExp("[\\u0300-\\u036F\\u0483-\\u0487\\u0591-\\u05BD\\u05BF\\u05C1\\u05C2\\u05C4\\u05C5\\u05C7\\u0610-\\u061A\\u064B-\\u065F\\u0670\\u06D6-\\u06DC\\u06DF-\\u06E4\\u06E7\\u06E8\\u06EA-\\u06ED\\u0711\\u0730-\\u074A\\u07A6-\\u07B0\\u07EB-\\u07F3\\u0816-\\u0819\\u081B-\\u0823\\u0825-\\u0827\\u0829-\\u082D\\u0859-\\u085B\\u08E4-\\u08FE\\u0900-\\u0903\\u093A-\\u093C\\u093E-\\u094F\\u0951-\\u0957\\u0962\\u0963\\u0981-\\u0983\\u09BC\\u09BE-\\u09C4\\u09C7\\u09C8\\u09CB-\\u09CD\\u09D7\\u09E2\\u09E3\\u0A01-\\u0A03\\u0A3C\\u0A3E-\\u0A42\\u0A47\\u0A48\\u0A4B-\\u0A4D\\u0A51\\u0A70\\u0A71\\u0A75\\u0A81-\\u0A83\\u0ABC\\u0ABE-\\u0AC5\\u0AC7-\\u0AC9\\u0ACB-\\u0ACD\\u0AE2\\u0AE3\\u0B01-\\u0B03\\u0B3C\\u0B3E-\\u0B44\\u0B47\\u0B48\\u0B4B-\\u0B4D\\u0B56\\u0B57\\u0B62\\u0B63\\u0B82\\u0BBE-\\u0BC2\\u0BC6-\\u0BC8\\u0BCA-\\u0BCD\\u0BD7\\u0C01-\\u0C03\\u0C3E-\\u0C44\\u0C46-\\u0C48\\u0C4A-\\u0C4D\\u0C55\\u0C56\\u0C62\\u0C63\\u0C82\\u0C83\\u0CBC\\u0CBE-\\u0CC4\\u0CC6-\\u0CC8\\u0CCA-\\u0CCD\\u0CD5\\u0CD6\\u0CE2\\u0CE3\\u0D02\\u0D03\\u0D3E-\\u0D44\\u0D46-\\u0D48\\u0D4A-\\u0D4D\\u0D57\\u0D62\\u0D63\\u0D82\\u0D83\\u0DCA\\u0DCF-\\u0DD4\\u0DD6\\u0DD8-\\u0DDF\\u0DF2\\u0DF3\\u0E31\\u0E34-\\u0E3A\\u0E47-\\u0E4E\\u0EB1\\u0EB4-\\u0EB9\\u0EBB\\u0EBC\\u0EC8-\\u0ECD\\u0F18\\u0F19\\u0F35\\u0F37\\u0F39\\u0F3E\\u0F3F\\u0F71-\\u0F84\\u0F86\\u0F87\\u0F8D-\\u0F97\\u0F99-\\u0FBC\\u0FC6\\u102B-\\u103E\\u1056-\\u1059\\u105E-\\u1060\\u1062-\\u1064\\u1067-\\u106D\\u1071-\\u1074\\u1082-\\u108D\\u108F\\u109A-\\u109D\\u135D-\\u135F\\u1712-\\u1714\\u1732-\\u1734\\u1752\\u1753\\u1772\\u1773\\u17B4-\\u17D3\\u17DD\\u180B-\\u180D\\u18A9\\u1920-\\u192B\\u1930-\\u193B\\u19B0-\\u19C0\\u19C8\\u19C9\\u1A17-\\u1A1B\\u1A55-\\u1A5E\\u1A60-\\u1A7C\\u1A7F\\u1B00-\\u1B04\\u1B34-\\u1B44\\u1B6B-\\u1B73\\u1B80-\\u1B82\\u1BA1-\\u1BAD\\u1BE6-\\u1BF3\\u1C24-\\u1C37\\u1CD0-\\u1CD2\\u1CD4-\\u1CE8\\u1CED\\u1CF2-\\u1CF4\\u1DC0-\\u1DE6\\u1DFC-\\u1DFF\\u20D0-\\u20DC\\u20E1\\u20E5-\\u20F0\\u2CEF-\\u2CF1\\u2D7F\\u2DE0-\\u2DFF\\u302A-\\u302F\\u3099\\u309A\\uA66F\\uA674-\\uA67D\\uA69F\\uA6F0\\uA6F1\\uA802\\uA806\\uA80B\\uA823-\\uA827\\uA880\\uA881\\uA8B4-\\uA8C4\\uA8E0-\\uA8F1\\uA926-\\uA92D\\uA947-\\uA953\\uA980-\\uA983\\uA9B3-\\uA9C0\\uAA29-\\uAA36\\uAA43\\uAA4C\\uAA4D\\uAA7B\\uAAB0\\uAAB2-\\uAAB4\\uAAB7\\uAAB8\\uAABE\\uAABF\\uAAC1\\uAAEB-\\uAAEF\\uAAF5\\uAAF6\\uABE3-\\uABEA\\uABEC\\uABED\\uFB1E\\uFE00-\\uFE0F\\uFE20-\\uFE26]"),
          connector_punctuation: new RegExp("[\\u005F\\u203F\\u2040\\u2054\\uFE33\\uFE34\\uFE4D-\\uFE4F\\uFF3F]"),
          digit: new RegExp("[\\u0030-\\u0039\\u0660-\\u0669\\u06F0-\\u06F9\\u07C0-\\u07C9\\u0966-\\u096F\\u09E6-\\u09EF\\u0A66-\\u0A6F\\u0AE6-\\u0AEF\\u0B66-\\u0B6F\\u0BE6-\\u0BEF\\u0C66-\\u0C6F\\u0CE6-\\u0CEF\\u0D66-\\u0D6F\\u0E50-\\u0E59\\u0ED0-\\u0ED9\\u0F20-\\u0F29\\u1040-\\u1049\\u1090-\\u1099\\u17E0-\\u17E9\\u1810-\\u1819\\u1946-\\u194F\\u19D0-\\u19D9\\u1A80-\\u1A89\\u1A90-\\u1A99\\u1B50-\\u1B59\\u1BB0-\\u1BB9\\u1C40-\\u1C49\\u1C50-\\u1C59\\uA620-\\uA629\\uA8D0-\\uA8D9\\uA900-\\uA909\\uA9D0-\\uA9D9\\uAA50-\\uAA59\\uABF0-\\uABF9\\uFF10-\\uFF19]")
        };
        function is_letter(ch) {
          return UNICODE.letter.test(ch);
        }
        ;
        function is_digit(ch) {
          ch = ch.charCodeAt(0);
          return ch >= 48 && ch <= 57;
        }
        ;
        function is_unicode_digit(ch) {
          return UNICODE.digit.test(ch);
        }
        function is_alphanumeric_char(ch) {
          return is_digit(ch) || is_letter(ch);
        }
        ;
        function is_unicode_combining_mark(ch) {
          return UNICODE.combining_mark.test(ch);
        }
        ;
        function is_unicode_connector_punctuation(ch) {
          return UNICODE.connector_punctuation.test(ch);
        }
        ;
        function is_identifier_start(ch) {
          return ch == "$" || ch == "_" || is_letter(ch);
        }
        ;
        function is_identifier_char(ch) {
          return is_identifier_start(ch) || is_unicode_combining_mark(ch) || is_unicode_digit(ch) || is_unicode_connector_punctuation(ch) || ch == "\u200c" || ch == "\u200d";
          ;
        }
        ;
        function parse_js_number(num) {
          if (RE_HEX_NUMBER.test(num)) {
            return parseInt(num.substr(2), 16);
          } else if (RE_OCT_NUMBER.test(num)) {
            return parseInt(num.substr(1), 8);
          } else if (RE_DEC_NUMBER.test(num)) {
            return parseFloat(num);
          }
        }
        ;
        function JS_Parse_Error(message, line, col, pos) {
          this.message = message;
          this.line = line + 1;
          this.col = col + 1;
          this.pos = pos + 1;
          this.stack = new Error().stack;
        }
        ;
        JS_Parse_Error.prototype.toString = function() {
          return this.message + " (line: " + this.line + ", col: " + this.col + ", pos: " + this.pos + ")" + "\n\n" + this.stack;
        };
        function js_error(message, line, col, pos) {
          throw new JS_Parse_Error(message, line, col, pos);
        }
        ;
        function is_token(token, type, val) {
          return token.type == type && (val == null || token.value == val);
        }
        ;
        var EX_EOF = {};
        function tokenizer($TEXT) {
          var S = {
            text: $TEXT.replace(/\r\n?|[\n\u2028\u2029]/g, "\n").replace(/^\uFEFF/, ''),
            pos: 0,
            tokpos: 0,
            line: 0,
            tokline: 0,
            col: 0,
            tokcol: 0,
            newline_before: false,
            regex_allowed: false,
            comments_before: []
          };
          function peek() {
            return S.text.charAt(S.pos);
          }
          ;
          function next(signal_eof, in_string) {
            var ch = S.text.charAt(S.pos++);
            if (signal_eof && !ch)
              throw EX_EOF;
            if (ch == "\n") {
              S.newline_before = S.newline_before || !in_string;
              ++S.line;
              S.col = 0;
            } else {
              ++S.col;
            }
            return ch;
          }
          ;
          function eof() {
            return !S.peek();
          }
          ;
          function find(what, signal_eof) {
            var pos = S.text.indexOf(what, S.pos);
            if (signal_eof && pos == -1)
              throw EX_EOF;
            return pos;
          }
          ;
          function start_token() {
            S.tokline = S.line;
            S.tokcol = S.col;
            S.tokpos = S.pos;
          }
          ;
          function token(type, value, is_comment) {
            S.regex_allowed = ((type == "operator" && !HOP(UNARY_POSTFIX, value)) || (type == "keyword" && HOP(KEYWORDS_BEFORE_EXPRESSION, value)) || (type == "punc" && HOP(PUNC_BEFORE_EXPRESSION, value)));
            var ret = {
              type: type,
              value: value,
              line: S.tokline,
              col: S.tokcol,
              pos: S.tokpos,
              endpos: S.pos,
              nlb: S.newline_before
            };
            if (!is_comment) {
              ret.comments_before = S.comments_before;
              S.comments_before = [];
              for (var i = 0,
                  len = ret.comments_before.length; i < len; i++) {
                ret.nlb = ret.nlb || ret.comments_before[i].nlb;
              }
            }
            S.newline_before = false;
            return ret;
          }
          ;
          function skip_whitespace() {
            while (HOP(WHITESPACE_CHARS, peek()))
              next();
          }
          ;
          function read_while(pred) {
            var ret = "",
                ch = peek(),
                i = 0;
            while (ch && pred(ch, i++)) {
              ret += next();
              ch = peek();
            }
            return ret;
          }
          ;
          function parse_error(err) {
            js_error(err, S.tokline, S.tokcol, S.tokpos);
          }
          ;
          function read_num(prefix) {
            var has_e = false,
                after_e = false,
                has_x = false,
                has_dot = prefix == ".";
            var num = read_while(function(ch, i) {
              if (ch == "x" || ch == "X") {
                if (has_x)
                  return false;
                return has_x = true;
              }
              if (!has_x && (ch == "E" || ch == "e")) {
                if (has_e)
                  return false;
                return has_e = after_e = true;
              }
              if (ch == "-") {
                if (after_e || (i == 0 && !prefix))
                  return true;
                return false;
              }
              if (ch == "+")
                return after_e;
              after_e = false;
              if (ch == ".") {
                if (!has_dot && !has_x && !has_e)
                  return has_dot = true;
                return false;
              }
              return is_alphanumeric_char(ch);
            });
            if (prefix)
              num = prefix + num;
            var valid = parse_js_number(num);
            if (!isNaN(valid)) {
              return token("num", valid);
            } else {
              parse_error("Invalid syntax: " + num);
            }
          }
          ;
          function read_escaped_char(in_string) {
            var ch = next(true, in_string);
            switch (ch) {
              case "n":
                return "\n";
              case "r":
                return "\r";
              case "t":
                return "\t";
              case "b":
                return "\b";
              case "v":
                return "\u000b";
              case "f":
                return "\f";
              case "0":
                return "\0";
              case "x":
                return String.fromCharCode(hex_bytes(2));
              case "u":
                return String.fromCharCode(hex_bytes(4));
              case "\n":
                return "";
              default:
                return ch;
            }
          }
          ;
          function hex_bytes(n) {
            var num = 0;
            for (; n > 0; --n) {
              var digit = parseInt(next(true), 16);
              if (isNaN(digit))
                parse_error("Invalid hex-character pattern in string");
              num = (num << 4) | digit;
            }
            return num;
          }
          ;
          function read_string() {
            return with_eof_error("Unterminated string constant", function() {
              var quote = next(),
                  ret = "";
              for (; ; ) {
                var ch = next(true);
                if (ch == "\\") {
                  var octal_len = 0,
                      first = null;
                  ch = read_while(function(ch) {
                    if (ch >= "0" && ch <= "7") {
                      if (!first) {
                        first = ch;
                        return ++octal_len;
                      } else if (first <= "3" && octal_len <= 2)
                        return ++octal_len;
                      else if (first >= "4" && octal_len <= 1)
                        return ++octal_len;
                    }
                    return false;
                  });
                  if (octal_len > 0)
                    ch = String.fromCharCode(parseInt(ch, 8));
                  else
                    ch = read_escaped_char(true);
                } else if (ch == quote)
                  break;
                else if (ch == "\n")
                  throw EX_EOF;
                ret += ch;
              }
              return token("string", ret);
            });
          }
          ;
          function read_line_comment() {
            next();
            var i = find("\n"),
                ret;
            if (i == -1) {
              ret = S.text.substr(S.pos);
              S.pos = S.text.length;
            } else {
              ret = S.text.substring(S.pos, i);
              S.pos = i;
            }
            return token("comment1", ret, true);
          }
          ;
          function read_multiline_comment() {
            next();
            return with_eof_error("Unterminated multiline comment", function() {
              var i = find("*/", true),
                  text = S.text.substring(S.pos, i);
              S.pos = i + 2;
              S.line += text.split("\n").length - 1;
              S.newline_before = S.newline_before || text.indexOf("\n") >= 0;
              if (/^@cc_on/i.test(text)) {
                warn("WARNING: at line " + S.line);
                warn("*** Found \"conditional comment\": " + text);
                warn("*** UglifyJS DISCARDS ALL COMMENTS.  This means your code might no longer work properly in Internet Explorer.");
              }
              return token("comment2", text, true);
            });
          }
          ;
          function read_name() {
            var backslash = false,
                name = "",
                ch,
                escaped = false,
                hex;
            while ((ch = peek()) != null) {
              if (!backslash) {
                if (ch == "\\")
                  escaped = backslash = true, next();
                else if (is_identifier_char(ch))
                  name += next();
                else
                  break;
              } else {
                if (ch != "u")
                  parse_error("Expecting UnicodeEscapeSequence -- uXXXX");
                ch = read_escaped_char();
                if (!is_identifier_char(ch))
                  parse_error("Unicode char: " + ch.charCodeAt(0) + " is not valid in identifier");
                name += ch;
                backslash = false;
              }
            }
            if (HOP(KEYWORDS, name) && escaped) {
              hex = name.charCodeAt(0).toString(16).toUpperCase();
              name = "\\u" + "0000".substr(hex.length) + hex + name.slice(1);
            }
            return name;
          }
          ;
          function read_regexp(regexp) {
            return with_eof_error("Unterminated regular expression", function() {
              var prev_backslash = false,
                  ch,
                  in_class = false;
              while ((ch = next(true)))
                if (prev_backslash) {
                  regexp += "\\" + ch;
                  prev_backslash = false;
                } else if (ch == "[") {
                  in_class = true;
                  regexp += ch;
                } else if (ch == "]" && in_class) {
                  in_class = false;
                  regexp += ch;
                } else if (ch == "/" && !in_class) {
                  break;
                } else if (ch == "\\") {
                  prev_backslash = true;
                } else {
                  regexp += ch;
                }
              var mods = read_name();
              return token("regexp", [regexp, mods]);
            });
          }
          ;
          function read_operator(prefix) {
            function grow(op) {
              if (!peek())
                return op;
              var bigger = op + peek();
              if (HOP(OPERATORS, bigger)) {
                next();
                return grow(bigger);
              } else {
                return op;
              }
            }
            ;
            return token("operator", grow(prefix || next()));
          }
          ;
          function handle_slash() {
            next();
            var regex_allowed = S.regex_allowed;
            switch (peek()) {
              case "/":
                S.comments_before.push(read_line_comment());
                S.regex_allowed = regex_allowed;
                return next_token();
              case "*":
                S.comments_before.push(read_multiline_comment());
                S.regex_allowed = regex_allowed;
                return next_token();
            }
            return S.regex_allowed ? read_regexp("") : read_operator("/");
          }
          ;
          function handle_dot() {
            next();
            return is_digit(peek()) ? read_num(".") : token("punc", ".");
          }
          ;
          function read_word() {
            var word = read_name();
            return !HOP(KEYWORDS, word) ? token("name", word) : HOP(OPERATORS, word) ? token("operator", word) : HOP(KEYWORDS_ATOM, word) ? token("atom", word) : token("keyword", word);
          }
          ;
          function with_eof_error(eof_error, cont) {
            try {
              return cont();
            } catch (ex) {
              if (ex === EX_EOF)
                parse_error(eof_error);
              else
                throw ex;
            }
          }
          ;
          function next_token(force_regexp) {
            if (force_regexp != null)
              return read_regexp(force_regexp);
            skip_whitespace();
            start_token();
            var ch = peek();
            if (!ch)
              return token("eof");
            if (is_digit(ch))
              return read_num();
            if (ch == '"' || ch == "'")
              return read_string();
            if (HOP(PUNC_CHARS, ch))
              return token("punc", next());
            if (ch == ".")
              return handle_dot();
            if (ch == "/")
              return handle_slash();
            if (HOP(OPERATOR_CHARS, ch))
              return read_operator();
            if (ch == "\\" || is_identifier_start(ch))
              return read_word();
            parse_error("Unexpected character '" + ch + "'");
          }
          ;
          next_token.context = function(nc) {
            if (nc)
              S = nc;
            return S;
          };
          return next_token;
        }
        ;
        var UNARY_PREFIX = array_to_hash(["typeof", "void", "delete", "--", "++", "!", "~", "-", "+"]);
        var UNARY_POSTFIX = array_to_hash(["--", "++"]);
        var ASSIGNMENT = (function(a, ret, i) {
          while (i < a.length) {
            ret[a[i]] = a[i].substr(0, a[i].length - 1);
            i++;
          }
          return ret;
        })(["+=", "-=", "/=", "*=", "%=", ">>=", "<<=", ">>>=", "|=", "^=", "&="], {"=": true}, 0);
        var PRECEDENCE = (function(a, ret) {
          for (var i = 0,
              n = 1; i < a.length; ++i, ++n) {
            var b = a[i];
            for (var j = 0; j < b.length; ++j) {
              ret[b[j]] = n;
            }
          }
          return ret;
        })([["||"], ["&&"], ["|"], ["^"], ["&"], ["==", "===", "!=", "!=="], ["<", ">", "<=", ">=", "in", "instanceof"], [">>", "<<", ">>>"], ["+", "-"], ["*", "/", "%"]], {});
        var STATEMENTS_WITH_LABELS = array_to_hash(["for", "do", "while", "switch"]);
        var ATOMIC_START_TOKEN = array_to_hash(["atom", "num", "string", "regexp", "name"]);
        function NodeWithToken(str, start, end) {
          this.name = str;
          this.start = start;
          this.end = end;
        }
        ;
        NodeWithToken.prototype.toString = function() {
          return this.name;
        };
        function parse($TEXT, exigent_mode, embed_tokens) {
          var S = {
            input: typeof $TEXT == "string" ? tokenizer($TEXT, true) : $TEXT,
            token: null,
            prev: null,
            peeked: null,
            in_function: 0,
            in_directives: true,
            in_loop: 0,
            labels: []
          };
          S.token = next();
          function is(type, value) {
            return is_token(S.token, type, value);
          }
          ;
          function peek() {
            return S.peeked || (S.peeked = S.input());
          }
          ;
          function next() {
            S.prev = S.token;
            if (S.peeked) {
              S.token = S.peeked;
              S.peeked = null;
            } else {
              S.token = S.input();
            }
            S.in_directives = S.in_directives && (S.token.type == "string" || is("punc", ";"));
            return S.token;
          }
          ;
          function prev() {
            return S.prev;
          }
          ;
          function croak(msg, line, col, pos) {
            var ctx = S.input.context();
            js_error(msg, line != null ? line : ctx.tokline, col != null ? col : ctx.tokcol, pos != null ? pos : ctx.tokpos);
          }
          ;
          function token_error(token, msg) {
            croak(msg, token.line, token.col);
          }
          ;
          function unexpected(token) {
            if (token == null)
              token = S.token;
            token_error(token, "Unexpected token: " + token.type + " (" + token.value + ")");
          }
          ;
          function expect_token(type, val) {
            if (is(type, val)) {
              return next();
            }
            token_error(S.token, "Unexpected token " + S.token.type + ", expected " + type);
          }
          ;
          function expect(punc) {
            return expect_token("punc", punc);
          }
          ;
          function can_insert_semicolon() {
            return !exigent_mode && (S.token.nlb || is("eof") || is("punc", "}"));
          }
          ;
          function semicolon() {
            if (is("punc", ";"))
              next();
            else if (!can_insert_semicolon())
              unexpected();
          }
          ;
          function as() {
            return slice(arguments);
          }
          ;
          function parenthesised() {
            expect("(");
            var ex = expression();
            expect(")");
            return ex;
          }
          ;
          function add_tokens(str, start, end) {
            return str instanceof NodeWithToken ? str : new NodeWithToken(str, start, end);
          }
          ;
          function maybe_embed_tokens(parser) {
            if (embed_tokens)
              return function() {
                var start = S.token;
                var ast = parser.apply(this, arguments);
                ast[0] = add_tokens(ast[0], start, prev());
                return ast;
              };
            else
              return parser;
          }
          ;
          var statement = maybe_embed_tokens(function() {
            if (is("operator", "/") || is("operator", "/=")) {
              S.peeked = null;
              S.token = S.input(S.token.value.substr(1));
            }
            switch (S.token.type) {
              case "string":
                var dir = S.in_directives,
                    stat = simple_statement();
                if (dir && stat[1][0] == "string" && !is("punc", ","))
                  return as("directive", stat[1][1]);
                return stat;
              case "num":
              case "regexp":
              case "operator":
              case "atom":
                return simple_statement();
              case "name":
                return is_token(peek(), "punc", ":") ? labeled_statement(prog1(S.token.value, next, next)) : simple_statement();
              case "punc":
                switch (S.token.value) {
                  case "{":
                    return as("block", block_());
                  case "[":
                  case "(":
                    return simple_statement();
                  case ";":
                    next();
                    return as("block");
                  default:
                    unexpected();
                }
              case "keyword":
                switch (prog1(S.token.value, next)) {
                  case "break":
                    return break_cont("break");
                  case "continue":
                    return break_cont("continue");
                  case "debugger":
                    semicolon();
                    return as("debugger");
                  case "do":
                    return (function(body) {
                      expect_token("keyword", "while");
                      return as("do", prog1(parenthesised, semicolon), body);
                    })(in_loop(statement));
                  case "for":
                    return for_();
                  case "function":
                    return function_(true);
                  case "if":
                    return if_();
                  case "return":
                    if (S.in_function == 0)
                      croak("'return' outside of function");
                    return as("return", is("punc", ";") ? (next(), null) : can_insert_semicolon() ? null : prog1(expression, semicolon));
                  case "switch":
                    return as("switch", parenthesised(), switch_block_());
                  case "throw":
                    if (S.token.nlb)
                      croak("Illegal newline after 'throw'");
                    return as("throw", prog1(expression, semicolon));
                  case "try":
                    return try_();
                  case "var":
                    return prog1(var_, semicolon);
                  case "const":
                    return prog1(const_, semicolon);
                  case "while":
                    return as("while", parenthesised(), in_loop(statement));
                  case "with":
                    return as("with", parenthesised(), statement());
                  default:
                    unexpected();
                }
            }
          });
          function labeled_statement(label) {
            S.labels.push(label);
            var start = S.token,
                stat = statement();
            if (exigent_mode && !HOP(STATEMENTS_WITH_LABELS, stat[0]))
              unexpected(start);
            S.labels.pop();
            return as("label", label, stat);
          }
          ;
          function simple_statement() {
            return as("stat", prog1(expression, semicolon));
          }
          ;
          function break_cont(type) {
            var name;
            if (!can_insert_semicolon()) {
              name = is("name") ? S.token.value : null;
            }
            if (name != null) {
              next();
              if (!member(name, S.labels))
                croak("Label " + name + " without matching loop or statement");
            } else if (S.in_loop == 0)
              croak(type + " not inside a loop or switch");
            semicolon();
            return as(type, name);
          }
          ;
          function for_() {
            expect("(");
            var init = null;
            if (!is("punc", ";")) {
              init = is("keyword", "var") ? (next(), var_(true)) : expression(true, true);
              if (is("operator", "in")) {
                if (init[0] == "var" && init[1].length > 1)
                  croak("Only one variable declaration allowed in for..in loop");
                return for_in(init);
              }
            }
            return regular_for(init);
          }
          ;
          function regular_for(init) {
            expect(";");
            var test = is("punc", ";") ? null : expression();
            expect(";");
            var step = is("punc", ")") ? null : expression();
            expect(")");
            return as("for", init, test, step, in_loop(statement));
          }
          ;
          function for_in(init) {
            var lhs = init[0] == "var" ? as("name", init[1][0]) : init;
            next();
            var obj = expression();
            expect(")");
            return as("for-in", init, lhs, obj, in_loop(statement));
          }
          ;
          var function_ = function(in_statement) {
            var name = is("name") ? prog1(S.token.value, next) : null;
            if (in_statement && !name)
              unexpected();
            expect("(");
            return as(in_statement ? "defun" : "function", name, (function(first, a) {
              while (!is("punc", ")")) {
                if (first)
                  first = false;
                else
                  expect(",");
                if (!is("name"))
                  unexpected();
                a.push(S.token.value);
                next();
              }
              next();
              return a;
            })(true, []), (function() {
              ++S.in_function;
              var loop = S.in_loop;
              S.in_directives = true;
              S.in_loop = 0;
              var a = block_();
              --S.in_function;
              S.in_loop = loop;
              return a;
            })());
          };
          function if_() {
            var cond = parenthesised(),
                body = statement(),
                belse;
            if (is("keyword", "else")) {
              next();
              belse = statement();
            }
            return as("if", cond, body, belse);
          }
          ;
          function block_() {
            expect("{");
            var a = [];
            while (!is("punc", "}")) {
              if (is("eof"))
                unexpected();
              a.push(statement());
            }
            next();
            return a;
          }
          ;
          var switch_block_ = curry(in_loop, function() {
            expect("{");
            var a = [],
                cur = null;
            while (!is("punc", "}")) {
              if (is("eof"))
                unexpected();
              if (is("keyword", "case")) {
                next();
                cur = [];
                a.push([expression(), cur]);
                expect(":");
              } else if (is("keyword", "default")) {
                next();
                expect(":");
                cur = [];
                a.push([null, cur]);
              } else {
                if (!cur)
                  unexpected();
                cur.push(statement());
              }
            }
            next();
            return a;
          });
          function try_() {
            var body = block_(),
                bcatch,
                bfinally;
            if (is("keyword", "catch")) {
              next();
              expect("(");
              if (!is("name"))
                croak("Name expected");
              var name = S.token.value;
              next();
              expect(")");
              bcatch = [name, block_()];
            }
            if (is("keyword", "finally")) {
              next();
              bfinally = block_();
            }
            if (!bcatch && !bfinally)
              croak("Missing catch/finally blocks");
            return as("try", body, bcatch, bfinally);
          }
          ;
          function vardefs(no_in) {
            var a = [];
            for (; ; ) {
              if (!is("name"))
                unexpected();
              var name = S.token.value;
              next();
              if (is("operator", "=")) {
                next();
                a.push([name, expression(false, no_in)]);
              } else {
                a.push([name]);
              }
              if (!is("punc", ","))
                break;
              next();
            }
            return a;
          }
          ;
          function var_(no_in) {
            return as("var", vardefs(no_in));
          }
          ;
          function const_() {
            return as("const", vardefs());
          }
          ;
          function new_() {
            var newexp = expr_atom(false),
                args;
            if (is("punc", "(")) {
              next();
              args = expr_list(")");
            } else {
              args = [];
            }
            return subscripts(as("new", newexp, args), true);
          }
          ;
          var expr_atom = maybe_embed_tokens(function(allow_calls) {
            if (is("operator", "new")) {
              next();
              return new_();
            }
            if (is("punc")) {
              switch (S.token.value) {
                case "(":
                  next();
                  return subscripts(prog1(expression, curry(expect, ")")), allow_calls);
                case "[":
                  next();
                  return subscripts(array_(), allow_calls);
                case "{":
                  next();
                  return subscripts(object_(), allow_calls);
              }
              unexpected();
            }
            if (is("keyword", "function")) {
              next();
              return subscripts(function_(false), allow_calls);
            }
            if (HOP(ATOMIC_START_TOKEN, S.token.type)) {
              var atom = S.token.type == "regexp" ? as("regexp", S.token.value[0], S.token.value[1]) : as(S.token.type, S.token.value);
              return subscripts(prog1(atom, next), allow_calls);
            }
            unexpected();
          });
          function expr_list(closing, allow_trailing_comma, allow_empty) {
            var first = true,
                a = [];
            while (!is("punc", closing)) {
              if (first)
                first = false;
              else
                expect(",");
              if (allow_trailing_comma && is("punc", closing))
                break;
              if (is("punc", ",") && allow_empty) {
                a.push(["atom", "undefined"]);
              } else {
                a.push(expression(false));
              }
            }
            next();
            return a;
          }
          ;
          function array_() {
            return as("array", expr_list("]", !exigent_mode, true));
          }
          ;
          function object_() {
            var first = true,
                a = [];
            while (!is("punc", "}")) {
              if (first)
                first = false;
              else
                expect(",");
              if (!exigent_mode && is("punc", "}"))
                break;
              var type = S.token.type;
              var name = as_property_name();
              if (type == "name" && (name == "get" || name == "set") && !is("punc", ":")) {
                a.push([as_name(), function_(false), name]);
              } else {
                expect(":");
                a.push([name, expression(false)]);
              }
            }
            next();
            return as("object", a);
          }
          ;
          function as_property_name() {
            switch (S.token.type) {
              case "num":
              case "string":
                return prog1(S.token.value, next);
            }
            return as_name();
          }
          ;
          function as_name() {
            switch (S.token.type) {
              case "name":
              case "operator":
              case "keyword":
              case "atom":
                return prog1(S.token.value, next);
              default:
                unexpected();
            }
          }
          ;
          function subscripts(expr, allow_calls) {
            if (is("punc", ".")) {
              next();
              return subscripts(as("dot", expr, as_name()), allow_calls);
            }
            if (is("punc", "[")) {
              next();
              return subscripts(as("sub", expr, prog1(expression, curry(expect, "]"))), allow_calls);
            }
            if (allow_calls && is("punc", "(")) {
              next();
              return subscripts(as("call", expr, expr_list(")")), true);
            }
            return expr;
          }
          ;
          function maybe_unary(allow_calls) {
            if (is("operator") && HOP(UNARY_PREFIX, S.token.value)) {
              return make_unary("unary-prefix", prog1(S.token.value, next), maybe_unary(allow_calls));
            }
            var val = expr_atom(allow_calls);
            while (is("operator") && HOP(UNARY_POSTFIX, S.token.value) && !S.token.nlb) {
              val = make_unary("unary-postfix", S.token.value, val);
              next();
            }
            return val;
          }
          ;
          function make_unary(tag, op, expr) {
            if ((op == "++" || op == "--") && !is_assignable(expr))
              croak("Invalid use of " + op + " operator");
            return as(tag, op, expr);
          }
          ;
          function expr_op(left, min_prec, no_in) {
            var op = is("operator") ? S.token.value : null;
            if (op && op == "in" && no_in)
              op = null;
            var prec = op != null ? PRECEDENCE[op] : null;
            if (prec != null && prec > min_prec) {
              next();
              var right = expr_op(maybe_unary(true), prec, no_in);
              return expr_op(as("binary", op, left, right), min_prec, no_in);
            }
            return left;
          }
          ;
          function expr_ops(no_in) {
            return expr_op(maybe_unary(true), 0, no_in);
          }
          ;
          function maybe_conditional(no_in) {
            var expr = expr_ops(no_in);
            if (is("operator", "?")) {
              next();
              var yes = expression(false);
              expect(":");
              return as("conditional", expr, yes, expression(false, no_in));
            }
            return expr;
          }
          ;
          function is_assignable(expr) {
            if (!exigent_mode)
              return true;
            switch (expr[0] + "") {
              case "dot":
              case "sub":
              case "new":
              case "call":
                return true;
              case "name":
                return expr[1] != "this";
            }
          }
          ;
          function maybe_assign(no_in) {
            var left = maybe_conditional(no_in),
                val = S.token.value;
            if (is("operator") && HOP(ASSIGNMENT, val)) {
              if (is_assignable(left)) {
                next();
                return as("assign", ASSIGNMENT[val], left, maybe_assign(no_in));
              }
              croak("Invalid assignment");
            }
            return left;
          }
          ;
          var expression = maybe_embed_tokens(function(commas, no_in) {
            if (arguments.length == 0)
              commas = true;
            var expr = maybe_assign(no_in);
            if (commas && is("punc", ",")) {
              next();
              return as("seq", expr, expression(true, no_in));
            }
            return expr;
          });
          function in_loop(cont) {
            try {
              ++S.in_loop;
              return cont();
            } finally {
              --S.in_loop;
            }
          }
          ;
          return as("toplevel", (function(a) {
            while (!is("eof"))
              a.push(statement());
            return a;
          })([]));
        }
        ;
        function curry(f) {
          var args = slice(arguments, 1);
          return function() {
            return f.apply(this, args.concat(slice(arguments)));
          };
        }
        ;
        function prog1(ret) {
          if (ret instanceof Function)
            ret = ret();
          for (var i = 1,
              n = arguments.length; --n > 0; ++i)
            arguments[i]();
          return ret;
        }
        ;
        function array_to_hash(a) {
          var ret = {};
          for (var i = 0; i < a.length; ++i)
            ret[a[i]] = true;
          return ret;
        }
        ;
        function slice(a, start) {
          return Array.prototype.slice.call(a, start || 0);
        }
        ;
        function characters(str) {
          return str.split("");
        }
        ;
        function member(name, array) {
          for (var i = array.length; --i >= 0; )
            if (array[i] == name)
              return true;
          return false;
        }
        ;
        function HOP(obj, prop) {
          return Object.prototype.hasOwnProperty.call(obj, prop);
        }
        ;
        var warn = function() {};
        exports.tokenizer = tokenizer;
        exports.parse = parse;
        exports.slice = slice;
        exports.curry = curry;
        exports.member = member;
        exports.array_to_hash = array_to_hash;
        exports.PRECEDENCE = PRECEDENCE;
        exports.KEYWORDS_ATOM = KEYWORDS_ATOM;
        exports.RESERVED_WORDS = RESERVED_WORDS;
        exports.KEYWORDS = KEYWORDS;
        exports.ATOMIC_START_TOKEN = ATOMIC_START_TOKEN;
        exports.OPERATORS = OPERATORS;
        exports.is_alphanumeric_char = is_alphanumeric_char;
        exports.is_identifier_start = is_identifier_start;
        exports.is_identifier_char = is_identifier_char;
        exports.set_logger = function(logger) {
          warn = logger;
        };
      });
      define('uglifyjs/squeeze-more', ["require", "exports", "module", "./parse-js", "./squeeze-more"], function(require, exports, module) {
        var jsp = require("./parse-js"),
            pro = require("./process"),
            slice = jsp.slice,
            member = jsp.member,
            curry = jsp.curry,
            MAP = pro.MAP,
            PRECEDENCE = jsp.PRECEDENCE,
            OPERATORS = jsp.OPERATORS;
        function ast_squeeze_more(ast) {
          var w = pro.ast_walker(),
              walk = w.walk,
              scope;
          function with_scope(s, cont) {
            var save = scope,
                ret;
            scope = s;
            ret = cont();
            scope = save;
            return ret;
          }
          ;
          function _lambda(name, args, body) {
            return [this[0], name, args, with_scope(body.scope, curry(MAP, body, walk))];
          }
          ;
          return w.with_walkers({
            "toplevel": function(body) {
              return [this[0], with_scope(this.scope, curry(MAP, body, walk))];
            },
            "function": _lambda,
            "defun": _lambda,
            "new": function(ctor, args) {
              if (ctor[0] == "name") {
                if (ctor[1] == "Array" && !scope.has("Array")) {
                  if (args.length != 1) {
                    return ["array", args];
                  } else {
                    return walk(["call", ["name", "Array"], args]);
                  }
                } else if (ctor[1] == "Object" && !scope.has("Object")) {
                  if (!args.length) {
                    return ["object", []];
                  } else {
                    return walk(["call", ["name", "Object"], args]);
                  }
                } else if ((ctor[1] == "RegExp" || ctor[1] == "Function" || ctor[1] == "Error") && !scope.has(ctor[1])) {
                  return walk(["call", ["name", ctor[1]], args]);
                }
              }
            },
            "call": function(expr, args) {
              if (expr[0] == "dot" && expr[1][0] == "string" && args.length == 1 && (args[0][1] > 0 && expr[2] == "substring" || expr[2] == "substr")) {
                return ["call", ["dot", expr[1], "slice"], args];
              }
              if (expr[0] == "dot" && expr[2] == "toString" && args.length == 0) {
                if (expr[1][0] == "string")
                  return expr[1];
                return ["binary", "+", expr[1], ["string", ""]];
              }
              if (expr[0] == "name") {
                if (expr[1] == "Array" && args.length != 1 && !scope.has("Array")) {
                  return ["array", args];
                }
                if (expr[1] == "Object" && !args.length && !scope.has("Object")) {
                  return ["object", []];
                }
                if (expr[1] == "String" && !scope.has("String")) {
                  return ["binary", "+", args[0], ["string", ""]];
                }
              }
            }
          }, function() {
            return walk(pro.ast_add_scope(ast));
          });
        }
        ;
        exports.ast_squeeze_more = ast_squeeze_more;
      });
      define('uglifyjs/process', ["require", "exports", "module", "./parse-js", "./squeeze-more"], function(require, exports, module) {
        var jsp = require("./parse-js"),
            curry = jsp.curry,
            slice = jsp.slice,
            member = jsp.member,
            is_identifier_char = jsp.is_identifier_char,
            PRECEDENCE = jsp.PRECEDENCE,
            OPERATORS = jsp.OPERATORS;
        function ast_walker() {
          function _vardefs(defs) {
            return [this[0], MAP(defs, function(def) {
              var a = [def[0]];
              if (def.length > 1)
                a[1] = walk(def[1]);
              return a;
            })];
          }
          ;
          function _block(statements) {
            var out = [this[0]];
            if (statements != null)
              out.push(MAP(statements, walk));
            return out;
          }
          ;
          var walkers = {
            "string": function(str) {
              return [this[0], str];
            },
            "num": function(num) {
              return [this[0], num];
            },
            "name": function(name) {
              return [this[0], name];
            },
            "toplevel": function(statements) {
              return [this[0], MAP(statements, walk)];
            },
            "block": _block,
            "splice": _block,
            "var": _vardefs,
            "const": _vardefs,
            "try": function(t, c, f) {
              return [this[0], MAP(t, walk), c != null ? [c[0], MAP(c[1], walk)] : null, f != null ? MAP(f, walk) : null];
            },
            "throw": function(expr) {
              return [this[0], walk(expr)];
            },
            "new": function(ctor, args) {
              return [this[0], walk(ctor), MAP(args, walk)];
            },
            "switch": function(expr, body) {
              return [this[0], walk(expr), MAP(body, function(branch) {
                return [branch[0] ? walk(branch[0]) : null, MAP(branch[1], walk)];
              })];
            },
            "break": function(label) {
              return [this[0], label];
            },
            "continue": function(label) {
              return [this[0], label];
            },
            "conditional": function(cond, t, e) {
              return [this[0], walk(cond), walk(t), walk(e)];
            },
            "assign": function(op, lvalue, rvalue) {
              return [this[0], op, walk(lvalue), walk(rvalue)];
            },
            "dot": function(expr) {
              return [this[0], walk(expr)].concat(slice(arguments, 1));
            },
            "call": function(expr, args) {
              return [this[0], walk(expr), MAP(args, walk)];
            },
            "function": function(name, args, body) {
              return [this[0], name, args.slice(), MAP(body, walk)];
            },
            "debugger": function() {
              return [this[0]];
            },
            "defun": function(name, args, body) {
              return [this[0], name, args.slice(), MAP(body, walk)];
            },
            "if": function(conditional, t, e) {
              return [this[0], walk(conditional), walk(t), walk(e)];
            },
            "for": function(init, cond, step, block) {
              return [this[0], walk(init), walk(cond), walk(step), walk(block)];
            },
            "for-in": function(vvar, key, hash, block) {
              return [this[0], walk(vvar), walk(key), walk(hash), walk(block)];
            },
            "while": function(cond, block) {
              return [this[0], walk(cond), walk(block)];
            },
            "do": function(cond, block) {
              return [this[0], walk(cond), walk(block)];
            },
            "return": function(expr) {
              return [this[0], walk(expr)];
            },
            "binary": function(op, left, right) {
              return [this[0], op, walk(left), walk(right)];
            },
            "unary-prefix": function(op, expr) {
              return [this[0], op, walk(expr)];
            },
            "unary-postfix": function(op, expr) {
              return [this[0], op, walk(expr)];
            },
            "sub": function(expr, subscript) {
              return [this[0], walk(expr), walk(subscript)];
            },
            "object": function(props) {
              return [this[0], MAP(props, function(p) {
                return p.length == 2 ? [p[0], walk(p[1])] : [p[0], walk(p[1]), p[2]];
              })];
            },
            "regexp": function(rx, mods) {
              return [this[0], rx, mods];
            },
            "array": function(elements) {
              return [this[0], MAP(elements, walk)];
            },
            "stat": function(stat) {
              return [this[0], walk(stat)];
            },
            "seq": function() {
              return [this[0]].concat(MAP(slice(arguments), walk));
            },
            "label": function(name, block) {
              return [this[0], name, walk(block)];
            },
            "with": function(expr, block) {
              return [this[0], walk(expr), walk(block)];
            },
            "atom": function(name) {
              return [this[0], name];
            },
            "directive": function(dir) {
              return [this[0], dir];
            }
          };
          var user = {};
          var stack = [];
          function walk(ast) {
            if (ast == null)
              return null;
            try {
              stack.push(ast);
              var type = ast[0];
              var gen = user[type];
              if (gen) {
                var ret = gen.apply(ast, ast.slice(1));
                if (ret != null)
                  return ret;
              }
              gen = walkers[type];
              return gen.apply(ast, ast.slice(1));
            } finally {
              stack.pop();
            }
          }
          ;
          function dive(ast) {
            if (ast == null)
              return null;
            try {
              stack.push(ast);
              return walkers[ast[0]].apply(ast, ast.slice(1));
            } finally {
              stack.pop();
            }
          }
          ;
          function with_walkers(walkers, cont) {
            var save = {},
                i;
            for (i in walkers)
              if (HOP(walkers, i)) {
                save[i] = user[i];
                user[i] = walkers[i];
              }
            var ret = cont();
            for (i in save)
              if (HOP(save, i)) {
                if (!save[i])
                  delete user[i];
                else
                  user[i] = save[i];
              }
            return ret;
          }
          ;
          return {
            walk: walk,
            dive: dive,
            with_walkers: with_walkers,
            parent: function() {
              return stack[stack.length - 2];
            },
            stack: function() {
              return stack;
            }
          };
        }
        ;
        function Scope(parent) {
          this.names = {};
          this.mangled = {};
          this.rev_mangled = {};
          this.cname = -1;
          this.refs = {};
          this.uses_with = false;
          this.uses_eval = false;
          this.directives = [];
          this.parent = parent;
          this.children = [];
          if (parent) {
            this.level = parent.level + 1;
            parent.children.push(this);
          } else {
            this.level = 0;
          }
        }
        ;
        function base54_digits() {
          if (typeof DIGITS_OVERRIDE_FOR_TESTING != "undefined")
            return DIGITS_OVERRIDE_FOR_TESTING;
          else
            return "etnrisouaflchpdvmgybwESxTNCkLAOM_DPHBjFIqRUzWXV$JKQGYZ0516372984";
        }
        var base54 = (function() {
          var DIGITS = base54_digits();
          return function(num) {
            var ret = "",
                base = 54;
            do {
              ret += DIGITS.charAt(num % base);
              num = Math.floor(num / base);
              base = 64;
            } while (num > 0);
            return ret;
          };
        })();
        Scope.prototype = {
          has: function(name) {
            for (var s = this; s; s = s.parent)
              if (HOP(s.names, name))
                return s;
          },
          has_mangled: function(mname) {
            for (var s = this; s; s = s.parent)
              if (HOP(s.rev_mangled, mname))
                return s;
          },
          toJSON: function() {
            return {
              names: this.names,
              uses_eval: this.uses_eval,
              uses_with: this.uses_with
            };
          },
          next_mangled: function() {
            for (; ; ) {
              var m = base54(++this.cname),
                  prior;
              prior = this.has_mangled(m);
              if (prior && this.refs[prior.rev_mangled[m]] === prior)
                continue;
              prior = this.has(m);
              if (prior && prior !== this && this.refs[m] === prior && !prior.has_mangled(m))
                continue;
              if (HOP(this.refs, m) && this.refs[m] == null)
                continue;
              if (!is_identifier(m))
                continue;
              return m;
            }
          },
          set_mangle: function(name, m) {
            this.rev_mangled[m] = name;
            return this.mangled[name] = m;
          },
          get_mangled: function(name, newMangle) {
            if (this.uses_eval || this.uses_with)
              return name;
            var s = this.has(name);
            if (!s)
              return name;
            if (HOP(s.mangled, name))
              return s.mangled[name];
            if (!newMangle)
              return name;
            return s.set_mangle(name, s.next_mangled());
          },
          references: function(name) {
            return name && !this.parent || this.uses_with || this.uses_eval || this.refs[name];
          },
          define: function(name, type) {
            if (name != null) {
              if (type == "var" || !HOP(this.names, name))
                this.names[name] = type || "var";
              return name;
            }
          },
          active_directive: function(dir) {
            return member(dir, this.directives) || this.parent && this.parent.active_directive(dir);
          }
        };
        function ast_add_scope(ast) {
          var current_scope = null;
          var w = ast_walker(),
              walk = w.walk;
          var having_eval = [];
          function with_new_scope(cont) {
            current_scope = new Scope(current_scope);
            current_scope.labels = new Scope();
            var ret = current_scope.body = cont();
            ret.scope = current_scope;
            current_scope = current_scope.parent;
            return ret;
          }
          ;
          function define(name, type) {
            return current_scope.define(name, type);
          }
          ;
          function reference(name) {
            current_scope.refs[name] = true;
          }
          ;
          function _lambda(name, args, body) {
            var is_defun = this[0] == "defun";
            return [this[0], is_defun ? define(name, "defun") : name, args, with_new_scope(function() {
              if (!is_defun)
                define(name, "lambda");
              MAP(args, function(name) {
                define(name, "arg");
              });
              return MAP(body, walk);
            })];
          }
          ;
          function _vardefs(type) {
            return function(defs) {
              MAP(defs, function(d) {
                define(d[0], type);
                if (d[1])
                  reference(d[0]);
              });
            };
          }
          ;
          function _breacont(label) {
            if (label)
              current_scope.labels.refs[label] = true;
          }
          ;
          return with_new_scope(function() {
            var ret = w.with_walkers({
              "function": _lambda,
              "defun": _lambda,
              "label": function(name, stat) {
                current_scope.labels.define(name);
              },
              "break": _breacont,
              "continue": _breacont,
              "with": function(expr, block) {
                for (var s = current_scope; s; s = s.parent)
                  s.uses_with = true;
              },
              "var": _vardefs("var"),
              "const": _vardefs("const"),
              "try": function(t, c, f) {
                if (c != null)
                  return [this[0], MAP(t, walk), [define(c[0], "catch"), MAP(c[1], walk)], f != null ? MAP(f, walk) : null];
              },
              "name": function(name) {
                if (name == "eval")
                  having_eval.push(current_scope);
                reference(name);
              }
            }, function() {
              return walk(ast);
            });
            MAP(having_eval, function(scope) {
              if (!scope.has("eval"))
                while (scope) {
                  scope.uses_eval = true;
                  scope = scope.parent;
                }
            });
            function fixrefs(scope, i) {
              for (i = scope.children.length; --i >= 0; )
                fixrefs(scope.children[i]);
              for (i in scope.refs)
                if (HOP(scope.refs, i)) {
                  for (var origin = scope.has(i),
                      s = scope; s; s = s.parent) {
                    s.refs[i] = origin;
                    if (s === origin)
                      break;
                  }
                }
            }
            ;
            fixrefs(current_scope);
            return ret;
          });
        }
        ;
        function ast_mangle(ast, options) {
          var w = ast_walker(),
              walk = w.walk,
              scope;
          options = defaults(options, {
            mangle: true,
            toplevel: false,
            defines: null,
            except: null,
            no_functions: false
          });
          function get_mangled(name, newMangle) {
            if (!options.mangle)
              return name;
            if (!options.toplevel && !scope.parent)
              return name;
            if (options.except && member(name, options.except))
              return name;
            if (options.no_functions && HOP(scope.names, name) && (scope.names[name] == 'defun' || scope.names[name] == 'lambda'))
              return name;
            return scope.get_mangled(name, newMangle);
          }
          ;
          function get_define(name) {
            if (options.defines) {
              if (!scope.has(name)) {
                if (HOP(options.defines, name)) {
                  return options.defines[name];
                }
              }
              return null;
            }
          }
          ;
          function _lambda(name, args, body) {
            if (!options.no_functions && options.mangle) {
              var is_defun = this[0] == "defun",
                  extra;
              if (name) {
                if (is_defun)
                  name = get_mangled(name);
                else if (body.scope.references(name)) {
                  extra = {};
                  if (!(scope.uses_eval || scope.uses_with))
                    name = extra[name] = scope.next_mangled();
                  else
                    extra[name] = name;
                } else
                  name = null;
              }
            }
            body = with_scope(body.scope, function() {
              args = MAP(args, function(name) {
                return get_mangled(name);
              });
              return MAP(body, walk);
            }, extra);
            return [this[0], name, args, body];
          }
          ;
          function with_scope(s, cont, extra) {
            var _scope = scope;
            scope = s;
            if (extra)
              for (var i in extra)
                if (HOP(extra, i)) {
                  s.set_mangle(i, extra[i]);
                }
            for (var i in s.names)
              if (HOP(s.names, i)) {
                get_mangled(i, true);
              }
            var ret = cont();
            ret.scope = s;
            scope = _scope;
            return ret;
          }
          ;
          function _vardefs(defs) {
            return [this[0], MAP(defs, function(d) {
              return [get_mangled(d[0]), walk(d[1])];
            })];
          }
          ;
          function _breacont(label) {
            if (label)
              return [this[0], scope.labels.get_mangled(label)];
          }
          ;
          return w.with_walkers({
            "function": _lambda,
            "defun": function() {
              var ast = _lambda.apply(this, arguments);
              switch (w.parent()[0]) {
                case "toplevel":
                case "function":
                case "defun":
                  return MAP.at_top(ast);
              }
              return ast;
            },
            "label": function(label, stat) {
              if (scope.labels.refs[label])
                return [this[0], scope.labels.get_mangled(label, true), walk(stat)];
              return walk(stat);
            },
            "break": _breacont,
            "continue": _breacont,
            "var": _vardefs,
            "const": _vardefs,
            "name": function(name) {
              return get_define(name) || [this[0], get_mangled(name)];
            },
            "try": function(t, c, f) {
              return [this[0], MAP(t, walk), c != null ? [get_mangled(c[0]), MAP(c[1], walk)] : null, f != null ? MAP(f, walk) : null];
            },
            "toplevel": function(body) {
              var self = this;
              return with_scope(self.scope, function() {
                return [self[0], MAP(body, walk)];
              });
            },
            "directive": function() {
              return MAP.at_top(this);
            }
          }, function() {
            return walk(ast_add_scope(ast));
          });
        }
        ;
        var warn = function() {};
        function best_of(ast1, ast2) {
          return gen_code(ast1).length > gen_code(ast2[0] == "stat" ? ast2[1] : ast2).length ? ast2 : ast1;
        }
        ;
        function last_stat(b) {
          if (b[0] == "block" && b[1] && b[1].length > 0)
            return b[1][b[1].length - 1];
          return b;
        }
        function aborts(t) {
          if (t)
            switch (last_stat(t)[0]) {
              case "return":
              case "break":
              case "continue":
              case "throw":
                return true;
            }
        }
        ;
        function boolean_expr(expr) {
          return ((expr[0] == "unary-prefix" && member(expr[1], ["!", "delete"])) || (expr[0] == "binary" && member(expr[1], ["in", "instanceof", "==", "!=", "===", "!==", "<", "<=", ">=", ">"])) || (expr[0] == "binary" && member(expr[1], ["&&", "||"]) && boolean_expr(expr[2]) && boolean_expr(expr[3])) || (expr[0] == "conditional" && boolean_expr(expr[2]) && boolean_expr(expr[3])) || (expr[0] == "assign" && expr[1] === true && boolean_expr(expr[3])) || (expr[0] == "seq" && boolean_expr(expr[expr.length - 1])));
        }
        ;
        function empty(b) {
          return !b || (b[0] == "block" && (!b[1] || b[1].length == 0));
        }
        ;
        function is_string(node) {
          return (node[0] == "string" || node[0] == "unary-prefix" && node[1] == "typeof" || node[0] == "binary" && node[1] == "+" && (is_string(node[2]) || is_string(node[3])));
        }
        ;
        var when_constant = (function() {
          var $NOT_CONSTANT = {};
          function evaluate(expr) {
            switch (expr[0]) {
              case "string":
              case "num":
                return expr[1];
              case "name":
              case "atom":
                switch (expr[1]) {
                  case "true":
                    return true;
                  case "false":
                    return false;
                  case "null":
                    return null;
                }
                break;
              case "unary-prefix":
                switch (expr[1]) {
                  case "!":
                    return !evaluate(expr[2]);
                  case "typeof":
                    return typeof evaluate(expr[2]);
                  case "~":
                    return ~evaluate(expr[2]);
                  case "-":
                    return -evaluate(expr[2]);
                  case "+":
                    return +evaluate(expr[2]);
                }
                break;
              case "binary":
                var left = expr[2],
                    right = expr[3];
                switch (expr[1]) {
                  case "&&":
                    return evaluate(left) && evaluate(right);
                  case "||":
                    return evaluate(left) || evaluate(right);
                  case "|":
                    return evaluate(left) | evaluate(right);
                  case "&":
                    return evaluate(left) & evaluate(right);
                  case "^":
                    return evaluate(left) ^ evaluate(right);
                  case "+":
                    return evaluate(left) + evaluate(right);
                  case "*":
                    return evaluate(left) * evaluate(right);
                  case "/":
                    return evaluate(left) / evaluate(right);
                  case "%":
                    return evaluate(left) % evaluate(right);
                  case "-":
                    return evaluate(left) - evaluate(right);
                  case "<<":
                    return evaluate(left) << evaluate(right);
                  case ">>":
                    return evaluate(left) >> evaluate(right);
                  case ">>>":
                    return evaluate(left) >>> evaluate(right);
                  case "==":
                    return evaluate(left) == evaluate(right);
                  case "===":
                    return evaluate(left) === evaluate(right);
                  case "!=":
                    return evaluate(left) != evaluate(right);
                  case "!==":
                    return evaluate(left) !== evaluate(right);
                  case "<":
                    return evaluate(left) < evaluate(right);
                  case "<=":
                    return evaluate(left) <= evaluate(right);
                  case ">":
                    return evaluate(left) > evaluate(right);
                  case ">=":
                    return evaluate(left) >= evaluate(right);
                  case "in":
                    return evaluate(left) in evaluate(right);
                  case "instanceof":
                    return evaluate(left) instanceof evaluate(right);
                }
            }
            throw $NOT_CONSTANT;
          }
          ;
          return function(expr, yes, no) {
            try {
              var val = evaluate(expr),
                  ast;
              switch (typeof val) {
                case "string":
                  ast = ["string", val];
                  break;
                case "number":
                  ast = ["num", val];
                  break;
                case "boolean":
                  ast = ["name", String(val)];
                  break;
                default:
                  if (val === null) {
                    ast = ["atom", "null"];
                    break;
                  }
                  throw new Error("Can't handle constant of type: " + (typeof val));
              }
              return yes.call(expr, ast, val);
            } catch (ex) {
              if (ex === $NOT_CONSTANT) {
                if (expr[0] == "binary" && (expr[1] == "===" || expr[1] == "!==") && ((is_string(expr[2]) && is_string(expr[3])) || (boolean_expr(expr[2]) && boolean_expr(expr[3])))) {
                  expr[1] = expr[1].substr(0, 2);
                } else if (no && expr[0] == "binary" && (expr[1] == "||" || expr[1] == "&&")) {
                  try {
                    var lval = evaluate(expr[2]);
                    expr = ((expr[1] == "&&" && (lval ? expr[3] : lval)) || (expr[1] == "||" && (lval ? lval : expr[3])) || expr);
                  } catch (ex2) {}
                }
                return no ? no.call(expr, expr) : null;
              } else
                throw ex;
            }
          };
        })();
        function warn_unreachable(ast) {
          if (!empty(ast))
            warn("Dropping unreachable code: " + gen_code(ast, true));
        }
        ;
        function prepare_ifs(ast) {
          var w = ast_walker(),
              walk = w.walk;
          function redo_if(statements) {
            statements = MAP(statements, walk);
            for (var i = 0; i < statements.length; ++i) {
              var fi = statements[i];
              if (fi[0] != "if")
                continue;
              if (fi[3])
                continue;
              var t = fi[2];
              if (!aborts(t))
                continue;
              var conditional = walk(fi[1]);
              var e_body = redo_if(statements.slice(i + 1));
              var e = e_body.length == 1 ? e_body[0] : ["block", e_body];
              return statements.slice(0, i).concat([[fi[0], conditional, t, e]]);
            }
            return statements;
          }
          ;
          function redo_if_lambda(name, args, body) {
            body = redo_if(body);
            return [this[0], name, args, body];
          }
          ;
          function redo_if_block(statements) {
            return [this[0], statements != null ? redo_if(statements) : null];
          }
          ;
          return w.with_walkers({
            "defun": redo_if_lambda,
            "function": redo_if_lambda,
            "block": redo_if_block,
            "splice": redo_if_block,
            "toplevel": function(statements) {
              return [this[0], redo_if(statements)];
            },
            "try": function(t, c, f) {
              return [this[0], redo_if(t), c != null ? [c[0], redo_if(c[1])] : null, f != null ? redo_if(f) : null];
            }
          }, function() {
            return walk(ast);
          });
        }
        ;
        function for_side_effects(ast, handler) {
          var w = ast_walker(),
              walk = w.walk;
          var $stop = {},
              $restart = {};
          function stop() {
            throw $stop;
          }
          ;
          function restart() {
            throw $restart;
          }
          ;
          function found() {
            return handler.call(this, this, w, stop, restart);
          }
          ;
          function unary(op) {
            if (op == "++" || op == "--")
              return found.apply(this, arguments);
          }
          ;
          function binary(op) {
            if (op == "&&" || op == "||")
              return found.apply(this, arguments);
          }
          ;
          return w.with_walkers({
            "try": found,
            "throw": found,
            "return": found,
            "new": found,
            "switch": found,
            "break": found,
            "continue": found,
            "assign": found,
            "call": found,
            "if": found,
            "for": found,
            "for-in": found,
            "while": found,
            "do": found,
            "return": found,
            "unary-prefix": unary,
            "unary-postfix": unary,
            "conditional": found,
            "binary": binary,
            "defun": found
          }, function() {
            while (true)
              try {
                walk(ast);
                break;
              } catch (ex) {
                if (ex === $stop)
                  break;
                if (ex === $restart)
                  continue;
                throw ex;
              }
          });
        }
        ;
        function ast_lift_variables(ast) {
          var w = ast_walker(),
              walk = w.walk,
              scope;
          function do_body(body, env) {
            var _scope = scope;
            scope = env;
            body = MAP(body, walk);
            var hash = {},
                names = MAP(env.names, function(type, name) {
                  if (type != "var")
                    return MAP.skip;
                  if (!env.references(name))
                    return MAP.skip;
                  hash[name] = true;
                  return [name];
                });
            if (names.length > 0) {
              for_side_effects(["block", body], function(ast, walker, stop, restart) {
                if (ast[0] == "assign" && ast[1] === true && ast[2][0] == "name" && HOP(hash, ast[2][1])) {
                  for (var i = names.length; --i >= 0; ) {
                    if (names[i][0] == ast[2][1]) {
                      if (names[i][1])
                        stop();
                      names[i][1] = ast[3];
                      names.push(names.splice(i, 1)[0]);
                      break;
                    }
                  }
                  var p = walker.parent();
                  if (p[0] == "seq") {
                    var a = p[2];
                    a.unshift(0, p.length);
                    p.splice.apply(p, a);
                  } else if (p[0] == "stat") {
                    p.splice(0, p.length, "block");
                  } else {
                    stop();
                  }
                  restart();
                }
                stop();
              });
              body.unshift(["var", names]);
            }
            scope = _scope;
            return body;
          }
          ;
          function _vardefs(defs) {
            var ret = null;
            for (var i = defs.length; --i >= 0; ) {
              var d = defs[i];
              if (!d[1])
                continue;
              d = ["assign", true, ["name", d[0]], d[1]];
              if (ret == null)
                ret = d;
              else
                ret = ["seq", d, ret];
            }
            if (ret == null && w.parent()[0] != "for") {
              if (w.parent()[0] == "for-in")
                return ["name", defs[0][0]];
              return MAP.skip;
            }
            return ["stat", ret];
          }
          ;
          function _toplevel(body) {
            return [this[0], do_body(body, this.scope)];
          }
          ;
          return w.with_walkers({
            "function": function(name, args, body) {
              for (var i = args.length; --i >= 0 && !body.scope.references(args[i]); )
                args.pop();
              if (!body.scope.references(name))
                name = null;
              return [this[0], name, args, do_body(body, body.scope)];
            },
            "defun": function(name, args, body) {
              if (!scope.references(name))
                return MAP.skip;
              for (var i = args.length; --i >= 0 && !body.scope.references(args[i]); )
                args.pop();
              return [this[0], name, args, do_body(body, body.scope)];
            },
            "var": _vardefs,
            "toplevel": _toplevel
          }, function() {
            return walk(ast_add_scope(ast));
          });
        }
        ;
        function ast_squeeze(ast, options) {
          ast = squeeze_1(ast, options);
          ast = squeeze_2(ast, options);
          return ast;
        }
        ;
        function squeeze_1(ast, options) {
          options = defaults(options, {
            make_seqs: true,
            dead_code: true,
            no_warnings: false,
            keep_comps: true,
            unsafe: false
          });
          var w = ast_walker(),
              walk = w.walk,
              scope;
          function negate(c) {
            var not_c = ["unary-prefix", "!", c];
            switch (c[0]) {
              case "unary-prefix":
                return c[1] == "!" && boolean_expr(c[2]) ? c[2] : not_c;
              case "seq":
                c = slice(c);
                c[c.length - 1] = negate(c[c.length - 1]);
                return c;
              case "conditional":
                return best_of(not_c, ["conditional", c[1], negate(c[2]), negate(c[3])]);
              case "binary":
                var op = c[1],
                    left = c[2],
                    right = c[3];
                if (!options.keep_comps)
                  switch (op) {
                    case "<=":
                      return ["binary", ">", left, right];
                    case "<":
                      return ["binary", ">=", left, right];
                    case ">=":
                      return ["binary", "<", left, right];
                    case ">":
                      return ["binary", "<=", left, right];
                  }
                switch (op) {
                  case "==":
                    return ["binary", "!=", left, right];
                  case "!=":
                    return ["binary", "==", left, right];
                  case "===":
                    return ["binary", "!==", left, right];
                  case "!==":
                    return ["binary", "===", left, right];
                  case "&&":
                    return best_of(not_c, ["binary", "||", negate(left), negate(right)]);
                  case "||":
                    return best_of(not_c, ["binary", "&&", negate(left), negate(right)]);
                }
                break;
            }
            return not_c;
          }
          ;
          function make_conditional(c, t, e) {
            var make_real_conditional = function() {
              if (c[0] == "unary-prefix" && c[1] == "!") {
                return e ? ["conditional", c[2], e, t] : ["binary", "||", c[2], t];
              } else {
                return e ? best_of(["conditional", c, t, e], ["conditional", negate(c), e, t]) : ["binary", "&&", c, t];
              }
            };
            return when_constant(c, function(ast, val) {
              warn_unreachable(val ? e : t);
              return (val ? t : e);
            }, make_real_conditional);
          }
          ;
          function rmblock(block) {
            if (block != null && block[0] == "block" && block[1]) {
              if (block[1].length == 1)
                block = block[1][0];
              else if (block[1].length == 0)
                block = ["block"];
            }
            return block;
          }
          ;
          function _lambda(name, args, body) {
            return [this[0], name, args, tighten(body, "lambda")];
          }
          ;
          function tighten(statements, block_type) {
            statements = MAP(statements, walk);
            statements = statements.reduce(function(a, stat) {
              if (stat[0] == "block") {
                if (stat[1]) {
                  a.push.apply(a, stat[1]);
                }
              } else {
                a.push(stat);
              }
              return a;
            }, []);
            statements = (function(a, prev) {
              statements.forEach(function(cur) {
                if (prev && ((cur[0] == "var" && prev[0] == "var") || (cur[0] == "const" && prev[0] == "const"))) {
                  prev[1] = prev[1].concat(cur[1]);
                } else {
                  a.push(cur);
                  prev = cur;
                }
              });
              return a;
            })([]);
            if (options.dead_code)
              statements = (function(a, has_quit) {
                statements.forEach(function(st) {
                  if (has_quit) {
                    if (st[0] == "function" || st[0] == "defun") {
                      a.push(st);
                    } else if (st[0] == "var" || st[0] == "const") {
                      if (!options.no_warnings)
                        warn("Variables declared in unreachable code");
                      st[1] = MAP(st[1], function(def) {
                        if (def[1] && !options.no_warnings)
                          warn_unreachable(["assign", true, ["name", def[0]], def[1]]);
                        return [def[0]];
                      });
                      a.push(st);
                    } else if (!options.no_warnings)
                      warn_unreachable(st);
                  } else {
                    a.push(st);
                    if (member(st[0], ["return", "throw", "break", "continue"]))
                      has_quit = true;
                  }
                });
                return a;
              })([]);
            if (options.make_seqs)
              statements = (function(a, prev) {
                statements.forEach(function(cur) {
                  if (prev && prev[0] == "stat" && cur[0] == "stat") {
                    prev[1] = ["seq", prev[1], cur[1]];
                  } else {
                    a.push(cur);
                    prev = cur;
                  }
                });
                if (a.length >= 2 && a[a.length - 2][0] == "stat" && (a[a.length - 1][0] == "return" || a[a.length - 1][0] == "throw") && a[a.length - 1][1]) {
                  a.splice(a.length - 2, 2, [a[a.length - 1][0], ["seq", a[a.length - 2][1], a[a.length - 1][1]]]);
                }
                return a;
              })([]);
            return statements;
          }
          ;
          function make_if(c, t, e) {
            return when_constant(c, function(ast, val) {
              if (val) {
                t = walk(t);
                warn_unreachable(e);
                return t || ["block"];
              } else {
                e = walk(e);
                warn_unreachable(t);
                return e || ["block"];
              }
            }, function() {
              return make_real_if(c, t, e);
            });
          }
          ;
          function abort_else(c, t, e) {
            var ret = [["if", negate(c), e]];
            if (t[0] == "block") {
              if (t[1])
                ret = ret.concat(t[1]);
            } else {
              ret.push(t);
            }
            return walk(["block", ret]);
          }
          ;
          function make_real_if(c, t, e) {
            c = walk(c);
            t = walk(t);
            e = walk(e);
            if (empty(e) && empty(t))
              return ["stat", c];
            if (empty(t)) {
              c = negate(c);
              t = e;
              e = null;
            } else if (empty(e)) {
              e = null;
            } else {
              (function() {
                var a = gen_code(c);
                var n = negate(c);
                var b = gen_code(n);
                if (b.length < a.length) {
                  var tmp = t;
                  t = e;
                  e = tmp;
                  c = n;
                }
              })();
            }
            var ret = ["if", c, t, e];
            if (t[0] == "if" && empty(t[3]) && empty(e)) {
              ret = best_of(ret, walk(["if", ["binary", "&&", c, t[1]], t[2]]));
            } else if (t[0] == "stat") {
              if (e) {
                if (e[0] == "stat")
                  ret = best_of(ret, ["stat", make_conditional(c, t[1], e[1])]);
                else if (aborts(e))
                  ret = abort_else(c, t, e);
              } else {
                ret = best_of(ret, ["stat", make_conditional(c, t[1])]);
              }
            } else if (e && t[0] == e[0] && (t[0] == "return" || t[0] == "throw") && t[1] && e[1]) {
              ret = best_of(ret, [t[0], make_conditional(c, t[1], e[1])]);
            } else if (e && aborts(t)) {
              ret = [["if", c, t]];
              if (e[0] == "block") {
                if (e[1])
                  ret = ret.concat(e[1]);
              } else {
                ret.push(e);
              }
              ret = walk(["block", ret]);
            } else if (t && aborts(e)) {
              ret = abort_else(c, t, e);
            }
            return ret;
          }
          ;
          function _do_while(cond, body) {
            return when_constant(cond, function(cond, val) {
              if (!val) {
                warn_unreachable(body);
                return ["block"];
              } else {
                return ["for", null, null, null, walk(body)];
              }
            });
          }
          ;
          return w.with_walkers({
            "sub": function(expr, subscript) {
              if (subscript[0] == "string") {
                var name = subscript[1];
                if (is_identifier(name))
                  return ["dot", walk(expr), name];
                else if (/^[1-9][0-9]*$/.test(name) || name === "0")
                  return ["sub", walk(expr), ["num", parseInt(name, 10)]];
              }
            },
            "if": make_if,
            "toplevel": function(body) {
              return ["toplevel", tighten(body)];
            },
            "switch": function(expr, body) {
              var last = body.length - 1;
              return ["switch", walk(expr), MAP(body, function(branch, i) {
                var block = tighten(branch[1]);
                if (i == last && block.length > 0) {
                  var node = block[block.length - 1];
                  if (node[0] == "break" && !node[1])
                    block.pop();
                }
                return [branch[0] ? walk(branch[0]) : null, block];
              })];
            },
            "function": _lambda,
            "defun": _lambda,
            "block": function(body) {
              if (body)
                return rmblock(["block", tighten(body)]);
            },
            "binary": function(op, left, right) {
              return when_constant(["binary", op, walk(left), walk(right)], function yes(c) {
                return best_of(walk(c), this);
              }, function no() {
                return function() {
                  if (op != "==" && op != "!=")
                    return ;
                  var l = walk(left),
                      r = walk(right);
                  if (l && l[0] == "unary-prefix" && l[1] == "!" && l[2][0] == "num")
                    left = ['num', +!l[2][1]];
                  else if (r && r[0] == "unary-prefix" && r[1] == "!" && r[2][0] == "num")
                    right = ['num', +!r[2][1]];
                  return ["binary", op, left, right];
                }() || this;
              });
            },
            "conditional": function(c, t, e) {
              return make_conditional(walk(c), walk(t), walk(e));
            },
            "try": function(t, c, f) {
              return ["try", tighten(t), c != null ? [c[0], tighten(c[1])] : null, f != null ? tighten(f) : null];
            },
            "unary-prefix": function(op, expr) {
              expr = walk(expr);
              var ret = ["unary-prefix", op, expr];
              if (op == "!")
                ret = best_of(ret, negate(expr));
              return when_constant(ret, function(ast, val) {
                return walk(ast);
              }, function() {
                return ret;
              });
            },
            "name": function(name) {
              switch (name) {
                case "true":
                  return ["unary-prefix", "!", ["num", 0]];
                case "false":
                  return ["unary-prefix", "!", ["num", 1]];
              }
            },
            "while": _do_while,
            "assign": function(op, lvalue, rvalue) {
              lvalue = walk(lvalue);
              rvalue = walk(rvalue);
              var okOps = ['+', '-', '/', '*', '%', '>>', '<<', '>>>', '|', '^', '&'];
              if (op === true && lvalue[0] === "name" && rvalue[0] === "binary" && ~okOps.indexOf(rvalue[1]) && rvalue[2][0] === "name" && rvalue[2][1] === lvalue[1]) {
                return [this[0], rvalue[1], lvalue, rvalue[3]];
              }
              return [this[0], op, lvalue, rvalue];
            },
            "call": function(expr, args) {
              expr = walk(expr);
              if (options.unsafe && expr[0] == "dot" && expr[1][0] == "string" && expr[2] == "toString") {
                return expr[1];
              }
              return [this[0], expr, MAP(args, walk)];
            },
            "num": function(num) {
              if (!isFinite(num))
                return ["binary", "/", num === 1 / 0 ? ["num", 1] : num === -1 / 0 ? ["unary-prefix", "-", ["num", 1]] : ["num", 0], ["num", 0]];
              return [this[0], num];
            }
          }, function() {
            return walk(prepare_ifs(walk(prepare_ifs(ast))));
          });
        }
        ;
        function squeeze_2(ast, options) {
          var w = ast_walker(),
              walk = w.walk,
              scope;
          function with_scope(s, cont) {
            var save = scope,
                ret;
            scope = s;
            ret = cont();
            scope = save;
            return ret;
          }
          ;
          function lambda(name, args, body) {
            return [this[0], name, args, with_scope(body.scope, curry(MAP, body, walk))];
          }
          ;
          return w.with_walkers({
            "directive": function(dir) {
              if (scope.active_directive(dir))
                return ["block"];
              scope.directives.push(dir);
            },
            "toplevel": function(body) {
              return [this[0], with_scope(this.scope, curry(MAP, body, walk))];
            },
            "function": lambda,
            "defun": lambda
          }, function() {
            return walk(ast_add_scope(ast));
          });
        }
        ;
        var DOT_CALL_NO_PARENS = jsp.array_to_hash(["name", "array", "object", "string", "dot", "sub", "call", "regexp", "defun"]);
        function make_string(str, ascii_only) {
          var dq = 0,
              sq = 0;
          str = str.replace(/[\\\b\f\n\r\t\x22\x27\u2028\u2029\0]/g, function(s) {
            switch (s) {
              case "\\":
                return "\\\\";
              case "\b":
                return "\\b";
              case "\f":
                return "\\f";
              case "\n":
                return "\\n";
              case "\r":
                return "\\r";
              case "\u2028":
                return "\\u2028";
              case "\u2029":
                return "\\u2029";
              case '"':
                ++dq;
                return '"';
              case "'":
                ++sq;
                return "'";
              case "\0":
                return "\\0";
            }
            return s;
          });
          if (ascii_only)
            str = to_ascii(str);
          if (dq > sq)
            return "'" + str.replace(/\x27/g, "\\'") + "'";
          else
            return '"' + str.replace(/\x22/g, '\\"') + '"';
        }
        ;
        function to_ascii(str) {
          return str.replace(/[\u0080-\uffff]/g, function(ch) {
            var code = ch.charCodeAt(0).toString(16);
            while (code.length < 4)
              code = "0" + code;
            return "\\u" + code;
          });
        }
        ;
        var SPLICE_NEEDS_BRACKETS = jsp.array_to_hash(["if", "while", "do", "for", "for-in", "with"]);
        function gen_code(ast, options) {
          options = defaults(options, {
            indent_start: 0,
            indent_level: 4,
            quote_keys: false,
            space_colon: false,
            beautify: false,
            ascii_only: false,
            inline_script: false
          });
          var beautify = !!options.beautify;
          var indentation = 0,
              newline = beautify ? "\n" : "",
              space = beautify ? " " : "";
          function encode_string(str) {
            var ret = make_string(str, options.ascii_only);
            if (options.inline_script)
              ret = ret.replace(/<\x2fscript([>\/\t\n\f\r ])/gi, "<\\/script$1");
            return ret;
          }
          ;
          function make_name(name) {
            name = name.toString();
            if (options.ascii_only)
              name = to_ascii(name);
            return name;
          }
          ;
          function indent(line) {
            if (line == null)
              line = "";
            if (beautify)
              line = repeat_string(" ", options.indent_start + indentation * options.indent_level) + line;
            return line;
          }
          ;
          function with_indent(cont, incr) {
            if (incr == null)
              incr = 1;
            indentation += incr;
            try {
              return cont.apply(null, slice(arguments, 1));
            } finally {
              indentation -= incr;
            }
          }
          ;
          function last_char(str) {
            str = str.toString();
            return str.charAt(str.length - 1);
          }
          ;
          function first_char(str) {
            return str.toString().charAt(0);
          }
          ;
          function add_spaces(a) {
            if (beautify)
              return a.join(" ");
            var b = [];
            for (var i = 0; i < a.length; ++i) {
              var next = a[i + 1];
              b.push(a[i]);
              if (next && ((is_identifier_char(last_char(a[i])) && (is_identifier_char(first_char(next)) || first_char(next) == "\\")) || (/[\+\-]$/.test(a[i].toString()) && /^[\+\-]/.test(next.toString()) || last_char(a[i]) == "/" && first_char(next) == "/"))) {
                b.push(" ");
              }
            }
            return b.join("");
          }
          ;
          function add_commas(a) {
            return a.join("," + space);
          }
          ;
          function parenthesize(expr) {
            var gen = make(expr);
            for (var i = 1; i < arguments.length; ++i) {
              var el = arguments[i];
              if ((el instanceof Function && el(expr)) || expr[0] == el)
                return "(" + gen + ")";
            }
            return gen;
          }
          ;
          function best_of(a) {
            if (a.length == 1) {
              return a[0];
            }
            if (a.length == 2) {
              var b = a[1];
              a = a[0];
              return a.length <= b.length ? a : b;
            }
            return best_of([a[0], best_of(a.slice(1))]);
          }
          ;
          function needs_parens(expr) {
            if (expr[0] == "function" || expr[0] == "object") {
              var a = slice(w.stack()),
                  self = a.pop(),
                  p = a.pop();
              while (p) {
                if (p[0] == "stat")
                  return true;
                if (((p[0] == "seq" || p[0] == "call" || p[0] == "dot" || p[0] == "sub" || p[0] == "conditional") && p[1] === self) || ((p[0] == "binary" || p[0] == "assign" || p[0] == "unary-postfix") && p[2] === self)) {
                  self = p;
                  p = a.pop();
                } else {
                  return false;
                }
              }
            }
            return !HOP(DOT_CALL_NO_PARENS, expr[0]);
          }
          ;
          function make_num(num) {
            var str = num.toString(10),
                a = [str.replace(/^0\./, ".").replace('e+', 'e')],
                m;
            if (Math.floor(num) === num) {
              if (num >= 0) {
                a.push("0x" + num.toString(16).toLowerCase(), "0" + num.toString(8));
              } else {
                a.push("-0x" + (-num).toString(16).toLowerCase(), "-0" + (-num).toString(8));
              }
              if ((m = /^(.*?)(0+)$/.exec(num))) {
                a.push(m[1] + "e" + m[2].length);
              }
            } else if ((m = /^0?\.(0+)(.*)$/.exec(num))) {
              a.push(m[2] + "e-" + (m[1].length + m[2].length), str.substr(str.indexOf(".")));
            }
            return best_of(a);
          }
          ;
          var w = ast_walker();
          var make = w.walk;
          return w.with_walkers({
            "string": encode_string,
            "num": make_num,
            "name": make_name,
            "debugger": function() {
              return "debugger;";
            },
            "toplevel": function(statements) {
              return make_block_statements(statements).join(newline + newline);
            },
            "splice": function(statements) {
              var parent = w.parent();
              if (HOP(SPLICE_NEEDS_BRACKETS, parent)) {
                return make_block.apply(this, arguments);
              } else {
                return MAP(make_block_statements(statements, true), function(line, i) {
                  return i > 0 ? indent(line) : line;
                }).join(newline);
              }
            },
            "block": make_block,
            "var": function(defs) {
              return "var " + add_commas(MAP(defs, make_1vardef)) + ";";
            },
            "const": function(defs) {
              return "const " + add_commas(MAP(defs, make_1vardef)) + ";";
            },
            "try": function(tr, ca, fi) {
              var out = ["try", make_block(tr)];
              if (ca)
                out.push("catch", "(" + ca[0] + ")", make_block(ca[1]));
              if (fi)
                out.push("finally", make_block(fi));
              return add_spaces(out);
            },
            "throw": function(expr) {
              return add_spaces(["throw", make(expr)]) + ";";
            },
            "new": function(ctor, args) {
              args = args.length > 0 ? "(" + add_commas(MAP(args, function(expr) {
                return parenthesize(expr, "seq");
              })) + ")" : "";
              return add_spaces(["new", parenthesize(ctor, "seq", "binary", "conditional", "assign", function(expr) {
                var w = ast_walker(),
                    has_call = {};
                try {
                  w.with_walkers({
                    "call": function() {
                      throw has_call;
                    },
                    "function": function() {
                      return this;
                    }
                  }, function() {
                    w.walk(expr);
                  });
                } catch (ex) {
                  if (ex === has_call)
                    return true;
                  throw ex;
                }
              }) + args]);
            },
            "switch": function(expr, body) {
              return add_spaces(["switch", "(" + make(expr) + ")", make_switch_block(body)]);
            },
            "break": function(label) {
              var out = "break";
              if (label != null)
                out += " " + make_name(label);
              return out + ";";
            },
            "continue": function(label) {
              var out = "continue";
              if (label != null)
                out += " " + make_name(label);
              return out + ";";
            },
            "conditional": function(co, th, el) {
              return add_spaces([parenthesize(co, "assign", "seq", "conditional"), "?", parenthesize(th, "seq"), ":", parenthesize(el, "seq")]);
            },
            "assign": function(op, lvalue, rvalue) {
              if (op && op !== true)
                op += "=";
              else
                op = "=";
              return add_spaces([make(lvalue), op, parenthesize(rvalue, "seq")]);
            },
            "dot": function(expr) {
              var out = make(expr),
                  i = 1;
              if (expr[0] == "num") {
                if (!/[a-f.]/i.test(out))
                  out += ".";
              } else if (expr[0] != "function" && needs_parens(expr))
                out = "(" + out + ")";
              while (i < arguments.length)
                out += "." + make_name(arguments[i++]);
              return out;
            },
            "call": function(func, args) {
              var f = make(func);
              if (f.charAt(0) != "(" && needs_parens(func))
                f = "(" + f + ")";
              return f + "(" + add_commas(MAP(args, function(expr) {
                return parenthesize(expr, "seq");
              })) + ")";
            },
            "function": make_function,
            "defun": make_function,
            "if": function(co, th, el) {
              var out = ["if", "(" + make(co) + ")", el ? make_then(th) : make(th)];
              if (el) {
                out.push("else", make(el));
              }
              return add_spaces(out);
            },
            "for": function(init, cond, step, block) {
              var out = ["for"];
              init = (init != null ? make(init) : "").replace(/;*\s*$/, ";" + space);
              cond = (cond != null ? make(cond) : "").replace(/;*\s*$/, ";" + space);
              step = (step != null ? make(step) : "").replace(/;*\s*$/, "");
              var args = init + cond + step;
              if (args == "; ; ")
                args = ";;";
              out.push("(" + args + ")", make(block));
              return add_spaces(out);
            },
            "for-in": function(vvar, key, hash, block) {
              return add_spaces(["for", "(" + (vvar ? make(vvar).replace(/;+$/, "") : make(key)), "in", make(hash) + ")", make(block)]);
            },
            "while": function(condition, block) {
              return add_spaces(["while", "(" + make(condition) + ")", make(block)]);
            },
            "do": function(condition, block) {
              return add_spaces(["do", make(block), "while", "(" + make(condition) + ")"]) + ";";
            },
            "return": function(expr) {
              var out = ["return"];
              if (expr != null)
                out.push(make(expr));
              return add_spaces(out) + ";";
            },
            "binary": function(operator, lvalue, rvalue) {
              var left = make(lvalue),
                  right = make(rvalue);
              if (member(lvalue[0], ["assign", "conditional", "seq"]) || lvalue[0] == "binary" && PRECEDENCE[operator] > PRECEDENCE[lvalue[1]] || lvalue[0] == "function" && needs_parens(this)) {
                left = "(" + left + ")";
              }
              if (member(rvalue[0], ["assign", "conditional", "seq"]) || rvalue[0] == "binary" && PRECEDENCE[operator] >= PRECEDENCE[rvalue[1]] && !(rvalue[1] == operator && member(operator, ["&&", "||", "*"]))) {
                right = "(" + right + ")";
              } else if (!beautify && options.inline_script && (operator == "<" || operator == "<<") && rvalue[0] == "regexp" && /^script/i.test(rvalue[1])) {
                right = " " + right;
              }
              return add_spaces([left, operator, right]);
            },
            "unary-prefix": function(operator, expr) {
              var val = make(expr);
              if (!(expr[0] == "num" || (expr[0] == "unary-prefix" && !HOP(OPERATORS, operator + expr[1])) || !needs_parens(expr)))
                val = "(" + val + ")";
              return operator + (jsp.is_alphanumeric_char(operator.charAt(0)) ? " " : "") + val;
            },
            "unary-postfix": function(operator, expr) {
              var val = make(expr);
              if (!(expr[0] == "num" || (expr[0] == "unary-postfix" && !HOP(OPERATORS, operator + expr[1])) || !needs_parens(expr)))
                val = "(" + val + ")";
              return val + operator;
            },
            "sub": function(expr, subscript) {
              var hash = make(expr);
              if (needs_parens(expr))
                hash = "(" + hash + ")";
              return hash + "[" + make(subscript) + "]";
            },
            "object": function(props) {
              var obj_needs_parens = needs_parens(this);
              if (props.length == 0)
                return obj_needs_parens ? "({})" : "{}";
              var out = "{" + newline + with_indent(function() {
                return MAP(props, function(p) {
                  if (p.length == 3) {
                    return indent(make_function(p[0], p[1][2], p[1][3], p[2], true));
                  }
                  var key = p[0],
                      val = parenthesize(p[1], "seq");
                  if (options.quote_keys) {
                    key = encode_string(key);
                  } else if ((typeof key == "number" || !beautify && +key + "" == key) && parseFloat(key) >= 0) {
                    key = make_num(+key);
                  } else if (!is_identifier(key)) {
                    key = encode_string(key);
                  }
                  return indent(add_spaces(beautify && options.space_colon ? [key, ":", val] : [key + ":", val]));
                }).join("," + newline);
              }) + newline + indent("}");
              return obj_needs_parens ? "(" + out + ")" : out;
            },
            "regexp": function(rx, mods) {
              if (options.ascii_only)
                rx = to_ascii(rx);
              return "/" + rx + "/" + mods;
            },
            "array": function(elements) {
              if (elements.length == 0)
                return "[]";
              return add_spaces(["[", add_commas(MAP(elements, function(el, i) {
                if (!beautify && el[0] == "atom" && el[1] == "undefined")
                  return i === elements.length - 1 ? "," : "";
                return parenthesize(el, "seq");
              })), "]"]);
            },
            "stat": function(stmt) {
              return stmt != null ? make(stmt).replace(/;*\s*$/, ";") : ";";
            },
            "seq": function() {
              return add_commas(MAP(slice(arguments), make));
            },
            "label": function(name, block) {
              return add_spaces([make_name(name), ":", make(block)]);
            },
            "with": function(expr, block) {
              return add_spaces(["with", "(" + make(expr) + ")", make(block)]);
            },
            "atom": function(name) {
              return make_name(name);
            },
            "directive": function(dir) {
              return make_string(dir) + ";";
            }
          }, function() {
            return make(ast);
          });
          function make_then(th) {
            if (th == null)
              return ";";
            if (th[0] == "do") {
              return make_block([th]);
            }
            var b = th;
            while (true) {
              var type = b[0];
              if (type == "if") {
                if (!b[3])
                  return make(["block", [th]]);
                b = b[3];
              } else if (type == "while" || type == "do")
                b = b[2];
              else if (type == "for" || type == "for-in")
                b = b[4];
              else
                break;
            }
            return make(th);
          }
          ;
          function make_function(name, args, body, keyword, no_parens) {
            var out = keyword || "function";
            if (name) {
              out += " " + make_name(name);
            }
            out += "(" + add_commas(MAP(args, make_name)) + ")";
            out = add_spaces([out, make_block(body)]);
            return (!no_parens && needs_parens(this)) ? "(" + out + ")" : out;
          }
          ;
          function must_has_semicolon(node) {
            switch (node[0]) {
              case "with":
              case "while":
                return empty(node[2]) || must_has_semicolon(node[2]);
              case "for":
              case "for-in":
                return empty(node[4]) || must_has_semicolon(node[4]);
              case "if":
                if (empty(node[2]) && !node[3])
                  return true;
                if (node[3]) {
                  if (empty(node[3]))
                    return true;
                  return must_has_semicolon(node[3]);
                }
                return must_has_semicolon(node[2]);
              case "directive":
                return true;
            }
          }
          ;
          function make_block_statements(statements, noindent) {
            for (var a = [],
                last = statements.length - 1,
                i = 0; i <= last; ++i) {
              var stat = statements[i];
              var code = make(stat);
              if (code != ";") {
                if (!beautify && i == last && !must_has_semicolon(stat)) {
                  code = code.replace(/;+\s*$/, "");
                }
                a.push(code);
              }
            }
            return noindent ? a : MAP(a, indent);
          }
          ;
          function make_switch_block(body) {
            var n = body.length;
            if (n == 0)
              return "{}";
            return "{" + newline + MAP(body, function(branch, i) {
              var has_body = branch[1].length > 0,
                  code = with_indent(function() {
                    return indent(branch[0] ? add_spaces(["case", make(branch[0]) + ":"]) : "default:");
                  }, 0.5) + (has_body ? newline + with_indent(function() {
                    return make_block_statements(branch[1]).join(newline);
                  }) : "");
              if (!beautify && has_body && i < n - 1)
                code += ";";
              return code;
            }).join(newline) + newline + indent("}");
          }
          ;
          function make_block(statements) {
            if (!statements)
              return ";";
            if (statements.length == 0)
              return "{}";
            return "{" + newline + with_indent(function() {
              return make_block_statements(statements).join(newline);
            }) + newline + indent("}");
          }
          ;
          function make_1vardef(def) {
            var name = def[0],
                val = def[1];
            if (val != null)
              name = add_spaces([make_name(name), "=", parenthesize(val, "seq")]);
            return name;
          }
          ;
        }
        ;
        function split_lines(code, max_line_length) {
          var splits = [0];
          jsp.parse(function() {
            var next_token = jsp.tokenizer(code);
            var last_split = 0;
            var prev_token;
            function current_length(tok) {
              return tok.pos - last_split;
            }
            ;
            function split_here(tok) {
              last_split = tok.pos;
              splits.push(last_split);
            }
            ;
            function custom() {
              var tok = next_token.apply(this, arguments);
              out: {
                if (prev_token) {
                  if (prev_token.type == "keyword")
                    break out;
                }
                if (current_length(tok) > max_line_length) {
                  switch (tok.type) {
                    case "keyword":
                    case "atom":
                    case "name":
                    case "punc":
                      split_here(tok);
                      break out;
                  }
                }
              }
              prev_token = tok;
              return tok;
            }
            ;
            custom.context = function() {
              return next_token.context.apply(this, arguments);
            };
            return custom;
          }());
          return splits.map(function(pos, i) {
            return code.substring(pos, splits[i + 1] || code.length);
          }).join("\n");
        }
        ;
        function repeat_string(str, i) {
          if (i <= 0)
            return "";
          if (i == 1)
            return str;
          var d = repeat_string(str, i >> 1);
          d += d;
          if (i & 1)
            d += str;
          return d;
        }
        ;
        function defaults(args, defs) {
          var ret = {};
          if (args === true)
            args = {};
          for (var i in defs)
            if (HOP(defs, i)) {
              ret[i] = (args && HOP(args, i)) ? args[i] : defs[i];
            }
          return ret;
        }
        ;
        function is_identifier(name) {
          return /^[a-z_$][a-z0-9_$]*$/i.test(name) && name != "this" && !HOP(jsp.KEYWORDS_ATOM, name) && !HOP(jsp.RESERVED_WORDS, name) && !HOP(jsp.KEYWORDS, name);
        }
        ;
        function HOP(obj, prop) {
          return Object.prototype.hasOwnProperty.call(obj, prop);
        }
        ;
        var MAP;
        (function() {
          MAP = function(a, f, o) {
            var ret = [],
                top = [],
                i;
            function doit() {
              var val = f.call(o, a[i], i);
              if (val instanceof AtTop) {
                val = val.v;
                if (val instanceof Splice) {
                  top.push.apply(top, val.v);
                } else {
                  top.push(val);
                }
              } else if (val != skip) {
                if (val instanceof Splice) {
                  ret.push.apply(ret, val.v);
                } else {
                  ret.push(val);
                }
              }
            }
            ;
            if (a instanceof Array)
              for (i = 0; i < a.length; ++i)
                doit();
            else
              for (i in a)
                if (HOP(a, i))
                  doit();
            return top.concat(ret);
          };
          MAP.at_top = function(val) {
            return new AtTop(val);
          };
          MAP.splice = function(val) {
            return new Splice(val);
          };
          var skip = MAP.skip = {};
          function AtTop(val) {
            this.v = val;
          }
          ;
          function Splice(val) {
            this.v = val;
          }
          ;
        })();
        exports.ast_walker = ast_walker;
        exports.ast_mangle = ast_mangle;
        exports.ast_squeeze = ast_squeeze;
        exports.ast_lift_variables = ast_lift_variables;
        exports.gen_code = gen_code;
        exports.ast_add_scope = ast_add_scope;
        exports.set_logger = function(logger) {
          warn = logger;
        };
        exports.make_string = make_string;
        exports.split_lines = split_lines;
        exports.MAP = MAP;
        exports.ast_squeeze_more = require("./squeeze-more").ast_squeeze_more;
      });
      define('uglifyjs/index', ["require", "exports", "module", "./parse-js", "./process", "./consolidator"], function(require, exports, module) {
        function uglify(orig_code, options) {
          options || (options = {});
          var jsp = uglify.parser;
          var pro = uglify.uglify;
          var ast = jsp.parse(orig_code, options.strict_semicolons);
          ast = pro.ast_mangle(ast, options.mangle_options);
          ast = pro.ast_squeeze(ast, options.squeeze_options);
          var final_code = pro.gen_code(ast, options.gen_options);
          return final_code;
        }
        ;
        uglify.parser = require("./parse-js");
        uglify.uglify = require("./process");
        uglify.consolidator = require("./consolidator");
        module.exports = uglify;
      });
      define('source-map/array-set', function(require, exports, module) {
        var util = require("./util");
        function ArraySet() {
          this._array = [];
          this._set = {};
        }
        ArraySet.fromArray = function ArraySet_fromArray(aArray, aAllowDuplicates) {
          var set = new ArraySet();
          for (var i = 0,
              len = aArray.length; i < len; i++) {
            set.add(aArray[i], aAllowDuplicates);
          }
          return set;
        };
        ArraySet.prototype.add = function ArraySet_add(aStr, aAllowDuplicates) {
          var isDuplicate = this.has(aStr);
          var idx = this._array.length;
          if (!isDuplicate || aAllowDuplicates) {
            this._array.push(aStr);
          }
          if (!isDuplicate) {
            this._set[util.toSetString(aStr)] = idx;
          }
        };
        ArraySet.prototype.has = function ArraySet_has(aStr) {
          return Object.prototype.hasOwnProperty.call(this._set, util.toSetString(aStr));
        };
        ArraySet.prototype.indexOf = function ArraySet_indexOf(aStr) {
          if (this.has(aStr)) {
            return this._set[util.toSetString(aStr)];
          }
          throw new Error('"' + aStr + '" is not in the set.');
        };
        ArraySet.prototype.at = function ArraySet_at(aIdx) {
          if (aIdx >= 0 && aIdx < this._array.length) {
            return this._array[aIdx];
          }
          throw new Error('No element indexed by ' + aIdx);
        };
        ArraySet.prototype.toArray = function ArraySet_toArray() {
          return this._array.slice();
        };
        exports.ArraySet = ArraySet;
      });
      define('source-map/base64-vlq', function(require, exports, module) {
        var base64 = require("./base64");
        var VLQ_BASE_SHIFT = 5;
        var VLQ_BASE = 1 << VLQ_BASE_SHIFT;
        var VLQ_BASE_MASK = VLQ_BASE - 1;
        var VLQ_CONTINUATION_BIT = VLQ_BASE;
        function toVLQSigned(aValue) {
          return aValue < 0 ? ((-aValue) << 1) + 1 : (aValue << 1) + 0;
        }
        function fromVLQSigned(aValue) {
          var isNegative = (aValue & 1) === 1;
          var shifted = aValue >> 1;
          return isNegative ? -shifted : shifted;
        }
        exports.encode = function base64VLQ_encode(aValue) {
          var encoded = "";
          var digit;
          var vlq = toVLQSigned(aValue);
          do {
            digit = vlq & VLQ_BASE_MASK;
            vlq >>>= VLQ_BASE_SHIFT;
            if (vlq > 0) {
              digit |= VLQ_CONTINUATION_BIT;
            }
            encoded += base64.encode(digit);
          } while (vlq > 0);
          return encoded;
        };
        exports.decode = function base64VLQ_decode(aStr) {
          var i = 0;
          var strLen = aStr.length;
          var result = 0;
          var shift = 0;
          var continuation,
              digit;
          do {
            if (i >= strLen) {
              throw new Error("Expected more digits in base 64 VLQ value.");
            }
            digit = base64.decode(aStr.charAt(i++));
            continuation = !!(digit & VLQ_CONTINUATION_BIT);
            digit &= VLQ_BASE_MASK;
            result = result + (digit << shift);
            shift += VLQ_BASE_SHIFT;
          } while (continuation);
          return {
            value: fromVLQSigned(result),
            rest: aStr.slice(i)
          };
        };
      });
      define('source-map/base64', function(require, exports, module) {
        var charToIntMap = {};
        var intToCharMap = {};
        'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'.split('').forEach(function(ch, index) {
          charToIntMap[ch] = index;
          intToCharMap[index] = ch;
        });
        exports.encode = function base64_encode(aNumber) {
          if (aNumber in intToCharMap) {
            return intToCharMap[aNumber];
          }
          throw new TypeError("Must be between 0 and 63: " + aNumber);
        };
        exports.decode = function base64_decode(aChar) {
          if (aChar in charToIntMap) {
            return charToIntMap[aChar];
          }
          throw new TypeError("Not a valid base 64 digit: " + aChar);
        };
      });
      define('source-map/binary-search', function(require, exports, module) {
        function recursiveSearch(aLow, aHigh, aNeedle, aHaystack, aCompare) {
          var mid = Math.floor((aHigh - aLow) / 2) + aLow;
          var cmp = aCompare(aNeedle, aHaystack[mid], true);
          if (cmp === 0) {
            return aHaystack[mid];
          } else if (cmp > 0) {
            if (aHigh - mid > 1) {
              return recursiveSearch(mid, aHigh, aNeedle, aHaystack, aCompare);
            }
            return aHaystack[mid];
          } else {
            if (mid - aLow > 1) {
              return recursiveSearch(aLow, mid, aNeedle, aHaystack, aCompare);
            }
            return aLow < 0 ? null : aHaystack[aLow];
          }
        }
        exports.search = function search(aNeedle, aHaystack, aCompare) {
          return aHaystack.length > 0 ? recursiveSearch(-1, aHaystack.length, aNeedle, aHaystack, aCompare) : null;
        };
      });
      define('source-map/source-map-consumer', function(require, exports, module) {
        var util = require("./util");
        var binarySearch = require("./binary-search");
        var ArraySet = require("./array-set").ArraySet;
        var base64VLQ = require("./base64-vlq");
        function SourceMapConsumer(aSourceMap) {
          var sourceMap = aSourceMap;
          if (typeof aSourceMap === 'string') {
            sourceMap = JSON.parse(aSourceMap.replace(/^\)\]\}'/, ''));
          }
          var version = util.getArg(sourceMap, 'version');
          var sources = util.getArg(sourceMap, 'sources');
          var names = util.getArg(sourceMap, 'names', []);
          var sourceRoot = util.getArg(sourceMap, 'sourceRoot', null);
          var sourcesContent = util.getArg(sourceMap, 'sourcesContent', null);
          var mappings = util.getArg(sourceMap, 'mappings');
          var file = util.getArg(sourceMap, 'file', null);
          if (version != this._version) {
            throw new Error('Unsupported version: ' + version);
          }
          this._names = ArraySet.fromArray(names, true);
          this._sources = ArraySet.fromArray(sources, true);
          this.sourceRoot = sourceRoot;
          this.sourcesContent = sourcesContent;
          this._mappings = mappings;
          this.file = file;
        }
        SourceMapConsumer.fromSourceMap = function SourceMapConsumer_fromSourceMap(aSourceMap) {
          var smc = Object.create(SourceMapConsumer.prototype);
          smc._names = ArraySet.fromArray(aSourceMap._names.toArray(), true);
          smc._sources = ArraySet.fromArray(aSourceMap._sources.toArray(), true);
          smc.sourceRoot = aSourceMap._sourceRoot;
          smc.sourcesContent = aSourceMap._generateSourcesContent(smc._sources.toArray(), smc.sourceRoot);
          smc.file = aSourceMap._file;
          smc.__generatedMappings = aSourceMap._mappings.slice().sort(util.compareByGeneratedPositions);
          smc.__originalMappings = aSourceMap._mappings.slice().sort(util.compareByOriginalPositions);
          return smc;
        };
        SourceMapConsumer.prototype._version = 3;
        Object.defineProperty(SourceMapConsumer.prototype, 'sources', {get: function() {
            return this._sources.toArray().map(function(s) {
              return this.sourceRoot ? util.join(this.sourceRoot, s) : s;
            }, this);
          }});
        SourceMapConsumer.prototype.__generatedMappings = null;
        Object.defineProperty(SourceMapConsumer.prototype, '_generatedMappings', {get: function() {
            if (!this.__generatedMappings) {
              this.__generatedMappings = [];
              this.__originalMappings = [];
              this._parseMappings(this._mappings, this.sourceRoot);
            }
            return this.__generatedMappings;
          }});
        SourceMapConsumer.prototype.__originalMappings = null;
        Object.defineProperty(SourceMapConsumer.prototype, '_originalMappings', {get: function() {
            if (!this.__originalMappings) {
              this.__generatedMappings = [];
              this.__originalMappings = [];
              this._parseMappings(this._mappings, this.sourceRoot);
            }
            return this.__originalMappings;
          }});
        SourceMapConsumer.prototype._parseMappings = function SourceMapConsumer_parseMappings(aStr, aSourceRoot) {
          var generatedLine = 1;
          var previousGeneratedColumn = 0;
          var previousOriginalLine = 0;
          var previousOriginalColumn = 0;
          var previousSource = 0;
          var previousName = 0;
          var mappingSeparator = /^[,;]/;
          var str = aStr;
          var mapping;
          var temp;
          while (str.length > 0) {
            if (str.charAt(0) === ';') {
              generatedLine++;
              str = str.slice(1);
              previousGeneratedColumn = 0;
            } else if (str.charAt(0) === ',') {
              str = str.slice(1);
            } else {
              mapping = {};
              mapping.generatedLine = generatedLine;
              temp = base64VLQ.decode(str);
              mapping.generatedColumn = previousGeneratedColumn + temp.value;
              previousGeneratedColumn = mapping.generatedColumn;
              str = temp.rest;
              if (str.length > 0 && !mappingSeparator.test(str.charAt(0))) {
                temp = base64VLQ.decode(str);
                mapping.source = this._sources.at(previousSource + temp.value);
                previousSource += temp.value;
                str = temp.rest;
                if (str.length === 0 || mappingSeparator.test(str.charAt(0))) {
                  throw new Error('Found a source, but no line and column');
                }
                temp = base64VLQ.decode(str);
                mapping.originalLine = previousOriginalLine + temp.value;
                previousOriginalLine = mapping.originalLine;
                mapping.originalLine += 1;
                str = temp.rest;
                if (str.length === 0 || mappingSeparator.test(str.charAt(0))) {
                  throw new Error('Found a source and line, but no column');
                }
                temp = base64VLQ.decode(str);
                mapping.originalColumn = previousOriginalColumn + temp.value;
                previousOriginalColumn = mapping.originalColumn;
                str = temp.rest;
                if (str.length > 0 && !mappingSeparator.test(str.charAt(0))) {
                  temp = base64VLQ.decode(str);
                  mapping.name = this._names.at(previousName + temp.value);
                  previousName += temp.value;
                  str = temp.rest;
                }
              }
              this.__generatedMappings.push(mapping);
              if (typeof mapping.originalLine === 'number') {
                this.__originalMappings.push(mapping);
              }
            }
          }
          this.__generatedMappings.sort(util.compareByGeneratedPositions);
          this.__originalMappings.sort(util.compareByOriginalPositions);
        };
        SourceMapConsumer.prototype._findMapping = function SourceMapConsumer_findMapping(aNeedle, aMappings, aLineName, aColumnName, aComparator) {
          if (aNeedle[aLineName] <= 0) {
            throw new TypeError('Line must be greater than or equal to 1, got ' + aNeedle[aLineName]);
          }
          if (aNeedle[aColumnName] < 0) {
            throw new TypeError('Column must be greater than or equal to 0, got ' + aNeedle[aColumnName]);
          }
          return binarySearch.search(aNeedle, aMappings, aComparator);
        };
        SourceMapConsumer.prototype.originalPositionFor = function SourceMapConsumer_originalPositionFor(aArgs) {
          var needle = {
            generatedLine: util.getArg(aArgs, 'line'),
            generatedColumn: util.getArg(aArgs, 'column')
          };
          var mapping = this._findMapping(needle, this._generatedMappings, "generatedLine", "generatedColumn", util.compareByGeneratedPositions);
          if (mapping && mapping.generatedLine === needle.generatedLine) {
            var source = util.getArg(mapping, 'source', null);
            if (source && this.sourceRoot) {
              source = util.join(this.sourceRoot, source);
            }
            return {
              source: source,
              line: util.getArg(mapping, 'originalLine', null),
              column: util.getArg(mapping, 'originalColumn', null),
              name: util.getArg(mapping, 'name', null)
            };
          }
          return {
            source: null,
            line: null,
            column: null,
            name: null
          };
        };
        SourceMapConsumer.prototype.sourceContentFor = function SourceMapConsumer_sourceContentFor(aSource) {
          if (!this.sourcesContent) {
            return null;
          }
          if (this.sourceRoot) {
            aSource = util.relative(this.sourceRoot, aSource);
          }
          if (this._sources.has(aSource)) {
            return this.sourcesContent[this._sources.indexOf(aSource)];
          }
          var url;
          if (this.sourceRoot && (url = util.urlParse(this.sourceRoot))) {
            var fileUriAbsPath = aSource.replace(/^file:\/\//, "");
            if (url.scheme == "file" && this._sources.has(fileUriAbsPath)) {
              return this.sourcesContent[this._sources.indexOf(fileUriAbsPath)];
            }
            if ((!url.path || url.path == "/") && this._sources.has("/" + aSource)) {
              return this.sourcesContent[this._sources.indexOf("/" + aSource)];
            }
          }
          throw new Error('"' + aSource + '" is not in the SourceMap.');
        };
        SourceMapConsumer.prototype.generatedPositionFor = function SourceMapConsumer_generatedPositionFor(aArgs) {
          var needle = {
            source: util.getArg(aArgs, 'source'),
            originalLine: util.getArg(aArgs, 'line'),
            originalColumn: util.getArg(aArgs, 'column')
          };
          if (this.sourceRoot) {
            needle.source = util.relative(this.sourceRoot, needle.source);
          }
          var mapping = this._findMapping(needle, this._originalMappings, "originalLine", "originalColumn", util.compareByOriginalPositions);
          if (mapping) {
            return {
              line: util.getArg(mapping, 'generatedLine', null),
              column: util.getArg(mapping, 'generatedColumn', null)
            };
          }
          return {
            line: null,
            column: null
          };
        };
        SourceMapConsumer.GENERATED_ORDER = 1;
        SourceMapConsumer.ORIGINAL_ORDER = 2;
        SourceMapConsumer.prototype.eachMapping = function SourceMapConsumer_eachMapping(aCallback, aContext, aOrder) {
          var context = aContext || null;
          var order = aOrder || SourceMapConsumer.GENERATED_ORDER;
          var mappings;
          switch (order) {
            case SourceMapConsumer.GENERATED_ORDER:
              mappings = this._generatedMappings;
              break;
            case SourceMapConsumer.ORIGINAL_ORDER:
              mappings = this._originalMappings;
              break;
            default:
              throw new Error("Unknown order of iteration.");
          }
          var sourceRoot = this.sourceRoot;
          mappings.map(function(mapping) {
            var source = mapping.source;
            if (source && sourceRoot) {
              source = util.join(sourceRoot, source);
            }
            return {
              source: source,
              generatedLine: mapping.generatedLine,
              generatedColumn: mapping.generatedColumn,
              originalLine: mapping.originalLine,
              originalColumn: mapping.originalColumn,
              name: mapping.name
            };
          }).forEach(aCallback, context);
        };
        exports.SourceMapConsumer = SourceMapConsumer;
      });
      define('source-map/source-map-generator', function(require, exports, module) {
        var base64VLQ = require("./base64-vlq");
        var util = require("./util");
        var ArraySet = require("./array-set").ArraySet;
        function SourceMapGenerator(aArgs) {
          if (!aArgs) {
            aArgs = {};
          }
          this._file = util.getArg(aArgs, 'file', null);
          this._sourceRoot = util.getArg(aArgs, 'sourceRoot', null);
          this._sources = new ArraySet();
          this._names = new ArraySet();
          this._mappings = [];
          this._sourcesContents = null;
        }
        SourceMapGenerator.prototype._version = 3;
        SourceMapGenerator.fromSourceMap = function SourceMapGenerator_fromSourceMap(aSourceMapConsumer) {
          var sourceRoot = aSourceMapConsumer.sourceRoot;
          var generator = new SourceMapGenerator({
            file: aSourceMapConsumer.file,
            sourceRoot: sourceRoot
          });
          aSourceMapConsumer.eachMapping(function(mapping) {
            var newMapping = {generated: {
                line: mapping.generatedLine,
                column: mapping.generatedColumn
              }};
            if (mapping.source) {
              newMapping.source = mapping.source;
              if (sourceRoot) {
                newMapping.source = util.relative(sourceRoot, newMapping.source);
              }
              newMapping.original = {
                line: mapping.originalLine,
                column: mapping.originalColumn
              };
              if (mapping.name) {
                newMapping.name = mapping.name;
              }
            }
            generator.addMapping(newMapping);
          });
          aSourceMapConsumer.sources.forEach(function(sourceFile) {
            var content = aSourceMapConsumer.sourceContentFor(sourceFile);
            if (content) {
              generator.setSourceContent(sourceFile, content);
            }
          });
          return generator;
        };
        SourceMapGenerator.prototype.addMapping = function SourceMapGenerator_addMapping(aArgs) {
          var generated = util.getArg(aArgs, 'generated');
          var original = util.getArg(aArgs, 'original', null);
          var source = util.getArg(aArgs, 'source', null);
          var name = util.getArg(aArgs, 'name', null);
          this._validateMapping(generated, original, source, name);
          if (source && !this._sources.has(source)) {
            this._sources.add(source);
          }
          if (name && !this._names.has(name)) {
            this._names.add(name);
          }
          this._mappings.push({
            generatedLine: generated.line,
            generatedColumn: generated.column,
            originalLine: original != null && original.line,
            originalColumn: original != null && original.column,
            source: source,
            name: name
          });
        };
        SourceMapGenerator.prototype.setSourceContent = function SourceMapGenerator_setSourceContent(aSourceFile, aSourceContent) {
          var source = aSourceFile;
          if (this._sourceRoot) {
            source = util.relative(this._sourceRoot, source);
          }
          if (aSourceContent !== null) {
            if (!this._sourcesContents) {
              this._sourcesContents = {};
            }
            this._sourcesContents[util.toSetString(source)] = aSourceContent;
          } else {
            delete this._sourcesContents[util.toSetString(source)];
            if (Object.keys(this._sourcesContents).length === 0) {
              this._sourcesContents = null;
            }
          }
        };
        SourceMapGenerator.prototype.applySourceMap = function SourceMapGenerator_applySourceMap(aSourceMapConsumer, aSourceFile, aSourceMapPath) {
          if (!aSourceFile) {
            if (!aSourceMapConsumer.file) {
              throw new Error('SourceMapGenerator.prototype.applySourceMap requires either an explicit source file, ' + 'or the source map\'s "file" property. Both were omitted.');
            }
            aSourceFile = aSourceMapConsumer.file;
          }
          var sourceRoot = this._sourceRoot;
          if (sourceRoot) {
            aSourceFile = util.relative(sourceRoot, aSourceFile);
          }
          var newSources = new ArraySet();
          var newNames = new ArraySet();
          this._mappings.forEach(function(mapping) {
            if (mapping.source === aSourceFile && mapping.originalLine) {
              var original = aSourceMapConsumer.originalPositionFor({
                line: mapping.originalLine,
                column: mapping.originalColumn
              });
              if (original.source !== null) {
                mapping.source = original.source;
                if (aSourceMapPath) {
                  mapping.source = util.join(aSourceMapPath, mapping.source);
                }
                if (sourceRoot) {
                  mapping.source = util.relative(sourceRoot, mapping.source);
                }
                mapping.originalLine = original.line;
                mapping.originalColumn = original.column;
                if (original.name !== null && mapping.name !== null) {
                  mapping.name = original.name;
                }
              }
            }
            var source = mapping.source;
            if (source && !newSources.has(source)) {
              newSources.add(source);
            }
            var name = mapping.name;
            if (name && !newNames.has(name)) {
              newNames.add(name);
            }
          }, this);
          this._sources = newSources;
          this._names = newNames;
          aSourceMapConsumer.sources.forEach(function(sourceFile) {
            var content = aSourceMapConsumer.sourceContentFor(sourceFile);
            if (content) {
              if (aSourceMapPath) {
                sourceFile = util.join(aSourceMapPath, sourceFile);
              }
              if (sourceRoot) {
                sourceFile = util.relative(sourceRoot, sourceFile);
              }
              this.setSourceContent(sourceFile, content);
            }
          }, this);
        };
        SourceMapGenerator.prototype._validateMapping = function SourceMapGenerator_validateMapping(aGenerated, aOriginal, aSource, aName) {
          if (aGenerated && 'line' in aGenerated && 'column' in aGenerated && aGenerated.line > 0 && aGenerated.column >= 0 && !aOriginal && !aSource && !aName) {
            return ;
          } else if (aGenerated && 'line' in aGenerated && 'column' in aGenerated && aOriginal && 'line' in aOriginal && 'column' in aOriginal && aGenerated.line > 0 && aGenerated.column >= 0 && aOriginal.line > 0 && aOriginal.column >= 0 && aSource) {
            return ;
          } else {
            throw new Error('Invalid mapping: ' + JSON.stringify({
              generated: aGenerated,
              source: aSource,
              original: aOriginal,
              name: aName
            }));
          }
        };
        SourceMapGenerator.prototype._serializeMappings = function SourceMapGenerator_serializeMappings() {
          var previousGeneratedColumn = 0;
          var previousGeneratedLine = 1;
          var previousOriginalColumn = 0;
          var previousOriginalLine = 0;
          var previousName = 0;
          var previousSource = 0;
          var result = '';
          var mapping;
          this._mappings.sort(util.compareByGeneratedPositions);
          for (var i = 0,
              len = this._mappings.length; i < len; i++) {
            mapping = this._mappings[i];
            if (mapping.generatedLine !== previousGeneratedLine) {
              previousGeneratedColumn = 0;
              while (mapping.generatedLine !== previousGeneratedLine) {
                result += ';';
                previousGeneratedLine++;
              }
            } else {
              if (i > 0) {
                if (!util.compareByGeneratedPositions(mapping, this._mappings[i - 1])) {
                  continue;
                }
                result += ',';
              }
            }
            result += base64VLQ.encode(mapping.generatedColumn - previousGeneratedColumn);
            previousGeneratedColumn = mapping.generatedColumn;
            if (mapping.source) {
              result += base64VLQ.encode(this._sources.indexOf(mapping.source) - previousSource);
              previousSource = this._sources.indexOf(mapping.source);
              result += base64VLQ.encode(mapping.originalLine - 1 - previousOriginalLine);
              previousOriginalLine = mapping.originalLine - 1;
              result += base64VLQ.encode(mapping.originalColumn - previousOriginalColumn);
              previousOriginalColumn = mapping.originalColumn;
              if (mapping.name) {
                result += base64VLQ.encode(this._names.indexOf(mapping.name) - previousName);
                previousName = this._names.indexOf(mapping.name);
              }
            }
          }
          return result;
        };
        SourceMapGenerator.prototype._generateSourcesContent = function SourceMapGenerator_generateSourcesContent(aSources, aSourceRoot) {
          return aSources.map(function(source) {
            if (!this._sourcesContents) {
              return null;
            }
            if (aSourceRoot) {
              source = util.relative(aSourceRoot, source);
            }
            var key = util.toSetString(source);
            return Object.prototype.hasOwnProperty.call(this._sourcesContents, key) ? this._sourcesContents[key] : null;
          }, this);
        };
        SourceMapGenerator.prototype.toJSON = function SourceMapGenerator_toJSON() {
          var map = {
            version: this._version,
            file: this._file,
            sources: this._sources.toArray(),
            names: this._names.toArray(),
            mappings: this._serializeMappings()
          };
          if (this._sourceRoot) {
            map.sourceRoot = this._sourceRoot;
          }
          if (this._sourcesContents) {
            map.sourcesContent = this._generateSourcesContent(map.sources, map.sourceRoot);
          }
          return map;
        };
        SourceMapGenerator.prototype.toString = function SourceMapGenerator_toString() {
          return JSON.stringify(this);
        };
        exports.SourceMapGenerator = SourceMapGenerator;
      });
      define('source-map/source-node', function(require, exports, module) {
        var SourceMapGenerator = require("./source-map-generator").SourceMapGenerator;
        var util = require("./util");
        var REGEX_NEWLINE = /(\r?\n)/g;
        var REGEX_CHARACTER = /\r\n|[\s\S]/g;
        function SourceNode(aLine, aColumn, aSource, aChunks, aName) {
          this.children = [];
          this.sourceContents = {};
          this.line = aLine === undefined ? null : aLine;
          this.column = aColumn === undefined ? null : aColumn;
          this.source = aSource === undefined ? null : aSource;
          this.name = aName === undefined ? null : aName;
          if (aChunks != null)
            this.add(aChunks);
        }
        SourceNode.fromStringWithSourceMap = function SourceNode_fromStringWithSourceMap(aGeneratedCode, aSourceMapConsumer) {
          var node = new SourceNode();
          var remainingLines = aGeneratedCode.split(REGEX_NEWLINE);
          var shiftNextLine = function() {
            var lineContents = remainingLines.shift();
            var newLine = remainingLines.shift() || "";
            return lineContents + newLine;
          };
          var lastGeneratedLine = 1,
              lastGeneratedColumn = 0;
          var lastMapping = null;
          aSourceMapConsumer.eachMapping(function(mapping) {
            if (lastMapping !== null) {
              if (lastGeneratedLine < mapping.generatedLine) {
                var code = "";
                addMappingWithCode(lastMapping, shiftNextLine());
                lastGeneratedLine++;
                lastGeneratedColumn = 0;
              } else {
                var nextLine = remainingLines[0];
                var code = nextLine.substr(0, mapping.generatedColumn - lastGeneratedColumn);
                remainingLines[0] = nextLine.substr(mapping.generatedColumn - lastGeneratedColumn);
                lastGeneratedColumn = mapping.generatedColumn;
                addMappingWithCode(lastMapping, code);
                lastMapping = mapping;
                return ;
              }
            }
            while (lastGeneratedLine < mapping.generatedLine) {
              node.add(shiftNextLine());
              lastGeneratedLine++;
            }
            if (lastGeneratedColumn < mapping.generatedColumn) {
              var nextLine = remainingLines[0];
              node.add(nextLine.substr(0, mapping.generatedColumn));
              remainingLines[0] = nextLine.substr(mapping.generatedColumn);
              lastGeneratedColumn = mapping.generatedColumn;
            }
            lastMapping = mapping;
          }, this);
          if (remainingLines.length > 0) {
            if (lastMapping) {
              addMappingWithCode(lastMapping, shiftNextLine());
            }
            node.add(remainingLines.join(""));
          }
          aSourceMapConsumer.sources.forEach(function(sourceFile) {
            var content = aSourceMapConsumer.sourceContentFor(sourceFile);
            if (content) {
              node.setSourceContent(sourceFile, content);
            }
          });
          return node;
          function addMappingWithCode(mapping, code) {
            if (mapping === null || mapping.source === undefined) {
              node.add(code);
            } else {
              node.add(new SourceNode(mapping.originalLine, mapping.originalColumn, mapping.source, code, mapping.name));
            }
          }
        };
        SourceNode.prototype.add = function SourceNode_add(aChunk) {
          if (Array.isArray(aChunk)) {
            aChunk.forEach(function(chunk) {
              this.add(chunk);
            }, this);
          } else if (aChunk instanceof SourceNode || typeof aChunk === "string") {
            if (aChunk) {
              this.children.push(aChunk);
            }
          } else {
            throw new TypeError("Expected a SourceNode, string, or an array of SourceNodes and strings. Got " + aChunk);
          }
          return this;
        };
        SourceNode.prototype.prepend = function SourceNode_prepend(aChunk) {
          if (Array.isArray(aChunk)) {
            for (var i = aChunk.length - 1; i >= 0; i--) {
              this.prepend(aChunk[i]);
            }
          } else if (aChunk instanceof SourceNode || typeof aChunk === "string") {
            this.children.unshift(aChunk);
          } else {
            throw new TypeError("Expected a SourceNode, string, or an array of SourceNodes and strings. Got " + aChunk);
          }
          return this;
        };
        SourceNode.prototype.walk = function SourceNode_walk(aFn) {
          var chunk;
          for (var i = 0,
              len = this.children.length; i < len; i++) {
            chunk = this.children[i];
            if (chunk instanceof SourceNode) {
              chunk.walk(aFn);
            } else {
              if (chunk !== '') {
                aFn(chunk, {
                  source: this.source,
                  line: this.line,
                  column: this.column,
                  name: this.name
                });
              }
            }
          }
        };
        SourceNode.prototype.join = function SourceNode_join(aSep) {
          var newChildren;
          var i;
          var len = this.children.length;
          if (len > 0) {
            newChildren = [];
            for (i = 0; i < len - 1; i++) {
              newChildren.push(this.children[i]);
              newChildren.push(aSep);
            }
            newChildren.push(this.children[i]);
            this.children = newChildren;
          }
          return this;
        };
        SourceNode.prototype.replaceRight = function SourceNode_replaceRight(aPattern, aReplacement) {
          var lastChild = this.children[this.children.length - 1];
          if (lastChild instanceof SourceNode) {
            lastChild.replaceRight(aPattern, aReplacement);
          } else if (typeof lastChild === 'string') {
            this.children[this.children.length - 1] = lastChild.replace(aPattern, aReplacement);
          } else {
            this.children.push(''.replace(aPattern, aReplacement));
          }
          return this;
        };
        SourceNode.prototype.setSourceContent = function SourceNode_setSourceContent(aSourceFile, aSourceContent) {
          this.sourceContents[util.toSetString(aSourceFile)] = aSourceContent;
        };
        SourceNode.prototype.walkSourceContents = function SourceNode_walkSourceContents(aFn) {
          for (var i = 0,
              len = this.children.length; i < len; i++) {
            if (this.children[i] instanceof SourceNode) {
              this.children[i].walkSourceContents(aFn);
            }
          }
          var sources = Object.keys(this.sourceContents);
          for (var i = 0,
              len = sources.length; i < len; i++) {
            aFn(util.fromSetString(sources[i]), this.sourceContents[sources[i]]);
          }
        };
        SourceNode.prototype.toString = function SourceNode_toString() {
          var str = "";
          this.walk(function(chunk) {
            str += chunk;
          });
          return str;
        };
        SourceNode.prototype.toStringWithSourceMap = function SourceNode_toStringWithSourceMap(aArgs) {
          var generated = {
            code: "",
            line: 1,
            column: 0
          };
          var map = new SourceMapGenerator(aArgs);
          var sourceMappingActive = false;
          var lastOriginalSource = null;
          var lastOriginalLine = null;
          var lastOriginalColumn = null;
          var lastOriginalName = null;
          this.walk(function(chunk, original) {
            generated.code += chunk;
            if (original.source !== null && original.line !== null && original.column !== null) {
              if (lastOriginalSource !== original.source || lastOriginalLine !== original.line || lastOriginalColumn !== original.column || lastOriginalName !== original.name) {
                map.addMapping({
                  source: original.source,
                  original: {
                    line: original.line,
                    column: original.column
                  },
                  generated: {
                    line: generated.line,
                    column: generated.column
                  },
                  name: original.name
                });
              }
              lastOriginalSource = original.source;
              lastOriginalLine = original.line;
              lastOriginalColumn = original.column;
              lastOriginalName = original.name;
              sourceMappingActive = true;
            } else if (sourceMappingActive) {
              map.addMapping({generated: {
                  line: generated.line,
                  column: generated.column
                }});
              lastOriginalSource = null;
              sourceMappingActive = false;
            }
            chunk.match(REGEX_CHARACTER).forEach(function(ch, idx, array) {
              if (REGEX_NEWLINE.test(ch)) {
                generated.line++;
                generated.column = 0;
                if (idx + 1 === array.length) {
                  lastOriginalSource = null;
                  sourceMappingActive = false;
                } else if (sourceMappingActive) {
                  map.addMapping({
                    source: original.source,
                    original: {
                      line: original.line,
                      column: original.column
                    },
                    generated: {
                      line: generated.line,
                      column: generated.column
                    },
                    name: original.name
                  });
                }
              } else {
                generated.column += ch.length;
              }
            });
          });
          this.walkSourceContents(function(sourceFile, sourceContent) {
            map.setSourceContent(sourceFile, sourceContent);
          });
          return {
            code: generated.code,
            map: map
          };
        };
        exports.SourceNode = SourceNode;
      });
      define('source-map/util', function(require, exports, module) {
        function getArg(aArgs, aName, aDefaultValue) {
          if (aName in aArgs) {
            return aArgs[aName];
          } else if (arguments.length === 3) {
            return aDefaultValue;
          } else {
            throw new Error('"' + aName + '" is a required argument.');
          }
        }
        exports.getArg = getArg;
        var urlRegexp = /^(?:([\w+\-.]+):)?\/\/(?:(\w+:\w+)@)?([\w.]*)(?::(\d+))?(\S*)$/;
        var dataUrlRegexp = /^data:.+\,.+$/;
        function urlParse(aUrl) {
          var match = aUrl.match(urlRegexp);
          if (!match) {
            return null;
          }
          return {
            scheme: match[1],
            auth: match[2],
            host: match[3],
            port: match[4],
            path: match[5]
          };
        }
        exports.urlParse = urlParse;
        function urlGenerate(aParsedUrl) {
          var url = '';
          if (aParsedUrl.scheme) {
            url += aParsedUrl.scheme + ':';
          }
          url += '//';
          if (aParsedUrl.auth) {
            url += aParsedUrl.auth + '@';
          }
          if (aParsedUrl.host) {
            url += aParsedUrl.host;
          }
          if (aParsedUrl.port) {
            url += ":" + aParsedUrl.port;
          }
          if (aParsedUrl.path) {
            url += aParsedUrl.path;
          }
          return url;
        }
        exports.urlGenerate = urlGenerate;
        function normalize(aPath) {
          var path = aPath;
          var url = urlParse(aPath);
          if (url) {
            if (!url.path) {
              return aPath;
            }
            path = url.path;
          }
          var isAbsolute = (path.charAt(0) === '/');
          var parts = path.split(/\/+/);
          for (var part,
              up = 0,
              i = parts.length - 1; i >= 0; i--) {
            part = parts[i];
            if (part === '.') {
              parts.splice(i, 1);
            } else if (part === '..') {
              up++;
            } else if (up > 0) {
              if (part === '') {
                parts.splice(i + 1, up);
                up = 0;
              } else {
                parts.splice(i, 2);
                up--;
              }
            }
          }
          path = parts.join('/');
          if (path === '') {
            path = isAbsolute ? '/' : '.';
          }
          if (url) {
            url.path = path;
            return urlGenerate(url);
          }
          return path;
        }
        exports.normalize = normalize;
        function join(aRoot, aPath) {
          var aPathUrl = urlParse(aPath);
          var aRootUrl = urlParse(aRoot);
          if (aRootUrl) {
            aRoot = aRootUrl.path || '/';
          }
          if (aPathUrl && !aPathUrl.scheme) {
            if (aRootUrl) {
              aPathUrl.scheme = aRootUrl.scheme;
            }
            return urlGenerate(aPathUrl);
          }
          if (aPathUrl || aPath.match(dataUrlRegexp)) {
            return aPath;
          }
          if (aRootUrl && !aRootUrl.host && !aRootUrl.path) {
            aRootUrl.host = aPath;
            return urlGenerate(aRootUrl);
          }
          var joined = aPath.charAt(0) === '/' ? aPath : normalize(aRoot.replace(/\/+$/, '') + '/' + aPath);
          if (aRootUrl) {
            aRootUrl.path = joined;
            return urlGenerate(aRootUrl);
          }
          return joined;
        }
        exports.join = join;
        function toSetString(aStr) {
          return '$' + aStr;
        }
        exports.toSetString = toSetString;
        function fromSetString(aStr) {
          return aStr.substr(1);
        }
        exports.fromSetString = fromSetString;
        function relative(aRoot, aPath) {
          aRoot = aRoot.replace(/\/$/, '');
          var url = urlParse(aRoot);
          if (aPath.charAt(0) == "/" && url && url.path == "/") {
            return aPath.slice(1);
          }
          return aPath.indexOf(aRoot + '/') === 0 ? aPath.substr(aRoot.length + 1) : aPath;
        }
        exports.relative = relative;
        function strcmp(aStr1, aStr2) {
          var s1 = aStr1 || "";
          var s2 = aStr2 || "";
          return (s1 > s2) - (s1 < s2);
        }
        function compareByOriginalPositions(mappingA, mappingB, onlyCompareOriginal) {
          var cmp;
          cmp = strcmp(mappingA.source, mappingB.source);
          if (cmp) {
            return cmp;
          }
          cmp = mappingA.originalLine - mappingB.originalLine;
          if (cmp) {
            return cmp;
          }
          cmp = mappingA.originalColumn - mappingB.originalColumn;
          if (cmp || onlyCompareOriginal) {
            return cmp;
          }
          cmp = strcmp(mappingA.name, mappingB.name);
          if (cmp) {
            return cmp;
          }
          cmp = mappingA.generatedLine - mappingB.generatedLine;
          if (cmp) {
            return cmp;
          }
          return mappingA.generatedColumn - mappingB.generatedColumn;
        }
        ;
        exports.compareByOriginalPositions = compareByOriginalPositions;
        function compareByGeneratedPositions(mappingA, mappingB, onlyCompareGenerated) {
          var cmp;
          cmp = mappingA.generatedLine - mappingB.generatedLine;
          if (cmp) {
            return cmp;
          }
          cmp = mappingA.generatedColumn - mappingB.generatedColumn;
          if (cmp || onlyCompareGenerated) {
            return cmp;
          }
          cmp = strcmp(mappingA.source, mappingB.source);
          if (cmp) {
            return cmp;
          }
          cmp = mappingA.originalLine - mappingB.originalLine;
          if (cmp) {
            return cmp;
          }
          cmp = mappingA.originalColumn - mappingB.originalColumn;
          if (cmp) {
            return cmp;
          }
          return strcmp(mappingA.name, mappingB.name);
        }
        ;
        exports.compareByGeneratedPositions = compareByGeneratedPositions;
      });
      define('source-map', function(require, exports, module) {
        exports.SourceMapGenerator = require("./source-map/source-map-generator").SourceMapGenerator;
        exports.SourceMapConsumer = require("./source-map/source-map-consumer").SourceMapConsumer;
        exports.SourceNode = require("./source-map/source-node").SourceNode;
      });
      define('uglifyjs2', ['exports', 'source-map', 'logger', 'env!env/file'], function(exports, MOZ_SourceMap, logger, rjsFile) {
        "use strict";
        function array_to_hash(a) {
          var ret = Object.create(null);
          for (var i = 0; i < a.length; ++i)
            ret[a[i]] = true;
          return ret;
        }
        ;
        function slice(a, start) {
          return Array.prototype.slice.call(a, start || 0);
        }
        ;
        function characters(str) {
          return str.split("");
        }
        ;
        function member(name, array) {
          for (var i = array.length; --i >= 0; )
            if (array[i] == name)
              return true;
          return false;
        }
        ;
        function find_if(func, array) {
          for (var i = 0,
              n = array.length; i < n; ++i) {
            if (func(array[i]))
              return array[i];
          }
        }
        ;
        function repeat_string(str, i) {
          if (i <= 0)
            return "";
          if (i == 1)
            return str;
          var d = repeat_string(str, i >> 1);
          d += d;
          if (i & 1)
            d += str;
          return d;
        }
        ;
        function DefaultsError(msg, defs) {
          Error.call(this, msg);
          this.msg = msg;
          this.defs = defs;
        }
        ;
        DefaultsError.prototype = Object.create(Error.prototype);
        DefaultsError.prototype.constructor = DefaultsError;
        DefaultsError.croak = function(msg, defs) {
          throw new DefaultsError(msg, defs);
        };
        function defaults(args, defs, croak) {
          if (args === true)
            args = {};
          var ret = args || {};
          if (croak)
            for (var i in ret)
              if (ret.hasOwnProperty(i) && !defs.hasOwnProperty(i))
                DefaultsError.croak("`" + i + "` is not a supported option", defs);
          for (var i in defs)
            if (defs.hasOwnProperty(i)) {
              ret[i] = (args && args.hasOwnProperty(i)) ? args[i] : defs[i];
            }
          return ret;
        }
        ;
        function merge(obj, ext) {
          for (var i in ext)
            if (ext.hasOwnProperty(i)) {
              obj[i] = ext[i];
            }
          return obj;
        }
        ;
        function noop() {}
        ;
        var MAP = (function() {
          function MAP(a, f, backwards) {
            var ret = [],
                top = [],
                i;
            function doit() {
              var val = f(a[i], i);
              var is_last = val instanceof Last;
              if (is_last)
                val = val.v;
              if (val instanceof AtTop) {
                val = val.v;
                if (val instanceof Splice) {
                  top.push.apply(top, backwards ? val.v.slice().reverse() : val.v);
                } else {
                  top.push(val);
                }
              } else if (val !== skip) {
                if (val instanceof Splice) {
                  ret.push.apply(ret, backwards ? val.v.slice().reverse() : val.v);
                } else {
                  ret.push(val);
                }
              }
              return is_last;
            }
            ;
            if (a instanceof Array) {
              if (backwards) {
                for (i = a.length; --i >= 0; )
                  if (doit())
                    break;
                ret.reverse();
                top.reverse();
              } else {
                for (i = 0; i < a.length; ++i)
                  if (doit())
                    break;
              }
            } else {
              for (i in a)
                if (a.hasOwnProperty(i))
                  if (doit())
                    break;
            }
            return top.concat(ret);
          }
          ;
          MAP.at_top = function(val) {
            return new AtTop(val);
          };
          MAP.splice = function(val) {
            return new Splice(val);
          };
          MAP.last = function(val) {
            return new Last(val);
          };
          var skip = MAP.skip = {};
          function AtTop(val) {
            this.v = val;
          }
          ;
          function Splice(val) {
            this.v = val;
          }
          ;
          function Last(val) {
            this.v = val;
          }
          ;
          return MAP;
        })();
        function push_uniq(array, el) {
          if (array.indexOf(el) < 0)
            array.push(el);
        }
        ;
        function string_template(text, props) {
          return text.replace(/\{(.+?)\}/g, function(str, p) {
            return props[p];
          });
        }
        ;
        function remove(array, el) {
          for (var i = array.length; --i >= 0; ) {
            if (array[i] === el)
              array.splice(i, 1);
          }
        }
        ;
        function mergeSort(array, cmp) {
          if (array.length < 2)
            return array.slice();
          function merge(a, b) {
            var r = [],
                ai = 0,
                bi = 0,
                i = 0;
            while (ai < a.length && bi < b.length) {
              cmp(a[ai], b[bi]) <= 0 ? r[i++] = a[ai++] : r[i++] = b[bi++];
            }
            if (ai < a.length)
              r.push.apply(r, a.slice(ai));
            if (bi < b.length)
              r.push.apply(r, b.slice(bi));
            return r;
          }
          ;
          function _ms(a) {
            if (a.length <= 1)
              return a;
            var m = Math.floor(a.length / 2),
                left = a.slice(0, m),
                right = a.slice(m);
            left = _ms(left);
            right = _ms(right);
            return merge(left, right);
          }
          ;
          return _ms(array);
        }
        ;
        function set_difference(a, b) {
          return a.filter(function(el) {
            return b.indexOf(el) < 0;
          });
        }
        ;
        function set_intersection(a, b) {
          return a.filter(function(el) {
            return b.indexOf(el) >= 0;
          });
        }
        ;
        function makePredicate(words) {
          if (!(words instanceof Array))
            words = words.split(" ");
          var f = "",
              cats = [];
          out: for (var i = 0; i < words.length; ++i) {
            for (var j = 0; j < cats.length; ++j)
              if (cats[j][0].length == words[i].length) {
                cats[j].push(words[i]);
                continue out;
              }
            cats.push([words[i]]);
          }
          function compareTo(arr) {
            if (arr.length == 1)
              return f += "return str === " + JSON.stringify(arr[0]) + ";";
            f += "switch(str){";
            for (var i = 0; i < arr.length; ++i)
              f += "case " + JSON.stringify(arr[i]) + ":";
            f += "return true}return false;";
          }
          if (cats.length > 3) {
            cats.sort(function(a, b) {
              return b.length - a.length;
            });
            f += "switch(str.length){";
            for (var i = 0; i < cats.length; ++i) {
              var cat = cats[i];
              f += "case " + cat[0].length + ":";
              compareTo(cat);
            }
            f += "}";
          } else {
            compareTo(words);
          }
          return new Function("str", f);
        }
        ;
        function all(array, predicate) {
          for (var i = array.length; --i >= 0; )
            if (!predicate(array[i]))
              return false;
          return true;
        }
        ;
        function Dictionary() {
          this._values = Object.create(null);
          this._size = 0;
        }
        ;
        Dictionary.prototype = {
          set: function(key, val) {
            if (!this.has(key))
              ++this._size;
            this._values["$" + key] = val;
            return this;
          },
          add: function(key, val) {
            if (this.has(key)) {
              this.get(key).push(val);
            } else {
              this.set(key, [val]);
            }
            return this;
          },
          get: function(key) {
            return this._values["$" + key];
          },
          del: function(key) {
            if (this.has(key)) {
              --this._size;
              delete this._values["$" + key];
            }
            return this;
          },
          has: function(key) {
            return ("$" + key) in this._values;
          },
          each: function(f) {
            for (var i in this._values)
              f(this._values[i], i.substr(1));
          },
          size: function() {
            return this._size;
          },
          map: function(f) {
            var ret = [];
            for (var i in this._values)
              ret.push(f(this._values[i], i.substr(1)));
            return ret;
          }
        };
        "use strict";
        function DEFNODE(type, props, methods, base) {
          if (arguments.length < 4)
            base = AST_Node;
          if (!props)
            props = [];
          else
            props = props.split(/\s+/);
          var self_props = props;
          if (base && base.PROPS)
            props = props.concat(base.PROPS);
          var code = "return function AST_" + type + "(props){ if (props) { ";
          for (var i = props.length; --i >= 0; ) {
            code += "this." + props[i] + " = props." + props[i] + ";";
          }
          var proto = base && new base;
          if (proto && proto.initialize || (methods && methods.initialize))
            code += "this.initialize();";
          code += "}}";
          var ctor = new Function(code)();
          if (proto) {
            ctor.prototype = proto;
            ctor.BASE = base;
          }
          if (base)
            base.SUBCLASSES.push(ctor);
          ctor.prototype.CTOR = ctor;
          ctor.PROPS = props || null;
          ctor.SELF_PROPS = self_props;
          ctor.SUBCLASSES = [];
          if (type) {
            ctor.prototype.TYPE = ctor.TYPE = type;
          }
          if (methods)
            for (i in methods)
              if (methods.hasOwnProperty(i)) {
                if (/^\$/.test(i)) {
                  ctor[i.substr(1)] = methods[i];
                } else {
                  ctor.prototype[i] = methods[i];
                }
              }
          ctor.DEFMETHOD = function(name, method) {
            this.prototype[name] = method;
          };
          return ctor;
        }
        ;
        var AST_Token = DEFNODE("Token", "type value line col pos endpos nlb comments_before file", {}, null);
        var AST_Node = DEFNODE("Node", "start end", {
          clone: function() {
            return new this.CTOR(this);
          },
          $documentation: "Base class of all AST nodes",
          $propdoc: {
            start: "[AST_Token] The first token of this node",
            end: "[AST_Token] The last token of this node"
          },
          _walk: function(visitor) {
            return visitor._visit(this);
          },
          walk: function(visitor) {
            return this._walk(visitor);
          }
        }, null);
        AST_Node.warn_function = null;
        AST_Node.warn = function(txt, props) {
          if (AST_Node.warn_function)
            AST_Node.warn_function(string_template(txt, props));
        };
        var AST_Statement = DEFNODE("Statement", null, {$documentation: "Base class of all statements"});
        var AST_Debugger = DEFNODE("Debugger", null, {$documentation: "Represents a debugger statement"}, AST_Statement);
        var AST_Directive = DEFNODE("Directive", "value scope", {
          $documentation: "Represents a directive, like \"use strict\";",
          $propdoc: {
            value: "[string] The value of this directive as a plain string (it's not an AST_String!)",
            scope: "[AST_Scope/S] The scope that this directive affects"
          }
        }, AST_Statement);
        var AST_SimpleStatement = DEFNODE("SimpleStatement", "body", {
          $documentation: "A statement consisting of an expression, i.e. a = 1 + 2",
          $propdoc: {body: "[AST_Node] an expression node (should not be instanceof AST_Statement)"},
          _walk: function(visitor) {
            return visitor._visit(this, function() {
              this.body._walk(visitor);
            });
          }
        }, AST_Statement);
        function walk_body(node, visitor) {
          if (node.body instanceof AST_Statement) {
            node.body._walk(visitor);
          } else
            node.body.forEach(function(stat) {
              stat._walk(visitor);
            });
        }
        ;
        var AST_Block = DEFNODE("Block", "body", {
          $documentation: "A body of statements (usually bracketed)",
          $propdoc: {body: "[AST_Statement*] an array of statements"},
          _walk: function(visitor) {
            return visitor._visit(this, function() {
              walk_body(this, visitor);
            });
          }
        }, AST_Statement);
        var AST_BlockStatement = DEFNODE("BlockStatement", null, {$documentation: "A block statement"}, AST_Block);
        var AST_EmptyStatement = DEFNODE("EmptyStatement", null, {
          $documentation: "The empty statement (empty block or simply a semicolon)",
          _walk: function(visitor) {
            return visitor._visit(this);
          }
        }, AST_Statement);
        var AST_StatementWithBody = DEFNODE("StatementWithBody", "body", {
          $documentation: "Base class for all statements that contain one nested body: `For`, `ForIn`, `Do`, `While`, `With`",
          $propdoc: {body: "[AST_Statement] the body; this should always be present, even if it's an AST_EmptyStatement"},
          _walk: function(visitor) {
            return visitor._visit(this, function() {
              this.body._walk(visitor);
            });
          }
        }, AST_Statement);
        var AST_LabeledStatement = DEFNODE("LabeledStatement", "label", {
          $documentation: "Statement with a label",
          $propdoc: {label: "[AST_Label] a label definition"},
          _walk: function(visitor) {
            return visitor._visit(this, function() {
              this.label._walk(visitor);
              this.body._walk(visitor);
            });
          }
        }, AST_StatementWithBody);
        var AST_IterationStatement = DEFNODE("IterationStatement", null, {$documentation: "Internal class.  All loops inherit from it."}, AST_StatementWithBody);
        var AST_DWLoop = DEFNODE("DWLoop", "condition", {
          $documentation: "Base class for do/while statements",
          $propdoc: {condition: "[AST_Node] the loop condition.  Should not be instanceof AST_Statement"},
          _walk: function(visitor) {
            return visitor._visit(this, function() {
              this.condition._walk(visitor);
              this.body._walk(visitor);
            });
          }
        }, AST_IterationStatement);
        var AST_Do = DEFNODE("Do", null, {$documentation: "A `do` statement"}, AST_DWLoop);
        var AST_While = DEFNODE("While", null, {$documentation: "A `while` statement"}, AST_DWLoop);
        var AST_For = DEFNODE("For", "init condition step", {
          $documentation: "A `for` statement",
          $propdoc: {
            init: "[AST_Node?] the `for` initialization code, or null if empty",
            condition: "[AST_Node?] the `for` termination clause, or null if empty",
            step: "[AST_Node?] the `for` update clause, or null if empty"
          },
          _walk: function(visitor) {
            return visitor._visit(this, function() {
              if (this.init)
                this.init._walk(visitor);
              if (this.condition)
                this.condition._walk(visitor);
              if (this.step)
                this.step._walk(visitor);
              this.body._walk(visitor);
            });
          }
        }, AST_IterationStatement);
        var AST_ForIn = DEFNODE("ForIn", "init name object", {
          $documentation: "A `for ... in` statement",
          $propdoc: {
            init: "[AST_Node] the `for/in` initialization code",
            name: "[AST_SymbolRef?] the loop variable, only if `init` is AST_Var",
            object: "[AST_Node] the object that we're looping through"
          },
          _walk: function(visitor) {
            return visitor._visit(this, function() {
              this.init._walk(visitor);
              this.object._walk(visitor);
              this.body._walk(visitor);
            });
          }
        }, AST_IterationStatement);
        var AST_With = DEFNODE("With", "expression", {
          $documentation: "A `with` statement",
          $propdoc: {expression: "[AST_Node] the `with` expression"},
          _walk: function(visitor) {
            return visitor._visit(this, function() {
              this.expression._walk(visitor);
              this.body._walk(visitor);
            });
          }
        }, AST_StatementWithBody);
        var AST_Scope = DEFNODE("Scope", "directives variables functions uses_with uses_eval parent_scope enclosed cname", {
          $documentation: "Base class for all statements introducing a lexical scope",
          $propdoc: {
            directives: "[string*/S] an array of directives declared in this scope",
            variables: "[Object/S] a map of name -> SymbolDef for all variables/functions defined in this scope",
            functions: "[Object/S] like `variables`, but only lists function declarations",
            uses_with: "[boolean/S] tells whether this scope uses the `with` statement",
            uses_eval: "[boolean/S] tells whether this scope contains a direct call to the global `eval`",
            parent_scope: "[AST_Scope?/S] link to the parent scope",
            enclosed: "[SymbolDef*/S] a list of all symbol definitions that are accessed from this scope or any subscopes",
            cname: "[integer/S] current index for mangling variables (used internally by the mangler)"
          }
        }, AST_Block);
        var AST_Toplevel = DEFNODE("Toplevel", "globals", {
          $documentation: "The toplevel scope",
          $propdoc: {globals: "[Object/S] a map of name -> SymbolDef for all undeclared names"},
          wrap_enclose: function(arg_parameter_pairs) {
            var self = this;
            var args = [];
            var parameters = [];
            arg_parameter_pairs.forEach(function(pair) {
              var splitAt = pair.lastIndexOf(":");
              args.push(pair.substr(0, splitAt));
              parameters.push(pair.substr(splitAt + 1));
            });
            var wrapped_tl = "(function(" + parameters.join(",") + "){ '$ORIG'; })(" + args.join(",") + ")";
            wrapped_tl = parse(wrapped_tl);
            wrapped_tl = wrapped_tl.transform(new TreeTransformer(function before(node) {
              if (node instanceof AST_Directive && node.value == "$ORIG") {
                return MAP.splice(self.body);
              }
            }));
            return wrapped_tl;
          },
          wrap_commonjs: function(name, export_all) {
            var self = this;
            var to_export = [];
            if (export_all) {
              self.figure_out_scope();
              self.walk(new TreeWalker(function(node) {
                if (node instanceof AST_SymbolDeclaration && node.definition().global) {
                  if (!find_if(function(n) {
                    return n.name == node.name;
                  }, to_export))
                    to_export.push(node);
                }
              }));
            }
            var wrapped_tl = "(function(exports, global){ global['" + name + "'] = exports; '$ORIG'; '$EXPORTS'; }({}, (function(){return this}())))";
            wrapped_tl = parse(wrapped_tl);
            wrapped_tl = wrapped_tl.transform(new TreeTransformer(function before(node) {
              if (node instanceof AST_SimpleStatement) {
                node = node.body;
                if (node instanceof AST_String)
                  switch (node.getValue()) {
                    case "$ORIG":
                      return MAP.splice(self.body);
                    case "$EXPORTS":
                      var body = [];
                      to_export.forEach(function(sym) {
                        body.push(new AST_SimpleStatement({body: new AST_Assign({
                            left: new AST_Sub({
                              expression: new AST_SymbolRef({name: "exports"}),
                              property: new AST_String({value: sym.name})
                            }),
                            operator: "=",
                            right: new AST_SymbolRef(sym)
                          })}));
                      });
                      return MAP.splice(body);
                  }
              }
            }));
            return wrapped_tl;
          }
        }, AST_Scope);
        var AST_Lambda = DEFNODE("Lambda", "name argnames uses_arguments", {
          $documentation: "Base class for functions",
          $propdoc: {
            name: "[AST_SymbolDeclaration?] the name of this function",
            argnames: "[AST_SymbolFunarg*] array of function arguments",
            uses_arguments: "[boolean/S] tells whether this function accesses the arguments array"
          },
          _walk: function(visitor) {
            return visitor._visit(this, function() {
              if (this.name)
                this.name._walk(visitor);
              this.argnames.forEach(function(arg) {
                arg._walk(visitor);
              });
              walk_body(this, visitor);
            });
          }
        }, AST_Scope);
        var AST_Accessor = DEFNODE("Accessor", null, {$documentation: "A setter/getter function.  The `name` property is always null."}, AST_Lambda);
        var AST_Function = DEFNODE("Function", null, {$documentation: "A function expression"}, AST_Lambda);
        var AST_Defun = DEFNODE("Defun", null, {$documentation: "A function definition"}, AST_Lambda);
        var AST_Jump = DEFNODE("Jump", null, {$documentation: "Base class for “jumps” (for now that's `return`, `throw`, `break` and `continue`)"}, AST_Statement);
        var AST_Exit = DEFNODE("Exit", "value", {
          $documentation: "Base class for “exits” (`return` and `throw`)",
          $propdoc: {value: "[AST_Node?] the value returned or thrown by this statement; could be null for AST_Return"},
          _walk: function(visitor) {
            return visitor._visit(this, this.value && function() {
              this.value._walk(visitor);
            });
          }
        }, AST_Jump);
        var AST_Return = DEFNODE("Return", null, {$documentation: "A `return` statement"}, AST_Exit);
        var AST_Throw = DEFNODE("Throw", null, {$documentation: "A `throw` statement"}, AST_Exit);
        var AST_LoopControl = DEFNODE("LoopControl", "label", {
          $documentation: "Base class for loop control statements (`break` and `continue`)",
          $propdoc: {label: "[AST_LabelRef?] the label, or null if none"},
          _walk: function(visitor) {
            return visitor._visit(this, this.label && function() {
              this.label._walk(visitor);
            });
          }
        }, AST_Jump);
        var AST_Break = DEFNODE("Break", null, {$documentation: "A `break` statement"}, AST_LoopControl);
        var AST_Continue = DEFNODE("Continue", null, {$documentation: "A `continue` statement"}, AST_LoopControl);
        var AST_If = DEFNODE("If", "condition alternative", {
          $documentation: "A `if` statement",
          $propdoc: {
            condition: "[AST_Node] the `if` condition",
            alternative: "[AST_Statement?] the `else` part, or null if not present"
          },
          _walk: function(visitor) {
            return visitor._visit(this, function() {
              this.condition._walk(visitor);
              this.body._walk(visitor);
              if (this.alternative)
                this.alternative._walk(visitor);
            });
          }
        }, AST_StatementWithBody);
        var AST_Switch = DEFNODE("Switch", "expression", {
          $documentation: "A `switch` statement",
          $propdoc: {expression: "[AST_Node] the `switch` “discriminant”"},
          _walk: function(visitor) {
            return visitor._visit(this, function() {
              this.expression._walk(visitor);
              walk_body(this, visitor);
            });
          }
        }, AST_Block);
        var AST_SwitchBranch = DEFNODE("SwitchBranch", null, {$documentation: "Base class for `switch` branches"}, AST_Block);
        var AST_Default = DEFNODE("Default", null, {$documentation: "A `default` switch branch"}, AST_SwitchBranch);
        var AST_Case = DEFNODE("Case", "expression", {
          $documentation: "A `case` switch branch",
          $propdoc: {expression: "[AST_Node] the `case` expression"},
          _walk: function(visitor) {
            return visitor._visit(this, function() {
              this.expression._walk(visitor);
              walk_body(this, visitor);
            });
          }
        }, AST_SwitchBranch);
        var AST_Try = DEFNODE("Try", "bcatch bfinally", {
          $documentation: "A `try` statement",
          $propdoc: {
            bcatch: "[AST_Catch?] the catch block, or null if not present",
            bfinally: "[AST_Finally?] the finally block, or null if not present"
          },
          _walk: function(visitor) {
            return visitor._visit(this, function() {
              walk_body(this, visitor);
              if (this.bcatch)
                this.bcatch._walk(visitor);
              if (this.bfinally)
                this.bfinally._walk(visitor);
            });
          }
        }, AST_Block);
        var AST_Catch = DEFNODE("Catch", "argname", {
          $documentation: "A `catch` node; only makes sense as part of a `try` statement",
          $propdoc: {argname: "[AST_SymbolCatch] symbol for the exception"},
          _walk: function(visitor) {
            return visitor._visit(this, function() {
              this.argname._walk(visitor);
              walk_body(this, visitor);
            });
          }
        }, AST_Block);
        var AST_Finally = DEFNODE("Finally", null, {$documentation: "A `finally` node; only makes sense as part of a `try` statement"}, AST_Block);
        var AST_Definitions = DEFNODE("Definitions", "definitions", {
          $documentation: "Base class for `var` or `const` nodes (variable declarations/initializations)",
          $propdoc: {definitions: "[AST_VarDef*] array of variable definitions"},
          _walk: function(visitor) {
            return visitor._visit(this, function() {
              this.definitions.forEach(function(def) {
                def._walk(visitor);
              });
            });
          }
        }, AST_Statement);
        var AST_Var = DEFNODE("Var", null, {$documentation: "A `var` statement"}, AST_Definitions);
        var AST_Const = DEFNODE("Const", null, {$documentation: "A `const` statement"}, AST_Definitions);
        var AST_VarDef = DEFNODE("VarDef", "name value", {
          $documentation: "A variable declaration; only appears in a AST_Definitions node",
          $propdoc: {
            name: "[AST_SymbolVar|AST_SymbolConst] name of the variable",
            value: "[AST_Node?] initializer, or null of there's no initializer"
          },
          _walk: function(visitor) {
            return visitor._visit(this, function() {
              this.name._walk(visitor);
              if (this.value)
                this.value._walk(visitor);
            });
          }
        });
        var AST_Call = DEFNODE("Call", "expression args", {
          $documentation: "A function call expression",
          $propdoc: {
            expression: "[AST_Node] expression to invoke as function",
            args: "[AST_Node*] array of arguments"
          },
          _walk: function(visitor) {
            return visitor._visit(this, function() {
              this.expression._walk(visitor);
              this.args.forEach(function(arg) {
                arg._walk(visitor);
              });
            });
          }
        });
        var AST_New = DEFNODE("New", null, {$documentation: "An object instantiation.  Derives from a function call since it has exactly the same properties"}, AST_Call);
        var AST_Seq = DEFNODE("Seq", "car cdr", {
          $documentation: "A sequence expression (two comma-separated expressions)",
          $propdoc: {
            car: "[AST_Node] first element in sequence",
            cdr: "[AST_Node] second element in sequence"
          },
          $cons: function(x, y) {
            var seq = new AST_Seq(x);
            seq.car = x;
            seq.cdr = y;
            return seq;
          },
          $from_array: function(array) {
            if (array.length == 0)
              return null;
            if (array.length == 1)
              return array[0].clone();
            var list = null;
            for (var i = array.length; --i >= 0; ) {
              list = AST_Seq.cons(array[i], list);
            }
            var p = list;
            while (p) {
              if (p.cdr && !p.cdr.cdr) {
                p.cdr = p.cdr.car;
                break;
              }
              p = p.cdr;
            }
            return list;
          },
          to_array: function() {
            var p = this,
                a = [];
            while (p) {
              a.push(p.car);
              if (p.cdr && !(p.cdr instanceof AST_Seq)) {
                a.push(p.cdr);
                break;
              }
              p = p.cdr;
            }
            return a;
          },
          add: function(node) {
            var p = this;
            while (p) {
              if (!(p.cdr instanceof AST_Seq)) {
                var cell = AST_Seq.cons(p.cdr, node);
                return p.cdr = cell;
              }
              p = p.cdr;
            }
          },
          _walk: function(visitor) {
            return visitor._visit(this, function() {
              this.car._walk(visitor);
              if (this.cdr)
                this.cdr._walk(visitor);
            });
          }
        });
        var AST_PropAccess = DEFNODE("PropAccess", "expression property", {
          $documentation: "Base class for property access expressions, i.e. `a.foo` or `a[\"foo\"]`",
          $propdoc: {
            expression: "[AST_Node] the “container” expression",
            property: "[AST_Node|string] the property to access.  For AST_Dot this is always a plain string, while for AST_Sub it's an arbitrary AST_Node"
          }
        });
        var AST_Dot = DEFNODE("Dot", null, {
          $documentation: "A dotted property access expression",
          _walk: function(visitor) {
            return visitor._visit(this, function() {
              this.expression._walk(visitor);
            });
          }
        }, AST_PropAccess);
        var AST_Sub = DEFNODE("Sub", null, {
          $documentation: "Index-style property access, i.e. `a[\"foo\"]`",
          _walk: function(visitor) {
            return visitor._visit(this, function() {
              this.expression._walk(visitor);
              this.property._walk(visitor);
            });
          }
        }, AST_PropAccess);
        var AST_Unary = DEFNODE("Unary", "operator expression", {
          $documentation: "Base class for unary expressions",
          $propdoc: {
            operator: "[string] the operator",
            expression: "[AST_Node] expression that this unary operator applies to"
          },
          _walk: function(visitor) {
            return visitor._visit(this, function() {
              this.expression._walk(visitor);
            });
          }
        });
        var AST_UnaryPrefix = DEFNODE("UnaryPrefix", null, {$documentation: "Unary prefix expression, i.e. `typeof i` or `++i`"}, AST_Unary);
        var AST_UnaryPostfix = DEFNODE("UnaryPostfix", null, {$documentation: "Unary postfix expression, i.e. `i++`"}, AST_Unary);
        var AST_Binary = DEFNODE("Binary", "left operator right", {
          $documentation: "Binary expression, i.e. `a + b`",
          $propdoc: {
            left: "[AST_Node] left-hand side expression",
            operator: "[string] the operator",
            right: "[AST_Node] right-hand side expression"
          },
          _walk: function(visitor) {
            return visitor._visit(this, function() {
              this.left._walk(visitor);
              this.right._walk(visitor);
            });
          }
        });
        var AST_Conditional = DEFNODE("Conditional", "condition consequent alternative", {
          $documentation: "Conditional expression using the ternary operator, i.e. `a ? b : c`",
          $propdoc: {
            condition: "[AST_Node]",
            consequent: "[AST_Node]",
            alternative: "[AST_Node]"
          },
          _walk: function(visitor) {
            return visitor._visit(this, function() {
              this.condition._walk(visitor);
              this.consequent._walk(visitor);
              this.alternative._walk(visitor);
            });
          }
        });
        var AST_Assign = DEFNODE("Assign", null, {$documentation: "An assignment expression — `a = b + 5`"}, AST_Binary);
        var AST_Array = DEFNODE("Array", "elements", {
          $documentation: "An array literal",
          $propdoc: {elements: "[AST_Node*] array of elements"},
          _walk: function(visitor) {
            return visitor._visit(this, function() {
              this.elements.forEach(function(el) {
                el._walk(visitor);
              });
            });
          }
        });
        var AST_Object = DEFNODE("Object", "properties", {
          $documentation: "An object literal",
          $propdoc: {properties: "[AST_ObjectProperty*] array of properties"},
          _walk: function(visitor) {
            return visitor._visit(this, function() {
              this.properties.forEach(function(prop) {
                prop._walk(visitor);
              });
            });
          }
        });
        var AST_ObjectProperty = DEFNODE("ObjectProperty", "key value", {
          $documentation: "Base class for literal object properties",
          $propdoc: {
            key: "[string] the property name converted to a string for ObjectKeyVal.  For setters and getters this is an arbitrary AST_Node.",
            value: "[AST_Node] property value.  For setters and getters this is an AST_Function."
          },
          _walk: function(visitor) {
            return visitor._visit(this, function() {
              this.value._walk(visitor);
            });
          }
        });
        var AST_ObjectKeyVal = DEFNODE("ObjectKeyVal", null, {$documentation: "A key: value object property"}, AST_ObjectProperty);
        var AST_ObjectSetter = DEFNODE("ObjectSetter", null, {$documentation: "An object setter property"}, AST_ObjectProperty);
        var AST_ObjectGetter = DEFNODE("ObjectGetter", null, {$documentation: "An object getter property"}, AST_ObjectProperty);
        var AST_Symbol = DEFNODE("Symbol", "scope name thedef", {
          $propdoc: {
            name: "[string] name of this symbol",
            scope: "[AST_Scope/S] the current scope (not necessarily the definition scope)",
            thedef: "[SymbolDef/S] the definition of this symbol"
          },
          $documentation: "Base class for all symbols"
        });
        var AST_SymbolAccessor = DEFNODE("SymbolAccessor", null, {$documentation: "The name of a property accessor (setter/getter function)"}, AST_Symbol);
        var AST_SymbolDeclaration = DEFNODE("SymbolDeclaration", "init", {
          $documentation: "A declaration symbol (symbol in var/const, function name or argument, symbol in catch)",
          $propdoc: {init: "[AST_Node*/S] array of initializers for this declaration."}
        }, AST_Symbol);
        var AST_SymbolVar = DEFNODE("SymbolVar", null, {$documentation: "Symbol defining a variable"}, AST_SymbolDeclaration);
        var AST_SymbolConst = DEFNODE("SymbolConst", null, {$documentation: "A constant declaration"}, AST_SymbolDeclaration);
        var AST_SymbolFunarg = DEFNODE("SymbolFunarg", null, {$documentation: "Symbol naming a function argument"}, AST_SymbolVar);
        var AST_SymbolDefun = DEFNODE("SymbolDefun", null, {$documentation: "Symbol defining a function"}, AST_SymbolDeclaration);
        var AST_SymbolLambda = DEFNODE("SymbolLambda", null, {$documentation: "Symbol naming a function expression"}, AST_SymbolDeclaration);
        var AST_SymbolCatch = DEFNODE("SymbolCatch", null, {$documentation: "Symbol naming the exception in catch"}, AST_SymbolDeclaration);
        var AST_Label = DEFNODE("Label", "references", {
          $documentation: "Symbol naming a label (declaration)",
          $propdoc: {references: "[AST_LoopControl*] a list of nodes referring to this label"},
          initialize: function() {
            this.references = [];
            this.thedef = this;
          }
        }, AST_Symbol);
        var AST_SymbolRef = DEFNODE("SymbolRef", null, {$documentation: "Reference to some symbol (not definition/declaration)"}, AST_Symbol);
        var AST_LabelRef = DEFNODE("LabelRef", null, {$documentation: "Reference to a label symbol"}, AST_Symbol);
        var AST_This = DEFNODE("This", null, {$documentation: "The `this` symbol"}, AST_Symbol);
        var AST_Constant = DEFNODE("Constant", null, {
          $documentation: "Base class for all constants",
          getValue: function() {
            return this.value;
          }
        });
        var AST_String = DEFNODE("String", "value", {
          $documentation: "A string literal",
          $propdoc: {value: "[string] the contents of this string"}
        }, AST_Constant);
        var AST_Number = DEFNODE("Number", "value", {
          $documentation: "A number literal",
          $propdoc: {value: "[number] the numeric value"}
        }, AST_Constant);
        var AST_RegExp = DEFNODE("RegExp", "value", {
          $documentation: "A regexp literal",
          $propdoc: {value: "[RegExp] the actual regexp"}
        }, AST_Constant);
        var AST_Atom = DEFNODE("Atom", null, {$documentation: "Base class for atoms"}, AST_Constant);
        var AST_Null = DEFNODE("Null", null, {
          $documentation: "The `null` atom",
          value: null
        }, AST_Atom);
        var AST_NaN = DEFNODE("NaN", null, {
          $documentation: "The impossible value",
          value: 0 / 0
        }, AST_Atom);
        var AST_Undefined = DEFNODE("Undefined", null, {
          $documentation: "The `undefined` value",
          value: (function() {}())
        }, AST_Atom);
        var AST_Hole = DEFNODE("Hole", null, {
          $documentation: "A hole in an array",
          value: (function() {}())
        }, AST_Atom);
        var AST_Infinity = DEFNODE("Infinity", null, {
          $documentation: "The `Infinity` value",
          value: 1 / 0
        }, AST_Atom);
        var AST_Boolean = DEFNODE("Boolean", null, {$documentation: "Base class for booleans"}, AST_Atom);
        var AST_False = DEFNODE("False", null, {
          $documentation: "The `false` atom",
          value: false
        }, AST_Boolean);
        var AST_True = DEFNODE("True", null, {
          $documentation: "The `true` atom",
          value: true
        }, AST_Boolean);
        function TreeWalker(callback) {
          this.visit = callback;
          this.stack = [];
        }
        ;
        TreeWalker.prototype = {
          _visit: function(node, descend) {
            this.stack.push(node);
            var ret = this.visit(node, descend ? function() {
              descend.call(node);
            } : noop);
            if (!ret && descend) {
              descend.call(node);
            }
            this.stack.pop();
            return ret;
          },
          parent: function(n) {
            return this.stack[this.stack.length - 2 - (n || 0)];
          },
          push: function(node) {
            this.stack.push(node);
          },
          pop: function() {
            return this.stack.pop();
          },
          self: function() {
            return this.stack[this.stack.length - 1];
          },
          find_parent: function(type) {
            var stack = this.stack;
            for (var i = stack.length; --i >= 0; ) {
              var x = stack[i];
              if (x instanceof type)
                return x;
            }
          },
          has_directive: function(type) {
            return this.find_parent(AST_Scope).has_directive(type);
          },
          in_boolean_context: function() {
            var stack = this.stack;
            var i = stack.length,
                self = stack[--i];
            while (i > 0) {
              var p = stack[--i];
              if ((p instanceof AST_If && p.condition === self) || (p instanceof AST_Conditional && p.condition === self) || (p instanceof AST_DWLoop && p.condition === self) || (p instanceof AST_For && p.condition === self) || (p instanceof AST_UnaryPrefix && p.operator == "!" && p.expression === self)) {
                return true;
              }
              if (!(p instanceof AST_Binary && (p.operator == "&&" || p.operator == "||")))
                return false;
              self = p;
            }
          },
          loopcontrol_target: function(label) {
            var stack = this.stack;
            if (label)
              for (var i = stack.length; --i >= 0; ) {
                var x = stack[i];
                if (x instanceof AST_LabeledStatement && x.label.name == label.name) {
                  return x.body;
                }
              }
            else
              for (var i = stack.length; --i >= 0; ) {
                var x = stack[i];
                if (x instanceof AST_Switch || x instanceof AST_IterationStatement)
                  return x;
              }
          }
        };
        "use strict";
        var KEYWORDS = 'break case catch const continue debugger default delete do else finally for function if in instanceof new return switch throw try typeof var void while with';
        var KEYWORDS_ATOM = 'false null true';
        var RESERVED_WORDS = 'abstract boolean byte char class double enum export extends final float goto implements import int interface long native package private protected public short static super synchronized this throws transient volatile yield' + " " + KEYWORDS_ATOM + " " + KEYWORDS;
        var KEYWORDS_BEFORE_EXPRESSION = 'return new delete throw else case';
        KEYWORDS = makePredicate(KEYWORDS);
        RESERVED_WORDS = makePredicate(RESERVED_WORDS);
        KEYWORDS_BEFORE_EXPRESSION = makePredicate(KEYWORDS_BEFORE_EXPRESSION);
        KEYWORDS_ATOM = makePredicate(KEYWORDS_ATOM);
        var OPERATOR_CHARS = makePredicate(characters("+-*&%=<>!?|~^"));
        var RE_HEX_NUMBER = /^0x[0-9a-f]+$/i;
        var RE_OCT_NUMBER = /^0[0-7]+$/;
        var RE_DEC_NUMBER = /^\d*\.?\d*(?:e[+-]?\d*(?:\d\.?|\.?\d)\d*)?$/i;
        var OPERATORS = makePredicate(["in", "instanceof", "typeof", "new", "void", "delete", "++", "--", "+", "-", "!", "~", "&", "|", "^", "*", "/", "%", ">>", "<<", ">>>", "<", ">", "<=", ">=", "==", "===", "!=", "!==", "?", "=", "+=", "-=", "/=", "*=", "%=", ">>=", "<<=", ">>>=", "|=", "^=", "&=", "&&", "||"]);
        var WHITESPACE_CHARS = makePredicate(characters(" \u00a0\n\r\t\f\u000b\u200b\u180e\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u202f\u205f\u3000"));
        var PUNC_BEFORE_EXPRESSION = makePredicate(characters("[{(,.;:"));
        var PUNC_CHARS = makePredicate(characters("[]{}(),;:"));
        var REGEXP_MODIFIERS = makePredicate(characters("gmsiy"));
        var UNICODE = {
          letter: new RegExp("[\\u0041-\\u005A\\u0061-\\u007A\\u00AA\\u00B5\\u00BA\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02C1\\u02C6-\\u02D1\\u02E0-\\u02E4\\u02EC\\u02EE\\u0370-\\u0374\\u0376\\u0377\\u037A-\\u037D\\u0386\\u0388-\\u038A\\u038C\\u038E-\\u03A1\\u03A3-\\u03F5\\u03F7-\\u0481\\u048A-\\u0523\\u0531-\\u0556\\u0559\\u0561-\\u0587\\u05D0-\\u05EA\\u05F0-\\u05F2\\u0621-\\u064A\\u066E\\u066F\\u0671-\\u06D3\\u06D5\\u06E5\\u06E6\\u06EE\\u06EF\\u06FA-\\u06FC\\u06FF\\u0710\\u0712-\\u072F\\u074D-\\u07A5\\u07B1\\u07CA-\\u07EA\\u07F4\\u07F5\\u07FA\\u0904-\\u0939\\u093D\\u0950\\u0958-\\u0961\\u0971\\u0972\\u097B-\\u097F\\u0985-\\u098C\\u098F\\u0990\\u0993-\\u09A8\\u09AA-\\u09B0\\u09B2\\u09B6-\\u09B9\\u09BD\\u09CE\\u09DC\\u09DD\\u09DF-\\u09E1\\u09F0\\u09F1\\u0A05-\\u0A0A\\u0A0F\\u0A10\\u0A13-\\u0A28\\u0A2A-\\u0A30\\u0A32\\u0A33\\u0A35\\u0A36\\u0A38\\u0A39\\u0A59-\\u0A5C\\u0A5E\\u0A72-\\u0A74\\u0A85-\\u0A8D\\u0A8F-\\u0A91\\u0A93-\\u0AA8\\u0AAA-\\u0AB0\\u0AB2\\u0AB3\\u0AB5-\\u0AB9\\u0ABD\\u0AD0\\u0AE0\\u0AE1\\u0B05-\\u0B0C\\u0B0F\\u0B10\\u0B13-\\u0B28\\u0B2A-\\u0B30\\u0B32\\u0B33\\u0B35-\\u0B39\\u0B3D\\u0B5C\\u0B5D\\u0B5F-\\u0B61\\u0B71\\u0B83\\u0B85-\\u0B8A\\u0B8E-\\u0B90\\u0B92-\\u0B95\\u0B99\\u0B9A\\u0B9C\\u0B9E\\u0B9F\\u0BA3\\u0BA4\\u0BA8-\\u0BAA\\u0BAE-\\u0BB9\\u0BD0\\u0C05-\\u0C0C\\u0C0E-\\u0C10\\u0C12-\\u0C28\\u0C2A-\\u0C33\\u0C35-\\u0C39\\u0C3D\\u0C58\\u0C59\\u0C60\\u0C61\\u0C85-\\u0C8C\\u0C8E-\\u0C90\\u0C92-\\u0CA8\\u0CAA-\\u0CB3\\u0CB5-\\u0CB9\\u0CBD\\u0CDE\\u0CE0\\u0CE1\\u0D05-\\u0D0C\\u0D0E-\\u0D10\\u0D12-\\u0D28\\u0D2A-\\u0D39\\u0D3D\\u0D60\\u0D61\\u0D7A-\\u0D7F\\u0D85-\\u0D96\\u0D9A-\\u0DB1\\u0DB3-\\u0DBB\\u0DBD\\u0DC0-\\u0DC6\\u0E01-\\u0E30\\u0E32\\u0E33\\u0E40-\\u0E46\\u0E81\\u0E82\\u0E84\\u0E87\\u0E88\\u0E8A\\u0E8D\\u0E94-\\u0E97\\u0E99-\\u0E9F\\u0EA1-\\u0EA3\\u0EA5\\u0EA7\\u0EAA\\u0EAB\\u0EAD-\\u0EB0\\u0EB2\\u0EB3\\u0EBD\\u0EC0-\\u0EC4\\u0EC6\\u0EDC\\u0EDD\\u0F00\\u0F40-\\u0F47\\u0F49-\\u0F6C\\u0F88-\\u0F8B\\u1000-\\u102A\\u103F\\u1050-\\u1055\\u105A-\\u105D\\u1061\\u1065\\u1066\\u106E-\\u1070\\u1075-\\u1081\\u108E\\u10A0-\\u10C5\\u10D0-\\u10FA\\u10FC\\u1100-\\u1159\\u115F-\\u11A2\\u11A8-\\u11F9\\u1200-\\u1248\\u124A-\\u124D\\u1250-\\u1256\\u1258\\u125A-\\u125D\\u1260-\\u1288\\u128A-\\u128D\\u1290-\\u12B0\\u12B2-\\u12B5\\u12B8-\\u12BE\\u12C0\\u12C2-\\u12C5\\u12C8-\\u12D6\\u12D8-\\u1310\\u1312-\\u1315\\u1318-\\u135A\\u1380-\\u138F\\u13A0-\\u13F4\\u1401-\\u166C\\u166F-\\u1676\\u1681-\\u169A\\u16A0-\\u16EA\\u1700-\\u170C\\u170E-\\u1711\\u1720-\\u1731\\u1740-\\u1751\\u1760-\\u176C\\u176E-\\u1770\\u1780-\\u17B3\\u17D7\\u17DC\\u1820-\\u1877\\u1880-\\u18A8\\u18AA\\u1900-\\u191C\\u1950-\\u196D\\u1970-\\u1974\\u1980-\\u19A9\\u19C1-\\u19C7\\u1A00-\\u1A16\\u1B05-\\u1B33\\u1B45-\\u1B4B\\u1B83-\\u1BA0\\u1BAE\\u1BAF\\u1C00-\\u1C23\\u1C4D-\\u1C4F\\u1C5A-\\u1C7D\\u1D00-\\u1DBF\\u1E00-\\u1F15\\u1F18-\\u1F1D\\u1F20-\\u1F45\\u1F48-\\u1F4D\\u1F50-\\u1F57\\u1F59\\u1F5B\\u1F5D\\u1F5F-\\u1F7D\\u1F80-\\u1FB4\\u1FB6-\\u1FBC\\u1FBE\\u1FC2-\\u1FC4\\u1FC6-\\u1FCC\\u1FD0-\\u1FD3\\u1FD6-\\u1FDB\\u1FE0-\\u1FEC\\u1FF2-\\u1FF4\\u1FF6-\\u1FFC\\u2071\\u207F\\u2090-\\u2094\\u2102\\u2107\\u210A-\\u2113\\u2115\\u2119-\\u211D\\u2124\\u2126\\u2128\\u212A-\\u212D\\u212F-\\u2139\\u213C-\\u213F\\u2145-\\u2149\\u214E\\u2183\\u2184\\u2C00-\\u2C2E\\u2C30-\\u2C5E\\u2C60-\\u2C6F\\u2C71-\\u2C7D\\u2C80-\\u2CE4\\u2D00-\\u2D25\\u2D30-\\u2D65\\u2D6F\\u2D80-\\u2D96\\u2DA0-\\u2DA6\\u2DA8-\\u2DAE\\u2DB0-\\u2DB6\\u2DB8-\\u2DBE\\u2DC0-\\u2DC6\\u2DC8-\\u2DCE\\u2DD0-\\u2DD6\\u2DD8-\\u2DDE\\u2E2F\\u3005\\u3006\\u3031-\\u3035\\u303B\\u303C\\u3041-\\u3096\\u309D-\\u309F\\u30A1-\\u30FA\\u30FC-\\u30FF\\u3105-\\u312D\\u3131-\\u318E\\u31A0-\\u31B7\\u31F0-\\u31FF\\u3400\\u4DB5\\u4E00\\u9FC3\\uA000-\\uA48C\\uA500-\\uA60C\\uA610-\\uA61F\\uA62A\\uA62B\\uA640-\\uA65F\\uA662-\\uA66E\\uA67F-\\uA697\\uA717-\\uA71F\\uA722-\\uA788\\uA78B\\uA78C\\uA7FB-\\uA801\\uA803-\\uA805\\uA807-\\uA80A\\uA80C-\\uA822\\uA840-\\uA873\\uA882-\\uA8B3\\uA90A-\\uA925\\uA930-\\uA946\\uAA00-\\uAA28\\uAA40-\\uAA42\\uAA44-\\uAA4B\\uAC00\\uD7A3\\uF900-\\uFA2D\\uFA30-\\uFA6A\\uFA70-\\uFAD9\\uFB00-\\uFB06\\uFB13-\\uFB17\\uFB1D\\uFB1F-\\uFB28\\uFB2A-\\uFB36\\uFB38-\\uFB3C\\uFB3E\\uFB40\\uFB41\\uFB43\\uFB44\\uFB46-\\uFBB1\\uFBD3-\\uFD3D\\uFD50-\\uFD8F\\uFD92-\\uFDC7\\uFDF0-\\uFDFB\\uFE70-\\uFE74\\uFE76-\\uFEFC\\uFF21-\\uFF3A\\uFF41-\\uFF5A\\uFF66-\\uFFBE\\uFFC2-\\uFFC7\\uFFCA-\\uFFCF\\uFFD2-\\uFFD7\\uFFDA-\\uFFDC]"),
          non_spacing_mark: new RegExp("[\\u0300-\\u036F\\u0483-\\u0487\\u0591-\\u05BD\\u05BF\\u05C1\\u05C2\\u05C4\\u05C5\\u05C7\\u0610-\\u061A\\u064B-\\u065E\\u0670\\u06D6-\\u06DC\\u06DF-\\u06E4\\u06E7\\u06E8\\u06EA-\\u06ED\\u0711\\u0730-\\u074A\\u07A6-\\u07B0\\u07EB-\\u07F3\\u0816-\\u0819\\u081B-\\u0823\\u0825-\\u0827\\u0829-\\u082D\\u0900-\\u0902\\u093C\\u0941-\\u0948\\u094D\\u0951-\\u0955\\u0962\\u0963\\u0981\\u09BC\\u09C1-\\u09C4\\u09CD\\u09E2\\u09E3\\u0A01\\u0A02\\u0A3C\\u0A41\\u0A42\\u0A47\\u0A48\\u0A4B-\\u0A4D\\u0A51\\u0A70\\u0A71\\u0A75\\u0A81\\u0A82\\u0ABC\\u0AC1-\\u0AC5\\u0AC7\\u0AC8\\u0ACD\\u0AE2\\u0AE3\\u0B01\\u0B3C\\u0B3F\\u0B41-\\u0B44\\u0B4D\\u0B56\\u0B62\\u0B63\\u0B82\\u0BC0\\u0BCD\\u0C3E-\\u0C40\\u0C46-\\u0C48\\u0C4A-\\u0C4D\\u0C55\\u0C56\\u0C62\\u0C63\\u0CBC\\u0CBF\\u0CC6\\u0CCC\\u0CCD\\u0CE2\\u0CE3\\u0D41-\\u0D44\\u0D4D\\u0D62\\u0D63\\u0DCA\\u0DD2-\\u0DD4\\u0DD6\\u0E31\\u0E34-\\u0E3A\\u0E47-\\u0E4E\\u0EB1\\u0EB4-\\u0EB9\\u0EBB\\u0EBC\\u0EC8-\\u0ECD\\u0F18\\u0F19\\u0F35\\u0F37\\u0F39\\u0F71-\\u0F7E\\u0F80-\\u0F84\\u0F86\\u0F87\\u0F90-\\u0F97\\u0F99-\\u0FBC\\u0FC6\\u102D-\\u1030\\u1032-\\u1037\\u1039\\u103A\\u103D\\u103E\\u1058\\u1059\\u105E-\\u1060\\u1071-\\u1074\\u1082\\u1085\\u1086\\u108D\\u109D\\u135F\\u1712-\\u1714\\u1732-\\u1734\\u1752\\u1753\\u1772\\u1773\\u17B7-\\u17BD\\u17C6\\u17C9-\\u17D3\\u17DD\\u180B-\\u180D\\u18A9\\u1920-\\u1922\\u1927\\u1928\\u1932\\u1939-\\u193B\\u1A17\\u1A18\\u1A56\\u1A58-\\u1A5E\\u1A60\\u1A62\\u1A65-\\u1A6C\\u1A73-\\u1A7C\\u1A7F\\u1B00-\\u1B03\\u1B34\\u1B36-\\u1B3A\\u1B3C\\u1B42\\u1B6B-\\u1B73\\u1B80\\u1B81\\u1BA2-\\u1BA5\\u1BA8\\u1BA9\\u1C2C-\\u1C33\\u1C36\\u1C37\\u1CD0-\\u1CD2\\u1CD4-\\u1CE0\\u1CE2-\\u1CE8\\u1CED\\u1DC0-\\u1DE6\\u1DFD-\\u1DFF\\u20D0-\\u20DC\\u20E1\\u20E5-\\u20F0\\u2CEF-\\u2CF1\\u2DE0-\\u2DFF\\u302A-\\u302F\\u3099\\u309A\\uA66F\\uA67C\\uA67D\\uA6F0\\uA6F1\\uA802\\uA806\\uA80B\\uA825\\uA826\\uA8C4\\uA8E0-\\uA8F1\\uA926-\\uA92D\\uA947-\\uA951\\uA980-\\uA982\\uA9B3\\uA9B6-\\uA9B9\\uA9BC\\uAA29-\\uAA2E\\uAA31\\uAA32\\uAA35\\uAA36\\uAA43\\uAA4C\\uAAB0\\uAAB2-\\uAAB4\\uAAB7\\uAAB8\\uAABE\\uAABF\\uAAC1\\uABE5\\uABE8\\uABED\\uFB1E\\uFE00-\\uFE0F\\uFE20-\\uFE26]"),
          space_combining_mark: new RegExp("[\\u0903\\u093E-\\u0940\\u0949-\\u094C\\u094E\\u0982\\u0983\\u09BE-\\u09C0\\u09C7\\u09C8\\u09CB\\u09CC\\u09D7\\u0A03\\u0A3E-\\u0A40\\u0A83\\u0ABE-\\u0AC0\\u0AC9\\u0ACB\\u0ACC\\u0B02\\u0B03\\u0B3E\\u0B40\\u0B47\\u0B48\\u0B4B\\u0B4C\\u0B57\\u0BBE\\u0BBF\\u0BC1\\u0BC2\\u0BC6-\\u0BC8\\u0BCA-\\u0BCC\\u0BD7\\u0C01-\\u0C03\\u0C41-\\u0C44\\u0C82\\u0C83\\u0CBE\\u0CC0-\\u0CC4\\u0CC7\\u0CC8\\u0CCA\\u0CCB\\u0CD5\\u0CD6\\u0D02\\u0D03\\u0D3E-\\u0D40\\u0D46-\\u0D48\\u0D4A-\\u0D4C\\u0D57\\u0D82\\u0D83\\u0DCF-\\u0DD1\\u0DD8-\\u0DDF\\u0DF2\\u0DF3\\u0F3E\\u0F3F\\u0F7F\\u102B\\u102C\\u1031\\u1038\\u103B\\u103C\\u1056\\u1057\\u1062-\\u1064\\u1067-\\u106D\\u1083\\u1084\\u1087-\\u108C\\u108F\\u109A-\\u109C\\u17B6\\u17BE-\\u17C5\\u17C7\\u17C8\\u1923-\\u1926\\u1929-\\u192B\\u1930\\u1931\\u1933-\\u1938\\u19B0-\\u19C0\\u19C8\\u19C9\\u1A19-\\u1A1B\\u1A55\\u1A57\\u1A61\\u1A63\\u1A64\\u1A6D-\\u1A72\\u1B04\\u1B35\\u1B3B\\u1B3D-\\u1B41\\u1B43\\u1B44\\u1B82\\u1BA1\\u1BA6\\u1BA7\\u1BAA\\u1C24-\\u1C2B\\u1C34\\u1C35\\u1CE1\\u1CF2\\uA823\\uA824\\uA827\\uA880\\uA881\\uA8B4-\\uA8C3\\uA952\\uA953\\uA983\\uA9B4\\uA9B5\\uA9BA\\uA9BB\\uA9BD-\\uA9C0\\uAA2F\\uAA30\\uAA33\\uAA34\\uAA4D\\uAA7B\\uABE3\\uABE4\\uABE6\\uABE7\\uABE9\\uABEA\\uABEC]"),
          connector_punctuation: new RegExp("[\\u005F\\u203F\\u2040\\u2054\\uFE33\\uFE34\\uFE4D-\\uFE4F\\uFF3F]")
        };
        function is_letter(code) {
          return (code >= 97 && code <= 122) || (code >= 65 && code <= 90) || (code >= 0xaa && UNICODE.letter.test(String.fromCharCode(code)));
        }
        ;
        function is_digit(code) {
          return code >= 48 && code <= 57;
        }
        ;
        function is_alphanumeric_char(code) {
          return is_digit(code) || is_letter(code);
        }
        ;
        function is_unicode_combining_mark(ch) {
          return UNICODE.non_spacing_mark.test(ch) || UNICODE.space_combining_mark.test(ch);
        }
        ;
        function is_unicode_connector_punctuation(ch) {
          return UNICODE.connector_punctuation.test(ch);
        }
        ;
        function is_identifier(name) {
          return !RESERVED_WORDS(name) && /^[a-z_$][a-z0-9_$]*$/i.test(name);
        }
        ;
        function is_identifier_start(code) {
          return code == 36 || code == 95 || is_letter(code);
        }
        ;
        function is_identifier_char(ch) {
          var code = ch.charCodeAt(0);
          return is_identifier_start(code) || is_digit(code) || code == 8204 || code == 8205 || is_unicode_combining_mark(ch) || is_unicode_connector_punctuation(ch);
          ;
        }
        ;
        function is_identifier_string(str) {
          return /^[a-z_$][a-z0-9_$]*$/i.test(str);
        }
        ;
        function parse_js_number(num) {
          if (RE_HEX_NUMBER.test(num)) {
            return parseInt(num.substr(2), 16);
          } else if (RE_OCT_NUMBER.test(num)) {
            return parseInt(num.substr(1), 8);
          } else if (RE_DEC_NUMBER.test(num)) {
            return parseFloat(num);
          }
        }
        ;
        function JS_Parse_Error(message, line, col, pos) {
          this.message = message;
          this.line = line;
          this.col = col;
          this.pos = pos;
          this.stack = new Error().stack;
        }
        ;
        JS_Parse_Error.prototype.toString = function() {
          return this.message + " (line: " + this.line + ", col: " + this.col + ", pos: " + this.pos + ")" + "\n\n" + this.stack;
        };
        function js_error(message, filename, line, col, pos) {
          throw new JS_Parse_Error(message, line, col, pos);
        }
        ;
        function is_token(token, type, val) {
          return token.type == type && (val == null || token.value == val);
        }
        ;
        var EX_EOF = {};
        function tokenizer($TEXT, filename, html5_comments) {
          var S = {
            text: $TEXT.replace(/\r\n?|[\n\u2028\u2029]/g, "\n").replace(/\uFEFF/g, ''),
            filename: filename,
            pos: 0,
            tokpos: 0,
            line: 1,
            tokline: 0,
            col: 0,
            tokcol: 0,
            newline_before: false,
            regex_allowed: false,
            comments_before: []
          };
          function peek() {
            return S.text.charAt(S.pos);
          }
          ;
          function next(signal_eof, in_string) {
            var ch = S.text.charAt(S.pos++);
            if (signal_eof && !ch)
              throw EX_EOF;
            if (ch == "\n") {
              S.newline_before = S.newline_before || !in_string;
              ++S.line;
              S.col = 0;
            } else {
              ++S.col;
            }
            return ch;
          }
          ;
          function forward(i) {
            while (i-- > 0)
              next();
          }
          ;
          function looking_at(str) {
            return S.text.substr(S.pos, str.length) == str;
          }
          ;
          function find(what, signal_eof) {
            var pos = S.text.indexOf(what, S.pos);
            if (signal_eof && pos == -1)
              throw EX_EOF;
            return pos;
          }
          ;
          function start_token() {
            S.tokline = S.line;
            S.tokcol = S.col;
            S.tokpos = S.pos;
          }
          ;
          var prev_was_dot = false;
          function token(type, value, is_comment) {
            S.regex_allowed = ((type == "operator" && !UNARY_POSTFIX(value)) || (type == "keyword" && KEYWORDS_BEFORE_EXPRESSION(value)) || (type == "punc" && PUNC_BEFORE_EXPRESSION(value)));
            prev_was_dot = (type == "punc" && value == ".");
            var ret = {
              type: type,
              value: value,
              line: S.tokline,
              col: S.tokcol,
              pos: S.tokpos,
              endpos: S.pos,
              nlb: S.newline_before,
              file: filename
            };
            if (!is_comment) {
              ret.comments_before = S.comments_before;
              S.comments_before = [];
              for (var i = 0,
                  len = ret.comments_before.length; i < len; i++) {
                ret.nlb = ret.nlb || ret.comments_before[i].nlb;
              }
            }
            S.newline_before = false;
            return new AST_Token(ret);
          }
          ;
          function skip_whitespace() {
            while (WHITESPACE_CHARS(peek()))
              next();
          }
          ;
          function read_while(pred) {
            var ret = "",
                ch,
                i = 0;
            while ((ch = peek()) && pred(ch, i++))
              ret += next();
            return ret;
          }
          ;
          function parse_error(err) {
            js_error(err, filename, S.tokline, S.tokcol, S.tokpos);
          }
          ;
          function read_num(prefix) {
            var has_e = false,
                after_e = false,
                has_x = false,
                has_dot = prefix == ".";
            var num = read_while(function(ch, i) {
              var code = ch.charCodeAt(0);
              switch (code) {
                case 120:
                case 88:
                  return has_x ? false : (has_x = true);
                case 101:
                case 69:
                  return has_x ? true : has_e ? false : (has_e = after_e = true);
                case 45:
                  return after_e || (i == 0 && !prefix);
                case 43:
                  return after_e;
                case (after_e = false, 46):
                  return (!has_dot && !has_x && !has_e) ? (has_dot = true) : false;
              }
              return is_alphanumeric_char(code);
            });
            if (prefix)
              num = prefix + num;
            var valid = parse_js_number(num);
            if (!isNaN(valid)) {
              return token("num", valid);
            } else {
              parse_error("Invalid syntax: " + num);
            }
          }
          ;
          function read_escaped_char(in_string) {
            var ch = next(true, in_string);
            switch (ch.charCodeAt(0)) {
              case 110:
                return "\n";
              case 114:
                return "\r";
              case 116:
                return "\t";
              case 98:
                return "\b";
              case 118:
                return "\u000b";
              case 102:
                return "\f";
              case 48:
                return "\0";
              case 120:
                return String.fromCharCode(hex_bytes(2));
              case 117:
                return String.fromCharCode(hex_bytes(4));
              case 10:
                return "";
              default:
                return ch;
            }
          }
          ;
          function hex_bytes(n) {
            var num = 0;
            for (; n > 0; --n) {
              var digit = parseInt(next(true), 16);
              if (isNaN(digit))
                parse_error("Invalid hex-character pattern in string");
              num = (num << 4) | digit;
            }
            return num;
          }
          ;
          var read_string = with_eof_error("Unterminated string constant", function() {
            var quote = next(),
                ret = "";
            for (; ; ) {
              var ch = next(true);
              if (ch == "\\") {
                var octal_len = 0,
                    first = null;
                ch = read_while(function(ch) {
                  if (ch >= "0" && ch <= "7") {
                    if (!first) {
                      first = ch;
                      return ++octal_len;
                    } else if (first <= "3" && octal_len <= 2)
                      return ++octal_len;
                    else if (first >= "4" && octal_len <= 1)
                      return ++octal_len;
                  }
                  return false;
                });
                if (octal_len > 0)
                  ch = String.fromCharCode(parseInt(ch, 8));
                else
                  ch = read_escaped_char(true);
              } else if (ch == quote)
                break;
              ret += ch;
            }
            return token("string", ret);
          });
          function skip_line_comment(type) {
            var regex_allowed = S.regex_allowed;
            var i = find("\n"),
                ret;
            if (i == -1) {
              ret = S.text.substr(S.pos);
              S.pos = S.text.length;
            } else {
              ret = S.text.substring(S.pos, i);
              S.pos = i;
            }
            S.comments_before.push(token(type, ret, true));
            S.regex_allowed = regex_allowed;
            return next_token();
          }
          ;
          var skip_multiline_comment = with_eof_error("Unterminated multiline comment", function() {
            var regex_allowed = S.regex_allowed;
            var i = find("*/", true);
            var text = S.text.substring(S.pos, i);
            var a = text.split("\n"),
                n = a.length;
            S.pos = i + 2;
            S.line += n - 1;
            if (n > 1)
              S.col = a[n - 1].length;
            else
              S.col += a[n - 1].length;
            S.col += 2;
            var nlb = S.newline_before = S.newline_before || text.indexOf("\n") >= 0;
            S.comments_before.push(token("comment2", text, true));
            S.regex_allowed = regex_allowed;
            S.newline_before = nlb;
            return next_token();
          });
          function read_name() {
            var backslash = false,
                name = "",
                ch,
                escaped = false,
                hex;
            while ((ch = peek()) != null) {
              if (!backslash) {
                if (ch == "\\")
                  escaped = backslash = true, next();
                else if (is_identifier_char(ch))
                  name += next();
                else
                  break;
              } else {
                if (ch != "u")
                  parse_error("Expecting UnicodeEscapeSequence -- uXXXX");
                ch = read_escaped_char();
                if (!is_identifier_char(ch))
                  parse_error("Unicode char: " + ch.charCodeAt(0) + " is not valid in identifier");
                name += ch;
                backslash = false;
              }
            }
            if (KEYWORDS(name) && escaped) {
              hex = name.charCodeAt(0).toString(16).toUpperCase();
              name = "\\u" + "0000".substr(hex.length) + hex + name.slice(1);
            }
            return name;
          }
          ;
          var read_regexp = with_eof_error("Unterminated regular expression", function(regexp) {
            var prev_backslash = false,
                ch,
                in_class = false;
            while ((ch = next(true)))
              if (prev_backslash) {
                regexp += "\\" + ch;
                prev_backslash = false;
              } else if (ch == "[") {
                in_class = true;
                regexp += ch;
              } else if (ch == "]" && in_class) {
                in_class = false;
                regexp += ch;
              } else if (ch == "/" && !in_class) {
                break;
              } else if (ch == "\\") {
                prev_backslash = true;
              } else {
                regexp += ch;
              }
            var mods = read_name();
            return token("regexp", new RegExp(regexp, mods));
          });
          function read_operator(prefix) {
            function grow(op) {
              if (!peek())
                return op;
              var bigger = op + peek();
              if (OPERATORS(bigger)) {
                next();
                return grow(bigger);
              } else {
                return op;
              }
            }
            ;
            return token("operator", grow(prefix || next()));
          }
          ;
          function handle_slash() {
            next();
            switch (peek()) {
              case "/":
                next();
                return skip_line_comment("comment1");
              case "*":
                next();
                return skip_multiline_comment();
            }
            return S.regex_allowed ? read_regexp("") : read_operator("/");
          }
          ;
          function handle_dot() {
            next();
            return is_digit(peek().charCodeAt(0)) ? read_num(".") : token("punc", ".");
          }
          ;
          function read_word() {
            var word = read_name();
            if (prev_was_dot)
              return token("name", word);
            return KEYWORDS_ATOM(word) ? token("atom", word) : !KEYWORDS(word) ? token("name", word) : OPERATORS(word) ? token("operator", word) : token("keyword", word);
          }
          ;
          function with_eof_error(eof_error, cont) {
            return function(x) {
              try {
                return cont(x);
              } catch (ex) {
                if (ex === EX_EOF)
                  parse_error(eof_error);
                else
                  throw ex;
              }
            };
          }
          ;
          function next_token(force_regexp) {
            if (force_regexp != null)
              return read_regexp(force_regexp);
            skip_whitespace();
            start_token();
            if (html5_comments) {
              if (looking_at("<!--")) {
                forward(4);
                return skip_line_comment("comment3");
              }
              if (looking_at("-->") && S.newline_before) {
                forward(3);
                return skip_line_comment("comment4");
              }
            }
            var ch = peek();
            if (!ch)
              return token("eof");
            var code = ch.charCodeAt(0);
            switch (code) {
              case 34:
              case 39:
                return read_string();
              case 46:
                return handle_dot();
              case 47:
                return handle_slash();
            }
            if (is_digit(code))
              return read_num();
            if (PUNC_CHARS(ch))
              return token("punc", next());
            if (OPERATOR_CHARS(ch))
              return read_operator();
            if (code == 92 || is_identifier_start(code))
              return read_word();
            parse_error("Unexpected character '" + ch + "'");
          }
          ;
          next_token.context = function(nc) {
            if (nc)
              S = nc;
            return S;
          };
          return next_token;
        }
        ;
        var UNARY_PREFIX = makePredicate(["typeof", "void", "delete", "--", "++", "!", "~", "-", "+"]);
        var UNARY_POSTFIX = makePredicate(["--", "++"]);
        var ASSIGNMENT = makePredicate(["=", "+=", "-=", "/=", "*=", "%=", ">>=", "<<=", ">>>=", "|=", "^=", "&="]);
        var PRECEDENCE = (function(a, ret) {
          for (var i = 0; i < a.length; ++i) {
            var b = a[i];
            for (var j = 0; j < b.length; ++j) {
              ret[b[j]] = i + 1;
            }
          }
          return ret;
        })([["||"], ["&&"], ["|"], ["^"], ["&"], ["==", "===", "!=", "!=="], ["<", ">", "<=", ">=", "in", "instanceof"], [">>", "<<", ">>>"], ["+", "-"], ["*", "/", "%"]], {});
        var STATEMENTS_WITH_LABELS = array_to_hash(["for", "do", "while", "switch"]);
        var ATOMIC_START_TOKEN = array_to_hash(["atom", "num", "string", "regexp", "name"]);
        function parse($TEXT, options) {
          options = defaults(options, {
            strict: false,
            filename: null,
            toplevel: null,
            expression: false,
            html5_comments: true,
            bare_returns: false
          });
          var S = {
            input: (typeof $TEXT == "string" ? tokenizer($TEXT, options.filename, options.html5_comments) : $TEXT),
            token: null,
            prev: null,
            peeked: null,
            in_function: 0,
            in_directives: true,
            in_loop: 0,
            labels: []
          };
          S.token = next();
          function is(type, value) {
            return is_token(S.token, type, value);
          }
          ;
          function peek() {
            return S.peeked || (S.peeked = S.input());
          }
          ;
          function next() {
            S.prev = S.token;
            if (S.peeked) {
              S.token = S.peeked;
              S.peeked = null;
            } else {
              S.token = S.input();
            }
            S.in_directives = S.in_directives && (S.token.type == "string" || is("punc", ";"));
            return S.token;
          }
          ;
          function prev() {
            return S.prev;
          }
          ;
          function croak(msg, line, col, pos) {
            var ctx = S.input.context();
            js_error(msg, ctx.filename, line != null ? line : ctx.tokline, col != null ? col : ctx.tokcol, pos != null ? pos : ctx.tokpos);
          }
          ;
          function token_error(token, msg) {
            croak(msg, token.line, token.col);
          }
          ;
          function unexpected(token) {
            if (token == null)
              token = S.token;
            token_error(token, "Unexpected token: " + token.type + " (" + token.value + ")");
          }
          ;
          function expect_token(type, val) {
            if (is(type, val)) {
              return next();
            }
            token_error(S.token, "Unexpected token " + S.token.type + " «" + S.token.value + "»" + ", expected " + type + " «" + val + "»");
          }
          ;
          function expect(punc) {
            return expect_token("punc", punc);
          }
          ;
          function can_insert_semicolon() {
            return !options.strict && (S.token.nlb || is("eof") || is("punc", "}"));
          }
          ;
          function semicolon() {
            if (is("punc", ";"))
              next();
            else if (!can_insert_semicolon())
              unexpected();
          }
          ;
          function parenthesised() {
            expect("(");
            var exp = expression(true);
            expect(")");
            return exp;
          }
          ;
          function embed_tokens(parser) {
            return function() {
              var start = S.token;
              var expr = parser();
              var end = prev();
              expr.start = start;
              expr.end = end;
              return expr;
            };
          }
          ;
          function handle_regexp() {
            if (is("operator", "/") || is("operator", "/=")) {
              S.peeked = null;
              S.token = S.input(S.token.value.substr(1));
            }
          }
          ;
          var statement = embed_tokens(function() {
            var tmp;
            handle_regexp();
            switch (S.token.type) {
              case "string":
                var dir = S.in_directives,
                    stat = simple_statement();
                if (dir && stat.body instanceof AST_String && !is("punc", ","))
                  return new AST_Directive({value: stat.body.value});
                return stat;
              case "num":
              case "regexp":
              case "operator":
              case "atom":
                return simple_statement();
              case "name":
                return is_token(peek(), "punc", ":") ? labeled_statement() : simple_statement();
              case "punc":
                switch (S.token.value) {
                  case "{":
                    return new AST_BlockStatement({
                      start: S.token,
                      body: block_(),
                      end: prev()
                    });
                  case "[":
                  case "(":
                    return simple_statement();
                  case ";":
                    next();
                    return new AST_EmptyStatement();
                  default:
                    unexpected();
                }
              case "keyword":
                switch (tmp = S.token.value, next(), tmp) {
                  case "break":
                    return break_cont(AST_Break);
                  case "continue":
                    return break_cont(AST_Continue);
                  case "debugger":
                    semicolon();
                    return new AST_Debugger();
                  case "do":
                    return new AST_Do({
                      body: in_loop(statement),
                      condition: (expect_token("keyword", "while"), tmp = parenthesised(), semicolon(), tmp)
                    });
                  case "while":
                    return new AST_While({
                      condition: parenthesised(),
                      body: in_loop(statement)
                    });
                  case "for":
                    return for_();
                  case "function":
                    return function_(AST_Defun);
                  case "if":
                    return if_();
                  case "return":
                    if (S.in_function == 0 && !options.bare_returns)
                      croak("'return' outside of function");
                    return new AST_Return({value: (is("punc", ";") ? (next(), null) : can_insert_semicolon() ? null : (tmp = expression(true), semicolon(), tmp))});
                  case "switch":
                    return new AST_Switch({
                      expression: parenthesised(),
                      body: in_loop(switch_body_)
                    });
                  case "throw":
                    if (S.token.nlb)
                      croak("Illegal newline after 'throw'");
                    return new AST_Throw({value: (tmp = expression(true), semicolon(), tmp)});
                  case "try":
                    return try_();
                  case "var":
                    return tmp = var_(), semicolon(), tmp;
                  case "const":
                    return tmp = const_(), semicolon(), tmp;
                  case "with":
                    return new AST_With({
                      expression: parenthesised(),
                      body: statement()
                    });
                  default:
                    unexpected();
                }
            }
          });
          function labeled_statement() {
            var label = as_symbol(AST_Label);
            if (find_if(function(l) {
              return l.name == label.name;
            }, S.labels)) {
              croak("Label " + label.name + " defined twice");
            }
            expect(":");
            S.labels.push(label);
            var stat = statement();
            S.labels.pop();
            if (!(stat instanceof AST_IterationStatement)) {
              label.references.forEach(function(ref) {
                if (ref instanceof AST_Continue) {
                  ref = ref.label.start;
                  croak("Continue label `" + label.name + "` refers to non-IterationStatement.", ref.line, ref.col, ref.pos);
                }
              });
            }
            return new AST_LabeledStatement({
              body: stat,
              label: label
            });
          }
          ;
          function simple_statement(tmp) {
            return new AST_SimpleStatement({body: (tmp = expression(true), semicolon(), tmp)});
          }
          ;
          function break_cont(type) {
            var label = null,
                ldef;
            if (!can_insert_semicolon()) {
              label = as_symbol(AST_LabelRef, true);
            }
            if (label != null) {
              ldef = find_if(function(l) {
                return l.name == label.name;
              }, S.labels);
              if (!ldef)
                croak("Undefined label " + label.name);
              label.thedef = ldef;
            } else if (S.in_loop == 0)
              croak(type.TYPE + " not inside a loop or switch");
            semicolon();
            var stat = new type({label: label});
            if (ldef)
              ldef.references.push(stat);
            return stat;
          }
          ;
          function for_() {
            expect("(");
            var init = null;
            if (!is("punc", ";")) {
              init = is("keyword", "var") ? (next(), var_(true)) : expression(true, true);
              if (is("operator", "in")) {
                if (init instanceof AST_Var && init.definitions.length > 1)
                  croak("Only one variable declaration allowed in for..in loop");
                next();
                return for_in(init);
              }
            }
            return regular_for(init);
          }
          ;
          function regular_for(init) {
            expect(";");
            var test = is("punc", ";") ? null : expression(true);
            expect(";");
            var step = is("punc", ")") ? null : expression(true);
            expect(")");
            return new AST_For({
              init: init,
              condition: test,
              step: step,
              body: in_loop(statement)
            });
          }
          ;
          function for_in(init) {
            var lhs = init instanceof AST_Var ? init.definitions[0].name : null;
            var obj = expression(true);
            expect(")");
            return new AST_ForIn({
              init: init,
              name: lhs,
              object: obj,
              body: in_loop(statement)
            });
          }
          ;
          var function_ = function(ctor) {
            var in_statement = ctor === AST_Defun;
            var name = is("name") ? as_symbol(in_statement ? AST_SymbolDefun : AST_SymbolLambda) : null;
            if (in_statement && !name)
              unexpected();
            expect("(");
            return new ctor({
              name: name,
              argnames: (function(first, a) {
                while (!is("punc", ")")) {
                  if (first)
                    first = false;
                  else
                    expect(",");
                  a.push(as_symbol(AST_SymbolFunarg));
                }
                next();
                return a;
              })(true, []),
              body: (function(loop, labels) {
                ++S.in_function;
                S.in_directives = true;
                S.in_loop = 0;
                S.labels = [];
                var a = block_();
                --S.in_function;
                S.in_loop = loop;
                S.labels = labels;
                return a;
              })(S.in_loop, S.labels)
            });
          };
          function if_() {
            var cond = parenthesised(),
                body = statement(),
                belse = null;
            if (is("keyword", "else")) {
              next();
              belse = statement();
            }
            return new AST_If({
              condition: cond,
              body: body,
              alternative: belse
            });
          }
          ;
          function block_() {
            expect("{");
            var a = [];
            while (!is("punc", "}")) {
              if (is("eof"))
                unexpected();
              a.push(statement());
            }
            next();
            return a;
          }
          ;
          function switch_body_() {
            expect("{");
            var a = [],
                cur = null,
                branch = null,
                tmp;
            while (!is("punc", "}")) {
              if (is("eof"))
                unexpected();
              if (is("keyword", "case")) {
                if (branch)
                  branch.end = prev();
                cur = [];
                branch = new AST_Case({
                  start: (tmp = S.token, next(), tmp),
                  expression: expression(true),
                  body: cur
                });
                a.push(branch);
                expect(":");
              } else if (is("keyword", "default")) {
                if (branch)
                  branch.end = prev();
                cur = [];
                branch = new AST_Default({
                  start: (tmp = S.token, next(), expect(":"), tmp),
                  body: cur
                });
                a.push(branch);
              } else {
                if (!cur)
                  unexpected();
                cur.push(statement());
              }
            }
            if (branch)
              branch.end = prev();
            next();
            return a;
          }
          ;
          function try_() {
            var body = block_(),
                bcatch = null,
                bfinally = null;
            if (is("keyword", "catch")) {
              var start = S.token;
              next();
              expect("(");
              var name = as_symbol(AST_SymbolCatch);
              expect(")");
              bcatch = new AST_Catch({
                start: start,
                argname: name,
                body: block_(),
                end: prev()
              });
            }
            if (is("keyword", "finally")) {
              var start = S.token;
              next();
              bfinally = new AST_Finally({
                start: start,
                body: block_(),
                end: prev()
              });
            }
            if (!bcatch && !bfinally)
              croak("Missing catch/finally blocks");
            return new AST_Try({
              body: body,
              bcatch: bcatch,
              bfinally: bfinally
            });
          }
          ;
          function vardefs(no_in, in_const) {
            var a = [];
            for (; ; ) {
              a.push(new AST_VarDef({
                start: S.token,
                name: as_symbol(in_const ? AST_SymbolConst : AST_SymbolVar),
                value: is("operator", "=") ? (next(), expression(false, no_in)) : null,
                end: prev()
              }));
              if (!is("punc", ","))
                break;
              next();
            }
            return a;
          }
          ;
          var var_ = function(no_in) {
            return new AST_Var({
              start: prev(),
              definitions: vardefs(no_in, false),
              end: prev()
            });
          };
          var const_ = function() {
            return new AST_Const({
              start: prev(),
              definitions: vardefs(false, true),
              end: prev()
            });
          };
          var new_ = function() {
            var start = S.token;
            expect_token("operator", "new");
            var newexp = expr_atom(false),
                args;
            if (is("punc", "(")) {
              next();
              args = expr_list(")");
            } else {
              args = [];
            }
            return subscripts(new AST_New({
              start: start,
              expression: newexp,
              args: args,
              end: prev()
            }), true);
          };
          function as_atom_node() {
            var tok = S.token,
                ret;
            switch (tok.type) {
              case "name":
              case "keyword":
                ret = _make_symbol(AST_SymbolRef);
                break;
              case "num":
                ret = new AST_Number({
                  start: tok,
                  end: tok,
                  value: tok.value
                });
                break;
              case "string":
                ret = new AST_String({
                  start: tok,
                  end: tok,
                  value: tok.value
                });
                break;
              case "regexp":
                ret = new AST_RegExp({
                  start: tok,
                  end: tok,
                  value: tok.value
                });
                break;
              case "atom":
                switch (tok.value) {
                  case "false":
                    ret = new AST_False({
                      start: tok,
                      end: tok
                    });
                    break;
                  case "true":
                    ret = new AST_True({
                      start: tok,
                      end: tok
                    });
                    break;
                  case "null":
                    ret = new AST_Null({
                      start: tok,
                      end: tok
                    });
                    break;
                }
                break;
            }
            next();
            return ret;
          }
          ;
          var expr_atom = function(allow_calls) {
            if (is("operator", "new")) {
              return new_();
            }
            var start = S.token;
            if (is("punc")) {
              switch (start.value) {
                case "(":
                  next();
                  var ex = expression(true);
                  ex.start = start;
                  ex.end = S.token;
                  expect(")");
                  return subscripts(ex, allow_calls);
                case "[":
                  return subscripts(array_(), allow_calls);
                case "{":
                  return subscripts(object_(), allow_calls);
              }
              unexpected();
            }
            if (is("keyword", "function")) {
              next();
              var func = function_(AST_Function);
              func.start = start;
              func.end = prev();
              return subscripts(func, allow_calls);
            }
            if (ATOMIC_START_TOKEN[S.token.type]) {
              return subscripts(as_atom_node(), allow_calls);
            }
            unexpected();
          };
          function expr_list(closing, allow_trailing_comma, allow_empty) {
            var first = true,
                a = [];
            while (!is("punc", closing)) {
              if (first)
                first = false;
              else
                expect(",");
              if (allow_trailing_comma && is("punc", closing))
                break;
              if (is("punc", ",") && allow_empty) {
                a.push(new AST_Hole({
                  start: S.token,
                  end: S.token
                }));
              } else {
                a.push(expression(false));
              }
            }
            next();
            return a;
          }
          ;
          var array_ = embed_tokens(function() {
            expect("[");
            return new AST_Array({elements: expr_list("]", !options.strict, true)});
          });
          var object_ = embed_tokens(function() {
            expect("{");
            var first = true,
                a = [];
            while (!is("punc", "}")) {
              if (first)
                first = false;
              else
                expect(",");
              if (!options.strict && is("punc", "}"))
                break;
              var start = S.token;
              var type = start.type;
              var name = as_property_name();
              if (type == "name" && !is("punc", ":")) {
                if (name == "get") {
                  a.push(new AST_ObjectGetter({
                    start: start,
                    key: as_atom_node(),
                    value: function_(AST_Accessor),
                    end: prev()
                  }));
                  continue;
                }
                if (name == "set") {
                  a.push(new AST_ObjectSetter({
                    start: start,
                    key: as_atom_node(),
                    value: function_(AST_Accessor),
                    end: prev()
                  }));
                  continue;
                }
              }
              expect(":");
              a.push(new AST_ObjectKeyVal({
                start: start,
                key: name,
                value: expression(false),
                end: prev()
              }));
            }
            next();
            return new AST_Object({properties: a});
          });
          function as_property_name() {
            var tmp = S.token;
            next();
            switch (tmp.type) {
              case "num":
              case "string":
              case "name":
              case "operator":
              case "keyword":
              case "atom":
                return tmp.value;
              default:
                unexpected();
            }
          }
          ;
          function as_name() {
            var tmp = S.token;
            next();
            switch (tmp.type) {
              case "name":
              case "operator":
              case "keyword":
              case "atom":
                return tmp.value;
              default:
                unexpected();
            }
          }
          ;
          function _make_symbol(type) {
            var name = S.token.value;
            return new (name == "this" ? AST_This : type)({
              name: String(name),
              start: S.token,
              end: S.token
            });
          }
          ;
          function as_symbol(type, noerror) {
            if (!is("name")) {
              if (!noerror)
                croak("Name expected");
              return null;
            }
            var sym = _make_symbol(type);
            next();
            return sym;
          }
          ;
          var subscripts = function(expr, allow_calls) {
            var start = expr.start;
            if (is("punc", ".")) {
              next();
              return subscripts(new AST_Dot({
                start: start,
                expression: expr,
                property: as_name(),
                end: prev()
              }), allow_calls);
            }
            if (is("punc", "[")) {
              next();
              var prop = expression(true);
              expect("]");
              return subscripts(new AST_Sub({
                start: start,
                expression: expr,
                property: prop,
                end: prev()
              }), allow_calls);
            }
            if (allow_calls && is("punc", "(")) {
              next();
              return subscripts(new AST_Call({
                start: start,
                expression: expr,
                args: expr_list(")"),
                end: prev()
              }), true);
            }
            return expr;
          };
          var maybe_unary = function(allow_calls) {
            var start = S.token;
            if (is("operator") && UNARY_PREFIX(start.value)) {
              next();
              handle_regexp();
              var ex = make_unary(AST_UnaryPrefix, start.value, maybe_unary(allow_calls));
              ex.start = start;
              ex.end = prev();
              return ex;
            }
            var val = expr_atom(allow_calls);
            while (is("operator") && UNARY_POSTFIX(S.token.value) && !S.token.nlb) {
              val = make_unary(AST_UnaryPostfix, S.token.value, val);
              val.start = start;
              val.end = S.token;
              next();
            }
            return val;
          };
          function make_unary(ctor, op, expr) {
            if ((op == "++" || op == "--") && !is_assignable(expr))
              croak("Invalid use of " + op + " operator");
            return new ctor({
              operator: op,
              expression: expr
            });
          }
          ;
          var expr_op = function(left, min_prec, no_in) {
            var op = is("operator") ? S.token.value : null;
            if (op == "in" && no_in)
              op = null;
            var prec = op != null ? PRECEDENCE[op] : null;
            if (prec != null && prec > min_prec) {
              next();
              var right = expr_op(maybe_unary(true), prec, no_in);
              return expr_op(new AST_Binary({
                start: left.start,
                left: left,
                operator: op,
                right: right,
                end: right.end
              }), min_prec, no_in);
            }
            return left;
          };
          function expr_ops(no_in) {
            return expr_op(maybe_unary(true), 0, no_in);
          }
          ;
          var maybe_conditional = function(no_in) {
            var start = S.token;
            var expr = expr_ops(no_in);
            if (is("operator", "?")) {
              next();
              var yes = expression(false);
              expect(":");
              return new AST_Conditional({
                start: start,
                condition: expr,
                consequent: yes,
                alternative: expression(false, no_in),
                end: prev()
              });
            }
            return expr;
          };
          function is_assignable(expr) {
            if (!options.strict)
              return true;
            if (expr instanceof AST_This)
              return false;
            return (expr instanceof AST_PropAccess || expr instanceof AST_Symbol);
          }
          ;
          var maybe_assign = function(no_in) {
            var start = S.token;
            var left = maybe_conditional(no_in),
                val = S.token.value;
            if (is("operator") && ASSIGNMENT(val)) {
              if (is_assignable(left)) {
                next();
                return new AST_Assign({
                  start: start,
                  left: left,
                  operator: val,
                  right: maybe_assign(no_in),
                  end: prev()
                });
              }
              croak("Invalid assignment");
            }
            return left;
          };
          var expression = function(commas, no_in) {
            var start = S.token;
            var expr = maybe_assign(no_in);
            if (commas && is("punc", ",")) {
              next();
              return new AST_Seq({
                start: start,
                car: expr,
                cdr: expression(true, no_in),
                end: peek()
              });
            }
            return expr;
          };
          function in_loop(cont) {
            ++S.in_loop;
            var ret = cont();
            --S.in_loop;
            return ret;
          }
          ;
          if (options.expression) {
            return expression(true);
          }
          return (function() {
            var start = S.token;
            var body = [];
            while (!is("eof"))
              body.push(statement());
            var end = prev();
            var toplevel = options.toplevel;
            if (toplevel) {
              toplevel.body = toplevel.body.concat(body);
              toplevel.end = end;
            } else {
              toplevel = new AST_Toplevel({
                start: start,
                body: body,
                end: end
              });
            }
            return toplevel;
          })();
        }
        ;
        "use strict";
        function TreeTransformer(before, after) {
          TreeWalker.call(this);
          this.before = before;
          this.after = after;
        }
        TreeTransformer.prototype = new TreeWalker;
        (function(undefined) {
          function _(node, descend) {
            node.DEFMETHOD("transform", function(tw, in_list) {
              var x,
                  y;
              tw.push(this);
              if (tw.before)
                x = tw.before(this, descend, in_list);
              if (x === undefined) {
                if (!tw.after) {
                  x = this;
                  descend(x, tw);
                } else {
                  tw.stack[tw.stack.length - 1] = x = this.clone();
                  descend(x, tw);
                  y = tw.after(x, in_list);
                  if (y !== undefined)
                    x = y;
                }
              }
              tw.pop();
              return x;
            });
          }
          ;
          function do_list(list, tw) {
            return MAP(list, function(node) {
              return node.transform(tw, true);
            });
          }
          ;
          _(AST_Node, noop);
          _(AST_LabeledStatement, function(self, tw) {
            self.label = self.label.transform(tw);
            self.body = self.body.transform(tw);
          });
          _(AST_SimpleStatement, function(self, tw) {
            self.body = self.body.transform(tw);
          });
          _(AST_Block, function(self, tw) {
            self.body = do_list(self.body, tw);
          });
          _(AST_DWLoop, function(self, tw) {
            self.condition = self.condition.transform(tw);
            self.body = self.body.transform(tw);
          });
          _(AST_For, function(self, tw) {
            if (self.init)
              self.init = self.init.transform(tw);
            if (self.condition)
              self.condition = self.condition.transform(tw);
            if (self.step)
              self.step = self.step.transform(tw);
            self.body = self.body.transform(tw);
          });
          _(AST_ForIn, function(self, tw) {
            self.init = self.init.transform(tw);
            self.object = self.object.transform(tw);
            self.body = self.body.transform(tw);
          });
          _(AST_With, function(self, tw) {
            self.expression = self.expression.transform(tw);
            self.body = self.body.transform(tw);
          });
          _(AST_Exit, function(self, tw) {
            if (self.value)
              self.value = self.value.transform(tw);
          });
          _(AST_LoopControl, function(self, tw) {
            if (self.label)
              self.label = self.label.transform(tw);
          });
          _(AST_If, function(self, tw) {
            self.condition = self.condition.transform(tw);
            self.body = self.body.transform(tw);
            if (self.alternative)
              self.alternative = self.alternative.transform(tw);
          });
          _(AST_Switch, function(self, tw) {
            self.expression = self.expression.transform(tw);
            self.body = do_list(self.body, tw);
          });
          _(AST_Case, function(self, tw) {
            self.expression = self.expression.transform(tw);
            self.body = do_list(self.body, tw);
          });
          _(AST_Try, function(self, tw) {
            self.body = do_list(self.body, tw);
            if (self.bcatch)
              self.bcatch = self.bcatch.transform(tw);
            if (self.bfinally)
              self.bfinally = self.bfinally.transform(tw);
          });
          _(AST_Catch, function(self, tw) {
            self.argname = self.argname.transform(tw);
            self.body = do_list(self.body, tw);
          });
          _(AST_Definitions, function(self, tw) {
            self.definitions = do_list(self.definitions, tw);
          });
          _(AST_VarDef, function(self, tw) {
            self.name = self.name.transform(tw);
            if (self.value)
              self.value = self.value.transform(tw);
          });
          _(AST_Lambda, function(self, tw) {
            if (self.name)
              self.name = self.name.transform(tw);
            self.argnames = do_list(self.argnames, tw);
            self.body = do_list(self.body, tw);
          });
          _(AST_Call, function(self, tw) {
            self.expression = self.expression.transform(tw);
            self.args = do_list(self.args, tw);
          });
          _(AST_Seq, function(self, tw) {
            self.car = self.car.transform(tw);
            self.cdr = self.cdr.transform(tw);
          });
          _(AST_Dot, function(self, tw) {
            self.expression = self.expression.transform(tw);
          });
          _(AST_Sub, function(self, tw) {
            self.expression = self.expression.transform(tw);
            self.property = self.property.transform(tw);
          });
          _(AST_Unary, function(self, tw) {
            self.expression = self.expression.transform(tw);
          });
          _(AST_Binary, function(self, tw) {
            self.left = self.left.transform(tw);
            self.right = self.right.transform(tw);
          });
          _(AST_Conditional, function(self, tw) {
            self.condition = self.condition.transform(tw);
            self.consequent = self.consequent.transform(tw);
            self.alternative = self.alternative.transform(tw);
          });
          _(AST_Array, function(self, tw) {
            self.elements = do_list(self.elements, tw);
          });
          _(AST_Object, function(self, tw) {
            self.properties = do_list(self.properties, tw);
          });
          _(AST_ObjectProperty, function(self, tw) {
            self.value = self.value.transform(tw);
          });
        })();
        "use strict";
        function SymbolDef(scope, index, orig) {
          this.name = orig.name;
          this.orig = [orig];
          this.scope = scope;
          this.references = [];
          this.global = false;
          this.mangled_name = null;
          this.undeclared = false;
          this.constant = false;
          this.index = index;
        }
        ;
        SymbolDef.prototype = {
          unmangleable: function(options) {
            return (this.global && !(options && options.toplevel)) || this.undeclared || (!(options && options.eval) && (this.scope.uses_eval || this.scope.uses_with));
          },
          mangle: function(options) {
            if (!this.mangled_name && !this.unmangleable(options)) {
              var s = this.scope;
              if (!options.screw_ie8 && this.orig[0] instanceof AST_SymbolLambda)
                s = s.parent_scope;
              this.mangled_name = s.next_mangled(options, this);
            }
          }
        };
        AST_Toplevel.DEFMETHOD("figure_out_scope", function(options) {
          options = defaults(options, {screw_ie8: false});
          var self = this;
          var scope = self.parent_scope = null;
          var defun = null;
          var nesting = 0;
          var tw = new TreeWalker(function(node, descend) {
            if (options.screw_ie8 && node instanceof AST_Catch) {
              var save_scope = scope;
              scope = new AST_Scope(node);
              scope.init_scope_vars(nesting);
              scope.parent_scope = save_scope;
              descend();
              scope = save_scope;
              return true;
            }
            if (node instanceof AST_Scope) {
              node.init_scope_vars(nesting);
              var save_scope = node.parent_scope = scope;
              var save_defun = defun;
              defun = scope = node;
              ++nesting;
              descend();
              --nesting;
              scope = save_scope;
              defun = save_defun;
              return true;
            }
            if (node instanceof AST_Directive) {
              node.scope = scope;
              push_uniq(scope.directives, node.value);
              return true;
            }
            if (node instanceof AST_With) {
              for (var s = scope; s; s = s.parent_scope)
                s.uses_with = true;
              return ;
            }
            if (node instanceof AST_Symbol) {
              node.scope = scope;
            }
            if (node instanceof AST_SymbolLambda) {
              defun.def_function(node);
            } else if (node instanceof AST_SymbolDefun) {
              (node.scope = defun.parent_scope).def_function(node);
            } else if (node instanceof AST_SymbolVar || node instanceof AST_SymbolConst) {
              var def = defun.def_variable(node);
              def.constant = node instanceof AST_SymbolConst;
              def.init = tw.parent().value;
            } else if (node instanceof AST_SymbolCatch) {
              (options.screw_ie8 ? scope : defun).def_variable(node);
            }
          });
          self.walk(tw);
          var func = null;
          var globals = self.globals = new Dictionary();
          var tw = new TreeWalker(function(node, descend) {
            if (node instanceof AST_Lambda) {
              var prev_func = func;
              func = node;
              descend();
              func = prev_func;
              return true;
            }
            if (node instanceof AST_SymbolRef) {
              var name = node.name;
              var sym = node.scope.find_variable(name);
              if (!sym) {
                var g;
                if (globals.has(name)) {
                  g = globals.get(name);
                } else {
                  g = new SymbolDef(self, globals.size(), node);
                  g.undeclared = true;
                  g.global = true;
                  globals.set(name, g);
                }
                node.thedef = g;
                if (name == "eval" && tw.parent() instanceof AST_Call) {
                  for (var s = node.scope; s && !s.uses_eval; s = s.parent_scope)
                    s.uses_eval = true;
                }
                if (func && name == "arguments") {
                  func.uses_arguments = true;
                }
              } else {
                node.thedef = sym;
              }
              node.reference();
              return true;
            }
          });
          self.walk(tw);
        });
        AST_Scope.DEFMETHOD("init_scope_vars", function(nesting) {
          this.directives = [];
          this.variables = new Dictionary();
          this.functions = new Dictionary();
          this.uses_with = false;
          this.uses_eval = false;
          this.parent_scope = null;
          this.enclosed = [];
          this.cname = -1;
          this.nesting = nesting;
        });
        AST_Scope.DEFMETHOD("strict", function() {
          return this.has_directive("use strict");
        });
        AST_Lambda.DEFMETHOD("init_scope_vars", function() {
          AST_Scope.prototype.init_scope_vars.apply(this, arguments);
          this.uses_arguments = false;
        });
        AST_SymbolRef.DEFMETHOD("reference", function() {
          var def = this.definition();
          def.references.push(this);
          var s = this.scope;
          while (s) {
            push_uniq(s.enclosed, def);
            if (s === def.scope)
              break;
            s = s.parent_scope;
          }
          this.frame = this.scope.nesting - def.scope.nesting;
        });
        AST_Scope.DEFMETHOD("find_variable", function(name) {
          if (name instanceof AST_Symbol)
            name = name.name;
          return this.variables.get(name) || (this.parent_scope && this.parent_scope.find_variable(name));
        });
        AST_Scope.DEFMETHOD("has_directive", function(value) {
          return this.parent_scope && this.parent_scope.has_directive(value) || (this.directives.indexOf(value) >= 0 ? this : null);
        });
        AST_Scope.DEFMETHOD("def_function", function(symbol) {
          this.functions.set(symbol.name, this.def_variable(symbol));
        });
        AST_Scope.DEFMETHOD("def_variable", function(symbol) {
          var def;
          if (!this.variables.has(symbol.name)) {
            def = new SymbolDef(this, this.variables.size(), symbol);
            this.variables.set(symbol.name, def);
            def.global = !this.parent_scope;
          } else {
            def = this.variables.get(symbol.name);
            def.orig.push(symbol);
          }
          return symbol.thedef = def;
        });
        AST_Scope.DEFMETHOD("next_mangled", function(options) {
          var ext = this.enclosed;
          out: while (true) {
            var m = base54(++this.cname);
            if (!is_identifier(m))
              continue;
            if (options.except.indexOf(m) >= 0)
              continue;
            for (var i = ext.length; --i >= 0; ) {
              var sym = ext[i];
              var name = sym.mangled_name || (sym.unmangleable(options) && sym.name);
              if (m == name)
                continue out;
            }
            return m;
          }
        });
        AST_Function.DEFMETHOD("next_mangled", function(options, def) {
          var tricky_def = def.orig[0] instanceof AST_SymbolFunarg && this.name && this.name.definition();
          while (true) {
            var name = AST_Lambda.prototype.next_mangled.call(this, options, def);
            if (!(tricky_def && tricky_def.mangled_name == name))
              return name;
          }
        });
        AST_Scope.DEFMETHOD("references", function(sym) {
          if (sym instanceof AST_Symbol)
            sym = sym.definition();
          return this.enclosed.indexOf(sym) < 0 ? null : sym;
        });
        AST_Symbol.DEFMETHOD("unmangleable", function(options) {
          return this.definition().unmangleable(options);
        });
        AST_SymbolAccessor.DEFMETHOD("unmangleable", function() {
          return true;
        });
        AST_Label.DEFMETHOD("unmangleable", function() {
          return false;
        });
        AST_Symbol.DEFMETHOD("unreferenced", function() {
          return this.definition().references.length == 0 && !(this.scope.uses_eval || this.scope.uses_with);
        });
        AST_Symbol.DEFMETHOD("undeclared", function() {
          return this.definition().undeclared;
        });
        AST_LabelRef.DEFMETHOD("undeclared", function() {
          return false;
        });
        AST_Label.DEFMETHOD("undeclared", function() {
          return false;
        });
        AST_Symbol.DEFMETHOD("definition", function() {
          return this.thedef;
        });
        AST_Symbol.DEFMETHOD("global", function() {
          return this.definition().global;
        });
        AST_Toplevel.DEFMETHOD("_default_mangler_options", function(options) {
          return defaults(options, {
            except: [],
            eval: false,
            sort: false,
            toplevel: false,
            screw_ie8: false
          });
        });
        AST_Toplevel.DEFMETHOD("mangle_names", function(options) {
          options = this._default_mangler_options(options);
          var lname = -1;
          var to_mangle = [];
          var tw = new TreeWalker(function(node, descend) {
            if (node instanceof AST_LabeledStatement) {
              var save_nesting = lname;
              descend();
              lname = save_nesting;
              return true;
            }
            if (node instanceof AST_Scope) {
              var p = tw.parent(),
                  a = [];
              node.variables.each(function(symbol) {
                if (options.except.indexOf(symbol.name) < 0) {
                  a.push(symbol);
                }
              });
              if (options.sort)
                a.sort(function(a, b) {
                  return b.references.length - a.references.length;
                });
              to_mangle.push.apply(to_mangle, a);
              return ;
            }
            if (node instanceof AST_Label) {
              var name;
              do
                name = base54(++lname);
 while (!is_identifier(name));
              node.mangled_name = name;
              return true;
            }
            if (options.screw_ie8 && node instanceof AST_SymbolCatch) {
              to_mangle.push(node.definition());
              return ;
            }
          });
          this.walk(tw);
          to_mangle.forEach(function(def) {
            def.mangle(options);
          });
        });
        AST_Toplevel.DEFMETHOD("compute_char_frequency", function(options) {
          options = this._default_mangler_options(options);
          var tw = new TreeWalker(function(node) {
            if (node instanceof AST_Constant)
              base54.consider(node.print_to_string());
            else if (node instanceof AST_Return)
              base54.consider("return");
            else if (node instanceof AST_Throw)
              base54.consider("throw");
            else if (node instanceof AST_Continue)
              base54.consider("continue");
            else if (node instanceof AST_Break)
              base54.consider("break");
            else if (node instanceof AST_Debugger)
              base54.consider("debugger");
            else if (node instanceof AST_Directive)
              base54.consider(node.value);
            else if (node instanceof AST_While)
              base54.consider("while");
            else if (node instanceof AST_Do)
              base54.consider("do while");
            else if (node instanceof AST_If) {
              base54.consider("if");
              if (node.alternative)
                base54.consider("else");
            } else if (node instanceof AST_Var)
              base54.consider("var");
            else if (node instanceof AST_Const)
              base54.consider("const");
            else if (node instanceof AST_Lambda)
              base54.consider("function");
            else if (node instanceof AST_For)
              base54.consider("for");
            else if (node instanceof AST_ForIn)
              base54.consider("for in");
            else if (node instanceof AST_Switch)
              base54.consider("switch");
            else if (node instanceof AST_Case)
              base54.consider("case");
            else if (node instanceof AST_Default)
              base54.consider("default");
            else if (node instanceof AST_With)
              base54.consider("with");
            else if (node instanceof AST_ObjectSetter)
              base54.consider("set" + node.key);
            else if (node instanceof AST_ObjectGetter)
              base54.consider("get" + node.key);
            else if (node instanceof AST_ObjectKeyVal)
              base54.consider(node.key);
            else if (node instanceof AST_New)
              base54.consider("new");
            else if (node instanceof AST_This)
              base54.consider("this");
            else if (node instanceof AST_Try)
              base54.consider("try");
            else if (node instanceof AST_Catch)
              base54.consider("catch");
            else if (node instanceof AST_Finally)
              base54.consider("finally");
            else if (node instanceof AST_Symbol && node.unmangleable(options))
              base54.consider(node.name);
            else if (node instanceof AST_Unary || node instanceof AST_Binary)
              base54.consider(node.operator);
            else if (node instanceof AST_Dot)
              base54.consider(node.property);
          });
          this.walk(tw);
          base54.sort();
        });
        var base54 = (function() {
          var string = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ$_0123456789";
          var chars,
              frequency;
          function reset() {
            frequency = Object.create(null);
            chars = string.split("").map(function(ch) {
              return ch.charCodeAt(0);
            });
            chars.forEach(function(ch) {
              frequency[ch] = 0;
            });
          }
          base54.consider = function(str) {
            for (var i = str.length; --i >= 0; ) {
              var code = str.charCodeAt(i);
              if (code in frequency)
                ++frequency[code];
            }
          };
          base54.sort = function() {
            chars = mergeSort(chars, function(a, b) {
              if (is_digit(a) && !is_digit(b))
                return 1;
              if (is_digit(b) && !is_digit(a))
                return -1;
              return frequency[b] - frequency[a];
            });
          };
          base54.reset = reset;
          reset();
          base54.get = function() {
            return chars;
          };
          base54.freq = function() {
            return frequency;
          };
          function base54(num) {
            var ret = "",
                base = 54;
            do {
              ret += String.fromCharCode(chars[num % base]);
              num = Math.floor(num / base);
              base = 64;
            } while (num > 0);
            return ret;
          }
          ;
          return base54;
        })();
        AST_Toplevel.DEFMETHOD("scope_warnings", function(options) {
          options = defaults(options, {
            undeclared: false,
            unreferenced: true,
            assign_to_global: true,
            func_arguments: true,
            nested_defuns: true,
            eval: true
          });
          var tw = new TreeWalker(function(node) {
            if (options.undeclared && node instanceof AST_SymbolRef && node.undeclared()) {
              AST_Node.warn("Undeclared symbol: {name} [{file}:{line},{col}]", {
                name: node.name,
                file: node.start.file,
                line: node.start.line,
                col: node.start.col
              });
            }
            if (options.assign_to_global) {
              var sym = null;
              if (node instanceof AST_Assign && node.left instanceof AST_SymbolRef)
                sym = node.left;
              else if (node instanceof AST_ForIn && node.init instanceof AST_SymbolRef)
                sym = node.init;
              if (sym && (sym.undeclared() || (sym.global() && sym.scope !== sym.definition().scope))) {
                AST_Node.warn("{msg}: {name} [{file}:{line},{col}]", {
                  msg: sym.undeclared() ? "Accidental global?" : "Assignment to global",
                  name: sym.name,
                  file: sym.start.file,
                  line: sym.start.line,
                  col: sym.start.col
                });
              }
            }
            if (options.eval && node instanceof AST_SymbolRef && node.undeclared() && node.name == "eval") {
              AST_Node.warn("Eval is used [{file}:{line},{col}]", node.start);
            }
            if (options.unreferenced && (node instanceof AST_SymbolDeclaration || node instanceof AST_Label) && !(node instanceof AST_SymbolCatch) && node.unreferenced()) {
              AST_Node.warn("{type} {name} is declared but not referenced [{file}:{line},{col}]", {
                type: node instanceof AST_Label ? "Label" : "Symbol",
                name: node.name,
                file: node.start.file,
                line: node.start.line,
                col: node.start.col
              });
            }
            if (options.func_arguments && node instanceof AST_Lambda && node.uses_arguments) {
              AST_Node.warn("arguments used in function {name} [{file}:{line},{col}]", {
                name: node.name ? node.name.name : "anonymous",
                file: node.start.file,
                line: node.start.line,
                col: node.start.col
              });
            }
            if (options.nested_defuns && node instanceof AST_Defun && !(tw.parent() instanceof AST_Scope)) {
              AST_Node.warn("Function {name} declared in nested statement \"{type}\" [{file}:{line},{col}]", {
                name: node.name.name,
                type: tw.parent().TYPE,
                file: node.start.file,
                line: node.start.line,
                col: node.start.col
              });
            }
          });
          this.walk(tw);
        });
        "use strict";
        function OutputStream(options) {
          options = defaults(options, {
            indent_start: 0,
            indent_level: 4,
            quote_keys: false,
            space_colon: true,
            ascii_only: false,
            unescape_regexps: false,
            inline_script: false,
            width: 80,
            max_line_len: 32000,
            beautify: false,
            source_map: null,
            bracketize: false,
            semicolons: true,
            comments: false,
            preserve_line: false,
            screw_ie8: false,
            preamble: null
          }, true);
          var indentation = 0;
          var current_col = 0;
          var current_line = 1;
          var current_pos = 0;
          var OUTPUT = "";
          function to_ascii(str, identifier) {
            return str.replace(/[\u0080-\uffff]/g, function(ch) {
              var code = ch.charCodeAt(0).toString(16);
              if (code.length <= 2 && !identifier) {
                while (code.length < 2)
                  code = "0" + code;
                return "\\x" + code;
              } else {
                while (code.length < 4)
                  code = "0" + code;
                return "\\u" + code;
              }
            });
          }
          ;
          function make_string(str) {
            var dq = 0,
                sq = 0;
            str = str.replace(/[\\\b\f\n\r\t\x22\x27\u2028\u2029\0]/g, function(s) {
              switch (s) {
                case "\\":
                  return "\\\\";
                case "\b":
                  return "\\b";
                case "\f":
                  return "\\f";
                case "\n":
                  return "\\n";
                case "\r":
                  return "\\r";
                case "\u2028":
                  return "\\u2028";
                case "\u2029":
                  return "\\u2029";
                case '"':
                  ++dq;
                  return '"';
                case "'":
                  ++sq;
                  return "'";
                case "\0":
                  return "\\x00";
              }
              return s;
            });
            if (options.ascii_only)
              str = to_ascii(str);
            if (dq > sq)
              return "'" + str.replace(/\x27/g, "\\'") + "'";
            else
              return '"' + str.replace(/\x22/g, '\\"') + '"';
          }
          ;
          function encode_string(str) {
            var ret = make_string(str);
            if (options.inline_script)
              ret = ret.replace(/<\x2fscript([>\/\t\n\f\r ])/gi, "<\\/script$1");
            return ret;
          }
          ;
          function make_name(name) {
            name = name.toString();
            if (options.ascii_only)
              name = to_ascii(name, true);
            return name;
          }
          ;
          function make_indent(back) {
            return repeat_string(" ", options.indent_start + indentation - back * options.indent_level);
          }
          ;
          var might_need_space = false;
          var might_need_semicolon = false;
          var last = null;
          function last_char() {
            return last.charAt(last.length - 1);
          }
          ;
          function maybe_newline() {
            if (options.max_line_len && current_col > options.max_line_len)
              print("\n");
          }
          ;
          var requireSemicolonChars = makePredicate("( [ + * / - , .");
          function print(str) {
            str = String(str);
            var ch = str.charAt(0);
            if (might_need_semicolon) {
              if ((!ch || ";}".indexOf(ch) < 0) && !/[;]$/.test(last)) {
                if (options.semicolons || requireSemicolonChars(ch)) {
                  OUTPUT += ";";
                  current_col++;
                  current_pos++;
                } else {
                  OUTPUT += "\n";
                  current_pos++;
                  current_line++;
                  current_col = 0;
                }
                if (!options.beautify)
                  might_need_space = false;
              }
              might_need_semicolon = false;
              maybe_newline();
            }
            if (!options.beautify && options.preserve_line && stack[stack.length - 1]) {
              var target_line = stack[stack.length - 1].start.line;
              while (current_line < target_line) {
                OUTPUT += "\n";
                current_pos++;
                current_line++;
                current_col = 0;
                might_need_space = false;
              }
            }
            if (might_need_space) {
              var prev = last_char();
              if ((is_identifier_char(prev) && (is_identifier_char(ch) || ch == "\\")) || (/^[\+\-\/]$/.test(ch) && ch == prev)) {
                OUTPUT += " ";
                current_col++;
                current_pos++;
              }
              might_need_space = false;
            }
            var a = str.split(/\r?\n/),
                n = a.length - 1;
            current_line += n;
            if (n == 0) {
              current_col += a[n].length;
            } else {
              current_col = a[n].length;
            }
            current_pos += str.length;
            last = str;
            OUTPUT += str;
          }
          ;
          var space = options.beautify ? function() {
            print(" ");
          } : function() {
            might_need_space = true;
          };
          var indent = options.beautify ? function(half) {
            if (options.beautify) {
              print(make_indent(half ? 0.5 : 0));
            }
          } : noop;
          var with_indent = options.beautify ? function(col, cont) {
            if (col === true)
              col = next_indent();
            var save_indentation = indentation;
            indentation = col;
            var ret = cont();
            indentation = save_indentation;
            return ret;
          } : function(col, cont) {
            return cont();
          };
          var newline = options.beautify ? function() {
            print("\n");
          } : noop;
          var semicolon = options.beautify ? function() {
            print(";");
          } : function() {
            might_need_semicolon = true;
          };
          function force_semicolon() {
            might_need_semicolon = false;
            print(";");
          }
          ;
          function next_indent() {
            return indentation + options.indent_level;
          }
          ;
          function with_block(cont) {
            var ret;
            print("{");
            newline();
            with_indent(next_indent(), function() {
              ret = cont();
            });
            indent();
            print("}");
            return ret;
          }
          ;
          function with_parens(cont) {
            print("(");
            var ret = cont();
            print(")");
            return ret;
          }
          ;
          function with_square(cont) {
            print("[");
            var ret = cont();
            print("]");
            return ret;
          }
          ;
          function comma() {
            print(",");
            space();
          }
          ;
          function colon() {
            print(":");
            if (options.space_colon)
              space();
          }
          ;
          var add_mapping = options.source_map ? function(token, name) {
            try {
              if (token)
                options.source_map.add(token.file || "?", current_line, current_col, token.line, token.col, (!name && token.type == "name") ? token.value : name);
            } catch (ex) {
              AST_Node.warn("Couldn't figure out mapping for {file}:{line},{col} → {cline},{ccol} [{name}]", {
                file: token.file,
                line: token.line,
                col: token.col,
                cline: current_line,
                ccol: current_col,
                name: name || ""
              });
            }
          } : noop;
          function get() {
            return OUTPUT;
          }
          ;
          if (options.preamble) {
            print(options.preamble.replace(/\r\n?|[\n\u2028\u2029]|\s*$/g, "\n"));
          }
          var stack = [];
          return {
            get: get,
            toString: get,
            indent: indent,
            indentation: function() {
              return indentation;
            },
            current_width: function() {
              return current_col - indentation;
            },
            should_break: function() {
              return options.width && this.current_width() >= options.width;
            },
            newline: newline,
            print: print,
            space: space,
            comma: comma,
            colon: colon,
            last: function() {
              return last;
            },
            semicolon: semicolon,
            force_semicolon: force_semicolon,
            to_ascii: to_ascii,
            print_name: function(name) {
              print(make_name(name));
            },
            print_string: function(str) {
              print(encode_string(str));
            },
            next_indent: next_indent,
            with_indent: with_indent,
            with_block: with_block,
            with_parens: with_parens,
            with_square: with_square,
            add_mapping: add_mapping,
            option: function(opt) {
              return options[opt];
            },
            line: function() {
              return current_line;
            },
            col: function() {
              return current_col;
            },
            pos: function() {
              return current_pos;
            },
            push_node: function(node) {
              stack.push(node);
            },
            pop_node: function() {
              return stack.pop();
            },
            stack: function() {
              return stack;
            },
            parent: function(n) {
              return stack[stack.length - 2 - (n || 0)];
            }
          };
        }
        ;
        (function() {
          function DEFPRINT(nodetype, generator) {
            nodetype.DEFMETHOD("_codegen", generator);
          }
          ;
          AST_Node.DEFMETHOD("print", function(stream, force_parens) {
            var self = this,
                generator = self._codegen;
            function doit() {
              self.add_comments(stream);
              self.add_source_map(stream);
              generator(self, stream);
            }
            stream.push_node(self);
            if (force_parens || self.needs_parens(stream)) {
              stream.with_parens(doit);
            } else {
              doit();
            }
            stream.pop_node();
          });
          AST_Node.DEFMETHOD("print_to_string", function(options) {
            var s = OutputStream(options);
            this.print(s);
            return s.get();
          });
          AST_Node.DEFMETHOD("add_comments", function(output) {
            var c = output.option("comments"),
                self = this;
            if (c) {
              var start = self.start;
              if (start && !start._comments_dumped) {
                start._comments_dumped = true;
                var comments = start.comments_before || [];
                if (self instanceof AST_Exit && self.value) {
                  self.value.walk(new TreeWalker(function(node) {
                    if (node.start && node.start.comments_before) {
                      comments = comments.concat(node.start.comments_before);
                      node.start.comments_before = [];
                    }
                    if (node instanceof AST_Function || node instanceof AST_Array || node instanceof AST_Object) {
                      return true;
                    }
                  }));
                }
                if (c.test) {
                  comments = comments.filter(function(comment) {
                    return c.test(comment.value);
                  });
                } else if (typeof c == "function") {
                  comments = comments.filter(function(comment) {
                    return c(self, comment);
                  });
                }
                comments.forEach(function(c) {
                  if (/comment[134]/.test(c.type)) {
                    output.print("//" + c.value + "\n");
                    output.indent();
                  } else if (c.type == "comment2") {
                    output.print("/*" + c.value + "*/");
                    if (start.nlb) {
                      output.print("\n");
                      output.indent();
                    } else {
                      output.space();
                    }
                  }
                });
              }
            }
          });
          function PARENS(nodetype, func) {
            if (Array.isArray(nodetype)) {
              nodetype.forEach(function(nodetype) {
                PARENS(nodetype, func);
              });
            } else {
              nodetype.DEFMETHOD("needs_parens", func);
            }
          }
          ;
          PARENS(AST_Node, function() {
            return false;
          });
          PARENS(AST_Function, function(output) {
            return first_in_statement(output);
          });
          PARENS(AST_Object, function(output) {
            return first_in_statement(output);
          });
          PARENS([AST_Unary, AST_Undefined], function(output) {
            var p = output.parent();
            return p instanceof AST_PropAccess && p.expression === this;
          });
          PARENS(AST_Seq, function(output) {
            var p = output.parent();
            return p instanceof AST_Call || p instanceof AST_Unary || p instanceof AST_Binary || p instanceof AST_VarDef || p instanceof AST_PropAccess || p instanceof AST_Array || p instanceof AST_ObjectProperty || p instanceof AST_Conditional;
            ;
          });
          PARENS(AST_Binary, function(output) {
            var p = output.parent();
            if (p instanceof AST_Call && p.expression === this)
              return true;
            if (p instanceof AST_Unary)
              return true;
            if (p instanceof AST_PropAccess && p.expression === this)
              return true;
            if (p instanceof AST_Binary) {
              var po = p.operator,
                  pp = PRECEDENCE[po];
              var so = this.operator,
                  sp = PRECEDENCE[so];
              if (pp > sp || (pp == sp && this === p.right)) {
                return true;
              }
            }
          });
          PARENS(AST_PropAccess, function(output) {
            var p = output.parent();
            if (p instanceof AST_New && p.expression === this) {
              try {
                this.walk(new TreeWalker(function(node) {
                  if (node instanceof AST_Call)
                    throw p;
                }));
              } catch (ex) {
                if (ex !== p)
                  throw ex;
                return true;
              }
            }
          });
          PARENS(AST_Call, function(output) {
            var p = output.parent(),
                p1;
            if (p instanceof AST_New && p.expression === this)
              return true;
            return this.expression instanceof AST_Function && p instanceof AST_PropAccess && p.expression === this && (p1 = output.parent(1)) instanceof AST_Assign && p1.left === p;
          });
          PARENS(AST_New, function(output) {
            var p = output.parent();
            if (no_constructor_parens(this, output) && (p instanceof AST_PropAccess || p instanceof AST_Call && p.expression === this))
              return true;
          });
          PARENS(AST_Number, function(output) {
            var p = output.parent();
            if (this.getValue() < 0 && p instanceof AST_PropAccess && p.expression === this)
              return true;
          });
          PARENS(AST_NaN, function(output) {
            var p = output.parent();
            if (p instanceof AST_PropAccess && p.expression === this)
              return true;
          });
          PARENS([AST_Assign, AST_Conditional], function(output) {
            var p = output.parent();
            if (p instanceof AST_Unary)
              return true;
            if (p instanceof AST_Binary && !(p instanceof AST_Assign))
              return true;
            if (p instanceof AST_Call && p.expression === this)
              return true;
            if (p instanceof AST_Conditional && p.condition === this)
              return true;
            if (p instanceof AST_PropAccess && p.expression === this)
              return true;
          });
          DEFPRINT(AST_Directive, function(self, output) {
            output.print_string(self.value);
            output.semicolon();
          });
          DEFPRINT(AST_Debugger, function(self, output) {
            output.print("debugger");
            output.semicolon();
          });
          function display_body(body, is_toplevel, output) {
            var last = body.length - 1;
            body.forEach(function(stmt, i) {
              if (!(stmt instanceof AST_EmptyStatement)) {
                output.indent();
                stmt.print(output);
                if (!(i == last && is_toplevel)) {
                  output.newline();
                  if (is_toplevel)
                    output.newline();
                }
              }
            });
          }
          ;
          AST_StatementWithBody.DEFMETHOD("_do_print_body", function(output) {
            force_statement(this.body, output);
          });
          DEFPRINT(AST_Statement, function(self, output) {
            self.body.print(output);
            output.semicolon();
          });
          DEFPRINT(AST_Toplevel, function(self, output) {
            display_body(self.body, true, output);
            output.print("");
          });
          DEFPRINT(AST_LabeledStatement, function(self, output) {
            self.label.print(output);
            output.colon();
            self.body.print(output);
          });
          DEFPRINT(AST_SimpleStatement, function(self, output) {
            self.body.print(output);
            output.semicolon();
          });
          function print_bracketed(body, output) {
            if (body.length > 0)
              output.with_block(function() {
                display_body(body, false, output);
              });
            else
              output.print("{}");
          }
          ;
          DEFPRINT(AST_BlockStatement, function(self, output) {
            print_bracketed(self.body, output);
          });
          DEFPRINT(AST_EmptyStatement, function(self, output) {
            output.semicolon();
          });
          DEFPRINT(AST_Do, function(self, output) {
            output.print("do");
            output.space();
            self._do_print_body(output);
            output.space();
            output.print("while");
            output.space();
            output.with_parens(function() {
              self.condition.print(output);
            });
            output.semicolon();
          });
          DEFPRINT(AST_While, function(self, output) {
            output.print("while");
            output.space();
            output.with_parens(function() {
              self.condition.print(output);
            });
            output.space();
            self._do_print_body(output);
          });
          DEFPRINT(AST_For, function(self, output) {
            output.print("for");
            output.space();
            output.with_parens(function() {
              if (self.init && !(self.init instanceof AST_EmptyStatement)) {
                if (self.init instanceof AST_Definitions) {
                  self.init.print(output);
                } else {
                  parenthesize_for_noin(self.init, output, true);
                }
                output.print(";");
                output.space();
              } else {
                output.print(";");
              }
              if (self.condition) {
                self.condition.print(output);
                output.print(";");
                output.space();
              } else {
                output.print(";");
              }
              if (self.step) {
                self.step.print(output);
              }
            });
            output.space();
            self._do_print_body(output);
          });
          DEFPRINT(AST_ForIn, function(self, output) {
            output.print("for");
            output.space();
            output.with_parens(function() {
              self.init.print(output);
              output.space();
              output.print("in");
              output.space();
              self.object.print(output);
            });
            output.space();
            self._do_print_body(output);
          });
          DEFPRINT(AST_With, function(self, output) {
            output.print("with");
            output.space();
            output.with_parens(function() {
              self.expression.print(output);
            });
            output.space();
            self._do_print_body(output);
          });
          AST_Lambda.DEFMETHOD("_do_print", function(output, nokeyword) {
            var self = this;
            if (!nokeyword) {
              output.print("function");
            }
            if (self.name) {
              output.space();
              self.name.print(output);
            }
            output.with_parens(function() {
              self.argnames.forEach(function(arg, i) {
                if (i)
                  output.comma();
                arg.print(output);
              });
            });
            output.space();
            print_bracketed(self.body, output);
          });
          DEFPRINT(AST_Lambda, function(self, output) {
            self._do_print(output);
          });
          AST_Exit.DEFMETHOD("_do_print", function(output, kind) {
            output.print(kind);
            if (this.value) {
              output.space();
              this.value.print(output);
            }
            output.semicolon();
          });
          DEFPRINT(AST_Return, function(self, output) {
            self._do_print(output, "return");
          });
          DEFPRINT(AST_Throw, function(self, output) {
            self._do_print(output, "throw");
          });
          AST_LoopControl.DEFMETHOD("_do_print", function(output, kind) {
            output.print(kind);
            if (this.label) {
              output.space();
              this.label.print(output);
            }
            output.semicolon();
          });
          DEFPRINT(AST_Break, function(self, output) {
            self._do_print(output, "break");
          });
          DEFPRINT(AST_Continue, function(self, output) {
            self._do_print(output, "continue");
          });
          function make_then(self, output) {
            if (output.option("bracketize")) {
              make_block(self.body, output);
              return ;
            }
            if (!self.body)
              return output.force_semicolon();
            if (self.body instanceof AST_Do && !output.option("screw_ie8")) {
              make_block(self.body, output);
              return ;
            }
            var b = self.body;
            while (true) {
              if (b instanceof AST_If) {
                if (!b.alternative) {
                  make_block(self.body, output);
                  return ;
                }
                b = b.alternative;
              } else if (b instanceof AST_StatementWithBody) {
                b = b.body;
              } else
                break;
            }
            force_statement(self.body, output);
          }
          ;
          DEFPRINT(AST_If, function(self, output) {
            output.print("if");
            output.space();
            output.with_parens(function() {
              self.condition.print(output);
            });
            output.space();
            if (self.alternative) {
              make_then(self, output);
              output.space();
              output.print("else");
              output.space();
              force_statement(self.alternative, output);
            } else {
              self._do_print_body(output);
            }
          });
          DEFPRINT(AST_Switch, function(self, output) {
            output.print("switch");
            output.space();
            output.with_parens(function() {
              self.expression.print(output);
            });
            output.space();
            if (self.body.length > 0)
              output.with_block(function() {
                self.body.forEach(function(stmt, i) {
                  if (i)
                    output.newline();
                  output.indent(true);
                  stmt.print(output);
                });
              });
            else
              output.print("{}");
          });
          AST_SwitchBranch.DEFMETHOD("_do_print_body", function(output) {
            if (this.body.length > 0) {
              output.newline();
              this.body.forEach(function(stmt) {
                output.indent();
                stmt.print(output);
                output.newline();
              });
            }
          });
          DEFPRINT(AST_Default, function(self, output) {
            output.print("default:");
            self._do_print_body(output);
          });
          DEFPRINT(AST_Case, function(self, output) {
            output.print("case");
            output.space();
            self.expression.print(output);
            output.print(":");
            self._do_print_body(output);
          });
          DEFPRINT(AST_Try, function(self, output) {
            output.print("try");
            output.space();
            print_bracketed(self.body, output);
            if (self.bcatch) {
              output.space();
              self.bcatch.print(output);
            }
            if (self.bfinally) {
              output.space();
              self.bfinally.print(output);
            }
          });
          DEFPRINT(AST_Catch, function(self, output) {
            output.print("catch");
            output.space();
            output.with_parens(function() {
              self.argname.print(output);
            });
            output.space();
            print_bracketed(self.body, output);
          });
          DEFPRINT(AST_Finally, function(self, output) {
            output.print("finally");
            output.space();
            print_bracketed(self.body, output);
          });
          AST_Definitions.DEFMETHOD("_do_print", function(output, kind) {
            output.print(kind);
            output.space();
            this.definitions.forEach(function(def, i) {
              if (i)
                output.comma();
              def.print(output);
            });
            var p = output.parent();
            var in_for = p instanceof AST_For || p instanceof AST_ForIn;
            var avoid_semicolon = in_for && p.init === this;
            if (!avoid_semicolon)
              output.semicolon();
          });
          DEFPRINT(AST_Var, function(self, output) {
            self._do_print(output, "var");
          });
          DEFPRINT(AST_Const, function(self, output) {
            self._do_print(output, "const");
          });
          function parenthesize_for_noin(node, output, noin) {
            if (!noin)
              node.print(output);
            else
              try {
                node.walk(new TreeWalker(function(node) {
                  if (node instanceof AST_Binary && node.operator == "in")
                    throw output;
                }));
                node.print(output);
              } catch (ex) {
                if (ex !== output)
                  throw ex;
                node.print(output, true);
              }
          }
          ;
          DEFPRINT(AST_VarDef, function(self, output) {
            self.name.print(output);
            if (self.value) {
              output.space();
              output.print("=");
              output.space();
              var p = output.parent(1);
              var noin = p instanceof AST_For || p instanceof AST_ForIn;
              parenthesize_for_noin(self.value, output, noin);
            }
          });
          DEFPRINT(AST_Call, function(self, output) {
            self.expression.print(output);
            if (self instanceof AST_New && no_constructor_parens(self, output))
              return ;
            output.with_parens(function() {
              self.args.forEach(function(expr, i) {
                if (i)
                  output.comma();
                expr.print(output);
              });
            });
          });
          DEFPRINT(AST_New, function(self, output) {
            output.print("new");
            output.space();
            AST_Call.prototype._codegen(self, output);
          });
          AST_Seq.DEFMETHOD("_do_print", function(output) {
            this.car.print(output);
            if (this.cdr) {
              output.comma();
              if (output.should_break()) {
                output.newline();
                output.indent();
              }
              this.cdr.print(output);
            }
          });
          DEFPRINT(AST_Seq, function(self, output) {
            self._do_print(output);
          });
          DEFPRINT(AST_Dot, function(self, output) {
            var expr = self.expression;
            expr.print(output);
            if (expr instanceof AST_Number && expr.getValue() >= 0) {
              if (!/[xa-f.]/i.test(output.last())) {
                output.print(".");
              }
            }
            output.print(".");
            output.add_mapping(self.end);
            output.print_name(self.property);
          });
          DEFPRINT(AST_Sub, function(self, output) {
            self.expression.print(output);
            output.print("[");
            self.property.print(output);
            output.print("]");
          });
          DEFPRINT(AST_UnaryPrefix, function(self, output) {
            var op = self.operator;
            output.print(op);
            if (/^[a-z]/i.test(op) || (/[+-]$/.test(op) && self.expression instanceof AST_UnaryPrefix && /^[+-]/.test(self.expression.operator))) {
              output.space();
            }
            self.expression.print(output);
          });
          DEFPRINT(AST_UnaryPostfix, function(self, output) {
            self.expression.print(output);
            output.print(self.operator);
          });
          DEFPRINT(AST_Binary, function(self, output) {
            self.left.print(output);
            output.space();
            output.print(self.operator);
            if (self.operator == "<" && self.right instanceof AST_UnaryPrefix && self.right.operator == "!" && self.right.expression instanceof AST_UnaryPrefix && self.right.expression.operator == "--") {
              output.print(" ");
            } else {
              output.space();
            }
            self.right.print(output);
          });
          DEFPRINT(AST_Conditional, function(self, output) {
            self.condition.print(output);
            output.space();
            output.print("?");
            output.space();
            self.consequent.print(output);
            output.space();
            output.colon();
            self.alternative.print(output);
          });
          DEFPRINT(AST_Array, function(self, output) {
            output.with_square(function() {
              var a = self.elements,
                  len = a.length;
              if (len > 0)
                output.space();
              a.forEach(function(exp, i) {
                if (i)
                  output.comma();
                exp.print(output);
                if (i === len - 1 && exp instanceof AST_Hole)
                  output.comma();
              });
              if (len > 0)
                output.space();
            });
          });
          DEFPRINT(AST_Object, function(self, output) {
            if (self.properties.length > 0)
              output.with_block(function() {
                self.properties.forEach(function(prop, i) {
                  if (i) {
                    output.print(",");
                    output.newline();
                  }
                  output.indent();
                  prop.print(output);
                });
                output.newline();
              });
            else
              output.print("{}");
          });
          DEFPRINT(AST_ObjectKeyVal, function(self, output) {
            var key = self.key;
            if (output.option("quote_keys")) {
              output.print_string(key + "");
            } else if ((typeof key == "number" || !output.option("beautify") && +key + "" == key) && parseFloat(key) >= 0) {
              output.print(make_num(key));
            } else if (RESERVED_WORDS(key) ? output.option("screw_ie8") : is_identifier_string(key)) {
              output.print_name(key);
            } else {
              output.print_string(key);
            }
            output.colon();
            self.value.print(output);
          });
          DEFPRINT(AST_ObjectSetter, function(self, output) {
            output.print("set");
            output.space();
            self.key.print(output);
            self.value._do_print(output, true);
          });
          DEFPRINT(AST_ObjectGetter, function(self, output) {
            output.print("get");
            output.space();
            self.key.print(output);
            self.value._do_print(output, true);
          });
          DEFPRINT(AST_Symbol, function(self, output) {
            var def = self.definition();
            output.print_name(def ? def.mangled_name || def.name : self.name);
          });
          DEFPRINT(AST_Undefined, function(self, output) {
            output.print("void 0");
          });
          DEFPRINT(AST_Hole, noop);
          DEFPRINT(AST_Infinity, function(self, output) {
            output.print("1/0");
          });
          DEFPRINT(AST_NaN, function(self, output) {
            output.print("0/0");
          });
          DEFPRINT(AST_This, function(self, output) {
            output.print("this");
          });
          DEFPRINT(AST_Constant, function(self, output) {
            output.print(self.getValue());
          });
          DEFPRINT(AST_String, function(self, output) {
            output.print_string(self.getValue());
          });
          DEFPRINT(AST_Number, function(self, output) {
            output.print(make_num(self.getValue()));
          });
          function regexp_safe_literal(code) {
            return [0x5c, 0x2f, 0x2e, 0x2b, 0x2a, 0x3f, 0x28, 0x29, 0x5b, 0x5d, 0x7b, 0x7d, 0x24, 0x5e, 0x3a, 0x7c, 0x21, 0x0a, 0x0d, 0x00, 0xfeff, 0x2028, 0x2029].indexOf(code) < 0;
          }
          ;
          DEFPRINT(AST_RegExp, function(self, output) {
            var str = self.getValue().toString();
            if (output.option("ascii_only")) {
              str = output.to_ascii(str);
            } else if (output.option("unescape_regexps")) {
              str = str.split("\\\\").map(function(str) {
                return str.replace(/\\u[0-9a-fA-F]{4}|\\x[0-9a-fA-F]{2}/g, function(s) {
                  var code = parseInt(s.substr(2), 16);
                  return regexp_safe_literal(code) ? String.fromCharCode(code) : s;
                });
              }).join("\\\\");
            }
            output.print(str);
            var p = output.parent();
            if (p instanceof AST_Binary && /^in/.test(p.operator) && p.left === self)
              output.print(" ");
          });
          function force_statement(stat, output) {
            if (output.option("bracketize")) {
              if (!stat || stat instanceof AST_EmptyStatement)
                output.print("{}");
              else if (stat instanceof AST_BlockStatement)
                stat.print(output);
              else
                output.with_block(function() {
                  output.indent();
                  stat.print(output);
                  output.newline();
                });
            } else {
              if (!stat || stat instanceof AST_EmptyStatement)
                output.force_semicolon();
              else
                stat.print(output);
            }
          }
          ;
          function first_in_statement(output) {
            var a = output.stack(),
                i = a.length,
                node = a[--i],
                p = a[--i];
            while (i > 0) {
              if (p instanceof AST_Statement && p.body === node)
                return true;
              if ((p instanceof AST_Seq && p.car === node) || (p instanceof AST_Call && p.expression === node && !(p instanceof AST_New)) || (p instanceof AST_Dot && p.expression === node) || (p instanceof AST_Sub && p.expression === node) || (p instanceof AST_Conditional && p.condition === node) || (p instanceof AST_Binary && p.left === node) || (p instanceof AST_UnaryPostfix && p.expression === node)) {
                node = p;
                p = a[--i];
              } else {
                return false;
              }
            }
          }
          ;
          function no_constructor_parens(self, output) {
            return self.args.length == 0 && !output.option("beautify");
          }
          ;
          function best_of(a) {
            var best = a[0],
                len = best.length;
            for (var i = 1; i < a.length; ++i) {
              if (a[i].length < len) {
                best = a[i];
                len = best.length;
              }
            }
            return best;
          }
          ;
          function make_num(num) {
            var str = num.toString(10),
                a = [str.replace(/^0\./, ".").replace('e+', 'e')],
                m;
            if (Math.floor(num) === num) {
              if (num >= 0) {
                a.push("0x" + num.toString(16).toLowerCase(), "0" + num.toString(8));
              } else {
                a.push("-0x" + (-num).toString(16).toLowerCase(), "-0" + (-num).toString(8));
              }
              if ((m = /^(.*?)(0+)$/.exec(num))) {
                a.push(m[1] + "e" + m[2].length);
              }
            } else if ((m = /^0?\.(0+)(.*)$/.exec(num))) {
              a.push(m[2] + "e-" + (m[1].length + m[2].length), str.substr(str.indexOf(".")));
            }
            return best_of(a);
          }
          ;
          function make_block(stmt, output) {
            if (stmt instanceof AST_BlockStatement) {
              stmt.print(output);
              return ;
            }
            output.with_block(function() {
              output.indent();
              stmt.print(output);
              output.newline();
            });
          }
          ;
          function DEFMAP(nodetype, generator) {
            nodetype.DEFMETHOD("add_source_map", function(stream) {
              generator(this, stream);
            });
          }
          ;
          DEFMAP(AST_Node, noop);
          function basic_sourcemap_gen(self, output) {
            output.add_mapping(self.start);
          }
          ;
          DEFMAP(AST_Directive, basic_sourcemap_gen);
          DEFMAP(AST_Debugger, basic_sourcemap_gen);
          DEFMAP(AST_Symbol, basic_sourcemap_gen);
          DEFMAP(AST_Jump, basic_sourcemap_gen);
          DEFMAP(AST_StatementWithBody, basic_sourcemap_gen);
          DEFMAP(AST_LabeledStatement, noop);
          DEFMAP(AST_Lambda, basic_sourcemap_gen);
          DEFMAP(AST_Switch, basic_sourcemap_gen);
          DEFMAP(AST_SwitchBranch, basic_sourcemap_gen);
          DEFMAP(AST_BlockStatement, basic_sourcemap_gen);
          DEFMAP(AST_Toplevel, noop);
          DEFMAP(AST_New, basic_sourcemap_gen);
          DEFMAP(AST_Try, basic_sourcemap_gen);
          DEFMAP(AST_Catch, basic_sourcemap_gen);
          DEFMAP(AST_Finally, basic_sourcemap_gen);
          DEFMAP(AST_Definitions, basic_sourcemap_gen);
          DEFMAP(AST_Constant, basic_sourcemap_gen);
          DEFMAP(AST_ObjectProperty, function(self, output) {
            output.add_mapping(self.start, self.key);
          });
        })();
        "use strict";
        function Compressor(options, false_by_default) {
          if (!(this instanceof Compressor))
            return new Compressor(options, false_by_default);
          TreeTransformer.call(this, this.before, this.after);
          this.options = defaults(options, {
            sequences: !false_by_default,
            properties: !false_by_default,
            dead_code: !false_by_default,
            drop_debugger: !false_by_default,
            unsafe: false,
            unsafe_comps: false,
            conditionals: !false_by_default,
            comparisons: !false_by_default,
            evaluate: !false_by_default,
            booleans: !false_by_default,
            loops: !false_by_default,
            unused: !false_by_default,
            hoist_funs: !false_by_default,
            keep_fargs: false,
            hoist_vars: false,
            if_return: !false_by_default,
            join_vars: !false_by_default,
            cascade: !false_by_default,
            side_effects: !false_by_default,
            pure_getters: false,
            pure_funcs: null,
            negate_iife: !false_by_default,
            screw_ie8: false,
            drop_console: false,
            angular: false,
            warnings: true,
            global_defs: {}
          }, true);
        }
        ;
        Compressor.prototype = new TreeTransformer;
        merge(Compressor.prototype, {
          option: function(key) {
            return this.options[key];
          },
          warn: function() {
            if (this.options.warnings)
              AST_Node.warn.apply(AST_Node, arguments);
          },
          before: function(node, descend, in_list) {
            if (node._squeezed)
              return node;
            var was_scope = false;
            if (node instanceof AST_Scope) {
              node = node.hoist_declarations(this);
              was_scope = true;
            }
            descend(node, this);
            node = node.optimize(this);
            if (was_scope && node instanceof AST_Scope) {
              node.drop_unused(this);
              descend(node, this);
            }
            node._squeezed = true;
            return node;
          }
        });
        (function() {
          function OPT(node, optimizer) {
            node.DEFMETHOD("optimize", function(compressor) {
              var self = this;
              if (self._optimized)
                return self;
              var opt = optimizer(self, compressor);
              opt._optimized = true;
              if (opt === self)
                return opt;
              return opt.transform(compressor);
            });
          }
          ;
          OPT(AST_Node, function(self, compressor) {
            return self;
          });
          AST_Node.DEFMETHOD("equivalent_to", function(node) {
            return this.print_to_string() == node.print_to_string();
          });
          function make_node(ctor, orig, props) {
            if (!props)
              props = {};
            if (orig) {
              if (!props.start)
                props.start = orig.start;
              if (!props.end)
                props.end = orig.end;
            }
            return new ctor(props);
          }
          ;
          function make_node_from_constant(compressor, val, orig) {
            if (val instanceof AST_Node)
              return val.transform(compressor);
            switch (typeof val) {
              case "string":
                return make_node(AST_String, orig, {value: val}).optimize(compressor);
              case "number":
                return make_node(isNaN(val) ? AST_NaN : AST_Number, orig, {value: val}).optimize(compressor);
              case "boolean":
                return make_node(val ? AST_True : AST_False, orig).optimize(compressor);
              case "undefined":
                return make_node(AST_Undefined, orig).optimize(compressor);
              default:
                if (val === null) {
                  return make_node(AST_Null, orig).optimize(compressor);
                }
                if (val instanceof RegExp) {
                  return make_node(AST_RegExp, orig).optimize(compressor);
                }
                throw new Error(string_template("Can't handle constant of type: {type}", {type: typeof val}));
            }
          }
          ;
          function as_statement_array(thing) {
            if (thing === null)
              return [];
            if (thing instanceof AST_BlockStatement)
              return thing.body;
            if (thing instanceof AST_EmptyStatement)
              return [];
            if (thing instanceof AST_Statement)
              return [thing];
            throw new Error("Can't convert thing to statement array");
          }
          ;
          function is_empty(thing) {
            if (thing === null)
              return true;
            if (thing instanceof AST_EmptyStatement)
              return true;
            if (thing instanceof AST_BlockStatement)
              return thing.body.length == 0;
            return false;
          }
          ;
          function loop_body(x) {
            if (x instanceof AST_Switch)
              return x;
            if (x instanceof AST_For || x instanceof AST_ForIn || x instanceof AST_DWLoop) {
              return (x.body instanceof AST_BlockStatement ? x.body : x);
            }
            return x;
          }
          ;
          function tighten_body(statements, compressor) {
            var CHANGED;
            do {
              CHANGED = false;
              if (compressor.option("angular")) {
                statements = process_for_angular(statements);
              }
              statements = eliminate_spurious_blocks(statements);
              if (compressor.option("dead_code")) {
                statements = eliminate_dead_code(statements, compressor);
              }
              if (compressor.option("if_return")) {
                statements = handle_if_return(statements, compressor);
              }
              if (compressor.option("sequences")) {
                statements = sequencesize(statements, compressor);
              }
              if (compressor.option("join_vars")) {
                statements = join_consecutive_vars(statements, compressor);
              }
            } while (CHANGED);
            if (compressor.option("negate_iife")) {
              negate_iifes(statements, compressor);
            }
            return statements;
            function process_for_angular(statements) {
              function make_injector(func, name) {
                return make_node(AST_SimpleStatement, func, {body: make_node(AST_Assign, func, {
                    operator: "=",
                    left: make_node(AST_Dot, name, {
                      expression: make_node(AST_SymbolRef, name, name),
                      property: "$inject"
                    }),
                    right: make_node(AST_Array, func, {elements: func.argnames.map(function(sym) {
                        return make_node(AST_String, sym, {value: sym.name});
                      })})
                  })});
              }
              return statements.reduce(function(a, stat) {
                a.push(stat);
                var token = stat.start;
                var comments = token.comments_before;
                if (comments && comments.length > 0) {
                  var last = comments.pop();
                  if (/@ngInject/.test(last.value)) {
                    if (stat instanceof AST_Defun) {
                      a.push(make_injector(stat, stat.name));
                    } else if (stat instanceof AST_Definitions) {
                      stat.definitions.forEach(function(def) {
                        if (def.value && def.value instanceof AST_Lambda) {
                          a.push(make_injector(def.value, def.name));
                        }
                      });
                    } else {
                      compressor.warn("Unknown statement marked with @ngInject [{file}:{line},{col}]", token);
                    }
                  }
                }
                return a;
              }, []);
            }
            function eliminate_spurious_blocks(statements) {
              var seen_dirs = [];
              return statements.reduce(function(a, stat) {
                if (stat instanceof AST_BlockStatement) {
                  CHANGED = true;
                  a.push.apply(a, eliminate_spurious_blocks(stat.body));
                } else if (stat instanceof AST_EmptyStatement) {
                  CHANGED = true;
                } else if (stat instanceof AST_Directive) {
                  if (seen_dirs.indexOf(stat.value) < 0) {
                    a.push(stat);
                    seen_dirs.push(stat.value);
                  } else {
                    CHANGED = true;
                  }
                } else {
                  a.push(stat);
                }
                return a;
              }, []);
            }
            ;
            function handle_if_return(statements, compressor) {
              var self = compressor.self();
              var in_lambda = self instanceof AST_Lambda;
              var ret = [];
              loop: for (var i = statements.length; --i >= 0; ) {
                var stat = statements[i];
                switch (true) {
                  case (in_lambda && stat instanceof AST_Return && !stat.value && ret.length == 0):
                    CHANGED = true;
                    continue loop;
                  case stat instanceof AST_If:
                    if (stat.body instanceof AST_Return) {
                      if (((in_lambda && ret.length == 0) || (ret[0] instanceof AST_Return && !ret[0].value)) && !stat.body.value && !stat.alternative) {
                        CHANGED = true;
                        var cond = make_node(AST_SimpleStatement, stat.condition, {body: stat.condition});
                        ret.unshift(cond);
                        continue loop;
                      }
                      if (ret[0] instanceof AST_Return && stat.body.value && ret[0].value && !stat.alternative) {
                        CHANGED = true;
                        stat = stat.clone();
                        stat.alternative = ret[0];
                        ret[0] = stat.transform(compressor);
                        continue loop;
                      }
                      if ((ret.length == 0 || ret[0] instanceof AST_Return) && stat.body.value && !stat.alternative && in_lambda) {
                        CHANGED = true;
                        stat = stat.clone();
                        stat.alternative = ret[0] || make_node(AST_Return, stat, {value: make_node(AST_Undefined, stat)});
                        ret[0] = stat.transform(compressor);
                        continue loop;
                      }
                      if (!stat.body.value && in_lambda) {
                        CHANGED = true;
                        stat = stat.clone();
                        stat.condition = stat.condition.negate(compressor);
                        stat.body = make_node(AST_BlockStatement, stat, {body: as_statement_array(stat.alternative).concat(ret)});
                        stat.alternative = null;
                        ret = [stat.transform(compressor)];
                        continue loop;
                      }
                      if (ret.length == 1 && in_lambda && ret[0] instanceof AST_SimpleStatement && (!stat.alternative || stat.alternative instanceof AST_SimpleStatement)) {
                        CHANGED = true;
                        ret.push(make_node(AST_Return, ret[0], {value: make_node(AST_Undefined, ret[0])}).transform(compressor));
                        ret = as_statement_array(stat.alternative).concat(ret);
                        ret.unshift(stat);
                        continue loop;
                      }
                    }
                    var ab = aborts(stat.body);
                    var lct = ab instanceof AST_LoopControl ? compressor.loopcontrol_target(ab.label) : null;
                    if (ab && ((ab instanceof AST_Return && !ab.value && in_lambda) || (ab instanceof AST_Continue && self === loop_body(lct)) || (ab instanceof AST_Break && lct instanceof AST_BlockStatement && self === lct))) {
                      if (ab.label) {
                        remove(ab.label.thedef.references, ab);
                      }
                      CHANGED = true;
                      var body = as_statement_array(stat.body).slice(0, -1);
                      stat = stat.clone();
                      stat.condition = stat.condition.negate(compressor);
                      stat.body = make_node(AST_BlockStatement, stat, {body: as_statement_array(stat.alternative).concat(ret)});
                      stat.alternative = make_node(AST_BlockStatement, stat, {body: body});
                      ret = [stat.transform(compressor)];
                      continue loop;
                    }
                    var ab = aborts(stat.alternative);
                    var lct = ab instanceof AST_LoopControl ? compressor.loopcontrol_target(ab.label) : null;
                    if (ab && ((ab instanceof AST_Return && !ab.value && in_lambda) || (ab instanceof AST_Continue && self === loop_body(lct)) || (ab instanceof AST_Break && lct instanceof AST_BlockStatement && self === lct))) {
                      if (ab.label) {
                        remove(ab.label.thedef.references, ab);
                      }
                      CHANGED = true;
                      stat = stat.clone();
                      stat.body = make_node(AST_BlockStatement, stat.body, {body: as_statement_array(stat.body).concat(ret)});
                      stat.alternative = make_node(AST_BlockStatement, stat.alternative, {body: as_statement_array(stat.alternative).slice(0, -1)});
                      ret = [stat.transform(compressor)];
                      continue loop;
                    }
                    ret.unshift(stat);
                    break;
                  default:
                    ret.unshift(stat);
                    break;
                }
              }
              return ret;
            }
            ;
            function eliminate_dead_code(statements, compressor) {
              var has_quit = false;
              var orig = statements.length;
              var self = compressor.self();
              statements = statements.reduce(function(a, stat) {
                if (has_quit) {
                  extract_declarations_from_unreachable_code(compressor, stat, a);
                } else {
                  if (stat instanceof AST_LoopControl) {
                    var lct = compressor.loopcontrol_target(stat.label);
                    if ((stat instanceof AST_Break && lct instanceof AST_BlockStatement && loop_body(lct) === self) || (stat instanceof AST_Continue && loop_body(lct) === self)) {
                      if (stat.label) {
                        remove(stat.label.thedef.references, stat);
                      }
                    } else {
                      a.push(stat);
                    }
                  } else {
                    a.push(stat);
                  }
                  if (aborts(stat))
                    has_quit = true;
                }
                return a;
              }, []);
              CHANGED = statements.length != orig;
              return statements;
            }
            ;
            function sequencesize(statements, compressor) {
              if (statements.length < 2)
                return statements;
              var seq = [],
                  ret = [];
              function push_seq() {
                seq = AST_Seq.from_array(seq);
                if (seq)
                  ret.push(make_node(AST_SimpleStatement, seq, {body: seq}));
                seq = [];
              }
              ;
              statements.forEach(function(stat) {
                if (stat instanceof AST_SimpleStatement)
                  seq.push(stat.body);
                else
                  push_seq(), ret.push(stat);
              });
              push_seq();
              ret = sequencesize_2(ret, compressor);
              CHANGED = ret.length != statements.length;
              return ret;
            }
            ;
            function sequencesize_2(statements, compressor) {
              function cons_seq(right) {
                ret.pop();
                var left = prev.body;
                if (left instanceof AST_Seq) {
                  left.add(right);
                } else {
                  left = AST_Seq.cons(left, right);
                }
                return left.transform(compressor);
              }
              ;
              var ret = [],
                  prev = null;
              statements.forEach(function(stat) {
                if (prev) {
                  if (stat instanceof AST_For) {
                    var opera = {};
                    try {
                      prev.body.walk(new TreeWalker(function(node) {
                        if (node instanceof AST_Binary && node.operator == "in")
                          throw opera;
                      }));
                      if (stat.init && !(stat.init instanceof AST_Definitions)) {
                        stat.init = cons_seq(stat.init);
                      } else if (!stat.init) {
                        stat.init = prev.body;
                        ret.pop();
                      }
                    } catch (ex) {
                      if (ex !== opera)
                        throw ex;
                    }
                  } else if (stat instanceof AST_If) {
                    stat.condition = cons_seq(stat.condition);
                  } else if (stat instanceof AST_With) {
                    stat.expression = cons_seq(stat.expression);
                  } else if (stat instanceof AST_Exit && stat.value) {
                    stat.value = cons_seq(stat.value);
                  } else if (stat instanceof AST_Exit) {
                    stat.value = cons_seq(make_node(AST_Undefined, stat));
                  } else if (stat instanceof AST_Switch) {
                    stat.expression = cons_seq(stat.expression);
                  }
                }
                ret.push(stat);
                prev = stat instanceof AST_SimpleStatement ? stat : null;
              });
              return ret;
            }
            ;
            function join_consecutive_vars(statements, compressor) {
              var prev = null;
              return statements.reduce(function(a, stat) {
                if (stat instanceof AST_Definitions && prev && prev.TYPE == stat.TYPE) {
                  prev.definitions = prev.definitions.concat(stat.definitions);
                  CHANGED = true;
                } else if (stat instanceof AST_For && prev instanceof AST_Definitions && (!stat.init || stat.init.TYPE == prev.TYPE)) {
                  CHANGED = true;
                  a.pop();
                  if (stat.init) {
                    stat.init.definitions = prev.definitions.concat(stat.init.definitions);
                  } else {
                    stat.init = prev;
                  }
                  a.push(stat);
                  prev = stat;
                } else {
                  prev = stat;
                  a.push(stat);
                }
                return a;
              }, []);
            }
            ;
            function negate_iifes(statements, compressor) {
              statements.forEach(function(stat) {
                if (stat instanceof AST_SimpleStatement) {
                  stat.body = (function transform(thing) {
                    return thing.transform(new TreeTransformer(function(node) {
                      if (node instanceof AST_Call && node.expression instanceof AST_Function) {
                        return make_node(AST_UnaryPrefix, node, {
                          operator: "!",
                          expression: node
                        });
                      } else if (node instanceof AST_Call) {
                        node.expression = transform(node.expression);
                      } else if (node instanceof AST_Seq) {
                        node.car = transform(node.car);
                      } else if (node instanceof AST_Conditional) {
                        var expr = transform(node.condition);
                        if (expr !== node.condition) {
                          node.condition = expr;
                          var tmp = node.consequent;
                          node.consequent = node.alternative;
                          node.alternative = tmp;
                        }
                      }
                      return node;
                    }));
                  })(stat.body);
                }
              });
            }
            ;
          }
          ;
          function extract_declarations_from_unreachable_code(compressor, stat, target) {
            compressor.warn("Dropping unreachable code [{file}:{line},{col}]", stat.start);
            stat.walk(new TreeWalker(function(node) {
              if (node instanceof AST_Definitions) {
                compressor.warn("Declarations in unreachable code! [{file}:{line},{col}]", node.start);
                node.remove_initializers();
                target.push(node);
                return true;
              }
              if (node instanceof AST_Defun) {
                target.push(node);
                return true;
              }
              if (node instanceof AST_Scope) {
                return true;
              }
            }));
          }
          ;
          (function(def) {
            var unary_bool = ["!", "delete"];
            var binary_bool = ["in", "instanceof", "==", "!=", "===", "!==", "<", "<=", ">=", ">"];
            def(AST_Node, function() {
              return false;
            });
            def(AST_UnaryPrefix, function() {
              return member(this.operator, unary_bool);
            });
            def(AST_Binary, function() {
              return member(this.operator, binary_bool) || ((this.operator == "&&" || this.operator == "||") && this.left.is_boolean() && this.right.is_boolean());
            });
            def(AST_Conditional, function() {
              return this.consequent.is_boolean() && this.alternative.is_boolean();
            });
            def(AST_Assign, function() {
              return this.operator == "=" && this.right.is_boolean();
            });
            def(AST_Seq, function() {
              return this.cdr.is_boolean();
            });
            def(AST_True, function() {
              return true;
            });
            def(AST_False, function() {
              return true;
            });
          })(function(node, func) {
            node.DEFMETHOD("is_boolean", func);
          });
          (function(def) {
            def(AST_Node, function() {
              return false;
            });
            def(AST_String, function() {
              return true;
            });
            def(AST_UnaryPrefix, function() {
              return this.operator == "typeof";
            });
            def(AST_Binary, function(compressor) {
              return this.operator == "+" && (this.left.is_string(compressor) || this.right.is_string(compressor));
            });
            def(AST_Assign, function(compressor) {
              return (this.operator == "=" || this.operator == "+=") && this.right.is_string(compressor);
            });
            def(AST_Seq, function(compressor) {
              return this.cdr.is_string(compressor);
            });
            def(AST_Conditional, function(compressor) {
              return this.consequent.is_string(compressor) && this.alternative.is_string(compressor);
            });
            def(AST_Call, function(compressor) {
              return compressor.option("unsafe") && this.expression instanceof AST_SymbolRef && this.expression.name == "String" && this.expression.undeclared();
            });
          })(function(node, func) {
            node.DEFMETHOD("is_string", func);
          });
          function best_of(ast1, ast2) {
            return ast1.print_to_string().length > ast2.print_to_string().length ? ast2 : ast1;
          }
          ;
          (function(def) {
            AST_Node.DEFMETHOD("evaluate", function(compressor) {
              if (!compressor.option("evaluate"))
                return [this];
              try {
                var val = this._eval(compressor);
                return [best_of(make_node_from_constant(compressor, val, this), this), val];
              } catch (ex) {
                if (ex !== def)
                  throw ex;
                return [this];
              }
            });
            def(AST_Statement, function() {
              throw new Error(string_template("Cannot evaluate a statement [{file}:{line},{col}]", this.start));
            });
            def(AST_Function, function() {
              throw def;
            });
            function ev(node, compressor) {
              if (!compressor)
                throw new Error("Compressor must be passed");
              return node._eval(compressor);
            }
            ;
            def(AST_Node, function() {
              throw def;
            });
            def(AST_Constant, function() {
              return this.getValue();
            });
            def(AST_UnaryPrefix, function(compressor) {
              var e = this.expression;
              switch (this.operator) {
                case "!":
                  return !ev(e, compressor);
                case "typeof":
                  if (e instanceof AST_Function)
                    return typeof function() {};
                  e = ev(e, compressor);
                  if (e instanceof RegExp)
                    throw def;
                  return typeof e;
                case "void":
                  return void ev(e, compressor);
                case "~":
                  return ~ev(e, compressor);
                case "-":
                  e = ev(e, compressor);
                  if (e === 0)
                    throw def;
                  return -e;
                case "+":
                  return +ev(e, compressor);
              }
              throw def;
            });
            def(AST_Binary, function(c) {
              var left = this.left,
                  right = this.right;
              switch (this.operator) {
                case "&&":
                  return ev(left, c) && ev(right, c);
                case "||":
                  return ev(left, c) || ev(right, c);
                case "|":
                  return ev(left, c) | ev(right, c);
                case "&":
                  return ev(left, c) & ev(right, c);
                case "^":
                  return ev(left, c) ^ ev(right, c);
                case "+":
                  return ev(left, c) + ev(right, c);
                case "*":
                  return ev(left, c) * ev(right, c);
                case "/":
                  return ev(left, c) / ev(right, c);
                case "%":
                  return ev(left, c) % ev(right, c);
                case "-":
                  return ev(left, c) - ev(right, c);
                case "<<":
                  return ev(left, c) << ev(right, c);
                case ">>":
                  return ev(left, c) >> ev(right, c);
                case ">>>":
                  return ev(left, c) >>> ev(right, c);
                case "==":
                  return ev(left, c) == ev(right, c);
                case "===":
                  return ev(left, c) === ev(right, c);
                case "!=":
                  return ev(left, c) != ev(right, c);
                case "!==":
                  return ev(left, c) !== ev(right, c);
                case "<":
                  return ev(left, c) < ev(right, c);
                case "<=":
                  return ev(left, c) <= ev(right, c);
                case ">":
                  return ev(left, c) > ev(right, c);
                case ">=":
                  return ev(left, c) >= ev(right, c);
                case "in":
                  return ev(left, c) in ev(right, c);
                case "instanceof":
                  return ev(left, c) instanceof ev(right, c);
              }
              throw def;
            });
            def(AST_Conditional, function(compressor) {
              return ev(this.condition, compressor) ? ev(this.consequent, compressor) : ev(this.alternative, compressor);
            });
            def(AST_SymbolRef, function(compressor) {
              var d = this.definition();
              if (d && d.constant && d.init)
                return ev(d.init, compressor);
              throw def;
            });
            def(AST_Dot, function(compressor) {
              if (compressor.option("unsafe") && this.property == "length") {
                var str = ev(this.expression, compressor);
                if (typeof str == "string")
                  return str.length;
              }
              throw def;
            });
          })(function(node, func) {
            node.DEFMETHOD("_eval", func);
          });
          (function(def) {
            function basic_negation(exp) {
              return make_node(AST_UnaryPrefix, exp, {
                operator: "!",
                expression: exp
              });
            }
            ;
            def(AST_Node, function() {
              return basic_negation(this);
            });
            def(AST_Statement, function() {
              throw new Error("Cannot negate a statement");
            });
            def(AST_Function, function() {
              return basic_negation(this);
            });
            def(AST_UnaryPrefix, function() {
              if (this.operator == "!")
                return this.expression;
              return basic_negation(this);
            });
            def(AST_Seq, function(compressor) {
              var self = this.clone();
              self.cdr = self.cdr.negate(compressor);
              return self;
            });
            def(AST_Conditional, function(compressor) {
              var self = this.clone();
              self.consequent = self.consequent.negate(compressor);
              self.alternative = self.alternative.negate(compressor);
              return best_of(basic_negation(this), self);
            });
            def(AST_Binary, function(compressor) {
              var self = this.clone(),
                  op = this.operator;
              if (compressor.option("unsafe_comps")) {
                switch (op) {
                  case "<=":
                    self.operator = ">";
                    return self;
                  case "<":
                    self.operator = ">=";
                    return self;
                  case ">=":
                    self.operator = "<";
                    return self;
                  case ">":
                    self.operator = "<=";
                    return self;
                }
              }
              switch (op) {
                case "==":
                  self.operator = "!=";
                  return self;
                case "!=":
                  self.operator = "==";
                  return self;
                case "===":
                  self.operator = "!==";
                  return self;
                case "!==":
                  self.operator = "===";
                  return self;
                case "&&":
                  self.operator = "||";
                  self.left = self.left.negate(compressor);
                  self.right = self.right.negate(compressor);
                  return best_of(basic_negation(this), self);
                case "||":
                  self.operator = "&&";
                  self.left = self.left.negate(compressor);
                  self.right = self.right.negate(compressor);
                  return best_of(basic_negation(this), self);
              }
              return basic_negation(this);
            });
          })(function(node, func) {
            node.DEFMETHOD("negate", function(compressor) {
              return func.call(this, compressor);
            });
          });
          (function(def) {
            def(AST_Node, function(compressor) {
              return true;
            });
            def(AST_EmptyStatement, function(compressor) {
              return false;
            });
            def(AST_Constant, function(compressor) {
              return false;
            });
            def(AST_This, function(compressor) {
              return false;
            });
            def(AST_Call, function(compressor) {
              var pure = compressor.option("pure_funcs");
              if (!pure)
                return true;
              return pure.indexOf(this.expression.print_to_string()) < 0;
            });
            def(AST_Block, function(compressor) {
              for (var i = this.body.length; --i >= 0; ) {
                if (this.body[i].has_side_effects(compressor))
                  return true;
              }
              return false;
            });
            def(AST_SimpleStatement, function(compressor) {
              return this.body.has_side_effects(compressor);
            });
            def(AST_Defun, function(compressor) {
              return true;
            });
            def(AST_Function, function(compressor) {
              return false;
            });
            def(AST_Binary, function(compressor) {
              return this.left.has_side_effects(compressor) || this.right.has_side_effects(compressor);
            });
            def(AST_Assign, function(compressor) {
              return true;
            });
            def(AST_Conditional, function(compressor) {
              return this.condition.has_side_effects(compressor) || this.consequent.has_side_effects(compressor) || this.alternative.has_side_effects(compressor);
            });
            def(AST_Unary, function(compressor) {
              return this.operator == "delete" || this.operator == "++" || this.operator == "--" || this.expression.has_side_effects(compressor);
            });
            def(AST_SymbolRef, function(compressor) {
              return this.global() && this.undeclared();
            });
            def(AST_Object, function(compressor) {
              for (var i = this.properties.length; --i >= 0; )
                if (this.properties[i].has_side_effects(compressor))
                  return true;
              return false;
            });
            def(AST_ObjectProperty, function(compressor) {
              return this.value.has_side_effects(compressor);
            });
            def(AST_Array, function(compressor) {
              for (var i = this.elements.length; --i >= 0; )
                if (this.elements[i].has_side_effects(compressor))
                  return true;
              return false;
            });
            def(AST_Dot, function(compressor) {
              if (!compressor.option("pure_getters"))
                return true;
              return this.expression.has_side_effects(compressor);
            });
            def(AST_Sub, function(compressor) {
              if (!compressor.option("pure_getters"))
                return true;
              return this.expression.has_side_effects(compressor) || this.property.has_side_effects(compressor);
            });
            def(AST_PropAccess, function(compressor) {
              return !compressor.option("pure_getters");
            });
            def(AST_Seq, function(compressor) {
              return this.car.has_side_effects(compressor) || this.cdr.has_side_effects(compressor);
            });
          })(function(node, func) {
            node.DEFMETHOD("has_side_effects", func);
          });
          function aborts(thing) {
            return thing && thing.aborts();
          }
          ;
          (function(def) {
            def(AST_Statement, function() {
              return null;
            });
            def(AST_Jump, function() {
              return this;
            });
            function block_aborts() {
              var n = this.body.length;
              return n > 0 && aborts(this.body[n - 1]);
            }
            ;
            def(AST_BlockStatement, block_aborts);
            def(AST_SwitchBranch, block_aborts);
            def(AST_If, function() {
              return this.alternative && aborts(this.body) && aborts(this.alternative);
            });
          })(function(node, func) {
            node.DEFMETHOD("aborts", func);
          });
          OPT(AST_Directive, function(self, compressor) {
            if (self.scope.has_directive(self.value) !== self.scope) {
              return make_node(AST_EmptyStatement, self);
            }
            return self;
          });
          OPT(AST_Debugger, function(self, compressor) {
            if (compressor.option("drop_debugger"))
              return make_node(AST_EmptyStatement, self);
            return self;
          });
          OPT(AST_LabeledStatement, function(self, compressor) {
            if (self.body instanceof AST_Break && compressor.loopcontrol_target(self.body.label) === self.body) {
              return make_node(AST_EmptyStatement, self);
            }
            return self.label.references.length == 0 ? self.body : self;
          });
          OPT(AST_Block, function(self, compressor) {
            self.body = tighten_body(self.body, compressor);
            return self;
          });
          OPT(AST_BlockStatement, function(self, compressor) {
            self.body = tighten_body(self.body, compressor);
            switch (self.body.length) {
              case 1:
                return self.body[0];
              case 0:
                return make_node(AST_EmptyStatement, self);
            }
            return self;
          });
          AST_Scope.DEFMETHOD("drop_unused", function(compressor) {
            var self = this;
            if (compressor.option("unused") && !(self instanceof AST_Toplevel) && !self.uses_eval) {
              var in_use = [];
              var initializations = new Dictionary();
              var scope = this;
              var tw = new TreeWalker(function(node, descend) {
                if (node !== self) {
                  if (node instanceof AST_Defun) {
                    initializations.add(node.name.name, node);
                    return true;
                  }
                  if (node instanceof AST_Definitions && scope === self) {
                    node.definitions.forEach(function(def) {
                      if (def.value) {
                        initializations.add(def.name.name, def.value);
                        if (def.value.has_side_effects(compressor)) {
                          def.value.walk(tw);
                        }
                      }
                    });
                    return true;
                  }
                  if (node instanceof AST_SymbolRef) {
                    push_uniq(in_use, node.definition());
                    return true;
                  }
                  if (node instanceof AST_Scope) {
                    var save_scope = scope;
                    scope = node;
                    descend();
                    scope = save_scope;
                    return true;
                  }
                }
              });
              self.walk(tw);
              for (var i = 0; i < in_use.length; ++i) {
                in_use[i].orig.forEach(function(decl) {
                  var init = initializations.get(decl.name);
                  if (init)
                    init.forEach(function(init) {
                      var tw = new TreeWalker(function(node) {
                        if (node instanceof AST_SymbolRef) {
                          push_uniq(in_use, node.definition());
                        }
                      });
                      init.walk(tw);
                    });
                });
              }
              var tt = new TreeTransformer(function before(node, descend, in_list) {
                if (node instanceof AST_Lambda && !(node instanceof AST_Accessor)) {
                  if (!compressor.option("keep_fargs")) {
                    for (var a = node.argnames,
                        i = a.length; --i >= 0; ) {
                      var sym = a[i];
                      if (sym.unreferenced()) {
                        a.pop();
                        compressor.warn("Dropping unused function argument {name} [{file}:{line},{col}]", {
                          name: sym.name,
                          file: sym.start.file,
                          line: sym.start.line,
                          col: sym.start.col
                        });
                      } else
                        break;
                    }
                  }
                }
                if (node instanceof AST_Defun && node !== self) {
                  if (!member(node.name.definition(), in_use)) {
                    compressor.warn("Dropping unused function {name} [{file}:{line},{col}]", {
                      name: node.name.name,
                      file: node.name.start.file,
                      line: node.name.start.line,
                      col: node.name.start.col
                    });
                    return make_node(AST_EmptyStatement, node);
                  }
                  return node;
                }
                if (node instanceof AST_Definitions && !(tt.parent() instanceof AST_ForIn)) {
                  var def = node.definitions.filter(function(def) {
                    if (member(def.name.definition(), in_use))
                      return true;
                    var w = {
                      name: def.name.name,
                      file: def.name.start.file,
                      line: def.name.start.line,
                      col: def.name.start.col
                    };
                    if (def.value && def.value.has_side_effects(compressor)) {
                      def._unused_side_effects = true;
                      compressor.warn("Side effects in initialization of unused variable {name} [{file}:{line},{col}]", w);
                      return true;
                    }
                    compressor.warn("Dropping unused variable {name} [{file}:{line},{col}]", w);
                    return false;
                  });
                  def = mergeSort(def, function(a, b) {
                    if (!a.value && b.value)
                      return -1;
                    if (!b.value && a.value)
                      return 1;
                    return 0;
                  });
                  var side_effects = [];
                  for (var i = 0; i < def.length; ) {
                    var x = def[i];
                    if (x._unused_side_effects) {
                      side_effects.push(x.value);
                      def.splice(i, 1);
                    } else {
                      if (side_effects.length > 0) {
                        side_effects.push(x.value);
                        x.value = AST_Seq.from_array(side_effects);
                        side_effects = [];
                      }
                      ++i;
                    }
                  }
                  if (side_effects.length > 0) {
                    side_effects = make_node(AST_BlockStatement, node, {body: [make_node(AST_SimpleStatement, node, {body: AST_Seq.from_array(side_effects)})]});
                  } else {
                    side_effects = null;
                  }
                  if (def.length == 0 && !side_effects) {
                    return make_node(AST_EmptyStatement, node);
                  }
                  if (def.length == 0) {
                    return side_effects;
                  }
                  node.definitions = def;
                  if (side_effects) {
                    side_effects.body.unshift(node);
                    node = side_effects;
                  }
                  return node;
                }
                if (node instanceof AST_For) {
                  descend(node, this);
                  if (node.init instanceof AST_BlockStatement) {
                    var body = node.init.body.slice(0, -1);
                    node.init = node.init.body.slice(-1)[0].body;
                    body.push(node);
                    return in_list ? MAP.splice(body) : make_node(AST_BlockStatement, node, {body: body});
                  }
                }
                if (node instanceof AST_Scope && node !== self)
                  return node;
              });
              self.transform(tt);
            }
          });
          AST_Scope.DEFMETHOD("hoist_declarations", function(compressor) {
            var hoist_funs = compressor.option("hoist_funs");
            var hoist_vars = compressor.option("hoist_vars");
            var self = this;
            if (hoist_funs || hoist_vars) {
              var dirs = [];
              var hoisted = [];
              var vars = new Dictionary(),
                  vars_found = 0,
                  var_decl = 0;
              self.walk(new TreeWalker(function(node) {
                if (node instanceof AST_Scope && node !== self)
                  return true;
                if (node instanceof AST_Var) {
                  ++var_decl;
                  return true;
                }
              }));
              hoist_vars = hoist_vars && var_decl > 1;
              var tt = new TreeTransformer(function before(node) {
                if (node !== self) {
                  if (node instanceof AST_Directive) {
                    dirs.push(node);
                    return make_node(AST_EmptyStatement, node);
                  }
                  if (node instanceof AST_Defun && hoist_funs) {
                    hoisted.push(node);
                    return make_node(AST_EmptyStatement, node);
                  }
                  if (node instanceof AST_Var && hoist_vars) {
                    node.definitions.forEach(function(def) {
                      vars.set(def.name.name, def);
                      ++vars_found;
                    });
                    var seq = node.to_assignments();
                    var p = tt.parent();
                    if (p instanceof AST_ForIn && p.init === node) {
                      if (seq == null)
                        return node.definitions[0].name;
                      return seq;
                    }
                    if (p instanceof AST_For && p.init === node) {
                      return seq;
                    }
                    if (!seq)
                      return make_node(AST_EmptyStatement, node);
                    return make_node(AST_SimpleStatement, node, {body: seq});
                  }
                  if (node instanceof AST_Scope)
                    return node;
                }
              });
              self = self.transform(tt);
              if (vars_found > 0) {
                var defs = [];
                vars.each(function(def, name) {
                  if (self instanceof AST_Lambda && find_if(function(x) {
                    return x.name == def.name.name;
                  }, self.argnames)) {
                    vars.del(name);
                  } else {
                    def = def.clone();
                    def.value = null;
                    defs.push(def);
                    vars.set(name, def);
                  }
                });
                if (defs.length > 0) {
                  for (var i = 0; i < self.body.length; ) {
                    if (self.body[i] instanceof AST_SimpleStatement) {
                      var expr = self.body[i].body,
                          sym,
                          assign;
                      if (expr instanceof AST_Assign && expr.operator == "=" && (sym = expr.left) instanceof AST_Symbol && vars.has(sym.name)) {
                        var def = vars.get(sym.name);
                        if (def.value)
                          break;
                        def.value = expr.right;
                        remove(defs, def);
                        defs.push(def);
                        self.body.splice(i, 1);
                        continue;
                      }
                      if (expr instanceof AST_Seq && (assign = expr.car) instanceof AST_Assign && assign.operator == "=" && (sym = assign.left) instanceof AST_Symbol && vars.has(sym.name)) {
                        var def = vars.get(sym.name);
                        if (def.value)
                          break;
                        def.value = assign.right;
                        remove(defs, def);
                        defs.push(def);
                        self.body[i].body = expr.cdr;
                        continue;
                      }
                    }
                    if (self.body[i] instanceof AST_EmptyStatement) {
                      self.body.splice(i, 1);
                      continue;
                    }
                    if (self.body[i] instanceof AST_BlockStatement) {
                      var tmp = [i, 1].concat(self.body[i].body);
                      self.body.splice.apply(self.body, tmp);
                      continue;
                    }
                    break;
                  }
                  defs = make_node(AST_Var, self, {definitions: defs});
                  hoisted.push(defs);
                }
                ;
              }
              self.body = dirs.concat(hoisted, self.body);
            }
            return self;
          });
          OPT(AST_SimpleStatement, function(self, compressor) {
            if (compressor.option("side_effects")) {
              if (!self.body.has_side_effects(compressor)) {
                compressor.warn("Dropping side-effect-free statement [{file}:{line},{col}]", self.start);
                return make_node(AST_EmptyStatement, self);
              }
            }
            return self;
          });
          OPT(AST_DWLoop, function(self, compressor) {
            var cond = self.condition.evaluate(compressor);
            self.condition = cond[0];
            if (!compressor.option("loops"))
              return self;
            if (cond.length > 1) {
              if (cond[1]) {
                return make_node(AST_For, self, {body: self.body});
              } else if (self instanceof AST_While) {
                if (compressor.option("dead_code")) {
                  var a = [];
                  extract_declarations_from_unreachable_code(compressor, self.body, a);
                  return make_node(AST_BlockStatement, self, {body: a});
                }
              }
            }
            return self;
          });
          function if_break_in_loop(self, compressor) {
            function drop_it(rest) {
              rest = as_statement_array(rest);
              if (self.body instanceof AST_BlockStatement) {
                self.body = self.body.clone();
                self.body.body = rest.concat(self.body.body.slice(1));
                self.body = self.body.transform(compressor);
              } else {
                self.body = make_node(AST_BlockStatement, self.body, {body: rest}).transform(compressor);
              }
              if_break_in_loop(self, compressor);
            }
            var first = self.body instanceof AST_BlockStatement ? self.body.body[0] : self.body;
            if (first instanceof AST_If) {
              if (first.body instanceof AST_Break && compressor.loopcontrol_target(first.body.label) === self) {
                if (self.condition) {
                  self.condition = make_node(AST_Binary, self.condition, {
                    left: self.condition,
                    operator: "&&",
                    right: first.condition.negate(compressor)
                  });
                } else {
                  self.condition = first.condition.negate(compressor);
                }
                drop_it(first.alternative);
              } else if (first.alternative instanceof AST_Break && compressor.loopcontrol_target(first.alternative.label) === self) {
                if (self.condition) {
                  self.condition = make_node(AST_Binary, self.condition, {
                    left: self.condition,
                    operator: "&&",
                    right: first.condition
                  });
                } else {
                  self.condition = first.condition;
                }
                drop_it(first.body);
              }
            }
          }
          ;
          OPT(AST_While, function(self, compressor) {
            if (!compressor.option("loops"))
              return self;
            self = AST_DWLoop.prototype.optimize.call(self, compressor);
            if (self instanceof AST_While) {
              if_break_in_loop(self, compressor);
              self = make_node(AST_For, self, self).transform(compressor);
            }
            return self;
          });
          OPT(AST_For, function(self, compressor) {
            var cond = self.condition;
            if (cond) {
              cond = cond.evaluate(compressor);
              self.condition = cond[0];
            }
            if (!compressor.option("loops"))
              return self;
            if (cond) {
              if (cond.length > 1 && !cond[1]) {
                if (compressor.option("dead_code")) {
                  var a = [];
                  if (self.init instanceof AST_Statement) {
                    a.push(self.init);
                  } else if (self.init) {
                    a.push(make_node(AST_SimpleStatement, self.init, {body: self.init}));
                  }
                  extract_declarations_from_unreachable_code(compressor, self.body, a);
                  return make_node(AST_BlockStatement, self, {body: a});
                }
              }
            }
            if_break_in_loop(self, compressor);
            return self;
          });
          OPT(AST_If, function(self, compressor) {
            if (!compressor.option("conditionals"))
              return self;
            var cond = self.condition.evaluate(compressor);
            self.condition = cond[0];
            if (cond.length > 1) {
              if (cond[1]) {
                compressor.warn("Condition always true [{file}:{line},{col}]", self.condition.start);
                if (compressor.option("dead_code")) {
                  var a = [];
                  if (self.alternative) {
                    extract_declarations_from_unreachable_code(compressor, self.alternative, a);
                  }
                  a.push(self.body);
                  return make_node(AST_BlockStatement, self, {body: a}).transform(compressor);
                }
              } else {
                compressor.warn("Condition always false [{file}:{line},{col}]", self.condition.start);
                if (compressor.option("dead_code")) {
                  var a = [];
                  extract_declarations_from_unreachable_code(compressor, self.body, a);
                  if (self.alternative)
                    a.push(self.alternative);
                  return make_node(AST_BlockStatement, self, {body: a}).transform(compressor);
                }
              }
            }
            if (is_empty(self.alternative))
              self.alternative = null;
            var negated = self.condition.negate(compressor);
            var negated_is_best = best_of(self.condition, negated) === negated;
            if (self.alternative && negated_is_best) {
              negated_is_best = false;
              self.condition = negated;
              var tmp = self.body;
              self.body = self.alternative || make_node(AST_EmptyStatement);
              self.alternative = tmp;
            }
            if (is_empty(self.body) && is_empty(self.alternative)) {
              return make_node(AST_SimpleStatement, self.condition, {body: self.condition}).transform(compressor);
            }
            if (self.body instanceof AST_SimpleStatement && self.alternative instanceof AST_SimpleStatement) {
              return make_node(AST_SimpleStatement, self, {body: make_node(AST_Conditional, self, {
                  condition: self.condition,
                  consequent: self.body.body,
                  alternative: self.alternative.body
                })}).transform(compressor);
            }
            if (is_empty(self.alternative) && self.body instanceof AST_SimpleStatement) {
              if (negated_is_best)
                return make_node(AST_SimpleStatement, self, {body: make_node(AST_Binary, self, {
                    operator: "||",
                    left: negated,
                    right: self.body.body
                  })}).transform(compressor);
              return make_node(AST_SimpleStatement, self, {body: make_node(AST_Binary, self, {
                  operator: "&&",
                  left: self.condition,
                  right: self.body.body
                })}).transform(compressor);
            }
            if (self.body instanceof AST_EmptyStatement && self.alternative && self.alternative instanceof AST_SimpleStatement) {
              return make_node(AST_SimpleStatement, self, {body: make_node(AST_Binary, self, {
                  operator: "||",
                  left: self.condition,
                  right: self.alternative.body
                })}).transform(compressor);
            }
            if (self.body instanceof AST_Exit && self.alternative instanceof AST_Exit && self.body.TYPE == self.alternative.TYPE) {
              return make_node(self.body.CTOR, self, {value: make_node(AST_Conditional, self, {
                  condition: self.condition,
                  consequent: self.body.value || make_node(AST_Undefined, self.body).optimize(compressor),
                  alternative: self.alternative.value || make_node(AST_Undefined, self.alternative).optimize(compressor)
                })}).transform(compressor);
            }
            if (self.body instanceof AST_If && !self.body.alternative && !self.alternative) {
              self.condition = make_node(AST_Binary, self.condition, {
                operator: "&&",
                left: self.condition,
                right: self.body.condition
              }).transform(compressor);
              self.body = self.body.body;
            }
            if (aborts(self.body)) {
              if (self.alternative) {
                var alt = self.alternative;
                self.alternative = null;
                return make_node(AST_BlockStatement, self, {body: [self, alt]}).transform(compressor);
              }
            }
            if (aborts(self.alternative)) {
              var body = self.body;
              self.body = self.alternative;
              self.condition = negated_is_best ? negated : self.condition.negate(compressor);
              self.alternative = null;
              return make_node(AST_BlockStatement, self, {body: [self, body]}).transform(compressor);
            }
            return self;
          });
          OPT(AST_Switch, function(self, compressor) {
            if (self.body.length == 0 && compressor.option("conditionals")) {
              return make_node(AST_SimpleStatement, self, {body: self.expression}).transform(compressor);
            }
            for (; ; ) {
              var last_branch = self.body[self.body.length - 1];
              if (last_branch) {
                var stat = last_branch.body[last_branch.body.length - 1];
                if (stat instanceof AST_Break && loop_body(compressor.loopcontrol_target(stat.label)) === self)
                  last_branch.body.pop();
                if (last_branch instanceof AST_Default && last_branch.body.length == 0) {
                  self.body.pop();
                  continue;
                }
              }
              break;
            }
            var exp = self.expression.evaluate(compressor);
            out: if (exp.length == 2)
              try {
                self.expression = exp[0];
                if (!compressor.option("dead_code"))
                  break out;
                var value = exp[1];
                var in_if = false;
                var in_block = false;
                var started = false;
                var stopped = false;
                var ruined = false;
                var tt = new TreeTransformer(function(node, descend, in_list) {
                  if (node instanceof AST_Lambda || node instanceof AST_SimpleStatement) {
                    return node;
                  } else if (node instanceof AST_Switch && node === self) {
                    node = node.clone();
                    descend(node, this);
                    return ruined ? node : make_node(AST_BlockStatement, node, {body: node.body.reduce(function(a, branch) {
                        return a.concat(branch.body);
                      }, [])}).transform(compressor);
                  } else if (node instanceof AST_If || node instanceof AST_Try) {
                    var save = in_if;
                    in_if = !in_block;
                    descend(node, this);
                    in_if = save;
                    return node;
                  } else if (node instanceof AST_StatementWithBody || node instanceof AST_Switch) {
                    var save = in_block;
                    in_block = true;
                    descend(node, this);
                    in_block = save;
                    return node;
                  } else if (node instanceof AST_Break && this.loopcontrol_target(node.label) === self) {
                    if (in_if) {
                      ruined = true;
                      return node;
                    }
                    if (in_block)
                      return node;
                    stopped = true;
                    return in_list ? MAP.skip : make_node(AST_EmptyStatement, node);
                  } else if (node instanceof AST_SwitchBranch && this.parent() === self) {
                    if (stopped)
                      return MAP.skip;
                    if (node instanceof AST_Case) {
                      var exp = node.expression.evaluate(compressor);
                      if (exp.length < 2) {
                        throw self;
                      }
                      if (exp[1] === value || started) {
                        started = true;
                        if (aborts(node))
                          stopped = true;
                        descend(node, this);
                        return node;
                      }
                      return MAP.skip;
                    }
                    descend(node, this);
                    return node;
                  }
                });
                tt.stack = compressor.stack.slice();
                self = self.transform(tt);
              } catch (ex) {
                if (ex !== self)
                  throw ex;
              }
            return self;
          });
          OPT(AST_Case, function(self, compressor) {
            self.body = tighten_body(self.body, compressor);
            return self;
          });
          OPT(AST_Try, function(self, compressor) {
            self.body = tighten_body(self.body, compressor);
            return self;
          });
          AST_Definitions.DEFMETHOD("remove_initializers", function() {
            this.definitions.forEach(function(def) {
              def.value = null;
            });
          });
          AST_Definitions.DEFMETHOD("to_assignments", function() {
            var assignments = this.definitions.reduce(function(a, def) {
              if (def.value) {
                var name = make_node(AST_SymbolRef, def.name, def.name);
                a.push(make_node(AST_Assign, def, {
                  operator: "=",
                  left: name,
                  right: def.value
                }));
              }
              return a;
            }, []);
            if (assignments.length == 0)
              return null;
            return AST_Seq.from_array(assignments);
          });
          OPT(AST_Definitions, function(self, compressor) {
            if (self.definitions.length == 0)
              return make_node(AST_EmptyStatement, self);
            return self;
          });
          OPT(AST_Function, function(self, compressor) {
            self = AST_Lambda.prototype.optimize.call(self, compressor);
            if (compressor.option("unused")) {
              if (self.name && self.name.unreferenced()) {
                self.name = null;
              }
            }
            return self;
          });
          OPT(AST_Call, function(self, compressor) {
            if (compressor.option("unsafe")) {
              var exp = self.expression;
              if (exp instanceof AST_SymbolRef && exp.undeclared()) {
                switch (exp.name) {
                  case "Array":
                    if (self.args.length != 1) {
                      return make_node(AST_Array, self, {elements: self.args}).transform(compressor);
                    }
                    break;
                  case "Object":
                    if (self.args.length == 0) {
                      return make_node(AST_Object, self, {properties: []});
                    }
                    break;
                  case "String":
                    if (self.args.length == 0)
                      return make_node(AST_String, self, {value: ""});
                    if (self.args.length <= 1)
                      return make_node(AST_Binary, self, {
                        left: self.args[0],
                        operator: "+",
                        right: make_node(AST_String, self, {value: ""})
                      }).transform(compressor);
                    break;
                  case "Number":
                    if (self.args.length == 0)
                      return make_node(AST_Number, self, {value: 0});
                    if (self.args.length == 1)
                      return make_node(AST_UnaryPrefix, self, {
                        expression: self.args[0],
                        operator: "+"
                      }).transform(compressor);
                  case "Boolean":
                    if (self.args.length == 0)
                      return make_node(AST_False, self);
                    if (self.args.length == 1)
                      return make_node(AST_UnaryPrefix, self, {
                        expression: make_node(AST_UnaryPrefix, null, {
                          expression: self.args[0],
                          operator: "!"
                        }),
                        operator: "!"
                      }).transform(compressor);
                    break;
                  case "Function":
                    if (all(self.args, function(x) {
                      return x instanceof AST_String;
                    })) {
                      try {
                        var code = "(function(" + self.args.slice(0, -1).map(function(arg) {
                          return arg.value;
                        }).join(",") + "){" + self.args[self.args.length - 1].value + "})()";
                        var ast = parse(code);
                        ast.figure_out_scope({screw_ie8: compressor.option("screw_ie8")});
                        var comp = new Compressor(compressor.options);
                        ast = ast.transform(comp);
                        ast.figure_out_scope({screw_ie8: compressor.option("screw_ie8")});
                        ast.mangle_names();
                        var fun;
                        try {
                          ast.walk(new TreeWalker(function(node) {
                            if (node instanceof AST_Lambda) {
                              fun = node;
                              throw ast;
                            }
                          }));
                        } catch (ex) {
                          if (ex !== ast)
                            throw ex;
                        }
                        ;
                        if (!fun)
                          return self;
                        var args = fun.argnames.map(function(arg, i) {
                          return make_node(AST_String, self.args[i], {value: arg.print_to_string()});
                        });
                        var code = OutputStream();
                        AST_BlockStatement.prototype._codegen.call(fun, fun, code);
                        code = code.toString().replace(/^\{|\}$/g, "");
                        args.push(make_node(AST_String, self.args[self.args.length - 1], {value: code}));
                        self.args = args;
                        return self;
                      } catch (ex) {
                        if (ex instanceof JS_Parse_Error) {
                          compressor.warn("Error parsing code passed to new Function [{file}:{line},{col}]", self.args[self.args.length - 1].start);
                          compressor.warn(ex.toString());
                        } else {
                          console.log(ex);
                          throw ex;
                        }
                      }
                    }
                    break;
                }
              } else if (exp instanceof AST_Dot && exp.property == "toString" && self.args.length == 0) {
                return make_node(AST_Binary, self, {
                  left: make_node(AST_String, self, {value: ""}),
                  operator: "+",
                  right: exp.expression
                }).transform(compressor);
              } else if (exp instanceof AST_Dot && exp.expression instanceof AST_Array && exp.property == "join")
                EXIT: {
                  var separator = self.args.length == 0 ? "," : self.args[0].evaluate(compressor)[1];
                  if (separator == null)
                    break EXIT;
                  var elements = exp.expression.elements.reduce(function(a, el) {
                    el = el.evaluate(compressor);
                    if (a.length == 0 || el.length == 1) {
                      a.push(el);
                    } else {
                      var last = a[a.length - 1];
                      if (last.length == 2) {
                        var val = "" + last[1] + separator + el[1];
                        a[a.length - 1] = [make_node_from_constant(compressor, val, last[0]), val];
                      } else {
                        a.push(el);
                      }
                    }
                    return a;
                  }, []);
                  if (elements.length == 0)
                    return make_node(AST_String, self, {value: ""});
                  if (elements.length == 1)
                    return elements[0][0];
                  if (separator == "") {
                    var first;
                    if (elements[0][0] instanceof AST_String || elements[1][0] instanceof AST_String) {
                      first = elements.shift()[0];
                    } else {
                      first = make_node(AST_String, self, {value: ""});
                    }
                    return elements.reduce(function(prev, el) {
                      return make_node(AST_Binary, el[0], {
                        operator: "+",
                        left: prev,
                        right: el[0]
                      });
                    }, first).transform(compressor);
                  }
                  var node = self.clone();
                  node.expression = node.expression.clone();
                  node.expression.expression = node.expression.expression.clone();
                  node.expression.expression.elements = elements.map(function(el) {
                    return el[0];
                  });
                  return best_of(self, node);
                }
            }
            if (compressor.option("side_effects")) {
              if (self.expression instanceof AST_Function && self.args.length == 0 && !AST_Block.prototype.has_side_effects.call(self.expression, compressor)) {
                return make_node(AST_Undefined, self).transform(compressor);
              }
            }
            if (compressor.option("drop_console")) {
              if (self.expression instanceof AST_PropAccess && self.expression.expression instanceof AST_SymbolRef && self.expression.expression.name == "console" && self.expression.expression.undeclared()) {
                return make_node(AST_Undefined, self).transform(compressor);
              }
            }
            return self.evaluate(compressor)[0];
          });
          OPT(AST_New, function(self, compressor) {
            if (compressor.option("unsafe")) {
              var exp = self.expression;
              if (exp instanceof AST_SymbolRef && exp.undeclared()) {
                switch (exp.name) {
                  case "Object":
                  case "RegExp":
                  case "Function":
                  case "Error":
                  case "Array":
                    return make_node(AST_Call, self, self).transform(compressor);
                }
              }
            }
            return self;
          });
          OPT(AST_Seq, function(self, compressor) {
            if (!compressor.option("side_effects"))
              return self;
            if (!self.car.has_side_effects(compressor)) {
              var p;
              if (!(self.cdr instanceof AST_SymbolRef && self.cdr.name == "eval" && self.cdr.undeclared() && (p = compressor.parent()) instanceof AST_Call && p.expression === self)) {
                return self.cdr;
              }
            }
            if (compressor.option("cascade")) {
              if (self.car instanceof AST_Assign && !self.car.left.has_side_effects(compressor)) {
                if (self.car.left.equivalent_to(self.cdr)) {
                  return self.car;
                }
                if (self.cdr instanceof AST_Call && self.cdr.expression.equivalent_to(self.car.left)) {
                  self.cdr.expression = self.car;
                  return self.cdr;
                }
              }
              if (!self.car.has_side_effects(compressor) && !self.cdr.has_side_effects(compressor) && self.car.equivalent_to(self.cdr)) {
                return self.car;
              }
            }
            if (self.cdr instanceof AST_UnaryPrefix && self.cdr.operator == "void" && !self.cdr.expression.has_side_effects(compressor)) {
              self.cdr.operator = self.car;
              return self.cdr;
            }
            if (self.cdr instanceof AST_Undefined) {
              return make_node(AST_UnaryPrefix, self, {
                operator: "void",
                expression: self.car
              });
            }
            return self;
          });
          AST_Unary.DEFMETHOD("lift_sequences", function(compressor) {
            if (compressor.option("sequences")) {
              if (this.expression instanceof AST_Seq) {
                var seq = this.expression;
                var x = seq.to_array();
                this.expression = x.pop();
                x.push(this);
                seq = AST_Seq.from_array(x).transform(compressor);
                return seq;
              }
            }
            return this;
          });
          OPT(AST_UnaryPostfix, function(self, compressor) {
            return self.lift_sequences(compressor);
          });
          OPT(AST_UnaryPrefix, function(self, compressor) {
            self = self.lift_sequences(compressor);
            var e = self.expression;
            if (compressor.option("booleans") && compressor.in_boolean_context()) {
              switch (self.operator) {
                case "!":
                  if (e instanceof AST_UnaryPrefix && e.operator == "!") {
                    return e.expression;
                  }
                  break;
                case "typeof":
                  compressor.warn("Boolean expression always true [{file}:{line},{col}]", self.start);
                  return make_node(AST_True, self);
              }
              if (e instanceof AST_Binary && self.operator == "!") {
                self = best_of(self, e.negate(compressor));
              }
            }
            return self.evaluate(compressor)[0];
          });
          function has_side_effects_or_prop_access(node, compressor) {
            var save_pure_getters = compressor.option("pure_getters");
            compressor.options.pure_getters = false;
            var ret = node.has_side_effects(compressor);
            compressor.options.pure_getters = save_pure_getters;
            return ret;
          }
          AST_Binary.DEFMETHOD("lift_sequences", function(compressor) {
            if (compressor.option("sequences")) {
              if (this.left instanceof AST_Seq) {
                var seq = this.left;
                var x = seq.to_array();
                this.left = x.pop();
                x.push(this);
                seq = AST_Seq.from_array(x).transform(compressor);
                return seq;
              }
              if (this.right instanceof AST_Seq && this instanceof AST_Assign && !has_side_effects_or_prop_access(this.left, compressor)) {
                var seq = this.right;
                var x = seq.to_array();
                this.right = x.pop();
                x.push(this);
                seq = AST_Seq.from_array(x).transform(compressor);
                return seq;
              }
            }
            return this;
          });
          var commutativeOperators = makePredicate("== === != !== * & | ^");
          OPT(AST_Binary, function(self, compressor) {
            var reverse = compressor.has_directive("use asm") ? noop : function(op, force) {
              if (force || !(self.left.has_side_effects(compressor) || self.right.has_side_effects(compressor))) {
                if (op)
                  self.operator = op;
                var tmp = self.left;
                self.left = self.right;
                self.right = tmp;
              }
            };
            if (commutativeOperators(self.operator)) {
              if (self.right instanceof AST_Constant && !(self.left instanceof AST_Constant)) {
                if (!(self.left instanceof AST_Binary && PRECEDENCE[self.left.operator] >= PRECEDENCE[self.operator])) {
                  reverse(null, true);
                }
              }
              if (/^[!=]==?$/.test(self.operator)) {
                if (self.left instanceof AST_SymbolRef && self.right instanceof AST_Conditional) {
                  if (self.right.consequent instanceof AST_SymbolRef && self.right.consequent.definition() === self.left.definition()) {
                    if (/^==/.test(self.operator))
                      return self.right.condition;
                    if (/^!=/.test(self.operator))
                      return self.right.condition.negate(compressor);
                  }
                  if (self.right.alternative instanceof AST_SymbolRef && self.right.alternative.definition() === self.left.definition()) {
                    if (/^==/.test(self.operator))
                      return self.right.condition.negate(compressor);
                    if (/^!=/.test(self.operator))
                      return self.right.condition;
                  }
                }
                if (self.right instanceof AST_SymbolRef && self.left instanceof AST_Conditional) {
                  if (self.left.consequent instanceof AST_SymbolRef && self.left.consequent.definition() === self.right.definition()) {
                    if (/^==/.test(self.operator))
                      return self.left.condition;
                    if (/^!=/.test(self.operator))
                      return self.left.condition.negate(compressor);
                  }
                  if (self.left.alternative instanceof AST_SymbolRef && self.left.alternative.definition() === self.right.definition()) {
                    if (/^==/.test(self.operator))
                      return self.left.condition.negate(compressor);
                    if (/^!=/.test(self.operator))
                      return self.left.condition;
                  }
                }
              }
            }
            self = self.lift_sequences(compressor);
            if (compressor.option("comparisons"))
              switch (self.operator) {
                case "===":
                case "!==":
                  if ((self.left.is_string(compressor) && self.right.is_string(compressor)) || (self.left.is_boolean() && self.right.is_boolean())) {
                    self.operator = self.operator.substr(0, 2);
                  }
                case "==":
                case "!=":
                  if (self.left instanceof AST_String && self.left.value == "undefined" && self.right instanceof AST_UnaryPrefix && self.right.operator == "typeof" && compressor.option("unsafe")) {
                    if (!(self.right.expression instanceof AST_SymbolRef) || !self.right.expression.undeclared()) {
                      self.right = self.right.expression;
                      self.left = make_node(AST_Undefined, self.left).optimize(compressor);
                      if (self.operator.length == 2)
                        self.operator += "=";
                    }
                  }
                  break;
              }
            if (compressor.option("booleans") && compressor.in_boolean_context())
              switch (self.operator) {
                case "&&":
                  var ll = self.left.evaluate(compressor);
                  var rr = self.right.evaluate(compressor);
                  if ((ll.length > 1 && !ll[1]) || (rr.length > 1 && !rr[1])) {
                    compressor.warn("Boolean && always false [{file}:{line},{col}]", self.start);
                    return make_node(AST_False, self);
                  }
                  if (ll.length > 1 && ll[1]) {
                    return rr[0];
                  }
                  if (rr.length > 1 && rr[1]) {
                    return ll[0];
                  }
                  break;
                case "||":
                  var ll = self.left.evaluate(compressor);
                  var rr = self.right.evaluate(compressor);
                  if ((ll.length > 1 && ll[1]) || (rr.length > 1 && rr[1])) {
                    compressor.warn("Boolean || always true [{file}:{line},{col}]", self.start);
                    return make_node(AST_True, self);
                  }
                  if (ll.length > 1 && !ll[1]) {
                    return rr[0];
                  }
                  if (rr.length > 1 && !rr[1]) {
                    return ll[0];
                  }
                  break;
                case "+":
                  var ll = self.left.evaluate(compressor);
                  var rr = self.right.evaluate(compressor);
                  if ((ll.length > 1 && ll[0] instanceof AST_String && ll[1]) || (rr.length > 1 && rr[0] instanceof AST_String && rr[1])) {
                    compressor.warn("+ in boolean context always true [{file}:{line},{col}]", self.start);
                    return make_node(AST_True, self);
                  }
                  break;
              }
            if (compressor.option("comparisons")) {
              if (!(compressor.parent() instanceof AST_Binary) || compressor.parent() instanceof AST_Assign) {
                var negated = make_node(AST_UnaryPrefix, self, {
                  operator: "!",
                  expression: self.negate(compressor)
                });
                self = best_of(self, negated);
              }
              switch (self.operator) {
                case "<":
                  reverse(">");
                  break;
                case "<=":
                  reverse(">=");
                  break;
              }
            }
            if (self.operator == "+" && self.right instanceof AST_String && self.right.getValue() === "" && self.left instanceof AST_Binary && self.left.operator == "+" && self.left.is_string(compressor)) {
              return self.left;
            }
            if (compressor.option("evaluate")) {
              if (self.operator == "+") {
                if (self.left instanceof AST_Constant && self.right instanceof AST_Binary && self.right.operator == "+" && self.right.left instanceof AST_Constant && self.right.is_string(compressor)) {
                  self = make_node(AST_Binary, self, {
                    operator: "+",
                    left: make_node(AST_String, null, {
                      value: "" + self.left.getValue() + self.right.left.getValue(),
                      start: self.left.start,
                      end: self.right.left.end
                    }),
                    right: self.right.right
                  });
                }
                if (self.right instanceof AST_Constant && self.left instanceof AST_Binary && self.left.operator == "+" && self.left.right instanceof AST_Constant && self.left.is_string(compressor)) {
                  self = make_node(AST_Binary, self, {
                    operator: "+",
                    left: self.left.left,
                    right: make_node(AST_String, null, {
                      value: "" + self.left.right.getValue() + self.right.getValue(),
                      start: self.left.right.start,
                      end: self.right.end
                    })
                  });
                }
                if (self.left instanceof AST_Binary && self.left.operator == "+" && self.left.is_string(compressor) && self.left.right instanceof AST_Constant && self.right instanceof AST_Binary && self.right.operator == "+" && self.right.left instanceof AST_Constant && self.right.is_string(compressor)) {
                  self = make_node(AST_Binary, self, {
                    operator: "+",
                    left: make_node(AST_Binary, self.left, {
                      operator: "+",
                      left: self.left.left,
                      right: make_node(AST_String, null, {
                        value: "" + self.left.right.getValue() + self.right.left.getValue(),
                        start: self.left.right.start,
                        end: self.right.left.end
                      })
                    }),
                    right: self.right.right
                  });
                }
              }
            }
            if (self.right instanceof AST_Binary && self.right.operator == self.operator && (self.operator == "*" || self.operator == "&&" || self.operator == "||")) {
              self.left = make_node(AST_Binary, self.left, {
                operator: self.operator,
                left: self.left,
                right: self.right.left
              });
              self.right = self.right.right;
              return self.transform(compressor);
            }
            return self.evaluate(compressor)[0];
          });
          OPT(AST_SymbolRef, function(self, compressor) {
            if (self.undeclared()) {
              var defines = compressor.option("global_defs");
              if (defines && defines.hasOwnProperty(self.name)) {
                return make_node_from_constant(compressor, defines[self.name], self);
              }
              switch (self.name) {
                case "undefined":
                  return make_node(AST_Undefined, self);
                case "NaN":
                  return make_node(AST_NaN, self);
                case "Infinity":
                  return make_node(AST_Infinity, self);
              }
            }
            return self;
          });
          OPT(AST_Undefined, function(self, compressor) {
            if (compressor.option("unsafe")) {
              var scope = compressor.find_parent(AST_Scope);
              var undef = scope.find_variable("undefined");
              if (undef) {
                var ref = make_node(AST_SymbolRef, self, {
                  name: "undefined",
                  scope: scope,
                  thedef: undef
                });
                ref.reference();
                return ref;
              }
            }
            return self;
          });
          var ASSIGN_OPS = ['+', '-', '/', '*', '%', '>>', '<<', '>>>', '|', '^', '&'];
          OPT(AST_Assign, function(self, compressor) {
            self = self.lift_sequences(compressor);
            if (self.operator == "=" && self.left instanceof AST_SymbolRef && self.right instanceof AST_Binary && self.right.left instanceof AST_SymbolRef && self.right.left.name == self.left.name && member(self.right.operator, ASSIGN_OPS)) {
              self.operator = self.right.operator + "=";
              self.right = self.right.right;
            }
            return self;
          });
          OPT(AST_Conditional, function(self, compressor) {
            if (!compressor.option("conditionals"))
              return self;
            if (self.condition instanceof AST_Seq) {
              var car = self.condition.car;
              self.condition = self.condition.cdr;
              return AST_Seq.cons(car, self);
            }
            var cond = self.condition.evaluate(compressor);
            if (cond.length > 1) {
              if (cond[1]) {
                compressor.warn("Condition always true [{file}:{line},{col}]", self.start);
                return self.consequent;
              } else {
                compressor.warn("Condition always false [{file}:{line},{col}]", self.start);
                return self.alternative;
              }
            }
            var negated = cond[0].negate(compressor);
            if (best_of(cond[0], negated) === negated) {
              self = make_node(AST_Conditional, self, {
                condition: negated,
                consequent: self.alternative,
                alternative: self.consequent
              });
            }
            var consequent = self.consequent;
            var alternative = self.alternative;
            if (consequent instanceof AST_Assign && alternative instanceof AST_Assign && consequent.operator == alternative.operator && consequent.left.equivalent_to(alternative.left)) {
              return make_node(AST_Assign, self, {
                operator: consequent.operator,
                left: consequent.left,
                right: make_node(AST_Conditional, self, {
                  condition: self.condition,
                  consequent: consequent.right,
                  alternative: alternative.right
                })
              });
            }
            if (consequent instanceof AST_Call && alternative.TYPE === consequent.TYPE && consequent.args.length == alternative.args.length && consequent.expression.equivalent_to(alternative.expression)) {
              if (consequent.args.length == 0) {
                return make_node(AST_Seq, self, {
                  car: self.condition,
                  cdr: consequent
                });
              }
              if (consequent.args.length == 1) {
                consequent.args[0] = make_node(AST_Conditional, self, {
                  condition: self.condition,
                  consequent: consequent.args[0],
                  alternative: alternative.args[0]
                });
                return consequent;
              }
            }
            if (consequent instanceof AST_Conditional && consequent.alternative.equivalent_to(alternative)) {
              return make_node(AST_Conditional, self, {
                condition: make_node(AST_Binary, self, {
                  left: self.condition,
                  operator: "&&",
                  right: consequent.condition
                }),
                consequent: consequent.consequent,
                alternative: alternative
              });
            }
            if (consequent instanceof AST_Constant && alternative instanceof AST_Constant && consequent.equivalent_to(alternative)) {
              if (self.condition.has_side_effects(compressor)) {
                return AST_Seq.from_array([self.condition, make_node_from_constant(compressor, consequent.value, self)]);
              } else {
                return make_node_from_constant(compressor, consequent.value, self);
              }
            }
            return self;
          });
          OPT(AST_Boolean, function(self, compressor) {
            if (compressor.option("booleans")) {
              var p = compressor.parent();
              if (p instanceof AST_Binary && (p.operator == "==" || p.operator == "!=")) {
                compressor.warn("Non-strict equality against boolean: {operator} {value} [{file}:{line},{col}]", {
                  operator: p.operator,
                  value: self.value,
                  file: p.start.file,
                  line: p.start.line,
                  col: p.start.col
                });
                return make_node(AST_Number, self, {value: +self.value});
              }
              return make_node(AST_UnaryPrefix, self, {
                operator: "!",
                expression: make_node(AST_Number, self, {value: 1 - self.value})
              });
            }
            return self;
          });
          OPT(AST_Sub, function(self, compressor) {
            var prop = self.property;
            if (prop instanceof AST_String && compressor.option("properties")) {
              prop = prop.getValue();
              if (RESERVED_WORDS(prop) ? compressor.option("screw_ie8") : is_identifier_string(prop)) {
                return make_node(AST_Dot, self, {
                  expression: self.expression,
                  property: prop
                }).optimize(compressor);
              }
              var v = parseFloat(prop);
              if (!isNaN(v) && v.toString() == prop) {
                self.property = make_node(AST_Number, self.property, {value: v});
              }
            }
            return self;
          });
          OPT(AST_Dot, function(self, compressor) {
            var prop = self.property;
            if (RESERVED_WORDS(prop) && !compressor.option("screw_ie8")) {
              return make_node(AST_Sub, self, {
                expression: self.expression,
                property: make_node(AST_String, self, {value: prop})
              }).optimize(compressor);
            }
            return self.evaluate(compressor)[0];
          });
          function literals_in_boolean_context(self, compressor) {
            if (compressor.option("booleans") && compressor.in_boolean_context()) {
              return make_node(AST_True, self);
            }
            return self;
          }
          ;
          OPT(AST_Array, literals_in_boolean_context);
          OPT(AST_Object, literals_in_boolean_context);
          OPT(AST_RegExp, literals_in_boolean_context);
        })();
        "use strict";
        function SourceMap(options) {
          options = defaults(options, {
            file: null,
            root: null,
            orig: null,
            orig_line_diff: 0,
            dest_line_diff: 0
          });
          var generator = new MOZ_SourceMap.SourceMapGenerator({
            file: options.file,
            sourceRoot: options.root
          });
          var orig_map = options.orig && new MOZ_SourceMap.SourceMapConsumer(options.orig);
          function add(source, gen_line, gen_col, orig_line, orig_col, name) {
            if (orig_map) {
              var info = orig_map.originalPositionFor({
                line: orig_line,
                column: orig_col
              });
              if (info.source === null) {
                return ;
              }
              source = info.source;
              orig_line = info.line;
              orig_col = info.column;
              name = info.name || name;
            }
            generator.addMapping({
              generated: {
                line: gen_line + options.dest_line_diff,
                column: gen_col
              },
              original: {
                line: orig_line + options.orig_line_diff,
                column: orig_col
              },
              source: source,
              name: name
            });
          }
          ;
          return {
            add: add,
            get: function() {
              return generator;
            },
            toString: function() {
              return generator.toString();
            }
          };
        }
        ;
        "use strict";
        (function() {
          var MOZ_TO_ME = {
            ExpressionStatement: function(M) {
              var expr = M.expression;
              if (expr.type === "Literal" && typeof expr.value === "string") {
                return new AST_Directive({
                  start: my_start_token(M),
                  end: my_end_token(M),
                  value: expr.value
                });
              }
              return new AST_SimpleStatement({
                start: my_start_token(M),
                end: my_end_token(M),
                body: from_moz(expr)
              });
            },
            TryStatement: function(M) {
              var handlers = M.handlers || [M.handler];
              if (handlers.length > 1 || M.guardedHandlers && M.guardedHandlers.length) {
                throw new Error("Multiple catch clauses are not supported.");
              }
              return new AST_Try({
                start: my_start_token(M),
                end: my_end_token(M),
                body: from_moz(M.block).body,
                bcatch: from_moz(handlers[0]),
                bfinally: M.finalizer ? new AST_Finally(from_moz(M.finalizer)) : null
              });
            },
            Property: function(M) {
              var key = M.key;
              var name = key.type == "Identifier" ? key.name : key.value;
              var args = {
                start: my_start_token(key),
                end: my_end_token(M.value),
                key: name,
                value: from_moz(M.value)
              };
              switch (M.kind) {
                case "init":
                  return new AST_ObjectKeyVal(args);
                case "set":
                  args.value.name = from_moz(key);
                  return new AST_ObjectSetter(args);
                case "get":
                  args.value.name = from_moz(key);
                  return new AST_ObjectGetter(args);
              }
            },
            ObjectExpression: function(M) {
              return new AST_Object({
                start: my_start_token(M),
                end: my_end_token(M),
                properties: M.properties.map(function(prop) {
                  prop.type = "Property";
                  return from_moz(prop);
                })
              });
            },
            SequenceExpression: function(M) {
              return AST_Seq.from_array(M.expressions.map(from_moz));
            },
            MemberExpression: function(M) {
              return new (M.computed ? AST_Sub : AST_Dot)({
                start: my_start_token(M),
                end: my_end_token(M),
                property: M.computed ? from_moz(M.property) : M.property.name,
                expression: from_moz(M.object)
              });
            },
            SwitchCase: function(M) {
              return new (M.test ? AST_Case : AST_Default)({
                start: my_start_token(M),
                end: my_end_token(M),
                expression: from_moz(M.test),
                body: M.consequent.map(from_moz)
              });
            },
            VariableDeclaration: function(M) {
              return new (M.kind === "const" ? AST_Const : AST_Var)({
                start: my_start_token(M),
                end: my_end_token(M),
                definitions: M.declarations.map(from_moz)
              });
            },
            Literal: function(M) {
              var val = M.value,
                  args = {
                    start: my_start_token(M),
                    end: my_end_token(M)
                  };
              if (val === null)
                return new AST_Null(args);
              switch (typeof val) {
                case "string":
                  args.value = val;
                  return new AST_String(args);
                case "number":
                  args.value = val;
                  return new AST_Number(args);
                case "boolean":
                  return new (val ? AST_True : AST_False)(args);
                default:
                  args.value = val;
                  return new AST_RegExp(args);
              }
            },
            Identifier: function(M) {
              var p = FROM_MOZ_STACK[FROM_MOZ_STACK.length - 2];
              return new (p.type == "LabeledStatement" ? AST_Label : p.type == "VariableDeclarator" && p.id === M ? (p.kind == "const" ? AST_SymbolConst : AST_SymbolVar) : p.type == "FunctionExpression" ? (p.id === M ? AST_SymbolLambda : AST_SymbolFunarg) : p.type == "FunctionDeclaration" ? (p.id === M ? AST_SymbolDefun : AST_SymbolFunarg) : p.type == "CatchClause" ? AST_SymbolCatch : p.type == "BreakStatement" || p.type == "ContinueStatement" ? AST_LabelRef : AST_SymbolRef)({
                start: my_start_token(M),
                end: my_end_token(M),
                name: M.name
              });
            }
          };
          MOZ_TO_ME.UpdateExpression = MOZ_TO_ME.UnaryExpression = function To_Moz_Unary(M) {
            var prefix = "prefix" in M ? M.prefix : M.type == "UnaryExpression" ? true : false;
            return new (prefix ? AST_UnaryPrefix : AST_UnaryPostfix)({
              start: my_start_token(M),
              end: my_end_token(M),
              operator: M.operator,
              expression: from_moz(M.argument)
            });
          };
          map("Program", AST_Toplevel, "body@body");
          map("EmptyStatement", AST_EmptyStatement);
          map("BlockStatement", AST_BlockStatement, "body@body");
          map("IfStatement", AST_If, "test>condition, consequent>body, alternate>alternative");
          map("LabeledStatement", AST_LabeledStatement, "label>label, body>body");
          map("BreakStatement", AST_Break, "label>label");
          map("ContinueStatement", AST_Continue, "label>label");
          map("WithStatement", AST_With, "object>expression, body>body");
          map("SwitchStatement", AST_Switch, "discriminant>expression, cases@body");
          map("ReturnStatement", AST_Return, "argument>value");
          map("ThrowStatement", AST_Throw, "argument>value");
          map("WhileStatement", AST_While, "test>condition, body>body");
          map("DoWhileStatement", AST_Do, "test>condition, body>body");
          map("ForStatement", AST_For, "init>init, test>condition, update>step, body>body");
          map("ForInStatement", AST_ForIn, "left>init, right>object, body>body");
          map("DebuggerStatement", AST_Debugger);
          map("FunctionDeclaration", AST_Defun, "id>name, params@argnames, body%body");
          map("VariableDeclarator", AST_VarDef, "id>name, init>value");
          map("CatchClause", AST_Catch, "param>argname, body%body");
          map("ThisExpression", AST_This);
          map("ArrayExpression", AST_Array, "elements@elements");
          map("FunctionExpression", AST_Function, "id>name, params@argnames, body%body");
          map("BinaryExpression", AST_Binary, "operator=operator, left>left, right>right");
          map("LogicalExpression", AST_Binary, "operator=operator, left>left, right>right");
          map("AssignmentExpression", AST_Assign, "operator=operator, left>left, right>right");
          map("ConditionalExpression", AST_Conditional, "test>condition, consequent>consequent, alternate>alternative");
          map("NewExpression", AST_New, "callee>expression, arguments@args");
          map("CallExpression", AST_Call, "callee>expression, arguments@args");
          def_to_moz(AST_Directive, function To_Moz_Directive(M) {
            return {
              type: "ExpressionStatement",
              expression: {
                type: "Literal",
                value: M.value
              }
            };
          });
          def_to_moz(AST_SimpleStatement, function To_Moz_ExpressionStatement(M) {
            return {
              type: "ExpressionStatement",
              expression: to_moz(M.body)
            };
          });
          def_to_moz(AST_SwitchBranch, function To_Moz_SwitchCase(M) {
            return {
              type: "SwitchCase",
              test: to_moz(M.expression),
              consequent: M.body.map(to_moz)
            };
          });
          def_to_moz(AST_Try, function To_Moz_TryStatement(M) {
            return {
              type: "TryStatement",
              block: to_moz_block(M),
              handler: to_moz(M.bcatch),
              guardedHandlers: [],
              finalizer: to_moz(M.bfinally)
            };
          });
          def_to_moz(AST_Catch, function To_Moz_CatchClause(M) {
            return {
              type: "CatchClause",
              param: to_moz(M.argname),
              guard: null,
              body: to_moz_block(M)
            };
          });
          def_to_moz(AST_Definitions, function To_Moz_VariableDeclaration(M) {
            return {
              type: "VariableDeclaration",
              kind: M instanceof AST_Const ? "const" : "var",
              declarations: M.definitions.map(to_moz)
            };
          });
          def_to_moz(AST_Seq, function To_Moz_SequenceExpression(M) {
            return {
              type: "SequenceExpression",
              expressions: M.to_array().map(to_moz)
            };
          });
          def_to_moz(AST_PropAccess, function To_Moz_MemberExpression(M) {
            var isComputed = M instanceof AST_Sub;
            return {
              type: "MemberExpression",
              object: to_moz(M.expression),
              computed: isComputed,
              property: isComputed ? to_moz(M.property) : {
                type: "Identifier",
                name: M.property
              }
            };
          });
          def_to_moz(AST_Unary, function To_Moz_Unary(M) {
            return {
              type: M.operator == "++" || M.operator == "--" ? "UpdateExpression" : "UnaryExpression",
              operator: M.operator,
              prefix: M instanceof AST_UnaryPrefix,
              argument: to_moz(M.expression)
            };
          });
          def_to_moz(AST_Binary, function To_Moz_BinaryExpression(M) {
            return {
              type: M.operator == "&&" || M.operator == "||" ? "LogicalExpression" : "BinaryExpression",
              left: to_moz(M.left),
              operator: M.operator,
              right: to_moz(M.right)
            };
          });
          def_to_moz(AST_Object, function To_Moz_ObjectExpression(M) {
            return {
              type: "ObjectExpression",
              properties: M.properties.map(to_moz)
            };
          });
          def_to_moz(AST_ObjectProperty, function To_Moz_Property(M) {
            var key = (is_identifier(M.key) ? {
              type: "Identifier",
              name: M.key
            } : {
              type: "Literal",
              value: M.key
            });
            var kind;
            if (M instanceof AST_ObjectKeyVal) {
              kind = "init";
            } else if (M instanceof AST_ObjectGetter) {
              kind = "get";
            } else if (M instanceof AST_ObjectSetter) {
              kind = "set";
            }
            return {
              type: "Property",
              kind: kind,
              key: key,
              value: to_moz(M.value)
            };
          });
          def_to_moz(AST_Symbol, function To_Moz_Identifier(M) {
            var def = M.definition();
            return {
              type: "Identifier",
              name: def ? def.mangled_name || def.name : M.name
            };
          });
          def_to_moz(AST_Constant, function To_Moz_Literal(M) {
            var value = M.value;
            if (typeof value === 'number' && (value < 0 || (value === 0 && 1 / value < 0))) {
              return {
                type: "UnaryExpression",
                operator: "-",
                prefix: true,
                argument: {
                  type: "Literal",
                  value: -value
                }
              };
            }
            return {
              type: "Literal",
              value: value
            };
          });
          def_to_moz(AST_Atom, function To_Moz_Atom(M) {
            return {
              type: "Identifier",
              name: String(M.value)
            };
          });
          AST_Boolean.DEFMETHOD("to_mozilla_ast", AST_Constant.prototype.to_mozilla_ast);
          AST_Null.DEFMETHOD("to_mozilla_ast", AST_Constant.prototype.to_mozilla_ast);
          AST_Hole.DEFMETHOD("to_mozilla_ast", function To_Moz_ArrayHole() {
            return null;
          });
          AST_Block.DEFMETHOD("to_mozilla_ast", AST_BlockStatement.prototype.to_mozilla_ast);
          AST_Lambda.DEFMETHOD("to_mozilla_ast", AST_Function.prototype.to_mozilla_ast);
          function my_start_token(moznode) {
            var loc = moznode.loc;
            var range = moznode.range;
            return new AST_Token({
              file: loc && loc.source,
              line: loc && loc.start.line,
              col: loc && loc.start.column,
              pos: range ? range[0] : moznode.start,
              endpos: range ? range[0] : moznode.start
            });
          }
          ;
          function my_end_token(moznode) {
            var loc = moznode.loc;
            var range = moznode.range;
            return new AST_Token({
              file: loc && loc.source,
              line: loc && loc.end.line,
              col: loc && loc.end.column,
              pos: range ? range[1] : moznode.end,
              endpos: range ? range[1] : moznode.end
            });
          }
          ;
          function map(moztype, mytype, propmap) {
            var moz_to_me = "function From_Moz_" + moztype + "(M){\n";
            moz_to_me += "return new " + mytype.name + "({\n" + "start: my_start_token(M),\n" + "end: my_end_token(M)";
            var me_to_moz = "function To_Moz_" + moztype + "(M){\n";
            me_to_moz += "return {\n" + "type: " + JSON.stringify(moztype);
            if (propmap)
              propmap.split(/\s*,\s*/).forEach(function(prop) {
                var m = /([a-z0-9$_]+)(=|@|>|%)([a-z0-9$_]+)/i.exec(prop);
                if (!m)
                  throw new Error("Can't understand property map: " + prop);
                var moz = m[1],
                    how = m[2],
                    my = m[3];
                moz_to_me += ",\n" + my + ": ";
                me_to_moz += ",\n" + moz + ": ";
                switch (how) {
                  case "@":
                    moz_to_me += "M." + moz + ".map(from_moz)";
                    me_to_moz += "M." + my + ".map(to_moz)";
                    break;
                  case ">":
                    moz_to_me += "from_moz(M." + moz + ")";
                    me_to_moz += "to_moz(M." + my + ")";
                    break;
                  case "=":
                    moz_to_me += "M." + moz;
                    me_to_moz += "M." + my;
                    break;
                  case "%":
                    moz_to_me += "from_moz(M." + moz + ").body";
                    me_to_moz += "to_moz_block(M)";
                    break;
                  default:
                    throw new Error("Can't understand operator in propmap: " + prop);
                }
              });
            moz_to_me += "\n})\n}";
            me_to_moz += "\n}\n}";
            moz_to_me = new Function("my_start_token", "my_end_token", "from_moz", "return(" + moz_to_me + ")")(my_start_token, my_end_token, from_moz);
            me_to_moz = new Function("to_moz", "to_moz_block", "return(" + me_to_moz + ")")(to_moz, to_moz_block);
            MOZ_TO_ME[moztype] = moz_to_me;
            def_to_moz(mytype, me_to_moz);
          }
          ;
          var FROM_MOZ_STACK = null;
          function from_moz(node) {
            FROM_MOZ_STACK.push(node);
            var ret = node != null ? MOZ_TO_ME[node.type](node) : null;
            FROM_MOZ_STACK.pop();
            return ret;
          }
          ;
          AST_Node.from_mozilla_ast = function(node) {
            var save_stack = FROM_MOZ_STACK;
            FROM_MOZ_STACK = [];
            var ast = from_moz(node);
            FROM_MOZ_STACK = save_stack;
            return ast;
          };
          function moz_sub_loc(token) {
            return token.line ? {
              line: token.line,
              column: token.col
            } : null;
          }
          ;
          function set_moz_loc(mynode, moznode) {
            var start = mynode.start;
            var end = mynode.end;
            if (start.pos != null && end.pos != null) {
              moznode.range = [start.pos, end.pos];
            }
            if (start.line) {
              moznode.loc = {
                start: moz_sub_loc(start),
                end: moz_sub_loc(end)
              };
              if (start.file) {
                moznode.loc.source = start.file;
              }
            }
            return moznode;
          }
          ;
          function def_to_moz(mytype, handler) {
            mytype.DEFMETHOD("to_mozilla_ast", function() {
              return set_moz_loc(this, handler(this));
            });
          }
          ;
          function to_moz(node) {
            return node != null ? node.to_mozilla_ast() : null;
          }
          ;
          function to_moz_block(node) {
            return {
              type: "BlockStatement",
              body: node.body.map(to_moz)
            };
          }
          ;
        })();
        AST_Node.warn_function = function(txt) {
          logger.error("uglifyjs2 WARN: " + txt);
        };
        exports.minify = function(files, options, name) {
          options = defaults(options, {
            spidermonkey: false,
            outSourceMap: null,
            sourceRoot: null,
            inSourceMap: null,
            fromString: false,
            warnings: false,
            mangle: {},
            output: null,
            compress: {}
          });
          base54.reset();
          var toplevel = null,
              sourcesContent = {};
          if (options.spidermonkey) {
            toplevel = AST_Node.from_mozilla_ast(files);
          } else {
            if (typeof files == "string")
              files = [files];
            files.forEach(function(file) {
              var code = options.fromString ? file : rjsFile.readFile(file, "utf8");
              sourcesContent[file] = code;
              toplevel = parse(code, {
                filename: options.fromString ? name : file,
                toplevel: toplevel
              });
            });
          }
          if (options.compress) {
            var compress = {warnings: options.warnings};
            merge(compress, options.compress);
            toplevel.figure_out_scope();
            var sq = Compressor(compress);
            toplevel = toplevel.transform(sq);
          }
          if (options.mangle) {
            toplevel.figure_out_scope();
            toplevel.compute_char_frequency();
            toplevel.mangle_names(options.mangle);
          }
          var inMap = options.inSourceMap;
          var output = {};
          if (typeof options.inSourceMap == "string") {
            inMap = rjsFile.readFile(options.inSourceMap, "utf8");
          }
          if (options.outSourceMap) {
            output.source_map = SourceMap({
              file: options.outSourceMap,
              orig: inMap,
              root: options.sourceRoot
            });
            if (options.sourceMapIncludeSources) {
              for (var file in sourcesContent) {
                if (sourcesContent.hasOwnProperty(file)) {
                  output.source_map.get().setSourceContent(file, sourcesContent[file]);
                }
              }
            }
          }
          if (options.output) {
            merge(output, options.output);
          }
          var stream = OutputStream(output);
          toplevel.print(stream);
          if (options.outSourceMap) {
            stream += "\n//# sourceMappingURL=" + options.outSourceMap;
          }
          return {
            code: stream + "",
            map: output.source_map + ""
          };
        };
        exports.describe_ast = function() {
          var out = OutputStream({beautify: true});
          function doitem(ctor) {
            out.print("AST_" + ctor.TYPE);
            var props = ctor.SELF_PROPS.filter(function(prop) {
              return !/^\$/.test(prop);
            });
            if (props.length > 0) {
              out.space();
              out.with_parens(function() {
                props.forEach(function(prop, i) {
                  if (i)
                    out.space();
                  out.print(prop);
                });
              });
            }
            if (ctor.documentation) {
              out.space();
              out.print_string(ctor.documentation);
            }
            if (ctor.SUBCLASSES.length > 0) {
              out.space();
              out.with_block(function() {
                ctor.SUBCLASSES.forEach(function(ctor, i) {
                  out.indent();
                  doitem(ctor);
                  out.newline();
                });
              });
            }
          }
          ;
          doitem(AST_Node);
          return out + "";
        };
      });
      define('parse', ['./esprimaAdapter', 'lang'], function(esprima, lang) {
        'use strict';
        function arrayToString(ary) {
          var output = '[';
          if (ary) {
            ary.forEach(function(item, i) {
              output += (i > 0 ? ',' : '') + '"' + lang.jsEscape(item) + '"';
            });
          }
          output += ']';
          return output;
        }
        var argPropName = 'arguments',
            emptyScope = {},
            mixin = lang.mixin,
            hasProp = lang.hasProp;
        function traverse(object, visitor) {
          var key,
              child;
          if (!object) {
            return ;
          }
          if (visitor.call(null, object) === false) {
            return false;
          }
          for (key in object) {
            if (object.hasOwnProperty(key)) {
              child = object[key];
              if (typeof child === 'object' && child !== null) {
                if (traverse(child, visitor) === false) {
                  return false;
                }
              }
            }
          }
        }
        function traverseBroad(object, visitor) {
          var key,
              child;
          if (!object) {
            return ;
          }
          if (visitor.call(null, object) === false) {
            return false;
          }
          for (key in object) {
            if (object.hasOwnProperty(key)) {
              child = object[key];
              if (typeof child === 'object' && child !== null) {
                traverseBroad(child, visitor);
              }
            }
          }
        }
        function getValidDeps(node) {
          if (!node || node.type !== 'ArrayExpression' || !node.elements) {
            return ;
          }
          var deps = [];
          node.elements.some(function(elem) {
            if (elem.type === 'Literal') {
              deps.push(elem.value);
            }
          });
          return deps.length ? deps : undefined;
        }
        function isFnExpression(node) {
          return (node && (node.type === 'FunctionExpression' || node.type === 'ArrowFunctionExpression'));
        }
        function parse(moduleName, fileName, fileContents, options) {
          options = options || {};
          var i,
              moduleCall,
              depString,
              moduleDeps = [],
              result = '',
              moduleList = [],
              needsDefine = true,
              astRoot = esprima.parse(fileContents);
          parse.recurse(astRoot, function(callName, config, name, deps, node, factoryIdentifier, fnExpScope) {
            if (!deps) {
              deps = [];
            }
            if (callName === 'define' && (!name || name === moduleName)) {
              needsDefine = false;
            }
            if (!name) {
              moduleDeps = moduleDeps.concat(deps);
            } else {
              moduleList.push({
                name: name,
                deps: deps
              });
            }
            if (callName === 'define' && factoryIdentifier && hasProp(fnExpScope, factoryIdentifier)) {
              return factoryIdentifier;
            }
            return !!options.findNestedDependencies;
          }, options);
          if (options.insertNeedsDefine && needsDefine) {
            result += 'require.needsDefine("' + moduleName + '");';
          }
          if (moduleDeps.length || moduleList.length) {
            for (i = 0; i < moduleList.length; i++) {
              moduleCall = moduleList[i];
              if (result) {
                result += '\n';
              }
              if (moduleCall.name === moduleName) {
                moduleCall.deps = moduleCall.deps.concat(moduleDeps);
                moduleDeps = [];
              }
              depString = arrayToString(moduleCall.deps);
              result += 'define("' + moduleCall.name + '",' + depString + ');';
            }
            if (moduleDeps.length) {
              if (result) {
                result += '\n';
              }
              depString = arrayToString(moduleDeps);
              result += 'define("' + moduleName + '",' + depString + ');';
            }
          }
          return result || null;
        }
        parse.traverse = traverse;
        parse.traverseBroad = traverseBroad;
        parse.isFnExpression = isFnExpression;
        parse.recurse = function(object, onMatch, options, fnExpScope) {
          var key,
              child,
              result,
              i,
              params,
              param,
              tempObject,
              hasHas = options && options.has;
          fnExpScope = fnExpScope || emptyScope;
          if (!object) {
            return ;
          }
          if (hasHas && object.type === 'IfStatement' && object.test.type && object.test.type === 'Literal') {
            if (object.test.value) {
              this.recurse(object.consequent, onMatch, options, fnExpScope);
            } else {
              this.recurse(object.alternate, onMatch, options, fnExpScope);
            }
          } else {
            result = this.parseNode(object, onMatch, fnExpScope);
            if (result === false) {
              return ;
            } else if (typeof result === 'string') {
              return result;
            }
            if (object.type === 'ExpressionStatement' && object.expression && object.expression.type === 'CallExpression' && object.expression.callee && isFnExpression(object.expression.callee)) {
              tempObject = object.expression.callee;
            }
            if (object.type === 'UnaryExpression' && object.argument && object.argument.type === 'CallExpression' && object.argument.callee && isFnExpression(object.argument.callee)) {
              tempObject = object.argument.callee;
            }
            if (tempObject && tempObject.params && tempObject.params.length) {
              params = tempObject.params;
              fnExpScope = mixin({}, fnExpScope, true);
              for (i = 0; i < params.length; i++) {
                param = params[i];
                if (param.type === 'Identifier') {
                  fnExpScope[param.name] = true;
                }
              }
            }
            for (key in object) {
              if (object.hasOwnProperty(key)) {
                child = object[key];
                if (typeof child === 'object' && child !== null) {
                  result = this.recurse(child, onMatch, options, fnExpScope);
                  if (typeof result === 'string') {
                    break;
                  }
                }
              }
            }
            if (typeof result === 'string') {
              if (hasProp(fnExpScope, result)) {
                return result;
              }
              return ;
            }
          }
        };
        parse.definesRequire = function(fileName, fileContents) {
          var found = false;
          traverse(esprima.parse(fileContents), function(node) {
            if (parse.hasDefineAmd(node)) {
              found = true;
              return false;
            }
          });
          return found;
        };
        parse.getAnonDeps = function(fileName, fileContents) {
          var astRoot = typeof fileContents === 'string' ? esprima.parse(fileContents) : fileContents,
              defFunc = this.findAnonDefineFactory(astRoot);
          return parse.getAnonDepsFromNode(defFunc);
        };
        parse.getAnonDepsFromNode = function(node) {
          var deps = [],
              funcArgLength;
          if (node) {
            this.findRequireDepNames(node, deps);
            funcArgLength = node.params && node.params.length;
            if (funcArgLength) {
              deps = (funcArgLength > 1 ? ["require", "exports", "module"] : ["require"]).concat(deps);
            }
          }
          return deps;
        };
        parse.isDefineNodeWithArgs = function(node) {
          return node && node.type === 'CallExpression' && node.callee && node.callee.type === 'Identifier' && node.callee.name === 'define' && node[argPropName];
        };
        parse.findAnonDefineFactory = function(node) {
          var match;
          traverse(node, function(node) {
            var arg0,
                arg1;
            if (parse.isDefineNodeWithArgs(node)) {
              arg0 = node[argPropName][0];
              if (isFnExpression(arg0)) {
                match = arg0;
                return false;
              }
              arg1 = node[argPropName][1];
              if (arg0.type === 'Literal' && isFnExpression(arg1)) {
                match = arg1;
                return false;
              }
            }
          });
          return match;
        };
        parse.findConfig = function(fileContents) {
          var jsConfig,
              foundConfig,
              stringData,
              foundRange,
              quote,
              quoteMatch,
              quoteRegExp = /(:\s|\[\s*)(['"])/,
              astRoot = esprima.parse(fileContents, {loc: true});
          traverse(astRoot, function(node) {
            var arg,
                requireType = parse.hasRequire(node);
            if (requireType && (requireType === 'require' || requireType === 'requirejs' || requireType === 'requireConfig' || requireType === 'requirejsConfig')) {
              arg = node[argPropName] && node[argPropName][0];
              if (arg && arg.type === 'ObjectExpression') {
                stringData = parse.nodeToString(fileContents, arg);
                jsConfig = stringData.value;
                foundRange = stringData.range;
                return false;
              }
            } else {
              arg = parse.getRequireObjectLiteral(node);
              if (arg) {
                stringData = parse.nodeToString(fileContents, arg);
                jsConfig = stringData.value;
                foundRange = stringData.range;
                return false;
              }
            }
          });
          if (jsConfig) {
            quoteMatch = quoteRegExp.exec(jsConfig);
            quote = (quoteMatch && quoteMatch[2]) || '"';
            foundConfig = eval('(' + jsConfig + ')');
          }
          return {
            config: foundConfig,
            range: foundRange,
            quote: quote
          };
        };
        parse.getRequireObjectLiteral = function(node) {
          if (node.id && node.id.type === 'Identifier' && (node.id.name === 'require' || node.id.name === 'requirejs') && node.init && node.init.type === 'ObjectExpression') {
            return node.init;
          }
        };
        parse.renameNamespace = function(fileContents, ns) {
          var lines,
              locs = [],
              astRoot = esprima.parse(fileContents, {loc: true});
          parse.recurse(astRoot, function(callName, config, name, deps, node) {
            locs.push(node.loc);
            return callName !== 'define';
          }, {});
          if (locs.length) {
            lines = fileContents.split('\n');
            locs.reverse();
            locs.forEach(function(loc) {
              var startIndex = loc.start.column,
                  lineIndex = loc.start.line - 1,
                  line = lines[lineIndex];
              lines[lineIndex] = line.substring(0, startIndex) + ns + '.' + line.substring(startIndex, line.length);
            });
            fileContents = lines.join('\n');
          }
          return fileContents;
        };
        parse.findDependencies = function(fileName, fileContents, options) {
          var dependencies = [],
              astRoot = esprima.parse(fileContents);
          parse.recurse(astRoot, function(callName, config, name, deps) {
            if (deps) {
              dependencies = dependencies.concat(deps);
            }
          }, options);
          return dependencies;
        };
        parse.findCjsDependencies = function(fileName, fileContents) {
          var dependencies = [];
          traverse(esprima.parse(fileContents), function(node) {
            var arg;
            if (node && node.type === 'CallExpression' && node.callee && node.callee.type === 'Identifier' && node.callee.name === 'require' && node[argPropName] && node[argPropName].length === 1) {
              arg = node[argPropName][0];
              if (arg.type === 'Literal') {
                dependencies.push(arg.value);
              }
            }
          });
          return dependencies;
        };
        parse.hasDefDefine = function(node) {
          return node.type === 'FunctionDeclaration' && node.id && node.id.type === 'Identifier' && node.id.name === 'define';
        };
        parse.hasDefineAmd = function(node) {
          return node && node.type === 'AssignmentExpression' && node.left && node.left.type === 'MemberExpression' && node.left.object && node.left.object.name === 'define' && node.left.property && node.left.property.name === 'amd';
        };
        parse.refsDefineAmd = function(node) {
          return node && node.type === 'MemberExpression' && node.object && node.object.name === 'define' && node.object.type === 'Identifier' && node.property && node.property.name === 'amd' && node.property.type === 'Identifier';
        };
        parse.hasRequire = function(node) {
          var callName,
              c = node && node.callee;
          if (node && node.type === 'CallExpression' && c) {
            if (c.type === 'Identifier' && (c.name === 'require' || c.name === 'requirejs')) {
              callName = c.name;
            } else if (c.type === 'MemberExpression' && c.object && c.object.type === 'Identifier' && (c.object.name === 'require' || c.object.name === 'requirejs') && c.property && c.property.name === 'config') {
              callName = c.object.name + 'Config';
            }
          }
          return callName;
        };
        parse.hasDefine = function(node) {
          return node && node.type === 'CallExpression' && node.callee && node.callee.type === 'Identifier' && node.callee.name === 'define';
        };
        parse.getNamedDefine = function(fileContents) {
          var name;
          traverse(esprima.parse(fileContents), function(node) {
            if (node && node.type === 'CallExpression' && node.callee && node.callee.type === 'Identifier' && node.callee.name === 'define' && node[argPropName] && node[argPropName][0] && node[argPropName][0].type === 'Literal') {
              name = node[argPropName][0].value;
              return false;
            }
          });
          return name;
        };
        parse.usesAmdOrRequireJs = function(fileName, fileContents) {
          var uses;
          traverse(esprima.parse(fileContents), function(node) {
            var type,
                callName,
                arg;
            if (parse.hasDefDefine(node)) {
              type = 'declaresDefine';
            } else if (parse.hasDefineAmd(node)) {
              type = 'defineAmd';
            } else {
              callName = parse.hasRequire(node);
              if (callName) {
                arg = node[argPropName] && node[argPropName][0];
                if (arg && (arg.type === 'ObjectExpression' || arg.type === 'ArrayExpression')) {
                  type = callName;
                }
              } else if (parse.hasDefine(node)) {
                type = 'define';
              }
            }
            if (type) {
              if (!uses) {
                uses = {};
              }
              uses[type] = true;
            }
          });
          return uses;
        };
        parse.usesCommonJs = function(fileName, fileContents) {
          var uses = null,
              assignsExports = false;
          traverse(esprima.parse(fileContents), function(node) {
            var type,
                exp = node.expression || node.init;
            if (node.type === 'Identifier' && (node.name === '__dirname' || node.name === '__filename')) {
              type = node.name.substring(2);
            } else if (node.type === 'VariableDeclarator' && node.id && node.id.type === 'Identifier' && node.id.name === 'exports') {
              type = 'varExports';
            } else if (exp && exp.type === 'AssignmentExpression' && exp.left && exp.left.type === 'MemberExpression' && exp.left.object) {
              if (exp.left.object.name === 'module' && exp.left.property && exp.left.property.name === 'exports') {
                type = 'moduleExports';
              } else if (exp.left.object.name === 'exports' && exp.left.property) {
                type = 'exports';
              }
            } else if (node && node.type === 'CallExpression' && node.callee && node.callee.type === 'Identifier' && node.callee.name === 'require' && node[argPropName] && node[argPropName].length === 1 && node[argPropName][0].type === 'Literal') {
              type = 'require';
            }
            if (type) {
              if (type === 'varExports') {
                assignsExports = true;
              } else if (type !== 'exports' || !assignsExports) {
                if (!uses) {
                  uses = {};
                }
                uses[type] = true;
              }
            }
          });
          return uses;
        };
        parse.findRequireDepNames = function(node, deps) {
          traverse(node, function(node) {
            var arg;
            if (node && node.type === 'CallExpression' && node.callee && node.callee.type === 'Identifier' && node.callee.name === 'require' && node[argPropName] && node[argPropName].length === 1) {
              arg = node[argPropName][0];
              if (arg.type === 'Literal') {
                deps.push(arg.value);
              }
            }
          });
        };
        parse.parseNode = function(node, onMatch, fnExpScope) {
          var name,
              deps,
              cjsDeps,
              arg,
              factory,
              exp,
              refsDefine,
              bodyNode,
              args = node && node[argPropName],
              callName = parse.hasRequire(node);
          if (callName === 'require' || callName === 'requirejs') {
            arg = node[argPropName] && node[argPropName][0];
            if (arg && arg.type !== 'ArrayExpression') {
              if (arg.type === 'ObjectExpression') {
                arg = node[argPropName][1];
              }
            }
            deps = getValidDeps(arg);
            if (!deps) {
              return ;
            }
            return onMatch("require", null, null, deps, node);
          } else if (parse.hasDefine(node) && args && args.length) {
            name = args[0];
            deps = args[1];
            factory = args[2];
            if (name.type === 'ArrayExpression') {
              factory = deps;
              deps = name;
              name = null;
            } else if (isFnExpression(name)) {
              factory = name;
              name = deps = null;
            } else if (name.type !== 'Literal') {
              name = deps = factory = null;
            }
            if (name && name.type === 'Literal' && deps) {
              if (isFnExpression(deps)) {
                factory = deps;
                deps = null;
              } else if (deps.type === 'ObjectExpression') {
                deps = factory = null;
              } else if (deps.type === 'Identifier' && args.length === 2) {
                deps = factory = null;
              }
            }
            if (deps && deps.type === 'ArrayExpression') {
              deps = getValidDeps(deps);
            } else if (isFnExpression(factory)) {
              cjsDeps = parse.getAnonDepsFromNode(factory);
              if (cjsDeps.length) {
                deps = cjsDeps;
              }
            } else if (deps || factory) {
              return ;
            }
            if (name && name.type === 'Literal') {
              name = name.value;
            }
            return onMatch("define", null, name, deps, node, (factory && factory.type === 'Identifier' ? factory.name : undefined), fnExpScope);
          } else if (node.type === 'CallExpression' && node.callee && isFnExpression(node.callee) && node.callee.body && node.callee.body.body && node.callee.body.body.length === 1 && node.callee.body.body[0].type === 'IfStatement') {
            bodyNode = node.callee.body.body[0];
            if (bodyNode.consequent && bodyNode.consequent.body) {
              exp = bodyNode.consequent.body[0];
              if (exp.type === 'ExpressionStatement' && exp.expression && parse.hasDefine(exp.expression) && exp.expression.arguments && exp.expression.arguments.length === 1 && exp.expression.arguments[0].type === 'Identifier') {
                traverse(bodyNode.test, function(node) {
                  if (parse.refsDefineAmd(node)) {
                    refsDefine = true;
                    return false;
                  }
                });
                if (refsDefine) {
                  return onMatch("define", null, null, null, exp.expression, exp.expression.arguments[0].name, fnExpScope);
                }
              }
            }
          }
        };
        parse.nodeToString = function(contents, node) {
          var extracted,
              loc = node.loc,
              lines = contents.split('\n'),
              firstLine = loc.start.line > 1 ? lines.slice(0, loc.start.line - 1).join('\n') + '\n' : '',
              preamble = firstLine + lines[loc.start.line - 1].substring(0, loc.start.column);
          if (loc.start.line === loc.end.line) {
            extracted = lines[loc.start.line - 1].substring(loc.start.column, loc.end.column);
          } else {
            extracted = lines[loc.start.line - 1].substring(loc.start.column) + '\n' + lines.slice(loc.start.line, loc.end.line - 1).join('\n') + '\n' + lines[loc.end.line - 1].substring(0, loc.end.column);
          }
          return {
            value: extracted,
            range: [preamble.length, preamble.length + extracted.length]
          };
        };
        parse.getLicenseComments = function(fileName, contents) {
          var commentNode,
              refNode,
              subNode,
              value,
              i,
              j,
              ast = esprima.parse(contents, {
                comment: true,
                range: true
              }),
              result = '',
              existsMap = {},
              lineEnd = contents.indexOf('\r') === -1 ? '\n' : '\r\n';
          if (ast.comments) {
            for (i = 0; i < ast.comments.length; i++) {
              commentNode = ast.comments[i];
              if (commentNode.type === 'Line') {
                value = '//' + commentNode.value + lineEnd;
                refNode = commentNode;
                if (i + 1 >= ast.comments.length) {
                  value += lineEnd;
                } else {
                  for (j = i + 1; j < ast.comments.length; j++) {
                    subNode = ast.comments[j];
                    if (subNode.type === 'Line' && subNode.range[0] === refNode.range[1] + 1) {
                      value += '//' + subNode.value + lineEnd;
                      refNode = subNode;
                    } else {
                      break;
                    }
                  }
                  value += lineEnd;
                  i = j - 1;
                }
              } else {
                value = '/*' + commentNode.value + '*/' + lineEnd + lineEnd;
              }
              if (!existsMap[value] && (value.indexOf('license') !== -1 || (commentNode.type === 'Block' && value.indexOf('/*!') === 0) || value.indexOf('opyright') !== -1 || value.indexOf('(c)') !== -1)) {
                result += value;
                existsMap[value] = true;
              }
            }
          }
          return result;
        };
        return parse;
      });
      define('transform', ['./esprimaAdapter', './parse', 'logger', 'lang'], function(esprima, parse, logger, lang) {
        'use strict';
        var transform,
            baseIndentRegExp = /^([ \t]+)/,
            indentRegExp = /\{[\r\n]+([ \t]+)/,
            keyRegExp = /^[_A-Za-z]([A-Za-z\d_]*)$/,
            bulkIndentRegExps = {
              '\n': /\n/g,
              '\r\n': /\r\n/g
            };
        function applyIndent(str, indent, lineReturn) {
          var regExp = bulkIndentRegExps[lineReturn];
          return str.replace(regExp, '$&' + indent);
        }
        transform = {
          toTransport: function(namespace, moduleName, path, contents, onFound, options) {
            options = options || {};
            var astRoot,
                contentLines,
                modLine,
                foundAnon,
                scanCount = 0,
                scanReset = false,
                defineInfos = [],
                applySourceUrl = function(contents) {
                  if (options.useSourceUrl) {
                    contents = 'eval("' + lang.jsEscape(contents) + '\\n//# sourceURL=' + (path.indexOf('/') === 0 ? '' : '/') + path + '");\n';
                  }
                  return contents;
                };
            try {
              astRoot = esprima.parse(contents, {loc: true});
            } catch (e) {
              logger.trace('toTransport skipping ' + path + ': ' + e.toString());
              return contents;
            }
            parse.traverse(astRoot, function(node) {
              var args,
                  firstArg,
                  firstArgLoc,
                  factoryNode,
                  needsId,
                  depAction,
                  foundId,
                  init,
                  sourceUrlData,
                  range,
                  namespaceExists = false;
              if (node.type === 'VariableDeclarator' && node.id && node.id.name === 'define' && node.id.type === 'Identifier') {
                init = node.init;
                if (init && init.callee && init.callee.type === 'CallExpression' && init.callee.callee && init.callee.callee.type === 'Identifier' && init.callee.callee.name === 'require' && init.callee.arguments && init.callee.arguments.length === 1 && init.callee.arguments[0].type === 'Literal' && init.callee.arguments[0].value && init.callee.arguments[0].value.indexOf('amdefine') !== -1) {} else {
                  return false;
                }
              }
              namespaceExists = namespace && node.type === 'CallExpression' && node.callee && node.callee.object && node.callee.object.type === 'Identifier' && node.callee.object.name === namespace && node.callee.property.type === 'Identifier' && node.callee.property.name === 'define';
              if (namespaceExists || parse.isDefineNodeWithArgs(node)) {
                args = node.arguments;
                if (!args || !args.length) {
                  return ;
                }
                firstArg = args[0];
                firstArgLoc = firstArg.loc;
                if (args.length === 1) {
                  if (firstArg.type === 'Identifier') {
                    needsId = true;
                    depAction = 'empty';
                  } else if (parse.isFnExpression(firstArg)) {
                    factoryNode = firstArg;
                    needsId = true;
                    depAction = 'scan';
                  } else if (firstArg.type === 'ObjectExpression') {
                    needsId = true;
                    depAction = 'skip';
                  } else if (firstArg.type === 'Literal' && typeof firstArg.value === 'number') {
                    needsId = true;
                    depAction = 'skip';
                  } else if (firstArg.type === 'UnaryExpression' && firstArg.operator === '-' && firstArg.argument && firstArg.argument.type === 'Literal' && typeof firstArg.argument.value === 'number') {
                    needsId = true;
                    depAction = 'skip';
                  } else if (firstArg.type === 'MemberExpression' && firstArg.object && firstArg.property && firstArg.property.type === 'Identifier') {
                    needsId = true;
                    depAction = 'empty';
                  }
                } else if (firstArg.type === 'ArrayExpression') {
                  needsId = true;
                  depAction = 'skip';
                } else if (firstArg.type === 'Literal' && typeof firstArg.value === 'string') {
                  needsId = false;
                  if (args.length === 2 && parse.isFnExpression(args[1])) {
                    factoryNode = args[1];
                    depAction = 'scan';
                  } else {
                    depAction = 'skip';
                  }
                } else {
                  return ;
                }
                range = {
                  foundId: foundId,
                  needsId: needsId,
                  depAction: depAction,
                  namespaceExists: namespaceExists,
                  node: node,
                  defineLoc: node.loc,
                  firstArgLoc: firstArgLoc,
                  factoryNode: factoryNode,
                  sourceUrlData: sourceUrlData
                };
                if (range.needsId) {
                  if (foundAnon) {
                    logger.trace(path + ' has more than one anonymous ' + 'define. May be a built file from another ' + 'build system like, Ender. Skipping normalization.');
                    defineInfos = [];
                    return false;
                  } else {
                    foundAnon = range;
                    defineInfos.push(range);
                  }
                } else if (depAction === 'scan') {
                  scanCount += 1;
                  if (scanCount > 1) {
                    if (!scanReset) {
                      defineInfos = foundAnon ? [foundAnon] : [];
                      scanReset = true;
                    }
                  } else {
                    defineInfos.push(range);
                  }
                }
              }
            });
            if (!defineInfos.length) {
              return applySourceUrl(contents);
            }
            defineInfos.reverse();
            contentLines = contents.split('\n');
            modLine = function(loc, contentInsertion) {
              var startIndex = loc.start.column,
                  lineIndex = loc.start.line - 1,
                  line = contentLines[lineIndex];
              contentLines[lineIndex] = line.substring(0, startIndex) + contentInsertion + line.substring(startIndex, line.length);
            };
            defineInfos.forEach(function(info) {
              var deps,
                  contentInsertion = '',
                  depString = '';
              if (info.needsId && moduleName) {
                contentInsertion += "'" + moduleName + "',";
              }
              if (info.depAction === 'scan') {
                deps = parse.getAnonDepsFromNode(info.factoryNode);
                if (deps.length) {
                  depString = '[' + deps.map(function(dep) {
                    return "'" + dep + "'";
                  }) + ']';
                } else {
                  depString = '[]';
                }
                depString += ',';
                if (info.factoryNode) {
                  modLine(info.factoryNode.loc, depString);
                } else {
                  contentInsertion += depString;
                }
              }
              if (contentInsertion) {
                modLine(info.firstArgLoc, contentInsertion);
              }
              if (namespace && !info.namespaceExists) {
                modLine(info.defineLoc, namespace + '.');
              }
              if (onFound) {
                onFound(info);
              }
            });
            contents = contentLines.join('\n');
            return applySourceUrl(contents);
          },
          modifyConfig: function(fileContents, onConfig) {
            var details = parse.findConfig(fileContents),
                config = details.config;
            if (config) {
              config = onConfig(config);
              if (config) {
                return transform.serializeConfig(config, fileContents, details.range[0], details.range[1], {quote: details.quote});
              }
            }
            return fileContents;
          },
          serializeConfig: function(config, fileContents, start, end, options) {
            var indent,
                match,
                configString,
                outDentRegExp,
                baseIndent = '',
                startString = fileContents.substring(0, start),
                existingConfigString = fileContents.substring(start, end),
                lineReturn = existingConfigString.indexOf('\r') === -1 ? '\n' : '\r\n',
                lastReturnIndex = startString.lastIndexOf('\n');
            if (lastReturnIndex === -1) {
              lastReturnIndex = 0;
            }
            match = baseIndentRegExp.exec(startString.substring(lastReturnIndex + 1, start));
            if (match && match[1]) {
              baseIndent = match[1];
            }
            match = indentRegExp.exec(existingConfigString);
            if (match && match[1]) {
              indent = match[1];
            }
            if (!indent || indent.length < baseIndent) {
              indent = '  ';
            } else {
              indent = indent.substring(baseIndent.length);
            }
            outDentRegExp = new RegExp('(' + lineReturn + ')' + indent, 'g');
            configString = transform.objectToString(config, {
              indent: indent,
              lineReturn: lineReturn,
              outDentRegExp: outDentRegExp,
              quote: options && options.quote
            });
            configString = applyIndent(configString, baseIndent, lineReturn);
            return startString + configString + fileContents.substring(end);
          },
          objectToString: function(obj, options, totalIndent) {
            var startBrace,
                endBrace,
                nextIndent,
                first = true,
                value = '',
                lineReturn = options.lineReturn,
                indent = options.indent,
                outDentRegExp = options.outDentRegExp,
                quote = options.quote || '"';
            totalIndent = totalIndent || '';
            nextIndent = totalIndent + indent;
            if (obj === null) {
              value = 'null';
            } else if (obj === undefined) {
              value = 'undefined';
            } else if (typeof obj === 'number' || typeof obj === 'boolean') {
              value = obj;
            } else if (typeof obj === 'string') {
              value = quote + lang.jsEscape(obj) + quote;
            } else if (lang.isArray(obj)) {
              lang.each(obj, function(item, i) {
                value += (i !== 0 ? ',' + lineReturn : '') + nextIndent + transform.objectToString(item, options, nextIndent);
              });
              startBrace = '[';
              endBrace = ']';
            } else if (lang.isFunction(obj) || lang.isRegExp(obj)) {
              value = obj.toString().replace(outDentRegExp, '$1');
            } else {
              lang.eachProp(obj, function(v, prop) {
                value += (first ? '' : ',' + lineReturn) + nextIndent + (keyRegExp.test(prop) ? prop : quote + lang.jsEscape(prop) + quote) + ': ' + transform.objectToString(v, options, nextIndent);
                first = false;
              });
              startBrace = '{';
              endBrace = '}';
            }
            if (startBrace) {
              value = startBrace + lineReturn + value + lineReturn + totalIndent + endBrace;
            }
            return value;
          }
        };
        return transform;
      });
      define('pragma', ['parse', 'logger'], function(parse, logger) {
        'use strict';
        function Temp() {}
        function create(obj, mixin) {
          Temp.prototype = obj;
          var temp = new Temp(),
              prop;
          Temp.prototype = null;
          if (mixin) {
            for (prop in mixin) {
              if (mixin.hasOwnProperty(prop) && !temp.hasOwnProperty(prop)) {
                temp[prop] = mixin[prop];
              }
            }
          }
          return temp;
        }
        var pragma = {
          conditionalRegExp: /(exclude|include)Start\s*\(\s*["'](\w+)["']\s*,(.*)\)/,
          useStrictRegExp: /(^|[^{]\r?\n)['"]use strict['"];/g,
          hasRegExp: /has\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
          configRegExp: /(^|[^\.])(requirejs|require)(\.config)\s*\(/g,
          nsWrapRegExp: /\/\*requirejs namespace: true \*\//,
          apiDefRegExp: /var requirejs,\s*require,\s*define;/,
          defineCheckRegExp: /typeof\s+define\s*===?\s*["']function["']\s*&&\s*define\s*\.\s*amd/g,
          defineStringCheckRegExp: /typeof\s+define\s*===?\s*["']function["']\s*&&\s*define\s*\[\s*["']amd["']\s*\]/g,
          defineTypeFirstCheckRegExp: /\s*["']function["']\s*==(=?)\s*typeof\s+define\s*&&\s*define\s*\.\s*amd/g,
          defineJQueryRegExp: /typeof\s+define\s*===?\s*["']function["']\s*&&\s*define\s*\.\s*amd\s*&&\s*define\s*\.\s*amd\s*\.\s*jQuery/g,
          defineHasRegExp: /typeof\s+define\s*==(=)?\s*['"]function['"]\s*&&\s*typeof\s+define\.amd\s*==(=)?\s*['"]object['"]\s*&&\s*define\.amd/g,
          defineTernaryRegExp: /typeof\s+define\s*===?\s*['"]function["']\s*&&\s*define\s*\.\s*amd\s*\?\s*define/,
          amdefineRegExp: /if\s*\(\s*typeof define\s*\!==\s*'function'\s*\)\s*\{\s*[^\{\}]+amdefine[^\{\}]+\}/g,
          removeStrict: function(contents, config) {
            return config.useStrict ? contents : contents.replace(pragma.useStrictRegExp, '$1');
          },
          namespace: function(fileContents, ns, onLifecycleName) {
            if (ns) {
              fileContents = fileContents.replace(pragma.configRegExp, '$1' + ns + '.$2$3(');
              fileContents = parse.renameNamespace(fileContents, ns);
              fileContents = fileContents.replace(pragma.defineTernaryRegExp, "typeof " + ns + ".define === 'function' && " + ns + ".define.amd ? " + ns + ".define");
              fileContents = fileContents.replace(pragma.defineJQueryRegExp, "typeof " + ns + ".define === 'function' && " + ns + ".define.amd && " + ns + ".define.amd.jQuery");
              fileContents = fileContents.replace(pragma.defineHasRegExp, "typeof " + ns + ".define === 'function' && typeof " + ns + ".define.amd === 'object' && " + ns + ".define.amd");
              fileContents = fileContents.replace(pragma.defineCheckRegExp, "typeof " + ns + ".define === 'function' && " + ns + ".define.amd");
              fileContents = fileContents.replace(pragma.defineStringCheckRegExp, "typeof " + ns + ".define === 'function' && " + ns + ".define['amd']");
              fileContents = fileContents.replace(pragma.defineTypeFirstCheckRegExp, "'function' === typeof " + ns + ".define && " + ns + ".define.amd");
              if (pragma.apiDefRegExp.test(fileContents) && fileContents.indexOf("if (!" + ns + " || !" + ns + ".requirejs)") === -1) {
                fileContents = "var " + ns + ";(function () { if (!" + ns + " || !" + ns + ".requirejs) {\n" + "if (!" + ns + ") { " + ns + ' = {}; } else { require = ' + ns + '; }\n' + fileContents + "\n" + ns + ".requirejs = requirejs;" + ns + ".require = require;" + ns + ".define = define;\n" + "}\n}());";
              }
              if (pragma.nsWrapRegExp.test(fileContents)) {
                fileContents = fileContents.replace(pragma.nsWrapRegExp, '');
                fileContents = '(function () {\n' + 'var require = ' + ns + '.require,' + 'requirejs = ' + ns + '.requirejs,' + 'define = ' + ns + '.define;\n' + fileContents + '\n}());';
              }
            }
            return fileContents;
          },
          process: function(fileName, fileContents, config, onLifecycleName, pluginCollector) {
            var foundIndex = -1,
                startIndex = 0,
                lineEndIndex,
                conditionLine,
                matches,
                type,
                marker,
                condition,
                isTrue,
                endRegExp,
                endMatches,
                endMarkerIndex,
                shouldInclude,
                startLength,
                lifecycleHas,
                deps,
                i,
                dep,
                moduleName,
                collectorMod,
                lifecyclePragmas,
                pragmas = config.pragmas,
                hasConfig = config.has,
                kwArgs = pragmas;
            if (onLifecycleName) {
              lifecyclePragmas = config['pragmas' + onLifecycleName];
              lifecycleHas = config['has' + onLifecycleName];
              if (lifecyclePragmas) {
                pragmas = create(pragmas || {}, lifecyclePragmas);
              }
              if (lifecycleHas) {
                hasConfig = create(hasConfig || {}, lifecycleHas);
              }
            }
            if (hasConfig) {
              fileContents = fileContents.replace(pragma.hasRegExp, function(match, test) {
                if (hasConfig.hasOwnProperty(test)) {
                  return !!hasConfig[test];
                }
                return match;
              });
            }
            if (!config.skipPragmas) {
              while ((foundIndex = fileContents.indexOf("//>>", startIndex)) !== -1) {
                lineEndIndex = fileContents.indexOf("\n", foundIndex);
                if (lineEndIndex === -1) {
                  lineEndIndex = fileContents.length - 1;
                }
                startIndex = lineEndIndex + 1;
                conditionLine = fileContents.substring(foundIndex, lineEndIndex + 1);
                matches = conditionLine.match(pragma.conditionalRegExp);
                if (matches) {
                  type = matches[1];
                  marker = matches[2];
                  condition = matches[3];
                  isTrue = false;
                  try {
                    isTrue = !!eval("(" + condition + ")");
                  } catch (e) {
                    throw "Error in file: " + fileName + ". Conditional comment: " + conditionLine + " failed with this error: " + e;
                  }
                  endRegExp = new RegExp('\\/\\/\\>\\>\\s*' + type + 'End\\(\\s*[\'"]' + marker + '[\'"]\\s*\\)', "g");
                  endMatches = endRegExp.exec(fileContents.substring(startIndex, fileContents.length));
                  if (endMatches) {
                    endMarkerIndex = startIndex + endRegExp.lastIndex - endMatches[0].length;
                    lineEndIndex = fileContents.indexOf("\n", endMarkerIndex);
                    if (lineEndIndex === -1) {
                      lineEndIndex = fileContents.length - 1;
                    }
                    shouldInclude = ((type === "exclude" && !isTrue) || (type === "include" && isTrue));
                    startLength = startIndex - foundIndex;
                    fileContents = fileContents.substring(0, foundIndex) + (shouldInclude ? fileContents.substring(startIndex, endMarkerIndex) : "") + fileContents.substring(lineEndIndex + 1, fileContents.length);
                    startIndex = foundIndex;
                  } else {
                    throw "Error in file: " + fileName + ". Cannot find end marker for conditional comment: " + conditionLine;
                  }
                }
              }
            }
            if (config.optimizeAllPluginResources && pluginCollector) {
              try {
                deps = parse.findDependencies(fileName, fileContents);
                if (deps.length) {
                  for (i = 0; i < deps.length; i++) {
                    dep = deps[i];
                    if (dep.indexOf('!') !== -1) {
                      moduleName = dep.split('!')[0];
                      collectorMod = pluginCollector[moduleName];
                      if (!collectorMod) {
                        collectorMod = pluginCollector[moduleName] = [];
                      }
                      collectorMod.push(dep);
                    }
                  }
                }
              } catch (eDep) {
                logger.error('Parse error looking for plugin resources in ' + fileName + ', skipping.');
              }
            }
            if (!config.keepAmdefine) {
              fileContents = fileContents.replace(pragma.amdefineRegExp, '');
            }
            if (onLifecycleName === 'OnSave' && config.namespace) {
              fileContents = pragma.namespace(fileContents, config.namespace, onLifecycleName);
            }
            return pragma.removeStrict(fileContents, config);
          }
        };
        return pragma;
      });
      if (env === 'browser') {
        define('browser/optimize', {});
      }
      if (env === 'node') {
        define('node/optimize', {});
      }
      if (env === 'rhino') {
        define('rhino/optimize', ['logger', 'env!env/file'], function(logger, file) {
          if (!Array.prototype.reduce) {
            Array.prototype.reduce = function(fn) {
              var i = 0,
                  length = this.length,
                  accumulator;
              if (arguments.length >= 2) {
                accumulator = arguments[1];
              } else {
                if (length) {
                  while (!(i in this)) {
                    i++;
                  }
                  accumulator = this[i++];
                }
              }
              for (; i < length; i++) {
                if (i in this) {
                  accumulator = fn.call(undefined, accumulator, this[i], i, this);
                }
              }
              return accumulator;
            };
          }
          var JSSourceFilefromCode,
              optimize,
              mapRegExp = /"file":"[^"]+"/;
          try {
            JSSourceFilefromCode = java.lang.Class.forName('com.google.javascript.jscomp.JSSourceFile').getMethod('fromCode', [java.lang.String, java.lang.String]);
          } catch (e) {
            try {
              JSSourceFilefromCode = java.lang.Class.forName('com.google.javascript.jscomp.SourceFile').getMethod('fromCode', [java.lang.String, java.lang.String]);
            } catch (e) {}
          }
          function closurefromCode(filename, content) {
            return JSSourceFilefromCode.invoke(null, [filename, content]);
          }
          function getFileWriter(fileName, encoding) {
            var outFile = new java.io.File(fileName),
                outWriter,
                parentDir;
            parentDir = outFile.getAbsoluteFile().getParentFile();
            if (!parentDir.exists()) {
              if (!parentDir.mkdirs()) {
                throw "Could not create directory: " + parentDir.getAbsolutePath();
              }
            }
            if (encoding) {
              outWriter = new java.io.OutputStreamWriter(new java.io.FileOutputStream(outFile), encoding);
            } else {
              outWriter = new java.io.OutputStreamWriter(new java.io.FileOutputStream(outFile));
            }
            return new java.io.BufferedWriter(outWriter);
          }
          optimize = {closure: function(fileName, fileContents, outFileName, keepLines, config) {
              config = config || {};
              var result,
                  mappings,
                  optimized,
                  compressed,
                  baseName,
                  writer,
                  outBaseName,
                  outFileNameMap,
                  outFileNameMapContent,
                  srcOutFileName,
                  concatNameMap,
                  jscomp = Packages.com.google.javascript.jscomp,
                  flags = Packages.com.google.common.flags,
                  jsSourceFile = closurefromCode(String(fileName), String(fileContents)),
                  sourceListArray = new java.util.ArrayList(),
                  options,
                  option,
                  FLAG_compilation_level,
                  compiler,
                  Compiler = Packages.com.google.javascript.jscomp.Compiler,
                  CommandLineRunner = Packages.com.google.javascript.jscomp.CommandLineRunner;
              logger.trace("Minifying file: " + fileName);
              baseName = (new java.io.File(fileName)).getName();
              options = new jscomp.CompilerOptions();
              for (option in config.CompilerOptions) {
                if (config.CompilerOptions[option]) {
                  options[option] = config.CompilerOptions[option];
                }
              }
              options.prettyPrint = keepLines || options.prettyPrint;
              FLAG_compilation_level = jscomp.CompilationLevel[config.CompilationLevel || 'SIMPLE_OPTIMIZATIONS'];
              FLAG_compilation_level.setOptionsForCompilationLevel(options);
              if (config.generateSourceMaps) {
                mappings = new java.util.ArrayList();
                mappings.add(new com.google.javascript.jscomp.SourceMap.LocationMapping(fileName, baseName + ".src.js"));
                options.setSourceMapLocationMappings(mappings);
                options.setSourceMapOutputPath(fileName + ".map");
              }
              Compiler.setLoggingLevel(Packages.java.util.logging.Level[config.loggingLevel || 'WARNING']);
              compiler = new Compiler();
              sourceListArray.add(jsSourceFile);
              result = compiler.compile(CommandLineRunner.getDefaultExterns(), sourceListArray, options);
              if (result.success) {
                optimized = String(compiler.toSource());
                if (config.generateSourceMaps && result.sourceMap && outFileName) {
                  outBaseName = (new java.io.File(outFileName)).getName();
                  srcOutFileName = outFileName + ".src.js";
                  outFileNameMap = outFileName + ".map";
                  if (file.exists(outFileNameMap)) {
                    concatNameMap = outFileNameMap.replace(/\.map$/, '.src.js.map');
                    file.saveFile(concatNameMap, file.readFile(outFileNameMap));
                    file.saveFile(srcOutFileName, fileContents.replace(/\/\# sourceMappingURL=(.+).map/, '/# sourceMappingURL=$1.src.js.map'));
                  } else {
                    file.saveUtf8File(srcOutFileName, fileContents);
                  }
                  writer = getFileWriter(outFileNameMap, "utf-8");
                  result.sourceMap.appendTo(writer, outFileName);
                  writer.close();
                  file.saveFile(outFileNameMap, file.readFile(outFileNameMap).replace(mapRegExp, '"file":"' + baseName + '"'));
                  fileContents = optimized + "\n//# sourceMappingURL=" + outBaseName + ".map";
                } else {
                  fileContents = optimized;
                }
                return fileContents;
              } else {
                throw new Error('Cannot closure compile file: ' + fileName + '. Skipping it.');
              }
              return fileContents;
            }};
          return optimize;
        });
      }
      if (env === 'xpconnect') {
        define('xpconnect/optimize', {});
      }
      define('optimize', ['lang', 'logger', 'env!env/optimize', 'env!env/file', 'parse', 'pragma', 'uglifyjs/index', 'uglifyjs2', 'source-map'], function(lang, logger, envOptimize, file, parse, pragma, uglify, uglify2, sourceMap) {
        'use strict';
        var optimize,
            cssImportRegExp = /\@import\s+(url\()?\s*([^);]+)\s*(\))?([\w, ]*)(;)?/ig,
            cssCommentImportRegExp = /\/\*[^\*]*@import[^\*]*\*\//g,
            cssUrlRegExp = /\url\(\s*([^\)]+)\s*\)?/g,
            protocolRegExp = /^\w+:/,
            SourceMapGenerator = sourceMap.SourceMapGenerator,
            SourceMapConsumer = sourceMap.SourceMapConsumer;
        function cleanCssUrlQuotes(url) {
          url = url.replace(/\s+$/, "");
          if (url.charAt(0) === "'" || url.charAt(0) === "\"") {
            url = url.substring(1, url.length - 1);
          }
          return url;
        }
        function fixCssUrlPaths(fileName, path, contents, cssPrefix) {
          return contents.replace(cssUrlRegExp, function(fullMatch, urlMatch) {
            var firstChar,
                hasProtocol,
                parts,
                i,
                fixedUrlMatch = cleanCssUrlQuotes(urlMatch);
            fixedUrlMatch = fixedUrlMatch.replace(lang.backSlashRegExp, "/");
            firstChar = fixedUrlMatch.charAt(0);
            hasProtocol = protocolRegExp.test(fixedUrlMatch);
            if (firstChar !== "/" && firstChar !== "#" && !hasProtocol) {
              urlMatch = cssPrefix + path + fixedUrlMatch;
            } else if (!hasProtocol) {
              logger.trace(fileName + "\n  URL not a relative URL, skipping: " + urlMatch);
            }
            parts = urlMatch.split("/");
            for (i = parts.length - 1; i > 0; i--) {
              if (parts[i] === ".") {
                parts.splice(i, 1);
              } else if (parts[i] === "..") {
                if (i !== 0 && parts[i - 1] !== "..") {
                  parts.splice(i - 1, 2);
                  i -= 1;
                }
              }
            }
            return "url(" + parts.join("/") + ")";
          });
        }
        function flattenCss(fileName, fileContents, cssImportIgnore, cssPrefix, included, topLevel) {
          fileName = fileName.replace(lang.backSlashRegExp, "/");
          var endIndex = fileName.lastIndexOf("/"),
              filePath = (endIndex !== -1) ? fileName.substring(0, endIndex + 1) : "",
              importList = [],
              skippedList = [];
          fileContents = fileContents.replace(cssCommentImportRegExp, '');
          if (cssImportIgnore && cssImportIgnore.charAt(cssImportIgnore.length - 1) !== ",") {
            cssImportIgnore += ",";
          }
          fileContents = fileContents.replace(cssImportRegExp, function(fullMatch, urlStart, importFileName, urlEnd, mediaTypes) {
            if (mediaTypes && ((mediaTypes.replace(/^\s\s*/, '').replace(/\s\s*$/, '')) !== "all")) {
              skippedList.push(fileName);
              return fullMatch;
            }
            importFileName = cleanCssUrlQuotes(importFileName);
            if (cssImportIgnore && cssImportIgnore.indexOf(importFileName + ",") !== -1) {
              return fullMatch;
            }
            importFileName = importFileName.replace(lang.backSlashRegExp, "/");
            try {
              var fullImportFileName = importFileName.charAt(0) === "/" ? importFileName : filePath + importFileName,
                  importContents = file.readFile(fullImportFileName),
                  importEndIndex,
                  importPath,
                  flat;
              if (included[fullImportFileName]) {
                return '';
              }
              included[fullImportFileName] = true;
              flat = flattenCss(fullImportFileName, importContents, cssImportIgnore, cssPrefix, included);
              importContents = flat.fileContents;
              if (flat.importList.length) {
                importList.push.apply(importList, flat.importList);
              }
              if (flat.skippedList.length) {
                skippedList.push.apply(skippedList, flat.skippedList);
              }
              importEndIndex = importFileName.lastIndexOf("/");
              importPath = (importEndIndex !== -1) ? importFileName.substring(0, importEndIndex + 1) : "";
              importPath = importPath.replace(/^\.\//, '');
              importContents = fixCssUrlPaths(importFileName, importPath, importContents, cssPrefix);
              importList.push(fullImportFileName);
              return importContents;
            } catch (e) {
              logger.warn(fileName + "\n  Cannot inline css import, skipping: " + importFileName);
              return fullMatch;
            }
          });
          if (cssPrefix && topLevel) {
            fileContents = fixCssUrlPaths(fileName, '', fileContents, cssPrefix);
          }
          return {
            importList: importList,
            skippedList: skippedList,
            fileContents: fileContents
          };
        }
        optimize = {
          jsFile: function(fileName, fileContents, outFileName, config, pluginCollector) {
            if (!fileContents) {
              fileContents = file.readFile(fileName);
            }
            fileContents = optimize.js(fileName, fileContents, outFileName, config, pluginCollector);
            file.saveUtf8File(outFileName, fileContents);
          },
          js: function(fileName, fileContents, outFileName, config, pluginCollector) {
            var optFunc,
                optConfig,
                parts = (String(config.optimize)).split('.'),
                optimizerName = parts[0],
                keepLines = parts[1] === 'keepLines',
                licenseContents = '';
            config = config || {};
            fileContents = pragma.process(fileName, fileContents, config, 'OnSave', pluginCollector);
            if (optimizerName && optimizerName !== 'none') {
              optFunc = envOptimize[optimizerName] || optimize.optimizers[optimizerName];
              if (!optFunc) {
                throw new Error('optimizer with name of "' + optimizerName + '" not found for this environment');
              }
              optConfig = config[optimizerName] || {};
              if (config.generateSourceMaps) {
                optConfig.generateSourceMaps = !!config.generateSourceMaps;
                optConfig._buildSourceMap = config._buildSourceMap;
              }
              try {
                if (config.preserveLicenseComments) {
                  try {
                    licenseContents = parse.getLicenseComments(fileName, fileContents);
                  } catch (e) {
                    throw new Error('Cannot parse file: ' + fileName + ' for comments. Skipping it. Error is:\n' + e.toString());
                  }
                }
                fileContents = licenseContents + optFunc(fileName, fileContents, outFileName, keepLines, optConfig);
                if (optConfig._buildSourceMap && optConfig._buildSourceMap !== config._buildSourceMap) {
                  config._buildSourceMap = optConfig._buildSourceMap;
                }
              } catch (e) {
                if (config.throwWhen && config.throwWhen.optimize) {
                  throw e;
                } else {
                  logger.error(e);
                }
              }
            } else {
              if (config._buildSourceMap) {
                config._buildSourceMap = null;
              }
            }
            return fileContents;
          },
          cssFile: function(fileName, outFileName, config) {
            var originalFileContents = file.readFile(fileName),
                flat = flattenCss(fileName, originalFileContents, config.cssImportIgnore, config.cssPrefix, {}, true),
                fileContents = flat.skippedList.length ? originalFileContents : flat.fileContents,
                startIndex,
                endIndex,
                buildText,
                comment;
            if (flat.skippedList.length) {
              logger.warn('Cannot inline @imports for ' + fileName + ',\nthe following files had media queries in them:\n' + flat.skippedList.join('\n'));
            }
            try {
              if (config.optimizeCss.indexOf(".keepComments") === -1) {
                startIndex = 0;
                while ((startIndex = fileContents.indexOf("/*", startIndex)) !== -1) {
                  endIndex = fileContents.indexOf("*/", startIndex + 2);
                  if (endIndex === -1) {
                    throw "Improper comment in CSS file: " + fileName;
                  }
                  comment = fileContents.substring(startIndex, endIndex);
                  if (config.preserveLicenseComments && (comment.indexOf('license') !== -1 || comment.indexOf('opyright') !== -1 || comment.indexOf('(c)') !== -1)) {
                    startIndex = endIndex;
                  } else {
                    fileContents = fileContents.substring(0, startIndex) + fileContents.substring(endIndex + 2, fileContents.length);
                    startIndex = 0;
                  }
                }
              }
              if (config.optimizeCss.indexOf(".keepLines") === -1) {
                fileContents = fileContents.replace(/[\r\n]/g, " ");
                fileContents = fileContents.replace(/\s+/g, " ");
                fileContents = fileContents.replace(/\{\s/g, "{");
                fileContents = fileContents.replace(/\s\}/g, "}");
              } else {
                fileContents = fileContents.replace(/(\r\n)+/g, "\r\n");
                fileContents = fileContents.replace(/(\n)+/g, "\n");
              }
              if (config.optimizeCss.indexOf(".keepWhitespace") === -1) {
                fileContents = fileContents.replace(/^[ \t]+/gm, "");
                fileContents = fileContents.replace(/[ \t]+$/gm, "");
                fileContents = fileContents.replace(/(;|:|\{|}|,)[ \t]+/g, "$1");
                fileContents = fileContents.replace(/[ \t]+(\{)/g, "$1");
                fileContents = fileContents.replace(/([ \t])+/g, "$1");
                fileContents = fileContents.replace(/^[ \t]*[\r\n]/gm, '');
              }
            } catch (e) {
              fileContents = originalFileContents;
              logger.error("Could not optimized CSS file: " + fileName + ", error: " + e);
            }
            file.saveUtf8File(outFileName, fileContents);
            buildText = "\n" + outFileName.replace(config.dir, "") + "\n----------------\n";
            flat.importList.push(fileName);
            buildText += flat.importList.map(function(path) {
              return path.replace(config.dir, "");
            }).join("\n");
            return {
              importList: flat.importList,
              buildText: buildText + "\n"
            };
          },
          css: function(startDir, config) {
            var buildText = "",
                importList = [],
                shouldRemove = config.dir && config.removeCombined,
                i,
                fileName,
                result,
                fileList;
            if (config.optimizeCss.indexOf("standard") !== -1) {
              fileList = file.getFilteredFileList(startDir, /\.css$/, true);
              if (fileList) {
                for (i = 0; i < fileList.length; i++) {
                  fileName = fileList[i];
                  logger.trace("Optimizing (" + config.optimizeCss + ") CSS file: " + fileName);
                  result = optimize.cssFile(fileName, fileName, config);
                  buildText += result.buildText;
                  if (shouldRemove) {
                    result.importList.pop();
                    importList = importList.concat(result.importList);
                  }
                }
              }
              if (shouldRemove) {
                importList.forEach(function(path) {
                  if (file.exists(path)) {
                    file.deleteFile(path);
                  }
                });
              }
            }
            return buildText;
          },
          optimizers: {
            uglify: function(fileName, fileContents, outFileName, keepLines, config) {
              var parser = uglify.parser,
                  processor = uglify.uglify,
                  ast,
                  errMessage,
                  errMatch;
              config = config || {};
              logger.trace("Uglifying file: " + fileName);
              try {
                ast = parser.parse(fileContents, config.strict_semicolons);
                if (config.no_mangle !== true) {
                  ast = processor.ast_mangle(ast, config);
                }
                ast = processor.ast_squeeze(ast, config);
                fileContents = processor.gen_code(ast, config);
                if (config.max_line_length) {
                  fileContents = processor.split_lines(fileContents, config.max_line_length);
                }
                fileContents += ';';
              } catch (e) {
                errMessage = e.toString();
                errMatch = /\nError(\r)?\n/.exec(errMessage);
                if (errMatch) {
                  errMessage = errMessage.substring(0, errMatch.index);
                }
                throw new Error('Cannot uglify file: ' + fileName + '. Skipping it. Error is:\n' + errMessage);
              }
              return fileContents;
            },
            uglify2: function(fileName, fileContents, outFileName, keepLines, config) {
              var result,
                  existingMap,
                  resultMap,
                  finalMap,
                  sourceIndex,
                  uconfig = {},
                  existingMapPath = outFileName + '.map',
                  baseName = fileName && fileName.split('/').pop();
              config = config || {};
              lang.mixin(uconfig, config, true);
              uconfig.fromString = true;
              if (config.generateSourceMaps && (outFileName || config._buildSourceMap)) {
                uconfig.outSourceMap = baseName;
                if (config._buildSourceMap) {
                  existingMap = JSON.parse(config._buildSourceMap);
                  uconfig.inSourceMap = existingMap;
                } else if (file.exists(existingMapPath)) {
                  uconfig.inSourceMap = existingMapPath;
                  existingMap = JSON.parse(file.readFile(existingMapPath));
                }
              }
              logger.trace("Uglify2 file: " + fileName);
              try {
                result = uglify2.minify(fileContents, uconfig, baseName + '.src.js');
                if (uconfig.outSourceMap && result.map) {
                  resultMap = result.map;
                  if (existingMap) {
                    resultMap = JSON.parse(resultMap);
                    finalMap = SourceMapGenerator.fromSourceMap(new SourceMapConsumer(resultMap));
                    finalMap.applySourceMap(new SourceMapConsumer(existingMap));
                    resultMap = finalMap.toString();
                  } else if (!config._buildSourceMap) {
                    file.saveFile(outFileName + '.src.js', fileContents);
                  }
                  fileContents = result.code;
                  if (config._buildSourceMap) {
                    config._buildSourceMap = resultMap;
                  } else {
                    file.saveFile(outFileName + '.map', resultMap);
                    fileContents += "\n//# sourceMappingURL=" + baseName + ".map";
                  }
                } else {
                  fileContents = result.code;
                }
              } catch (e) {
                throw new Error('Cannot uglify2 file: ' + fileName + '. Skipping it. Error is:\n' + e.toString());
              }
              return fileContents;
            }
          }
        };
        return optimize;
      });
      define('requirePatch', ['env!env/file', 'pragma', 'parse', 'lang', 'logger', 'commonJs', 'prim'], function(file, pragma, parse, lang, logger, commonJs, prim) {
        var allowRun = true,
            hasProp = lang.hasProp,
            falseProp = lang.falseProp,
            getOwn = lang.getOwn,
            useStrictRegExp = /['"]use strict['"];/g;
        prim.hideResolutionConflict = true;
        return function() {
          if (!allowRun) {
            return ;
          }
          allowRun = false;
          var layer,
              pluginBuilderRegExp = /(["']?)pluginBuilder(["']?)\s*[=\:]\s*["']([^'"\s]+)["']/,
              oldNewContext = require.s.newContext,
              oldDef,
              exports,
              module;
          require._cacheReset = function() {
            require._cachedRawText = {};
            require._cachedFileContents = {};
            require._cachedDefinesRequireUrls = {};
          };
          require._cacheReset();
          require._isSupportedBuildUrl = function(url) {
            if (url.indexOf("://") === -1 && url.indexOf("?") === -1 && url.indexOf('empty:') !== 0 && url.indexOf('//') !== 0) {
              return true;
            } else {
              if (!layer.ignoredUrls[url]) {
                if (url.indexOf('empty:') === -1) {
                  logger.info('Cannot optimize network URL, skipping: ' + url);
                }
                layer.ignoredUrls[url] = true;
              }
              return false;
            }
          };
          function normalizeUrlWithBase(context, moduleName, url) {
            if (require.jsExtRegExp.test(moduleName)) {
              url = (context.config.dir || context.config.dirBaseUrl) + url;
            }
            return url;
          }
          require.s.newContext = function(name) {
            var context = oldNewContext(name),
                oldEnable = context.enable,
                moduleProto = context.Module.prototype,
                oldInit = moduleProto.init,
                oldCallPlugin = moduleProto.callPlugin;
            if (name === '_') {
              context.nextTick = function(fn) {
                fn();
              };
              context.needFullExec = {};
              context.fullExec = {};
              context.plugins = {};
              context.buildShimExports = {};
              context.makeShimExports = function(value) {
                var fn;
                if (context.config.wrapShim) {
                  fn = function() {
                    var str = 'return ';
                    if (value.exports && value.exports.indexOf('.') === -1) {
                      str += 'root.' + value.exports + ' = ';
                    }
                    if (value.init) {
                      str += '(' + value.init.toString().replace(useStrictRegExp, '') + '.apply(this, arguments))';
                    }
                    if (value.init && value.exports) {
                      str += ' || ';
                    }
                    if (value.exports) {
                      str += value.exports;
                    }
                    str += ';';
                    return str;
                  };
                } else {
                  fn = function() {
                    return '(function (global) {\n' + '    return function () {\n' + '        var ret, fn;\n' + (value.init ? ('       fn = ' + value.init.toString().replace(useStrictRegExp, '') + ';\n' + '        ret = fn.apply(global, arguments);\n') : '') + (value.exports ? '        return ret || global.' + value.exports + ';\n' : '        return ret;\n') + '    };\n' + '}(this))';
                  };
                }
                return fn;
              };
              context.enable = function(depMap, parent) {
                var id = depMap.id,
                    parentId = parent && parent.map.id,
                    needFullExec = context.needFullExec,
                    fullExec = context.fullExec,
                    mod = getOwn(context.registry, id);
                if (mod && !mod.defined) {
                  if (parentId && getOwn(needFullExec, parentId)) {
                    needFullExec[id] = depMap;
                  }
                } else if ((getOwn(needFullExec, id) && falseProp(fullExec, id)) || (parentId && getOwn(needFullExec, parentId) && falseProp(fullExec, id))) {
                  context.require.undef(id);
                }
                return oldEnable.apply(context, arguments);
              };
              context.load = function(moduleName, url) {
                var contents,
                    pluginBuilderMatch,
                    builderName,
                    shim,
                    shimExports;
                if (url.indexOf('empty:') === 0) {
                  delete context.urlFetched[url];
                }
                if (require._isSupportedBuildUrl(url)) {
                  url = normalizeUrlWithBase(context, moduleName, url);
                  layer.buildPathMap[moduleName] = url;
                  layer.buildFileToModule[url] = moduleName;
                  if (hasProp(context.plugins, moduleName)) {
                    context.needFullExec[moduleName] = true;
                  }
                  prim().start(function() {
                    if (hasProp(require._cachedFileContents, url) && (falseProp(context.needFullExec, moduleName) || getOwn(context.fullExec, moduleName))) {
                      contents = require._cachedFileContents[url];
                      if (!layer.existingRequireUrl && require._cachedDefinesRequireUrls[url]) {
                        layer.existingRequireUrl = url;
                      }
                    } else {
                      return require._cacheReadAsync(url).then(function(text) {
                        contents = text;
                        if (context.config.cjsTranslate && (!context.config.shim || !lang.hasProp(context.config.shim, moduleName))) {
                          contents = commonJs.convert(url, contents);
                        }
                        if (context.config.onBuildRead) {
                          contents = context.config.onBuildRead(moduleName, url, contents);
                        }
                        contents = pragma.process(url, contents, context.config, 'OnExecute');
                        try {
                          if (!layer.existingRequireUrl && parse.definesRequire(url, contents)) {
                            layer.existingRequireUrl = url;
                            require._cachedDefinesRequireUrls[url] = true;
                          }
                        } catch (e1) {
                          throw new Error('Parse error using esprima ' + 'for file: ' + url + '\n' + e1);
                        }
                      }).then(function() {
                        if (hasProp(context.plugins, moduleName)) {
                          pluginBuilderMatch = pluginBuilderRegExp.exec(contents);
                          if (pluginBuilderMatch) {
                            builderName = context.makeModuleMap(pluginBuilderMatch[3], context.makeModuleMap(moduleName), null, true).id;
                            return require._cacheReadAsync(context.nameToUrl(builderName));
                          }
                        }
                        return contents;
                      }).then(function(text) {
                        contents = text;
                        try {
                          if (falseProp(context.needFullExec, moduleName)) {
                            contents = parse(moduleName, url, contents, {
                              insertNeedsDefine: true,
                              has: context.config.has,
                              findNestedDependencies: context.config.findNestedDependencies
                            });
                          }
                        } catch (e2) {
                          throw new Error('Parse error using esprima ' + 'for file: ' + url + '\n' + e2);
                        }
                        require._cachedFileContents[url] = contents;
                      });
                    }
                  }).then(function() {
                    if (contents) {
                      eval(contents);
                    }
                    try {
                      if (getOwn(context.needFullExec, moduleName)) {
                        shim = getOwn(context.config.shim, moduleName);
                        if (shim && shim.exports) {
                          shimExports = eval(shim.exports);
                          if (typeof shimExports !== 'undefined') {
                            context.buildShimExports[moduleName] = shimExports;
                          }
                        }
                      }
                      context.completeLoad(moduleName);
                    } catch (e) {
                      if (!e.moduleTree) {
                        e.moduleTree = [];
                      }
                      e.moduleTree.push(moduleName);
                      throw e;
                    }
                  }).then(null, function(eOuter) {
                    if (!eOuter.fileName) {
                      eOuter.fileName = url;
                    }
                    throw eOuter;
                  }).end();
                } else {
                  context.completeLoad(moduleName);
                }
              };
              context.execCb = function(name, cb, args, exports) {
                var buildShimExports = getOwn(layer.context.buildShimExports, name);
                if (buildShimExports) {
                  return buildShimExports;
                } else if (cb.__requireJsBuild || getOwn(layer.context.needFullExec, name)) {
                  return cb.apply(exports, args);
                }
                return undefined;
              };
              moduleProto.init = function(depMaps) {
                if (context.needFullExec[this.map.id]) {
                  lang.each(depMaps, lang.bind(this, function(depMap) {
                    if (typeof depMap === 'string') {
                      depMap = context.makeModuleMap(depMap, (this.map.isDefine ? this.map : this.map.parentMap));
                    }
                    if (!context.fullExec[depMap.id]) {
                      context.require.undef(depMap.id);
                    }
                  }));
                }
                return oldInit.apply(this, arguments);
              };
              moduleProto.callPlugin = function() {
                var map = this.map,
                    pluginMap = context.makeModuleMap(map.prefix),
                    pluginId = pluginMap.id,
                    pluginMod = getOwn(context.registry, pluginId);
                context.plugins[pluginId] = true;
                context.needFullExec[pluginId] = map;
                if (falseProp(context.fullExec, pluginId) && (!pluginMod || pluginMod.defined)) {
                  context.require.undef(pluginMap.id);
                }
                return oldCallPlugin.apply(this, arguments);
              };
            }
            return context;
          };
          delete require.s.contexts._;
          require._buildReset = function() {
            var oldContext = require.s.contexts._;
            delete require.s.contexts._;
            require({});
            layer = require._layer = {
              buildPathMap: {},
              buildFileToModule: {},
              buildFilePaths: [],
              pathAdded: {},
              modulesWithNames: {},
              needsDefine: {},
              existingRequireUrl: "",
              ignoredUrls: {},
              context: require.s.contexts._
            };
            return oldContext;
          };
          require._buildReset();
          oldDef = define;
          define = function(name) {
            if (typeof name === "string" && falseProp(layer.needsDefine, name)) {
              layer.modulesWithNames[name] = true;
            }
            return oldDef.apply(require, arguments);
          };
          define.amd = oldDef.amd;
          require._readFile = file.readFile;
          require._fileExists = function(path) {
            return file.exists(path);
          };
          require.onResourceLoad = function(context, map) {
            var id = map.id,
                url;
            if (context.plugins && lang.hasProp(context.plugins, id)) {
              lang.eachProp(context.needFullExec, function(value, prop) {
                if (value !== true && value.prefix === id && value.unnormalized) {
                  var map = context.makeModuleMap(value.originalName, value.parentMap);
                  context.needFullExec[map.id] = map;
                }
              });
            }
            if (context.needFullExec && getOwn(context.needFullExec, id)) {
              context.fullExec[id] = map;
            }
            if (map.prefix) {
              if (falseProp(layer.pathAdded, id)) {
                layer.buildFilePaths.push(id);
                layer.buildPathMap[id] = id;
                layer.buildFileToModule[id] = id;
                layer.modulesWithNames[id] = true;
                layer.pathAdded[id] = true;
              }
            } else if (map.url && require._isSupportedBuildUrl(map.url)) {
              url = normalizeUrlWithBase(context, id, map.url);
              if (!layer.pathAdded[url] && getOwn(layer.buildPathMap, id)) {
                layer.buildFilePaths.push(url);
                layer.pathAdded[url] = true;
              }
            }
          };
          require.needsDefine = function(moduleName) {
            layer.needsDefine[moduleName] = true;
          };
        };
      });
      define('commonJs', ['env!env/file', 'parse'], function(file, parse) {
        'use strict';
        var commonJs = {
          useLog: true,
          convertDir: function(commonJsPath, savePath) {
            var fileList,
                i,
                jsFileRegExp = /\.js$/,
                fileName,
                convertedFileName,
                fileContents;
            fileList = file.getFilteredFileList(commonJsPath, /\w/, true);
            commonJsPath = commonJsPath.replace(/\\/g, "/");
            savePath = savePath.replace(/\\/g, "/");
            if (commonJsPath.charAt(commonJsPath.length - 1) === "/") {
              commonJsPath = commonJsPath.substring(0, commonJsPath.length - 1);
            }
            if (savePath.charAt(savePath.length - 1) === "/") {
              savePath = savePath.substring(0, savePath.length - 1);
            }
            if (!fileList || !fileList.length) {
              if (commonJs.useLog) {
                if (commonJsPath === "convert") {
                  console.log('\n\n' + commonJs.convert(savePath, file.readFile(savePath)));
                } else {
                  console.log("No files to convert in directory: " + commonJsPath);
                }
              }
            } else {
              for (i = 0; i < fileList.length; i++) {
                fileName = fileList[i];
                convertedFileName = fileName.replace(commonJsPath, savePath);
                if (jsFileRegExp.test(fileName)) {
                  fileContents = file.readFile(fileName);
                  fileContents = commonJs.convert(fileName, fileContents);
                  file.saveUtf8File(convertedFileName, fileContents);
                } else {
                  file.copyFile(fileName, convertedFileName, true);
                }
              }
            }
          },
          convert: function(fileName, fileContents) {
            try {
              var preamble = '',
                  commonJsProps = parse.usesCommonJs(fileName, fileContents);
              if (parse.usesAmdOrRequireJs(fileName, fileContents) || !commonJsProps) {
                return fileContents;
              }
              if (commonJsProps.dirname || commonJsProps.filename) {
                preamble = 'var __filename = module.uri || "", ' + '__dirname = __filename.substring(0, __filename.lastIndexOf("/") + 1); ';
              }
              fileContents = 'define(function (require, exports, module) {' + preamble + fileContents + '\n});\n';
            } catch (e) {
              console.log("commonJs.convert: COULD NOT CONVERT: " + fileName + ", so skipping it. Error was: " + e);
              return fileContents;
            }
            return fileContents;
          }
        };
        return commonJs;
      });
      define('build', function(require) {
        'use strict';
        var build,
            lang = require("lang"),
            prim = require("prim"),
            logger = require("logger"),
            file = require("env!env/file"),
            parse = require("parse"),
            optimize = require("optimize"),
            pragma = require("pragma"),
            transform = require("transform"),
            requirePatch = require("requirePatch"),
            env = require("env"),
            commonJs = require("commonJs"),
            SourceMapGenerator = require("source-map/source-map-generator"),
            hasProp = lang.hasProp,
            getOwn = lang.getOwn,
            falseProp = lang.falseProp,
            endsWithSemiColonRegExp = /;\s*$/,
            endsWithSlashRegExp = /[\/\\]$/,
            resourceIsModuleIdRegExp = /^[\w\/\\\.]+$/;
        prim.nextTick = function(fn) {
          fn();
        };
        require = requirejs;
        require._cacheReadAsync = function(path, encoding) {
          var d;
          if (lang.hasProp(require._cachedRawText, path)) {
            d = prim();
            d.resolve(require._cachedRawText[path]);
            return d.promise;
          } else {
            return file.readFileAsync(path, encoding).then(function(text) {
              require._cachedRawText[path] = text;
              return text;
            });
          }
        };
        function makeBuildBaseConfig() {
          return {
            appDir: "",
            pragmas: {},
            paths: {},
            optimize: "uglify",
            optimizeCss: "standard.keepLines.keepWhitespace",
            inlineText: true,
            isBuild: true,
            optimizeAllPluginResources: false,
            findNestedDependencies: false,
            preserveLicenseComments: true,
            dirExclusionRegExp: file.dirExclusionRegExp,
            _buildPathToModuleIndex: {}
          };
        }
        function addSemiColon(text, config) {
          if (config.skipSemiColonInsertion || endsWithSemiColonRegExp.test(text)) {
            return text;
          } else {
            return text + ";";
          }
        }
        function endsWithSlash(dirName) {
          if (dirName.charAt(dirName.length - 1) !== "/") {
            dirName += "/";
          }
          return dirName;
        }
        function makeWriteFile(namespace, layer) {
          function writeFile(name, contents) {
            logger.trace('Saving plugin-optimized file: ' + name);
            file.saveUtf8File(name, contents);
          }
          writeFile.asModule = function(moduleName, fileName, contents) {
            writeFile(fileName, build.toTransport(namespace, moduleName, fileName, contents, layer));
          };
          return writeFile;
        }
        build = function(args) {
          var buildFile,
              cmdConfig,
              errorMsg,
              errorStack,
              stackMatch,
              errorTree,
              i,
              j,
              errorMod,
              stackRegExp = /( {4}at[^\n]+)\n/,
              standardIndent = '  ';
          return prim().start(function() {
            if (!args || lang.isArray(args)) {
              if (!args || args.length < 1) {
                logger.error("build.js buildProfile.js\n" + "where buildProfile.js is the name of the build file (see example.build.js for hints on how to make a build file).");
                return undefined;
              }
              if (args[0].indexOf("=") === -1) {
                buildFile = args[0];
                args.splice(0, 1);
              }
              cmdConfig = build.convertArrayToObject(args);
              cmdConfig.buildFile = buildFile;
            } else {
              cmdConfig = args;
            }
            return build._run(cmdConfig);
          }).then(null, function(e) {
            var err;
            errorMsg = e.toString();
            errorTree = e.moduleTree;
            stackMatch = stackRegExp.exec(errorMsg);
            if (stackMatch) {
              errorMsg += errorMsg.substring(0, stackMatch.index + stackMatch[0].length + 1);
            }
            if (errorTree && errorTree.length > 0) {
              errorMsg += '\nIn module tree:\n';
              for (i = errorTree.length - 1; i > -1; i--) {
                errorMod = errorTree[i];
                if (errorMod) {
                  for (j = errorTree.length - i; j > -1; j--) {
                    errorMsg += standardIndent;
                  }
                  errorMsg += errorMod + '\n';
                }
              }
              logger.error(errorMsg);
            }
            errorStack = e.stack;
            if (typeof args === 'string' && args.indexOf('stacktrace=true') !== -1) {
              errorMsg += '\n' + errorStack;
            } else {
              if (!stackMatch && errorStack) {
                stackMatch = stackRegExp.exec(errorStack);
                if (stackMatch) {
                  errorMsg += '\n' + stackMatch[0] || '';
                }
              }
            }
            err = new Error(errorMsg);
            err.originalError = e;
            throw err;
          });
        };
        build._run = function(cmdConfig) {
          var buildPaths,
              fileName,
              fileNames,
              paths,
              i,
              baseConfig,
              config,
              modules,
              srcPath,
              buildContext,
              destPath,
              moduleMap,
              parentModuleMap,
              context,
              resources,
              resource,
              plugin,
              fileContents,
              pluginProcessed = {},
              buildFileContents = "",
              pluginCollector = {};
          return prim().start(function() {
            var prop;
            requirePatch();
            config = build.createConfig(cmdConfig);
            paths = config.paths;
            if (config.dir && !config.keepBuildDir && file.exists(config.dir)) {
              file.deleteFile(config.dir);
            }
            if (!config.out && !config.cssIn) {
              file.copyDir((config.appDir || config.baseUrl), config.dir, /\w/, true);
              buildPaths = {};
              if (config.appDir) {
                for (prop in paths) {
                  if (hasProp(paths, prop)) {
                    buildPaths[prop] = paths[prop].replace(config.appDir, config.dir);
                  }
                }
              } else {
                for (prop in paths) {
                  if (hasProp(paths, prop)) {
                    if (paths[prop].indexOf(config.baseUrl) === 0) {
                      buildPaths[prop] = paths[prop].replace(config.baseUrl, config.dirBaseUrl);
                    } else {
                      buildPaths[prop] = paths[prop] === 'empty:' ? 'empty:' : prop;
                      srcPath = paths[prop];
                      if (srcPath.indexOf('/') !== 0 && srcPath.indexOf(':') === -1) {
                        srcPath = config.baseUrl + srcPath;
                      }
                      destPath = config.dirBaseUrl + buildPaths[prop];
                      if (srcPath !== 'empty:') {
                        if (file.exists(srcPath) && file.isDirectory(srcPath)) {
                          file.copyDir(srcPath, destPath, /\w/, true);
                        } else {
                          srcPath += '.js';
                          destPath += '.js';
                          file.copyFile(srcPath, destPath);
                        }
                      }
                    }
                  }
                }
              }
            }
            require({
              baseUrl: config.baseUrl,
              paths: paths,
              packagePaths: config.packagePaths,
              packages: config.packages
            });
            buildContext = require.s.contexts._;
            modules = config.modules;
            if (modules) {
              modules.forEach(function(module) {
                if (module.name) {
                  module._sourcePath = buildContext.nameToUrl(module.name);
                  if (!file.exists(module._sourcePath) && !module.create && module.name.indexOf('!') === -1 && (!config.rawText || !lang.hasProp(config.rawText, module.name))) {
                    throw new Error("ERROR: module path does not exist: " + module._sourcePath + " for module named: " + module.name + ". Path is relative to: " + file.absPath('.'));
                  }
                }
              });
            }
            if (config.out) {
              require(config);
              if (!config.cssIn) {
                config.modules[0]._buildPath = typeof config.out === 'function' ? 'FUNCTION' : config.out;
              }
            } else if (!config.cssIn) {
              baseConfig = {
                baseUrl: config.dirBaseUrl,
                paths: buildPaths
              };
              lang.mixin(baseConfig, config);
              require(baseConfig);
              if (modules) {
                modules.forEach(function(module) {
                  if (module.name) {
                    module._buildPath = buildContext.nameToUrl(module.name, null);
                    if (module._buildPath === module._sourcePath) {
                      throw new Error('Module ID \'' + module.name + '\' has a source path that is same as output path: ' + module._sourcePath + '. Stopping, config is malformed.');
                    }
                    if (!module.create) {
                      file.copyFile(module._sourcePath, module._buildPath);
                    }
                  }
                });
              }
            }
            if (config.optimizeCss && config.optimizeCss !== "none" && config.dir) {
              buildFileContents += optimize.css(config.dir, config);
            }
          }).then(function() {
            baseConfig = lang.deeplikeCopy(require.s.contexts._.config);
          }).then(function() {
            var actions = [];
            if (modules) {
              actions = modules.map(function(module, i) {
                return function() {
                  config._buildPathToModuleIndex[file.normalize(module._buildPath)] = i;
                  return build.traceDependencies(module, config, baseConfig).then(function(layer) {
                    module.layer = layer;
                  });
                };
              });
              return prim.serial(actions);
            }
          }).then(function() {
            var actions;
            if (modules) {
              actions = modules.map(function(module) {
                return function() {
                  if (module.exclude) {
                    module.excludeLayers = [];
                    return prim.serial(module.exclude.map(function(exclude, i) {
                      return function() {
                        var found = build.findBuildModule(exclude, modules);
                        if (found) {
                          module.excludeLayers[i] = found;
                        } else {
                          return build.traceDependencies({name: exclude}, config, baseConfig).then(function(layer) {
                            module.excludeLayers[i] = {layer: layer};
                          });
                        }
                      };
                    }));
                  }
                };
              });
              return prim.serial(actions);
            }
          }).then(function() {
            if (modules) {
              return prim.serial(modules.map(function(module) {
                return function() {
                  if (module.exclude) {
                    module.exclude.forEach(function(excludeModule, i) {
                      var excludeLayer = module.excludeLayers[i].layer,
                          map = excludeLayer.buildFileToModule;
                      excludeLayer.buildFilePaths.forEach(function(filePath) {
                        build.removeModulePath(map[filePath], filePath, module.layer);
                      });
                    });
                  }
                  if (module.excludeShallow) {
                    module.excludeShallow.forEach(function(excludeShallowModule) {
                      var path = getOwn(module.layer.buildPathMap, excludeShallowModule);
                      if (path) {
                        build.removeModulePath(excludeShallowModule, path, module.layer);
                      }
                    });
                  }
                  return build.flattenModule(module, module.layer, config).then(function(builtModule) {
                    var finalText,
                        baseName;
                    if (module._buildPath === 'FUNCTION') {
                      module._buildText = builtModule.text;
                      module._buildSourceMap = builtModule.sourceMap;
                    } else {
                      finalText = builtModule.text;
                      if (builtModule.sourceMap) {
                        baseName = module._buildPath.split('/');
                        baseName = baseName.pop();
                        finalText += '\n//# sourceMappingURL=' + baseName + '.map';
                        file.saveUtf8File(module._buildPath + '.map', builtModule.sourceMap);
                      }
                      file.saveUtf8File(module._buildPath + '-temp', finalText);
                    }
                    buildFileContents += builtModule.buildText;
                  });
                };
              }));
            }
          }).then(function() {
            var moduleName,
                outOrigSourceMap;
            if (modules) {
              modules.forEach(function(module) {
                var finalPath = module._buildPath;
                if (finalPath !== 'FUNCTION') {
                  if (file.exists(finalPath)) {
                    file.deleteFile(finalPath);
                  }
                  file.renameFile(finalPath + '-temp', finalPath);
                  if (config.removeCombined && !config.out) {
                    module.layer.buildFilePaths.forEach(function(path) {
                      var isLayer = modules.some(function(mod) {
                        return mod._buildPath === path;
                      }),
                          relPath = build.makeRelativeFilePath(config.dir, path);
                      if (file.exists(path) && !isLayer && relPath.indexOf('..') !== 0) {
                        file.deleteFile(path);
                      }
                    });
                  }
                }
                if (config.onModuleBundleComplete) {
                  config.onModuleBundleComplete(module.onCompleteData);
                }
              });
            }
            if (config.removeCombined && !config.out && config.dir) {
              file.deleteEmptyDirs(config.dir);
            }
            if (config.out && !config.cssIn) {
              fileName = config.modules[0]._buildPath;
              if (fileName === 'FUNCTION') {
                outOrigSourceMap = config.modules[0]._buildSourceMap;
                config._buildSourceMap = outOrigSourceMap;
                config.modules[0]._buildText = optimize.js((config.modules[0].name || config.modules[0].include[0] || fileName) + '.build.js', config.modules[0]._buildText, null, config);
                if (config._buildSourceMap && config._buildSourceMap !== outOrigSourceMap) {
                  config.modules[0]._buildSourceMap = config._buildSourceMap;
                  config._buildSourceMap = null;
                }
              } else {
                optimize.jsFile(fileName, null, fileName, config);
              }
            } else if (!config.cssIn) {
              fileNames = file.getFilteredFileList(config.dir, /\.js$/, true);
              fileNames.forEach(function(fileName) {
                var cfg,
                    override,
                    moduleIndex;
                moduleName = fileName.replace(config.dir, '');
                moduleName = moduleName.substring(0, moduleName.length - 3);
                moduleIndex = getOwn(config._buildPathToModuleIndex, fileName);
                moduleIndex = moduleIndex === 0 || moduleIndex > 0 ? moduleIndex : -1;
                if (moduleIndex > -1 || !config.skipDirOptimize || config.normalizeDirDefines === "all" || config.cjsTranslate) {
                  fileContents = file.readFile(fileName);
                  if (config.cjsTranslate && (!config.shim || !lang.hasProp(config.shim, moduleName))) {
                    fileContents = commonJs.convert(fileName, fileContents);
                  }
                  if (moduleIndex === -1) {
                    if (config.onBuildRead) {
                      fileContents = config.onBuildRead(moduleName, fileName, fileContents);
                    }
                    if (config.normalizeDirDefines === "all") {
                      fileContents = build.toTransport(config.namespace, null, fileName, fileContents);
                    }
                    if (config.onBuildWrite) {
                      fileContents = config.onBuildWrite(moduleName, fileName, fileContents);
                    }
                  }
                  override = moduleIndex > -1 ? config.modules[moduleIndex].override : null;
                  if (override) {
                    cfg = build.createOverrideConfig(config, override);
                  } else {
                    cfg = config;
                  }
                  if (moduleIndex > -1 || !config.skipDirOptimize) {
                    optimize.jsFile(fileName, fileContents, fileName, cfg, pluginCollector);
                  }
                }
              });
              context = require.s.contexts._;
              for (moduleName in pluginCollector) {
                if (hasProp(pluginCollector, moduleName)) {
                  parentModuleMap = context.makeModuleMap(moduleName);
                  resources = pluginCollector[moduleName];
                  for (i = 0; i < resources.length; i++) {
                    resource = resources[i];
                    moduleMap = context.makeModuleMap(resource, parentModuleMap);
                    if (falseProp(context.plugins, moduleMap.prefix)) {
                      context.plugins[moduleMap.prefix] = true;
                      if (!file.exists(require.toUrl(moduleMap.prefix + '.js'))) {
                        continue;
                      }
                      context.require([moduleMap.prefix]);
                      moduleMap = context.makeModuleMap(resource, parentModuleMap);
                    }
                    if (falseProp(pluginProcessed, moduleMap.id)) {
                      plugin = getOwn(context.defined, moduleMap.prefix);
                      if (plugin && plugin.writeFile) {
                        plugin.writeFile(moduleMap.prefix, moduleMap.name, require, makeWriteFile(config.namespace), context.config);
                      }
                      pluginProcessed[moduleMap.id] = true;
                    }
                  }
                }
              }
              file.saveUtf8File(config.dir + "build.txt", buildFileContents);
            }
            if (config.cssIn) {
              buildFileContents += optimize.cssFile(config.cssIn, config.out, config).buildText;
            }
            if (typeof config.out === 'function') {
              config.out(config.modules[0]._buildText, config.modules[0]._buildSourceMap);
            }
            if (buildFileContents) {
              logger.info(buildFileContents);
              return buildFileContents;
            }
            return '';
          });
        };
        function stringDotToObj(result, name, value) {
          var parts = name.split('.');
          parts.forEach(function(prop, i) {
            if (i === parts.length - 1) {
              result[prop] = value;
            } else {
              if (falseProp(result, prop)) {
                result[prop] = {};
              }
              result = result[prop];
            }
          });
        }
        build.objProps = {
          paths: true,
          wrap: true,
          pragmas: true,
          pragmasOnSave: true,
          has: true,
          hasOnSave: true,
          uglify: true,
          uglify2: true,
          closure: true,
          map: true,
          throwWhen: true
        };
        build.hasDotPropMatch = function(prop) {
          var dotProp,
              index = prop.indexOf('.');
          if (index !== -1) {
            dotProp = prop.substring(0, index);
            return hasProp(build.objProps, dotProp);
          }
          return false;
        };
        build.convertArrayToObject = function(ary) {
          var result = {},
              i,
              separatorIndex,
              prop,
              value,
              needArray = {
                "include": true,
                "exclude": true,
                "excludeShallow": true,
                "insertRequire": true,
                "stubModules": true,
                "deps": true,
                "mainConfigFile": true
              };
          for (i = 0; i < ary.length; i++) {
            separatorIndex = ary[i].indexOf("=");
            if (separatorIndex === -1) {
              throw "Malformed name/value pair: [" + ary[i] + "]. Format should be name=value";
            }
            value = ary[i].substring(separatorIndex + 1, ary[i].length);
            if (value === "true") {
              value = true;
            } else if (value === "false") {
              value = false;
            }
            prop = ary[i].substring(0, separatorIndex);
            if (getOwn(needArray, prop)) {
              value = value.split(",");
            }
            if (build.hasDotPropMatch(prop)) {
              stringDotToObj(result, prop, value);
            } else {
              result[prop] = value;
            }
          }
          return result;
        };
        build.makeAbsPath = function(path, absFilePath) {
          if (!absFilePath) {
            return path;
          }
          if (path.indexOf('/') !== 0 && path.indexOf(':') === -1) {
            path = absFilePath + (absFilePath.charAt(absFilePath.length - 1) === '/' ? '' : '/') + path;
            path = file.normalize(path);
          }
          return path.replace(lang.backSlashRegExp, '/');
        };
        build.makeAbsObject = function(props, obj, absFilePath) {
          var i,
              prop;
          if (obj) {
            for (i = 0; i < props.length; i++) {
              prop = props[i];
              if (hasProp(obj, prop) && typeof obj[prop] === 'string') {
                obj[prop] = build.makeAbsPath(obj[prop], absFilePath);
              }
            }
          }
        };
        build.makeAbsConfig = function(config, absFilePath) {
          var props,
              prop,
              i;
          props = ["appDir", "dir", "baseUrl"];
          for (i = 0; i < props.length; i++) {
            prop = props[i];
            if (getOwn(config, prop)) {
              if (prop === "baseUrl") {
                config.originalBaseUrl = config.baseUrl;
                if (config.appDir) {
                  config.baseUrl = build.makeAbsPath(config.originalBaseUrl, config.appDir);
                } else {
                  config.baseUrl = build.makeAbsPath(config[prop], absFilePath);
                }
              } else {
                config[prop] = build.makeAbsPath(config[prop], absFilePath);
              }
              config[prop] = endsWithSlash(config[prop]);
            }
          }
          build.makeAbsObject((config.out === "stdout" ? ["cssIn"] : ["out", "cssIn"]), config, absFilePath);
          build.makeAbsObject(["startFile", "endFile"], config.wrap, absFilePath);
        };
        build.makeRelativeFilePath = function(refPath, targetPath) {
          var i,
              dotLength,
              finalParts,
              length,
              targetParts,
              targetName,
              refParts = refPath.split('/'),
              hasEndSlash = endsWithSlashRegExp.test(targetPath),
              dotParts = [];
          targetPath = file.normalize(targetPath);
          if (hasEndSlash && !endsWithSlashRegExp.test(targetPath)) {
            targetPath += '/';
          }
          targetParts = targetPath.split('/');
          targetName = targetParts.pop();
          refParts.pop();
          length = refParts.length;
          for (i = 0; i < length; i += 1) {
            if (refParts[i] !== targetParts[i]) {
              break;
            }
          }
          finalParts = targetParts.slice(i);
          dotLength = length - i;
          for (i = 0; i > -1 && i < dotLength; i += 1) {
            dotParts.push('..');
          }
          return dotParts.join('/') + (dotParts.length ? '/' : '') + finalParts.join('/') + (finalParts.length ? '/' : '') + targetName;
        };
        build.nestedMix = {
          paths: true,
          has: true,
          hasOnSave: true,
          pragmas: true,
          pragmasOnSave: true
        };
        function mixConfig(target, source, skipArrays) {
          var prop,
              value,
              isArray,
              targetValue;
          for (prop in source) {
            if (hasProp(source, prop)) {
              value = source[prop];
              isArray = lang.isArray(value);
              if (typeof value === 'object' && value && !isArray && !lang.isFunction(value) && !lang.isRegExp(value)) {
                if (prop === 'map') {
                  if (!target.map) {
                    target.map = {};
                  }
                  lang.deepMix(target.map, source.map);
                } else {
                  target[prop] = lang.mixin({}, target[prop], value, true);
                }
              } else if (isArray) {
                if (!skipArrays) {
                  targetValue = target[prop];
                  if (lang.isArray(targetValue)) {
                    target[prop] = targetValue.concat(value);
                  } else {
                    target[prop] = value;
                  }
                }
              } else {
                target[prop] = value;
              }
            }
          }
          if (lang.hasProp(target, 'logLevel')) {
            logger.logLevel(target.logLevel);
          }
        }
        function flattenWrapFile(wrap, keyName, absFilePath) {
          var keyFileName = keyName + 'File';
          if (typeof wrap[keyName] !== 'string' && wrap[keyFileName]) {
            wrap[keyName] = '';
            if (typeof wrap[keyFileName] === 'string') {
              wrap[keyFileName] = [wrap[keyFileName]];
            }
            wrap[keyFileName].forEach(function(fileName) {
              wrap[keyName] += (wrap[keyName] ? '\n' : '') + file.readFile(build.makeAbsPath(fileName, absFilePath));
            });
          } else if (wrap[keyName] === null || wrap[keyName] === undefined) {
            wrap[keyName] = '';
          } else if (typeof wrap[keyName] !== 'string') {
            throw new Error('wrap.' + keyName + ' or wrap.' + keyFileName + ' malformed');
          }
        }
        function normalizeWrapConfig(config, absFilePath) {
          try {
            if (config.wrap) {
              if (config.wrap === true) {
                config.wrap = {
                  start: '(function () {',
                  end: '}());'
                };
              } else {
                flattenWrapFile(config.wrap, 'start', absFilePath);
                flattenWrapFile(config.wrap, 'end', absFilePath);
              }
            }
          } catch (wrapError) {
            throw new Error('Malformed wrap config: ' + wrapError.toString());
          }
        }
        build.createConfig = function(cfg) {
          var buildFileContents,
              buildFileConfig,
              mainConfig,
              mainConfigFile,
              mainConfigPath,
              buildFile,
              absFilePath,
              config = {},
              buildBaseConfig = makeBuildBaseConfig();
          absFilePath = file.absPath('.');
          build.makeAbsConfig(cfg, absFilePath);
          build.makeAbsConfig(buildBaseConfig, absFilePath);
          lang.mixin(config, buildBaseConfig);
          lang.mixin(config, cfg, true);
          if (lang.hasProp(config, 'logLevel')) {
            logger.logLevel(config.logLevel);
          }
          if (config.buildFile) {
            buildFile = file.absPath(config.buildFile);
            if (!file.exists(buildFile)) {
              throw new Error("ERROR: build file does not exist: " + buildFile);
            }
            absFilePath = config.baseUrl = file.absPath(file.parent(buildFile));
            buildFileContents = file.readFile(buildFile);
            try {
              buildFileContents = buildFileContents.replace(/\/\/\#[^\n\r]+[\n\r]*$/, '').trim().replace(/;$/, '');
              buildFileConfig = eval("(" + buildFileContents + ")");
              build.makeAbsConfig(buildFileConfig, absFilePath);
              mixConfig(config, buildFileConfig);
            } catch (e) {
              throw new Error("Build file " + buildFile + " is malformed: " + e);
            }
          }
          mainConfigFile = config.mainConfigFile || (buildFileConfig && buildFileConfig.mainConfigFile);
          if (mainConfigFile) {
            if (typeof mainConfigFile === 'string') {
              mainConfigFile = [mainConfigFile];
            }
            mainConfigFile.forEach(function(configFile) {
              configFile = build.makeAbsPath(configFile, absFilePath);
              if (!file.exists(configFile)) {
                throw new Error(configFile + ' does not exist.');
              }
              try {
                mainConfig = parse.findConfig(file.readFile(configFile)).config;
              } catch (configError) {
                throw new Error('The config in mainConfigFile ' + configFile + ' cannot be used because it cannot be evaluated' + ' correctly while running in the optimizer. Try only' + ' using a config that is also valid JSON, or do not use' + ' mainConfigFile and instead copy the config values needed' + ' into a build file or command line arguments given to the optimizer.\n' + 'Source error from parsing: ' + configFile + ': ' + configError);
              }
              if (mainConfig) {
                mainConfigPath = configFile.substring(0, configFile.lastIndexOf('/'));
                if (config.appDir && !mainConfig.appDir) {
                  mainConfig.appDir = config.appDir;
                }
                if (!mainConfig.baseUrl) {
                  mainConfig.baseUrl = mainConfigPath;
                }
                build.makeAbsConfig(mainConfig, mainConfigPath);
                mixConfig(config, mainConfig);
              }
            });
          }
          if (buildFileConfig) {
            mixConfig(config, buildFileConfig, true);
          }
          mixConfig(config, cfg, true);
          lang.eachProp(config.paths, function(value, prop) {
            if (lang.isArray(value)) {
              throw new Error('paths fallback not supported in optimizer. ' + 'Please provide a build config path override ' + 'for ' + prop);
            }
            config.paths[prop] = build.makeAbsPath(value, config.baseUrl);
          });
          if (hasProp(config, "baseUrl")) {
            if (config.appDir) {
              if (!config.originalBaseUrl) {
                throw new Error('Please set a baseUrl in the build config');
              }
              config.dirBaseUrl = build.makeAbsPath(config.originalBaseUrl, config.dir);
            } else {
              config.dirBaseUrl = config.dir || config.baseUrl;
            }
            config.dirBaseUrl = endsWithSlash(config.dirBaseUrl);
          }
          if (config.out && config.out === 'stdout') {
            config.out = function(content) {
              var e = env.get();
              if (e === 'rhino') {
                var out = new java.io.PrintStream(java.lang.System.out, true, 'UTF-8');
                out.println(content);
              } else if (e === 'node') {
                process.stdout.setEncoding('utf8');
                process.stdout.write(content);
              } else {
                console.log(content);
              }
            };
          }
          if (config.main) {
            throw new Error('"main" passed as an option, but the ' + 'supported option is called "name".');
          }
          if (config.out && !config.name && !config.modules && !config.include && !config.cssIn) {
            throw new Error('Missing either a "name", "include" or "modules" ' + 'option');
          }
          if (config.cssIn) {
            if (config.dir || config.appDir) {
              throw new Error('cssIn is only for the output of single file ' + 'CSS optimizations and is not compatible with "dir" or "appDir" configuration.');
            }
            if (!config.out) {
              throw new Error('"out" option missing.');
            }
          }
          if (!config.cssIn && !config.baseUrl) {
            config.baseUrl = './';
          }
          if (!config.out && !config.dir) {
            throw new Error('Missing either an "out" or "dir" config value. ' + 'If using "appDir" for a full project optimization, ' + 'use "dir". If you want to optimize to one file, ' + 'use "out".');
          }
          if (config.appDir && config.out) {
            throw new Error('"appDir" is not compatible with "out". Use "dir" ' + 'instead. appDir is used to copy whole projects, ' + 'where "out" with "baseUrl" is used to just ' + 'optimize to one file.');
          }
          if (config.out && config.dir) {
            throw new Error('The "out" and "dir" options are incompatible.' + ' Use "out" if you are targeting a single file' + ' for optimization, and "dir" if you want the appDir' + ' or baseUrl directories optimized.');
          }
          if (config.dir) {
            if (!config.allowSourceOverwrites && (config.dir === config.baseUrl || config.dir === config.appDir || (config.baseUrl && build.makeRelativeFilePath(config.dir, config.baseUrl).indexOf('..') !== 0) || (config.appDir && build.makeRelativeFilePath(config.dir, config.appDir).indexOf('..') !== 0))) {
              throw new Error('"dir" is set to a parent or same directory as' + ' "appDir" or "baseUrl". This can result in' + ' the deletion of source code. Stopping. If' + ' you want to allow possible overwriting of' + ' source code, set "allowSourceOverwrites"' + ' to true in the build config, but do so at' + ' your own risk. In that case, you may want' + ' to also set "keepBuildDir" to true.');
            }
          }
          if (config.insertRequire && !lang.isArray(config.insertRequire)) {
            throw new Error('insertRequire should be a list of module IDs' + ' to insert in to a require([]) call.');
          }
          if (config.generateSourceMaps) {
            if (config.preserveLicenseComments && config.optimize !== 'none') {
              throw new Error('Cannot use preserveLicenseComments and ' + 'generateSourceMaps together. Either explcitly set ' + 'preserveLicenseComments to false (default is true) or ' + 'turn off generateSourceMaps. If you want source maps with ' + 'license comments, see: ' + 'http://requirejs.org/docs/errors.html#sourcemapcomments');
            } else if (config.optimize !== 'none' && config.optimize !== 'closure' && config.optimize !== 'uglify2') {
              throw new Error('optimize: "' + config.optimize + '" does not support generateSourceMaps.');
            }
          }
          if ((config.name || config.include) && !config.modules) {
            config.modules = [{
              name: config.name,
              out: config.out,
              create: config.create,
              include: config.include,
              exclude: config.exclude,
              excludeShallow: config.excludeShallow,
              insertRequire: config.insertRequire,
              stubModules: config.stubModules
            }];
            delete config.stubModules;
          } else if (config.modules && config.out) {
            throw new Error('If the "modules" option is used, then there ' + 'should be a "dir" option set and "out" should ' + 'not be used since "out" is only for single file ' + 'optimization output.');
          } else if (config.modules && config.name) {
            throw new Error('"name" and "modules" options are incompatible. ' + 'Either use "name" if doing a single file ' + 'optimization, or "modules" if you want to target ' + 'more than one file for optimization.');
          }
          if (config.out && !config.cssIn) {
            if (!cfg.optimizeCss) {
              config.optimizeCss = "none";
            }
          }
          if (config.cssPrefix) {
            config.cssPrefix = endsWithSlash(config.cssPrefix);
          } else {
            config.cssPrefix = '';
          }
          if (config.modules && config.modules.length) {
            config.modules.forEach(function(mod) {
              if (config.stubModules) {
                mod.stubModules = config.stubModules.concat(mod.stubModules || []);
              }
              if (mod.stubModules) {
                mod.stubModules._byName = {};
                mod.stubModules.forEach(function(id) {
                  mod.stubModules._byName[id] = true;
                });
              }
              if (typeof mod.include === 'string') {
                mod.include = [mod.include];
              }
              if (mod.override) {
                normalizeWrapConfig(mod.override, absFilePath);
              }
            });
          }
          normalizeWrapConfig(config, absFilePath);
          if (config.context) {
            throw new Error('The build argument "context" is not supported' + ' in a build. It should only be used in web' + ' pages.');
          }
          if (!hasProp(config, 'normalizeDirDefines')) {
            if (config.optimize === 'none' || config.skipDirOptimize) {
              config.normalizeDirDefines = 'skip';
            } else {
              config.normalizeDirDefines = 'all';
            }
          }
          if (hasProp(config, 'fileExclusionRegExp')) {
            if (typeof config.fileExclusionRegExp === "string") {
              file.exclusionRegExp = new RegExp(config.fileExclusionRegExp);
            } else {
              file.exclusionRegExp = config.fileExclusionRegExp;
            }
          } else if (hasProp(config, 'dirExclusionRegExp')) {
            file.exclusionRegExp = config.dirExclusionRegExp;
          }
          if (config.deps) {
            config._depsInclude = config.deps;
          }
          delete config.deps;
          delete config.jQuery;
          delete config.enforceDefine;
          delete config.urlArgs;
          return config;
        };
        build.findBuildModule = function(moduleName, modules) {
          var i,
              module;
          for (i = 0; i < modules.length; i++) {
            module = modules[i];
            if (module.name === moduleName) {
              return module;
            }
          }
          return null;
        };
        build.removeModulePath = function(module, path, layer) {
          var index = layer.buildFilePaths.indexOf(path);
          if (index !== -1) {
            layer.buildFilePaths.splice(index, 1);
          }
        };
        build.traceDependencies = function(module, config, baseLoaderConfig) {
          var include,
              override,
              layer,
              context,
              oldContext,
              rawTextByIds,
              syncChecks = {
                rhino: true,
                node: true,
                xpconnect: true
              },
              deferred = prim();
          oldContext = require._buildReset();
          layer = require._layer;
          context = layer.context;
          if (baseLoaderConfig) {
            require(lang.deeplikeCopy(baseLoaderConfig));
          }
          logger.trace("\nTracing dependencies for: " + (module.name || (typeof module.out === 'function' ? 'FUNCTION' : module.out)));
          include = config._depsInclude || [];
          include = include.concat(module.name && !module.create ? [module.name] : []);
          if (module.include) {
            include = include.concat(module.include);
          }
          if (module.override) {
            if (baseLoaderConfig) {
              override = build.createOverrideConfig(baseLoaderConfig, module.override);
            } else {
              override = lang.deeplikeCopy(module.override);
            }
            require(override);
          }
          rawTextByIds = require.s.contexts._.config.rawText;
          if (rawTextByIds) {
            lang.eachProp(rawTextByIds, function(contents, id) {
              var url = require.toUrl(id) + '.js';
              require._cachedRawText[url] = contents;
            });
          }
          deferred.reject.__requireJsBuild = true;
          function includeFinished(value) {
            var hasError = false;
            if (syncChecks[env.get()]) {
              try {
                build.checkForErrors(context);
              } catch (e) {
                hasError = true;
                deferred.reject(e);
              }
            }
            if (!hasError) {
              deferred.resolve(value);
            }
          }
          includeFinished.__requireJsBuild = true;
          require(include, includeFinished, deferred.reject);
          if (syncChecks[env.get()]) {
            build.checkForErrors(context);
          }
          return deferred.promise.then(function() {
            if (module.override && baseLoaderConfig) {
              require(lang.deeplikeCopy(baseLoaderConfig));
            }
            build.checkForErrors(context);
            return layer;
          });
        };
        build.checkForErrors = function(context) {
          var id,
              prop,
              mod,
              idParts,
              pluginId,
              pluginResources,
              errMessage = '',
              failedPluginMap = {},
              failedPluginIds = [],
              errIds = [],
              errUrlMap = {},
              errUrlConflicts = {},
              hasErrUrl = false,
              hasUndefined = false,
              defined = context.defined,
              registry = context.registry;
          function populateErrUrlMap(id, errUrl, skipNew) {
            if (!errUrl) {
              return ;
            }
            if (!skipNew) {
              errIds.push(id);
            }
            if (errUrlMap[errUrl]) {
              hasErrUrl = true;
              if (!errUrlConflicts[errUrl]) {
                errUrlConflicts[errUrl] = [];
                errUrlConflicts[errUrl].push(errUrlMap[errUrl]);
              }
              errUrlConflicts[errUrl].push(id);
            } else if (!skipNew) {
              errUrlMap[errUrl] = id;
            }
          }
          for (id in registry) {
            if (hasProp(registry, id) && id.indexOf('_@r') !== 0) {
              hasUndefined = true;
              mod = getOwn(registry, id);
              idParts = id.split('!');
              pluginId = idParts[0];
              if (id.indexOf('_unnormalized') === -1 && mod && mod.enabled) {
                populateErrUrlMap(id, mod.map.url);
              }
              if (idParts.length > 1) {
                if (falseProp(failedPluginMap, pluginId)) {
                  failedPluginIds.push(pluginId);
                }
                pluginResources = failedPluginMap[pluginId];
                if (!pluginResources) {
                  pluginResources = failedPluginMap[pluginId] = [];
                }
                pluginResources.push(id + (mod.error ? ': ' + mod.error : ''));
              }
            }
          }
          if (hasUndefined) {
            for (id in defined) {
              if (hasProp(defined, id) && id.indexOf('!') === -1) {
                populateErrUrlMap(id, require.toUrl(id) + '.js', true);
              }
            }
          }
          if (errIds.length || failedPluginIds.length) {
            if (failedPluginIds.length) {
              errMessage += 'Loader plugin' + (failedPluginIds.length === 1 ? '' : 's') + ' did not call ' + 'the load callback in the build:\n' + failedPluginIds.map(function(pluginId) {
                var pluginResources = failedPluginMap[pluginId];
                return pluginId + ':\n  ' + pluginResources.join('\n  ');
              }).join('\n') + '\n';
            }
            errMessage += 'Module loading did not complete for: ' + errIds.join(', ');
            if (hasErrUrl) {
              errMessage += '\nThe following modules share the same URL. This ' + 'could be a misconfiguration if that URL only has ' + 'one anonymous module in it:';
              for (prop in errUrlConflicts) {
                if (hasProp(errUrlConflicts, prop)) {
                  errMessage += '\n' + prop + ': ' + errUrlConflicts[prop].join(', ');
                }
              }
            }
            throw new Error(errMessage);
          }
        };
        build.createOverrideConfig = function(config, override) {
          var cfg = lang.deeplikeCopy(config),
              oride = lang.deeplikeCopy(override);
          lang.eachProp(oride, function(value, prop) {
            if (hasProp(build.objProps, prop)) {
              cfg[prop] = {};
              lang.mixin(cfg[prop], config[prop], true);
              lang.mixin(cfg[prop], override[prop], true);
            } else {
              cfg[prop] = override[prop];
            }
          });
          return cfg;
        };
        build.flattenModule = function(module, layer, config) {
          var fileContents,
              sourceMapGenerator,
              sourceMapBase,
              buildFileContents = '';
          return prim().start(function() {
            var reqIndex,
                currContents,
                fileForSourceMap,
                moduleName,
                shim,
                packageName,
                parts,
                builder,
                writeApi,
                namespace,
                namespaceWithDot,
                stubModulesByName,
                context = layer.context,
                onLayerEnds = [],
                onLayerEndAdded = {},
                pkgsMainMap = {};
            if (module.override) {
              config = build.createOverrideConfig(config, module.override);
            }
            namespace = config.namespace || '';
            namespaceWithDot = namespace ? namespace + '.' : '';
            stubModulesByName = (module.stubModules && module.stubModules._byName) || {};
            module.onCompleteData = {
              name: module.name,
              path: (config.dir ? module._buildPath.replace(config.dir, "") : module._buildPath),
              included: []
            };
            buildFileContents += "\n" + module.onCompleteData.path + "\n----------------\n";
            if (layer.existingRequireUrl) {
              reqIndex = layer.buildFilePaths.indexOf(layer.existingRequireUrl);
              if (reqIndex !== -1) {
                layer.buildFilePaths.splice(reqIndex, 1);
                layer.buildFilePaths.unshift(layer.existingRequireUrl);
              }
            }
            if (config.generateSourceMaps) {
              sourceMapBase = config.dir || config.baseUrl;
              fileForSourceMap = module._buildPath === 'FUNCTION' ? (module.name || module.include[0] || 'FUNCTION') + '.build.js' : module._buildPath.replace(sourceMapBase, '');
              sourceMapGenerator = new SourceMapGenerator.SourceMapGenerator({file: fileForSourceMap});
            }
            lang.eachProp(layer.context.config.pkgs, function(value, prop) {
              pkgsMainMap[value] = prop;
            });
            fileContents = config.wrap ? config.wrap.start : "";
            return prim.serial(layer.buildFilePaths.map(function(path) {
              return function() {
                var lineCount,
                    singleContents = '';
                moduleName = layer.buildFileToModule[path];
                packageName = getOwn(pkgsMainMap, moduleName);
                return prim().start(function() {
                  parts = context.makeModuleMap(moduleName);
                  builder = parts.prefix && getOwn(context.defined, parts.prefix);
                  if (builder) {
                    if (builder.onLayerEnd && falseProp(onLayerEndAdded, parts.prefix)) {
                      onLayerEnds.push(builder);
                      onLayerEndAdded[parts.prefix] = true;
                    }
                    if (builder.write) {
                      writeApi = function(input) {
                        singleContents += "\n" + addSemiColon(input, config);
                        if (config.onBuildWrite) {
                          singleContents = config.onBuildWrite(moduleName, path, singleContents);
                        }
                      };
                      writeApi.asModule = function(moduleName, input) {
                        singleContents += "\n" + addSemiColon(build.toTransport(namespace, moduleName, path, input, layer, {useSourceUrl: layer.context.config.useSourceUrl}), config);
                        if (config.onBuildWrite) {
                          singleContents = config.onBuildWrite(moduleName, path, singleContents);
                        }
                      };
                      builder.write(parts.prefix, parts.name, writeApi);
                    }
                    return ;
                  } else {
                    return prim().start(function() {
                      if (hasProp(stubModulesByName, moduleName)) {
                        if (hasProp(layer.context.plugins, moduleName)) {
                          return 'define({load: function(id){throw new Error("Dynamic load not allowed: " + id);}});';
                        } else {
                          return 'define({});';
                        }
                      } else {
                        return require._cacheReadAsync(path);
                      }
                    }).then(function(text) {
                      var hasPackageName;
                      currContents = text;
                      if (config.cjsTranslate && (!config.shim || !lang.hasProp(config.shim, moduleName))) {
                        currContents = commonJs.convert(path, currContents);
                      }
                      if (config.onBuildRead) {
                        currContents = config.onBuildRead(moduleName, path, currContents);
                      }
                      if (packageName) {
                        hasPackageName = (packageName === parse.getNamedDefine(currContents));
                      }
                      if (namespace) {
                        currContents = pragma.namespace(currContents, namespace);
                      }
                      currContents = build.toTransport(namespace, moduleName, path, currContents, layer, {useSourceUrl: config.useSourceUrl});
                      if (packageName && !hasPackageName) {
                        currContents = addSemiColon(currContents, config) + '\n';
                        currContents += namespaceWithDot + "define('" + packageName + "', ['" + moduleName + "'], function (main) { return main; });\n";
                      }
                      if (config.onBuildWrite) {
                        currContents = config.onBuildWrite(moduleName, path, currContents);
                      }
                      singleContents += addSemiColon(currContents, config);
                    });
                  }
                }).then(function() {
                  var refPath,
                      pluginId,
                      resourcePath,
                      sourceMapPath,
                      sourceMapLineNumber,
                      shortPath = path.replace(config.dir, "");
                  module.onCompleteData.included.push(shortPath);
                  buildFileContents += shortPath + "\n";
                  if (moduleName && falseProp(layer.modulesWithNames, moduleName) && !config.skipModuleInsertion) {
                    shim = config.shim && (getOwn(config.shim, moduleName) || (packageName && getOwn(config.shim, packageName)));
                    if (shim) {
                      if (config.wrapShim) {
                        singleContents = '(function(root) {\n' + namespaceWithDot + 'define("' + moduleName + '", ' + (shim.deps && shim.deps.length ? build.makeJsArrayString(shim.deps) + ', ' : '[], ') + 'function() {\n' + '  return (function() {\n' + singleContents + '\n' + (shim.exportsFn ? shim.exportsFn() : '') + '\n' + '  }).apply(root, arguments);\n' + '});\n' + '}(this));\n';
                      } else {
                        singleContents += '\n' + namespaceWithDot + 'define("' + moduleName + '", ' + (shim.deps && shim.deps.length ? build.makeJsArrayString(shim.deps) + ', ' : '') + (shim.exportsFn ? shim.exportsFn() : 'function(){}') + ');\n';
                      }
                    } else {
                      singleContents += '\n' + namespaceWithDot + 'define("' + moduleName + '", function(){});\n';
                    }
                  }
                  singleContents += '\n';
                  if (sourceMapGenerator) {
                    refPath = config.out ? config.baseUrl : module._buildPath;
                    parts = path.split('!');
                    if (parts.length === 1) {
                      sourceMapPath = build.makeRelativeFilePath(refPath, path);
                    } else {
                      pluginId = parts.shift();
                      resourcePath = parts.join('!');
                      if (resourceIsModuleIdRegExp.test(resourcePath)) {
                        sourceMapPath = build.makeRelativeFilePath(refPath, require.toUrl(resourcePath)) + '!' + pluginId;
                      } else {
                        sourceMapPath = path;
                      }
                    }
                    sourceMapLineNumber = fileContents.split('\n').length - 1;
                    lineCount = singleContents.split('\n').length;
                    for (var i = 1; i <= lineCount; i += 1) {
                      sourceMapGenerator.addMapping({
                        generated: {
                          line: sourceMapLineNumber + i,
                          column: 0
                        },
                        original: {
                          line: i,
                          column: 0
                        },
                        source: sourceMapPath
                      });
                    }
                    sourceMapGenerator.setSourceContent(sourceMapPath, singleContents);
                  }
                  fileContents += singleContents;
                });
              };
            })).then(function() {
              if (onLayerEnds.length) {
                onLayerEnds.forEach(function(builder) {
                  var path;
                  if (typeof module.out === 'string') {
                    path = module.out;
                  } else if (typeof module._buildPath === 'string') {
                    path = module._buildPath;
                  }
                  builder.onLayerEnd(function(input) {
                    fileContents += "\n" + addSemiColon(input, config);
                  }, {
                    name: module.name,
                    path: path
                  });
                });
              }
              if (module.create) {
                fileContents += '\n' + namespaceWithDot + 'define("' + module.name + '", function(){});\n';
              }
              if (module.insertRequire) {
                fileContents += '\n' + namespaceWithDot + 'require(["' + module.insertRequire.join('", "') + '"]);\n';
              }
            });
          }).then(function() {
            return {
              text: config.wrap ? fileContents + config.wrap.end : fileContents,
              buildText: buildFileContents,
              sourceMap: sourceMapGenerator ? JSON.stringify(sourceMapGenerator.toJSON(), null, '  ') : undefined
            };
          });
        };
        build.makeJsArrayString = function(ary) {
          return '["' + ary.map(function(item) {
            return lang.jsEscape(item);
          }).join('","') + '"]';
        };
        build.toTransport = function(namespace, moduleName, path, contents, layer, options) {
          var baseUrl = layer && layer.context.config.baseUrl;
          function onFound(info) {
            if (layer && (info.needsId || info.foundId === moduleName)) {
              layer.modulesWithNames[moduleName] = true;
            }
          }
          if (baseUrl) {
            path = path.replace(baseUrl, '');
          }
          return transform.toTransport(namespace, moduleName, path, contents, onFound, options);
        };
        return build;
      });
    }
    function setBaseUrl(fileName) {
      dir = fileName.replace(/\\/g, '/');
      if (dir.indexOf('/') !== -1) {
        dir = dir.split('/');
        dir.pop();
        dir = dir.join('/');
        exec("require({baseUrl: '" + dir.replace(/[\\"']/g, '\\$&') + "'});");
      }
    }
    function createRjsApi() {
      requirejs.optimize = function(config, callback, errback) {
        if (!loadedOptimizedLib) {
          loadLib();
          loadedOptimizedLib = true;
        }
        var runBuild = function(build, logger, quit) {
          config.logLevel = config.hasOwnProperty('logLevel') ? config.logLevel : logger.SILENT;
          if (requirejs._buildReset) {
            requirejs._buildReset();
            requirejs._cacheReset();
          }
          function done(result) {
            if (requirejs._buildReset) {
              requirejs._buildReset();
              requirejs._cacheReset();
            }
            if (result instanceof Error) {
              throw result;
            }
            return result;
          }
          errback = errback || function(err) {
            console.log(err);
            quit(1);
          };
          build(config).then(done, done).then(callback, errback);
        };
        requirejs({context: 'build'}, ['build', 'logger', 'env!env/quit'], runBuild);
      };
      requirejs.tools = {useLib: function(contextName, callback) {
          if (!callback) {
            callback = contextName;
            contextName = 'uselib';
          }
          if (!useLibLoaded[contextName]) {
            loadLib();
            useLibLoaded[contextName] = true;
          }
          var req = requirejs({context: contextName});
          req(['build'], function() {
            callback(req);
          });
        }};
      requirejs.define = define;
    }
    if (env === 'node' && reqMain !== module) {
      setBaseUrl(path.resolve(reqMain ? reqMain.filename : '.'));
      createRjsApi();
      module.exports = requirejs;
      return ;
    } else if (env === 'browser') {
      setBaseUrl(location.href);
      createRjsApi();
      return ;
    } else if ((env === 'rhino' || env === 'xpconnect') && typeof requirejsAsLib !== 'undefined' && requirejsAsLib) {
      setBaseUrl(fileName);
      createRjsApi();
      return ;
    }
    if (commandOption === 'o') {
      loadLib();
      require({
        baseUrl: require.s.contexts._.config.baseUrl,
        context: 'build',
        catchError: {define: true}
      }, ['env!env/args', 'env!env/quit', 'logger', 'build'], function(args, quit, logger, build) {
        build(args).then(function() {}, function(err) {
          logger.error(err);
          quit(1);
        });
      });
    } else if (commandOption === 'v') {
      console.log('r.js: ' + version + ', RequireJS: ' + this.requirejsVars.require.version + ', UglifyJS2: 2.4.16, UglifyJS: 1.3.4');
    } else if (commandOption === 'convert') {
      loadLib();
      this.requirejsVars.require(['env!env/args', 'commonJs', 'env!env/print'], function(args, commonJs, print) {
        var srcDir,
            outDir;
        srcDir = args[0];
        outDir = args[1];
        if (!srcDir || !outDir) {
          print('Usage: path/to/commonjs/modules output/dir');
          return ;
        }
        commonJs.convertDir(args[0], args[1]);
      });
    } else {
      if (commandOption === 'lib') {
        loadLib();
      }
      setBaseUrl(fileName);
      if (exists(fileName)) {
        exec(readFile(fileName), fileName);
      } else {
        showHelp();
      }
    }
  }((typeof console !== 'undefined' ? console : undefined), (typeof Packages !== 'undefined' || (typeof window === 'undefined' && typeof Components !== 'undefined' && Components.interfaces) ? Array.prototype.slice.call(arguments, 0) : []), (typeof readFile !== 'undefined' ? readFile : undefined)));
})(require("process"));

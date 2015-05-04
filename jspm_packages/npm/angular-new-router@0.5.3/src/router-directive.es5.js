/* */ 
(function(process) {
  'use strict';
  angular.module('ngNewRouter', []).factory('$router', routerFactory).value('$routeParams', {}).provider('$componentLoader', $componentLoaderProvider).provider('$pipeline', pipelineProvider).factory('$$pipeline', privatePipelineFactory).factory('$setupRoutersStep', setupRoutersStepFactory).factory('$initLocalsStep', initLocalsStepFactory).factory('$initControllersStep', initControllersStepFactory).factory('$runCanDeactivateHookStep', runCanDeactivateHookStepFactory).factory('$runCanActivateHookStep', runCanActivateHookStepFactory).factory('$loadTemplatesStep', loadTemplatesStepFactory).value('$activateStep', activateStepValue).directive('ngViewport', ngViewportDirective).directive('ngViewport', ngViewportFillContentDirective).directive('ngLink', ngLinkDirective).directive('a', anchorLinkDirective);
  angular.module('ng').provider('$controllerIntrospector', $controllerIntrospectorProvider).config(controllerProviderDecorator);
  function controllerProviderDecorator($controllerProvider, $controllerIntrospectorProvider) {
    var register = $controllerProvider.register;
    $controllerProvider.register = function(name, ctrl) {
      $controllerIntrospectorProvider.register(name, ctrl);
      return register.apply(this, arguments);
    };
  }
  function $controllerIntrospectorProvider() {
    var controllers = [];
    var onControllerRegistered = null;
    return {
      register: function(name, constructor) {
        if (angular.isArray(constructor)) {
          constructor = constructor[constructor.length - 1];
        }
        if (constructor.$routeConfig) {
          if (onControllerRegistered) {
            onControllerRegistered(name, constructor.$routeConfig);
          } else {
            controllers.push({
              name: name,
              config: constructor.$routeConfig
            });
          }
        }
      },
      $get: ['$componentLoader', function($componentLoader) {
        return function(newOnControllerRegistered) {
          onControllerRegistered = function(name, constructor) {
            name = $componentLoader.component(name);
            return newOnControllerRegistered(name, constructor);
          };
          while (controllers.length > 0) {
            var rule = controllers.pop();
            onControllerRegistered(rule.name, rule.config);
          }
        };
      }]
    };
  }
  function routerFactory($$rootRouter, $rootScope, $location, $$grammar, $controllerIntrospector) {
    $controllerIntrospector(function(name, config) {
      $$grammar.config(name, config);
    });
    $rootScope.$watch(function() {
      return $location.path();
    }, function(newUrl) {
      $$rootRouter.navigate(newUrl);
    });
    var nav = $$rootRouter.navigate;
    $$rootRouter.navigate = function(url) {
      return nav.call(this, url).then(function(newUrl) {
        if (newUrl) {
          $location.path(newUrl);
        }
      });
    };
    return $$rootRouter;
  }
  function ngViewportDirective($animate, $injector, $q, $router) {
    var rootRouter = $router;
    return {
      restrict: 'AE',
      transclude: 'element',
      terminal: true,
      priority: 400,
      require: ['?^^ngViewport', 'ngViewport'],
      link: viewportLink,
      controller: function() {},
      controllerAs: '$$ngViewport'
    };
    function invoke(method, context, instruction) {
      return $injector.invoke(method, context, instruction.locals);
    }
    function viewportLink(scope, $element, attrs, ctrls, $transclude) {
      var viewportName = attrs.ngViewport || 'default',
          parentCtrl = ctrls[0],
          myCtrl = ctrls[1],
          router = (parentCtrl && parentCtrl.$$router) || rootRouter;
      var currentScope,
          newScope,
          currentController,
          currentElement,
          previousLeaveAnimation,
          previousInstruction;
      function cleanupLastView() {
        if (previousLeaveAnimation) {
          $animate.cancel(previousLeaveAnimation);
          previousLeaveAnimation = null;
        }
        if (currentScope) {
          currentScope.$destroy();
          currentScope = null;
        }
        if (currentElement) {
          previousLeaveAnimation = $animate.leave(currentElement);
          previousLeaveAnimation.then(function() {
            previousLeaveAnimation = null;
          });
          currentElement = null;
        }
      }
      router.registerViewport({
        canDeactivate: function(instruction) {
          if (currentController && currentController.canDeactivate) {
            return invoke(currentController.canDeactivate, currentController, instruction);
          }
          return true;
        },
        activate: function(instruction) {
          var nextInstruction = serializeInstruction(instruction);
          if (nextInstruction === previousInstruction) {
            return ;
          }
          instruction.locals.$scope = newScope = scope.$new();
          myCtrl.$$router = instruction.router;
          myCtrl.$$template = instruction.template;
          var componentName = instruction.component;
          var clone = $transclude(newScope, function(clone) {
            $animate.enter(clone, null, currentElement || $element);
            cleanupLastView();
          });
          var newController = instruction.controller;
          newScope[componentName] = newController;
          var result;
          if (currentController && currentController.deactivate) {
            result = $q.when(invoke(currentController.deactivate, currentController, instruction));
          }
          currentController = newController;
          currentElement = clone;
          currentScope = newScope;
          previousInstruction = nextInstruction;
          if (newController.activate) {
            var activationResult = $q.when(invoke(newController.activate, newController, instruction));
            if (result) {
              return result.then(activationResult);
            } else {
              return activationResult;
            }
          }
          return result;
        }
      }, viewportName);
    }
    function serializeInstruction(instruction) {
      return JSON.stringify({
        path: instruction.path,
        component: instruction.component,
        params: Object.keys(instruction.params).reduce(function(acc, key) {
          return (key !== 'childRoute' && (acc[key] = instruction.params[key])), acc;
        }, {})
      });
    }
  }
  function ngViewportFillContentDirective($compile) {
    return {
      restrict: 'EA',
      priority: -400,
      require: 'ngViewport',
      link: function(scope, $element, attrs, ctrl) {
        var template = ctrl.$$template;
        $element.html(template);
        var link = $compile($element.contents());
        link(scope);
      }
    };
  }
  function makeComponentString(name) {
    return ['<router-component component-name="', name, '">', '</router-component>'].join('');
  }
  var LINK_MICROSYNTAX_RE = /^(.+?)(?:\((.*)\))?$/;
  function ngLinkDirective($router, $location, $parse) {
    var rootRouter = $router;
    return {
      require: '?^^ngViewport',
      restrict: 'A',
      link: ngLinkDirectiveLinkFn
    };
    function ngLinkDirectiveLinkFn(scope, elt, attrs, ctrl) {
      var router = (ctrl && ctrl.$$router) || rootRouter;
      if (!router) {
        return ;
      }
      var link = attrs.ngLink || '';
      var parts = link.match(LINK_MICROSYNTAX_RE);
      var routeName = parts[1];
      var routeParams = parts[2];
      var url;
      if (routeParams) {
        var routeParamsGetter = $parse(routeParams);
        if (routeParamsGetter.constant) {
          var params = routeParamsGetter();
          url = '.' + router.generate(routeName, params);
          elt.attr('href', url);
        } else {
          scope.$watch(function() {
            return routeParamsGetter(scope);
          }, function(params) {
            url = '.' + router.generate(routeName, params);
            elt.attr('href', url);
          }, true);
        }
      } else {
        url = '.' + router.generate(routeName);
        elt.attr('href', url);
      }
    }
  }
  function anchorLinkDirective($router) {
    return {
      restrict: 'E',
      link: function(scope, element) {
        if (element[0].nodeName.toLowerCase() !== 'a')
          return ;
        var hrefAttrName = Object.prototype.toString.call(element.prop('href')) === '[object SVGAnimatedString]' ? 'xlink:href' : 'href';
        element.on('click', function(event) {
          var href = element.attr(hrefAttrName);
          if (!href) {
            event.preventDefault();
          }
          if ($router.recognize(href)) {
            $router.navigate(href);
            event.preventDefault();
          }
        });
      }
    };
  }
  function setupRoutersStepFactory() {
    return function(instruction) {
      return instruction.router.makeDescendantRouters(instruction);
    };
  }
  function initLocalsStepFactory() {
    return function initLocals(instruction) {
      return instruction.router.traverseInstruction(instruction, function(instruction) {
        return instruction.locals = {
          $router: instruction.router,
          $routeParams: (instruction.params || {})
        };
      });
    };
  }
  function initControllersStepFactory($controller, $componentLoader) {
    return function initControllers(instruction) {
      return instruction.router.traverseInstruction(instruction, function(instruction) {
        var controllerName = $componentLoader.controllerName(instruction.component);
        var locals = instruction.locals;
        var ctrl;
        try {
          ctrl = $controller(controllerName, locals);
        } catch (e) {
          console.warn && console.warn('Could not instantiate controller', controllerName);
          ctrl = $controller(angular.noop, locals);
        }
        return instruction.controller = ctrl;
      });
    };
  }
  function runCanDeactivateHookStepFactory() {
    return function runCanDeactivateHook(instruction) {
      return instruction.router.canDeactivatePorts(instruction);
    };
  }
  function runCanActivateHookStepFactory($injector) {
    function invoke(method, context, instruction) {
      return $injector.invoke(method, context, {$routeParams: instruction.params});
    }
    return function runCanActivateHook(instruction) {
      return instruction.router.traverseInstruction(instruction, function(instruction) {
        var controller = instruction.controller;
        return !controller.canActivate || invoke(controller.canActivate, controller, instruction);
      });
    };
  }
  function loadTemplatesStepFactory($componentLoader, $templateRequest) {
    return function loadTemplates(instruction) {
      return instruction.router.traverseInstruction(instruction, function(instruction) {
        var componentTemplateUrl = $componentLoader.template(instruction.component);
        return $templateRequest(componentTemplateUrl).then(function(templateHtml) {
          return instruction.template = templateHtml;
        });
      });
    };
  }
  function activateStepValue(instruction) {
    return instruction.router.activatePorts(instruction);
  }
  function pipelineProvider() {
    var stepConfiguration;
    var protoStepConfiguration = ['$setupRoutersStep', '$initLocalsStep', '$initControllersStep', '$runCanDeactivateHookStep', '$runCanActivateHookStep', '$loadTemplatesStep', '$activateStep'];
    return {
      steps: protoStepConfiguration.slice(0),
      config: function(newConfig) {
        protoStepConfiguration = newConfig;
      },
      $get: function($injector, $q) {
        stepConfiguration = protoStepConfiguration.map(function(step) {
          return $injector.get(step);
        });
        return {process: function(instruction) {
            var steps = stepConfiguration.slice(0);
            function processOne(result) {
              if (steps.length === 0) {
                return result;
              }
              var step = steps.shift();
              return $q.when(step(instruction)).then(processOne);
            }
            return processOne();
          }};
      }
    };
  }
  function $componentLoaderProvider() {
    var DEFAULT_SUFFIX = 'Controller';
    var componentToCtrl = function componentToCtrlDefault(name) {
      return name[0].toUpperCase() + name.substr(1) + DEFAULT_SUFFIX;
    };
    var componentToTemplate = function componentToTemplateDefault(name) {
      var dashName = dashCase(name);
      return './components/' + dashName + '/' + dashName + '.html';
    };
    var ctrlToComponent = function ctrlToComponentDefault(name) {
      return name[0].toLowerCase() + name.substr(1, name.length - DEFAULT_SUFFIX.length - 1);
    };
    return {
      $get: function() {
        return {
          controllerName: componentToCtrl,
          template: componentToTemplate,
          component: ctrlToComponent
        };
      },
      setCtrlNameMapping: function(newFn) {
        componentToCtrl = newFn;
        return this;
      },
      setComponentFromCtrlMapping: function(newFn) {
        ctrlToComponent = newFn;
        return this;
      },
      setTemplateMapping: function(newFn) {
        componentToTemplate = newFn;
        return this;
      }
    };
  }
  function privatePipelineFactory($pipeline) {
    return $pipeline;
  }
  function dashCase(str) {
    return str.replace(/([A-Z])/g, function($1) {
      return '-' + $1.toLowerCase();
    });
  }
})(require("process"));

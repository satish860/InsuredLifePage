/* */ 
require("./core");
var types = require("../lib/types");
var def = types.Type.def;
var or = types.Type.or;
var builtin = types.builtInTypes;
var isString = builtin.string;
var isBoolean = builtin.boolean;
var defaults = require("../lib/shared").defaults;
def("XJSAttribute").bases("Node").build("name", "value").field("name", or(def("XJSIdentifier"), def("XJSNamespacedName"))).field("value", or(def("Literal"), def("XJSExpressionContainer"), null), defaults["null"]);
def("XJSIdentifier").bases("Node").build("name").field("name", isString);
def("XJSNamespacedName").bases("Node").build("namespace", "name").field("namespace", def("XJSIdentifier")).field("name", def("XJSIdentifier"));
def("XJSMemberExpression").bases("MemberExpression").build("object", "property").field("object", or(def("XJSIdentifier"), def("XJSMemberExpression"))).field("property", def("XJSIdentifier")).field("computed", isBoolean, defaults.false);
var XJSElementName = or(def("XJSIdentifier"), def("XJSNamespacedName"), def("XJSMemberExpression"));
def("XJSSpreadAttribute").bases("Node").build("argument").field("argument", def("Expression"));
var XJSAttributes = [or(def("XJSAttribute"), def("XJSSpreadAttribute"))];
def("XJSExpressionContainer").bases("Expression").build("expression").field("expression", def("Expression"));
def("XJSElement").bases("Expression").build("openingElement", "closingElement", "children").field("openingElement", def("XJSOpeningElement")).field("closingElement", or(def("XJSClosingElement"), null), defaults["null"]).field("children", [or(def("XJSElement"), def("XJSExpressionContainer"), def("XJSText"), def("Literal"))], defaults.emptyArray).field("name", XJSElementName, function() {
  return this.openingElement.name;
}).field("selfClosing", isBoolean, function() {
  return this.openingElement.selfClosing;
}).field("attributes", XJSAttributes, function() {
  return this.openingElement.attributes;
});
def("XJSOpeningElement").bases("Node").build("name", "attributes", "selfClosing").field("name", XJSElementName).field("attributes", XJSAttributes, defaults.emptyArray).field("selfClosing", isBoolean, defaults["false"]);
def("XJSClosingElement").bases("Node").build("name").field("name", XJSElementName);
def("XJSText").bases("Literal").build("value").field("value", isString);
def("XJSEmptyExpression").bases("Expression").build();
def("TypeAnnotatedIdentifier").bases("Pattern").build("annotation", "identifier").field("annotation", def("TypeAnnotation")).field("identifier", def("Identifier"));
def("TypeAnnotation").bases("Pattern").build("annotatedType", "templateTypes", "paramTypes", "returnType", "unionType", "nullable").field("annotatedType", def("Identifier")).field("templateTypes", or([def("TypeAnnotation")], null)).field("paramTypes", or([def("TypeAnnotation")], null)).field("returnType", or(def("TypeAnnotation"), null)).field("unionType", or(def("TypeAnnotation"), null)).field("nullable", isBoolean);
def("Identifier").field("annotation", or(def("TypeAnnotation"), null), defaults['null']);
def("Function").field("returnType", or(def("TypeAnnotation"), null), defaults['null']);
def("ClassProperty").field("id", or(def("Identifier"), def("TypeAnnotatedIdentifier")));

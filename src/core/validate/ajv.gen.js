// GENERATED — do not edit. Source: schema/viz-spec-v1.schema.json via scripts/gen-validator.ts.
// Ajv standalone validator with its runtime helpers inlined; no "ajv" import remains.
var __getOwnPropNames = Object.getOwnPropertyNames;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};

// node_modules/.pnpm/ajv@8.20.0/node_modules/ajv/dist/runtime/ucs2length.js
var require_ucs2length = __commonJS({
  "node_modules/.pnpm/ajv@8.20.0/node_modules/ajv/dist/runtime/ucs2length.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    function ucs2length(str) {
      const len = str.length;
      let length = 0;
      let pos = 0;
      let value;
      while (pos < len) {
        length++;
        value = str.charCodeAt(pos++);
        if (value >= 55296 && value <= 56319 && pos < len) {
          value = str.charCodeAt(pos);
          if ((value & 64512) === 56320)
            pos++;
        }
      }
      return length;
    }
    exports.default = ucs2length;
  }
});

// ajv-standalone.js
var schemaValidate = validate20;
var schema32 = { "title": "CartesianSpec", "description": "Cartesian chart: bar, line, area and scatter series on shared axes.", "extends": [{ "$ref": "#/$defs/SpecBase" }], "type": "object", "properties": { "schemaVersion": { "$ref": "#/$defs/SpecBase/properties/schemaVersion" }, "id": { "$ref": "#/$defs/SpecBase/properties/id" }, "kind": { "const": "cartesian" }, "title": { "$ref": "#/$defs/SpecBase/properties/title" }, "description": { "$ref": "#/$defs/SpecBase/properties/description" }, "caption": { "$ref": "#/$defs/SpecBase/properties/caption" }, "roles": { "$ref": "#/$defs/SpecBase/properties/roles" }, "legend": { "$ref": "#/$defs/SpecBase/properties/legend" }, "orientation": { "enum": ["vertical", "horizontal"] }, "preset": { "enum": ["standard", "sparkline", "compact-stack"] }, "xAxis": { "discriminator": { "propertyName": "scale" }, "oneOf": [{ "$ref": "#/$defs/CategoryAxis" }, { "$ref": "#/$defs/LinearAxis" }, { "$ref": "#/$defs/TimeAxis" }], "type": "object" }, "yAxes": { "type": "array", "items": { "$ref": "#/$defs/ValueAxis" }, "minItems": 1, "maxItems": 2 }, "series": { "type": "array", "items": { "$ref": "#/$defs/Series" }, "minItems": 1, "maxItems": 16 }, "stacking": { "type": "object", "properties": { "mode": { "enum": ["absolute", "percent"] }, "valueUnit": { "$ref": "#/$defs/Text" }, "segmentLabels": { "enum": ["none", "share", "value", "value-and-share"] } }, "required": ["mode"], "additionalProperties": false }, "bubble": { "$ref": "#/$defs/BubbleEncoding" }, "referenceLines": { "type": "array", "items": { "$ref": "#/$defs/ReferenceLine" }, "minItems": 0, "maxItems": 16 }, "annotations": { "type": "array", "items": { "$ref": "#/$defs/Annotation" }, "minItems": 0, "maxItems": 16 }, "labels": { "type": "object", "properties": { "values": { "enum": ["none", "totals", "all"] } }, "additionalProperties": false } }, "required": ["schemaVersion", "id", "kind", "title", "xAxis", "yAxes", "series"], "additionalProperties": false };
var schema44 = { "title": "LegendOptions", "type": "object", "properties": { "show": { "enum": ["auto", "always", "never"], "description": "auto: shown when there is more than one series, slice or role." }, "position": { "enum": ["top", "bottom"], "description": 'Default "bottom".' } }, "additionalProperties": false };
var schema89 = { "title": "BubbleEncoding", "type": "object", "properties": { "mode": { "enum": ["area", "radius"] }, "domain": { "tsType": "[number, number]", "type": "array", "prefixItems": [{ "type": "number", "minimum": 0 }, { "type": "number", "minimum": 0 }], "items": false, "minItems": 2, "maxItems": 2, "description": "Size values mapped; 0 <= min < max." }, "range": { "tsType": "[number, number]", "type": "array", "prefixItems": [{ "type": "number", "minimum": 0 }, { "type": "number", "minimum": 0 }], "items": false, "minItems": 2, "maxItems": 2, "description": "Logical px radius at domain min and max." }, "minVisibleRadius": { "type": "number", "minimum": 0 } }, "required": ["mode", "domain", "range"], "additionalProperties": false };
var func1 = Object.prototype.hasOwnProperty;
var func2 = require_ucs2length().default;
var pattern4 = new RegExp("^[A-Za-z][A-Za-z0-9_-]{0,63}$", "u");
var pattern5 = new RegExp("^[^\\p{Cc}\\p{Cs}]+$", "u");
var pattern6 = new RegExp("^(?:[^\\p{Cc}\\p{Cs}]|\\n)*$", "u");
var pattern7 = new RegExp("^(?:[^\\p{Cc}\\p{Cs}]|\\n)+$", "u");
var schema40 = { "title": "RoleDef", "type": "object", "properties": { "label": { "$ref": "#/$defs/Text" }, "color": { "$ref": "#/$defs/Color" }, "pattern": { "enum": ["none", "diagonal", "dots", "crosshatch"] }, "shape": { "$ref": "#/$defs/MarkerShape" } }, "additionalProperties": false, "description": "Caller-defined semantic role; no business meaning in core." };
var schema43 = { "title": "MarkerShape", "enum": ["circle", "square", "triangle", "diamond", "cross", "none"] };
var pattern10 = new RegExp("^#[0-9a-fA-F]{6}$", "u");
function validate23(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate23.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    for (const key0 in data) {
      if (!(key0 === "label" || key0 === "color" || key0 === "pattern" || key0 === "shape")) {
        const err0 = { instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" };
        if (vErrors === null) {
          vErrors = [err0];
        } else {
          vErrors.push(err0);
        }
        errors++;
      }
    }
    if (data.label !== void 0) {
      let data0 = data.label;
      if (typeof data0 === "string") {
        if (func2(data0) > 500) {
          const err1 = { instancePath: instancePath + "/label", schemaPath: "#/$defs/Text/maxLength", keyword: "maxLength", params: { limit: 500 }, message: "must NOT have more than 500 characters" };
          if (vErrors === null) {
            vErrors = [err1];
          } else {
            vErrors.push(err1);
          }
          errors++;
        }
        if (func2(data0) < 1) {
          const err2 = { instancePath: instancePath + "/label", schemaPath: "#/$defs/Text/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
          if (vErrors === null) {
            vErrors = [err2];
          } else {
            vErrors.push(err2);
          }
          errors++;
        }
        if (!pattern5.test(data0)) {
          const err3 = { instancePath: instancePath + "/label", schemaPath: "#/$defs/Text/pattern", keyword: "pattern", params: { pattern: "^[^\\p{Cc}\\p{Cs}]+$" }, message: 'must match pattern "^[^\\p{Cc}\\p{Cs}]+$"' };
          if (vErrors === null) {
            vErrors = [err3];
          } else {
            vErrors.push(err3);
          }
          errors++;
        }
      } else {
        const err4 = { instancePath: instancePath + "/label", schemaPath: "#/$defs/Text/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err4];
        } else {
          vErrors.push(err4);
        }
        errors++;
      }
    }
    if (data.color !== void 0) {
      let data1 = data.color;
      if (typeof data1 === "string") {
        if (!pattern10.test(data1)) {
          const err5 = { instancePath: instancePath + "/color", schemaPath: "#/$defs/Color/pattern", keyword: "pattern", params: { pattern: "^#[0-9a-fA-F]{6}$" }, message: 'must match pattern "^#[0-9a-fA-F]{6}$"' };
          if (vErrors === null) {
            vErrors = [err5];
          } else {
            vErrors.push(err5);
          }
          errors++;
        }
      } else {
        const err6 = { instancePath: instancePath + "/color", schemaPath: "#/$defs/Color/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err6];
        } else {
          vErrors.push(err6);
        }
        errors++;
      }
    }
    if (data.pattern !== void 0) {
      let data2 = data.pattern;
      if (!(data2 === "none" || data2 === "diagonal" || data2 === "dots" || data2 === "crosshatch")) {
        const err7 = { instancePath: instancePath + "/pattern", schemaPath: "#/properties/pattern/enum", keyword: "enum", params: { allowedValues: schema40.properties.pattern.enum }, message: "must be equal to one of the allowed values" };
        if (vErrors === null) {
          vErrors = [err7];
        } else {
          vErrors.push(err7);
        }
        errors++;
      }
    }
    if (data.shape !== void 0) {
      let data3 = data.shape;
      if (!(data3 === "circle" || data3 === "square" || data3 === "triangle" || data3 === "diamond" || data3 === "cross" || data3 === "none")) {
        const err8 = { instancePath: instancePath + "/shape", schemaPath: "#/$defs/MarkerShape/enum", keyword: "enum", params: { allowedValues: schema43.enum }, message: "must be equal to one of the allowed values" };
        if (vErrors === null) {
          vErrors = [err8];
        } else {
          vErrors.push(err8);
        }
        errors++;
      }
    }
  } else {
    const err9 = { instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" };
    if (vErrors === null) {
      vErrors = [err9];
    } else {
      vErrors.push(err9);
    }
    errors++;
  }
  validate23.errors = vErrors;
  return errors === 0;
}
validate23.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
function validate22(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate22.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    for (const key0 in data) {
      const _errs1 = errors;
      if (typeof key0 === "string") {
        if (!pattern4.test(key0)) {
          const err0 = { instancePath, schemaPath: "#/$defs/Id/pattern", keyword: "pattern", params: { pattern: "^[A-Za-z][A-Za-z0-9_-]{0,63}$" }, message: 'must match pattern "^[A-Za-z][A-Za-z0-9_-]{0,63}$"', propertyName: key0 };
          if (vErrors === null) {
            vErrors = [err0];
          } else {
            vErrors.push(err0);
          }
          errors++;
        }
      } else {
        const err1 = { instancePath, schemaPath: "#/$defs/Id/type", keyword: "type", params: { type: "string" }, message: "must be string", propertyName: key0 };
        if (vErrors === null) {
          vErrors = [err1];
        } else {
          vErrors.push(err1);
        }
        errors++;
      }
      var valid0 = _errs1 === errors;
      if (!valid0) {
        const err2 = { instancePath, schemaPath: "#/propertyNames", keyword: "propertyNames", params: { propertyName: key0 }, message: "property name must be valid" };
        if (vErrors === null) {
          vErrors = [err2];
        } else {
          vErrors.push(err2);
        }
        errors++;
      }
    }
    for (const key1 in data) {
      if (!validate23(data[key1], { instancePath: instancePath + "/" + key1.replace(/~/g, "~0").replace(/\//g, "~1"), parentData: data, parentDataProperty: key1, rootData, dynamicAnchors })) {
        vErrors = vErrors === null ? validate23.errors : vErrors.concat(validate23.errors);
        errors = vErrors.length;
      }
    }
  } else {
    const err3 = { instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" };
    if (vErrors === null) {
      vErrors = [err3];
    } else {
      vErrors.push(err3);
    }
    errors++;
  }
  validate22.errors = vErrors;
  return errors === 0;
}
validate22.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
var schema45 = { "title": "CategoryAxis", "type": "object", "properties": { "id": { "$ref": "#/$defs/Id" }, "scale": { "const": "category" }, "categories": { "type": "array", "items": { "$ref": "#/$defs/Text" }, "minItems": 1, "maxItems": 250, "description": "Unique keys in display order." }, "labels": { "type": "array", "items": { "$ref": "#/$defs/Text" }, "minItems": 1, "maxItems": 250, "description": "Same length as categories; displayed verbatim." }, "label": { "$ref": "#/$defs/Text" }, "labelPolicy": { "enum": ["auto", "wrap", "rotate"] } }, "required": ["id", "scale", "categories"], "additionalProperties": false };
function validate26(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate26.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.id === void 0) {
      const err0 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "id" }, message: "must have required property 'id'" };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.scale === void 0) {
      const err1 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "scale" }, message: "must have required property 'scale'" };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    if (data.categories === void 0) {
      const err2 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "categories" }, message: "must have required property 'categories'" };
      if (vErrors === null) {
        vErrors = [err2];
      } else {
        vErrors.push(err2);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!(key0 === "id" || key0 === "scale" || key0 === "categories" || key0 === "labels" || key0 === "label" || key0 === "labelPolicy")) {
        const err3 = { instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" };
        if (vErrors === null) {
          vErrors = [err3];
        } else {
          vErrors.push(err3);
        }
        errors++;
      }
    }
    if (data.id !== void 0) {
      let data0 = data.id;
      if (typeof data0 === "string") {
        if (!pattern4.test(data0)) {
          const err4 = { instancePath: instancePath + "/id", schemaPath: "#/$defs/Id/pattern", keyword: "pattern", params: { pattern: "^[A-Za-z][A-Za-z0-9_-]{0,63}$" }, message: 'must match pattern "^[A-Za-z][A-Za-z0-9_-]{0,63}$"' };
          if (vErrors === null) {
            vErrors = [err4];
          } else {
            vErrors.push(err4);
          }
          errors++;
        }
      } else {
        const err5 = { instancePath: instancePath + "/id", schemaPath: "#/$defs/Id/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err5];
        } else {
          vErrors.push(err5);
        }
        errors++;
      }
    }
    if (data.scale !== void 0) {
      if ("category" !== data.scale) {
        const err6 = { instancePath: instancePath + "/scale", schemaPath: "#/properties/scale/const", keyword: "const", params: { allowedValue: "category" }, message: "must be equal to constant" };
        if (vErrors === null) {
          vErrors = [err6];
        } else {
          vErrors.push(err6);
        }
        errors++;
      }
    }
    if (data.categories !== void 0) {
      let data2 = data.categories;
      if (Array.isArray(data2)) {
        if (data2.length > 250) {
          const err7 = { instancePath: instancePath + "/categories", schemaPath: "#/properties/categories/maxItems", keyword: "maxItems", params: { limit: 250 }, message: "must NOT have more than 250 items" };
          if (vErrors === null) {
            vErrors = [err7];
          } else {
            vErrors.push(err7);
          }
          errors++;
        }
        if (data2.length < 1) {
          const err8 = { instancePath: instancePath + "/categories", schemaPath: "#/properties/categories/minItems", keyword: "minItems", params: { limit: 1 }, message: "must NOT have fewer than 1 items" };
          if (vErrors === null) {
            vErrors = [err8];
          } else {
            vErrors.push(err8);
          }
          errors++;
        }
        const len0 = data2.length;
        for (let i0 = 0; i0 < len0; i0++) {
          let data3 = data2[i0];
          if (typeof data3 === "string") {
            if (func2(data3) > 500) {
              const err9 = { instancePath: instancePath + "/categories/" + i0, schemaPath: "#/$defs/Text/maxLength", keyword: "maxLength", params: { limit: 500 }, message: "must NOT have more than 500 characters" };
              if (vErrors === null) {
                vErrors = [err9];
              } else {
                vErrors.push(err9);
              }
              errors++;
            }
            if (func2(data3) < 1) {
              const err10 = { instancePath: instancePath + "/categories/" + i0, schemaPath: "#/$defs/Text/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
              if (vErrors === null) {
                vErrors = [err10];
              } else {
                vErrors.push(err10);
              }
              errors++;
            }
            if (!pattern5.test(data3)) {
              const err11 = { instancePath: instancePath + "/categories/" + i0, schemaPath: "#/$defs/Text/pattern", keyword: "pattern", params: { pattern: "^[^\\p{Cc}\\p{Cs}]+$" }, message: 'must match pattern "^[^\\p{Cc}\\p{Cs}]+$"' };
              if (vErrors === null) {
                vErrors = [err11];
              } else {
                vErrors.push(err11);
              }
              errors++;
            }
          } else {
            const err12 = { instancePath: instancePath + "/categories/" + i0, schemaPath: "#/$defs/Text/type", keyword: "type", params: { type: "string" }, message: "must be string" };
            if (vErrors === null) {
              vErrors = [err12];
            } else {
              vErrors.push(err12);
            }
            errors++;
          }
        }
      } else {
        const err13 = { instancePath: instancePath + "/categories", schemaPath: "#/properties/categories/type", keyword: "type", params: { type: "array" }, message: "must be array" };
        if (vErrors === null) {
          vErrors = [err13];
        } else {
          vErrors.push(err13);
        }
        errors++;
      }
    }
    if (data.labels !== void 0) {
      let data4 = data.labels;
      if (Array.isArray(data4)) {
        if (data4.length > 250) {
          const err14 = { instancePath: instancePath + "/labels", schemaPath: "#/properties/labels/maxItems", keyword: "maxItems", params: { limit: 250 }, message: "must NOT have more than 250 items" };
          if (vErrors === null) {
            vErrors = [err14];
          } else {
            vErrors.push(err14);
          }
          errors++;
        }
        if (data4.length < 1) {
          const err15 = { instancePath: instancePath + "/labels", schemaPath: "#/properties/labels/minItems", keyword: "minItems", params: { limit: 1 }, message: "must NOT have fewer than 1 items" };
          if (vErrors === null) {
            vErrors = [err15];
          } else {
            vErrors.push(err15);
          }
          errors++;
        }
        const len1 = data4.length;
        for (let i1 = 0; i1 < len1; i1++) {
          let data5 = data4[i1];
          if (typeof data5 === "string") {
            if (func2(data5) > 500) {
              const err16 = { instancePath: instancePath + "/labels/" + i1, schemaPath: "#/$defs/Text/maxLength", keyword: "maxLength", params: { limit: 500 }, message: "must NOT have more than 500 characters" };
              if (vErrors === null) {
                vErrors = [err16];
              } else {
                vErrors.push(err16);
              }
              errors++;
            }
            if (func2(data5) < 1) {
              const err17 = { instancePath: instancePath + "/labels/" + i1, schemaPath: "#/$defs/Text/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
              if (vErrors === null) {
                vErrors = [err17];
              } else {
                vErrors.push(err17);
              }
              errors++;
            }
            if (!pattern5.test(data5)) {
              const err18 = { instancePath: instancePath + "/labels/" + i1, schemaPath: "#/$defs/Text/pattern", keyword: "pattern", params: { pattern: "^[^\\p{Cc}\\p{Cs}]+$" }, message: 'must match pattern "^[^\\p{Cc}\\p{Cs}]+$"' };
              if (vErrors === null) {
                vErrors = [err18];
              } else {
                vErrors.push(err18);
              }
              errors++;
            }
          } else {
            const err19 = { instancePath: instancePath + "/labels/" + i1, schemaPath: "#/$defs/Text/type", keyword: "type", params: { type: "string" }, message: "must be string" };
            if (vErrors === null) {
              vErrors = [err19];
            } else {
              vErrors.push(err19);
            }
            errors++;
          }
        }
      } else {
        const err20 = { instancePath: instancePath + "/labels", schemaPath: "#/properties/labels/type", keyword: "type", params: { type: "array" }, message: "must be array" };
        if (vErrors === null) {
          vErrors = [err20];
        } else {
          vErrors.push(err20);
        }
        errors++;
      }
    }
    if (data.label !== void 0) {
      let data6 = data.label;
      if (typeof data6 === "string") {
        if (func2(data6) > 500) {
          const err21 = { instancePath: instancePath + "/label", schemaPath: "#/$defs/Text/maxLength", keyword: "maxLength", params: { limit: 500 }, message: "must NOT have more than 500 characters" };
          if (vErrors === null) {
            vErrors = [err21];
          } else {
            vErrors.push(err21);
          }
          errors++;
        }
        if (func2(data6) < 1) {
          const err22 = { instancePath: instancePath + "/label", schemaPath: "#/$defs/Text/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
          if (vErrors === null) {
            vErrors = [err22];
          } else {
            vErrors.push(err22);
          }
          errors++;
        }
        if (!pattern5.test(data6)) {
          const err23 = { instancePath: instancePath + "/label", schemaPath: "#/$defs/Text/pattern", keyword: "pattern", params: { pattern: "^[^\\p{Cc}\\p{Cs}]+$" }, message: 'must match pattern "^[^\\p{Cc}\\p{Cs}]+$"' };
          if (vErrors === null) {
            vErrors = [err23];
          } else {
            vErrors.push(err23);
          }
          errors++;
        }
      } else {
        const err24 = { instancePath: instancePath + "/label", schemaPath: "#/$defs/Text/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err24];
        } else {
          vErrors.push(err24);
        }
        errors++;
      }
    }
    if (data.labelPolicy !== void 0) {
      let data7 = data.labelPolicy;
      if (!(data7 === "auto" || data7 === "wrap" || data7 === "rotate")) {
        const err25 = { instancePath: instancePath + "/labelPolicy", schemaPath: "#/properties/labelPolicy/enum", keyword: "enum", params: { allowedValues: schema45.properties.labelPolicy.enum }, message: "must be equal to one of the allowed values" };
        if (vErrors === null) {
          vErrors = [err25];
        } else {
          vErrors.push(err25);
        }
        errors++;
      }
    }
  } else {
    const err26 = { instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" };
    if (vErrors === null) {
      vErrors = [err26];
    } else {
      vErrors.push(err26);
    }
    errors++;
  }
  validate26.errors = vErrors;
  return errors === 0;
}
validate26.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
var schema54 = { "title": "NumberFormat", "type": "object", "properties": { "style": { "enum": ["decimal", "percent", "currency", "compact"], "description": 'Default "decimal". "percent" treats raw values as percentage points.' }, "currency": { "type": "string", "pattern": "^[A-Z]{3}$", "description": 'ISO 4217 code; required when style is "currency".' }, "minimumFractionDigits": { "type": "integer", "minimum": 0, "maximum": 6 }, "maximumFractionDigits": { "type": "integer", "minimum": 0, "maximum": 6 }, "signDisplay": { "enum": ["auto", "always", "exceptZero"] } }, "additionalProperties": false };
var pattern18 = new RegExp("^[A-Z]{3}$", "u");
var schema58 = { "title": "FixedDomain", "type": "object", "properties": { "policy": { "const": "fixed" }, "min": { "type": "number" }, "max": { "type": "number" }, "overflow": { "enum": ["error", "clip-indicated"], "description": 'Default "error".' } }, "required": ["policy", "min", "max"], "additionalProperties": false };
function validate28(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate28.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    const tag0 = data.policy;
    if (typeof tag0 == "string") {
      if (tag0 === "include-zero") {
        if (data && typeof data == "object" && !Array.isArray(data)) {
          if (data.policy === void 0) {
            const err0 = { instancePath, schemaPath: "#/$defs/IncludeZeroDomain/required", keyword: "required", params: { missingProperty: "policy" }, message: "must have required property 'policy'" };
            if (vErrors === null) {
              vErrors = [err0];
            } else {
              vErrors.push(err0);
            }
            errors++;
          }
          for (const key0 in data) {
            if (!(key0 === "policy")) {
              const err1 = { instancePath, schemaPath: "#/$defs/IncludeZeroDomain/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" };
              if (vErrors === null) {
                vErrors = [err1];
              } else {
                vErrors.push(err1);
              }
              errors++;
            }
          }
          if (data.policy !== void 0) {
            if ("include-zero" !== data.policy) {
              const err2 = { instancePath: instancePath + "/policy", schemaPath: "#/$defs/IncludeZeroDomain/properties/policy/const", keyword: "const", params: { allowedValue: "include-zero" }, message: "must be equal to constant" };
              if (vErrors === null) {
                vErrors = [err2];
              } else {
                vErrors.push(err2);
              }
              errors++;
            }
          }
        } else {
          const err3 = { instancePath, schemaPath: "#/$defs/IncludeZeroDomain/type", keyword: "type", params: { type: "object" }, message: "must be object" };
          if (vErrors === null) {
            vErrors = [err3];
          } else {
            vErrors.push(err3);
          }
          errors++;
        }
        var props0 = true;
      } else if (tag0 === "fit") {
        if (data && typeof data == "object" && !Array.isArray(data)) {
          if (data.policy === void 0) {
            const err4 = { instancePath, schemaPath: "#/$defs/FitDomain/required", keyword: "required", params: { missingProperty: "policy" }, message: "must have required property 'policy'" };
            if (vErrors === null) {
              vErrors = [err4];
            } else {
              vErrors.push(err4);
            }
            errors++;
          }
          for (const key1 in data) {
            if (!(key1 === "policy")) {
              const err5 = { instancePath, schemaPath: "#/$defs/FitDomain/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key1 }, message: "must NOT have additional properties" };
              if (vErrors === null) {
                vErrors = [err5];
              } else {
                vErrors.push(err5);
              }
              errors++;
            }
          }
          if (data.policy !== void 0) {
            if ("fit" !== data.policy) {
              const err6 = { instancePath: instancePath + "/policy", schemaPath: "#/$defs/FitDomain/properties/policy/const", keyword: "const", params: { allowedValue: "fit" }, message: "must be equal to constant" };
              if (vErrors === null) {
                vErrors = [err6];
              } else {
                vErrors.push(err6);
              }
              errors++;
            }
          }
        } else {
          const err7 = { instancePath, schemaPath: "#/$defs/FitDomain/type", keyword: "type", params: { type: "object" }, message: "must be object" };
          if (vErrors === null) {
            vErrors = [err7];
          } else {
            vErrors.push(err7);
          }
          errors++;
        }
        if (props0 !== true) {
          props0 = true;
        }
      } else if (tag0 === "fixed") {
        if (data && typeof data == "object" && !Array.isArray(data)) {
          if (data.policy === void 0) {
            const err8 = { instancePath, schemaPath: "#/$defs/FixedDomain/required", keyword: "required", params: { missingProperty: "policy" }, message: "must have required property 'policy'" };
            if (vErrors === null) {
              vErrors = [err8];
            } else {
              vErrors.push(err8);
            }
            errors++;
          }
          if (data.min === void 0) {
            const err9 = { instancePath, schemaPath: "#/$defs/FixedDomain/required", keyword: "required", params: { missingProperty: "min" }, message: "must have required property 'min'" };
            if (vErrors === null) {
              vErrors = [err9];
            } else {
              vErrors.push(err9);
            }
            errors++;
          }
          if (data.max === void 0) {
            const err10 = { instancePath, schemaPath: "#/$defs/FixedDomain/required", keyword: "required", params: { missingProperty: "max" }, message: "must have required property 'max'" };
            if (vErrors === null) {
              vErrors = [err10];
            } else {
              vErrors.push(err10);
            }
            errors++;
          }
          for (const key2 in data) {
            if (!(key2 === "policy" || key2 === "min" || key2 === "max" || key2 === "overflow")) {
              const err11 = { instancePath, schemaPath: "#/$defs/FixedDomain/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key2 }, message: "must NOT have additional properties" };
              if (vErrors === null) {
                vErrors = [err11];
              } else {
                vErrors.push(err11);
              }
              errors++;
            }
          }
          if (data.policy !== void 0) {
            if ("fixed" !== data.policy) {
              const err12 = { instancePath: instancePath + "/policy", schemaPath: "#/$defs/FixedDomain/properties/policy/const", keyword: "const", params: { allowedValue: "fixed" }, message: "must be equal to constant" };
              if (vErrors === null) {
                vErrors = [err12];
              } else {
                vErrors.push(err12);
              }
              errors++;
            }
          }
          if (data.min !== void 0) {
            let data3 = data.min;
            if (!(typeof data3 == "number" && isFinite(data3))) {
              const err13 = { instancePath: instancePath + "/min", schemaPath: "#/$defs/FixedDomain/properties/min/type", keyword: "type", params: { type: "number" }, message: "must be number" };
              if (vErrors === null) {
                vErrors = [err13];
              } else {
                vErrors.push(err13);
              }
              errors++;
            }
          }
          if (data.max !== void 0) {
            let data4 = data.max;
            if (!(typeof data4 == "number" && isFinite(data4))) {
              const err14 = { instancePath: instancePath + "/max", schemaPath: "#/$defs/FixedDomain/properties/max/type", keyword: "type", params: { type: "number" }, message: "must be number" };
              if (vErrors === null) {
                vErrors = [err14];
              } else {
                vErrors.push(err14);
              }
              errors++;
            }
          }
          if (data.overflow !== void 0) {
            let data5 = data.overflow;
            if (!(data5 === "error" || data5 === "clip-indicated")) {
              const err15 = { instancePath: instancePath + "/overflow", schemaPath: "#/$defs/FixedDomain/properties/overflow/enum", keyword: "enum", params: { allowedValues: schema58.properties.overflow.enum }, message: "must be equal to one of the allowed values" };
              if (vErrors === null) {
                vErrors = [err15];
              } else {
                vErrors.push(err15);
              }
              errors++;
            }
          }
        } else {
          const err16 = { instancePath, schemaPath: "#/$defs/FixedDomain/type", keyword: "type", params: { type: "object" }, message: "must be object" };
          if (vErrors === null) {
            vErrors = [err16];
          } else {
            vErrors.push(err16);
          }
          errors++;
        }
        if (props0 !== true) {
          props0 = true;
        }
      } else {
        const err17 = { instancePath, schemaPath: "#/discriminator", keyword: "discriminator", params: { error: "mapping", tag: "policy", tagValue: tag0 }, message: 'value of tag "policy" must be in oneOf' };
        if (vErrors === null) {
          vErrors = [err17];
        } else {
          vErrors.push(err17);
        }
        errors++;
      }
    } else {
      const err18 = { instancePath, schemaPath: "#/discriminator", keyword: "discriminator", params: { error: "tag", tag: "policy", tagValue: tag0 }, message: 'tag "policy" must be string' };
      if (vErrors === null) {
        vErrors = [err18];
      } else {
        vErrors.push(err18);
      }
      errors++;
    }
  } else {
    const err19 = { instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" };
    if (vErrors === null) {
      vErrors = [err19];
    } else {
      vErrors.push(err19);
    }
    errors++;
  }
  validate28.errors = vErrors;
  evaluated0.props = props0;
  return errors === 0;
}
validate28.evaluated = { "dynamicProps": true, "dynamicItems": false };
function validate27(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate27.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.id === void 0) {
      const err0 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "id" }, message: "must have required property 'id'" };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.scale === void 0) {
      const err1 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "scale" }, message: "must have required property 'scale'" };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!(key0 === "id" || key0 === "scale" || key0 === "label" || key0 === "unit" || key0 === "format" || key0 === "domain")) {
        const err2 = { instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" };
        if (vErrors === null) {
          vErrors = [err2];
        } else {
          vErrors.push(err2);
        }
        errors++;
      }
    }
    if (data.id !== void 0) {
      let data0 = data.id;
      if (typeof data0 === "string") {
        if (!pattern4.test(data0)) {
          const err3 = { instancePath: instancePath + "/id", schemaPath: "#/$defs/Id/pattern", keyword: "pattern", params: { pattern: "^[A-Za-z][A-Za-z0-9_-]{0,63}$" }, message: 'must match pattern "^[A-Za-z][A-Za-z0-9_-]{0,63}$"' };
          if (vErrors === null) {
            vErrors = [err3];
          } else {
            vErrors.push(err3);
          }
          errors++;
        }
      } else {
        const err4 = { instancePath: instancePath + "/id", schemaPath: "#/$defs/Id/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err4];
        } else {
          vErrors.push(err4);
        }
        errors++;
      }
    }
    if (data.scale !== void 0) {
      if ("linear" !== data.scale) {
        const err5 = { instancePath: instancePath + "/scale", schemaPath: "#/properties/scale/const", keyword: "const", params: { allowedValue: "linear" }, message: "must be equal to constant" };
        if (vErrors === null) {
          vErrors = [err5];
        } else {
          vErrors.push(err5);
        }
        errors++;
      }
    }
    if (data.label !== void 0) {
      let data2 = data.label;
      if (typeof data2 === "string") {
        if (func2(data2) > 500) {
          const err6 = { instancePath: instancePath + "/label", schemaPath: "#/$defs/Text/maxLength", keyword: "maxLength", params: { limit: 500 }, message: "must NOT have more than 500 characters" };
          if (vErrors === null) {
            vErrors = [err6];
          } else {
            vErrors.push(err6);
          }
          errors++;
        }
        if (func2(data2) < 1) {
          const err7 = { instancePath: instancePath + "/label", schemaPath: "#/$defs/Text/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
          if (vErrors === null) {
            vErrors = [err7];
          } else {
            vErrors.push(err7);
          }
          errors++;
        }
        if (!pattern5.test(data2)) {
          const err8 = { instancePath: instancePath + "/label", schemaPath: "#/$defs/Text/pattern", keyword: "pattern", params: { pattern: "^[^\\p{Cc}\\p{Cs}]+$" }, message: 'must match pattern "^[^\\p{Cc}\\p{Cs}]+$"' };
          if (vErrors === null) {
            vErrors = [err8];
          } else {
            vErrors.push(err8);
          }
          errors++;
        }
      } else {
        const err9 = { instancePath: instancePath + "/label", schemaPath: "#/$defs/Text/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err9];
        } else {
          vErrors.push(err9);
        }
        errors++;
      }
    }
    if (data.unit !== void 0) {
      let data3 = data.unit;
      if (typeof data3 === "string") {
        if (func2(data3) > 500) {
          const err10 = { instancePath: instancePath + "/unit", schemaPath: "#/$defs/Text/maxLength", keyword: "maxLength", params: { limit: 500 }, message: "must NOT have more than 500 characters" };
          if (vErrors === null) {
            vErrors = [err10];
          } else {
            vErrors.push(err10);
          }
          errors++;
        }
        if (func2(data3) < 1) {
          const err11 = { instancePath: instancePath + "/unit", schemaPath: "#/$defs/Text/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
          if (vErrors === null) {
            vErrors = [err11];
          } else {
            vErrors.push(err11);
          }
          errors++;
        }
        if (!pattern5.test(data3)) {
          const err12 = { instancePath: instancePath + "/unit", schemaPath: "#/$defs/Text/pattern", keyword: "pattern", params: { pattern: "^[^\\p{Cc}\\p{Cs}]+$" }, message: 'must match pattern "^[^\\p{Cc}\\p{Cs}]+$"' };
          if (vErrors === null) {
            vErrors = [err12];
          } else {
            vErrors.push(err12);
          }
          errors++;
        }
      } else {
        const err13 = { instancePath: instancePath + "/unit", schemaPath: "#/$defs/Text/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err13];
        } else {
          vErrors.push(err13);
        }
        errors++;
      }
    }
    if (data.format !== void 0) {
      let data4 = data.format;
      if (data4 && typeof data4 == "object" && !Array.isArray(data4)) {
        for (const key1 in data4) {
          if (!(key1 === "style" || key1 === "currency" || key1 === "minimumFractionDigits" || key1 === "maximumFractionDigits" || key1 === "signDisplay")) {
            const err14 = { instancePath: instancePath + "/format", schemaPath: "#/$defs/NumberFormat/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key1 }, message: "must NOT have additional properties" };
            if (vErrors === null) {
              vErrors = [err14];
            } else {
              vErrors.push(err14);
            }
            errors++;
          }
        }
        if (data4.style !== void 0) {
          let data5 = data4.style;
          if (!(data5 === "decimal" || data5 === "percent" || data5 === "currency" || data5 === "compact")) {
            const err15 = { instancePath: instancePath + "/format/style", schemaPath: "#/$defs/NumberFormat/properties/style/enum", keyword: "enum", params: { allowedValues: schema54.properties.style.enum }, message: "must be equal to one of the allowed values" };
            if (vErrors === null) {
              vErrors = [err15];
            } else {
              vErrors.push(err15);
            }
            errors++;
          }
        }
        if (data4.currency !== void 0) {
          let data6 = data4.currency;
          if (typeof data6 === "string") {
            if (!pattern18.test(data6)) {
              const err16 = { instancePath: instancePath + "/format/currency", schemaPath: "#/$defs/NumberFormat/properties/currency/pattern", keyword: "pattern", params: { pattern: "^[A-Z]{3}$" }, message: 'must match pattern "^[A-Z]{3}$"' };
              if (vErrors === null) {
                vErrors = [err16];
              } else {
                vErrors.push(err16);
              }
              errors++;
            }
          } else {
            const err17 = { instancePath: instancePath + "/format/currency", schemaPath: "#/$defs/NumberFormat/properties/currency/type", keyword: "type", params: { type: "string" }, message: "must be string" };
            if (vErrors === null) {
              vErrors = [err17];
            } else {
              vErrors.push(err17);
            }
            errors++;
          }
        }
        if (data4.minimumFractionDigits !== void 0) {
          let data7 = data4.minimumFractionDigits;
          if (!(typeof data7 == "number" && (!(data7 % 1) && !isNaN(data7)) && isFinite(data7))) {
            const err18 = { instancePath: instancePath + "/format/minimumFractionDigits", schemaPath: "#/$defs/NumberFormat/properties/minimumFractionDigits/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
            if (vErrors === null) {
              vErrors = [err18];
            } else {
              vErrors.push(err18);
            }
            errors++;
          }
          if (typeof data7 == "number" && isFinite(data7)) {
            if (data7 > 6 || isNaN(data7)) {
              const err19 = { instancePath: instancePath + "/format/minimumFractionDigits", schemaPath: "#/$defs/NumberFormat/properties/minimumFractionDigits/maximum", keyword: "maximum", params: { comparison: "<=", limit: 6 }, message: "must be <= 6" };
              if (vErrors === null) {
                vErrors = [err19];
              } else {
                vErrors.push(err19);
              }
              errors++;
            }
            if (data7 < 0 || isNaN(data7)) {
              const err20 = { instancePath: instancePath + "/format/minimumFractionDigits", schemaPath: "#/$defs/NumberFormat/properties/minimumFractionDigits/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" };
              if (vErrors === null) {
                vErrors = [err20];
              } else {
                vErrors.push(err20);
              }
              errors++;
            }
          }
        }
        if (data4.maximumFractionDigits !== void 0) {
          let data8 = data4.maximumFractionDigits;
          if (!(typeof data8 == "number" && (!(data8 % 1) && !isNaN(data8)) && isFinite(data8))) {
            const err21 = { instancePath: instancePath + "/format/maximumFractionDigits", schemaPath: "#/$defs/NumberFormat/properties/maximumFractionDigits/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
            if (vErrors === null) {
              vErrors = [err21];
            } else {
              vErrors.push(err21);
            }
            errors++;
          }
          if (typeof data8 == "number" && isFinite(data8)) {
            if (data8 > 6 || isNaN(data8)) {
              const err22 = { instancePath: instancePath + "/format/maximumFractionDigits", schemaPath: "#/$defs/NumberFormat/properties/maximumFractionDigits/maximum", keyword: "maximum", params: { comparison: "<=", limit: 6 }, message: "must be <= 6" };
              if (vErrors === null) {
                vErrors = [err22];
              } else {
                vErrors.push(err22);
              }
              errors++;
            }
            if (data8 < 0 || isNaN(data8)) {
              const err23 = { instancePath: instancePath + "/format/maximumFractionDigits", schemaPath: "#/$defs/NumberFormat/properties/maximumFractionDigits/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" };
              if (vErrors === null) {
                vErrors = [err23];
              } else {
                vErrors.push(err23);
              }
              errors++;
            }
          }
        }
        if (data4.signDisplay !== void 0) {
          let data9 = data4.signDisplay;
          if (!(data9 === "auto" || data9 === "always" || data9 === "exceptZero")) {
            const err24 = { instancePath: instancePath + "/format/signDisplay", schemaPath: "#/$defs/NumberFormat/properties/signDisplay/enum", keyword: "enum", params: { allowedValues: schema54.properties.signDisplay.enum }, message: "must be equal to one of the allowed values" };
            if (vErrors === null) {
              vErrors = [err24];
            } else {
              vErrors.push(err24);
            }
            errors++;
          }
        }
      } else {
        const err25 = { instancePath: instancePath + "/format", schemaPath: "#/$defs/NumberFormat/type", keyword: "type", params: { type: "object" }, message: "must be object" };
        if (vErrors === null) {
          vErrors = [err25];
        } else {
          vErrors.push(err25);
        }
        errors++;
      }
    }
    if (data.domain !== void 0) {
      if (!validate28(data.domain, { instancePath: instancePath + "/domain", parentData: data, parentDataProperty: "domain", rootData, dynamicAnchors })) {
        vErrors = vErrors === null ? validate28.errors : vErrors.concat(validate28.errors);
        errors = vErrors.length;
      }
    }
  } else {
    const err26 = { instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" };
    if (vErrors === null) {
      vErrors = [err26];
    } else {
      vErrors.push(err26);
    }
    errors++;
  }
  validate27.errors = vErrors;
  return errors === 0;
}
validate27.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
var schema59 = { "title": "TimeAxis", "type": "object", "properties": { "id": { "$ref": "#/$defs/Id" }, "scale": { "const": "time" }, "label": { "$ref": "#/$defs/Text" }, "domain": { "type": "object", "properties": { "min": { "$ref": "#/$defs/IsoTime" }, "max": { "$ref": "#/$defs/IsoTime" } }, "additionalProperties": false }, "tickFormat": { "enum": ["auto", "day", "week", "month", "quarter", "year", "hour"] } }, "required": ["id", "scale"], "additionalProperties": false };
var pattern21 = new RegExp("^\\d{4}-\\d{2}-\\d{2}(?:T\\d{2}:\\d{2}(?::\\d{2}(?:\\.\\d{1,9})?)?(?:Z|[+-]\\d{2}:\\d{2}))?$", "u");
function validate30(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate30.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.id === void 0) {
      const err0 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "id" }, message: "must have required property 'id'" };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.scale === void 0) {
      const err1 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "scale" }, message: "must have required property 'scale'" };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!(key0 === "id" || key0 === "scale" || key0 === "label" || key0 === "domain" || key0 === "tickFormat")) {
        const err2 = { instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" };
        if (vErrors === null) {
          vErrors = [err2];
        } else {
          vErrors.push(err2);
        }
        errors++;
      }
    }
    if (data.id !== void 0) {
      let data0 = data.id;
      if (typeof data0 === "string") {
        if (!pattern4.test(data0)) {
          const err3 = { instancePath: instancePath + "/id", schemaPath: "#/$defs/Id/pattern", keyword: "pattern", params: { pattern: "^[A-Za-z][A-Za-z0-9_-]{0,63}$" }, message: 'must match pattern "^[A-Za-z][A-Za-z0-9_-]{0,63}$"' };
          if (vErrors === null) {
            vErrors = [err3];
          } else {
            vErrors.push(err3);
          }
          errors++;
        }
      } else {
        const err4 = { instancePath: instancePath + "/id", schemaPath: "#/$defs/Id/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err4];
        } else {
          vErrors.push(err4);
        }
        errors++;
      }
    }
    if (data.scale !== void 0) {
      if ("time" !== data.scale) {
        const err5 = { instancePath: instancePath + "/scale", schemaPath: "#/properties/scale/const", keyword: "const", params: { allowedValue: "time" }, message: "must be equal to constant" };
        if (vErrors === null) {
          vErrors = [err5];
        } else {
          vErrors.push(err5);
        }
        errors++;
      }
    }
    if (data.label !== void 0) {
      let data2 = data.label;
      if (typeof data2 === "string") {
        if (func2(data2) > 500) {
          const err6 = { instancePath: instancePath + "/label", schemaPath: "#/$defs/Text/maxLength", keyword: "maxLength", params: { limit: 500 }, message: "must NOT have more than 500 characters" };
          if (vErrors === null) {
            vErrors = [err6];
          } else {
            vErrors.push(err6);
          }
          errors++;
        }
        if (func2(data2) < 1) {
          const err7 = { instancePath: instancePath + "/label", schemaPath: "#/$defs/Text/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
          if (vErrors === null) {
            vErrors = [err7];
          } else {
            vErrors.push(err7);
          }
          errors++;
        }
        if (!pattern5.test(data2)) {
          const err8 = { instancePath: instancePath + "/label", schemaPath: "#/$defs/Text/pattern", keyword: "pattern", params: { pattern: "^[^\\p{Cc}\\p{Cs}]+$" }, message: 'must match pattern "^[^\\p{Cc}\\p{Cs}]+$"' };
          if (vErrors === null) {
            vErrors = [err8];
          } else {
            vErrors.push(err8);
          }
          errors++;
        }
      } else {
        const err9 = { instancePath: instancePath + "/label", schemaPath: "#/$defs/Text/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err9];
        } else {
          vErrors.push(err9);
        }
        errors++;
      }
    }
    if (data.domain !== void 0) {
      let data3 = data.domain;
      if (data3 && typeof data3 == "object" && !Array.isArray(data3)) {
        for (const key1 in data3) {
          if (!(key1 === "min" || key1 === "max")) {
            const err10 = { instancePath: instancePath + "/domain", schemaPath: "#/properties/domain/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key1 }, message: "must NOT have additional properties" };
            if (vErrors === null) {
              vErrors = [err10];
            } else {
              vErrors.push(err10);
            }
            errors++;
          }
        }
        if (data3.min !== void 0) {
          let data4 = data3.min;
          if (typeof data4 === "string") {
            if (func2(data4) > 64) {
              const err11 = { instancePath: instancePath + "/domain/min", schemaPath: "#/$defs/IsoTime/maxLength", keyword: "maxLength", params: { limit: 64 }, message: "must NOT have more than 64 characters" };
              if (vErrors === null) {
                vErrors = [err11];
              } else {
                vErrors.push(err11);
              }
              errors++;
            }
            if (!pattern21.test(data4)) {
              const err12 = { instancePath: instancePath + "/domain/min", schemaPath: "#/$defs/IsoTime/pattern", keyword: "pattern", params: { pattern: "^\\d{4}-\\d{2}-\\d{2}(?:T\\d{2}:\\d{2}(?::\\d{2}(?:\\.\\d{1,9})?)?(?:Z|[+-]\\d{2}:\\d{2}))?$" }, message: 'must match pattern "^\\d{4}-\\d{2}-\\d{2}(?:T\\d{2}:\\d{2}(?::\\d{2}(?:\\.\\d{1,9})?)?(?:Z|[+-]\\d{2}:\\d{2}))?$"' };
              if (vErrors === null) {
                vErrors = [err12];
              } else {
                vErrors.push(err12);
              }
              errors++;
            }
          } else {
            const err13 = { instancePath: instancePath + "/domain/min", schemaPath: "#/$defs/IsoTime/type", keyword: "type", params: { type: "string" }, message: "must be string" };
            if (vErrors === null) {
              vErrors = [err13];
            } else {
              vErrors.push(err13);
            }
            errors++;
          }
        }
        if (data3.max !== void 0) {
          let data5 = data3.max;
          if (typeof data5 === "string") {
            if (func2(data5) > 64) {
              const err14 = { instancePath: instancePath + "/domain/max", schemaPath: "#/$defs/IsoTime/maxLength", keyword: "maxLength", params: { limit: 64 }, message: "must NOT have more than 64 characters" };
              if (vErrors === null) {
                vErrors = [err14];
              } else {
                vErrors.push(err14);
              }
              errors++;
            }
            if (!pattern21.test(data5)) {
              const err15 = { instancePath: instancePath + "/domain/max", schemaPath: "#/$defs/IsoTime/pattern", keyword: "pattern", params: { pattern: "^\\d{4}-\\d{2}-\\d{2}(?:T\\d{2}:\\d{2}(?::\\d{2}(?:\\.\\d{1,9})?)?(?:Z|[+-]\\d{2}:\\d{2}))?$" }, message: 'must match pattern "^\\d{4}-\\d{2}-\\d{2}(?:T\\d{2}:\\d{2}(?::\\d{2}(?:\\.\\d{1,9})?)?(?:Z|[+-]\\d{2}:\\d{2}))?$"' };
              if (vErrors === null) {
                vErrors = [err15];
              } else {
                vErrors.push(err15);
              }
              errors++;
            }
          } else {
            const err16 = { instancePath: instancePath + "/domain/max", schemaPath: "#/$defs/IsoTime/type", keyword: "type", params: { type: "string" }, message: "must be string" };
            if (vErrors === null) {
              vErrors = [err16];
            } else {
              vErrors.push(err16);
            }
            errors++;
          }
        }
      } else {
        const err17 = { instancePath: instancePath + "/domain", schemaPath: "#/properties/domain/type", keyword: "type", params: { type: "object" }, message: "must be object" };
        if (vErrors === null) {
          vErrors = [err17];
        } else {
          vErrors.push(err17);
        }
        errors++;
      }
    }
    if (data.tickFormat !== void 0) {
      let data6 = data.tickFormat;
      if (!(data6 === "auto" || data6 === "day" || data6 === "week" || data6 === "month" || data6 === "quarter" || data6 === "year" || data6 === "hour")) {
        const err18 = { instancePath: instancePath + "/tickFormat", schemaPath: "#/properties/tickFormat/enum", keyword: "enum", params: { allowedValues: schema59.properties.tickFormat.enum }, message: "must be equal to one of the allowed values" };
        if (vErrors === null) {
          vErrors = [err18];
        } else {
          vErrors.push(err18);
        }
        errors++;
      }
    }
  } else {
    const err19 = { instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" };
    if (vErrors === null) {
      vErrors = [err19];
    } else {
      vErrors.push(err19);
    }
    errors++;
  }
  validate30.errors = vErrors;
  return errors === 0;
}
validate30.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
var schema64 = { "title": "ValueAxis", "type": "object", "properties": { "id": { "$ref": "#/$defs/Id" }, "label": { "$ref": "#/$defs/Text" }, "unit": { "$ref": "#/$defs/Text" }, "format": { "$ref": "#/$defs/NumberFormat" }, "position": { "enum": ["left", "right"] }, "domain": { "$ref": "#/$defs/Domain" }, "ticks": { "type": "object", "properties": { "count": { "type": "integer", "minimum": 2, "maximum": 10 }, "values": { "type": "array", "items": { "type": "number" } } }, "additionalProperties": false } }, "required": ["id"], "additionalProperties": false };
function validate34(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate34.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.id === void 0) {
      const err0 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "id" }, message: "must have required property 'id'" };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!(key0 === "id" || key0 === "label" || key0 === "unit" || key0 === "format" || key0 === "position" || key0 === "domain" || key0 === "ticks")) {
        const err1 = { instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" };
        if (vErrors === null) {
          vErrors = [err1];
        } else {
          vErrors.push(err1);
        }
        errors++;
      }
    }
    if (data.id !== void 0) {
      let data0 = data.id;
      if (typeof data0 === "string") {
        if (!pattern4.test(data0)) {
          const err2 = { instancePath: instancePath + "/id", schemaPath: "#/$defs/Id/pattern", keyword: "pattern", params: { pattern: "^[A-Za-z][A-Za-z0-9_-]{0,63}$" }, message: 'must match pattern "^[A-Za-z][A-Za-z0-9_-]{0,63}$"' };
          if (vErrors === null) {
            vErrors = [err2];
          } else {
            vErrors.push(err2);
          }
          errors++;
        }
      } else {
        const err3 = { instancePath: instancePath + "/id", schemaPath: "#/$defs/Id/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err3];
        } else {
          vErrors.push(err3);
        }
        errors++;
      }
    }
    if (data.label !== void 0) {
      let data1 = data.label;
      if (typeof data1 === "string") {
        if (func2(data1) > 500) {
          const err4 = { instancePath: instancePath + "/label", schemaPath: "#/$defs/Text/maxLength", keyword: "maxLength", params: { limit: 500 }, message: "must NOT have more than 500 characters" };
          if (vErrors === null) {
            vErrors = [err4];
          } else {
            vErrors.push(err4);
          }
          errors++;
        }
        if (func2(data1) < 1) {
          const err5 = { instancePath: instancePath + "/label", schemaPath: "#/$defs/Text/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
          if (vErrors === null) {
            vErrors = [err5];
          } else {
            vErrors.push(err5);
          }
          errors++;
        }
        if (!pattern5.test(data1)) {
          const err6 = { instancePath: instancePath + "/label", schemaPath: "#/$defs/Text/pattern", keyword: "pattern", params: { pattern: "^[^\\p{Cc}\\p{Cs}]+$" }, message: 'must match pattern "^[^\\p{Cc}\\p{Cs}]+$"' };
          if (vErrors === null) {
            vErrors = [err6];
          } else {
            vErrors.push(err6);
          }
          errors++;
        }
      } else {
        const err7 = { instancePath: instancePath + "/label", schemaPath: "#/$defs/Text/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err7];
        } else {
          vErrors.push(err7);
        }
        errors++;
      }
    }
    if (data.unit !== void 0) {
      let data2 = data.unit;
      if (typeof data2 === "string") {
        if (func2(data2) > 500) {
          const err8 = { instancePath: instancePath + "/unit", schemaPath: "#/$defs/Text/maxLength", keyword: "maxLength", params: { limit: 500 }, message: "must NOT have more than 500 characters" };
          if (vErrors === null) {
            vErrors = [err8];
          } else {
            vErrors.push(err8);
          }
          errors++;
        }
        if (func2(data2) < 1) {
          const err9 = { instancePath: instancePath + "/unit", schemaPath: "#/$defs/Text/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
          if (vErrors === null) {
            vErrors = [err9];
          } else {
            vErrors.push(err9);
          }
          errors++;
        }
        if (!pattern5.test(data2)) {
          const err10 = { instancePath: instancePath + "/unit", schemaPath: "#/$defs/Text/pattern", keyword: "pattern", params: { pattern: "^[^\\p{Cc}\\p{Cs}]+$" }, message: 'must match pattern "^[^\\p{Cc}\\p{Cs}]+$"' };
          if (vErrors === null) {
            vErrors = [err10];
          } else {
            vErrors.push(err10);
          }
          errors++;
        }
      } else {
        const err11 = { instancePath: instancePath + "/unit", schemaPath: "#/$defs/Text/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err11];
        } else {
          vErrors.push(err11);
        }
        errors++;
      }
    }
    if (data.format !== void 0) {
      let data3 = data.format;
      if (data3 && typeof data3 == "object" && !Array.isArray(data3)) {
        for (const key1 in data3) {
          if (!(key1 === "style" || key1 === "currency" || key1 === "minimumFractionDigits" || key1 === "maximumFractionDigits" || key1 === "signDisplay")) {
            const err12 = { instancePath: instancePath + "/format", schemaPath: "#/$defs/NumberFormat/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key1 }, message: "must NOT have additional properties" };
            if (vErrors === null) {
              vErrors = [err12];
            } else {
              vErrors.push(err12);
            }
            errors++;
          }
        }
        if (data3.style !== void 0) {
          let data4 = data3.style;
          if (!(data4 === "decimal" || data4 === "percent" || data4 === "currency" || data4 === "compact")) {
            const err13 = { instancePath: instancePath + "/format/style", schemaPath: "#/$defs/NumberFormat/properties/style/enum", keyword: "enum", params: { allowedValues: schema54.properties.style.enum }, message: "must be equal to one of the allowed values" };
            if (vErrors === null) {
              vErrors = [err13];
            } else {
              vErrors.push(err13);
            }
            errors++;
          }
        }
        if (data3.currency !== void 0) {
          let data5 = data3.currency;
          if (typeof data5 === "string") {
            if (!pattern18.test(data5)) {
              const err14 = { instancePath: instancePath + "/format/currency", schemaPath: "#/$defs/NumberFormat/properties/currency/pattern", keyword: "pattern", params: { pattern: "^[A-Z]{3}$" }, message: 'must match pattern "^[A-Z]{3}$"' };
              if (vErrors === null) {
                vErrors = [err14];
              } else {
                vErrors.push(err14);
              }
              errors++;
            }
          } else {
            const err15 = { instancePath: instancePath + "/format/currency", schemaPath: "#/$defs/NumberFormat/properties/currency/type", keyword: "type", params: { type: "string" }, message: "must be string" };
            if (vErrors === null) {
              vErrors = [err15];
            } else {
              vErrors.push(err15);
            }
            errors++;
          }
        }
        if (data3.minimumFractionDigits !== void 0) {
          let data6 = data3.minimumFractionDigits;
          if (!(typeof data6 == "number" && (!(data6 % 1) && !isNaN(data6)) && isFinite(data6))) {
            const err16 = { instancePath: instancePath + "/format/minimumFractionDigits", schemaPath: "#/$defs/NumberFormat/properties/minimumFractionDigits/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
            if (vErrors === null) {
              vErrors = [err16];
            } else {
              vErrors.push(err16);
            }
            errors++;
          }
          if (typeof data6 == "number" && isFinite(data6)) {
            if (data6 > 6 || isNaN(data6)) {
              const err17 = { instancePath: instancePath + "/format/minimumFractionDigits", schemaPath: "#/$defs/NumberFormat/properties/minimumFractionDigits/maximum", keyword: "maximum", params: { comparison: "<=", limit: 6 }, message: "must be <= 6" };
              if (vErrors === null) {
                vErrors = [err17];
              } else {
                vErrors.push(err17);
              }
              errors++;
            }
            if (data6 < 0 || isNaN(data6)) {
              const err18 = { instancePath: instancePath + "/format/minimumFractionDigits", schemaPath: "#/$defs/NumberFormat/properties/minimumFractionDigits/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" };
              if (vErrors === null) {
                vErrors = [err18];
              } else {
                vErrors.push(err18);
              }
              errors++;
            }
          }
        }
        if (data3.maximumFractionDigits !== void 0) {
          let data7 = data3.maximumFractionDigits;
          if (!(typeof data7 == "number" && (!(data7 % 1) && !isNaN(data7)) && isFinite(data7))) {
            const err19 = { instancePath: instancePath + "/format/maximumFractionDigits", schemaPath: "#/$defs/NumberFormat/properties/maximumFractionDigits/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
            if (vErrors === null) {
              vErrors = [err19];
            } else {
              vErrors.push(err19);
            }
            errors++;
          }
          if (typeof data7 == "number" && isFinite(data7)) {
            if (data7 > 6 || isNaN(data7)) {
              const err20 = { instancePath: instancePath + "/format/maximumFractionDigits", schemaPath: "#/$defs/NumberFormat/properties/maximumFractionDigits/maximum", keyword: "maximum", params: { comparison: "<=", limit: 6 }, message: "must be <= 6" };
              if (vErrors === null) {
                vErrors = [err20];
              } else {
                vErrors.push(err20);
              }
              errors++;
            }
            if (data7 < 0 || isNaN(data7)) {
              const err21 = { instancePath: instancePath + "/format/maximumFractionDigits", schemaPath: "#/$defs/NumberFormat/properties/maximumFractionDigits/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" };
              if (vErrors === null) {
                vErrors = [err21];
              } else {
                vErrors.push(err21);
              }
              errors++;
            }
          }
        }
        if (data3.signDisplay !== void 0) {
          let data8 = data3.signDisplay;
          if (!(data8 === "auto" || data8 === "always" || data8 === "exceptZero")) {
            const err22 = { instancePath: instancePath + "/format/signDisplay", schemaPath: "#/$defs/NumberFormat/properties/signDisplay/enum", keyword: "enum", params: { allowedValues: schema54.properties.signDisplay.enum }, message: "must be equal to one of the allowed values" };
            if (vErrors === null) {
              vErrors = [err22];
            } else {
              vErrors.push(err22);
            }
            errors++;
          }
        }
      } else {
        const err23 = { instancePath: instancePath + "/format", schemaPath: "#/$defs/NumberFormat/type", keyword: "type", params: { type: "object" }, message: "must be object" };
        if (vErrors === null) {
          vErrors = [err23];
        } else {
          vErrors.push(err23);
        }
        errors++;
      }
    }
    if (data.position !== void 0) {
      let data9 = data.position;
      if (!(data9 === "left" || data9 === "right")) {
        const err24 = { instancePath: instancePath + "/position", schemaPath: "#/properties/position/enum", keyword: "enum", params: { allowedValues: schema64.properties.position.enum }, message: "must be equal to one of the allowed values" };
        if (vErrors === null) {
          vErrors = [err24];
        } else {
          vErrors.push(err24);
        }
        errors++;
      }
    }
    if (data.domain !== void 0) {
      if (!validate28(data.domain, { instancePath: instancePath + "/domain", parentData: data, parentDataProperty: "domain", rootData, dynamicAnchors })) {
        vErrors = vErrors === null ? validate28.errors : vErrors.concat(validate28.errors);
        errors = vErrors.length;
      }
    }
    if (data.ticks !== void 0) {
      let data11 = data.ticks;
      if (data11 && typeof data11 == "object" && !Array.isArray(data11)) {
        for (const key2 in data11) {
          if (!(key2 === "count" || key2 === "values")) {
            const err25 = { instancePath: instancePath + "/ticks", schemaPath: "#/properties/ticks/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key2 }, message: "must NOT have additional properties" };
            if (vErrors === null) {
              vErrors = [err25];
            } else {
              vErrors.push(err25);
            }
            errors++;
          }
        }
        if (data11.count !== void 0) {
          let data12 = data11.count;
          if (!(typeof data12 == "number" && (!(data12 % 1) && !isNaN(data12)) && isFinite(data12))) {
            const err26 = { instancePath: instancePath + "/ticks/count", schemaPath: "#/properties/ticks/properties/count/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
            if (vErrors === null) {
              vErrors = [err26];
            } else {
              vErrors.push(err26);
            }
            errors++;
          }
          if (typeof data12 == "number" && isFinite(data12)) {
            if (data12 > 10 || isNaN(data12)) {
              const err27 = { instancePath: instancePath + "/ticks/count", schemaPath: "#/properties/ticks/properties/count/maximum", keyword: "maximum", params: { comparison: "<=", limit: 10 }, message: "must be <= 10" };
              if (vErrors === null) {
                vErrors = [err27];
              } else {
                vErrors.push(err27);
              }
              errors++;
            }
            if (data12 < 2 || isNaN(data12)) {
              const err28 = { instancePath: instancePath + "/ticks/count", schemaPath: "#/properties/ticks/properties/count/minimum", keyword: "minimum", params: { comparison: ">=", limit: 2 }, message: "must be >= 2" };
              if (vErrors === null) {
                vErrors = [err28];
              } else {
                vErrors.push(err28);
              }
              errors++;
            }
          }
        }
        if (data11.values !== void 0) {
          let data13 = data11.values;
          if (Array.isArray(data13)) {
            const len0 = data13.length;
            for (let i0 = 0; i0 < len0; i0++) {
              let data14 = data13[i0];
              if (!(typeof data14 == "number" && isFinite(data14))) {
                const err29 = { instancePath: instancePath + "/ticks/values/" + i0, schemaPath: "#/properties/ticks/properties/values/items/type", keyword: "type", params: { type: "number" }, message: "must be number" };
                if (vErrors === null) {
                  vErrors = [err29];
                } else {
                  vErrors.push(err29);
                }
                errors++;
              }
            }
          } else {
            const err30 = { instancePath: instancePath + "/ticks/values", schemaPath: "#/properties/ticks/properties/values/type", keyword: "type", params: { type: "array" }, message: "must be array" };
            if (vErrors === null) {
              vErrors = [err30];
            } else {
              vErrors.push(err30);
            }
            errors++;
          }
        }
      } else {
        const err31 = { instancePath: instancePath + "/ticks", schemaPath: "#/properties/ticks/type", keyword: "type", params: { type: "object" }, message: "must be object" };
        if (vErrors === null) {
          vErrors = [err31];
        } else {
          vErrors.push(err31);
        }
        errors++;
      }
    }
  } else {
    const err32 = { instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" };
    if (vErrors === null) {
      vErrors = [err32];
    } else {
      vErrors.push(err32);
    }
    errors++;
  }
  validate34.errors = vErrors;
  return errors === 0;
}
validate34.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
var schema69 = { "title": "Series", "type": "object", "properties": { "id": { "$ref": "#/$defs/Id" }, "label": { "$ref": "#/$defs/Text" }, "mark": { "enum": ["bar", "line", "area", "scatter"] }, "yAxisId": { "$ref": "#/$defs/Id" }, "role": { "$ref": "#/$defs/Id" }, "color": { "$ref": "#/$defs/Color" }, "stackId": { "$ref": "#/$defs/Id" }, "interpolation": { "enum": ["linear", "monotone"] }, "dash": { "$ref": "#/$defs/Dash" }, "marker": { "type": "object", "properties": { "shape": { "$ref": "#/$defs/MarkerShape" }, "show": { "enum": ["all", "none", "quality"] } }, "additionalProperties": false }, "points": { "type": "array", "items": { "$ref": "#/$defs/Point" } } }, "required": ["id", "label", "mark", "yAxisId", "points"], "additionalProperties": false };
var schema76 = { "title": "Dash", "enum": ["solid", "dashed", "dotted"] };
var schema78 = { "title": "Point", "type": "object", "properties": { "id": { "$ref": "#/$defs/Id" }, "x": { "anyOf": [{ "$ref": "#/$defs/Text" }, { "type": "number" }] }, "value": { "type": ["number", "null"], "description": "y value; null means missing." }, "displayValue": { "$ref": "#/$defs/Text" }, "quality": { "$ref": "#/$defs/Quality" }, "renderHint": { "enum": ["line", "marker-only", "gap"] }, "role": { "$ref": "#/$defs/Id" }, "color": { "$ref": "#/$defs/Color" }, "shape": { "$ref": "#/$defs/MarkerShape" }, "size": { "type": ["number", "null"], "description": "Scatter only; requires `bubble`." }, "datumLabel": { "$ref": "#/$defs/Text" }, "staticLabel": { "type": "boolean" }, "note": { "$ref": "#/$defs/Text" } }, "required": ["id", "x", "value"], "additionalProperties": false };
var schema82 = { "title": "Quality", "enum": ["measured", "partial", "lagging", "estimated"] };
function validate38(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate38.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.id === void 0) {
      const err0 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "id" }, message: "must have required property 'id'" };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.x === void 0) {
      const err1 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "x" }, message: "must have required property 'x'" };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    if (data.value === void 0) {
      const err2 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "value" }, message: "must have required property 'value'" };
      if (vErrors === null) {
        vErrors = [err2];
      } else {
        vErrors.push(err2);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!func1.call(schema78.properties, key0)) {
        const err3 = { instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" };
        if (vErrors === null) {
          vErrors = [err3];
        } else {
          vErrors.push(err3);
        }
        errors++;
      }
    }
    if (data.id !== void 0) {
      let data0 = data.id;
      if (typeof data0 === "string") {
        if (!pattern4.test(data0)) {
          const err4 = { instancePath: instancePath + "/id", schemaPath: "#/$defs/Id/pattern", keyword: "pattern", params: { pattern: "^[A-Za-z][A-Za-z0-9_-]{0,63}$" }, message: 'must match pattern "^[A-Za-z][A-Za-z0-9_-]{0,63}$"' };
          if (vErrors === null) {
            vErrors = [err4];
          } else {
            vErrors.push(err4);
          }
          errors++;
        }
      } else {
        const err5 = { instancePath: instancePath + "/id", schemaPath: "#/$defs/Id/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err5];
        } else {
          vErrors.push(err5);
        }
        errors++;
      }
    }
    if (data.x !== void 0) {
      let data1 = data.x;
      const _errs6 = errors;
      let valid2 = false;
      const _errs7 = errors;
      if (typeof data1 === "string") {
        if (func2(data1) > 500) {
          const err6 = { instancePath: instancePath + "/x", schemaPath: "#/$defs/Text/maxLength", keyword: "maxLength", params: { limit: 500 }, message: "must NOT have more than 500 characters" };
          if (vErrors === null) {
            vErrors = [err6];
          } else {
            vErrors.push(err6);
          }
          errors++;
        }
        if (func2(data1) < 1) {
          const err7 = { instancePath: instancePath + "/x", schemaPath: "#/$defs/Text/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
          if (vErrors === null) {
            vErrors = [err7];
          } else {
            vErrors.push(err7);
          }
          errors++;
        }
        if (!pattern5.test(data1)) {
          const err8 = { instancePath: instancePath + "/x", schemaPath: "#/$defs/Text/pattern", keyword: "pattern", params: { pattern: "^[^\\p{Cc}\\p{Cs}]+$" }, message: 'must match pattern "^[^\\p{Cc}\\p{Cs}]+$"' };
          if (vErrors === null) {
            vErrors = [err8];
          } else {
            vErrors.push(err8);
          }
          errors++;
        }
      } else {
        const err9 = { instancePath: instancePath + "/x", schemaPath: "#/$defs/Text/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err9];
        } else {
          vErrors.push(err9);
        }
        errors++;
      }
      var _valid0 = _errs7 === errors;
      valid2 = valid2 || _valid0;
      const _errs10 = errors;
      if (!(typeof data1 == "number" && isFinite(data1))) {
        const err10 = { instancePath: instancePath + "/x", schemaPath: "#/properties/x/anyOf/1/type", keyword: "type", params: { type: "number" }, message: "must be number" };
        if (vErrors === null) {
          vErrors = [err10];
        } else {
          vErrors.push(err10);
        }
        errors++;
      }
      var _valid0 = _errs10 === errors;
      valid2 = valid2 || _valid0;
      if (!valid2) {
        const err11 = { instancePath: instancePath + "/x", schemaPath: "#/properties/x/anyOf", keyword: "anyOf", params: {}, message: "must match a schema in anyOf" };
        if (vErrors === null) {
          vErrors = [err11];
        } else {
          vErrors.push(err11);
        }
        errors++;
      } else {
        errors = _errs6;
        if (vErrors !== null) {
          if (_errs6) {
            vErrors.length = _errs6;
          } else {
            vErrors = null;
          }
        }
      }
    }
    if (data.value !== void 0) {
      let data2 = data.value;
      if (!(typeof data2 == "number" && isFinite(data2)) && data2 !== null) {
        const err12 = { instancePath: instancePath + "/value", schemaPath: "#/properties/value/type", keyword: "type", params: { type: schema78.properties.value.type }, message: "must be number,null" };
        if (vErrors === null) {
          vErrors = [err12];
        } else {
          vErrors.push(err12);
        }
        errors++;
      }
    }
    if (data.displayValue !== void 0) {
      let data3 = data.displayValue;
      if (typeof data3 === "string") {
        if (func2(data3) > 500) {
          const err13 = { instancePath: instancePath + "/displayValue", schemaPath: "#/$defs/Text/maxLength", keyword: "maxLength", params: { limit: 500 }, message: "must NOT have more than 500 characters" };
          if (vErrors === null) {
            vErrors = [err13];
          } else {
            vErrors.push(err13);
          }
          errors++;
        }
        if (func2(data3) < 1) {
          const err14 = { instancePath: instancePath + "/displayValue", schemaPath: "#/$defs/Text/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
          if (vErrors === null) {
            vErrors = [err14];
          } else {
            vErrors.push(err14);
          }
          errors++;
        }
        if (!pattern5.test(data3)) {
          const err15 = { instancePath: instancePath + "/displayValue", schemaPath: "#/$defs/Text/pattern", keyword: "pattern", params: { pattern: "^[^\\p{Cc}\\p{Cs}]+$" }, message: 'must match pattern "^[^\\p{Cc}\\p{Cs}]+$"' };
          if (vErrors === null) {
            vErrors = [err15];
          } else {
            vErrors.push(err15);
          }
          errors++;
        }
      } else {
        const err16 = { instancePath: instancePath + "/displayValue", schemaPath: "#/$defs/Text/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err16];
        } else {
          vErrors.push(err16);
        }
        errors++;
      }
    }
    if (data.quality !== void 0) {
      let data4 = data.quality;
      if (!(data4 === "measured" || data4 === "partial" || data4 === "lagging" || data4 === "estimated")) {
        const err17 = { instancePath: instancePath + "/quality", schemaPath: "#/$defs/Quality/enum", keyword: "enum", params: { allowedValues: schema82.enum }, message: "must be equal to one of the allowed values" };
        if (vErrors === null) {
          vErrors = [err17];
        } else {
          vErrors.push(err17);
        }
        errors++;
      }
    }
    if (data.renderHint !== void 0) {
      let data5 = data.renderHint;
      if (!(data5 === "line" || data5 === "marker-only" || data5 === "gap")) {
        const err18 = { instancePath: instancePath + "/renderHint", schemaPath: "#/properties/renderHint/enum", keyword: "enum", params: { allowedValues: schema78.properties.renderHint.enum }, message: "must be equal to one of the allowed values" };
        if (vErrors === null) {
          vErrors = [err18];
        } else {
          vErrors.push(err18);
        }
        errors++;
      }
    }
    if (data.role !== void 0) {
      let data6 = data.role;
      if (typeof data6 === "string") {
        if (!pattern4.test(data6)) {
          const err19 = { instancePath: instancePath + "/role", schemaPath: "#/$defs/Id/pattern", keyword: "pattern", params: { pattern: "^[A-Za-z][A-Za-z0-9_-]{0,63}$" }, message: 'must match pattern "^[A-Za-z][A-Za-z0-9_-]{0,63}$"' };
          if (vErrors === null) {
            vErrors = [err19];
          } else {
            vErrors.push(err19);
          }
          errors++;
        }
      } else {
        const err20 = { instancePath: instancePath + "/role", schemaPath: "#/$defs/Id/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err20];
        } else {
          vErrors.push(err20);
        }
        errors++;
      }
    }
    if (data.color !== void 0) {
      let data7 = data.color;
      if (typeof data7 === "string") {
        if (!pattern10.test(data7)) {
          const err21 = { instancePath: instancePath + "/color", schemaPath: "#/$defs/Color/pattern", keyword: "pattern", params: { pattern: "^#[0-9a-fA-F]{6}$" }, message: 'must match pattern "^#[0-9a-fA-F]{6}$"' };
          if (vErrors === null) {
            vErrors = [err21];
          } else {
            vErrors.push(err21);
          }
          errors++;
        }
      } else {
        const err22 = { instancePath: instancePath + "/color", schemaPath: "#/$defs/Color/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err22];
        } else {
          vErrors.push(err22);
        }
        errors++;
      }
    }
    if (data.shape !== void 0) {
      let data8 = data.shape;
      if (!(data8 === "circle" || data8 === "square" || data8 === "triangle" || data8 === "diamond" || data8 === "cross" || data8 === "none")) {
        const err23 = { instancePath: instancePath + "/shape", schemaPath: "#/$defs/MarkerShape/enum", keyword: "enum", params: { allowedValues: schema43.enum }, message: "must be equal to one of the allowed values" };
        if (vErrors === null) {
          vErrors = [err23];
        } else {
          vErrors.push(err23);
        }
        errors++;
      }
    }
    if (data.size !== void 0) {
      let data9 = data.size;
      if (!(typeof data9 == "number" && isFinite(data9)) && data9 !== null) {
        const err24 = { instancePath: instancePath + "/size", schemaPath: "#/properties/size/type", keyword: "type", params: { type: schema78.properties.size.type }, message: "must be number,null" };
        if (vErrors === null) {
          vErrors = [err24];
        } else {
          vErrors.push(err24);
        }
        errors++;
      }
    }
    if (data.datumLabel !== void 0) {
      let data10 = data.datumLabel;
      if (typeof data10 === "string") {
        if (func2(data10) > 500) {
          const err25 = { instancePath: instancePath + "/datumLabel", schemaPath: "#/$defs/Text/maxLength", keyword: "maxLength", params: { limit: 500 }, message: "must NOT have more than 500 characters" };
          if (vErrors === null) {
            vErrors = [err25];
          } else {
            vErrors.push(err25);
          }
          errors++;
        }
        if (func2(data10) < 1) {
          const err26 = { instancePath: instancePath + "/datumLabel", schemaPath: "#/$defs/Text/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
          if (vErrors === null) {
            vErrors = [err26];
          } else {
            vErrors.push(err26);
          }
          errors++;
        }
        if (!pattern5.test(data10)) {
          const err27 = { instancePath: instancePath + "/datumLabel", schemaPath: "#/$defs/Text/pattern", keyword: "pattern", params: { pattern: "^[^\\p{Cc}\\p{Cs}]+$" }, message: 'must match pattern "^[^\\p{Cc}\\p{Cs}]+$"' };
          if (vErrors === null) {
            vErrors = [err27];
          } else {
            vErrors.push(err27);
          }
          errors++;
        }
      } else {
        const err28 = { instancePath: instancePath + "/datumLabel", schemaPath: "#/$defs/Text/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err28];
        } else {
          vErrors.push(err28);
        }
        errors++;
      }
    }
    if (data.staticLabel !== void 0) {
      if (typeof data.staticLabel !== "boolean") {
        const err29 = { instancePath: instancePath + "/staticLabel", schemaPath: "#/properties/staticLabel/type", keyword: "type", params: { type: "boolean" }, message: "must be boolean" };
        if (vErrors === null) {
          vErrors = [err29];
        } else {
          vErrors.push(err29);
        }
        errors++;
      }
    }
    if (data.note !== void 0) {
      let data12 = data.note;
      if (typeof data12 === "string") {
        if (func2(data12) > 500) {
          const err30 = { instancePath: instancePath + "/note", schemaPath: "#/$defs/Text/maxLength", keyword: "maxLength", params: { limit: 500 }, message: "must NOT have more than 500 characters" };
          if (vErrors === null) {
            vErrors = [err30];
          } else {
            vErrors.push(err30);
          }
          errors++;
        }
        if (func2(data12) < 1) {
          const err31 = { instancePath: instancePath + "/note", schemaPath: "#/$defs/Text/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
          if (vErrors === null) {
            vErrors = [err31];
          } else {
            vErrors.push(err31);
          }
          errors++;
        }
        if (!pattern5.test(data12)) {
          const err32 = { instancePath: instancePath + "/note", schemaPath: "#/$defs/Text/pattern", keyword: "pattern", params: { pattern: "^[^\\p{Cc}\\p{Cs}]+$" }, message: 'must match pattern "^[^\\p{Cc}\\p{Cs}]+$"' };
          if (vErrors === null) {
            vErrors = [err32];
          } else {
            vErrors.push(err32);
          }
          errors++;
        }
      } else {
        const err33 = { instancePath: instancePath + "/note", schemaPath: "#/$defs/Text/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err33];
        } else {
          vErrors.push(err33);
        }
        errors++;
      }
    }
  } else {
    const err34 = { instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" };
    if (vErrors === null) {
      vErrors = [err34];
    } else {
      vErrors.push(err34);
    }
    errors++;
  }
  validate38.errors = vErrors;
  return errors === 0;
}
validate38.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
function validate37(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate37.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.id === void 0) {
      const err0 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "id" }, message: "must have required property 'id'" };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.label === void 0) {
      const err1 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "label" }, message: "must have required property 'label'" };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    if (data.mark === void 0) {
      const err2 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "mark" }, message: "must have required property 'mark'" };
      if (vErrors === null) {
        vErrors = [err2];
      } else {
        vErrors.push(err2);
      }
      errors++;
    }
    if (data.yAxisId === void 0) {
      const err3 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "yAxisId" }, message: "must have required property 'yAxisId'" };
      if (vErrors === null) {
        vErrors = [err3];
      } else {
        vErrors.push(err3);
      }
      errors++;
    }
    if (data.points === void 0) {
      const err4 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "points" }, message: "must have required property 'points'" };
      if (vErrors === null) {
        vErrors = [err4];
      } else {
        vErrors.push(err4);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!func1.call(schema69.properties, key0)) {
        const err5 = { instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" };
        if (vErrors === null) {
          vErrors = [err5];
        } else {
          vErrors.push(err5);
        }
        errors++;
      }
    }
    if (data.id !== void 0) {
      let data0 = data.id;
      if (typeof data0 === "string") {
        if (!pattern4.test(data0)) {
          const err6 = { instancePath: instancePath + "/id", schemaPath: "#/$defs/Id/pattern", keyword: "pattern", params: { pattern: "^[A-Za-z][A-Za-z0-9_-]{0,63}$" }, message: 'must match pattern "^[A-Za-z][A-Za-z0-9_-]{0,63}$"' };
          if (vErrors === null) {
            vErrors = [err6];
          } else {
            vErrors.push(err6);
          }
          errors++;
        }
      } else {
        const err7 = { instancePath: instancePath + "/id", schemaPath: "#/$defs/Id/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err7];
        } else {
          vErrors.push(err7);
        }
        errors++;
      }
    }
    if (data.label !== void 0) {
      let data1 = data.label;
      if (typeof data1 === "string") {
        if (func2(data1) > 500) {
          const err8 = { instancePath: instancePath + "/label", schemaPath: "#/$defs/Text/maxLength", keyword: "maxLength", params: { limit: 500 }, message: "must NOT have more than 500 characters" };
          if (vErrors === null) {
            vErrors = [err8];
          } else {
            vErrors.push(err8);
          }
          errors++;
        }
        if (func2(data1) < 1) {
          const err9 = { instancePath: instancePath + "/label", schemaPath: "#/$defs/Text/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
          if (vErrors === null) {
            vErrors = [err9];
          } else {
            vErrors.push(err9);
          }
          errors++;
        }
        if (!pattern5.test(data1)) {
          const err10 = { instancePath: instancePath + "/label", schemaPath: "#/$defs/Text/pattern", keyword: "pattern", params: { pattern: "^[^\\p{Cc}\\p{Cs}]+$" }, message: 'must match pattern "^[^\\p{Cc}\\p{Cs}]+$"' };
          if (vErrors === null) {
            vErrors = [err10];
          } else {
            vErrors.push(err10);
          }
          errors++;
        }
      } else {
        const err11 = { instancePath: instancePath + "/label", schemaPath: "#/$defs/Text/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err11];
        } else {
          vErrors.push(err11);
        }
        errors++;
      }
    }
    if (data.mark !== void 0) {
      let data2 = data.mark;
      if (!(data2 === "bar" || data2 === "line" || data2 === "area" || data2 === "scatter")) {
        const err12 = { instancePath: instancePath + "/mark", schemaPath: "#/properties/mark/enum", keyword: "enum", params: { allowedValues: schema69.properties.mark.enum }, message: "must be equal to one of the allowed values" };
        if (vErrors === null) {
          vErrors = [err12];
        } else {
          vErrors.push(err12);
        }
        errors++;
      }
    }
    if (data.yAxisId !== void 0) {
      let data3 = data.yAxisId;
      if (typeof data3 === "string") {
        if (!pattern4.test(data3)) {
          const err13 = { instancePath: instancePath + "/yAxisId", schemaPath: "#/$defs/Id/pattern", keyword: "pattern", params: { pattern: "^[A-Za-z][A-Za-z0-9_-]{0,63}$" }, message: 'must match pattern "^[A-Za-z][A-Za-z0-9_-]{0,63}$"' };
          if (vErrors === null) {
            vErrors = [err13];
          } else {
            vErrors.push(err13);
          }
          errors++;
        }
      } else {
        const err14 = { instancePath: instancePath + "/yAxisId", schemaPath: "#/$defs/Id/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err14];
        } else {
          vErrors.push(err14);
        }
        errors++;
      }
    }
    if (data.role !== void 0) {
      let data4 = data.role;
      if (typeof data4 === "string") {
        if (!pattern4.test(data4)) {
          const err15 = { instancePath: instancePath + "/role", schemaPath: "#/$defs/Id/pattern", keyword: "pattern", params: { pattern: "^[A-Za-z][A-Za-z0-9_-]{0,63}$" }, message: 'must match pattern "^[A-Za-z][A-Za-z0-9_-]{0,63}$"' };
          if (vErrors === null) {
            vErrors = [err15];
          } else {
            vErrors.push(err15);
          }
          errors++;
        }
      } else {
        const err16 = { instancePath: instancePath + "/role", schemaPath: "#/$defs/Id/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err16];
        } else {
          vErrors.push(err16);
        }
        errors++;
      }
    }
    if (data.color !== void 0) {
      let data5 = data.color;
      if (typeof data5 === "string") {
        if (!pattern10.test(data5)) {
          const err17 = { instancePath: instancePath + "/color", schemaPath: "#/$defs/Color/pattern", keyword: "pattern", params: { pattern: "^#[0-9a-fA-F]{6}$" }, message: 'must match pattern "^#[0-9a-fA-F]{6}$"' };
          if (vErrors === null) {
            vErrors = [err17];
          } else {
            vErrors.push(err17);
          }
          errors++;
        }
      } else {
        const err18 = { instancePath: instancePath + "/color", schemaPath: "#/$defs/Color/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err18];
        } else {
          vErrors.push(err18);
        }
        errors++;
      }
    }
    if (data.stackId !== void 0) {
      let data6 = data.stackId;
      if (typeof data6 === "string") {
        if (!pattern4.test(data6)) {
          const err19 = { instancePath: instancePath + "/stackId", schemaPath: "#/$defs/Id/pattern", keyword: "pattern", params: { pattern: "^[A-Za-z][A-Za-z0-9_-]{0,63}$" }, message: 'must match pattern "^[A-Za-z][A-Za-z0-9_-]{0,63}$"' };
          if (vErrors === null) {
            vErrors = [err19];
          } else {
            vErrors.push(err19);
          }
          errors++;
        }
      } else {
        const err20 = { instancePath: instancePath + "/stackId", schemaPath: "#/$defs/Id/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err20];
        } else {
          vErrors.push(err20);
        }
        errors++;
      }
    }
    if (data.interpolation !== void 0) {
      let data7 = data.interpolation;
      if (!(data7 === "linear" || data7 === "monotone")) {
        const err21 = { instancePath: instancePath + "/interpolation", schemaPath: "#/properties/interpolation/enum", keyword: "enum", params: { allowedValues: schema69.properties.interpolation.enum }, message: "must be equal to one of the allowed values" };
        if (vErrors === null) {
          vErrors = [err21];
        } else {
          vErrors.push(err21);
        }
        errors++;
      }
    }
    if (data.dash !== void 0) {
      let data8 = data.dash;
      if (!(data8 === "solid" || data8 === "dashed" || data8 === "dotted")) {
        const err22 = { instancePath: instancePath + "/dash", schemaPath: "#/$defs/Dash/enum", keyword: "enum", params: { allowedValues: schema76.enum }, message: "must be equal to one of the allowed values" };
        if (vErrors === null) {
          vErrors = [err22];
        } else {
          vErrors.push(err22);
        }
        errors++;
      }
    }
    if (data.marker !== void 0) {
      let data9 = data.marker;
      if (data9 && typeof data9 == "object" && !Array.isArray(data9)) {
        for (const key1 in data9) {
          if (!(key1 === "shape" || key1 === "show")) {
            const err23 = { instancePath: instancePath + "/marker", schemaPath: "#/properties/marker/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key1 }, message: "must NOT have additional properties" };
            if (vErrors === null) {
              vErrors = [err23];
            } else {
              vErrors.push(err23);
            }
            errors++;
          }
        }
        if (data9.shape !== void 0) {
          let data10 = data9.shape;
          if (!(data10 === "circle" || data10 === "square" || data10 === "triangle" || data10 === "diamond" || data10 === "cross" || data10 === "none")) {
            const err24 = { instancePath: instancePath + "/marker/shape", schemaPath: "#/$defs/MarkerShape/enum", keyword: "enum", params: { allowedValues: schema43.enum }, message: "must be equal to one of the allowed values" };
            if (vErrors === null) {
              vErrors = [err24];
            } else {
              vErrors.push(err24);
            }
            errors++;
          }
        }
        if (data9.show !== void 0) {
          let data11 = data9.show;
          if (!(data11 === "all" || data11 === "none" || data11 === "quality")) {
            const err25 = { instancePath: instancePath + "/marker/show", schemaPath: "#/properties/marker/properties/show/enum", keyword: "enum", params: { allowedValues: schema69.properties.marker.properties.show.enum }, message: "must be equal to one of the allowed values" };
            if (vErrors === null) {
              vErrors = [err25];
            } else {
              vErrors.push(err25);
            }
            errors++;
          }
        }
      } else {
        const err26 = { instancePath: instancePath + "/marker", schemaPath: "#/properties/marker/type", keyword: "type", params: { type: "object" }, message: "must be object" };
        if (vErrors === null) {
          vErrors = [err26];
        } else {
          vErrors.push(err26);
        }
        errors++;
      }
    }
    if (data.points !== void 0) {
      let data12 = data.points;
      if (Array.isArray(data12)) {
        const len0 = data12.length;
        for (let i0 = 0; i0 < len0; i0++) {
          if (!validate38(data12[i0], { instancePath: instancePath + "/points/" + i0, parentData: data12, parentDataProperty: i0, rootData, dynamicAnchors })) {
            vErrors = vErrors === null ? validate38.errors : vErrors.concat(validate38.errors);
            errors = vErrors.length;
          }
        }
      } else {
        const err27 = { instancePath: instancePath + "/points", schemaPath: "#/properties/points/type", keyword: "type", params: { type: "array" }, message: "must be array" };
        if (vErrors === null) {
          vErrors = [err27];
        } else {
          vErrors.push(err27);
        }
        errors++;
      }
    }
  } else {
    const err28 = { instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" };
    if (vErrors === null) {
      vErrors = [err28];
    } else {
      vErrors.push(err28);
    }
    errors++;
  }
  validate37.errors = vErrors;
  return errors === 0;
}
validate37.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
function validate41(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate41.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.id === void 0) {
      const err0 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "id" }, message: "must have required property 'id'" };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.axisId === void 0) {
      const err1 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "axisId" }, message: "must have required property 'axisId'" };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    if (data.value === void 0) {
      const err2 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "value" }, message: "must have required property 'value'" };
      if (vErrors === null) {
        vErrors = [err2];
      } else {
        vErrors.push(err2);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!(key0 === "id" || key0 === "axisId" || key0 === "value" || key0 === "label" || key0 === "dash" || key0 === "role")) {
        const err3 = { instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" };
        if (vErrors === null) {
          vErrors = [err3];
        } else {
          vErrors.push(err3);
        }
        errors++;
      }
    }
    if (data.id !== void 0) {
      let data0 = data.id;
      if (typeof data0 === "string") {
        if (!pattern4.test(data0)) {
          const err4 = { instancePath: instancePath + "/id", schemaPath: "#/$defs/Id/pattern", keyword: "pattern", params: { pattern: "^[A-Za-z][A-Za-z0-9_-]{0,63}$" }, message: 'must match pattern "^[A-Za-z][A-Za-z0-9_-]{0,63}$"' };
          if (vErrors === null) {
            vErrors = [err4];
          } else {
            vErrors.push(err4);
          }
          errors++;
        }
      } else {
        const err5 = { instancePath: instancePath + "/id", schemaPath: "#/$defs/Id/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err5];
        } else {
          vErrors.push(err5);
        }
        errors++;
      }
    }
    if (data.axisId !== void 0) {
      let data1 = data.axisId;
      if (typeof data1 === "string") {
        if (!pattern4.test(data1)) {
          const err6 = { instancePath: instancePath + "/axisId", schemaPath: "#/$defs/Id/pattern", keyword: "pattern", params: { pattern: "^[A-Za-z][A-Za-z0-9_-]{0,63}$" }, message: 'must match pattern "^[A-Za-z][A-Za-z0-9_-]{0,63}$"' };
          if (vErrors === null) {
            vErrors = [err6];
          } else {
            vErrors.push(err6);
          }
          errors++;
        }
      } else {
        const err7 = { instancePath: instancePath + "/axisId", schemaPath: "#/$defs/Id/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err7];
        } else {
          vErrors.push(err7);
        }
        errors++;
      }
    }
    if (data.value !== void 0) {
      let data2 = data.value;
      const _errs9 = errors;
      let valid3 = false;
      const _errs10 = errors;
      if (typeof data2 === "string") {
        if (func2(data2) > 500) {
          const err8 = { instancePath: instancePath + "/value", schemaPath: "#/$defs/Text/maxLength", keyword: "maxLength", params: { limit: 500 }, message: "must NOT have more than 500 characters" };
          if (vErrors === null) {
            vErrors = [err8];
          } else {
            vErrors.push(err8);
          }
          errors++;
        }
        if (func2(data2) < 1) {
          const err9 = { instancePath: instancePath + "/value", schemaPath: "#/$defs/Text/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
          if (vErrors === null) {
            vErrors = [err9];
          } else {
            vErrors.push(err9);
          }
          errors++;
        }
        if (!pattern5.test(data2)) {
          const err10 = { instancePath: instancePath + "/value", schemaPath: "#/$defs/Text/pattern", keyword: "pattern", params: { pattern: "^[^\\p{Cc}\\p{Cs}]+$" }, message: 'must match pattern "^[^\\p{Cc}\\p{Cs}]+$"' };
          if (vErrors === null) {
            vErrors = [err10];
          } else {
            vErrors.push(err10);
          }
          errors++;
        }
      } else {
        const err11 = { instancePath: instancePath + "/value", schemaPath: "#/$defs/Text/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err11];
        } else {
          vErrors.push(err11);
        }
        errors++;
      }
      var _valid0 = _errs10 === errors;
      valid3 = valid3 || _valid0;
      const _errs13 = errors;
      if (!(typeof data2 == "number" && isFinite(data2))) {
        const err12 = { instancePath: instancePath + "/value", schemaPath: "#/properties/value/anyOf/1/type", keyword: "type", params: { type: "number" }, message: "must be number" };
        if (vErrors === null) {
          vErrors = [err12];
        } else {
          vErrors.push(err12);
        }
        errors++;
      }
      var _valid0 = _errs13 === errors;
      valid3 = valid3 || _valid0;
      if (!valid3) {
        const err13 = { instancePath: instancePath + "/value", schemaPath: "#/properties/value/anyOf", keyword: "anyOf", params: {}, message: "must match a schema in anyOf" };
        if (vErrors === null) {
          vErrors = [err13];
        } else {
          vErrors.push(err13);
        }
        errors++;
      } else {
        errors = _errs9;
        if (vErrors !== null) {
          if (_errs9) {
            vErrors.length = _errs9;
          } else {
            vErrors = null;
          }
        }
      }
    }
    if (data.label !== void 0) {
      let data3 = data.label;
      if (typeof data3 === "string") {
        if (func2(data3) > 500) {
          const err14 = { instancePath: instancePath + "/label", schemaPath: "#/$defs/Text/maxLength", keyword: "maxLength", params: { limit: 500 }, message: "must NOT have more than 500 characters" };
          if (vErrors === null) {
            vErrors = [err14];
          } else {
            vErrors.push(err14);
          }
          errors++;
        }
        if (func2(data3) < 1) {
          const err15 = { instancePath: instancePath + "/label", schemaPath: "#/$defs/Text/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
          if (vErrors === null) {
            vErrors = [err15];
          } else {
            vErrors.push(err15);
          }
          errors++;
        }
        if (!pattern5.test(data3)) {
          const err16 = { instancePath: instancePath + "/label", schemaPath: "#/$defs/Text/pattern", keyword: "pattern", params: { pattern: "^[^\\p{Cc}\\p{Cs}]+$" }, message: 'must match pattern "^[^\\p{Cc}\\p{Cs}]+$"' };
          if (vErrors === null) {
            vErrors = [err16];
          } else {
            vErrors.push(err16);
          }
          errors++;
        }
      } else {
        const err17 = { instancePath: instancePath + "/label", schemaPath: "#/$defs/Text/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err17];
        } else {
          vErrors.push(err17);
        }
        errors++;
      }
    }
    if (data.dash !== void 0) {
      let data4 = data.dash;
      if (!(data4 === "solid" || data4 === "dashed" || data4 === "dotted")) {
        const err18 = { instancePath: instancePath + "/dash", schemaPath: "#/$defs/Dash/enum", keyword: "enum", params: { allowedValues: schema76.enum }, message: "must be equal to one of the allowed values" };
        if (vErrors === null) {
          vErrors = [err18];
        } else {
          vErrors.push(err18);
        }
        errors++;
      }
    }
    if (data.role !== void 0) {
      let data5 = data.role;
      if (typeof data5 === "string") {
        if (!pattern4.test(data5)) {
          const err19 = { instancePath: instancePath + "/role", schemaPath: "#/$defs/Id/pattern", keyword: "pattern", params: { pattern: "^[A-Za-z][A-Za-z0-9_-]{0,63}$" }, message: 'must match pattern "^[A-Za-z][A-Za-z0-9_-]{0,63}$"' };
          if (vErrors === null) {
            vErrors = [err19];
          } else {
            vErrors.push(err19);
          }
          errors++;
        }
      } else {
        const err20 = { instancePath: instancePath + "/role", schemaPath: "#/$defs/Id/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err20];
        } else {
          vErrors.push(err20);
        }
        errors++;
      }
    }
  } else {
    const err21 = { instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" };
    if (vErrors === null) {
      vErrors = [err21];
    } else {
      vErrors.push(err21);
    }
    errors++;
  }
  validate41.errors = vErrors;
  return errors === 0;
}
validate41.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
function validate43(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate43.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.id === void 0) {
      const err0 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "id" }, message: "must have required property 'id'" };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.x === void 0) {
      const err1 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "x" }, message: "must have required property 'x'" };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    if (data.label === void 0) {
      const err2 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "label" }, message: "must have required property 'label'" };
      if (vErrors === null) {
        vErrors = [err2];
      } else {
        vErrors.push(err2);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!(key0 === "id" || key0 === "x" || key0 === "x2" || key0 === "yAxisId" || key0 === "y" || key0 === "label" || key0 === "detail")) {
        const err3 = { instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" };
        if (vErrors === null) {
          vErrors = [err3];
        } else {
          vErrors.push(err3);
        }
        errors++;
      }
    }
    if (data.id !== void 0) {
      let data0 = data.id;
      if (typeof data0 === "string") {
        if (!pattern4.test(data0)) {
          const err4 = { instancePath: instancePath + "/id", schemaPath: "#/$defs/Id/pattern", keyword: "pattern", params: { pattern: "^[A-Za-z][A-Za-z0-9_-]{0,63}$" }, message: 'must match pattern "^[A-Za-z][A-Za-z0-9_-]{0,63}$"' };
          if (vErrors === null) {
            vErrors = [err4];
          } else {
            vErrors.push(err4);
          }
          errors++;
        }
      } else {
        const err5 = { instancePath: instancePath + "/id", schemaPath: "#/$defs/Id/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err5];
        } else {
          vErrors.push(err5);
        }
        errors++;
      }
    }
    if (data.x !== void 0) {
      let data1 = data.x;
      const _errs6 = errors;
      let valid2 = false;
      const _errs7 = errors;
      if (typeof data1 === "string") {
        if (func2(data1) > 500) {
          const err6 = { instancePath: instancePath + "/x", schemaPath: "#/$defs/Text/maxLength", keyword: "maxLength", params: { limit: 500 }, message: "must NOT have more than 500 characters" };
          if (vErrors === null) {
            vErrors = [err6];
          } else {
            vErrors.push(err6);
          }
          errors++;
        }
        if (func2(data1) < 1) {
          const err7 = { instancePath: instancePath + "/x", schemaPath: "#/$defs/Text/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
          if (vErrors === null) {
            vErrors = [err7];
          } else {
            vErrors.push(err7);
          }
          errors++;
        }
        if (!pattern5.test(data1)) {
          const err8 = { instancePath: instancePath + "/x", schemaPath: "#/$defs/Text/pattern", keyword: "pattern", params: { pattern: "^[^\\p{Cc}\\p{Cs}]+$" }, message: 'must match pattern "^[^\\p{Cc}\\p{Cs}]+$"' };
          if (vErrors === null) {
            vErrors = [err8];
          } else {
            vErrors.push(err8);
          }
          errors++;
        }
      } else {
        const err9 = { instancePath: instancePath + "/x", schemaPath: "#/$defs/Text/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err9];
        } else {
          vErrors.push(err9);
        }
        errors++;
      }
      var _valid0 = _errs7 === errors;
      valid2 = valid2 || _valid0;
      const _errs10 = errors;
      if (!(typeof data1 == "number" && isFinite(data1))) {
        const err10 = { instancePath: instancePath + "/x", schemaPath: "#/properties/x/anyOf/1/type", keyword: "type", params: { type: "number" }, message: "must be number" };
        if (vErrors === null) {
          vErrors = [err10];
        } else {
          vErrors.push(err10);
        }
        errors++;
      }
      var _valid0 = _errs10 === errors;
      valid2 = valid2 || _valid0;
      if (!valid2) {
        const err11 = { instancePath: instancePath + "/x", schemaPath: "#/properties/x/anyOf", keyword: "anyOf", params: {}, message: "must match a schema in anyOf" };
        if (vErrors === null) {
          vErrors = [err11];
        } else {
          vErrors.push(err11);
        }
        errors++;
      } else {
        errors = _errs6;
        if (vErrors !== null) {
          if (_errs6) {
            vErrors.length = _errs6;
          } else {
            vErrors = null;
          }
        }
      }
    }
    if (data.x2 !== void 0) {
      let data2 = data.x2;
      const _errs13 = errors;
      let valid4 = false;
      const _errs14 = errors;
      if (typeof data2 === "string") {
        if (func2(data2) > 500) {
          const err12 = { instancePath: instancePath + "/x2", schemaPath: "#/$defs/Text/maxLength", keyword: "maxLength", params: { limit: 500 }, message: "must NOT have more than 500 characters" };
          if (vErrors === null) {
            vErrors = [err12];
          } else {
            vErrors.push(err12);
          }
          errors++;
        }
        if (func2(data2) < 1) {
          const err13 = { instancePath: instancePath + "/x2", schemaPath: "#/$defs/Text/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
          if (vErrors === null) {
            vErrors = [err13];
          } else {
            vErrors.push(err13);
          }
          errors++;
        }
        if (!pattern5.test(data2)) {
          const err14 = { instancePath: instancePath + "/x2", schemaPath: "#/$defs/Text/pattern", keyword: "pattern", params: { pattern: "^[^\\p{Cc}\\p{Cs}]+$" }, message: 'must match pattern "^[^\\p{Cc}\\p{Cs}]+$"' };
          if (vErrors === null) {
            vErrors = [err14];
          } else {
            vErrors.push(err14);
          }
          errors++;
        }
      } else {
        const err15 = { instancePath: instancePath + "/x2", schemaPath: "#/$defs/Text/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err15];
        } else {
          vErrors.push(err15);
        }
        errors++;
      }
      var _valid1 = _errs14 === errors;
      valid4 = valid4 || _valid1;
      const _errs17 = errors;
      if (!(typeof data2 == "number" && isFinite(data2))) {
        const err16 = { instancePath: instancePath + "/x2", schemaPath: "#/properties/x2/anyOf/1/type", keyword: "type", params: { type: "number" }, message: "must be number" };
        if (vErrors === null) {
          vErrors = [err16];
        } else {
          vErrors.push(err16);
        }
        errors++;
      }
      var _valid1 = _errs17 === errors;
      valid4 = valid4 || _valid1;
      if (!valid4) {
        const err17 = { instancePath: instancePath + "/x2", schemaPath: "#/properties/x2/anyOf", keyword: "anyOf", params: {}, message: "must match a schema in anyOf" };
        if (vErrors === null) {
          vErrors = [err17];
        } else {
          vErrors.push(err17);
        }
        errors++;
      } else {
        errors = _errs13;
        if (vErrors !== null) {
          if (_errs13) {
            vErrors.length = _errs13;
          } else {
            vErrors = null;
          }
        }
      }
    }
    if (data.yAxisId !== void 0) {
      let data3 = data.yAxisId;
      if (typeof data3 === "string") {
        if (!pattern4.test(data3)) {
          const err18 = { instancePath: instancePath + "/yAxisId", schemaPath: "#/$defs/Id/pattern", keyword: "pattern", params: { pattern: "^[A-Za-z][A-Za-z0-9_-]{0,63}$" }, message: 'must match pattern "^[A-Za-z][A-Za-z0-9_-]{0,63}$"' };
          if (vErrors === null) {
            vErrors = [err18];
          } else {
            vErrors.push(err18);
          }
          errors++;
        }
      } else {
        const err19 = { instancePath: instancePath + "/yAxisId", schemaPath: "#/$defs/Id/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err19];
        } else {
          vErrors.push(err19);
        }
        errors++;
      }
    }
    if (data.y !== void 0) {
      let data4 = data.y;
      if (!(typeof data4 == "number" && isFinite(data4))) {
        const err20 = { instancePath: instancePath + "/y", schemaPath: "#/properties/y/type", keyword: "type", params: { type: "number" }, message: "must be number" };
        if (vErrors === null) {
          vErrors = [err20];
        } else {
          vErrors.push(err20);
        }
        errors++;
      }
    }
    if (data.label !== void 0) {
      let data5 = data.label;
      if (typeof data5 === "string") {
        if (func2(data5) > 500) {
          const err21 = { instancePath: instancePath + "/label", schemaPath: "#/$defs/Text/maxLength", keyword: "maxLength", params: { limit: 500 }, message: "must NOT have more than 500 characters" };
          if (vErrors === null) {
            vErrors = [err21];
          } else {
            vErrors.push(err21);
          }
          errors++;
        }
        if (func2(data5) < 1) {
          const err22 = { instancePath: instancePath + "/label", schemaPath: "#/$defs/Text/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
          if (vErrors === null) {
            vErrors = [err22];
          } else {
            vErrors.push(err22);
          }
          errors++;
        }
        if (!pattern5.test(data5)) {
          const err23 = { instancePath: instancePath + "/label", schemaPath: "#/$defs/Text/pattern", keyword: "pattern", params: { pattern: "^[^\\p{Cc}\\p{Cs}]+$" }, message: 'must match pattern "^[^\\p{Cc}\\p{Cs}]+$"' };
          if (vErrors === null) {
            vErrors = [err23];
          } else {
            vErrors.push(err23);
          }
          errors++;
        }
      } else {
        const err24 = { instancePath: instancePath + "/label", schemaPath: "#/$defs/Text/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err24];
        } else {
          vErrors.push(err24);
        }
        errors++;
      }
    }
    if (data.detail !== void 0) {
      let data6 = data.detail;
      if (typeof data6 === "string") {
        if (func2(data6) > 500) {
          const err25 = { instancePath: instancePath + "/detail", schemaPath: "#/$defs/MultilineText/maxLength", keyword: "maxLength", params: { limit: 500 }, message: "must NOT have more than 500 characters" };
          if (vErrors === null) {
            vErrors = [err25];
          } else {
            vErrors.push(err25);
          }
          errors++;
        }
        if (func2(data6) < 1) {
          const err26 = { instancePath: instancePath + "/detail", schemaPath: "#/$defs/MultilineText/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
          if (vErrors === null) {
            vErrors = [err26];
          } else {
            vErrors.push(err26);
          }
          errors++;
        }
        if (!pattern7.test(data6)) {
          const err27 = { instancePath: instancePath + "/detail", schemaPath: "#/$defs/MultilineText/pattern", keyword: "pattern", params: { pattern: "^(?:[^\\p{Cc}\\p{Cs}]|\\n)+$" }, message: 'must match pattern "^(?:[^\\p{Cc}\\p{Cs}]|\\n)+$"' };
          if (vErrors === null) {
            vErrors = [err27];
          } else {
            vErrors.push(err27);
          }
          errors++;
        }
      } else {
        const err28 = { instancePath: instancePath + "/detail", schemaPath: "#/$defs/MultilineText/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err28];
        } else {
          vErrors.push(err28);
        }
        errors++;
      }
    }
  } else {
    const err29 = { instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" };
    if (vErrors === null) {
      vErrors = [err29];
    } else {
      vErrors.push(err29);
    }
    errors++;
  }
  validate43.errors = vErrors;
  return errors === 0;
}
validate43.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
function validate21(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate21.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.schemaVersion === void 0) {
      const err0 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "schemaVersion" }, message: "must have required property 'schemaVersion'" };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.id === void 0) {
      const err1 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "id" }, message: "must have required property 'id'" };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    if (data.kind === void 0) {
      const err2 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "kind" }, message: "must have required property 'kind'" };
      if (vErrors === null) {
        vErrors = [err2];
      } else {
        vErrors.push(err2);
      }
      errors++;
    }
    if (data.title === void 0) {
      const err3 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "title" }, message: "must have required property 'title'" };
      if (vErrors === null) {
        vErrors = [err3];
      } else {
        vErrors.push(err3);
      }
      errors++;
    }
    if (data.xAxis === void 0) {
      const err4 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "xAxis" }, message: "must have required property 'xAxis'" };
      if (vErrors === null) {
        vErrors = [err4];
      } else {
        vErrors.push(err4);
      }
      errors++;
    }
    if (data.yAxes === void 0) {
      const err5 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "yAxes" }, message: "must have required property 'yAxes'" };
      if (vErrors === null) {
        vErrors = [err5];
      } else {
        vErrors.push(err5);
      }
      errors++;
    }
    if (data.series === void 0) {
      const err6 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "series" }, message: "must have required property 'series'" };
      if (vErrors === null) {
        vErrors = [err6];
      } else {
        vErrors.push(err6);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!func1.call(schema32.properties, key0)) {
        const err7 = { instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" };
        if (vErrors === null) {
          vErrors = [err7];
        } else {
          vErrors.push(err7);
        }
        errors++;
      }
    }
    if (data.schemaVersion !== void 0) {
      let data0 = data.schemaVersion;
      if (!(typeof data0 == "number" && (!(data0 % 1) && !isNaN(data0)) && isFinite(data0))) {
        const err8 = { instancePath: instancePath + "/schemaVersion", schemaPath: "#/$defs/SpecBase/properties/schemaVersion/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
        if (vErrors === null) {
          vErrors = [err8];
        } else {
          vErrors.push(err8);
        }
        errors++;
      }
      if (1 !== data0) {
        const err9 = { instancePath: instancePath + "/schemaVersion", schemaPath: "#/$defs/SpecBase/properties/schemaVersion/const", keyword: "const", params: { allowedValue: 1 }, message: "must be equal to constant" };
        if (vErrors === null) {
          vErrors = [err9];
        } else {
          vErrors.push(err9);
        }
        errors++;
      }
    }
    if (data.id !== void 0) {
      let data1 = data.id;
      if (typeof data1 === "string") {
        if (!pattern4.test(data1)) {
          const err10 = { instancePath: instancePath + "/id", schemaPath: "#/$defs/SpecBase/properties/id/pattern", keyword: "pattern", params: { pattern: "^[A-Za-z][A-Za-z0-9_-]{0,63}$" }, message: 'must match pattern "^[A-Za-z][A-Za-z0-9_-]{0,63}$"' };
          if (vErrors === null) {
            vErrors = [err10];
          } else {
            vErrors.push(err10);
          }
          errors++;
        }
      } else {
        const err11 = { instancePath: instancePath + "/id", schemaPath: "#/$defs/SpecBase/properties/id/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err11];
        } else {
          vErrors.push(err11);
        }
        errors++;
      }
    }
    if (data.kind !== void 0) {
      if ("cartesian" !== data.kind) {
        const err12 = { instancePath: instancePath + "/kind", schemaPath: "#/properties/kind/const", keyword: "const", params: { allowedValue: "cartesian" }, message: "must be equal to constant" };
        if (vErrors === null) {
          vErrors = [err12];
        } else {
          vErrors.push(err12);
        }
        errors++;
      }
    }
    if (data.title !== void 0) {
      let data3 = data.title;
      if (typeof data3 === "string") {
        if (func2(data3) > 200) {
          const err13 = { instancePath: instancePath + "/title", schemaPath: "#/$defs/SpecBase/properties/title/maxLength", keyword: "maxLength", params: { limit: 200 }, message: "must NOT have more than 200 characters" };
          if (vErrors === null) {
            vErrors = [err13];
          } else {
            vErrors.push(err13);
          }
          errors++;
        }
        if (func2(data3) < 1) {
          const err14 = { instancePath: instancePath + "/title", schemaPath: "#/$defs/SpecBase/properties/title/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
          if (vErrors === null) {
            vErrors = [err14];
          } else {
            vErrors.push(err14);
          }
          errors++;
        }
        if (!pattern5.test(data3)) {
          const err15 = { instancePath: instancePath + "/title", schemaPath: "#/$defs/SpecBase/properties/title/pattern", keyword: "pattern", params: { pattern: "^[^\\p{Cc}\\p{Cs}]+$" }, message: 'must match pattern "^[^\\p{Cc}\\p{Cs}]+$"' };
          if (vErrors === null) {
            vErrors = [err15];
          } else {
            vErrors.push(err15);
          }
          errors++;
        }
      } else {
        const err16 = { instancePath: instancePath + "/title", schemaPath: "#/$defs/SpecBase/properties/title/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err16];
        } else {
          vErrors.push(err16);
        }
        errors++;
      }
    }
    if (data.description !== void 0) {
      let data4 = data.description;
      if (typeof data4 === "string") {
        if (func2(data4) > 2e3) {
          const err17 = { instancePath: instancePath + "/description", schemaPath: "#/$defs/SpecBase/properties/description/maxLength", keyword: "maxLength", params: { limit: 2e3 }, message: "must NOT have more than 2000 characters" };
          if (vErrors === null) {
            vErrors = [err17];
          } else {
            vErrors.push(err17);
          }
          errors++;
        }
        if (!pattern6.test(data4)) {
          const err18 = { instancePath: instancePath + "/description", schemaPath: "#/$defs/SpecBase/properties/description/pattern", keyword: "pattern", params: { pattern: "^(?:[^\\p{Cc}\\p{Cs}]|\\n)*$" }, message: 'must match pattern "^(?:[^\\p{Cc}\\p{Cs}]|\\n)*$"' };
          if (vErrors === null) {
            vErrors = [err18];
          } else {
            vErrors.push(err18);
          }
          errors++;
        }
      } else {
        const err19 = { instancePath: instancePath + "/description", schemaPath: "#/$defs/SpecBase/properties/description/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err19];
        } else {
          vErrors.push(err19);
        }
        errors++;
      }
    }
    if (data.caption !== void 0) {
      let data5 = data.caption;
      if (typeof data5 === "string") {
        if (func2(data5) > 500) {
          const err20 = { instancePath: instancePath + "/caption", schemaPath: "#/$defs/SpecBase/properties/caption/maxLength", keyword: "maxLength", params: { limit: 500 }, message: "must NOT have more than 500 characters" };
          if (vErrors === null) {
            vErrors = [err20];
          } else {
            vErrors.push(err20);
          }
          errors++;
        }
        if (func2(data5) < 1) {
          const err21 = { instancePath: instancePath + "/caption", schemaPath: "#/$defs/SpecBase/properties/caption/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
          if (vErrors === null) {
            vErrors = [err21];
          } else {
            vErrors.push(err21);
          }
          errors++;
        }
        if (!pattern7.test(data5)) {
          const err22 = { instancePath: instancePath + "/caption", schemaPath: "#/$defs/SpecBase/properties/caption/pattern", keyword: "pattern", params: { pattern: "^(?:[^\\p{Cc}\\p{Cs}]|\\n)+$" }, message: 'must match pattern "^(?:[^\\p{Cc}\\p{Cs}]|\\n)+$"' };
          if (vErrors === null) {
            vErrors = [err22];
          } else {
            vErrors.push(err22);
          }
          errors++;
        }
      } else {
        const err23 = { instancePath: instancePath + "/caption", schemaPath: "#/$defs/SpecBase/properties/caption/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err23];
        } else {
          vErrors.push(err23);
        }
        errors++;
      }
    }
    if (data.roles !== void 0) {
      if (!validate22(data.roles, { instancePath: instancePath + "/roles", parentData: data, parentDataProperty: "roles", rootData, dynamicAnchors })) {
        vErrors = vErrors === null ? validate22.errors : vErrors.concat(validate22.errors);
        errors = vErrors.length;
      }
    }
    if (data.legend !== void 0) {
      let data7 = data.legend;
      if (data7 && typeof data7 == "object" && !Array.isArray(data7)) {
        for (const key1 in data7) {
          if (!(key1 === "show" || key1 === "position")) {
            const err24 = { instancePath: instancePath + "/legend", schemaPath: "#/$defs/SpecBase/properties/legend/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key1 }, message: "must NOT have additional properties" };
            if (vErrors === null) {
              vErrors = [err24];
            } else {
              vErrors.push(err24);
            }
            errors++;
          }
        }
        if (data7.show !== void 0) {
          let data8 = data7.show;
          if (!(data8 === "auto" || data8 === "always" || data8 === "never")) {
            const err25 = { instancePath: instancePath + "/legend/show", schemaPath: "#/$defs/SpecBase/properties/legend/properties/show/enum", keyword: "enum", params: { allowedValues: schema44.properties.show.enum }, message: "must be equal to one of the allowed values" };
            if (vErrors === null) {
              vErrors = [err25];
            } else {
              vErrors.push(err25);
            }
            errors++;
          }
        }
        if (data7.position !== void 0) {
          let data9 = data7.position;
          if (!(data9 === "top" || data9 === "bottom")) {
            const err26 = { instancePath: instancePath + "/legend/position", schemaPath: "#/$defs/SpecBase/properties/legend/properties/position/enum", keyword: "enum", params: { allowedValues: schema44.properties.position.enum }, message: "must be equal to one of the allowed values" };
            if (vErrors === null) {
              vErrors = [err26];
            } else {
              vErrors.push(err26);
            }
            errors++;
          }
        }
      } else {
        const err27 = { instancePath: instancePath + "/legend", schemaPath: "#/$defs/SpecBase/properties/legend/type", keyword: "type", params: { type: "object" }, message: "must be object" };
        if (vErrors === null) {
          vErrors = [err27];
        } else {
          vErrors.push(err27);
        }
        errors++;
      }
    }
    if (data.orientation !== void 0) {
      let data10 = data.orientation;
      if (!(data10 === "vertical" || data10 === "horizontal")) {
        const err28 = { instancePath: instancePath + "/orientation", schemaPath: "#/properties/orientation/enum", keyword: "enum", params: { allowedValues: schema32.properties.orientation.enum }, message: "must be equal to one of the allowed values" };
        if (vErrors === null) {
          vErrors = [err28];
        } else {
          vErrors.push(err28);
        }
        errors++;
      }
    }
    if (data.preset !== void 0) {
      let data11 = data.preset;
      if (!(data11 === "standard" || data11 === "sparkline" || data11 === "compact-stack")) {
        const err29 = { instancePath: instancePath + "/preset", schemaPath: "#/properties/preset/enum", keyword: "enum", params: { allowedValues: schema32.properties.preset.enum }, message: "must be equal to one of the allowed values" };
        if (vErrors === null) {
          vErrors = [err29];
        } else {
          vErrors.push(err29);
        }
        errors++;
      }
    }
    if (data.xAxis !== void 0) {
      let data12 = data.xAxis;
      if (data12 && typeof data12 == "object" && !Array.isArray(data12)) {
        const tag0 = data12.scale;
        if (typeof tag0 == "string") {
          if (tag0 === "category") {
            if (!validate26(data12, { instancePath: instancePath + "/xAxis", parentData: data, parentDataProperty: "xAxis", rootData, dynamicAnchors })) {
              vErrors = vErrors === null ? validate26.errors : vErrors.concat(validate26.errors);
              errors = vErrors.length;
            }
            var props0 = true;
          } else if (tag0 === "linear") {
            if (!validate27(data12, { instancePath: instancePath + "/xAxis", parentData: data, parentDataProperty: "xAxis", rootData, dynamicAnchors })) {
              vErrors = vErrors === null ? validate27.errors : vErrors.concat(validate27.errors);
              errors = vErrors.length;
            }
            if (props0 !== true) {
              props0 = true;
            }
          } else if (tag0 === "time") {
            if (!validate30(data12, { instancePath: instancePath + "/xAxis", parentData: data, parentDataProperty: "xAxis", rootData, dynamicAnchors })) {
              vErrors = vErrors === null ? validate30.errors : vErrors.concat(validate30.errors);
              errors = vErrors.length;
            }
            if (props0 !== true) {
              props0 = true;
            }
          } else {
            const err30 = { instancePath: instancePath + "/xAxis", schemaPath: "#/properties/xAxis/discriminator", keyword: "discriminator", params: { error: "mapping", tag: "scale", tagValue: tag0 }, message: 'value of tag "scale" must be in oneOf' };
            if (vErrors === null) {
              vErrors = [err30];
            } else {
              vErrors.push(err30);
            }
            errors++;
          }
        } else {
          const err31 = { instancePath: instancePath + "/xAxis", schemaPath: "#/properties/xAxis/discriminator", keyword: "discriminator", params: { error: "tag", tag: "scale", tagValue: tag0 }, message: 'tag "scale" must be string' };
          if (vErrors === null) {
            vErrors = [err31];
          } else {
            vErrors.push(err31);
          }
          errors++;
        }
      } else {
        const err32 = { instancePath: instancePath + "/xAxis", schemaPath: "#/properties/xAxis/type", keyword: "type", params: { type: "object" }, message: "must be object" };
        if (vErrors === null) {
          vErrors = [err32];
        } else {
          vErrors.push(err32);
        }
        errors++;
      }
    }
    if (data.yAxes !== void 0) {
      let data13 = data.yAxes;
      if (Array.isArray(data13)) {
        if (data13.length > 2) {
          const err33 = { instancePath: instancePath + "/yAxes", schemaPath: "#/properties/yAxes/maxItems", keyword: "maxItems", params: { limit: 2 }, message: "must NOT have more than 2 items" };
          if (vErrors === null) {
            vErrors = [err33];
          } else {
            vErrors.push(err33);
          }
          errors++;
        }
        if (data13.length < 1) {
          const err34 = { instancePath: instancePath + "/yAxes", schemaPath: "#/properties/yAxes/minItems", keyword: "minItems", params: { limit: 1 }, message: "must NOT have fewer than 1 items" };
          if (vErrors === null) {
            vErrors = [err34];
          } else {
            vErrors.push(err34);
          }
          errors++;
        }
        const len0 = data13.length;
        for (let i0 = 0; i0 < len0; i0++) {
          if (!validate34(data13[i0], { instancePath: instancePath + "/yAxes/" + i0, parentData: data13, parentDataProperty: i0, rootData, dynamicAnchors })) {
            vErrors = vErrors === null ? validate34.errors : vErrors.concat(validate34.errors);
            errors = vErrors.length;
          }
        }
      } else {
        const err35 = { instancePath: instancePath + "/yAxes", schemaPath: "#/properties/yAxes/type", keyword: "type", params: { type: "array" }, message: "must be array" };
        if (vErrors === null) {
          vErrors = [err35];
        } else {
          vErrors.push(err35);
        }
        errors++;
      }
    }
    if (data.series !== void 0) {
      let data15 = data.series;
      if (Array.isArray(data15)) {
        if (data15.length > 16) {
          const err36 = { instancePath: instancePath + "/series", schemaPath: "#/properties/series/maxItems", keyword: "maxItems", params: { limit: 16 }, message: "must NOT have more than 16 items" };
          if (vErrors === null) {
            vErrors = [err36];
          } else {
            vErrors.push(err36);
          }
          errors++;
        }
        if (data15.length < 1) {
          const err37 = { instancePath: instancePath + "/series", schemaPath: "#/properties/series/minItems", keyword: "minItems", params: { limit: 1 }, message: "must NOT have fewer than 1 items" };
          if (vErrors === null) {
            vErrors = [err37];
          } else {
            vErrors.push(err37);
          }
          errors++;
        }
        const len1 = data15.length;
        for (let i1 = 0; i1 < len1; i1++) {
          if (!validate37(data15[i1], { instancePath: instancePath + "/series/" + i1, parentData: data15, parentDataProperty: i1, rootData, dynamicAnchors })) {
            vErrors = vErrors === null ? validate37.errors : vErrors.concat(validate37.errors);
            errors = vErrors.length;
          }
        }
      } else {
        const err38 = { instancePath: instancePath + "/series", schemaPath: "#/properties/series/type", keyword: "type", params: { type: "array" }, message: "must be array" };
        if (vErrors === null) {
          vErrors = [err38];
        } else {
          vErrors.push(err38);
        }
        errors++;
      }
    }
    if (data.stacking !== void 0) {
      let data17 = data.stacking;
      if (data17 && typeof data17 == "object" && !Array.isArray(data17)) {
        if (data17.mode === void 0) {
          const err39 = { instancePath: instancePath + "/stacking", schemaPath: "#/properties/stacking/required", keyword: "required", params: { missingProperty: "mode" }, message: "must have required property 'mode'" };
          if (vErrors === null) {
            vErrors = [err39];
          } else {
            vErrors.push(err39);
          }
          errors++;
        }
        for (const key2 in data17) {
          if (!(key2 === "mode" || key2 === "valueUnit" || key2 === "segmentLabels")) {
            const err40 = { instancePath: instancePath + "/stacking", schemaPath: "#/properties/stacking/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key2 }, message: "must NOT have additional properties" };
            if (vErrors === null) {
              vErrors = [err40];
            } else {
              vErrors.push(err40);
            }
            errors++;
          }
        }
        if (data17.mode !== void 0) {
          let data18 = data17.mode;
          if (!(data18 === "absolute" || data18 === "percent")) {
            const err41 = { instancePath: instancePath + "/stacking/mode", schemaPath: "#/properties/stacking/properties/mode/enum", keyword: "enum", params: { allowedValues: schema32.properties.stacking.properties.mode.enum }, message: "must be equal to one of the allowed values" };
            if (vErrors === null) {
              vErrors = [err41];
            } else {
              vErrors.push(err41);
            }
            errors++;
          }
        }
        if (data17.valueUnit !== void 0) {
          let data19 = data17.valueUnit;
          if (typeof data19 === "string") {
            if (func2(data19) > 500) {
              const err42 = { instancePath: instancePath + "/stacking/valueUnit", schemaPath: "#/$defs/Text/maxLength", keyword: "maxLength", params: { limit: 500 }, message: "must NOT have more than 500 characters" };
              if (vErrors === null) {
                vErrors = [err42];
              } else {
                vErrors.push(err42);
              }
              errors++;
            }
            if (func2(data19) < 1) {
              const err43 = { instancePath: instancePath + "/stacking/valueUnit", schemaPath: "#/$defs/Text/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
              if (vErrors === null) {
                vErrors = [err43];
              } else {
                vErrors.push(err43);
              }
              errors++;
            }
            if (!pattern5.test(data19)) {
              const err44 = { instancePath: instancePath + "/stacking/valueUnit", schemaPath: "#/$defs/Text/pattern", keyword: "pattern", params: { pattern: "^[^\\p{Cc}\\p{Cs}]+$" }, message: 'must match pattern "^[^\\p{Cc}\\p{Cs}]+$"' };
              if (vErrors === null) {
                vErrors = [err44];
              } else {
                vErrors.push(err44);
              }
              errors++;
            }
          } else {
            const err45 = { instancePath: instancePath + "/stacking/valueUnit", schemaPath: "#/$defs/Text/type", keyword: "type", params: { type: "string" }, message: "must be string" };
            if (vErrors === null) {
              vErrors = [err45];
            } else {
              vErrors.push(err45);
            }
            errors++;
          }
        }
        if (data17.segmentLabels !== void 0) {
          let data20 = data17.segmentLabels;
          if (!(data20 === "none" || data20 === "share" || data20 === "value" || data20 === "value-and-share")) {
            const err46 = { instancePath: instancePath + "/stacking/segmentLabels", schemaPath: "#/properties/stacking/properties/segmentLabels/enum", keyword: "enum", params: { allowedValues: schema32.properties.stacking.properties.segmentLabels.enum }, message: "must be equal to one of the allowed values" };
            if (vErrors === null) {
              vErrors = [err46];
            } else {
              vErrors.push(err46);
            }
            errors++;
          }
        }
      } else {
        const err47 = { instancePath: instancePath + "/stacking", schemaPath: "#/properties/stacking/type", keyword: "type", params: { type: "object" }, message: "must be object" };
        if (vErrors === null) {
          vErrors = [err47];
        } else {
          vErrors.push(err47);
        }
        errors++;
      }
    }
    if (data.bubble !== void 0) {
      let data21 = data.bubble;
      if (data21 && typeof data21 == "object" && !Array.isArray(data21)) {
        if (data21.mode === void 0) {
          const err48 = { instancePath: instancePath + "/bubble", schemaPath: "#/$defs/BubbleEncoding/required", keyword: "required", params: { missingProperty: "mode" }, message: "must have required property 'mode'" };
          if (vErrors === null) {
            vErrors = [err48];
          } else {
            vErrors.push(err48);
          }
          errors++;
        }
        if (data21.domain === void 0) {
          const err49 = { instancePath: instancePath + "/bubble", schemaPath: "#/$defs/BubbleEncoding/required", keyword: "required", params: { missingProperty: "domain" }, message: "must have required property 'domain'" };
          if (vErrors === null) {
            vErrors = [err49];
          } else {
            vErrors.push(err49);
          }
          errors++;
        }
        if (data21.range === void 0) {
          const err50 = { instancePath: instancePath + "/bubble", schemaPath: "#/$defs/BubbleEncoding/required", keyword: "required", params: { missingProperty: "range" }, message: "must have required property 'range'" };
          if (vErrors === null) {
            vErrors = [err50];
          } else {
            vErrors.push(err50);
          }
          errors++;
        }
        for (const key3 in data21) {
          if (!(key3 === "mode" || key3 === "domain" || key3 === "range" || key3 === "minVisibleRadius")) {
            const err51 = { instancePath: instancePath + "/bubble", schemaPath: "#/$defs/BubbleEncoding/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key3 }, message: "must NOT have additional properties" };
            if (vErrors === null) {
              vErrors = [err51];
            } else {
              vErrors.push(err51);
            }
            errors++;
          }
        }
        if (data21.mode !== void 0) {
          let data22 = data21.mode;
          if (!(data22 === "area" || data22 === "radius")) {
            const err52 = { instancePath: instancePath + "/bubble/mode", schemaPath: "#/$defs/BubbleEncoding/properties/mode/enum", keyword: "enum", params: { allowedValues: schema89.properties.mode.enum }, message: "must be equal to one of the allowed values" };
            if (vErrors === null) {
              vErrors = [err52];
            } else {
              vErrors.push(err52);
            }
            errors++;
          }
        }
        if (data21.domain !== void 0) {
          let data23 = data21.domain;
          if (Array.isArray(data23)) {
            if (data23.length > 2) {
              const err53 = { instancePath: instancePath + "/bubble/domain", schemaPath: "#/$defs/BubbleEncoding/properties/domain/maxItems", keyword: "maxItems", params: { limit: 2 }, message: "must NOT have more than 2 items" };
              if (vErrors === null) {
                vErrors = [err53];
              } else {
                vErrors.push(err53);
              }
              errors++;
            }
            if (data23.length < 2) {
              const err54 = { instancePath: instancePath + "/bubble/domain", schemaPath: "#/$defs/BubbleEncoding/properties/domain/minItems", keyword: "minItems", params: { limit: 2 }, message: "must NOT have fewer than 2 items" };
              if (vErrors === null) {
                vErrors = [err54];
              } else {
                vErrors.push(err54);
              }
              errors++;
            }
            const len2 = data23.length;
            if (len2 > 0) {
              let data24 = data23[0];
              if (typeof data24 == "number" && isFinite(data24)) {
                if (data24 < 0 || isNaN(data24)) {
                  const err55 = { instancePath: instancePath + "/bubble/domain/0", schemaPath: "#/$defs/BubbleEncoding/properties/domain/prefixItems/0/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" };
                  if (vErrors === null) {
                    vErrors = [err55];
                  } else {
                    vErrors.push(err55);
                  }
                  errors++;
                }
              } else {
                const err56 = { instancePath: instancePath + "/bubble/domain/0", schemaPath: "#/$defs/BubbleEncoding/properties/domain/prefixItems/0/type", keyword: "type", params: { type: "number" }, message: "must be number" };
                if (vErrors === null) {
                  vErrors = [err56];
                } else {
                  vErrors.push(err56);
                }
                errors++;
              }
            }
            if (len2 > 1) {
              let data25 = data23[1];
              if (typeof data25 == "number" && isFinite(data25)) {
                if (data25 < 0 || isNaN(data25)) {
                  const err57 = { instancePath: instancePath + "/bubble/domain/1", schemaPath: "#/$defs/BubbleEncoding/properties/domain/prefixItems/1/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" };
                  if (vErrors === null) {
                    vErrors = [err57];
                  } else {
                    vErrors.push(err57);
                  }
                  errors++;
                }
              } else {
                const err58 = { instancePath: instancePath + "/bubble/domain/1", schemaPath: "#/$defs/BubbleEncoding/properties/domain/prefixItems/1/type", keyword: "type", params: { type: "number" }, message: "must be number" };
                if (vErrors === null) {
                  vErrors = [err58];
                } else {
                  vErrors.push(err58);
                }
                errors++;
              }
            }
            const len3 = data23.length;
            if (!(len3 <= 2)) {
              const err59 = { instancePath: instancePath + "/bubble/domain", schemaPath: "#/$defs/BubbleEncoding/properties/domain/items", keyword: "items", params: { limit: 2 }, message: "must NOT have more than 2 items" };
              if (vErrors === null) {
                vErrors = [err59];
              } else {
                vErrors.push(err59);
              }
              errors++;
            }
          } else {
            const err60 = { instancePath: instancePath + "/bubble/domain", schemaPath: "#/$defs/BubbleEncoding/properties/domain/type", keyword: "type", params: { type: "array" }, message: "must be array" };
            if (vErrors === null) {
              vErrors = [err60];
            } else {
              vErrors.push(err60);
            }
            errors++;
          }
        }
        if (data21.range !== void 0) {
          let data26 = data21.range;
          if (Array.isArray(data26)) {
            if (data26.length > 2) {
              const err61 = { instancePath: instancePath + "/bubble/range", schemaPath: "#/$defs/BubbleEncoding/properties/range/maxItems", keyword: "maxItems", params: { limit: 2 }, message: "must NOT have more than 2 items" };
              if (vErrors === null) {
                vErrors = [err61];
              } else {
                vErrors.push(err61);
              }
              errors++;
            }
            if (data26.length < 2) {
              const err62 = { instancePath: instancePath + "/bubble/range", schemaPath: "#/$defs/BubbleEncoding/properties/range/minItems", keyword: "minItems", params: { limit: 2 }, message: "must NOT have fewer than 2 items" };
              if (vErrors === null) {
                vErrors = [err62];
              } else {
                vErrors.push(err62);
              }
              errors++;
            }
            const len4 = data26.length;
            if (len4 > 0) {
              let data27 = data26[0];
              if (typeof data27 == "number" && isFinite(data27)) {
                if (data27 < 0 || isNaN(data27)) {
                  const err63 = { instancePath: instancePath + "/bubble/range/0", schemaPath: "#/$defs/BubbleEncoding/properties/range/prefixItems/0/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" };
                  if (vErrors === null) {
                    vErrors = [err63];
                  } else {
                    vErrors.push(err63);
                  }
                  errors++;
                }
              } else {
                const err64 = { instancePath: instancePath + "/bubble/range/0", schemaPath: "#/$defs/BubbleEncoding/properties/range/prefixItems/0/type", keyword: "type", params: { type: "number" }, message: "must be number" };
                if (vErrors === null) {
                  vErrors = [err64];
                } else {
                  vErrors.push(err64);
                }
                errors++;
              }
            }
            if (len4 > 1) {
              let data28 = data26[1];
              if (typeof data28 == "number" && isFinite(data28)) {
                if (data28 < 0 || isNaN(data28)) {
                  const err65 = { instancePath: instancePath + "/bubble/range/1", schemaPath: "#/$defs/BubbleEncoding/properties/range/prefixItems/1/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" };
                  if (vErrors === null) {
                    vErrors = [err65];
                  } else {
                    vErrors.push(err65);
                  }
                  errors++;
                }
              } else {
                const err66 = { instancePath: instancePath + "/bubble/range/1", schemaPath: "#/$defs/BubbleEncoding/properties/range/prefixItems/1/type", keyword: "type", params: { type: "number" }, message: "must be number" };
                if (vErrors === null) {
                  vErrors = [err66];
                } else {
                  vErrors.push(err66);
                }
                errors++;
              }
            }
            const len5 = data26.length;
            if (!(len5 <= 2)) {
              const err67 = { instancePath: instancePath + "/bubble/range", schemaPath: "#/$defs/BubbleEncoding/properties/range/items", keyword: "items", params: { limit: 2 }, message: "must NOT have more than 2 items" };
              if (vErrors === null) {
                vErrors = [err67];
              } else {
                vErrors.push(err67);
              }
              errors++;
            }
          } else {
            const err68 = { instancePath: instancePath + "/bubble/range", schemaPath: "#/$defs/BubbleEncoding/properties/range/type", keyword: "type", params: { type: "array" }, message: "must be array" };
            if (vErrors === null) {
              vErrors = [err68];
            } else {
              vErrors.push(err68);
            }
            errors++;
          }
        }
        if (data21.minVisibleRadius !== void 0) {
          let data29 = data21.minVisibleRadius;
          if (typeof data29 == "number" && isFinite(data29)) {
            if (data29 < 0 || isNaN(data29)) {
              const err69 = { instancePath: instancePath + "/bubble/minVisibleRadius", schemaPath: "#/$defs/BubbleEncoding/properties/minVisibleRadius/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" };
              if (vErrors === null) {
                vErrors = [err69];
              } else {
                vErrors.push(err69);
              }
              errors++;
            }
          } else {
            const err70 = { instancePath: instancePath + "/bubble/minVisibleRadius", schemaPath: "#/$defs/BubbleEncoding/properties/minVisibleRadius/type", keyword: "type", params: { type: "number" }, message: "must be number" };
            if (vErrors === null) {
              vErrors = [err70];
            } else {
              vErrors.push(err70);
            }
            errors++;
          }
        }
      } else {
        const err71 = { instancePath: instancePath + "/bubble", schemaPath: "#/$defs/BubbleEncoding/type", keyword: "type", params: { type: "object" }, message: "must be object" };
        if (vErrors === null) {
          vErrors = [err71];
        } else {
          vErrors.push(err71);
        }
        errors++;
      }
    }
    if (data.referenceLines !== void 0) {
      let data30 = data.referenceLines;
      if (Array.isArray(data30)) {
        if (data30.length > 16) {
          const err72 = { instancePath: instancePath + "/referenceLines", schemaPath: "#/properties/referenceLines/maxItems", keyword: "maxItems", params: { limit: 16 }, message: "must NOT have more than 16 items" };
          if (vErrors === null) {
            vErrors = [err72];
          } else {
            vErrors.push(err72);
          }
          errors++;
        }
        if (data30.length < 0) {
          const err73 = { instancePath: instancePath + "/referenceLines", schemaPath: "#/properties/referenceLines/minItems", keyword: "minItems", params: { limit: 0 }, message: "must NOT have fewer than 0 items" };
          if (vErrors === null) {
            vErrors = [err73];
          } else {
            vErrors.push(err73);
          }
          errors++;
        }
        const len6 = data30.length;
        for (let i2 = 0; i2 < len6; i2++) {
          if (!validate41(data30[i2], { instancePath: instancePath + "/referenceLines/" + i2, parentData: data30, parentDataProperty: i2, rootData, dynamicAnchors })) {
            vErrors = vErrors === null ? validate41.errors : vErrors.concat(validate41.errors);
            errors = vErrors.length;
          }
        }
      } else {
        const err74 = { instancePath: instancePath + "/referenceLines", schemaPath: "#/properties/referenceLines/type", keyword: "type", params: { type: "array" }, message: "must be array" };
        if (vErrors === null) {
          vErrors = [err74];
        } else {
          vErrors.push(err74);
        }
        errors++;
      }
    }
    if (data.annotations !== void 0) {
      let data32 = data.annotations;
      if (Array.isArray(data32)) {
        if (data32.length > 16) {
          const err75 = { instancePath: instancePath + "/annotations", schemaPath: "#/properties/annotations/maxItems", keyword: "maxItems", params: { limit: 16 }, message: "must NOT have more than 16 items" };
          if (vErrors === null) {
            vErrors = [err75];
          } else {
            vErrors.push(err75);
          }
          errors++;
        }
        if (data32.length < 0) {
          const err76 = { instancePath: instancePath + "/annotations", schemaPath: "#/properties/annotations/minItems", keyword: "minItems", params: { limit: 0 }, message: "must NOT have fewer than 0 items" };
          if (vErrors === null) {
            vErrors = [err76];
          } else {
            vErrors.push(err76);
          }
          errors++;
        }
        const len7 = data32.length;
        for (let i3 = 0; i3 < len7; i3++) {
          if (!validate43(data32[i3], { instancePath: instancePath + "/annotations/" + i3, parentData: data32, parentDataProperty: i3, rootData, dynamicAnchors })) {
            vErrors = vErrors === null ? validate43.errors : vErrors.concat(validate43.errors);
            errors = vErrors.length;
          }
        }
      } else {
        const err77 = { instancePath: instancePath + "/annotations", schemaPath: "#/properties/annotations/type", keyword: "type", params: { type: "array" }, message: "must be array" };
        if (vErrors === null) {
          vErrors = [err77];
        } else {
          vErrors.push(err77);
        }
        errors++;
      }
    }
    if (data.labels !== void 0) {
      let data34 = data.labels;
      if (data34 && typeof data34 == "object" && !Array.isArray(data34)) {
        for (const key4 in data34) {
          if (!(key4 === "values")) {
            const err78 = { instancePath: instancePath + "/labels", schemaPath: "#/properties/labels/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key4 }, message: "must NOT have additional properties" };
            if (vErrors === null) {
              vErrors = [err78];
            } else {
              vErrors.push(err78);
            }
            errors++;
          }
        }
        if (data34.values !== void 0) {
          let data35 = data34.values;
          if (!(data35 === "none" || data35 === "totals" || data35 === "all")) {
            const err79 = { instancePath: instancePath + "/labels/values", schemaPath: "#/properties/labels/properties/values/enum", keyword: "enum", params: { allowedValues: schema32.properties.labels.properties.values.enum }, message: "must be equal to one of the allowed values" };
            if (vErrors === null) {
              vErrors = [err79];
            } else {
              vErrors.push(err79);
            }
            errors++;
          }
        }
      } else {
        const err80 = { instancePath: instancePath + "/labels", schemaPath: "#/properties/labels/type", keyword: "type", params: { type: "object" }, message: "must be object" };
        if (vErrors === null) {
          vErrors = [err80];
        } else {
          vErrors.push(err80);
        }
        errors++;
      }
    }
  } else {
    const err81 = { instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" };
    if (vErrors === null) {
      vErrors = [err81];
    } else {
      vErrors.push(err81);
    }
    errors++;
  }
  validate21.errors = vErrors;
  return errors === 0;
}
validate21.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
var schema104 = { "title": "DonutSpec", "description": "Donut chart.", "extends": [{ "$ref": "#/$defs/SpecBase" }], "type": "object", "properties": { "schemaVersion": { "$ref": "#/$defs/SpecBase/properties/schemaVersion" }, "id": { "$ref": "#/$defs/SpecBase/properties/id" }, "kind": { "const": "donut" }, "title": { "$ref": "#/$defs/SpecBase/properties/title" }, "description": { "$ref": "#/$defs/SpecBase/properties/description" }, "caption": { "$ref": "#/$defs/SpecBase/properties/caption" }, "roles": { "$ref": "#/$defs/SpecBase/properties/roles" }, "legend": { "$ref": "#/$defs/SpecBase/properties/legend" }, "slices": { "type": "array", "items": { "$ref": "#/$defs/Slice" }, "minItems": 1, "maxItems": 32 }, "unit": { "$ref": "#/$defs/Text" }, "format": { "$ref": "#/$defs/NumberFormat" }, "center": { "type": "object", "properties": { "value": { "$ref": "#/$defs/Text", "description": '"total", "none" or literal text.' }, "label": { "$ref": "#/$defs/Text" } }, "additionalProperties": false }, "legendValues": { "enum": ["none", "value", "value-share"] } }, "required": ["schemaVersion", "id", "kind", "title", "slices"], "additionalProperties": false };
var schema111 = { "title": "Slice", "type": "object", "properties": { "id": { "$ref": "#/$defs/Id" }, "label": { "$ref": "#/$defs/Text" }, "value": { "type": ["number", "null"], "description": ">= 0; null means missing." }, "displayValue": { "$ref": "#/$defs/Text" }, "role": { "$ref": "#/$defs/Id" }, "color": { "$ref": "#/$defs/Color" } }, "required": ["id", "label", "value"], "additionalProperties": false };
function validate47(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate47.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.id === void 0) {
      const err0 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "id" }, message: "must have required property 'id'" };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.label === void 0) {
      const err1 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "label" }, message: "must have required property 'label'" };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    if (data.value === void 0) {
      const err2 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "value" }, message: "must have required property 'value'" };
      if (vErrors === null) {
        vErrors = [err2];
      } else {
        vErrors.push(err2);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!(key0 === "id" || key0 === "label" || key0 === "value" || key0 === "displayValue" || key0 === "role" || key0 === "color")) {
        const err3 = { instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" };
        if (vErrors === null) {
          vErrors = [err3];
        } else {
          vErrors.push(err3);
        }
        errors++;
      }
    }
    if (data.id !== void 0) {
      let data0 = data.id;
      if (typeof data0 === "string") {
        if (!pattern4.test(data0)) {
          const err4 = { instancePath: instancePath + "/id", schemaPath: "#/$defs/Id/pattern", keyword: "pattern", params: { pattern: "^[A-Za-z][A-Za-z0-9_-]{0,63}$" }, message: 'must match pattern "^[A-Za-z][A-Za-z0-9_-]{0,63}$"' };
          if (vErrors === null) {
            vErrors = [err4];
          } else {
            vErrors.push(err4);
          }
          errors++;
        }
      } else {
        const err5 = { instancePath: instancePath + "/id", schemaPath: "#/$defs/Id/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err5];
        } else {
          vErrors.push(err5);
        }
        errors++;
      }
    }
    if (data.label !== void 0) {
      let data1 = data.label;
      if (typeof data1 === "string") {
        if (func2(data1) > 500) {
          const err6 = { instancePath: instancePath + "/label", schemaPath: "#/$defs/Text/maxLength", keyword: "maxLength", params: { limit: 500 }, message: "must NOT have more than 500 characters" };
          if (vErrors === null) {
            vErrors = [err6];
          } else {
            vErrors.push(err6);
          }
          errors++;
        }
        if (func2(data1) < 1) {
          const err7 = { instancePath: instancePath + "/label", schemaPath: "#/$defs/Text/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
          if (vErrors === null) {
            vErrors = [err7];
          } else {
            vErrors.push(err7);
          }
          errors++;
        }
        if (!pattern5.test(data1)) {
          const err8 = { instancePath: instancePath + "/label", schemaPath: "#/$defs/Text/pattern", keyword: "pattern", params: { pattern: "^[^\\p{Cc}\\p{Cs}]+$" }, message: 'must match pattern "^[^\\p{Cc}\\p{Cs}]+$"' };
          if (vErrors === null) {
            vErrors = [err8];
          } else {
            vErrors.push(err8);
          }
          errors++;
        }
      } else {
        const err9 = { instancePath: instancePath + "/label", schemaPath: "#/$defs/Text/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err9];
        } else {
          vErrors.push(err9);
        }
        errors++;
      }
    }
    if (data.value !== void 0) {
      let data2 = data.value;
      if (!(typeof data2 == "number" && isFinite(data2)) && data2 !== null) {
        const err10 = { instancePath: instancePath + "/value", schemaPath: "#/properties/value/type", keyword: "type", params: { type: schema111.properties.value.type }, message: "must be number,null" };
        if (vErrors === null) {
          vErrors = [err10];
        } else {
          vErrors.push(err10);
        }
        errors++;
      }
    }
    if (data.displayValue !== void 0) {
      let data3 = data.displayValue;
      if (typeof data3 === "string") {
        if (func2(data3) > 500) {
          const err11 = { instancePath: instancePath + "/displayValue", schemaPath: "#/$defs/Text/maxLength", keyword: "maxLength", params: { limit: 500 }, message: "must NOT have more than 500 characters" };
          if (vErrors === null) {
            vErrors = [err11];
          } else {
            vErrors.push(err11);
          }
          errors++;
        }
        if (func2(data3) < 1) {
          const err12 = { instancePath: instancePath + "/displayValue", schemaPath: "#/$defs/Text/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
          if (vErrors === null) {
            vErrors = [err12];
          } else {
            vErrors.push(err12);
          }
          errors++;
        }
        if (!pattern5.test(data3)) {
          const err13 = { instancePath: instancePath + "/displayValue", schemaPath: "#/$defs/Text/pattern", keyword: "pattern", params: { pattern: "^[^\\p{Cc}\\p{Cs}]+$" }, message: 'must match pattern "^[^\\p{Cc}\\p{Cs}]+$"' };
          if (vErrors === null) {
            vErrors = [err13];
          } else {
            vErrors.push(err13);
          }
          errors++;
        }
      } else {
        const err14 = { instancePath: instancePath + "/displayValue", schemaPath: "#/$defs/Text/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err14];
        } else {
          vErrors.push(err14);
        }
        errors++;
      }
    }
    if (data.role !== void 0) {
      let data4 = data.role;
      if (typeof data4 === "string") {
        if (!pattern4.test(data4)) {
          const err15 = { instancePath: instancePath + "/role", schemaPath: "#/$defs/Id/pattern", keyword: "pattern", params: { pattern: "^[A-Za-z][A-Za-z0-9_-]{0,63}$" }, message: 'must match pattern "^[A-Za-z][A-Za-z0-9_-]{0,63}$"' };
          if (vErrors === null) {
            vErrors = [err15];
          } else {
            vErrors.push(err15);
          }
          errors++;
        }
      } else {
        const err16 = { instancePath: instancePath + "/role", schemaPath: "#/$defs/Id/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err16];
        } else {
          vErrors.push(err16);
        }
        errors++;
      }
    }
    if (data.color !== void 0) {
      let data5 = data.color;
      if (typeof data5 === "string") {
        if (!pattern10.test(data5)) {
          const err17 = { instancePath: instancePath + "/color", schemaPath: "#/$defs/Color/pattern", keyword: "pattern", params: { pattern: "^#[0-9a-fA-F]{6}$" }, message: 'must match pattern "^#[0-9a-fA-F]{6}$"' };
          if (vErrors === null) {
            vErrors = [err17];
          } else {
            vErrors.push(err17);
          }
          errors++;
        }
      } else {
        const err18 = { instancePath: instancePath + "/color", schemaPath: "#/$defs/Color/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err18];
        } else {
          vErrors.push(err18);
        }
        errors++;
      }
    }
  } else {
    const err19 = { instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" };
    if (vErrors === null) {
      vErrors = [err19];
    } else {
      vErrors.push(err19);
    }
    errors++;
  }
  validate47.errors = vErrors;
  return errors === 0;
}
validate47.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
function validate45(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate45.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.schemaVersion === void 0) {
      const err0 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "schemaVersion" }, message: "must have required property 'schemaVersion'" };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.id === void 0) {
      const err1 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "id" }, message: "must have required property 'id'" };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    if (data.kind === void 0) {
      const err2 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "kind" }, message: "must have required property 'kind'" };
      if (vErrors === null) {
        vErrors = [err2];
      } else {
        vErrors.push(err2);
      }
      errors++;
    }
    if (data.title === void 0) {
      const err3 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "title" }, message: "must have required property 'title'" };
      if (vErrors === null) {
        vErrors = [err3];
      } else {
        vErrors.push(err3);
      }
      errors++;
    }
    if (data.slices === void 0) {
      const err4 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "slices" }, message: "must have required property 'slices'" };
      if (vErrors === null) {
        vErrors = [err4];
      } else {
        vErrors.push(err4);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!func1.call(schema104.properties, key0)) {
        const err5 = { instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" };
        if (vErrors === null) {
          vErrors = [err5];
        } else {
          vErrors.push(err5);
        }
        errors++;
      }
    }
    if (data.schemaVersion !== void 0) {
      let data0 = data.schemaVersion;
      if (!(typeof data0 == "number" && (!(data0 % 1) && !isNaN(data0)) && isFinite(data0))) {
        const err6 = { instancePath: instancePath + "/schemaVersion", schemaPath: "#/$defs/SpecBase/properties/schemaVersion/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
        if (vErrors === null) {
          vErrors = [err6];
        } else {
          vErrors.push(err6);
        }
        errors++;
      }
      if (1 !== data0) {
        const err7 = { instancePath: instancePath + "/schemaVersion", schemaPath: "#/$defs/SpecBase/properties/schemaVersion/const", keyword: "const", params: { allowedValue: 1 }, message: "must be equal to constant" };
        if (vErrors === null) {
          vErrors = [err7];
        } else {
          vErrors.push(err7);
        }
        errors++;
      }
    }
    if (data.id !== void 0) {
      let data1 = data.id;
      if (typeof data1 === "string") {
        if (!pattern4.test(data1)) {
          const err8 = { instancePath: instancePath + "/id", schemaPath: "#/$defs/SpecBase/properties/id/pattern", keyword: "pattern", params: { pattern: "^[A-Za-z][A-Za-z0-9_-]{0,63}$" }, message: 'must match pattern "^[A-Za-z][A-Za-z0-9_-]{0,63}$"' };
          if (vErrors === null) {
            vErrors = [err8];
          } else {
            vErrors.push(err8);
          }
          errors++;
        }
      } else {
        const err9 = { instancePath: instancePath + "/id", schemaPath: "#/$defs/SpecBase/properties/id/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err9];
        } else {
          vErrors.push(err9);
        }
        errors++;
      }
    }
    if (data.kind !== void 0) {
      if ("donut" !== data.kind) {
        const err10 = { instancePath: instancePath + "/kind", schemaPath: "#/properties/kind/const", keyword: "const", params: { allowedValue: "donut" }, message: "must be equal to constant" };
        if (vErrors === null) {
          vErrors = [err10];
        } else {
          vErrors.push(err10);
        }
        errors++;
      }
    }
    if (data.title !== void 0) {
      let data3 = data.title;
      if (typeof data3 === "string") {
        if (func2(data3) > 200) {
          const err11 = { instancePath: instancePath + "/title", schemaPath: "#/$defs/SpecBase/properties/title/maxLength", keyword: "maxLength", params: { limit: 200 }, message: "must NOT have more than 200 characters" };
          if (vErrors === null) {
            vErrors = [err11];
          } else {
            vErrors.push(err11);
          }
          errors++;
        }
        if (func2(data3) < 1) {
          const err12 = { instancePath: instancePath + "/title", schemaPath: "#/$defs/SpecBase/properties/title/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
          if (vErrors === null) {
            vErrors = [err12];
          } else {
            vErrors.push(err12);
          }
          errors++;
        }
        if (!pattern5.test(data3)) {
          const err13 = { instancePath: instancePath + "/title", schemaPath: "#/$defs/SpecBase/properties/title/pattern", keyword: "pattern", params: { pattern: "^[^\\p{Cc}\\p{Cs}]+$" }, message: 'must match pattern "^[^\\p{Cc}\\p{Cs}]+$"' };
          if (vErrors === null) {
            vErrors = [err13];
          } else {
            vErrors.push(err13);
          }
          errors++;
        }
      } else {
        const err14 = { instancePath: instancePath + "/title", schemaPath: "#/$defs/SpecBase/properties/title/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err14];
        } else {
          vErrors.push(err14);
        }
        errors++;
      }
    }
    if (data.description !== void 0) {
      let data4 = data.description;
      if (typeof data4 === "string") {
        if (func2(data4) > 2e3) {
          const err15 = { instancePath: instancePath + "/description", schemaPath: "#/$defs/SpecBase/properties/description/maxLength", keyword: "maxLength", params: { limit: 2e3 }, message: "must NOT have more than 2000 characters" };
          if (vErrors === null) {
            vErrors = [err15];
          } else {
            vErrors.push(err15);
          }
          errors++;
        }
        if (!pattern6.test(data4)) {
          const err16 = { instancePath: instancePath + "/description", schemaPath: "#/$defs/SpecBase/properties/description/pattern", keyword: "pattern", params: { pattern: "^(?:[^\\p{Cc}\\p{Cs}]|\\n)*$" }, message: 'must match pattern "^(?:[^\\p{Cc}\\p{Cs}]|\\n)*$"' };
          if (vErrors === null) {
            vErrors = [err16];
          } else {
            vErrors.push(err16);
          }
          errors++;
        }
      } else {
        const err17 = { instancePath: instancePath + "/description", schemaPath: "#/$defs/SpecBase/properties/description/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err17];
        } else {
          vErrors.push(err17);
        }
        errors++;
      }
    }
    if (data.caption !== void 0) {
      let data5 = data.caption;
      if (typeof data5 === "string") {
        if (func2(data5) > 500) {
          const err18 = { instancePath: instancePath + "/caption", schemaPath: "#/$defs/SpecBase/properties/caption/maxLength", keyword: "maxLength", params: { limit: 500 }, message: "must NOT have more than 500 characters" };
          if (vErrors === null) {
            vErrors = [err18];
          } else {
            vErrors.push(err18);
          }
          errors++;
        }
        if (func2(data5) < 1) {
          const err19 = { instancePath: instancePath + "/caption", schemaPath: "#/$defs/SpecBase/properties/caption/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
          if (vErrors === null) {
            vErrors = [err19];
          } else {
            vErrors.push(err19);
          }
          errors++;
        }
        if (!pattern7.test(data5)) {
          const err20 = { instancePath: instancePath + "/caption", schemaPath: "#/$defs/SpecBase/properties/caption/pattern", keyword: "pattern", params: { pattern: "^(?:[^\\p{Cc}\\p{Cs}]|\\n)+$" }, message: 'must match pattern "^(?:[^\\p{Cc}\\p{Cs}]|\\n)+$"' };
          if (vErrors === null) {
            vErrors = [err20];
          } else {
            vErrors.push(err20);
          }
          errors++;
        }
      } else {
        const err21 = { instancePath: instancePath + "/caption", schemaPath: "#/$defs/SpecBase/properties/caption/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err21];
        } else {
          vErrors.push(err21);
        }
        errors++;
      }
    }
    if (data.roles !== void 0) {
      if (!validate22(data.roles, { instancePath: instancePath + "/roles", parentData: data, parentDataProperty: "roles", rootData, dynamicAnchors })) {
        vErrors = vErrors === null ? validate22.errors : vErrors.concat(validate22.errors);
        errors = vErrors.length;
      }
    }
    if (data.legend !== void 0) {
      let data7 = data.legend;
      if (data7 && typeof data7 == "object" && !Array.isArray(data7)) {
        for (const key1 in data7) {
          if (!(key1 === "show" || key1 === "position")) {
            const err22 = { instancePath: instancePath + "/legend", schemaPath: "#/$defs/SpecBase/properties/legend/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key1 }, message: "must NOT have additional properties" };
            if (vErrors === null) {
              vErrors = [err22];
            } else {
              vErrors.push(err22);
            }
            errors++;
          }
        }
        if (data7.show !== void 0) {
          let data8 = data7.show;
          if (!(data8 === "auto" || data8 === "always" || data8 === "never")) {
            const err23 = { instancePath: instancePath + "/legend/show", schemaPath: "#/$defs/SpecBase/properties/legend/properties/show/enum", keyword: "enum", params: { allowedValues: schema44.properties.show.enum }, message: "must be equal to one of the allowed values" };
            if (vErrors === null) {
              vErrors = [err23];
            } else {
              vErrors.push(err23);
            }
            errors++;
          }
        }
        if (data7.position !== void 0) {
          let data9 = data7.position;
          if (!(data9 === "top" || data9 === "bottom")) {
            const err24 = { instancePath: instancePath + "/legend/position", schemaPath: "#/$defs/SpecBase/properties/legend/properties/position/enum", keyword: "enum", params: { allowedValues: schema44.properties.position.enum }, message: "must be equal to one of the allowed values" };
            if (vErrors === null) {
              vErrors = [err24];
            } else {
              vErrors.push(err24);
            }
            errors++;
          }
        }
      } else {
        const err25 = { instancePath: instancePath + "/legend", schemaPath: "#/$defs/SpecBase/properties/legend/type", keyword: "type", params: { type: "object" }, message: "must be object" };
        if (vErrors === null) {
          vErrors = [err25];
        } else {
          vErrors.push(err25);
        }
        errors++;
      }
    }
    if (data.slices !== void 0) {
      let data10 = data.slices;
      if (Array.isArray(data10)) {
        if (data10.length > 32) {
          const err26 = { instancePath: instancePath + "/slices", schemaPath: "#/properties/slices/maxItems", keyword: "maxItems", params: { limit: 32 }, message: "must NOT have more than 32 items" };
          if (vErrors === null) {
            vErrors = [err26];
          } else {
            vErrors.push(err26);
          }
          errors++;
        }
        if (data10.length < 1) {
          const err27 = { instancePath: instancePath + "/slices", schemaPath: "#/properties/slices/minItems", keyword: "minItems", params: { limit: 1 }, message: "must NOT have fewer than 1 items" };
          if (vErrors === null) {
            vErrors = [err27];
          } else {
            vErrors.push(err27);
          }
          errors++;
        }
        const len0 = data10.length;
        for (let i0 = 0; i0 < len0; i0++) {
          if (!validate47(data10[i0], { instancePath: instancePath + "/slices/" + i0, parentData: data10, parentDataProperty: i0, rootData, dynamicAnchors })) {
            vErrors = vErrors === null ? validate47.errors : vErrors.concat(validate47.errors);
            errors = vErrors.length;
          }
        }
      } else {
        const err28 = { instancePath: instancePath + "/slices", schemaPath: "#/properties/slices/type", keyword: "type", params: { type: "array" }, message: "must be array" };
        if (vErrors === null) {
          vErrors = [err28];
        } else {
          vErrors.push(err28);
        }
        errors++;
      }
    }
    if (data.unit !== void 0) {
      let data12 = data.unit;
      if (typeof data12 === "string") {
        if (func2(data12) > 500) {
          const err29 = { instancePath: instancePath + "/unit", schemaPath: "#/$defs/Text/maxLength", keyword: "maxLength", params: { limit: 500 }, message: "must NOT have more than 500 characters" };
          if (vErrors === null) {
            vErrors = [err29];
          } else {
            vErrors.push(err29);
          }
          errors++;
        }
        if (func2(data12) < 1) {
          const err30 = { instancePath: instancePath + "/unit", schemaPath: "#/$defs/Text/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
          if (vErrors === null) {
            vErrors = [err30];
          } else {
            vErrors.push(err30);
          }
          errors++;
        }
        if (!pattern5.test(data12)) {
          const err31 = { instancePath: instancePath + "/unit", schemaPath: "#/$defs/Text/pattern", keyword: "pattern", params: { pattern: "^[^\\p{Cc}\\p{Cs}]+$" }, message: 'must match pattern "^[^\\p{Cc}\\p{Cs}]+$"' };
          if (vErrors === null) {
            vErrors = [err31];
          } else {
            vErrors.push(err31);
          }
          errors++;
        }
      } else {
        const err32 = { instancePath: instancePath + "/unit", schemaPath: "#/$defs/Text/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err32];
        } else {
          vErrors.push(err32);
        }
        errors++;
      }
    }
    if (data.format !== void 0) {
      let data13 = data.format;
      if (data13 && typeof data13 == "object" && !Array.isArray(data13)) {
        for (const key2 in data13) {
          if (!(key2 === "style" || key2 === "currency" || key2 === "minimumFractionDigits" || key2 === "maximumFractionDigits" || key2 === "signDisplay")) {
            const err33 = { instancePath: instancePath + "/format", schemaPath: "#/$defs/NumberFormat/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key2 }, message: "must NOT have additional properties" };
            if (vErrors === null) {
              vErrors = [err33];
            } else {
              vErrors.push(err33);
            }
            errors++;
          }
        }
        if (data13.style !== void 0) {
          let data14 = data13.style;
          if (!(data14 === "decimal" || data14 === "percent" || data14 === "currency" || data14 === "compact")) {
            const err34 = { instancePath: instancePath + "/format/style", schemaPath: "#/$defs/NumberFormat/properties/style/enum", keyword: "enum", params: { allowedValues: schema54.properties.style.enum }, message: "must be equal to one of the allowed values" };
            if (vErrors === null) {
              vErrors = [err34];
            } else {
              vErrors.push(err34);
            }
            errors++;
          }
        }
        if (data13.currency !== void 0) {
          let data15 = data13.currency;
          if (typeof data15 === "string") {
            if (!pattern18.test(data15)) {
              const err35 = { instancePath: instancePath + "/format/currency", schemaPath: "#/$defs/NumberFormat/properties/currency/pattern", keyword: "pattern", params: { pattern: "^[A-Z]{3}$" }, message: 'must match pattern "^[A-Z]{3}$"' };
              if (vErrors === null) {
                vErrors = [err35];
              } else {
                vErrors.push(err35);
              }
              errors++;
            }
          } else {
            const err36 = { instancePath: instancePath + "/format/currency", schemaPath: "#/$defs/NumberFormat/properties/currency/type", keyword: "type", params: { type: "string" }, message: "must be string" };
            if (vErrors === null) {
              vErrors = [err36];
            } else {
              vErrors.push(err36);
            }
            errors++;
          }
        }
        if (data13.minimumFractionDigits !== void 0) {
          let data16 = data13.minimumFractionDigits;
          if (!(typeof data16 == "number" && (!(data16 % 1) && !isNaN(data16)) && isFinite(data16))) {
            const err37 = { instancePath: instancePath + "/format/minimumFractionDigits", schemaPath: "#/$defs/NumberFormat/properties/minimumFractionDigits/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
            if (vErrors === null) {
              vErrors = [err37];
            } else {
              vErrors.push(err37);
            }
            errors++;
          }
          if (typeof data16 == "number" && isFinite(data16)) {
            if (data16 > 6 || isNaN(data16)) {
              const err38 = { instancePath: instancePath + "/format/minimumFractionDigits", schemaPath: "#/$defs/NumberFormat/properties/minimumFractionDigits/maximum", keyword: "maximum", params: { comparison: "<=", limit: 6 }, message: "must be <= 6" };
              if (vErrors === null) {
                vErrors = [err38];
              } else {
                vErrors.push(err38);
              }
              errors++;
            }
            if (data16 < 0 || isNaN(data16)) {
              const err39 = { instancePath: instancePath + "/format/minimumFractionDigits", schemaPath: "#/$defs/NumberFormat/properties/minimumFractionDigits/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" };
              if (vErrors === null) {
                vErrors = [err39];
              } else {
                vErrors.push(err39);
              }
              errors++;
            }
          }
        }
        if (data13.maximumFractionDigits !== void 0) {
          let data17 = data13.maximumFractionDigits;
          if (!(typeof data17 == "number" && (!(data17 % 1) && !isNaN(data17)) && isFinite(data17))) {
            const err40 = { instancePath: instancePath + "/format/maximumFractionDigits", schemaPath: "#/$defs/NumberFormat/properties/maximumFractionDigits/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
            if (vErrors === null) {
              vErrors = [err40];
            } else {
              vErrors.push(err40);
            }
            errors++;
          }
          if (typeof data17 == "number" && isFinite(data17)) {
            if (data17 > 6 || isNaN(data17)) {
              const err41 = { instancePath: instancePath + "/format/maximumFractionDigits", schemaPath: "#/$defs/NumberFormat/properties/maximumFractionDigits/maximum", keyword: "maximum", params: { comparison: "<=", limit: 6 }, message: "must be <= 6" };
              if (vErrors === null) {
                vErrors = [err41];
              } else {
                vErrors.push(err41);
              }
              errors++;
            }
            if (data17 < 0 || isNaN(data17)) {
              const err42 = { instancePath: instancePath + "/format/maximumFractionDigits", schemaPath: "#/$defs/NumberFormat/properties/maximumFractionDigits/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" };
              if (vErrors === null) {
                vErrors = [err42];
              } else {
                vErrors.push(err42);
              }
              errors++;
            }
          }
        }
        if (data13.signDisplay !== void 0) {
          let data18 = data13.signDisplay;
          if (!(data18 === "auto" || data18 === "always" || data18 === "exceptZero")) {
            const err43 = { instancePath: instancePath + "/format/signDisplay", schemaPath: "#/$defs/NumberFormat/properties/signDisplay/enum", keyword: "enum", params: { allowedValues: schema54.properties.signDisplay.enum }, message: "must be equal to one of the allowed values" };
            if (vErrors === null) {
              vErrors = [err43];
            } else {
              vErrors.push(err43);
            }
            errors++;
          }
        }
      } else {
        const err44 = { instancePath: instancePath + "/format", schemaPath: "#/$defs/NumberFormat/type", keyword: "type", params: { type: "object" }, message: "must be object" };
        if (vErrors === null) {
          vErrors = [err44];
        } else {
          vErrors.push(err44);
        }
        errors++;
      }
    }
    if (data.center !== void 0) {
      let data19 = data.center;
      if (data19 && typeof data19 == "object" && !Array.isArray(data19)) {
        for (const key3 in data19) {
          if (!(key3 === "value" || key3 === "label")) {
            const err45 = { instancePath: instancePath + "/center", schemaPath: "#/properties/center/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key3 }, message: "must NOT have additional properties" };
            if (vErrors === null) {
              vErrors = [err45];
            } else {
              vErrors.push(err45);
            }
            errors++;
          }
        }
        if (data19.value !== void 0) {
          let data20 = data19.value;
          if (typeof data20 === "string") {
            if (func2(data20) > 500) {
              const err46 = { instancePath: instancePath + "/center/value", schemaPath: "#/$defs/Text/maxLength", keyword: "maxLength", params: { limit: 500 }, message: "must NOT have more than 500 characters" };
              if (vErrors === null) {
                vErrors = [err46];
              } else {
                vErrors.push(err46);
              }
              errors++;
            }
            if (func2(data20) < 1) {
              const err47 = { instancePath: instancePath + "/center/value", schemaPath: "#/$defs/Text/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
              if (vErrors === null) {
                vErrors = [err47];
              } else {
                vErrors.push(err47);
              }
              errors++;
            }
            if (!pattern5.test(data20)) {
              const err48 = { instancePath: instancePath + "/center/value", schemaPath: "#/$defs/Text/pattern", keyword: "pattern", params: { pattern: "^[^\\p{Cc}\\p{Cs}]+$" }, message: 'must match pattern "^[^\\p{Cc}\\p{Cs}]+$"' };
              if (vErrors === null) {
                vErrors = [err48];
              } else {
                vErrors.push(err48);
              }
              errors++;
            }
          } else {
            const err49 = { instancePath: instancePath + "/center/value", schemaPath: "#/$defs/Text/type", keyword: "type", params: { type: "string" }, message: "must be string" };
            if (vErrors === null) {
              vErrors = [err49];
            } else {
              vErrors.push(err49);
            }
            errors++;
          }
        }
        if (data19.label !== void 0) {
          let data21 = data19.label;
          if (typeof data21 === "string") {
            if (func2(data21) > 500) {
              const err50 = { instancePath: instancePath + "/center/label", schemaPath: "#/$defs/Text/maxLength", keyword: "maxLength", params: { limit: 500 }, message: "must NOT have more than 500 characters" };
              if (vErrors === null) {
                vErrors = [err50];
              } else {
                vErrors.push(err50);
              }
              errors++;
            }
            if (func2(data21) < 1) {
              const err51 = { instancePath: instancePath + "/center/label", schemaPath: "#/$defs/Text/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
              if (vErrors === null) {
                vErrors = [err51];
              } else {
                vErrors.push(err51);
              }
              errors++;
            }
            if (!pattern5.test(data21)) {
              const err52 = { instancePath: instancePath + "/center/label", schemaPath: "#/$defs/Text/pattern", keyword: "pattern", params: { pattern: "^[^\\p{Cc}\\p{Cs}]+$" }, message: 'must match pattern "^[^\\p{Cc}\\p{Cs}]+$"' };
              if (vErrors === null) {
                vErrors = [err52];
              } else {
                vErrors.push(err52);
              }
              errors++;
            }
          } else {
            const err53 = { instancePath: instancePath + "/center/label", schemaPath: "#/$defs/Text/type", keyword: "type", params: { type: "string" }, message: "must be string" };
            if (vErrors === null) {
              vErrors = [err53];
            } else {
              vErrors.push(err53);
            }
            errors++;
          }
        }
      } else {
        const err54 = { instancePath: instancePath + "/center", schemaPath: "#/properties/center/type", keyword: "type", params: { type: "object" }, message: "must be object" };
        if (vErrors === null) {
          vErrors = [err54];
        } else {
          vErrors.push(err54);
        }
        errors++;
      }
    }
    if (data.legendValues !== void 0) {
      let data22 = data.legendValues;
      if (!(data22 === "none" || data22 === "value" || data22 === "value-share")) {
        const err55 = { instancePath: instancePath + "/legendValues", schemaPath: "#/properties/legendValues/enum", keyword: "enum", params: { allowedValues: schema104.properties.legendValues.enum }, message: "must be equal to one of the allowed values" };
        if (vErrors === null) {
          vErrors = [err55];
        } else {
          vErrors.push(err55);
        }
        errors++;
      }
    }
  } else {
    const err56 = { instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" };
    if (vErrors === null) {
      vErrors = [err56];
    } else {
      vErrors.push(err56);
    }
    errors++;
  }
  validate45.errors = vErrors;
  return errors === 0;
}
validate45.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
var schema121 = { "title": "HeatmapSpec", "description": "Heatmap.", "extends": [{ "$ref": "#/$defs/SpecBase" }], "type": "object", "properties": { "schemaVersion": { "$ref": "#/$defs/SpecBase/properties/schemaVersion" }, "id": { "$ref": "#/$defs/SpecBase/properties/id" }, "kind": { "const": "heatmap" }, "title": { "$ref": "#/$defs/SpecBase/properties/title" }, "description": { "$ref": "#/$defs/SpecBase/properties/description" }, "caption": { "$ref": "#/$defs/SpecBase/properties/caption" }, "roles": { "$ref": "#/$defs/SpecBase/properties/roles" }, "legend": { "$ref": "#/$defs/SpecBase/properties/legend" }, "rows": { "type": "array", "items": { "$ref": "#/$defs/HeatmapAxisItem" }, "minItems": 1, "maxItems": 100 }, "columns": { "type": "array", "items": { "$ref": "#/$defs/HeatmapAxisItem" }, "minItems": 1, "maxItems": 100 }, "cells": { "type": "array", "items": { "$ref": "#/$defs/HeatmapCell" } }, "scale": { "$ref": "#/$defs/HeatmapScale" }, "unit": { "$ref": "#/$defs/Text" }, "format": { "$ref": "#/$defs/NumberFormat" }, "cellLabels": { "enum": ["all", "none"] }, "rowAxisLabel": { "$ref": "#/$defs/Text" }, "columnAxisLabel": { "$ref": "#/$defs/Text" } }, "required": ["schemaVersion", "id", "kind", "title", "rows", "columns", "cells", "scale"], "additionalProperties": false };
function validate51(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate51.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.id === void 0) {
      const err0 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "id" }, message: "must have required property 'id'" };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.label === void 0) {
      const err1 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "label" }, message: "must have required property 'label'" };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!(key0 === "id" || key0 === "label")) {
        const err2 = { instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" };
        if (vErrors === null) {
          vErrors = [err2];
        } else {
          vErrors.push(err2);
        }
        errors++;
      }
    }
    if (data.id !== void 0) {
      let data0 = data.id;
      if (typeof data0 === "string") {
        if (!pattern4.test(data0)) {
          const err3 = { instancePath: instancePath + "/id", schemaPath: "#/$defs/Id/pattern", keyword: "pattern", params: { pattern: "^[A-Za-z][A-Za-z0-9_-]{0,63}$" }, message: 'must match pattern "^[A-Za-z][A-Za-z0-9_-]{0,63}$"' };
          if (vErrors === null) {
            vErrors = [err3];
          } else {
            vErrors.push(err3);
          }
          errors++;
        }
      } else {
        const err4 = { instancePath: instancePath + "/id", schemaPath: "#/$defs/Id/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err4];
        } else {
          vErrors.push(err4);
        }
        errors++;
      }
    }
    if (data.label !== void 0) {
      let data1 = data.label;
      if (typeof data1 === "string") {
        if (func2(data1) > 500) {
          const err5 = { instancePath: instancePath + "/label", schemaPath: "#/$defs/Text/maxLength", keyword: "maxLength", params: { limit: 500 }, message: "must NOT have more than 500 characters" };
          if (vErrors === null) {
            vErrors = [err5];
          } else {
            vErrors.push(err5);
          }
          errors++;
        }
        if (func2(data1) < 1) {
          const err6 = { instancePath: instancePath + "/label", schemaPath: "#/$defs/Text/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
          if (vErrors === null) {
            vErrors = [err6];
          } else {
            vErrors.push(err6);
          }
          errors++;
        }
        if (!pattern5.test(data1)) {
          const err7 = { instancePath: instancePath + "/label", schemaPath: "#/$defs/Text/pattern", keyword: "pattern", params: { pattern: "^[^\\p{Cc}\\p{Cs}]+$" }, message: 'must match pattern "^[^\\p{Cc}\\p{Cs}]+$"' };
          if (vErrors === null) {
            vErrors = [err7];
          } else {
            vErrors.push(err7);
          }
          errors++;
        }
      } else {
        const err8 = { instancePath: instancePath + "/label", schemaPath: "#/$defs/Text/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err8];
        } else {
          vErrors.push(err8);
        }
        errors++;
      }
    }
  } else {
    const err9 = { instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" };
    if (vErrors === null) {
      vErrors = [err9];
    } else {
      vErrors.push(err9);
    }
    errors++;
  }
  validate51.errors = vErrors;
  return errors === 0;
}
validate51.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
var schema131 = { "title": "HeatmapCell", "type": "object", "properties": { "row": { "$ref": "#/$defs/Id" }, "column": { "$ref": "#/$defs/Id" }, "value": { "type": ["number", "null"] }, "displayValue": { "$ref": "#/$defs/Text" }, "note": { "$ref": "#/$defs/Text" } }, "required": ["row", "column", "value"], "additionalProperties": false };
function validate54(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate54.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.row === void 0) {
      const err0 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "row" }, message: "must have required property 'row'" };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.column === void 0) {
      const err1 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "column" }, message: "must have required property 'column'" };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    if (data.value === void 0) {
      const err2 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "value" }, message: "must have required property 'value'" };
      if (vErrors === null) {
        vErrors = [err2];
      } else {
        vErrors.push(err2);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!(key0 === "row" || key0 === "column" || key0 === "value" || key0 === "displayValue" || key0 === "note")) {
        const err3 = { instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" };
        if (vErrors === null) {
          vErrors = [err3];
        } else {
          vErrors.push(err3);
        }
        errors++;
      }
    }
    if (data.row !== void 0) {
      let data0 = data.row;
      if (typeof data0 === "string") {
        if (!pattern4.test(data0)) {
          const err4 = { instancePath: instancePath + "/row", schemaPath: "#/$defs/Id/pattern", keyword: "pattern", params: { pattern: "^[A-Za-z][A-Za-z0-9_-]{0,63}$" }, message: 'must match pattern "^[A-Za-z][A-Za-z0-9_-]{0,63}$"' };
          if (vErrors === null) {
            vErrors = [err4];
          } else {
            vErrors.push(err4);
          }
          errors++;
        }
      } else {
        const err5 = { instancePath: instancePath + "/row", schemaPath: "#/$defs/Id/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err5];
        } else {
          vErrors.push(err5);
        }
        errors++;
      }
    }
    if (data.column !== void 0) {
      let data1 = data.column;
      if (typeof data1 === "string") {
        if (!pattern4.test(data1)) {
          const err6 = { instancePath: instancePath + "/column", schemaPath: "#/$defs/Id/pattern", keyword: "pattern", params: { pattern: "^[A-Za-z][A-Za-z0-9_-]{0,63}$" }, message: 'must match pattern "^[A-Za-z][A-Za-z0-9_-]{0,63}$"' };
          if (vErrors === null) {
            vErrors = [err6];
          } else {
            vErrors.push(err6);
          }
          errors++;
        }
      } else {
        const err7 = { instancePath: instancePath + "/column", schemaPath: "#/$defs/Id/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err7];
        } else {
          vErrors.push(err7);
        }
        errors++;
      }
    }
    if (data.value !== void 0) {
      let data2 = data.value;
      if (!(typeof data2 == "number" && isFinite(data2)) && data2 !== null) {
        const err8 = { instancePath: instancePath + "/value", schemaPath: "#/properties/value/type", keyword: "type", params: { type: schema131.properties.value.type }, message: "must be number,null" };
        if (vErrors === null) {
          vErrors = [err8];
        } else {
          vErrors.push(err8);
        }
        errors++;
      }
    }
    if (data.displayValue !== void 0) {
      let data3 = data.displayValue;
      if (typeof data3 === "string") {
        if (func2(data3) > 500) {
          const err9 = { instancePath: instancePath + "/displayValue", schemaPath: "#/$defs/Text/maxLength", keyword: "maxLength", params: { limit: 500 }, message: "must NOT have more than 500 characters" };
          if (vErrors === null) {
            vErrors = [err9];
          } else {
            vErrors.push(err9);
          }
          errors++;
        }
        if (func2(data3) < 1) {
          const err10 = { instancePath: instancePath + "/displayValue", schemaPath: "#/$defs/Text/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
          if (vErrors === null) {
            vErrors = [err10];
          } else {
            vErrors.push(err10);
          }
          errors++;
        }
        if (!pattern5.test(data3)) {
          const err11 = { instancePath: instancePath + "/displayValue", schemaPath: "#/$defs/Text/pattern", keyword: "pattern", params: { pattern: "^[^\\p{Cc}\\p{Cs}]+$" }, message: 'must match pattern "^[^\\p{Cc}\\p{Cs}]+$"' };
          if (vErrors === null) {
            vErrors = [err11];
          } else {
            vErrors.push(err11);
          }
          errors++;
        }
      } else {
        const err12 = { instancePath: instancePath + "/displayValue", schemaPath: "#/$defs/Text/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err12];
        } else {
          vErrors.push(err12);
        }
        errors++;
      }
    }
    if (data.note !== void 0) {
      let data4 = data.note;
      if (typeof data4 === "string") {
        if (func2(data4) > 500) {
          const err13 = { instancePath: instancePath + "/note", schemaPath: "#/$defs/Text/maxLength", keyword: "maxLength", params: { limit: 500 }, message: "must NOT have more than 500 characters" };
          if (vErrors === null) {
            vErrors = [err13];
          } else {
            vErrors.push(err13);
          }
          errors++;
        }
        if (func2(data4) < 1) {
          const err14 = { instancePath: instancePath + "/note", schemaPath: "#/$defs/Text/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
          if (vErrors === null) {
            vErrors = [err14];
          } else {
            vErrors.push(err14);
          }
          errors++;
        }
        if (!pattern5.test(data4)) {
          const err15 = { instancePath: instancePath + "/note", schemaPath: "#/$defs/Text/pattern", keyword: "pattern", params: { pattern: "^[^\\p{Cc}\\p{Cs}]+$" }, message: 'must match pattern "^[^\\p{Cc}\\p{Cs}]+$"' };
          if (vErrors === null) {
            vErrors = [err15];
          } else {
            vErrors.push(err15);
          }
          errors++;
        }
      } else {
        const err16 = { instancePath: instancePath + "/note", schemaPath: "#/$defs/Text/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err16];
        } else {
          vErrors.push(err16);
        }
        errors++;
      }
    }
  } else {
    const err17 = { instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" };
    if (vErrors === null) {
      vErrors = [err17];
    } else {
      vErrors.push(err17);
    }
    errors++;
  }
  validate54.errors = vErrors;
  return errors === 0;
}
validate54.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
var schema136 = { "title": "HeatmapScale", "type": "object", "properties": { "type": { "enum": ["sequential", "diverging", "threshold"] }, "domain": { "type": "array", "items": { "type": "number" }, "minItems": 1, "description": "sequential: [min, max]; diverging: [min, mid, max]; threshold: ascending breakpoints." }, "colors": { "type": "array", "items": { "$ref": "#/$defs/Color" }, "minItems": 2, "description": "sequential: 2+ stops; diverging: 3+; threshold: n + 1." } }, "required": ["type", "domain", "colors"], "additionalProperties": false };
function validate56(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate56.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.type === void 0) {
      const err0 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "type" }, message: "must have required property 'type'" };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.domain === void 0) {
      const err1 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "domain" }, message: "must have required property 'domain'" };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    if (data.colors === void 0) {
      const err2 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "colors" }, message: "must have required property 'colors'" };
      if (vErrors === null) {
        vErrors = [err2];
      } else {
        vErrors.push(err2);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!(key0 === "type" || key0 === "domain" || key0 === "colors")) {
        const err3 = { instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" };
        if (vErrors === null) {
          vErrors = [err3];
        } else {
          vErrors.push(err3);
        }
        errors++;
      }
    }
    if (data.type !== void 0) {
      let data0 = data.type;
      if (!(data0 === "sequential" || data0 === "diverging" || data0 === "threshold")) {
        const err4 = { instancePath: instancePath + "/type", schemaPath: "#/properties/type/enum", keyword: "enum", params: { allowedValues: schema136.properties.type.enum }, message: "must be equal to one of the allowed values" };
        if (vErrors === null) {
          vErrors = [err4];
        } else {
          vErrors.push(err4);
        }
        errors++;
      }
    }
    if (data.domain !== void 0) {
      let data1 = data.domain;
      if (Array.isArray(data1)) {
        if (data1.length < 1) {
          const err5 = { instancePath: instancePath + "/domain", schemaPath: "#/properties/domain/minItems", keyword: "minItems", params: { limit: 1 }, message: "must NOT have fewer than 1 items" };
          if (vErrors === null) {
            vErrors = [err5];
          } else {
            vErrors.push(err5);
          }
          errors++;
        }
        const len0 = data1.length;
        for (let i0 = 0; i0 < len0; i0++) {
          let data2 = data1[i0];
          if (!(typeof data2 == "number" && isFinite(data2))) {
            const err6 = { instancePath: instancePath + "/domain/" + i0, schemaPath: "#/properties/domain/items/type", keyword: "type", params: { type: "number" }, message: "must be number" };
            if (vErrors === null) {
              vErrors = [err6];
            } else {
              vErrors.push(err6);
            }
            errors++;
          }
        }
      } else {
        const err7 = { instancePath: instancePath + "/domain", schemaPath: "#/properties/domain/type", keyword: "type", params: { type: "array" }, message: "must be array" };
        if (vErrors === null) {
          vErrors = [err7];
        } else {
          vErrors.push(err7);
        }
        errors++;
      }
    }
    if (data.colors !== void 0) {
      let data3 = data.colors;
      if (Array.isArray(data3)) {
        if (data3.length < 2) {
          const err8 = { instancePath: instancePath + "/colors", schemaPath: "#/properties/colors/minItems", keyword: "minItems", params: { limit: 2 }, message: "must NOT have fewer than 2 items" };
          if (vErrors === null) {
            vErrors = [err8];
          } else {
            vErrors.push(err8);
          }
          errors++;
        }
        const len1 = data3.length;
        for (let i1 = 0; i1 < len1; i1++) {
          let data4 = data3[i1];
          if (typeof data4 === "string") {
            if (!pattern10.test(data4)) {
              const err9 = { instancePath: instancePath + "/colors/" + i1, schemaPath: "#/$defs/Color/pattern", keyword: "pattern", params: { pattern: "^#[0-9a-fA-F]{6}$" }, message: 'must match pattern "^#[0-9a-fA-F]{6}$"' };
              if (vErrors === null) {
                vErrors = [err9];
              } else {
                vErrors.push(err9);
              }
              errors++;
            }
          } else {
            const err10 = { instancePath: instancePath + "/colors/" + i1, schemaPath: "#/$defs/Color/type", keyword: "type", params: { type: "string" }, message: "must be string" };
            if (vErrors === null) {
              vErrors = [err10];
            } else {
              vErrors.push(err10);
            }
            errors++;
          }
        }
      } else {
        const err11 = { instancePath: instancePath + "/colors", schemaPath: "#/properties/colors/type", keyword: "type", params: { type: "array" }, message: "must be array" };
        if (vErrors === null) {
          vErrors = [err11];
        } else {
          vErrors.push(err11);
        }
        errors++;
      }
    }
  } else {
    const err12 = { instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" };
    if (vErrors === null) {
      vErrors = [err12];
    } else {
      vErrors.push(err12);
    }
    errors++;
  }
  validate56.errors = vErrors;
  return errors === 0;
}
validate56.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
function validate49(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate49.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.schemaVersion === void 0) {
      const err0 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "schemaVersion" }, message: "must have required property 'schemaVersion'" };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.id === void 0) {
      const err1 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "id" }, message: "must have required property 'id'" };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    if (data.kind === void 0) {
      const err2 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "kind" }, message: "must have required property 'kind'" };
      if (vErrors === null) {
        vErrors = [err2];
      } else {
        vErrors.push(err2);
      }
      errors++;
    }
    if (data.title === void 0) {
      const err3 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "title" }, message: "must have required property 'title'" };
      if (vErrors === null) {
        vErrors = [err3];
      } else {
        vErrors.push(err3);
      }
      errors++;
    }
    if (data.rows === void 0) {
      const err4 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "rows" }, message: "must have required property 'rows'" };
      if (vErrors === null) {
        vErrors = [err4];
      } else {
        vErrors.push(err4);
      }
      errors++;
    }
    if (data.columns === void 0) {
      const err5 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "columns" }, message: "must have required property 'columns'" };
      if (vErrors === null) {
        vErrors = [err5];
      } else {
        vErrors.push(err5);
      }
      errors++;
    }
    if (data.cells === void 0) {
      const err6 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "cells" }, message: "must have required property 'cells'" };
      if (vErrors === null) {
        vErrors = [err6];
      } else {
        vErrors.push(err6);
      }
      errors++;
    }
    if (data.scale === void 0) {
      const err7 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "scale" }, message: "must have required property 'scale'" };
      if (vErrors === null) {
        vErrors = [err7];
      } else {
        vErrors.push(err7);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!func1.call(schema121.properties, key0)) {
        const err8 = { instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" };
        if (vErrors === null) {
          vErrors = [err8];
        } else {
          vErrors.push(err8);
        }
        errors++;
      }
    }
    if (data.schemaVersion !== void 0) {
      let data0 = data.schemaVersion;
      if (!(typeof data0 == "number" && (!(data0 % 1) && !isNaN(data0)) && isFinite(data0))) {
        const err9 = { instancePath: instancePath + "/schemaVersion", schemaPath: "#/$defs/SpecBase/properties/schemaVersion/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
        if (vErrors === null) {
          vErrors = [err9];
        } else {
          vErrors.push(err9);
        }
        errors++;
      }
      if (1 !== data0) {
        const err10 = { instancePath: instancePath + "/schemaVersion", schemaPath: "#/$defs/SpecBase/properties/schemaVersion/const", keyword: "const", params: { allowedValue: 1 }, message: "must be equal to constant" };
        if (vErrors === null) {
          vErrors = [err10];
        } else {
          vErrors.push(err10);
        }
        errors++;
      }
    }
    if (data.id !== void 0) {
      let data1 = data.id;
      if (typeof data1 === "string") {
        if (!pattern4.test(data1)) {
          const err11 = { instancePath: instancePath + "/id", schemaPath: "#/$defs/SpecBase/properties/id/pattern", keyword: "pattern", params: { pattern: "^[A-Za-z][A-Za-z0-9_-]{0,63}$" }, message: 'must match pattern "^[A-Za-z][A-Za-z0-9_-]{0,63}$"' };
          if (vErrors === null) {
            vErrors = [err11];
          } else {
            vErrors.push(err11);
          }
          errors++;
        }
      } else {
        const err12 = { instancePath: instancePath + "/id", schemaPath: "#/$defs/SpecBase/properties/id/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err12];
        } else {
          vErrors.push(err12);
        }
        errors++;
      }
    }
    if (data.kind !== void 0) {
      if ("heatmap" !== data.kind) {
        const err13 = { instancePath: instancePath + "/kind", schemaPath: "#/properties/kind/const", keyword: "const", params: { allowedValue: "heatmap" }, message: "must be equal to constant" };
        if (vErrors === null) {
          vErrors = [err13];
        } else {
          vErrors.push(err13);
        }
        errors++;
      }
    }
    if (data.title !== void 0) {
      let data3 = data.title;
      if (typeof data3 === "string") {
        if (func2(data3) > 200) {
          const err14 = { instancePath: instancePath + "/title", schemaPath: "#/$defs/SpecBase/properties/title/maxLength", keyword: "maxLength", params: { limit: 200 }, message: "must NOT have more than 200 characters" };
          if (vErrors === null) {
            vErrors = [err14];
          } else {
            vErrors.push(err14);
          }
          errors++;
        }
        if (func2(data3) < 1) {
          const err15 = { instancePath: instancePath + "/title", schemaPath: "#/$defs/SpecBase/properties/title/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
          if (vErrors === null) {
            vErrors = [err15];
          } else {
            vErrors.push(err15);
          }
          errors++;
        }
        if (!pattern5.test(data3)) {
          const err16 = { instancePath: instancePath + "/title", schemaPath: "#/$defs/SpecBase/properties/title/pattern", keyword: "pattern", params: { pattern: "^[^\\p{Cc}\\p{Cs}]+$" }, message: 'must match pattern "^[^\\p{Cc}\\p{Cs}]+$"' };
          if (vErrors === null) {
            vErrors = [err16];
          } else {
            vErrors.push(err16);
          }
          errors++;
        }
      } else {
        const err17 = { instancePath: instancePath + "/title", schemaPath: "#/$defs/SpecBase/properties/title/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err17];
        } else {
          vErrors.push(err17);
        }
        errors++;
      }
    }
    if (data.description !== void 0) {
      let data4 = data.description;
      if (typeof data4 === "string") {
        if (func2(data4) > 2e3) {
          const err18 = { instancePath: instancePath + "/description", schemaPath: "#/$defs/SpecBase/properties/description/maxLength", keyword: "maxLength", params: { limit: 2e3 }, message: "must NOT have more than 2000 characters" };
          if (vErrors === null) {
            vErrors = [err18];
          } else {
            vErrors.push(err18);
          }
          errors++;
        }
        if (!pattern6.test(data4)) {
          const err19 = { instancePath: instancePath + "/description", schemaPath: "#/$defs/SpecBase/properties/description/pattern", keyword: "pattern", params: { pattern: "^(?:[^\\p{Cc}\\p{Cs}]|\\n)*$" }, message: 'must match pattern "^(?:[^\\p{Cc}\\p{Cs}]|\\n)*$"' };
          if (vErrors === null) {
            vErrors = [err19];
          } else {
            vErrors.push(err19);
          }
          errors++;
        }
      } else {
        const err20 = { instancePath: instancePath + "/description", schemaPath: "#/$defs/SpecBase/properties/description/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err20];
        } else {
          vErrors.push(err20);
        }
        errors++;
      }
    }
    if (data.caption !== void 0) {
      let data5 = data.caption;
      if (typeof data5 === "string") {
        if (func2(data5) > 500) {
          const err21 = { instancePath: instancePath + "/caption", schemaPath: "#/$defs/SpecBase/properties/caption/maxLength", keyword: "maxLength", params: { limit: 500 }, message: "must NOT have more than 500 characters" };
          if (vErrors === null) {
            vErrors = [err21];
          } else {
            vErrors.push(err21);
          }
          errors++;
        }
        if (func2(data5) < 1) {
          const err22 = { instancePath: instancePath + "/caption", schemaPath: "#/$defs/SpecBase/properties/caption/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
          if (vErrors === null) {
            vErrors = [err22];
          } else {
            vErrors.push(err22);
          }
          errors++;
        }
        if (!pattern7.test(data5)) {
          const err23 = { instancePath: instancePath + "/caption", schemaPath: "#/$defs/SpecBase/properties/caption/pattern", keyword: "pattern", params: { pattern: "^(?:[^\\p{Cc}\\p{Cs}]|\\n)+$" }, message: 'must match pattern "^(?:[^\\p{Cc}\\p{Cs}]|\\n)+$"' };
          if (vErrors === null) {
            vErrors = [err23];
          } else {
            vErrors.push(err23);
          }
          errors++;
        }
      } else {
        const err24 = { instancePath: instancePath + "/caption", schemaPath: "#/$defs/SpecBase/properties/caption/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err24];
        } else {
          vErrors.push(err24);
        }
        errors++;
      }
    }
    if (data.roles !== void 0) {
      if (!validate22(data.roles, { instancePath: instancePath + "/roles", parentData: data, parentDataProperty: "roles", rootData, dynamicAnchors })) {
        vErrors = vErrors === null ? validate22.errors : vErrors.concat(validate22.errors);
        errors = vErrors.length;
      }
    }
    if (data.legend !== void 0) {
      let data7 = data.legend;
      if (data7 && typeof data7 == "object" && !Array.isArray(data7)) {
        for (const key1 in data7) {
          if (!(key1 === "show" || key1 === "position")) {
            const err25 = { instancePath: instancePath + "/legend", schemaPath: "#/$defs/SpecBase/properties/legend/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key1 }, message: "must NOT have additional properties" };
            if (vErrors === null) {
              vErrors = [err25];
            } else {
              vErrors.push(err25);
            }
            errors++;
          }
        }
        if (data7.show !== void 0) {
          let data8 = data7.show;
          if (!(data8 === "auto" || data8 === "always" || data8 === "never")) {
            const err26 = { instancePath: instancePath + "/legend/show", schemaPath: "#/$defs/SpecBase/properties/legend/properties/show/enum", keyword: "enum", params: { allowedValues: schema44.properties.show.enum }, message: "must be equal to one of the allowed values" };
            if (vErrors === null) {
              vErrors = [err26];
            } else {
              vErrors.push(err26);
            }
            errors++;
          }
        }
        if (data7.position !== void 0) {
          let data9 = data7.position;
          if (!(data9 === "top" || data9 === "bottom")) {
            const err27 = { instancePath: instancePath + "/legend/position", schemaPath: "#/$defs/SpecBase/properties/legend/properties/position/enum", keyword: "enum", params: { allowedValues: schema44.properties.position.enum }, message: "must be equal to one of the allowed values" };
            if (vErrors === null) {
              vErrors = [err27];
            } else {
              vErrors.push(err27);
            }
            errors++;
          }
        }
      } else {
        const err28 = { instancePath: instancePath + "/legend", schemaPath: "#/$defs/SpecBase/properties/legend/type", keyword: "type", params: { type: "object" }, message: "must be object" };
        if (vErrors === null) {
          vErrors = [err28];
        } else {
          vErrors.push(err28);
        }
        errors++;
      }
    }
    if (data.rows !== void 0) {
      let data10 = data.rows;
      if (Array.isArray(data10)) {
        if (data10.length > 100) {
          const err29 = { instancePath: instancePath + "/rows", schemaPath: "#/properties/rows/maxItems", keyword: "maxItems", params: { limit: 100 }, message: "must NOT have more than 100 items" };
          if (vErrors === null) {
            vErrors = [err29];
          } else {
            vErrors.push(err29);
          }
          errors++;
        }
        if (data10.length < 1) {
          const err30 = { instancePath: instancePath + "/rows", schemaPath: "#/properties/rows/minItems", keyword: "minItems", params: { limit: 1 }, message: "must NOT have fewer than 1 items" };
          if (vErrors === null) {
            vErrors = [err30];
          } else {
            vErrors.push(err30);
          }
          errors++;
        }
        const len0 = data10.length;
        for (let i0 = 0; i0 < len0; i0++) {
          if (!validate51(data10[i0], { instancePath: instancePath + "/rows/" + i0, parentData: data10, parentDataProperty: i0, rootData, dynamicAnchors })) {
            vErrors = vErrors === null ? validate51.errors : vErrors.concat(validate51.errors);
            errors = vErrors.length;
          }
        }
      } else {
        const err31 = { instancePath: instancePath + "/rows", schemaPath: "#/properties/rows/type", keyword: "type", params: { type: "array" }, message: "must be array" };
        if (vErrors === null) {
          vErrors = [err31];
        } else {
          vErrors.push(err31);
        }
        errors++;
      }
    }
    if (data.columns !== void 0) {
      let data12 = data.columns;
      if (Array.isArray(data12)) {
        if (data12.length > 100) {
          const err32 = { instancePath: instancePath + "/columns", schemaPath: "#/properties/columns/maxItems", keyword: "maxItems", params: { limit: 100 }, message: "must NOT have more than 100 items" };
          if (vErrors === null) {
            vErrors = [err32];
          } else {
            vErrors.push(err32);
          }
          errors++;
        }
        if (data12.length < 1) {
          const err33 = { instancePath: instancePath + "/columns", schemaPath: "#/properties/columns/minItems", keyword: "minItems", params: { limit: 1 }, message: "must NOT have fewer than 1 items" };
          if (vErrors === null) {
            vErrors = [err33];
          } else {
            vErrors.push(err33);
          }
          errors++;
        }
        const len1 = data12.length;
        for (let i1 = 0; i1 < len1; i1++) {
          if (!validate51(data12[i1], { instancePath: instancePath + "/columns/" + i1, parentData: data12, parentDataProperty: i1, rootData, dynamicAnchors })) {
            vErrors = vErrors === null ? validate51.errors : vErrors.concat(validate51.errors);
            errors = vErrors.length;
          }
        }
      } else {
        const err34 = { instancePath: instancePath + "/columns", schemaPath: "#/properties/columns/type", keyword: "type", params: { type: "array" }, message: "must be array" };
        if (vErrors === null) {
          vErrors = [err34];
        } else {
          vErrors.push(err34);
        }
        errors++;
      }
    }
    if (data.cells !== void 0) {
      let data14 = data.cells;
      if (Array.isArray(data14)) {
        const len2 = data14.length;
        for (let i2 = 0; i2 < len2; i2++) {
          if (!validate54(data14[i2], { instancePath: instancePath + "/cells/" + i2, parentData: data14, parentDataProperty: i2, rootData, dynamicAnchors })) {
            vErrors = vErrors === null ? validate54.errors : vErrors.concat(validate54.errors);
            errors = vErrors.length;
          }
        }
      } else {
        const err35 = { instancePath: instancePath + "/cells", schemaPath: "#/properties/cells/type", keyword: "type", params: { type: "array" }, message: "must be array" };
        if (vErrors === null) {
          vErrors = [err35];
        } else {
          vErrors.push(err35);
        }
        errors++;
      }
    }
    if (data.scale !== void 0) {
      if (!validate56(data.scale, { instancePath: instancePath + "/scale", parentData: data, parentDataProperty: "scale", rootData, dynamicAnchors })) {
        vErrors = vErrors === null ? validate56.errors : vErrors.concat(validate56.errors);
        errors = vErrors.length;
      }
    }
    if (data.unit !== void 0) {
      let data17 = data.unit;
      if (typeof data17 === "string") {
        if (func2(data17) > 500) {
          const err36 = { instancePath: instancePath + "/unit", schemaPath: "#/$defs/Text/maxLength", keyword: "maxLength", params: { limit: 500 }, message: "must NOT have more than 500 characters" };
          if (vErrors === null) {
            vErrors = [err36];
          } else {
            vErrors.push(err36);
          }
          errors++;
        }
        if (func2(data17) < 1) {
          const err37 = { instancePath: instancePath + "/unit", schemaPath: "#/$defs/Text/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
          if (vErrors === null) {
            vErrors = [err37];
          } else {
            vErrors.push(err37);
          }
          errors++;
        }
        if (!pattern5.test(data17)) {
          const err38 = { instancePath: instancePath + "/unit", schemaPath: "#/$defs/Text/pattern", keyword: "pattern", params: { pattern: "^[^\\p{Cc}\\p{Cs}]+$" }, message: 'must match pattern "^[^\\p{Cc}\\p{Cs}]+$"' };
          if (vErrors === null) {
            vErrors = [err38];
          } else {
            vErrors.push(err38);
          }
          errors++;
        }
      } else {
        const err39 = { instancePath: instancePath + "/unit", schemaPath: "#/$defs/Text/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err39];
        } else {
          vErrors.push(err39);
        }
        errors++;
      }
    }
    if (data.format !== void 0) {
      let data18 = data.format;
      if (data18 && typeof data18 == "object" && !Array.isArray(data18)) {
        for (const key2 in data18) {
          if (!(key2 === "style" || key2 === "currency" || key2 === "minimumFractionDigits" || key2 === "maximumFractionDigits" || key2 === "signDisplay")) {
            const err40 = { instancePath: instancePath + "/format", schemaPath: "#/$defs/NumberFormat/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key2 }, message: "must NOT have additional properties" };
            if (vErrors === null) {
              vErrors = [err40];
            } else {
              vErrors.push(err40);
            }
            errors++;
          }
        }
        if (data18.style !== void 0) {
          let data19 = data18.style;
          if (!(data19 === "decimal" || data19 === "percent" || data19 === "currency" || data19 === "compact")) {
            const err41 = { instancePath: instancePath + "/format/style", schemaPath: "#/$defs/NumberFormat/properties/style/enum", keyword: "enum", params: { allowedValues: schema54.properties.style.enum }, message: "must be equal to one of the allowed values" };
            if (vErrors === null) {
              vErrors = [err41];
            } else {
              vErrors.push(err41);
            }
            errors++;
          }
        }
        if (data18.currency !== void 0) {
          let data20 = data18.currency;
          if (typeof data20 === "string") {
            if (!pattern18.test(data20)) {
              const err42 = { instancePath: instancePath + "/format/currency", schemaPath: "#/$defs/NumberFormat/properties/currency/pattern", keyword: "pattern", params: { pattern: "^[A-Z]{3}$" }, message: 'must match pattern "^[A-Z]{3}$"' };
              if (vErrors === null) {
                vErrors = [err42];
              } else {
                vErrors.push(err42);
              }
              errors++;
            }
          } else {
            const err43 = { instancePath: instancePath + "/format/currency", schemaPath: "#/$defs/NumberFormat/properties/currency/type", keyword: "type", params: { type: "string" }, message: "must be string" };
            if (vErrors === null) {
              vErrors = [err43];
            } else {
              vErrors.push(err43);
            }
            errors++;
          }
        }
        if (data18.minimumFractionDigits !== void 0) {
          let data21 = data18.minimumFractionDigits;
          if (!(typeof data21 == "number" && (!(data21 % 1) && !isNaN(data21)) && isFinite(data21))) {
            const err44 = { instancePath: instancePath + "/format/minimumFractionDigits", schemaPath: "#/$defs/NumberFormat/properties/minimumFractionDigits/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
            if (vErrors === null) {
              vErrors = [err44];
            } else {
              vErrors.push(err44);
            }
            errors++;
          }
          if (typeof data21 == "number" && isFinite(data21)) {
            if (data21 > 6 || isNaN(data21)) {
              const err45 = { instancePath: instancePath + "/format/minimumFractionDigits", schemaPath: "#/$defs/NumberFormat/properties/minimumFractionDigits/maximum", keyword: "maximum", params: { comparison: "<=", limit: 6 }, message: "must be <= 6" };
              if (vErrors === null) {
                vErrors = [err45];
              } else {
                vErrors.push(err45);
              }
              errors++;
            }
            if (data21 < 0 || isNaN(data21)) {
              const err46 = { instancePath: instancePath + "/format/minimumFractionDigits", schemaPath: "#/$defs/NumberFormat/properties/minimumFractionDigits/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" };
              if (vErrors === null) {
                vErrors = [err46];
              } else {
                vErrors.push(err46);
              }
              errors++;
            }
          }
        }
        if (data18.maximumFractionDigits !== void 0) {
          let data22 = data18.maximumFractionDigits;
          if (!(typeof data22 == "number" && (!(data22 % 1) && !isNaN(data22)) && isFinite(data22))) {
            const err47 = { instancePath: instancePath + "/format/maximumFractionDigits", schemaPath: "#/$defs/NumberFormat/properties/maximumFractionDigits/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
            if (vErrors === null) {
              vErrors = [err47];
            } else {
              vErrors.push(err47);
            }
            errors++;
          }
          if (typeof data22 == "number" && isFinite(data22)) {
            if (data22 > 6 || isNaN(data22)) {
              const err48 = { instancePath: instancePath + "/format/maximumFractionDigits", schemaPath: "#/$defs/NumberFormat/properties/maximumFractionDigits/maximum", keyword: "maximum", params: { comparison: "<=", limit: 6 }, message: "must be <= 6" };
              if (vErrors === null) {
                vErrors = [err48];
              } else {
                vErrors.push(err48);
              }
              errors++;
            }
            if (data22 < 0 || isNaN(data22)) {
              const err49 = { instancePath: instancePath + "/format/maximumFractionDigits", schemaPath: "#/$defs/NumberFormat/properties/maximumFractionDigits/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" };
              if (vErrors === null) {
                vErrors = [err49];
              } else {
                vErrors.push(err49);
              }
              errors++;
            }
          }
        }
        if (data18.signDisplay !== void 0) {
          let data23 = data18.signDisplay;
          if (!(data23 === "auto" || data23 === "always" || data23 === "exceptZero")) {
            const err50 = { instancePath: instancePath + "/format/signDisplay", schemaPath: "#/$defs/NumberFormat/properties/signDisplay/enum", keyword: "enum", params: { allowedValues: schema54.properties.signDisplay.enum }, message: "must be equal to one of the allowed values" };
            if (vErrors === null) {
              vErrors = [err50];
            } else {
              vErrors.push(err50);
            }
            errors++;
          }
        }
      } else {
        const err51 = { instancePath: instancePath + "/format", schemaPath: "#/$defs/NumberFormat/type", keyword: "type", params: { type: "object" }, message: "must be object" };
        if (vErrors === null) {
          vErrors = [err51];
        } else {
          vErrors.push(err51);
        }
        errors++;
      }
    }
    if (data.cellLabels !== void 0) {
      let data24 = data.cellLabels;
      if (!(data24 === "all" || data24 === "none")) {
        const err52 = { instancePath: instancePath + "/cellLabels", schemaPath: "#/properties/cellLabels/enum", keyword: "enum", params: { allowedValues: schema121.properties.cellLabels.enum }, message: "must be equal to one of the allowed values" };
        if (vErrors === null) {
          vErrors = [err52];
        } else {
          vErrors.push(err52);
        }
        errors++;
      }
    }
    if (data.rowAxisLabel !== void 0) {
      let data25 = data.rowAxisLabel;
      if (typeof data25 === "string") {
        if (func2(data25) > 500) {
          const err53 = { instancePath: instancePath + "/rowAxisLabel", schemaPath: "#/$defs/Text/maxLength", keyword: "maxLength", params: { limit: 500 }, message: "must NOT have more than 500 characters" };
          if (vErrors === null) {
            vErrors = [err53];
          } else {
            vErrors.push(err53);
          }
          errors++;
        }
        if (func2(data25) < 1) {
          const err54 = { instancePath: instancePath + "/rowAxisLabel", schemaPath: "#/$defs/Text/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
          if (vErrors === null) {
            vErrors = [err54];
          } else {
            vErrors.push(err54);
          }
          errors++;
        }
        if (!pattern5.test(data25)) {
          const err55 = { instancePath: instancePath + "/rowAxisLabel", schemaPath: "#/$defs/Text/pattern", keyword: "pattern", params: { pattern: "^[^\\p{Cc}\\p{Cs}]+$" }, message: 'must match pattern "^[^\\p{Cc}\\p{Cs}]+$"' };
          if (vErrors === null) {
            vErrors = [err55];
          } else {
            vErrors.push(err55);
          }
          errors++;
        }
      } else {
        const err56 = { instancePath: instancePath + "/rowAxisLabel", schemaPath: "#/$defs/Text/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err56];
        } else {
          vErrors.push(err56);
        }
        errors++;
      }
    }
    if (data.columnAxisLabel !== void 0) {
      let data26 = data.columnAxisLabel;
      if (typeof data26 === "string") {
        if (func2(data26) > 500) {
          const err57 = { instancePath: instancePath + "/columnAxisLabel", schemaPath: "#/$defs/Text/maxLength", keyword: "maxLength", params: { limit: 500 }, message: "must NOT have more than 500 characters" };
          if (vErrors === null) {
            vErrors = [err57];
          } else {
            vErrors.push(err57);
          }
          errors++;
        }
        if (func2(data26) < 1) {
          const err58 = { instancePath: instancePath + "/columnAxisLabel", schemaPath: "#/$defs/Text/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
          if (vErrors === null) {
            vErrors = [err58];
          } else {
            vErrors.push(err58);
          }
          errors++;
        }
        if (!pattern5.test(data26)) {
          const err59 = { instancePath: instancePath + "/columnAxisLabel", schemaPath: "#/$defs/Text/pattern", keyword: "pattern", params: { pattern: "^[^\\p{Cc}\\p{Cs}]+$" }, message: 'must match pattern "^[^\\p{Cc}\\p{Cs}]+$"' };
          if (vErrors === null) {
            vErrors = [err59];
          } else {
            vErrors.push(err59);
          }
          errors++;
        }
      } else {
        const err60 = { instancePath: instancePath + "/columnAxisLabel", schemaPath: "#/$defs/Text/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err60];
        } else {
          vErrors.push(err60);
        }
        errors++;
      }
    }
  } else {
    const err61 = { instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" };
    if (vErrors === null) {
      vErrors = [err61];
    } else {
      vErrors.push(err61);
    }
    errors++;
  }
  validate49.errors = vErrors;
  return errors === 0;
}
validate49.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
var schema142 = { "title": "ProgressSpec", "description": "Progress bars or rings.", "extends": [{ "$ref": "#/$defs/SpecBase" }], "type": "object", "properties": { "schemaVersion": { "$ref": "#/$defs/SpecBase/properties/schemaVersion" }, "id": { "$ref": "#/$defs/SpecBase/properties/id" }, "kind": { "const": "progress" }, "title": { "$ref": "#/$defs/SpecBase/properties/title" }, "description": { "$ref": "#/$defs/SpecBase/properties/description" }, "caption": { "$ref": "#/$defs/SpecBase/properties/caption" }, "roles": { "$ref": "#/$defs/SpecBase/properties/roles" }, "legend": { "$ref": "#/$defs/SpecBase/properties/legend" }, "variant": { "enum": ["bar", "ring"] }, "domain": { "type": "object", "properties": { "min": { "type": "number" }, "max": { "type": "number" } }, "required": ["min", "max"], "additionalProperties": false }, "overflow": { "enum": ["error", "clip-indicated"] }, "unit": { "$ref": "#/$defs/Text" }, "format": { "$ref": "#/$defs/NumberFormat" }, "items": { "type": "array", "items": { "$ref": "#/$defs/ProgressItem" }, "minItems": 1, "maxItems": 20 } }, "required": ["schemaVersion", "id", "kind", "title", "variant", "domain", "items"], "additionalProperties": false };
var schema151 = { "title": "ProgressItem", "type": "object", "properties": { "id": { "$ref": "#/$defs/Id" }, "label": { "$ref": "#/$defs/Text" }, "value": { "type": ["number", "null"] }, "displayValue": { "$ref": "#/$defs/Text" }, "target": { "type": ["number", "null"] }, "targetLabel": { "$ref": "#/$defs/Text" }, "role": { "$ref": "#/$defs/Id" }, "color": { "$ref": "#/$defs/Color" } }, "required": ["id", "label", "value"], "additionalProperties": false };
function validate60(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate60.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.id === void 0) {
      const err0 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "id" }, message: "must have required property 'id'" };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.label === void 0) {
      const err1 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "label" }, message: "must have required property 'label'" };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    if (data.value === void 0) {
      const err2 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "value" }, message: "must have required property 'value'" };
      if (vErrors === null) {
        vErrors = [err2];
      } else {
        vErrors.push(err2);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!(key0 === "id" || key0 === "label" || key0 === "value" || key0 === "displayValue" || key0 === "target" || key0 === "targetLabel" || key0 === "role" || key0 === "color")) {
        const err3 = { instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" };
        if (vErrors === null) {
          vErrors = [err3];
        } else {
          vErrors.push(err3);
        }
        errors++;
      }
    }
    if (data.id !== void 0) {
      let data0 = data.id;
      if (typeof data0 === "string") {
        if (!pattern4.test(data0)) {
          const err4 = { instancePath: instancePath + "/id", schemaPath: "#/$defs/Id/pattern", keyword: "pattern", params: { pattern: "^[A-Za-z][A-Za-z0-9_-]{0,63}$" }, message: 'must match pattern "^[A-Za-z][A-Za-z0-9_-]{0,63}$"' };
          if (vErrors === null) {
            vErrors = [err4];
          } else {
            vErrors.push(err4);
          }
          errors++;
        }
      } else {
        const err5 = { instancePath: instancePath + "/id", schemaPath: "#/$defs/Id/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err5];
        } else {
          vErrors.push(err5);
        }
        errors++;
      }
    }
    if (data.label !== void 0) {
      let data1 = data.label;
      if (typeof data1 === "string") {
        if (func2(data1) > 500) {
          const err6 = { instancePath: instancePath + "/label", schemaPath: "#/$defs/Text/maxLength", keyword: "maxLength", params: { limit: 500 }, message: "must NOT have more than 500 characters" };
          if (vErrors === null) {
            vErrors = [err6];
          } else {
            vErrors.push(err6);
          }
          errors++;
        }
        if (func2(data1) < 1) {
          const err7 = { instancePath: instancePath + "/label", schemaPath: "#/$defs/Text/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
          if (vErrors === null) {
            vErrors = [err7];
          } else {
            vErrors.push(err7);
          }
          errors++;
        }
        if (!pattern5.test(data1)) {
          const err8 = { instancePath: instancePath + "/label", schemaPath: "#/$defs/Text/pattern", keyword: "pattern", params: { pattern: "^[^\\p{Cc}\\p{Cs}]+$" }, message: 'must match pattern "^[^\\p{Cc}\\p{Cs}]+$"' };
          if (vErrors === null) {
            vErrors = [err8];
          } else {
            vErrors.push(err8);
          }
          errors++;
        }
      } else {
        const err9 = { instancePath: instancePath + "/label", schemaPath: "#/$defs/Text/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err9];
        } else {
          vErrors.push(err9);
        }
        errors++;
      }
    }
    if (data.value !== void 0) {
      let data2 = data.value;
      if (!(typeof data2 == "number" && isFinite(data2)) && data2 !== null) {
        const err10 = { instancePath: instancePath + "/value", schemaPath: "#/properties/value/type", keyword: "type", params: { type: schema151.properties.value.type }, message: "must be number,null" };
        if (vErrors === null) {
          vErrors = [err10];
        } else {
          vErrors.push(err10);
        }
        errors++;
      }
    }
    if (data.displayValue !== void 0) {
      let data3 = data.displayValue;
      if (typeof data3 === "string") {
        if (func2(data3) > 500) {
          const err11 = { instancePath: instancePath + "/displayValue", schemaPath: "#/$defs/Text/maxLength", keyword: "maxLength", params: { limit: 500 }, message: "must NOT have more than 500 characters" };
          if (vErrors === null) {
            vErrors = [err11];
          } else {
            vErrors.push(err11);
          }
          errors++;
        }
        if (func2(data3) < 1) {
          const err12 = { instancePath: instancePath + "/displayValue", schemaPath: "#/$defs/Text/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
          if (vErrors === null) {
            vErrors = [err12];
          } else {
            vErrors.push(err12);
          }
          errors++;
        }
        if (!pattern5.test(data3)) {
          const err13 = { instancePath: instancePath + "/displayValue", schemaPath: "#/$defs/Text/pattern", keyword: "pattern", params: { pattern: "^[^\\p{Cc}\\p{Cs}]+$" }, message: 'must match pattern "^[^\\p{Cc}\\p{Cs}]+$"' };
          if (vErrors === null) {
            vErrors = [err13];
          } else {
            vErrors.push(err13);
          }
          errors++;
        }
      } else {
        const err14 = { instancePath: instancePath + "/displayValue", schemaPath: "#/$defs/Text/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err14];
        } else {
          vErrors.push(err14);
        }
        errors++;
      }
    }
    if (data.target !== void 0) {
      let data4 = data.target;
      if (!(typeof data4 == "number" && isFinite(data4)) && data4 !== null) {
        const err15 = { instancePath: instancePath + "/target", schemaPath: "#/properties/target/type", keyword: "type", params: { type: schema151.properties.target.type }, message: "must be number,null" };
        if (vErrors === null) {
          vErrors = [err15];
        } else {
          vErrors.push(err15);
        }
        errors++;
      }
    }
    if (data.targetLabel !== void 0) {
      let data5 = data.targetLabel;
      if (typeof data5 === "string") {
        if (func2(data5) > 500) {
          const err16 = { instancePath: instancePath + "/targetLabel", schemaPath: "#/$defs/Text/maxLength", keyword: "maxLength", params: { limit: 500 }, message: "must NOT have more than 500 characters" };
          if (vErrors === null) {
            vErrors = [err16];
          } else {
            vErrors.push(err16);
          }
          errors++;
        }
        if (func2(data5) < 1) {
          const err17 = { instancePath: instancePath + "/targetLabel", schemaPath: "#/$defs/Text/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
          if (vErrors === null) {
            vErrors = [err17];
          } else {
            vErrors.push(err17);
          }
          errors++;
        }
        if (!pattern5.test(data5)) {
          const err18 = { instancePath: instancePath + "/targetLabel", schemaPath: "#/$defs/Text/pattern", keyword: "pattern", params: { pattern: "^[^\\p{Cc}\\p{Cs}]+$" }, message: 'must match pattern "^[^\\p{Cc}\\p{Cs}]+$"' };
          if (vErrors === null) {
            vErrors = [err18];
          } else {
            vErrors.push(err18);
          }
          errors++;
        }
      } else {
        const err19 = { instancePath: instancePath + "/targetLabel", schemaPath: "#/$defs/Text/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err19];
        } else {
          vErrors.push(err19);
        }
        errors++;
      }
    }
    if (data.role !== void 0) {
      let data6 = data.role;
      if (typeof data6 === "string") {
        if (!pattern4.test(data6)) {
          const err20 = { instancePath: instancePath + "/role", schemaPath: "#/$defs/Id/pattern", keyword: "pattern", params: { pattern: "^[A-Za-z][A-Za-z0-9_-]{0,63}$" }, message: 'must match pattern "^[A-Za-z][A-Za-z0-9_-]{0,63}$"' };
          if (vErrors === null) {
            vErrors = [err20];
          } else {
            vErrors.push(err20);
          }
          errors++;
        }
      } else {
        const err21 = { instancePath: instancePath + "/role", schemaPath: "#/$defs/Id/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err21];
        } else {
          vErrors.push(err21);
        }
        errors++;
      }
    }
    if (data.color !== void 0) {
      let data7 = data.color;
      if (typeof data7 === "string") {
        if (!pattern10.test(data7)) {
          const err22 = { instancePath: instancePath + "/color", schemaPath: "#/$defs/Color/pattern", keyword: "pattern", params: { pattern: "^#[0-9a-fA-F]{6}$" }, message: 'must match pattern "^#[0-9a-fA-F]{6}$"' };
          if (vErrors === null) {
            vErrors = [err22];
          } else {
            vErrors.push(err22);
          }
          errors++;
        }
      } else {
        const err23 = { instancePath: instancePath + "/color", schemaPath: "#/$defs/Color/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err23];
        } else {
          vErrors.push(err23);
        }
        errors++;
      }
    }
  } else {
    const err24 = { instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" };
    if (vErrors === null) {
      vErrors = [err24];
    } else {
      vErrors.push(err24);
    }
    errors++;
  }
  validate60.errors = vErrors;
  return errors === 0;
}
validate60.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
function validate58(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate58.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.schemaVersion === void 0) {
      const err0 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "schemaVersion" }, message: "must have required property 'schemaVersion'" };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.id === void 0) {
      const err1 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "id" }, message: "must have required property 'id'" };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    if (data.kind === void 0) {
      const err2 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "kind" }, message: "must have required property 'kind'" };
      if (vErrors === null) {
        vErrors = [err2];
      } else {
        vErrors.push(err2);
      }
      errors++;
    }
    if (data.title === void 0) {
      const err3 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "title" }, message: "must have required property 'title'" };
      if (vErrors === null) {
        vErrors = [err3];
      } else {
        vErrors.push(err3);
      }
      errors++;
    }
    if (data.variant === void 0) {
      const err4 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "variant" }, message: "must have required property 'variant'" };
      if (vErrors === null) {
        vErrors = [err4];
      } else {
        vErrors.push(err4);
      }
      errors++;
    }
    if (data.domain === void 0) {
      const err5 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "domain" }, message: "must have required property 'domain'" };
      if (vErrors === null) {
        vErrors = [err5];
      } else {
        vErrors.push(err5);
      }
      errors++;
    }
    if (data.items === void 0) {
      const err6 = { instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: "items" }, message: "must have required property 'items'" };
      if (vErrors === null) {
        vErrors = [err6];
      } else {
        vErrors.push(err6);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!func1.call(schema142.properties, key0)) {
        const err7 = { instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" };
        if (vErrors === null) {
          vErrors = [err7];
        } else {
          vErrors.push(err7);
        }
        errors++;
      }
    }
    if (data.schemaVersion !== void 0) {
      let data0 = data.schemaVersion;
      if (!(typeof data0 == "number" && (!(data0 % 1) && !isNaN(data0)) && isFinite(data0))) {
        const err8 = { instancePath: instancePath + "/schemaVersion", schemaPath: "#/$defs/SpecBase/properties/schemaVersion/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
        if (vErrors === null) {
          vErrors = [err8];
        } else {
          vErrors.push(err8);
        }
        errors++;
      }
      if (1 !== data0) {
        const err9 = { instancePath: instancePath + "/schemaVersion", schemaPath: "#/$defs/SpecBase/properties/schemaVersion/const", keyword: "const", params: { allowedValue: 1 }, message: "must be equal to constant" };
        if (vErrors === null) {
          vErrors = [err9];
        } else {
          vErrors.push(err9);
        }
        errors++;
      }
    }
    if (data.id !== void 0) {
      let data1 = data.id;
      if (typeof data1 === "string") {
        if (!pattern4.test(data1)) {
          const err10 = { instancePath: instancePath + "/id", schemaPath: "#/$defs/SpecBase/properties/id/pattern", keyword: "pattern", params: { pattern: "^[A-Za-z][A-Za-z0-9_-]{0,63}$" }, message: 'must match pattern "^[A-Za-z][A-Za-z0-9_-]{0,63}$"' };
          if (vErrors === null) {
            vErrors = [err10];
          } else {
            vErrors.push(err10);
          }
          errors++;
        }
      } else {
        const err11 = { instancePath: instancePath + "/id", schemaPath: "#/$defs/SpecBase/properties/id/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err11];
        } else {
          vErrors.push(err11);
        }
        errors++;
      }
    }
    if (data.kind !== void 0) {
      if ("progress" !== data.kind) {
        const err12 = { instancePath: instancePath + "/kind", schemaPath: "#/properties/kind/const", keyword: "const", params: { allowedValue: "progress" }, message: "must be equal to constant" };
        if (vErrors === null) {
          vErrors = [err12];
        } else {
          vErrors.push(err12);
        }
        errors++;
      }
    }
    if (data.title !== void 0) {
      let data3 = data.title;
      if (typeof data3 === "string") {
        if (func2(data3) > 200) {
          const err13 = { instancePath: instancePath + "/title", schemaPath: "#/$defs/SpecBase/properties/title/maxLength", keyword: "maxLength", params: { limit: 200 }, message: "must NOT have more than 200 characters" };
          if (vErrors === null) {
            vErrors = [err13];
          } else {
            vErrors.push(err13);
          }
          errors++;
        }
        if (func2(data3) < 1) {
          const err14 = { instancePath: instancePath + "/title", schemaPath: "#/$defs/SpecBase/properties/title/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
          if (vErrors === null) {
            vErrors = [err14];
          } else {
            vErrors.push(err14);
          }
          errors++;
        }
        if (!pattern5.test(data3)) {
          const err15 = { instancePath: instancePath + "/title", schemaPath: "#/$defs/SpecBase/properties/title/pattern", keyword: "pattern", params: { pattern: "^[^\\p{Cc}\\p{Cs}]+$" }, message: 'must match pattern "^[^\\p{Cc}\\p{Cs}]+$"' };
          if (vErrors === null) {
            vErrors = [err15];
          } else {
            vErrors.push(err15);
          }
          errors++;
        }
      } else {
        const err16 = { instancePath: instancePath + "/title", schemaPath: "#/$defs/SpecBase/properties/title/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err16];
        } else {
          vErrors.push(err16);
        }
        errors++;
      }
    }
    if (data.description !== void 0) {
      let data4 = data.description;
      if (typeof data4 === "string") {
        if (func2(data4) > 2e3) {
          const err17 = { instancePath: instancePath + "/description", schemaPath: "#/$defs/SpecBase/properties/description/maxLength", keyword: "maxLength", params: { limit: 2e3 }, message: "must NOT have more than 2000 characters" };
          if (vErrors === null) {
            vErrors = [err17];
          } else {
            vErrors.push(err17);
          }
          errors++;
        }
        if (!pattern6.test(data4)) {
          const err18 = { instancePath: instancePath + "/description", schemaPath: "#/$defs/SpecBase/properties/description/pattern", keyword: "pattern", params: { pattern: "^(?:[^\\p{Cc}\\p{Cs}]|\\n)*$" }, message: 'must match pattern "^(?:[^\\p{Cc}\\p{Cs}]|\\n)*$"' };
          if (vErrors === null) {
            vErrors = [err18];
          } else {
            vErrors.push(err18);
          }
          errors++;
        }
      } else {
        const err19 = { instancePath: instancePath + "/description", schemaPath: "#/$defs/SpecBase/properties/description/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err19];
        } else {
          vErrors.push(err19);
        }
        errors++;
      }
    }
    if (data.caption !== void 0) {
      let data5 = data.caption;
      if (typeof data5 === "string") {
        if (func2(data5) > 500) {
          const err20 = { instancePath: instancePath + "/caption", schemaPath: "#/$defs/SpecBase/properties/caption/maxLength", keyword: "maxLength", params: { limit: 500 }, message: "must NOT have more than 500 characters" };
          if (vErrors === null) {
            vErrors = [err20];
          } else {
            vErrors.push(err20);
          }
          errors++;
        }
        if (func2(data5) < 1) {
          const err21 = { instancePath: instancePath + "/caption", schemaPath: "#/$defs/SpecBase/properties/caption/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
          if (vErrors === null) {
            vErrors = [err21];
          } else {
            vErrors.push(err21);
          }
          errors++;
        }
        if (!pattern7.test(data5)) {
          const err22 = { instancePath: instancePath + "/caption", schemaPath: "#/$defs/SpecBase/properties/caption/pattern", keyword: "pattern", params: { pattern: "^(?:[^\\p{Cc}\\p{Cs}]|\\n)+$" }, message: 'must match pattern "^(?:[^\\p{Cc}\\p{Cs}]|\\n)+$"' };
          if (vErrors === null) {
            vErrors = [err22];
          } else {
            vErrors.push(err22);
          }
          errors++;
        }
      } else {
        const err23 = { instancePath: instancePath + "/caption", schemaPath: "#/$defs/SpecBase/properties/caption/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err23];
        } else {
          vErrors.push(err23);
        }
        errors++;
      }
    }
    if (data.roles !== void 0) {
      if (!validate22(data.roles, { instancePath: instancePath + "/roles", parentData: data, parentDataProperty: "roles", rootData, dynamicAnchors })) {
        vErrors = vErrors === null ? validate22.errors : vErrors.concat(validate22.errors);
        errors = vErrors.length;
      }
    }
    if (data.legend !== void 0) {
      let data7 = data.legend;
      if (data7 && typeof data7 == "object" && !Array.isArray(data7)) {
        for (const key1 in data7) {
          if (!(key1 === "show" || key1 === "position")) {
            const err24 = { instancePath: instancePath + "/legend", schemaPath: "#/$defs/SpecBase/properties/legend/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key1 }, message: "must NOT have additional properties" };
            if (vErrors === null) {
              vErrors = [err24];
            } else {
              vErrors.push(err24);
            }
            errors++;
          }
        }
        if (data7.show !== void 0) {
          let data8 = data7.show;
          if (!(data8 === "auto" || data8 === "always" || data8 === "never")) {
            const err25 = { instancePath: instancePath + "/legend/show", schemaPath: "#/$defs/SpecBase/properties/legend/properties/show/enum", keyword: "enum", params: { allowedValues: schema44.properties.show.enum }, message: "must be equal to one of the allowed values" };
            if (vErrors === null) {
              vErrors = [err25];
            } else {
              vErrors.push(err25);
            }
            errors++;
          }
        }
        if (data7.position !== void 0) {
          let data9 = data7.position;
          if (!(data9 === "top" || data9 === "bottom")) {
            const err26 = { instancePath: instancePath + "/legend/position", schemaPath: "#/$defs/SpecBase/properties/legend/properties/position/enum", keyword: "enum", params: { allowedValues: schema44.properties.position.enum }, message: "must be equal to one of the allowed values" };
            if (vErrors === null) {
              vErrors = [err26];
            } else {
              vErrors.push(err26);
            }
            errors++;
          }
        }
      } else {
        const err27 = { instancePath: instancePath + "/legend", schemaPath: "#/$defs/SpecBase/properties/legend/type", keyword: "type", params: { type: "object" }, message: "must be object" };
        if (vErrors === null) {
          vErrors = [err27];
        } else {
          vErrors.push(err27);
        }
        errors++;
      }
    }
    if (data.variant !== void 0) {
      let data10 = data.variant;
      if (!(data10 === "bar" || data10 === "ring")) {
        const err28 = { instancePath: instancePath + "/variant", schemaPath: "#/properties/variant/enum", keyword: "enum", params: { allowedValues: schema142.properties.variant.enum }, message: "must be equal to one of the allowed values" };
        if (vErrors === null) {
          vErrors = [err28];
        } else {
          vErrors.push(err28);
        }
        errors++;
      }
    }
    if (data.domain !== void 0) {
      let data11 = data.domain;
      if (data11 && typeof data11 == "object" && !Array.isArray(data11)) {
        if (data11.min === void 0) {
          const err29 = { instancePath: instancePath + "/domain", schemaPath: "#/properties/domain/required", keyword: "required", params: { missingProperty: "min" }, message: "must have required property 'min'" };
          if (vErrors === null) {
            vErrors = [err29];
          } else {
            vErrors.push(err29);
          }
          errors++;
        }
        if (data11.max === void 0) {
          const err30 = { instancePath: instancePath + "/domain", schemaPath: "#/properties/domain/required", keyword: "required", params: { missingProperty: "max" }, message: "must have required property 'max'" };
          if (vErrors === null) {
            vErrors = [err30];
          } else {
            vErrors.push(err30);
          }
          errors++;
        }
        for (const key2 in data11) {
          if (!(key2 === "min" || key2 === "max")) {
            const err31 = { instancePath: instancePath + "/domain", schemaPath: "#/properties/domain/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key2 }, message: "must NOT have additional properties" };
            if (vErrors === null) {
              vErrors = [err31];
            } else {
              vErrors.push(err31);
            }
            errors++;
          }
        }
        if (data11.min !== void 0) {
          let data12 = data11.min;
          if (!(typeof data12 == "number" && isFinite(data12))) {
            const err32 = { instancePath: instancePath + "/domain/min", schemaPath: "#/properties/domain/properties/min/type", keyword: "type", params: { type: "number" }, message: "must be number" };
            if (vErrors === null) {
              vErrors = [err32];
            } else {
              vErrors.push(err32);
            }
            errors++;
          }
        }
        if (data11.max !== void 0) {
          let data13 = data11.max;
          if (!(typeof data13 == "number" && isFinite(data13))) {
            const err33 = { instancePath: instancePath + "/domain/max", schemaPath: "#/properties/domain/properties/max/type", keyword: "type", params: { type: "number" }, message: "must be number" };
            if (vErrors === null) {
              vErrors = [err33];
            } else {
              vErrors.push(err33);
            }
            errors++;
          }
        }
      } else {
        const err34 = { instancePath: instancePath + "/domain", schemaPath: "#/properties/domain/type", keyword: "type", params: { type: "object" }, message: "must be object" };
        if (vErrors === null) {
          vErrors = [err34];
        } else {
          vErrors.push(err34);
        }
        errors++;
      }
    }
    if (data.overflow !== void 0) {
      let data14 = data.overflow;
      if (!(data14 === "error" || data14 === "clip-indicated")) {
        const err35 = { instancePath: instancePath + "/overflow", schemaPath: "#/properties/overflow/enum", keyword: "enum", params: { allowedValues: schema142.properties.overflow.enum }, message: "must be equal to one of the allowed values" };
        if (vErrors === null) {
          vErrors = [err35];
        } else {
          vErrors.push(err35);
        }
        errors++;
      }
    }
    if (data.unit !== void 0) {
      let data15 = data.unit;
      if (typeof data15 === "string") {
        if (func2(data15) > 500) {
          const err36 = { instancePath: instancePath + "/unit", schemaPath: "#/$defs/Text/maxLength", keyword: "maxLength", params: { limit: 500 }, message: "must NOT have more than 500 characters" };
          if (vErrors === null) {
            vErrors = [err36];
          } else {
            vErrors.push(err36);
          }
          errors++;
        }
        if (func2(data15) < 1) {
          const err37 = { instancePath: instancePath + "/unit", schemaPath: "#/$defs/Text/minLength", keyword: "minLength", params: { limit: 1 }, message: "must NOT have fewer than 1 characters" };
          if (vErrors === null) {
            vErrors = [err37];
          } else {
            vErrors.push(err37);
          }
          errors++;
        }
        if (!pattern5.test(data15)) {
          const err38 = { instancePath: instancePath + "/unit", schemaPath: "#/$defs/Text/pattern", keyword: "pattern", params: { pattern: "^[^\\p{Cc}\\p{Cs}]+$" }, message: 'must match pattern "^[^\\p{Cc}\\p{Cs}]+$"' };
          if (vErrors === null) {
            vErrors = [err38];
          } else {
            vErrors.push(err38);
          }
          errors++;
        }
      } else {
        const err39 = { instancePath: instancePath + "/unit", schemaPath: "#/$defs/Text/type", keyword: "type", params: { type: "string" }, message: "must be string" };
        if (vErrors === null) {
          vErrors = [err39];
        } else {
          vErrors.push(err39);
        }
        errors++;
      }
    }
    if (data.format !== void 0) {
      let data16 = data.format;
      if (data16 && typeof data16 == "object" && !Array.isArray(data16)) {
        for (const key3 in data16) {
          if (!(key3 === "style" || key3 === "currency" || key3 === "minimumFractionDigits" || key3 === "maximumFractionDigits" || key3 === "signDisplay")) {
            const err40 = { instancePath: instancePath + "/format", schemaPath: "#/$defs/NumberFormat/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key3 }, message: "must NOT have additional properties" };
            if (vErrors === null) {
              vErrors = [err40];
            } else {
              vErrors.push(err40);
            }
            errors++;
          }
        }
        if (data16.style !== void 0) {
          let data17 = data16.style;
          if (!(data17 === "decimal" || data17 === "percent" || data17 === "currency" || data17 === "compact")) {
            const err41 = { instancePath: instancePath + "/format/style", schemaPath: "#/$defs/NumberFormat/properties/style/enum", keyword: "enum", params: { allowedValues: schema54.properties.style.enum }, message: "must be equal to one of the allowed values" };
            if (vErrors === null) {
              vErrors = [err41];
            } else {
              vErrors.push(err41);
            }
            errors++;
          }
        }
        if (data16.currency !== void 0) {
          let data18 = data16.currency;
          if (typeof data18 === "string") {
            if (!pattern18.test(data18)) {
              const err42 = { instancePath: instancePath + "/format/currency", schemaPath: "#/$defs/NumberFormat/properties/currency/pattern", keyword: "pattern", params: { pattern: "^[A-Z]{3}$" }, message: 'must match pattern "^[A-Z]{3}$"' };
              if (vErrors === null) {
                vErrors = [err42];
              } else {
                vErrors.push(err42);
              }
              errors++;
            }
          } else {
            const err43 = { instancePath: instancePath + "/format/currency", schemaPath: "#/$defs/NumberFormat/properties/currency/type", keyword: "type", params: { type: "string" }, message: "must be string" };
            if (vErrors === null) {
              vErrors = [err43];
            } else {
              vErrors.push(err43);
            }
            errors++;
          }
        }
        if (data16.minimumFractionDigits !== void 0) {
          let data19 = data16.minimumFractionDigits;
          if (!(typeof data19 == "number" && (!(data19 % 1) && !isNaN(data19)) && isFinite(data19))) {
            const err44 = { instancePath: instancePath + "/format/minimumFractionDigits", schemaPath: "#/$defs/NumberFormat/properties/minimumFractionDigits/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
            if (vErrors === null) {
              vErrors = [err44];
            } else {
              vErrors.push(err44);
            }
            errors++;
          }
          if (typeof data19 == "number" && isFinite(data19)) {
            if (data19 > 6 || isNaN(data19)) {
              const err45 = { instancePath: instancePath + "/format/minimumFractionDigits", schemaPath: "#/$defs/NumberFormat/properties/minimumFractionDigits/maximum", keyword: "maximum", params: { comparison: "<=", limit: 6 }, message: "must be <= 6" };
              if (vErrors === null) {
                vErrors = [err45];
              } else {
                vErrors.push(err45);
              }
              errors++;
            }
            if (data19 < 0 || isNaN(data19)) {
              const err46 = { instancePath: instancePath + "/format/minimumFractionDigits", schemaPath: "#/$defs/NumberFormat/properties/minimumFractionDigits/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" };
              if (vErrors === null) {
                vErrors = [err46];
              } else {
                vErrors.push(err46);
              }
              errors++;
            }
          }
        }
        if (data16.maximumFractionDigits !== void 0) {
          let data20 = data16.maximumFractionDigits;
          if (!(typeof data20 == "number" && (!(data20 % 1) && !isNaN(data20)) && isFinite(data20))) {
            const err47 = { instancePath: instancePath + "/format/maximumFractionDigits", schemaPath: "#/$defs/NumberFormat/properties/maximumFractionDigits/type", keyword: "type", params: { type: "integer" }, message: "must be integer" };
            if (vErrors === null) {
              vErrors = [err47];
            } else {
              vErrors.push(err47);
            }
            errors++;
          }
          if (typeof data20 == "number" && isFinite(data20)) {
            if (data20 > 6 || isNaN(data20)) {
              const err48 = { instancePath: instancePath + "/format/maximumFractionDigits", schemaPath: "#/$defs/NumberFormat/properties/maximumFractionDigits/maximum", keyword: "maximum", params: { comparison: "<=", limit: 6 }, message: "must be <= 6" };
              if (vErrors === null) {
                vErrors = [err48];
              } else {
                vErrors.push(err48);
              }
              errors++;
            }
            if (data20 < 0 || isNaN(data20)) {
              const err49 = { instancePath: instancePath + "/format/maximumFractionDigits", schemaPath: "#/$defs/NumberFormat/properties/maximumFractionDigits/minimum", keyword: "minimum", params: { comparison: ">=", limit: 0 }, message: "must be >= 0" };
              if (vErrors === null) {
                vErrors = [err49];
              } else {
                vErrors.push(err49);
              }
              errors++;
            }
          }
        }
        if (data16.signDisplay !== void 0) {
          let data21 = data16.signDisplay;
          if (!(data21 === "auto" || data21 === "always" || data21 === "exceptZero")) {
            const err50 = { instancePath: instancePath + "/format/signDisplay", schemaPath: "#/$defs/NumberFormat/properties/signDisplay/enum", keyword: "enum", params: { allowedValues: schema54.properties.signDisplay.enum }, message: "must be equal to one of the allowed values" };
            if (vErrors === null) {
              vErrors = [err50];
            } else {
              vErrors.push(err50);
            }
            errors++;
          }
        }
      } else {
        const err51 = { instancePath: instancePath + "/format", schemaPath: "#/$defs/NumberFormat/type", keyword: "type", params: { type: "object" }, message: "must be object" };
        if (vErrors === null) {
          vErrors = [err51];
        } else {
          vErrors.push(err51);
        }
        errors++;
      }
    }
    if (data.items !== void 0) {
      let data22 = data.items;
      if (Array.isArray(data22)) {
        if (data22.length > 20) {
          const err52 = { instancePath: instancePath + "/items", schemaPath: "#/properties/items/maxItems", keyword: "maxItems", params: { limit: 20 }, message: "must NOT have more than 20 items" };
          if (vErrors === null) {
            vErrors = [err52];
          } else {
            vErrors.push(err52);
          }
          errors++;
        }
        if (data22.length < 1) {
          const err53 = { instancePath: instancePath + "/items", schemaPath: "#/properties/items/minItems", keyword: "minItems", params: { limit: 1 }, message: "must NOT have fewer than 1 items" };
          if (vErrors === null) {
            vErrors = [err53];
          } else {
            vErrors.push(err53);
          }
          errors++;
        }
        const len0 = data22.length;
        for (let i0 = 0; i0 < len0; i0++) {
          if (!validate60(data22[i0], { instancePath: instancePath + "/items/" + i0, parentData: data22, parentDataProperty: i0, rootData, dynamicAnchors })) {
            vErrors = vErrors === null ? validate60.errors : vErrors.concat(validate60.errors);
            errors = vErrors.length;
          }
        }
      } else {
        const err54 = { instancePath: instancePath + "/items", schemaPath: "#/properties/items/type", keyword: "type", params: { type: "array" }, message: "must be array" };
        if (vErrors === null) {
          vErrors = [err54];
        } else {
          vErrors.push(err54);
        }
        errors++;
      }
    }
  } else {
    const err55 = { instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" };
    if (vErrors === null) {
      vErrors = [err55];
    } else {
      vErrors.push(err55);
    }
    errors++;
  }
  validate58.errors = vErrors;
  return errors === 0;
}
validate58.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
function validate20(data, { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {}) {
  ;
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate20.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    const tag0 = data.kind;
    if (typeof tag0 == "string") {
      if (tag0 === "cartesian") {
        if (!validate21(data, { instancePath, parentData, parentDataProperty, rootData, dynamicAnchors })) {
          vErrors = vErrors === null ? validate21.errors : vErrors.concat(validate21.errors);
          errors = vErrors.length;
        }
        var props0 = true;
      } else if (tag0 === "donut") {
        if (!validate45(data, { instancePath, parentData, parentDataProperty, rootData, dynamicAnchors })) {
          vErrors = vErrors === null ? validate45.errors : vErrors.concat(validate45.errors);
          errors = vErrors.length;
        }
        if (props0 !== true) {
          props0 = true;
        }
      } else if (tag0 === "heatmap") {
        if (!validate49(data, { instancePath, parentData, parentDataProperty, rootData, dynamicAnchors })) {
          vErrors = vErrors === null ? validate49.errors : vErrors.concat(validate49.errors);
          errors = vErrors.length;
        }
        if (props0 !== true) {
          props0 = true;
        }
      } else if (tag0 === "progress") {
        if (!validate58(data, { instancePath, parentData, parentDataProperty, rootData, dynamicAnchors })) {
          vErrors = vErrors === null ? validate58.errors : vErrors.concat(validate58.errors);
          errors = vErrors.length;
        }
        if (props0 !== true) {
          props0 = true;
        }
      } else {
        const err0 = { instancePath, schemaPath: "#/discriminator", keyword: "discriminator", params: { error: "mapping", tag: "kind", tagValue: tag0 }, message: 'value of tag "kind" must be in oneOf' };
        if (vErrors === null) {
          vErrors = [err0];
        } else {
          vErrors.push(err0);
        }
        errors++;
      }
    } else {
      const err1 = { instancePath, schemaPath: "#/discriminator", keyword: "discriminator", params: { error: "tag", tag: "kind", tagValue: tag0 }, message: 'tag "kind" must be string' };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
  } else {
    const err2 = { instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" };
    if (vErrors === null) {
      vErrors = [err2];
    } else {
      vErrors.push(err2);
    }
    errors++;
  }
  validate20.errors = vErrors;
  evaluated0.props = props0;
  return errors === 0;
}
validate20.evaluated = { "dynamicProps": true, "dynamicItems": false };
export {
  schemaValidate
};

const { join } = require('path');
const config = require('./config');
const render = require('./lib/core/renderer');
const extractVueScript = require('./lib/core/vueScriptExtractor');
const seekExportDefaultLine = require('./lib/core/seekExportDefaultLine');
const { isSingleFileComponent, isJSComponent } = require('./lib/core/issers');
const vueDataTag = require('./lib/tags/vue-data');
const vuePropTag = require('./lib/tags/vue-prop');
const vueComputedTag = require('./lib/tags/vue-computed');
const vueEventTag = require('./lib/tags/vue-event');
const vueMethodTag = require('./lib/tags/vue-method');

// Used to compute good line number for Vue methods
const exportDefaultLines = {};
const mainDocletLines = {};

exports.handlers = {
  beforeParse(e) {
    if (/\.vue$/.test(e.filename)) {
      exportDefaultLines[e.filename] = seekExportDefaultLine(e.source, e.filename);
      e.source = extractVueScript(e.filename);
    }
  },
  newDoclet(e) {
    const fileIsSingleFileComponent = isSingleFileComponent(e.doclet);
    const fileIsJSComponent = isJSComponent(e.doclet);
    if (!fileIsSingleFileComponent && !fileIsJSComponent) {
      return;
    }

    const fullPath = join(e.doclet.meta.path, e.doclet.meta.filename);
    const componentName = e.doclet.meta.filename.replace(/\.(vue|js)$/, '');

    const name = e.doclet.meta.filename.split('.')[0];
    const srcpath = __dirname.replace('node_modules\\jsdoc-vue3js', '');
    const dir = e.doclet.meta.path.replace(srcpath, '');
    const module = dir.replaceAll('\\', '-') + '-' + name

    // The main doclet before `export default {}`
    if (e.doclet.longname === 'module.exports') {
      e.doclet.kind = 'module';
      e.doclet.name = module;
      e.doclet.alias = module;
      e.doclet.longname = `module:${module}`;
    }

    if (
      !/[.~#]/.test(e.doclet.longname) // filter component's properties and member, not the best way but it werks
      && e.doclet.longname.startsWith('module:')
    ) {
      mainDocletLines[fullPath] = e.doclet.meta.lineno;
    }

    // It can be the main doclet before `export default {}`
    // with at least one `@vue-*` tag
    if (e.doclet._isVueDoc) {
      const { template } = config['jsdoc-vuejs'];
      const data = {
        props: e.doclet._vueProps || [],
        data: e.doclet._vueData || [],
        computed: e.doclet._vueComputed || [],
        event: e.doclet._vueEvent || [],
      };

      render(template, data, (err, str) => {
        if (err) throw err;

        e.doclet.description = (e.doclet.description || '') + str;
      });

      // Remove meta for not rendering source for this doclet
      delete e.doclet.meta;
    }

    // Methods and hooks
    if (e.doclet.kind === 'function' && 'memberof' in e.doclet) {
      if (e.doclet.memberof.endsWith('.methods')) {
        e.doclet.scope = 'instance';
        e.doclet.memberof = e.doclet.memberof.replace(/\.methods$/, ''); // force method to be displayed
        if (fileIsSingleFileComponent) {
          e.doclet.meta.lineno += exportDefaultLines[fullPath] - mainDocletLines[fullPath];
        }
      } else {
        // e.doclet.memberof = null; // don't include Vue hooks
        if (e.doclet.memberof === 'setup') {
            e.doclet.meta.code.type = 'FunctionExpression';
            e.doclet.scope = 'instance';

            e.doclet.longname = `module:${module}.methods.${e.doclet.name}`
            e.doclet.memberof = `module:${module}`
            if (fileIsSingleFileComponent) {
                e.doclet.meta.lineno += exportDefaultLines[fullPath] - mainDocletLines[fullPath];
            }
        }
      }
    }
  },
};

exports.defineTags = function defineTags(dictionary) {
  dictionary.defineTag(vueDataTag.name, vueDataTag.options);
  dictionary.defineTag(vuePropTag.name, vuePropTag.options);
  dictionary.defineTag(vueComputedTag.name, vueComputedTag.options);
  dictionary.defineTag(vueEventTag.name, vueEventTag.options);
  dictionary.defineTag(vueMethodTag.name, vueMethodTag.options);
};

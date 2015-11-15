'use strict';

var BaseIncludes = require('./base-includes');
var Wrapper = require('./wrapper');

const STRING_NEW_LINE = '\n';
const RE_INCLUDE = /include\s*\(\s*["']([^"']+)["']\s*\)\s*;/g;

class JsIncludes extends BaseIncludes.Constructor {
    /**
     * [createReadStream description]
     * @param  {[type]} sourcePath [description]
     * @param  {[type]} options    [description]
     * @return {[type]}            [description]
     */
    createReadStream (sourcePath, options) {
        return super
            .createReadStream(sourcePath, options)
            // todo: options.wrap
            .pipe(new Wrapper({
                cwd: this.cwd,
                path: sourcePath,
                template: this.wrapTemplate
            }));
    }

    /**
     * [parse description]
     * @param  {String} content [description]
     * @return {Parsed}         [description]
     */
    parse (content) {
        var match = RE_INCLUDE.exec(content);
        var lastIndex = RE_INCLUDE.lastIndex;

        RE_INCLUDE.lastIndex = 0;

        if (!match) {
            return {}
        }

        return {
            before: content.substring(0, match.index),
            after: content.substring(lastIndex),
            file: match[1]
        }
    }

    /**
     * [wrapTemplate description]
     * @param  {[type]} data [description]
     * @return {[type]}      [description]
     */
    wrapTemplate (data) {
        return `/* ${data.relative} ${data.position} */ /**/` + STRING_NEW_LINE;
    }
}

module.exports = JsIncludes.create();
'use strict';

var Transform = require('stream').Transform;
var path = require('path');

const STRING_NEW_LINE = '\n';
const WRAPPER_BEGIN = 'begin';
const WRAPPER_END = 'end';

class Wrapper extends Transform {
    /**
     * [constructor description]
     * @param  {[type]} options [description]
     * @return {[type]}         [description]
     */
    constructor (options) {
        super();

        this.cwd = options.cwd || process.cwd();
        this.path = options.path;
        this.relative = path.relative(this.cwd, this.path);
        this.template = options.template || new Function();
        this.position = WRAPPER_BEGIN;
        // todo: this.toJSON()
        this.push(this.template.call(null, this));
    }

    /**
     * [_transform description]
     * @param  {[type]}   chunk    [description]
     * @param  {[type]}   encoding [description]
     * @param  {Function} next     [description]
     * @return {[type]}            [description]
     */
    _transform (chunk, encoding, next) {
        next(null, chunk);
    }

    /**
     * [_flush description]
     * @param  {Function} done [description]
     * @return {[type]}        [description]
     */
    _flush (done) {
        this.position = WRAPPER_END;
        this.push(this.template.call(null, this));

        done();
    }
}

module.exports = Wrapper;

'use strict';

var Transform = require('stream').Transform;
var path = require('path');

const STRING_EMPTY = '';
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
        this.checkLastChar = options.checkLastChar || true;

        this._initialTransform = true;
        this._lastChar = STRING_EMPTY;
        
        // todo: this.toJSON()
        
    }

    /**
     * [_transform description]
     * @param  {[type]}   chunk    [description]
     * @param  {[type]}   encoding [description]
     * @param  {Function} next     [description]
     * @return {[type]}            [description]
     */
    _transform (chunk, encoding, next) {
        if (this._initialTransform) {
            this.position = WRAPPER_BEGIN;
            this.push(this.template.call(null, this));
            this._initialTransform = false;
        }

        if (this.checkLastChar) {
            this._lastChar = chunk.toString().charAt(chunk.length - 1);
        }

        next(null, chunk);
    }

    /**
     * [_flush description]
     * @param  {Function} done [description]
     * @return {[type]}        [description]
     */
    _flush (done) {
        if (this.checkLastChar && this._lastChar !== STRING_NEW_LINE) {
            this.push(STRING_NEW_LINE);
        }

        this.position = WRAPPER_END;
        this.push(this.template.call(null, this));

        done();
    }
}

module.exports = Wrapper;

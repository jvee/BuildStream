'use strict';

var fs = require('fs');
var Transform = require('stream').Transform;
var PassThrough = require('stream').PassThrough;
var path = require('path');
var duplexer = require('duplexer2');

const STRING_NEW_LINE = '\n';
const STRING_EMPTY = '';
const STREAM_EVENT_END = 'end';
const RE_LASTLINE = /\n(?=[^n]*)$/g;
const ENCODING_UTF8 = 'utf-8';

class BaseIncludes extends Transform {
    /**
     * [constructor description]
     * @param  {Object} [options]
     * @return {BaseIncludes}
     */
    constructor (options) {
        var _options = options || {};

        super(options)

        this.cached = STRING_EMPTY;
        this.sourceStack = [];
        this.cwd = _options.cwd || process.cwd();
        this.source = _options.input;
        this.fs = options.fsAdapter || fs;
    }

    /**
     * [_transform description]
     * @param  {String|Buffer}   chunk
     * @param  {String}   encoding
     * @param  {Function} next
     */
    _transform (chunk, encoding, next) {
        var content = this.cached + chunk;
        var parsed = this.parse(content);

        switch (true) {
            case parsed.hasOwnProperty('content'):
                this.cached = parsed.cache;
                this.push(parsed.content);
                break;

            case parsed.hasOwnProperty('file'):
                this.cached = STRING_EMPTY;
                this.push(parsed.before);

                this.suspendSource(parsed.after);

                this
                    .createSource(parsed.file, parsed.options)
                    .once(STREAM_EVENT_END, () => this.restoreSource());

                break;

            default:
                content = this.cacheLastLine(content);
                this.push(content);
        }

        next();
    }

    /**
     * [_flush description]
     * @param  {Function} done
     */
    _flush (done) {
        this.push(this.cached);
        done();
    }

    /**
     * [createSource description]
     * @param  {String} sourcePath
     * @param  {Object} [options]
     * @return {Stream.Readable}
     */
    createSource (sourcePath, options) {
        var from = this.sourcePath ? path.dirname(this.sourcePath) : this.cwd;
        var _sourcePath = path.resolve(from, sourcePath);

        return this.pipeSource(
            this.createReadStream(_sourcePath, options),
            _sourcePath
        );
    }

    /**
     * [restoreSource description]
     * @return {Stream.Readable}
     */
    restoreSource () {
        var restored = this.sourceStack.pop();

        if (this.cached) {
            this.push(this.cached);
            this.cached = STRING_EMPTY;
        }

        return this.pipeSource(restored.source, restored.sourcePath);
    }

    /**
     * [suspendSource description]
     * @param  {String} restContent
     * @return {Stream.Readable}
     */
    suspendSource (restContent) {
        var suspended = this.source;

        suspended.pause();
        suspended.unshift(restContent);
        suspended.push(STRING_EMPTY);
        suspended.unpipe(this);

        this.sourceStack.push({
            source: suspended,
            sourcePath: this.sourcePath
        });

        return suspended;
    }

    /**
     * [pipeSource description]
     * @param  {Stream.Readable} source
     * @return {Stream.Readable}
     */
    pipeSource (source, sourcePath) {
        this.source = source;
        this.sourcePath = sourcePath;

        source.pipe(this, {
            end: !Boolean(this.sourceStack.length)
        });

        return source;
    }

    /**
     * [createReadStream description]
     * @param  {String} sourcePath
     * @param  {Object} [options]
     * @return {Stream.Readable}
     */
    createReadStream (sourcePath, options) {
        return this.fs.createReadStream(sourcePath, {
            encoding: this.encoding || ENCODING_UTF8
        });
    }

    /**
     * @typedef {Object} Parsed
     */

    /**
     * [parse description]
     * @param  {String} content
     * @return {Parsed}
     */
    parse (content) {
        return {}
    }

    /**
     * [cacheLastLine description]
     * @param  {String} content
     * @return {String}
     */
    cacheLastLine (content) {
        content = content.split(RE_LASTLINE);

        if (content.length === 1) {
            this.cached = content.pop();
            return STRING_EMPTY;
        } 

        this.cached = STRING_NEW_LINE + content.pop();

        return content.shift();
    }

    /**
     * [create description]
     * @return {Function}
     */
    static create () {
        var Constructor = this;
        
        // todo: fool's protection

        function pipeline(options) {
            var _options = options || {};
            var encoding = _options.encoding || ENCODING_UTF8; 
            var input = new PassThrough({encoding});
            var output = new Constructor(Object.assign({input}, _options));

            input.pipe(output);

            return duplexer(input, output);
        }

        pipeline.Constructor = Constructor;

        return pipeline;
    }
}

module.exports = BaseIncludes.create();

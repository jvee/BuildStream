'use strict';

var fs = require('fs');
var Transform = require('stream').Transform;
var PassThrough = require('stream').PassThrough;
var Stream = require('stream');
var path = require('path');
var duplexer = require('duplexer2');
var Wrapper = require('./wrapper');

const STRING_NEW_LINE = '\n';
const STRING_EMPTY = '';
const STREAM_EVENT_END = 'end';
const STREAM_EVENT_DATA = 'data';
const RE_INCLUDE = /include\s*\(\s*["']([^"']+)["']\s*\)\s*;/g;

class Switcher extends Transform {
    /**
     * [constructor description]
     * @param  {[type]} options [description]
     * @return {[type]}         [description]
     */
    constructor () {
        super({writableObjectMode: true});
    }

    /**
     * [_transform description]
     * @param  {[type]}   chunk    [description]
     * @param  {[type]}   encoding [description]
     * @param  {Function} next     [description]
     * @return {[type]}            [description]
     */
    _transform (chunk, encoding, next) {
        switch (true) {
            case chunk instanceof Stream:
                chunk
                    .on(STREAM_EVENT_DATA, (data) => this.push(data))
                    .once(STREAM_EVENT_END, next);
   
                break;

            default:
                this.push(chunk);
                next();
        }
    }
}

class BaseIncludes extends Transform {
    /**
     * [constructor description]
     * @param  {[type]} options [description]
     * @return {[type]}         [description]
     */
    constructor (options) {
        super({readableObjectMode: true});

        this.cached = STRING_EMPTY;
        this.cwd = options.cwd || process.cwd();
        this.fs = options.fsAdapter || fs;
    }

    /**
     * [_transform description]
     * @param  {[type]}   chunk    [description]
     * @param  {[type]}   encoding [description]
     * @param  {Function} next     [description]
     * @return {[type]}            [description]
     */
    _transform (chunk, encoding, next) {
        var content = this.cached + chunk;
        var carret = 0;
        var parsed;

        while ((parsed = RE_INCLUDE.exec(content)) !== null) {

            if (carret !== parsed.index) {
                this.push(content.substring(carret, parsed.index));
            }

            this.push(this.createReadStream(parsed[1]));

            carret = RE_INCLUDE.lastIndex;
        }

        this.cached = content.substring(carret);

        next();     
    }

    /**
     * [_flush description]
     * @param  {Function} done [description]
     * @return {[type]}        [description]
     */
    _flush (done) {
        this.push(this.cached);
        done();
    }

    /**
     * [createReadStream description]
     * @param  {[type]} file [description]
     * @return {[type]}      [description]
     */
    createReadStream (file) {
        var filename = path.resolve(this.cwd, file)

        return this.fs
            .createReadStream(filename)
            .pipe(BaseIncludes.create({
                cwd: path.dirname(filename)
            }))
            .pipe(new Wrapper({
                cwd: this.cwd,
                path: filename,
                template: this.wrapTemplate
            }));
    }

    /**
     * [wrapTemplate description]
     * @param  {[type]} data [description]
     * @return {[type]}      [description]
     */
    wrapTemplate (data) {
        return `/* ${data.relative} ${data.position} */ /**/` + STRING_NEW_LINE;
    }

    /**
     * [create description]
     * @return {[type]} [description]
     */
    static create (options) {
        var Constructor = this;
        var output = new Switcher();
        var input = new Constructor(options);

        input.pipe(output);

        return duplexer(input, output);
    }

}

module.exports = BaseIncludes;

console.time('x');

var baseIncludes = BaseIncludes.create({cwd: __dirname + '/../demo/'});

console.timeEnd('x')

baseIncludes.on('end', () => console.timeEnd('x'));

fs
    .createReadStream(__dirname + '/../demo/1.js')
    .pipe(baseIncludes)
    .pipe(process.stdout);


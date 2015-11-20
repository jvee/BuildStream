'use strict';

var fs = require('fs');
var Transform = require('stream').Transform;
var PassThrough = require('stream').PassThrough;
var Stream = require('stream');
var path = require('path');
var Wrapper = require('./wrapper');

const STRING_NEW_LINE = '\n';
const STRING_EMPTY = '';
const STREAM_EVENT_END = 'end';
const STREAM_EVENT_DATA = 'data';
const RE_INCLUDE = /include\s*\(\s*["']([^"']+)["']\s*\)\s*;/g;
const RE_LASTLINE = /\n(?=[^n]*)$/g;

class Switcher extends Transform {
    constructor (options) {
        super({writableObjectMode: true});

        if (options.push) {
            this.push = options.push;
        }
    }

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
    constructor (options) {
        super(options);

        this.cached = STRING_EMPTY;
        this.cwd = options.cwd || process.cwd();
        this.switcher = new Switcher({
            push: super.push.bind(this)
        });
    }

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

    _flush (done) {
        this.push(this.cached);
        done();
    }

    createReadStream (file) {
        var filename = path.resolve(this.cwd, file)

        return fs
            .createReadStream(filename)
            .pipe(new BaseIncludes({
                cwd: path.dirname(filename)
            }))
            .pipe(new Wrapper({
                cwd: this.cwd,
                path: filename,
                template: this.wrapTemplate
            }));
    }

    wrapTemplate (data) {
        return `/* ${data.relative} ${data.position} */ /**/` + STRING_NEW_LINE;
    }

    push (data) {
        if (data === null) {
            return this.switcher.end();
        }

        this.switcher.write(data);
    }
}

module.exports = BaseIncludes;

console.time('x');

var baseIncludes = new BaseIncludes({cwd: __dirname + '/../demo/'});

baseIncludes.on('end', () => console.timeEnd('x'));
baseIncludes.on('data', () => null);

fs
    .createReadStream(__dirname + '/../demo/1.js')
    .pipe(baseIncludes)
    .pipe(process.stdout);

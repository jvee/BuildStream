'use strict';

var fs = require('fs');
var Transform = require('stream').Transform;
var PassThrough = require('stream').PassThrough;
var Stream = require('stream');
var path = require('path');

const STRING_NEW_LINE = '\n';
const STRING_EMPTY = '';
const STREAM_EVENT_END = 'end';
const STREAM_EVENT_DATA = 'data';
const RE_LASTLINE = /\n(?=[^n]*)$/g;
const ENCODING_UTF8 = 'utf-8';

class Switcher extends Transform {
    _transform (chunk, encoding, next) {
        switch (true) {
            case chunk instanceof Stream:
                chunk
                    .on(STREAM_EVENT_DATA, (data) => {
                        this.push(data);
                    })
                    // todo remove events
                    .once(STREAM_EVENT_END, () => {
                        next();
                    });
                break;

            default:
                this.push(chunk);
                next();
        }
    }

    // todo pipeline
}

class BaseIncludes extends Transform {
    constructor (options) {
        super(options);

        this.cached = STRING_EMPTY;
        this.cwd = options.cwd || process.cwd();

        this.switcher = new Switcher({objectMode: true});
        this.switcher.on(STREAM_EVENT_DATA, (data) => {
            this.push(data)
        });
    }

    _transform (chunk, encoding, next) {
        var re = /include\s*\(\s*["']([^"']+)["']\s*\)\s*;/g;
        var content = this.cached + chunk;
        var carret = 0;
        var parsed;

        while ((parsed = re.exec(content)) !== null) {
            this.switcher.write(content.substring(carret, parsed.index));
            this.switcher.write(this.createReadStream(parsed[1]));

            carret = re.lastIndex;
        }

        this.cached = content.substring(carret);

        next();
    }

    createReadStream (file) {
        return fs
            .createReadStream(path.resolve(this.cwd, file))
            .pipe(new BaseIncludes({cwd: this.cwd}))
    }

    _flush (done) {
        this.switcher.end(this.cached);
        this.switcher.once(STREAM_EVENT_END, done);
    }

    pipe(dest, options) {
        this.switcher.pipe(dest, options);
    }

}

console.time('x');

var baseIncludes = new BaseIncludes({cwd: __dirname + '/../demo/'});

baseIncludes.on('end', () => console.timeEnd('x'));
baseIncludes.on('data', () => null);

fs
    .createReadStream(__dirname + '/../demo/1.js')
    .pipe(baseIncludes)
    .pipe(process.stdout);
'use strict';

var Duplex = require('stream').Duplex;
var Wrapper = require('./wrapper');
var Stream = require('stream');
var path = require('path');
var util = require('util');
var fs = require('fs');

const STRING_EMPTY = '';
const STRING_NEW_LINE = '\n';

const STREAM_EVENT_END = 'end';
const STREAM_EVENT_DATA = 'data';
const STREAM_EVENT_PREFINISH = 'prefinish';
const STREAM_EVENT_QUEUEDRY = 'queuedry';

const RE_INCLUDE = /include\s*\(\s*["']([^"']+)["']\s*\)\s*;/g;

class BaseIncludes extends Duplex {
    constructor (options) {
        super(options);

        this._cached = STRING_EMPTY;
        this._queue = [];

        this.cwd = options.cwd || process.cwd();

        this.once(STREAM_EVENT_PREFINISH, () => {
            this.isFinished = true;
            this.resume();
            // this.read(0);
        });
    }

    _read () {
        var queue = this._queue;
        var content;

        if (this.isProcessing) {
            return;
        }

        if (!queue.length && this.isFinished) {
            this.push(this._cached);
            this.push(null);
            return;
        }

        if (!queue.length) {
            this.push(STRING_EMPTY);
            this.pause();
            return;
        }

        content = queue.shift();

        if (content instanceof Stream) {
            this.isProcessing = true;

            content.on(STREAM_EVENT_DATA, (data) => {
                // check null
                this.push(data);
            });

            content.once(STREAM_EVENT_END, () => {
                content.removeAllListeners(STREAM_EVENT_DATA);

                this.isProcessing = false;
                this.push(STRING_EMPTY);

                if (!queue.length) {
                    this.emit(STREAM_EVENT_QUEUEDRY);
                } else {
                    this.read(0);
                }

            });

            return;
        }

        this.push(content);

        if (!queue.length) {
            this.emit(STREAM_EVENT_QUEUEDRY);
        } else {
            this.read(0);
        }        
    }

    _write (chunk, encoding, next) {
        var content = this._cached + chunk;
        var splitted = this.parse(content);

        this._cached = splitted.pop();

        if (Array.isArray(splitted)) {
            this._queue.push(...splitted);    
        }

        if (this._queue.length) {
            this.once(STREAM_EVENT_QUEUEDRY, next);
            this.read(0);
        } else {
            next()
        }

    }

    parse (content) {
        var splitted = []
        var carret = 0;
        var parsed;

        while ((parsed = RE_INCLUDE.exec(content)) !== null) {
            if (carret !== parsed.index) {
                splitted.push(content.substring(carret, parsed.index));    
            }
            
            splitted.push(this.createReadStream(parsed[1]));

            carret = RE_INCLUDE.lastIndex;
        }

        splitted.push(content.substring(carret));

        return splitted;
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
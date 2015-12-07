'use strict';

var fs = require('fs');
var path = require('path');
var _ = require('highland');

const STRING_NEW_LINE = '\n';
const STRING_EMPTY = '';

const WRAPPER_BEGIN = 'begin';
const WRAPPER_END = 'end';

const RE_INCLUDE = /include\s*\(\s*["']([^"']+)["']\s*\)\s*;/g;

function Wrapper(begin, end) {
    var isStarted = false;

    return _.pipeline(
        _.consume(function (err, chunk, push, next) {
            if (err) {
                push(err);
                next();
                return;
            }

            if (chunk === _.nil) {
                push(null, end)
                push(null, _.nil);
                return;
            }

            if (!isStarted) {
                push(null, begin)
                isStarted = true;
            }

            push(null, chunk);
            next();
        })
    )
}

function BaseIncludes(options) {
    var cached = [STRING_EMPTY];
    var stream = create();

    stream.cwd = options.cwd || process.cwd();

    stream.parse = function (chunk, cached , push, next) {
        var content = cached.pop() + chunk;
        var carret = 0;
        var parsed;
        var args;

        while ((parsed = RE_INCLUDE.exec(content)) !== null) {

            if (carret !== parsed.index) {
                push(null, content.substring(carret, parsed.index));
            }

            args = stream.normalizeSubStreamArguments(parsed)
            push(null, stream.createSubStream.apply(null, args));

            carret = RE_INCLUDE.lastIndex;
        }

        cached.push(carret ? content.substring(carret) : content);

        next();
    }

    stream.normalizeSubStreamArguments = function (parsed) {
        return [parsed[1]];
    }

    stream.createSubStream = function (filepath) {
        var absolute = path.resolve(stream.cwd, filepath);
        var wrapBegin = stream.wrapTempalte(filepath, WRAPPER_BEGIN);
        var wrapEnd = stream.wrapTempalte(filepath, WRAPPER_END);

        return fs
            .createReadStream(absolute)
            .pipe(BaseIncludes({
                cwd: path.dirname(absolute),
            }))
            .pipe(Wrapper(wrapBegin, wrapEnd));
    }

    stream.wrapTempalte = function (path, position) {
        return `/* ${path}: ${position} */ /**/` + STRING_NEW_LINE;
    }

    function create () {
        return _.pipeline(
            _.consume(function (err, chunk, push, next) {

                if (err) {
                    push(err);
                    next();
                    return;
                }

                if (chunk === _.nil) {
                    push(null, cached);
                    push(null, _.nil);
                    return;
                }

                stream.parse(chunk, cached, push, next);

            }),
            _.flatten()
        );
    }

    return stream;
}


console.time('x');

fs
    .createReadStream(__dirname + '/../demo/1.js')
    .pipe(BaseIncludes({cwd: __dirname + '/../demo/'}))
    .on('end', () => console.timeEnd('x'))
    .pipe(process.stdout);
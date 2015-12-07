'use strict';

var _ = require('highland');
var path = require('path');
var fs = require('fs');

const STRING_EMPTY = '';
const RE_INCLUDE = /^$/;

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
                push(null, end);
                push(null, _.nil);
                return;
            }

            if (!isStarted) {
                push(null, begin);
                isStarted = true;
            }

            push(null, chunk);
            next();
        })
    );
}

function BaseIncludes(options) {
    var cached = [STRING_EMPTY];
    var stream = create();

    stream.cwd = options.cwd || process.cwd();
    stream.regExp = RE_INCLUDE;

    stream.parse = function (chunk, cached , push, next) {
        var content = cached.pop() + chunk;
        var carret = 0;
        var parsed;
        var args;

        while ((parsed = stream.regExp.exec(content)) !== null) {

            if (carret !== parsed.index) {
                push(null, content.substring(carret, parsed.index));
            }

            args = stream.normalizeSubStreamArguments(parsed);
            push(null, stream.createSubStream.apply(null, args));

            carret = stream.regExp.lastIndex;
        }

        cached.push(carret ? content.substring(carret) : content);

        next();
    };

    stream.normalizeSubStreamArguments = function (parsed) {
        return [parsed[1]];
    };

    stream.createSubStream = function (filepath) {
        var absolute = path.resolve(stream.cwd, filepath);

        return fs.createReadStream(absolute)
    };

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

const STRING_NEW_LINE = '\n';

const WRAPPER_BEGIN = 'begin';
const WRAPPER_END = 'end';

// todo: imports!
const RE_CSS_JS = /include\s*\(\s*["']([^"']+)["']\s*\)\s*;/g;

function XCssJs(options) {
    var stream = BaseIncludes(options);
    var baseCreateSubStream = stream.createSubStream;

    stream.regExp = RE_CSS_JS;

    stream.createSubStream = function (filepath) {
        var subStream = baseCreateSubStream(filepath);
        var wrapBegin = stream.wrapTempalte(filepath, WRAPPER_BEGIN);
        var wrapEnd = stream.wrapTempalte(filepath, WRAPPER_END);

        return subStream
            .pipe(XCssJs({
                cwd: path.dirname(subStream.path),
            }))
            .pipe(Wrapper(wrapBegin, wrapEnd));
    };

    stream.wrapTempalte = function (path, position) {
        return `/* ${path}: ${position} */ /**/` + STRING_NEW_LINE;
    };

    return stream;
}

module.exports = XCssJs;

console.time('x');

fs
    .createReadStream(__dirname + '/../demo/1.js')
    .pipe(XCssJs({cwd: __dirname + '/../demo/'}))
    .on('end', () => console.timeEnd('x'))
    .pipe(process.stdout);
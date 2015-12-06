'use strict';

var fs = require('fs');
var path = require('path');
var _ = require('highland');

const STRING_NEW_LINE = '\n';
const STRING_EMPTY = '';
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

function BaseIncludes(_options) {
    var options = _options || {};
    var cache = [STRING_EMPTY];

    var stream = create();

    stream.regExp = RE_INCLUDE;
    stream.cwd = options.cwd || process.cwd();

    function create() {
        return _.pipeline(
            _.map(split),
            _.append(cache),
            _.flatten
        );
    }

    function split(chunk) {
        var content = cache.pop() + chunk;
        var splitted = [];
        var carret = 0;
        var parsed;
        
        while ((parsed = stream.regExp.exec(content)) !== null) {

            if (carret !== parsed.index) {
                splitted.push(content.substring(carret, parsed.index));
            }

            splitted.push(stream.createReadStream(stream.normalizeParsed(parsed)));

            carret = stream.regExp.lastIndex;
        }

        cache.push(carret ? content.substring(carret) : content);

        return splitted;
    }

    stream.normalizeParsed  = function (parsed) {
        var absolute = path.resolve(stream.cwd, parsed[1]);

        return {
            path: absolute,
            dirname: path.dirname(absolute),
            relative: path.relative(stream.cwd, absolute)
        }
    }

    stream.wrapTempalte = function (path, position) {
        return `/* ${path}: ${position} */ /**/` + STRING_NEW_LINE;
    }

    stream.createReadStream = function (options) {
        var wrapBegin = stream.wrapTempalte(options.relative, 'begin');
        var wrapEnd = stream.wrapTempalte(options.relative, 'end');

        return fs
            .createReadStream(options.path)
            .pipe(BaseIncludes({
                cwd: options.dirname,
            }))
            .pipe(Wrapper(wrapBegin, wrapEnd));
    }

    return stream;
}



console.time('x');

fs
    .createReadStream(__dirname + '/../demo/1.js')
    .pipe(BaseIncludes({cwd: __dirname + '/../demo/'}))
    .on('end', () => console.timeEnd('x'))
    .pipe(process.stdout);
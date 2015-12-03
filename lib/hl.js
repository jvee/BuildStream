'use strict';

var fs = require('fs');
var path = require('path');
var _ = require('highland');

const STRING_NEW_LINE = '\n';
const STRING_EMPTY = '';
const RE_INCLUDE = /include\s*\(\s*["']([^"']+)["']\s*\)\s*;/g;

function Wrapper(options) {
    var isStarted = false;
    var relative = path.relative(options.cwd, options.path);

    function template(relative, position) {
        return `/* ${relative}: ${position} */ /**/` + STRING_NEW_LINE;
    }

    return _.pipeline(
        _.consume(function (err, chunk, push, next) {
            if (err) {
                push(err);
                next();
                return;
            }

            if (chunk === _.nil) {
                push(null, template(relative, 'end'));
                push(null, _.nil);
                return;
            }

            if (!isStarted) {
                push(null, template(relative, 'begin'));
                isStarted = true;
            }

            push(null, chunk);
            next();
        })
    )
}

function BaseIncludes(options) {

    var cached = STRING_EMPTY;
    var cwd = options.cwd;

    function _parse(chunk, push, next) {
        var content = cached + chunk;
        var carret = 0;
        var parsed;

        while ((parsed = RE_INCLUDE.exec(content)) !== null) {
            push(null, content.substring(carret, parsed.index));
            push(null, _createReadStream(parsed[1]));

            carret = RE_INCLUDE.lastIndex;
        }

        cached = content.substring(carret);

        next();
    }

    function _createReadStream(_filename) {
        var filename = path.resolve(cwd, _filename);

        return fs
                .createReadStream(filename)
                .pipe(BaseIncludes({
                    cwd: path.dirname(filename),
                    nested: true
                }))
                .pipe(Wrapper({
                    cwd: cwd,
                    path: filename,
                }))
    }

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

            _parse(chunk, push, next);

        }),
        _.flatten()
    );

}

console.time('x');

var baseIncludes = BaseIncludes({cwd: __dirname + '/../demo/'});

console.timeEnd('x')

baseIncludes.on('end', () => console.timeEnd('x'));

fs
    .createReadStream(__dirname + '/../demo/1.js')
    .pipe(baseIncludes)
    .pipe(process.stdout);
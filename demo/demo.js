var JsIncludes = require('../lib/js-includes');
var fs = require('fs');

console.log('\n\n\n');
console.log('-------------------');
console.log('-------------------');
console.log('-------------------');
console.log('\n\n\n');

var jsIncludes = JsIncludes({cwd: __dirname});
console.time('test');

var i = 0;
var firstData = Date.now();
var dataLength = 0;

fs.createReadStream(__dirname + '/1.js').pipe(jsIncludes);

jsIncludes.once('data', function () {
    firstData = Date.now() - firstData;
});

jsIncludes.on('data', function (data) {
    i++;
    dataLength += data.length;
});

jsIncludes.on('end', function () {
    console.log('\n\n\n');
    console.timeEnd('test');
    console.log('\n');
    console.log('writes count', i);
    console.log('first write', firstData);
    console.log('data length', dataLength);
    console.log('\n');

    // console.time('ycssjs');
    // var ycssjs = require('child_process').spawn('ycssjs', ['wishlist.includes.js', '--minimize', 'no']);

    // ycssjs.on('error', function () {
    //     console.log(arguments);
    // });

    // ycssjs.on('close', function (code) {
    //     console.timeEnd('ycssjs');
    // });


});

// var writeStream = fs.createWriteStream('_wishlist.includes.stream.js');

// console.time('stream');
// writeStream.on('finish', function () {
//     console.timeEnd('stream');
// });

// jsIncludes.pipe(writeStream);

jsIncludes.pipe(process.stdout, {test: true});

// DEBUG=*
// http://google.github.io/tracing-framework/getting-started.html
// https://www.npmjs.com/package/prof
// https://www.npmjs.com/browse/keyword/profiler
// NTF https://github.com/nodejs/readable-stream
// http://stackoverflow.com/questions/1911015/how-to-debug-node-js-applications
// http://www.willvillanueva.com/the-node-js-profiling-guide-that-hasnt-existed-profiling-node-js-applications-part-1/
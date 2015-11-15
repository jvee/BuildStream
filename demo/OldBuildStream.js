var util = require('util');
var fs = require('fs');
var Transform = require('stream').Transform;
var PassThrough = require('stream').PassThrough;

function BuildStream(options) {
    var file = typeof options === 'string' ? options : options.file;

    Transform.call(this, options);
    this._chunkCache = '';

    if (file) {
        this.createReadStream(file).pipe(this);
    }
}

util.inherits(BuildStream, Transform);

BuildStream.prototype._transform = function(chunk, encoding, done) {
    var content;

    this._chunkCache += Buffer.isBuffer(chunk) ? chunk.toString('utf8') : chunk;
    // https://regex101.com/r/bS9oU1/1
    content = this._chunkCache.split(/\r?\n/); // todo: optimize

    this._chunkCache = '\r\n' + content.pop();
    this.process(content.join('\n'), done);
};

BuildStream.prototype.process = function (content, done) {
    var re = /include\s*\(\s*["']([^"']+)["']\s*\)\s*;/g;
    var queue = [];
    var carret = 0;

    if (typeof content === 'undefined') {
        return done();
    }

    while ((match = re.exec(content)) !== null) {
        queue.push(content.substring(carret, match.index));
        queue.push(new BuildStream(match[1]));
        carret = re.lastIndex;
    }

    queue.push(content.substring(carret, content.length));

    // this._buffer.push(...)
    // this._processBuffer()
    // done();
    this._processQueue(queue, done);
};

BuildStream.prototype._flush = function(done) {
    // this.flushed = true
    // this.done = done;
    // this.buffer.push(this._chunkCache)
    this.process(this._chunkCache, done);
};

BuildStream.prototype._processQueue = function (queue, done) {
    var chunk = queue.shift();
    var _this = this;

    // if (chunk === undefined && this.flushed) {
    //      this._processing = false;
    //      this.done();
    //      
    // }
    // this._processing = true

    if (chunk === undefined) {
        return done();
    }

    if (typeof chunk === 'string') {  // ??
        this.push(chunk);
        this._processQueue(queue, done);
    }

    if (chunk instanceof BuildStream) {
        chunk
            .on('data', this.push.bind(this))
            .on('end', this._processQueue.bind(this, queue, done));
    
    }
};

BuildStream.prototype.createReadStream = function (file) {
    // .setEncoding('utf8');
    return fs.createReadStream(file);
};

/*
 
 example

 fs
    .createReadStream('./file')
    .pipe(new BuildStream())
    .pipe(process.stdout);

new BuildStream('./file') ???

 */

var bs = new BuildStream('1.js');
console.time('test');
bs.on('end', function () {
    console.timeEnd('test');
});
bs.pipe(process.stdout, {test: true});

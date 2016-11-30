var path = require('path');
var stream = require('../stream');
var PluginError = require('gulp-util').PluginError;
var reduce = require('lodash/reduce');
var jsonfile = require('jsonfile')
jsonfile.spaces = 4;

module.exports = function (opts) {
    opts = opts || {};
    var firstRun = true;
    var errorReport = {}
    if (opts.reportFile != undefined) {
	errorReport = jsonfile.readFileSync(opts.reportFile) || {};
	if (Object.keys(errorReport).length > 0){
	    firstRun = false
	}
    }


    // @type false|[]paths - paths to files that failed jshint
    var fails = false;

    // @type false|[]files - files that need to be passed downstream on flush
    var buffer = opts.buffer !== false ? [] : false;
    var messages = {
		    error : 0,
		    warning : 0,
		    info : 0
		};
    var currentReport = {}

    return stream(
	function through(file) {
	    // @type object - count of jshint error, warning and info messages

	    var fileName = path.relative(process.cwd(), file.path)
	    var fileResult = currentReport[fileName] ||
		{
		    error : 0,
		    warning : 0,
		    info : 0
		};

	    // a per file name error count
	    if (file.jshint && !file.jshint.success && !file.jshint.ignored) {
		for (var i = 0; i < file.jshint.results.length; i++) {
		    var result = file.jshint.results[i];
		    fileResult.error = fileResult.error + Number(result.error.code[0] === 'E');
		    fileResult.warning = fileResult.warning + Number(result.error.code[0] === 'W');
		    fileResult.info = fileResult.info + Number(result.error.code[0] === 'I');
		}
		currentReport[fileName] = fileResult;
	    }

	    // check for failure
	    if (file.jshint && !file.jshint.success && !file.jshint.ignored) {
		var previousResults = errorReport[fileName] ||
		    {
			    error : 0,
			    warning : 0,
			    info : 0
		    };


		if (fileResult.error > previousResults.error ||
		    fileResult.warning > previousResults.warning ||
		    fileResult.info > previousResults.info) {
		    (fails = fails || []).push(path.relative(process.cwd(), file.path));
		    messages = {
			error: (messages.error + fileResult.error),
			warning: (messages.warning + fileResult.warning),
			info: (messages.info + fileResult.info)
		    }
		    if (firstRun) {
			errorReport[fileName] = fileResult;
			jsonfile.writeFileSync(opts.reportFile, errorReport);
		    }
		} else {
		    errorReport[fileName] = fileResult;
		    jsonfile.writeFileSync(opts.reportFile, errorReport);
		}
	    }

	    // buffer or pass downstream
	    (buffer || this).push(file);
	}, function flush() {

	    var failOnWarning = !opts.ignoreWarning && messages.warning;
	    var failOnInfo = !opts.ignoreInfo && messages.info;
	    if (fails && (messages.error || failOnWarning || failOnInfo)) {
		this.emit('error', new PluginError('gulp-jshint', {
		    message: 'JSHint failed for: ' + fails.join(', '),
		    showStack: false
		}));
	    }

	    if (buffer) {
		// send the buffered files downstream
		buffer.forEach(function (file) {
		    this.push(file);
		}, this);
	    }
	}
    );
};

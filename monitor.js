'use strict';

/* jshint esversion: 6 */
/* jshint node: true */

var fs = require('fs');
var childProcess = require('child_process');

var config = {
	// TeamViewer Config, will be defined later
	logFilePath: null,
	incomingFilePath: null,
	// TeamViewer Log Keyword
	connectedKeyword: 'TeamViewerDesktop started',//'Desktop: Grabbed screen is ok.', // 'Desktop grab succeeded.',
	disconnectedKeyword: 'RA: Stopping capturing thread',
	// FFmpeg
	FFmpegPath: 'ffmpeg',
	outputDir: './',
	outputFileName: '${ct}-${dt}-${id}${name}.mp4',
	fps: 5,
	bitrate: 2000000,
	videoDeviceIndex: process.platform === 'darwin' ? 'default' : '0.0',
	offsetX: undefined,
	offsetY: undefined,
	videoSize: undefined,
	preset: 'ultrafast',
	scale: undefined,
	FFmpegExtraArg: '',
	// ffmpeg -f gdigrab -framerate 5 -offset_x 0 -offset_y 0 -video_size 1920x1080 -i desktop -vcodec libx264 -b:v 500000 -preset fast -acodec pcm_s16le output.mkv
	// Extra
	dateFormat: 'YmdHis',
	debugLevel: 1 // 0 - none; 1 - minimum; 2; 3 - maximum
};

/** 
 * A Date prototype to custom date format
 * 
 * @memberof Date.prototype
 * @param {string} format Date string format
 * @returns {string} The final time string
 */
Date.prototype.toParsedString = function(format){
	// based on http://php.net/manual/en/datetime.createfromformat.php
	var that = this;
	if (isNaN(that)) return 'Invalid Date';
	
	return format.replace(/\w/g, (c) => {
		switch (c) {
			// Year
			case 'Y':
				return that.getFullYear();
			case 'y':
				return ('0' + that.getYear()).substr(-2);
			// Months
			case 'm':
				return ('0' + (that.getMonth() + 1)).substr(-2);
			case 'n':
				return that.getMonth() + 1;
			// Date
			case 'd':
				return ('0' + that.getDate()).substr(-2);
			// Hours
			case 'H':
				return ('0' + that.getHours()).substr(-2);
			case 'G':
				return that.getHours();
			// Minutes
			case 'i':
				return ('0' + that.getMinutes()).substr(-2);
			// Seconds
			case 's':
				return ('0' + that.getSeconds()).substr(-2);
			// Milliseconds, in fact it's not in standard DateTime format,
			// So we just use a not-using character I as milliseconds.
			case 'I':
				return ('00' + that.getMilliseconds()).substr(-3);
			// Unix time
			case 'U':
				return parseInt(that.getTime() / 1000);
			// nothing case
			default:
				return c;
		}
	});
};

/**
 * Split input argument to an array, contains key and value
 * 
 * @param {string} arg - The string that should be split
 * @returns {string[]} The splited argument
 */
function getSplitArg (arg) {
	var splitArg = arg.trim().split(/=(.+)/);
	if (splitArg.length === 2) {
		if (splitArg[1].match(/^`.*\${.+}.*`$/)) { // exec template iterator
			splitArg[1] = splitArg[1].match(/^`(.+)`$/)[1].replace(/\${(.+)}/gi, (match, cur) => {
				cur = cur.trim();

				/*try {
					// WARNING: `eval()` is not safe, should find a better solution
					// example: ${childProcess.exec('rm rf /'), 'helloworld'}
					//return eval(cur);

					// okay, how about only find the value in `process.env`?
					return process.env[cur];
				}
				catch (err) {
					return cur;
				}*/
				
				if (process.env[cur]) {
					return process.env[cur];
				}

				return cur;
			});
		}
		else {
			splitArg[1] = splitArg[1].match(/^"(.+)"$|^'(.+)'$|^`(.+)`$|^(.+)$/)[1].trim();
		}
	}

	return splitArg;
}

/**
 * Get the modified text and execute callback function.
 * Anyway it's just a `fs.createReadStream` wrapper
 * 
 * @param {string} path - The modified file
 * @param {Object} options - The options, the same as `fs.createReadStream(arg[1])`
 * @param {function(string)} callback - The callback function
 */
function getModifiedText (path, options, callback) {
	options.encoding = options.encoding || 'utf-8';
	var rs = fs.createReadStream(path, options);
	rs.on('readable', () => {
		callback(rs.read());
	});
}

// set default `logFilePath` and `incomingFilePath` by platform
switch (process.platform) {
	case 'win32':
		config.logFilePath = 'C:/Program Files (x86)/TeamViewer/TeamViewer12_Logfile.log';
		config.incomingFilePath = 'C:/Program Files (x86)/TeamViewer/Connections_incoming.log';
		break;

	case 'darwin':
		config.logFilePath = '~/Library/Logs/TeamViewer/TeamViewer12_Logfile.log';
		config.incomingFilePath = '~/Library/Logs/TeamViewer/Connections_incoming.log';
		break;

	case 'linux':
		config.logFilePath = `/var/log/teamviewer12/${process.env.USER}/TeamViewer12_Logfile.log`;
		config.incomingFilePath = '/var/log/teamviewer12/Connections_incoming.log';
		break;

	default:
		console.log('Did TeamViewer support a new platform???');
		// how about linux?
		config.logFilePath = `/var/log/teamviewer12/${process.env.USER}/TeamViewer12_Logfile.log`;
		config.incomingFilePath = '/var/log/teamviewer12/Connections_incoming.log';
}

var tempFileName = null;
var recordProcess = null;
var connectedTime = null;
var disconnectedTime = null;
var overwriteConfig = {};

process.argv.forEach((elem) => {
	if (elem.indexOf('--') === 0) {
		var curArg = getSplitArg(elem.substr(2));

		if (curArg[0] === 'config') {
			// the priority of config file is lower than command arguments,
			// so it can overwrite default `config` without caching
			fs.readFileSync(curArg[1]).split('\n').forEach((e) => {
				var arg = getSplitArg(e);
				config[arg[0]] = arg[1];
			});
		}
		else {
			// the priority of command arguments is the highest,
			// so we should cache them, until config file was overwrited,
			// then overwrite all of them
			overwriteConfig[curArg[0]] = curArg[1];
		}
	}
});

// last, overwrite `config`
Object.keys(overwriteConfig).forEach((elem) => {
	config[elem] = overwriteConfig[elem];
	delete overwriteConfig[elem];
});

// cache log file size first
var logFileSize = fs.statSync(config.logFilePath).size;
var incomingFileSize = fs.statSync(config.incomingFilePath).size;

// FFmpeg command
var FFmpegCommand;
switch (process.platform) {
	case 'win32':
		FFmpegCommand = `"${config.FFmpegPath}" -f gdigrab -framerate ${config.fps} 
							${config.offsetX ? `-offset_x ${config.offsetX}` : ''} 
							${config.offsetY ? `-offset_y ${config.offsetY}` : ''} 
							${config.videoSize ? `-video_size ${config.videoSize}` : ''} 
							-i desktop -vcodec libx264 -b:v ${config.bitrate} 
							${config.scale ? `-vf scale=${config.scale}` : ''} 
							-preset ${config.preset} ${config.FFmpegExtraArg}`;
		break;

	case 'darwin':
		FFmpegCommand = `"${config.FFmpegPath}" -f avfoundation -framerate ${config.fps} 
							${config.videoSize ? `-video_size ${config.videoSize}` : ''} 
							-i "${config.videoDeviceIndex}:none" -capture_cursor 1 
							-capture_mouse_clicks 1 -vcodec libx264 -b:v ${config.bitrate} 
							${config.scale ? `-vf scale=${config.scale}` : ''} 
							-preset ${config.preset} ${config.FFmpegExtraArg}`;
		break;

	case 'linux':
		FFmpegCommand = `"${config.FFmpegPath}" -f x11grab -framerate ${config.fps} 
							${config.offsetX ? `-grab_x ${config.offsetX}` : ''} 
							${config.offsetY ? `-grab_y ${config.offsetY}` : ''} 
							${config.videoSize ? `-video_size ${config.videoSize}` : ''} 
							-i ${config.videoDeviceIndex} -vcodec libx264 -b:v ${config.bitrate} 
							${config.scale ? `-vf scale=${config.scale}` : ''} 
							-preset ${config.preset} ${config.FFmpegExtraArg}`;
		break;
		
	default:
		console.log('Did TeamViewer support a new platform???');
		// how about linux?
		FFmpegCommand = `"${config.FFmpegPath}" -f x11grab -framerate ${config.fps} 
							${config.offsetX ? `-grab_x ${config.offsetX}` : ''} 
							${config.offsetY ? `-grab_y ${config.offsetY}` : ''} 
							${config.videoSize ? `-video_size ${config.videoSize}` : ''} 
							-i ${config.videoDeviceIndex} -vcodec libx264 -b:v ${config.bitrate} 
							${config.scale ? `-vf scale=${config.scale}` : ''} 
							-preset ${config.preset} ${config.FFmpegExtraArg}`;
}
FFmpegCommand = FFmpegCommand.replace(/\s+/g, ' ');

if (config.debugLevel >= 1) {
	console.log(`Started at ${new Date()}`);
}
if (config.debugLevel >= 2) {
	// split console.log to ignore whitespace at `,`
	console.log(`process.argv: `); console.log(process.argv);
	console.log(`Configuration: `); console.log(config);
	console.log(`FFmpegCommand:\n${FFmpegCommand} "${config.outputDir}tmp_[${config.dateFormat}].mp4"`);
}
if (config.debugLevel >= 3) {
	console.log(`logFileSize: ${logFileSize}`);
	console.log(`incomingFileSize: ${incomingFileSize}`);
}

// Since log file and incoming file are in different folders on Linux, 
// which also doesn't support watching subdirectory, and filename won't be defined on OS X,
// we need to use two watchers to watch the two specific files
var logFileWatcher = fs.watch(config.logFilePath, (eventType, filename) => {
	// console.log(`event type is: ${eventType}`);
	if (eventType === 'change') {
		if (filename) {
			if (config.debugLevel >= 2) {
				// some platform like OS X doesn't support `filename`
				console.log(`Modified File: ${filename}`);
			}
		}
		
		const newFileSize = fs.statSync(config.logFilePath).size;

		if (newFileSize === logFileSize) return;
		
		if (config.debugLevel >= 2) {
			console.log(`Log File Modified: ${logFileSize} -> ${newFileSize}`);
		}

		if (newFileSize < logFileSize) { // log file was updated, read from first byte
			logFileSize = 0;
		}

		getModifiedText(config.logFilePath, {
			start: logFileSize,
			end: newFileSize - 1
		}, (text) => {
			if (config.debugLevel >= 3) {
				console.log(`Modified Content: \n${text}`);
			}

			if (!text) return;
			
			if (text.indexOf(config.connectedKeyword) >= 0) {
				if (config.debugLevel >= 1) {
					console.log('A TeamViewer Incoming Connection is Connected!');
				}

				if (tempFileName === null) {
					connectedTime = new Date();
					tempFileName = `tmp_${connectedTime.toParsedString(config.dateFormat)}.mp4`;
					if (config.debugLevel >= 2) {
						console.log(`Temp Video Name: ${tempFileName}`);
					}

					recordProcess = childProcess.exec(`${FFmpegCommand} "${config.outputDir}${tempFileName}"`, (err) => {
						if (err === null) return;
						console.log(`exec error:\n${err}`);

						// exec error should stop process and reset filename
						recordProcess.kill();
						tempFileName = null;
						recordProcess = null;
					});

					if (config.debugLevel >= 3) {
						recordProcess.stdout.on('data', (data) => {
							console.log(data);
						});
						recordProcess.stderr.on('data', (data) => {
							console.log(data);	// some logs from FFmpeg will be in `stderr`
						});
					}
				}
			}
			if (text.indexOf(config.disconnectedKeyword) >= 0) {
				// however, if TeamViewer is not run as service, this won't updated
				if (config.debugLevel >= 1) {
					console.log('A TeamViewer Incoming Connection is Disconnected!');
				}
			}
		});
		
		logFileSize = newFileSize;
	}
});

var incomingFileWatcher = fs.watch(config.incomingFilePath, (eventType, filename) => {
	// console.log(`event type is: ${eventType}`);
	if (eventType === 'change') {
		if (filename) {
			if (config.debugLevel >= 2) {
				console.log(`Modified File: ${filename}`);
			}
		}
		
		const newFileSize = fs.statSync(config.logFilePath).size;

		if (newFileSize === incomingFileSize) return;

		if (config.debugLevel >= 2) {
			console.log(`Incoming Log File Modified: ${logFileSize} -> ${newFileSize}`);
		}

		if (newFileSize < incomingFileSize) { // log file was updated, read from first byte
			incomingFileSize = 0;
		}

		getModifiedText(config.incomingFilePath, {
			start: incomingFileSize,
			end: newFileSize - 1
		}, (text) => {
			if (!text) return;

			if (config.debugLevel >= 1) {
				console.log(`TeamViewer Incoming Log: \n${text}`);
			}

			// in case the script is running at when having an exist connection
			if (tempFileName === null) return;
			
			// at this time, the connection has already disconnected
			disconnectedTime = new Date();
			var splitLog = text.split('\t');
			var finalFileName = config.outputFileName
									.replace(/\${ct}/g, connectedTime.toParsedString(config.dateFormat).trim())
									.replace(/\${dt}/g, disconnectedTime.toParsedString(config.dateFormat).trim())
									.replace(/\${id}/g, splitLog[0].trim())
									.replace(/\${name}/g, splitLog[1].trim() !== 'null' ? `(${splitLog[1].trim()})` : '');

			recordProcess.on('exit', () => {
				fs.rename(config.outputDir + tempFileName, config.outputDir + finalFileName, (err) => {
					if (err) {
						console.log(err);
					}
					else if (config.debugLevel >= 1) {
						console.log('Output file has been writen to ' + config.outputDir + finalFileName);
					}

					tempFileName = null;
					recordProcess = null;
				});
			});
			
			//recordProcess.disconnect();
			//recordProcess.kill();
			recordProcess.stdin.write('q'); // `FFmpeg: press [q] to exit`
		});

		incomingFileSize = newFileSize;
	}
});
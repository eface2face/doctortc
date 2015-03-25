/**
 * Expose the doctortc object.
 */
var doctortc = module.exports = {},


/**
 * Dependencies.
 */
	debug = require('debug')('doctortc'),
	rtcninja = require('rtcninja'),
	NetworkTester = require('./NetworkTester');


// Initialize rtcninja if not yet set.
if (!rtcninja.called) {
	rtcninja();
}


/**
 * Public API.
 */


doctortc.hasWebRTC = function () {
	return rtcninja.hasWebRTC();
};


doctortc.test = function (turnServer, callback, errback, options) {
	if (!rtcninja.hasWebRTC()) {
		throw new Error('doctortc.test() | no WebRTC support');
	}

	debug('test() | [turnServer:%o, options:%o]', turnServer, options);

	return new NetworkTester(turnServer, callback, errback, options);
};


// Expose the debug module.
doctortc.debug = require('debug');

/**
 * Expose the doctortc object.
 */
var doctortc = module.exports = {},


/**
 * Dependencies.
 */
	debug = require('debug')('doctortc'),
	rtcninja = require('rtcninja'),
	browser = require('bowser').browser,
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


Object.defineProperty(doctortc, 'browser', {
	get: function () {
		var model;

		if (browser.chrome) {
			model = 'Chrome';
		} else if (browser.firefox) {
			model = 'Firefox';
		} else if (browser.msie) {
			model = 'Internet Explorer';
		} else if (browser.safari) {
			model = 'Safari';
		} else if (browser.android) {
			model = 'Android';
		} else if (browser.iphone) {
			model = 'iPhone';
		} else if (browser.ipad) {
			model = 'iPad';
		} else if (browser.ios) {
			model = 'iOS';
		} else if (browser.opera) {
			model = 'Opera';
		} else if (browser.gecko) {
			model = 'Gecko';
		} else if (browser.webkit) {
			model = 'Webkit';
		} else {
			model = 'Unknown';
		}

		if (browser.mobile) {
			model = model + ' mobile';
		} else if (browser.tablet) {
			model = model + ' + tablet';
		}

		model = (model + ' ' + browser.version).trim();

		return model;
	}
});


doctortc.test = function (turnServer, callback, errback, options) {
	if (!rtcninja.hasWebRTC()) {
		throw new Error('doctortc.test() | no WebRTC support');
	}

	debug('test() | [turnServer:%o, options:%o]', turnServer, options);

	return new NetworkTester(turnServer, callback, errback, options);
};


// Expose the debug module.
doctortc.debug = require('debug');

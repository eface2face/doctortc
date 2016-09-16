/**
 * Expose the doctortc object.
 */
var doctortc = module.exports = {},


/**
 * Dependencies.
 */
	debug = require('debug')('doctortc'),
	rtcninja = require('rtcninja'),
	browser = require('bowser'),
	NetworkTester = require('./NetworkTester');


/**
 * Public API.
 */


doctortc.setRtcNinja = function (rtcninjaModule) {
	debug('setRtcNinja()');

	rtcninja = rtcninjaModule;
};


doctortc.hasWebRTC = function () {
	// Initialize rtcninja if not yet set.
	if (!rtcninja.called) {
		rtcninja();
	}

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


Object.defineProperty(doctortc, 'errors', {
	value: NetworkTester.errors
});


doctortc.test = function (turnServers, callback, errback, options) {
	// Initialize rtcninja if not yet set.
	if (!rtcninja.called) {
		rtcninja();
	}

	if (!rtcninja.hasWebRTC()) {
		throw new Error('doctortc.test() | no WebRTC support');
	}

	if (!Array.isArray(turnServers)) {
		turnServers = [turnServers];
	}

	debug('test() | [turnServers:%o, options:%o]', turnServers, options);

	return new NetworkTester(rtcninja, turnServers, callback, errback, options);
};

/**
 * @name  DoctoRTC
 * @namespace
 */
var DoctoRTC = (function() {
	"use strict";

	var	DoctoRTC;

	DoctoRTC = {
		settings: {
			verbose: false
		}
	};

	// Include EventEmitter.js and get DoctoRTC.EventEmitter and DoctoRTC.Event.
	@@include('../src/EventEmitter.js')

	// Getters.
	Object.defineProperties(DoctoRTC, {
		title: {
			get: function(){ return '<%= pkg.title %>'; }
		},
		titleLowCase: {
			get: function(){ return '<%= pkg.titleLowCase %>'; }
		},
		name: {
			get: function(){ return '<%= pkg.name %>'; }
		},
		version: {
			get: function(){ return '<%= pkg.version %>'; }
		}
	});

	/* API functions. */

	DoctoRTC.setVerbose = function(value){
		DoctoRTC.settings.verbose = value;
	};

	DoctoRTC.hasWebRTC = function() {
		if (DoctoRTC.Adaptor.getUserMedia &&
			DoctoRTC.Adaptor.RTCPeerConnection &&
			DoctoRTC.Adaptor.RTCSessionDescription) {
			return true;
		}
		else {
			return false;
		}
	};

	DoctoRTC.testNetwork = function(turnServer, callback, errback, options) {
		new DoctoRTC.NetworkTester(turnServer, callback, errback, options);
	};

	/* Private class functions. */

	DoctoRTC.debug = function(klass, method, msg) {
		if (DoctoRTC.settings.verbose) {
			console.debug("[DEBUG] " + DoctoRTC.titleLowCase + " | " + klass + "." + method + "()" + (msg ? " | " + msg : ""));
		}
	};

	DoctoRTC.log = function(klass, method, msg) {
		console.log("[LOG]   " + DoctoRTC.titleLowCase + " | " + klass + "." + method + "()" + (msg ? " | " + msg : ""));
	};

	DoctoRTC.warn = function(klass, method, msg) {
		console.warn("[WARN]  " + DoctoRTC.titleLowCase + " | " + klass + "." + method + "()" + (msg ? " | " + msg : ""));
	};

	DoctoRTC.error = function(klass, method, msg) {
		console.error("[ERROR] " + DoctoRTC.titleLowCase + " | " + klass + "." + method + "()" + (msg ? " | " + msg : ""));
	};

	DoctoRTC.throw = function(klass, method, msg) {
		throw("[THROW] " + DoctoRTC.titleLowCase + " | " + klass + "." + method + "()" + (msg ? " | " + msg : ""));
	};

	return DoctoRTC;
}());

/**
 * @name  NetworkTester
 * @augments  DoctoRTC
 */
(function(DoctoRTC) {
	var
		NetworkTester,
		CLASS = "NetworkTester",
		ERRORS = {
			CONNECTION_TIMEOUT: "CONNECTION TIMEOUT",
			TEST_TIMEOUT: "TEST TIMEOUT",
			INTERNAL_ERROR: "INTERNAL ERROR"
		};

	var sdpConstraints = {
		mandatory: {
			// NOTE: We need a fake audio track for Firefox to support DataChannel.
			// See https://bitbucket.org/ibc_aliax/doctortc.js/issue/1/datachannels-in-firefox-require-audio
			OfferToReceiveAudio: true,
			OfferToReceiveVideo: false
		}
	};

	// Constructor.
	NetworkTester = function(turnServer, callback, errback, options) {
		this.callback = callback;
		this.errback = errback;

		options = options || {};

		var self = this;

		this.dc1Open = false;
		this.dc2Open = false;
		this.packet = null;
		this.packetSize = null;
		this.packetSenderTimer = null;
		this.testBeginTime = null;
		this.testEndTime = null;
		this.connectTimeout = options.connectTimeout || 4;  // Default 4 seconds.
		this.connectionTimer = null;
		this.testTimeout = options.testTimeout || 8;  // Default 8 seconds.
		this.testTimer = null;
		this.numPackets = options.numPackets || 200;  // Default 200 packets.
		this.numPacketsSent = 0;
		this.numPacketsReceived = 0;

		// NOTE: WebRTC states that RTCIceServer MUST contain a "urls" parameter, but Firefox
		// requires "url" (old way). Fix it.
		if (turnServer.urls) {
			turnServer.url = turnServer.urls;
		}
		else if (turnServer.url) {
			turnServer.urls = turnServer.url;
		}
		if (options.turnServer2 && options.turnServer2.urls) {
			options.turnServer2.url = options.turnServer2.urls;
		}
		else if (options.turnServer2 && options.turnServer2.url) {
			options.turnServer2.urls = options.turnServer2.url;
		}

		var turnServer2 = options.turnServer2 || turnServer;

		// PeerConnection options.
		var pcServers1 = { iceServers: [turnServer] };
		var	pcServers2 = { iceServers: [turnServer2] };

		// Create two PeerConnections.
		this.pc1 = new DoctoRTC.Adaptor.RTCPeerConnection(pcServers1);
		this.pc2 = new DoctoRTC.Adaptor.RTCPeerConnection(pcServers2);

		// Set events.
		this.pc1.onicecandidate = function(event) { self.onIceCandidate1(event); };
		this.pc2.onicecandidate = function(event) { self.onIceCandidate2(event); };

		// DataChannel options.
		var dcOptions = {
			ordered: true,
			negotiated: true,
			id: "DoctoRTC.NetworkTester",
			maxRetransmitTime: 5000  // TODO
		};

		// Create a DataChannel in each PeerConnection.
		this.dc1 = this.pc1.createDataChannel("Channel 1", dcOptions);
		this.dc2 = this.pc2.createDataChannel("Channel 2", dcOptions);

		// Set DataChannel events.
		this.dc1.onopen = function() { self.onOpen1(); };
		this.dc2.onopen = function() { self.onOpen2(); };
		this.dc1.onmessage = function(event) { self.onMessage1(event); };
		this.dc2.onmessage = function(event) { self.onMessage2(event); };

		// Create the SDP offer in pc1.
		this.pc1.createOffer(
			function(desc) { self.onCreateOfferSuccess1(desc); },
			function(error) { self.onCreateOfferError1(error); },
			sdpConstraints
		);

		// Create a timeout for the connection establishment.
		this.connectionTimer = window.setTimeout(function() {
			self.onConnectionTimeout();
		}, this.connectTimeout * 1000);
	};

	/* Methods. */

	NetworkTester.prototype.onCreateOfferSuccess1 = function(desc) {
		DoctoRTC.debug(CLASS, "onCreateOfferSuccess1", "offer:\n\n" + desc.sdp + "\n");

		var self = this;

		this.pc1.setLocalDescription(desc);
		this.pc2.setRemoteDescription(desc);

		// Create the SDP answer in pc2.
		this.pc2.createAnswer(
			function(desc) { self.onCreateAnswerSuccess2(desc); },
			function(error) { self.onCreateAnswerError2(error); },
			sdpConstraints
		);
	};

	NetworkTester.prototype.onCreateOfferError1 = function(error) {
		DoctoRTC.error(CLASS, "onCreateOfferError1", "error: " + error);

		// Close and fire the user's errback.
		this.close(ERRORS.INTERNAL_ERROR);
	};

	NetworkTester.prototype.onCreateAnswerSuccess2 = function(desc) {
		DoctoRTC.debug(CLASS, "onCreateAnswerSucess2", "answer:\n\n" + desc.sdp + "\n");

		this.pc2.setLocalDescription(desc);
		this.pc1.setRemoteDescription(desc);
	};

	NetworkTester.prototype.onCreateAnswerError2 = function(error) {
		DoctoRTC.error(CLASS, "onCreatAnswerError2", "error: " + error);

		// Close and fire the user's errback.
		this.close(ERRORS.INTERNAL_ERROR);
	};

	NetworkTester.prototype.onIceCandidate1 = function(event) {
		if (event.candidate && event.candidate.candidate.match("relay")) {
			DoctoRTC.debug(CLASS, "onIceCandidate1", "adding TURN candidate into pc2: " + event.candidate.candidate);
			this.pc2.addIceCandidate(event.candidate);
		}
		else if (! event.candidate && this.pc1) {
			DoctoRTC.debug(CLASS, "onIceCandidate1", "no more ICE candidates");
		}
	};

	NetworkTester.prototype.onIceCandidate2 = function(event) {
		if (event.candidate && event.candidate.candidate.match("relay")) {
			DoctoRTC.debug(CLASS, "onIceCandidate2", "adding TURN candidate into pc1 " + event.candidate.candidate);
			this.pc1.addIceCandidate(event.candidate);
		}
		else if (! event.candidate && this.pc2) {
			DoctoRTC.debug(CLASS, "onIceCandidate2", "no more ICE candidates");
		}
	};

	NetworkTester.prototype.onOpen1 = function() {
		DoctoRTC.debug(CLASS, "onOpen1", "DataChannel 1 connected");

		this.dc1Open = true;

		// If both DataChannels are connected start sending data.
		if (this.dc2Open) {
			// Cancel the connection timer.
			window.clearTimeout(this.connectionTimer);
			this.startTest();
		}
	};

	NetworkTester.prototype.onOpen2 = function() {
		DoctoRTC.debug(CLASS, "onOpen2", "DataChannel 2 connected");

		this.dc2Open = true;

		// If both DataChannels are connected start sending data.
		if (this.dc1Open) {
			// Cancel the connection timer.
			window.clearTimeout(this.connectionTimer);
			this.startTest();
		}
	};

	NetworkTester.prototype.onConnectionTimeout = function() {
		DoctoRTC.error(CLASS, "onConnectionTimeout", "timeout connecting to the TURN server");

		this.close(ERRORS.CONNECTION_TIMEOUT);
	};

	NetworkTester.prototype.close = function(errorCode) {
		DoctoRTC.debug(CLASS, "close");

		try { this.dc1.close(); } catch(error) {}
		try { this.dc2.close(); } catch(error) {}

		try { this.pc1.close(); } catch(error) {}
		try { this.pc2.close(); } catch(error) {}

		this.pc1 = null;
		this.pc2 = null;

		this.packet = null;

		window.clearTimeout(this.connectionTimer);
		window.clearTimeout(this.packetSenderTimer);
		window.clearTimeout(this.testTimer);

		// Call the user's errback if error is given.
		if (errorCode) {
			this.errback(errorCode);
		}
	};

	NetworkTester.prototype.startTest = function() {
		DoctoRTC.debug(CLASS, "startTest");

		var self = this;

		// First send a "start" message from dc2 to dc1.
		this.dc2.send("start");

		// Run again the connection timer to ensure the "start" message from dc2 to
		// dc1 arrives.
		this.connectionTimer = window.setTimeout(function() {
			self.onStartMessageTimeout();
		}, this.connectTimeout * 1000);
	};

	NetworkTester.prototype.onStartMessageTimeout = function() {
		DoctoRTC.error(CLASS, "onStartMessageTimeout", "timeout sending the 'start' message from dc2 to dc1");

		this.close(ERRORS.CONNECTION_TIMEOUT);
	};

	NetworkTester.prototype.onMessage1 = function(event) {
		// dc1 just must receive a "start" message from dc2.
		if (event.data === "start") {
			DoctoRTC.debug(CLASS, "onMessage1", "'start' message received");

			// Cancel the timer.
			window.clearTimeout(this.connectionTimer);

			// Send big data from dc1 to dc2.
			this.sendPackets();
		}
		else {
			DoctoRTC.error(CLASS, "onMessage1", "unexpected message received");
			this.close(ERRORS.INTERNAL_ERROR);
		}
	};

	NetworkTester.prototype.sendPackets = function() {
		DoctoRTC.debug(CLASS, "sendPackets");

		var self = this;

		// Create a 1024 bytes string (iterations must be 7 and packet length 8).
		this.packet = "doctortc";
		var iterations = 7;
		for (var i = 0; i < iterations; i++) {
		  this.packet += this.packet;  // + this.packet;
		}
		this.packetSize = this.packet.length;

		DoctoRTC.debug(CLASS, "sendPackets", "packet length: " + this.packetSize + " bytes");

		this.testBeginTime = new Date();

		// Run the testTimer.
		this.testTimer = window.setTimeout(function() {
			self.onTestTimeout();
		}, this.testTimeout * 1000);

		this.packetSenderTimer = window.setInterval(function() {
			try {
				self.dc1.send(self.packet);
			} catch(error) {
				DoctoRTC.error(CLASS, "sendPackets", "error sending packet " + self.numPacketsSent + ": " + error.message);
				return;
			}
			self.numPacketsSent++;

			DoctoRTC.debug(CLASS, "sendPackets", "sent packet " + self.numPacketsSent + "/" + self.numPackets);
			// DoctoRTC.debug(CLASS, "sendPackets", "send buffer ammount: " + self.dc1.bufferedAmount);

			if (self.numPacketsSent === self.numPackets) {
				DoctoRTC.debug(CLASS, "sendPackets", "all the packets sent");

				window.clearTimeout(self.packetSenderTimer);
			}
		}, 0);
	};

	NetworkTester.prototype.onMessage2 = function(event) {
		// dc2 just must receive packet messages from dc1.
		if (event.data.length === this.packetSize) {
			this.numPacketsReceived++;

			DoctoRTC.debug(CLASS, "onMessage2", "received packet " + this.numPacketsReceived + "/" + this.numPackets);

			if (this.numPacketsReceived === this.numPackets) {
				DoctoRTC.debug(CLASS, "onMessage2", "all the packets received");

				this.testEndTime = new Date();
				this.close();
				this.calculateResult();
			}
		}
		else {
			DoctoRTC.error(CLASS, "onMessage2", "unexpected message received");
			this.close(ERRORS.INTERNAL_ERROR);
		}
	};

	NetworkTester.prototype.onTestTimeout = function() {
		DoctoRTC.error(CLASS, "onTestTimeout", "test timeout");

		this.close(ERRORS.TEST_TIMEOUT);
	};

	NetworkTester.prototype.calculateResult = function() {
		var elapsedTime = this.testEndTime - this.testBeginTime;  // millisesconds
		var packetSize = this.packetSize;  // Bytes
		// Add DTLS header size (23 bytes): TODO
		packetSize += 23;
		// Add SCTP header size (12 Bytes) + SCTP chunk fields (4 Bytes).
		packetSize += 16;
		var totalSize = packetSize * this.numPackets;  // Bytes.
		var kilobits = (totalSize * 8) / 1024;
		var seconds = elapsedTime / 1000;
		// Divide the num of sent kilobits by elapsed seconds, and multiply by two (up & down).
		var bandwidth = window.Math.round( (kilobits / seconds) * 2);  // kbps.

		DoctoRTC.debug(CLASS, "calculateResult", "[sent: " + totalSize + " bytes, received: " + totalSize + " bytes, elapsed: " + elapsedTime + " ms, bandwidth: " + bandwidth + " kbps]");

		// Fire the user's success callback.
		this.callback(bandwidth);
	};

	DoctoRTC.NetworkTester = NetworkTester;
}(DoctoRTC));

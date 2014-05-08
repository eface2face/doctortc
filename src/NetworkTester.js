/**
 * @name  NetworkTester
 * @augments  DoctoRTC
 */
(function(DoctoRTC) {
	var	NetworkTester;
	var	CLASS = "NetworkTester";
	var ERRORS = {
		CONNECTION_TIMEOUT: "CONNECTION TIMEOUT",
		TEST_TIMEOUT: "TEST TIMEOUT",
		INTERNAL_ERROR: "INTERNAL ERROR"
	};
	var C = {
		// The DataChannel.maxRetransmitTime value (milliseconds).
		DATACHANNEL_MAX_RETRANSMIT_TIME: 0,
		// DataChannel connection timeout (milliseconds).
		CONNECT_TIMEOUT: 4000,
		// Interval for retransmitting the START message (milliseconds).
		START_MESSAGE_INTERVAL: 100,
		// Interval for retransmitting the END message (milliseconds).
		END_MESSAGE_INTERVAL: 100,
		// Test maximum duration after connection (milliseconds).
		TEST_TIMEOUT: 8000,
		// Interval for sending test packets (milliseconds).
		SENDING_INTERVAL: 20,
		// Number of rounds in the test.
		NUM_PACKETS: 100,
		// The size of each test packet (bytes).
		PACKET_SIZE: 500
	};
	var SDP_CONSTRAINS = {
		mandatory: {
			// NOTE: We need a fake audio track for Firefox to support DataChannel.
			// See https://bitbucket.org/ibc_aliax/doctortc.js/issue/1/datachannels-in-firefox-require-audio
			OfferToReceiveAudio: true,
			OfferToReceiveVideo: false
		}
	};

	// Constructor.
	NetworkTester = function(turnServer, callback, errback, options) {
		// Callback and errback provided by the user.
		this.callback = callback;
		this.errback = errback;

		options = options || {};

		var self = this;

		// Timer that limits the time while connecting to the TURN server.
		this.connectTimeout = options.connectTimeout || C.CONNECT_TIMEOUT;
		this.connectTimer = null;

		// Timer that limits the time while receiving the START message.
		this.startMessageInterval = C.START_MESSAGE_INTERVAL;
		this.startMessagePeriodicTimer = null;

		// Timer that limits the time while receiving the END message.
		this.endMessageInterval = C.END_MESSAGE_INTERVAL;
		this.endMessagePeriodicTimer = null;

		// Timer that limits the test duration once packets are being sent/received.
		this.testTimeout = options.testTimeout || C.TEST_TIMEOUT;
		this.testTimer = null;

		// Periodic timer for sending packets in each interval.
		this.sendingInterval = C.SENDING_INTERVAL;
		this.sendingPeriodicTimer = null;

		// Number of packets to send during the test.
		this.numPackets = options.numPackets || C.NUM_PACKETS;

		// Size (in bytes) of test packets.
		this.packetSize = options.packetSize || C.PACKET_SIZE;

		// Packet to be sent during the test (first bytes will me modified while sending).
		// NOTE: This is a typed Array of Uint16 elements, so divide its size by 2 in order
		// to get this.packetSize bytes.
		this.packet = new Uint16Array(this.packetSize / 2);

		// An array for holding information about every packet sent.
		this.packetsInfo = new Array(this.numPackets);

		// Number of packets received out of order.
		this.outOfOrderReceivedPackets = 0;

		// Test begin time.
		this.testBeginTime = null;

		// Highest identificator of all the received packets.
		this.highestReceivedPacketId = -1;

		// Flags set to true when DataChannels get connected.
		this.dc1Open = false;
		this.dc2Open = false;

		// Flag set to true when the START message is received.
		this.startMessageReceived = false;

		// Flag set to true when the END message is received.
		this.endMessageReceived = false;

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

		// Optional TURN server for the second PeerConnection.
		var turnServer2 = options.turnServer2 || turnServer;

		// PeerConnection options.
		var pcServers1 = { iceServers: [turnServer] };
		var	pcServers2 = { iceServers: [turnServer2] };

		// PeerConnections.
		this.pc1 = new DoctoRTC.Adaptor.RTCPeerConnection(pcServers1);
		this.pc2 = new DoctoRTC.Adaptor.RTCPeerConnection(pcServers2);

		// PeerConnections' events.
		this.pc1.onicecandidate = function(event) { self.onIceCandidate1(event); };
		this.pc2.onicecandidate = function(event) { self.onIceCandidate2(event); };

		// DataChannel options.
		var dcOptions = {
			ordered: false,
			negotiated: true,
			id: "DoctoRTC.NetworkTester",
			maxRetransmitTime: C.DATACHANNEL_MAX_RETRANSMIT_TIME
		};

		// A DataChannel in each PeerConnection.
		this.dc1 = this.pc1.createDataChannel("Channel 1", dcOptions);
		this.dc2 = this.pc2.createDataChannel("Channel 2", dcOptions);

		// Set "arraybuffer" type.
		this.dc1.binaryType = "arraybuffer";
		this.dc2.binaryType = "arraybuffer";

		// DataChannels' events.
		this.dc1.onopen = function() { self.onOpen1(); };
		this.dc2.onopen = function() { self.onOpen2(); };
		this.dc1.onmessage = function(event) { self.onMessage1(event); };
		this.dc2.onmessage = function(event) { self.onMessage2(event); };

		// Create the SDP offer in pc1.
		this.pc1.createOffer(
			function(desc) { self.onCreateOfferSuccess1(desc); },
			function(error) { self.onCreateOfferError1(error); },
			SDP_CONSTRAINS
		);

		// Start the connection timeout.
		this.connectTimer = window.setTimeout(function() {
			self.onConnectionTimeout();
		}, this.connectTimeout);
	};

	/* Methods. */

	NetworkTester.prototype.close = function(errorCode) {
		DoctoRTC.debug(CLASS, "close");

		try { this.dc1.close(); } catch(error) {}
		try { this.dc2.close(); } catch(error) {}

		try { this.pc1.close(); } catch(error) {}
		try { this.pc2.close(); } catch(error) {}

		this.pc1 = null;
		this.pc2 = null;

		this.packet = null; // TODO

		window.clearTimeout(this.connectTimer);
		window.clearInterval(this.startMessagePeriodicTimer);
		window.clearInterval(this.endMessagePeriodicTimer);
		window.clearTimeout(this.testTimer);
		window.clearInterval(this.sendingPeriodicTimer);

		// Call the user's errback if error is given.
		if (errorCode) {
			this.errback(errorCode);
		}
	};

	NetworkTester.prototype.onCreateOfferSuccess1 = function(desc) {
		DoctoRTC.debug(CLASS, "onCreateOfferSuccess1", "offer:\n\n" + desc.sdp + "\n");

		var self = this;

		this.pc1.setLocalDescription(desc);
		this.pc2.setRemoteDescription(desc);

		// Create the SDP answer in PeerConnection 2.
		this.pc2.createAnswer(
			function(desc) { self.onCreateAnswerSuccess2(desc); },
			function(error) { self.onCreateAnswerError2(error); },
			SDP_CONSTRAINS
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

		// If both DataChannels are connected send the START message.
		if (this.dc2Open) {
			window.clearTimeout(this.connectTimer);
			this.sendStartMessage();
		}
	};

	NetworkTester.prototype.onOpen2 = function() {
		DoctoRTC.debug(CLASS, "onOpen2", "DataChannel 2 connected");

		this.dc2Open = true;

		// If both DataChannels are connected send the START message.
		if (this.dc1Open) {
			window.clearTimeout(this.connectTimer);
			this.sendStartMessage();
		}
	};

	NetworkTester.prototype.onConnectionTimeout = function() {
		DoctoRTC.error(CLASS, "onConnectionTimeout", "timeout connecting to the TURN server");

		this.close(ERRORS.CONNECTION_TIMEOUT);
	};

	NetworkTester.prototype.sendStartMessage = function() {
		DoctoRTC.debug(CLASS, "sendStartMessage");

		var self = this;

		// Send the START message from dc2 to dc1 (repeat it as it may be lost).
		this.startMessagePeriodicTimer = window.setInterval(function() {
			self.dc2.send("START");
		}, C.START_MESSAGE_INTERVAL);

		// Run again the connection timer to ensure the "start" message from dc2 to
		// dc1 arrives.
		// NOTE: Firefox automatically fires "onopen" event so this is a need.
		this.connectTimer = window.setTimeout(function() {
			self.onStartMessageTimeout();
		}, this.connectTimeout);
	};

	NetworkTester.prototype.onStartMessageTimeout = function() {
		DoctoRTC.error(CLASS, "onStartMessageTimeout", "timeout sending the START message from dc2 to dc1");

		this.close(ERRORS.CONNECTION_TIMEOUT);
	};

	NetworkTester.prototype.onMessage1 = function(event) {
		// dc1 must just receive the START message from dc2.
		if (event.data === "START") {
			// Ignore retransmissions.
			if (this.startMessageReceived === true) {
				DoctoRTC.debug(CLASS, "onMessage1", "ignoring received START message retransmission");
				return;
			}

			DoctoRTC.debug(CLASS, "onMessage1", "START message received");

			// Set the flag to true.
			this.startMessageReceived = true;

			// Cancel timers.
			window.clearInterval(this.startMessagePeriodicTimer);
			window.clearTimeout(this.connectTimer);

			// Start the test.
			this.startTest();
		}
		else {
			DoctoRTC.error(CLASS, "onMessage1", "unexpected message received");
			this.close(ERRORS.INTERNAL_ERROR);
		}
	};

	NetworkTester.prototype.startTest = function() {
		DoctoRTC.debug(CLASS, "startTest");

		var self = this;

		// Test begins now.
		this.testBeginTime = new Date();

		// Run the testTimer.
		this.testTimer = window.setTimeout(function() {
			self.onTestTimeout();
		}, this.testTimeout);

		// Identificator of the packet being sent.
		var sendingPacketId = 0;

		// Send packets.
		this.sendingPeriodicTimer = window.setInterval(function() {
			// Don't attempt to send  a packet if the sending buffer has data yet.
			if (self.dc1.bufferedAmount !== 0) {
				DoctoRTC.debug(CLASS, "startTest", "sending buffer not empty, waiting");
				return;
			}

			// Set the sendingPacketId in the first byte of the message.
			self.packet[0] = sendingPacketId;

			// If we receive an error while sending then wait and repeat.
			try {
				self.dc1.send(self.packet);
			} catch(error) {
				DoctoRTC.error(CLASS, "startTest", "error sending packet " + sendingPacketId + ": " + error.message);
				return;
			}

			// Message sent. Update the array with packets information.
			self.packetsInfo[sendingPacketId] = {
				sentTime: new Date() - self.testBeginTime,
				recvTime: null,
				elapsedTime: null
			};

			DoctoRTC.debug(CLASS, "startTest", "sent packet " + sendingPacketId + "/" + self.numPackets);

			// Update sendingPacketId.
			sendingPacketId++;

			if (sendingPacketId === self.numPackets) {
				DoctoRTC.debug(CLASS, "startTest", "all the packets sent");

				// Stop the sending timer.
				window.clearTimeout(self.sendingPeriodicTimer);

				// Send the END message.
				self.sendEndMessage();
			}
		}, this.sendingInterval);
	};

	NetworkTester.prototype.sendEndMessage = function() {
		DoctoRTC.debug(CLASS, "sendEndMessage");

		var self = this;

		// Send the START message from dc2 to dc1 (repeat it as it may be lost).
		this.endMessagePeriodicTimer = window.setInterval(function() {
			self.dc1.send("END");
		}, C.END_MESSAGE_INTERVAL);
	};

	NetworkTester.prototype.onMessage2 = function(event) {
		// dc2 must receive packet messages from dc1.
		if (event.data.byteLength === this.packetSize) {
			var packet = new Uint16Array(event.data);
			var receivedPacketId = packet[0];

			DoctoRTC.debug(CLASS, "onMessage2", "received packet " + receivedPacketId);

			// Ignore malformed packets which a identificator bigger than the Array size.
			if (receivedPacketId >= this.packetsInfo.length) {
				DoctoRTC.error(CLASS, "onMessage2", "malformed packet with unknown id " + receivedPacketId);
				this.close(C.INTERNAL_ERROR);
				return;
			}

			// Ignore retransmissions (NOTE: it MUST NOT happen in DataChannels).
			if (this.packetsInfo[receivedPacketId].recvTime) {
				DoctoRTC.warn(CLASS, "onMessage2", "retransmission received (MUST NOT happen in DataChannels!) for packet " + receivedPacketId);
				return;
			}

			// Check if the packet comes out of order.
			if (receivedPacketId > this.highestReceivedPacketId) {
				this.highestReceivedPacketId = receivedPacketId;
			}
			else {
				DoctoRTC.debug(CLASS, "onMessage2", "packet " + receivedPacketId + " received our of order");
				this.outOfOrderReceivedPackets++;
			}

			// Update the array with packets information.
			var packetInfo = this.packetsInfo[receivedPacketId];
			packetInfo.recvTime = new Date() - this.testBeginTime;
			packetInfo.elapsedTime = packetInfo.recvTime - packetInfo.sentTime;
		}
		// And must also receive END messages.
		else if (event.data === "END") {
			// Ignore retransmissions.
			if (this.endMessageReceived === true) {
				DoctoRTC.debug(CLASS, "onMessage2", "ignoring received END message retransmission");
				return;
			}

			DoctoRTC.debug(CLASS, "onMessage2", "END message received");

			// Set the flag to true.
			this.endMessageReceived = true;

			// Cancel timers.
			window.clearInterval(this.endMessagePeriodicTimer);
			window.clearTimeout(this.testTimer);

			// Finish the test and get the results.
			this.endTest();
		}
		else {
			DoctoRTC.error(CLASS, "onMessage2", "unexpected message received");
			this.close(ERRORS.INTERNAL_ERROR);
		}
	};

	NetworkTester.prototype.onTestTimeout = function() {
		DoctoRTC.debug(CLASS, "onTestTimeout", "test timeout");

		this.close(ERRORS.TEST_TIMEOUT);
	};

	NetworkTester.prototype.endTest = function() {
		DoctoRTC.debug(CLASS, "endTest");

		// Fill the statistics Object.
		var statistics = {};

		// Test duration.
		statistics.testDuration = new Date() - this.testBeginTime;

		// Packet size.
		statistics.packetSize = this.packetSize;

		// Number of packets sent.
		statistics.packetsSent = this.numPackets;

		// Number of packets received out of order.
		statistics.outOfOrder = this.outOfOrderReceivedPackets;

		// Packet loss and average delay.
		var packetLoss = 0;
		// var avgDelay = 0;  // TODO
		for(var i = this.packetsInfo.length - 1; i >= 0; i--) {
			if (! this.packetsInfo[i].recvTime) {
				packetLoss++;
			}
		}
		statistics.packetLoss = packetLoss;

		// Fire the user's success callback.
	 	this.callback(this.packetsInfo, statistics);
	};

	DoctoRTC.NetworkTester = NetworkTester;
}(DoctoRTC));

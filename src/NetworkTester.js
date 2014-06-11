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
		// Test maximum duration after connection (milliseconds).
		TEST_TIMEOUT: 8000,
		// Interval for retransmitting the START message (milliseconds).
		START_MESSAGE_INTERVAL: 100,
		// Interval for sending test packets (milliseconds).
		SENDING_INTERVAL: 20,
		// Interval for retransmitting the END message (milliseconds).
		END_MESSAGE_INTERVAL: 100,
		// Number of packets to sent.
		NUM_PACKETS: 100,
		// The size of each test packet (bytes).
		PACKET_SIZE: 500,
		// Number of pre-test packets to send before starting the real test.
		NUM_PRE_TEST_PACKETS: 75
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

		// Timer that limits the test duration once packets are being sent/received.
		this.testTimeout = options.testTimeout || C.TEST_TIMEOUT;
		this.testTimer = null;

		// Timer that limits the time while receiving the START message.
		this.startMessageInterval = C.START_MESSAGE_INTERVAL;
		this.startMessagePeriodicTimer = null;

		// Interval for sending packets.
		if (options.sendingInterval === 0) {
			this.sendingInterval = 0;
		}
		else {
			this.sendingInterval = options.sendingInterval || C.SENDING_INTERVAL;
		}
		this.sendingTimer = null;

		// Timer for next packet sending (may change for each one if DataChannel.send()
		// blocks). Initially zero not to delay the first packet.
		this.sendingTimeout = 0;

		// Timer that limits the time while receiving the END message.
		this.endMessageInterval = C.END_MESSAGE_INTERVAL;
		this.endMessagePeriodicTimer = null;

		// Optional callback called for each received packet.
		this.onPacketReceived = options.onPacketReceived;

		// Number of packets to send during the test.
		this.numPackets = options.numPackets || C.NUM_PACKETS;

		// Number of pre-test packets to send before starting the real test.
		if (options.numPreTestPackets === 0) {
			this.numPreTestPackets = 0;
		}
		else {
			this.numPreTestPackets = options.numPreTestPackets || C.NUM_PRE_TEST_PACKETS;
		}

		// Size (in bytes) of test packets.
		this.packetSize = options.packetSize || C.PACKET_SIZE;
		// Ensure it is even.
		if (this.packetSize % 2 !== 0) {
			this.packetSize++;
		}

		// Flag set to true when the test has started.
		this.testStarted = false;

		// Packet to be sent during the test (first bytes will me modified while sending).
		// NOTE: This is a typed Array of Int16 elements, so divide its size by 2 in order
		// to get this.packetSize bytes.
		// TODO: Maybe we could here substract the size of SCTP and DTLS headers...
		this.packet = new Int16Array(this.packetSize / 2);

		// An array for holding information about every packet sent.
		this.packetsInfo = new Array(this.numPackets);

		// Number of test packets sent (this is: DC.send() returned).
		this.numPacketsSent = 0;

		// Number of test packets received (note that it may include retransmissions).
		this.numPacketsReceived = 0;

		// Identificator of the packet being sent.
		this.sendingPacketId = 0;

		// Highest identificator of all the received packets.
		this.highestReceivedPacketId = -1;

		// Number of packets received out of order.
		this.outOfOrderReceivedPackets = 0;

		// Test begin time.
		this.testBeginTime = null;

		// Flags set to true when DataChannels get connected.
		this.dc1Open = false;
		this.dc2Open = false;

		// Flag set to true when the test has ended.
		this.testEnded = false;

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
			maxRetransmits: 0,
			negotiated: true,
			id: "DoctoRTC.NetworkTester"
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

		this.packet = null;

		window.clearTimeout(this.connectTimer);
		window.clearTimeout(this.testTimer);
		window.clearTimeout(this.sendingTimer);
		window.clearInterval(this.startMessagePeriodicTimer);
		window.clearInterval(this.endMessagePeriodicTimer);

		// Call the user's errback if error is given.
		if (errorCode) {
			this.errback(errorCode);
		}
	};

	NetworkTester.prototype.onCreateOfferSuccess1 = function(desc) {
		// Remove local ICE candidates automatically added by Firefox.
		desc.sdp = desc.sdp.replace(/^a=candidate.*\r\n/gm, "");

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
		// Remove local ICE candidates automatically added by Firefox.
		desc.sdp = desc.sdp.replace(/^a=candidate.*\r\n/gm, "");

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

		// If both DataChannels are connected send then start the test.
		if (this.dc2Open) {
			// Cancel timer.
			window.clearTimeout(this.connectTimer);

			// Send the pre-test packets.
			this.preTest();
		}
	};

	NetworkTester.prototype.onOpen2 = function() {
		DoctoRTC.debug(CLASS, "onOpen2", "DataChannel 2 connected");

		this.dc2Open = true;

		// If both DataChannels are connected then start the test.
		if (this.dc1Open) {
			// Cancel timer.
			window.clearTimeout(this.connectTimer);

			// Send the pre-test packets.
			this.preTest();
		}
	};

	NetworkTester.prototype.onConnectionTimeout = function() {
		DoctoRTC.error(CLASS, "onConnectionTimeout", "timeout connecting to the TURN server");

		this.close(ERRORS.CONNECTION_TIMEOUT);
	};

	NetworkTester.prototype.onMessage1 = function() {
		// dc1 MUST NOT receive any messages from dc2.
		DoctoRTC.error(CLASS, "onMessage1", "unexpected message received");
		this.close(ERRORS.INTERNAL_ERROR);
	};

	NetworkTester.prototype.preTest = function() {
		DoctoRTC.debug(CLASS, "preTest");

		var self = this;
		var numPacketsSent = 0;

		// Send pre-test packets.
		var preTestPeriodicTimer = window.setInterval(function() {
			if (numPacketsSent === self.numPreTestPackets) {
				DoctoRTC.debug(CLASS, "preTest", "all the pre-test packets sent, sending the START message");
				window.clearInterval(preTestPeriodicTimer);
				self.sendStartMessage();
				return;
			}

			numPacketsSent++;

			// Don't attempt to send  a packet if the sending buffer has data yet.
			if (self.dc1.bufferedAmount !== 0) {
				DoctoRTC.debug(CLASS, "preTest", "sending buffer not empty, waiting");
				return;
			}

			// Set -1 in the first byte of the message.
			self.packet[0] = -1;

			// If we receive an error while sending then ignore it.
			try {
				self.dc1.send(self.packet);
				DoctoRTC.debug(CLASS, "preTest", "pre-test packet " + numPacketsSent + " sent");
			} catch(error) {
				DoctoRTC.error(CLASS, "preTest", "error sending pre-test packet: " + error.message);
				return;
			}
		}, this.sendingInterval);
	};

	NetworkTester.prototype.sendStartMessage = function() {
		DoctoRTC.debug(CLASS, "sendStartMessage");

		var self = this;

		// Send the START message from dc1 to dc2 (repeat it as it may be lost).
		this.startMessagePeriodicTimer = window.setInterval(function() {
			self.dc1.send("START");
		}, C.START_MESSAGE_INTERVAL);

		// Run the testTimer.
		this.testTimer = window.setTimeout(function() {
			self.onTestTimeout();
		}, this.testTimeout);
	};

	NetworkTester.prototype.startTest = function() {
		DoctoRTC.debug(CLASS, "startTest");

		// Test begins now.
		this.testBeginTime = new Date();

		// Send all the packets.
		this.sendTestPackets();
	};

	NetworkTester.prototype.sendTestPackets = function() {
		DoctoRTC.debug(CLASS, "sendTestPackets");

		var self = this;

		this.sendingTimer = window.setTimeout(function() {
			// Calculate how send takes to update next sending interval.
			var sendBeginTime = new Date();

			var rc = self.sendTestPacket();

			var sendTime = new Date() - sendBeginTime;
			if (sendTime > 2) {
				DoctoRTC.warn(CLASS, "sendTestPackets", "DataChannel.send() took " + sendTime + ' ms');
			}

			// Finished?
			if (self.numPacketsSent === self.numPackets) {
				DoctoRTC.debug(CLASS, "sendTestPackets", "all the packets sent");

				// Send the END message.
				self.sendEndMessage();
			}
			// Otherwise re-calculate next packet sending.
			else {
				// If sendTestPacket() returned true we must re-calculate when to send next packet.
				if (rc) {
					self.sendingTimeout = self.sendingInterval - sendTime;
					if (self.sendingTimeout < 2) {
						self.sendingTimeout = 2;
					}
				}
				// If sendTestPacket() returned false then the packet was not sent so try again now.
				else {
					self.sendingTimeout = 2;
				}

				// Continue sending packets.
				self.sendTestPackets();
			}
		}, this.sendingTimeout);
	};

	NetworkTester.prototype.sendTestPacket = function() {
		DoctoRTC.debug(CLASS, "sendTestPacket", "sending packet with id " + this.sendingPacketId);

		// Don't attempt to send a packet if the sending buffer has data yet.
		if (this.dc1.bufferedAmount !== 0) {
			DoctoRTC.warn(CLASS, "sendTestPacket", "sending buffer not empty");
			// Return false so the caller will not wait to send again.
			return false;
		}

		// Set the sendingPacketId in the first byte of the message.
		this.packet[0] = this.sendingPacketId;

		// If we receive an error while sending then return.
		try {
			this.dc1.send(this.packet);
		} catch(error) {
			DoctoRTC.error(CLASS, "sendTestPacket", "error sending packet with id " + this.sendingPacketId + ": " + error.message);
			// Return false so the caller will not wait to send again.
			return false;
		}

		// Message sent. Update the array with packets information.
		this.packetsInfo[this.sendingPacketId] = {
			sentTime: new Date() - this.testBeginTime,
			recvTime: null,
			elapsedTime: null
		};

		DoctoRTC.debug(CLASS, "sendTestPacket", "sent packet with id " + this.sendingPacketId + " (" + (this.sendingPacketId + 1) + "/" + this.numPackets + ")");

		// Update sendingPacketId and numSentPackets.
		this.sendingPacketId++;
		this.numPacketsSent++;

		// Return true so the caller will re-calculate when to send next packet.
		return true;
	};

	NetworkTester.prototype.sendEndMessage = function() {
		DoctoRTC.debug(CLASS, "sendEndMessage");

		var self = this;

		// Send the END message from dc1 to dc2 (repeat it as it may be lost).
		this.endMessagePeriodicTimer = window.setInterval(function() {
			self.dc1.send("END");
		}, C.END_MESSAGE_INTERVAL);
	};

	NetworkTester.prototype.onMessage2 = function(event) {
		// START message received.
		if (event.data === "START") {
			// It may (should) been already received.
			if (this.testStarted) {
				return;
			}

			DoctoRTC.debug(CLASS, "onMessage2", "START message received, start the test");

			window.clearInterval(this.startMessagePeriodicTimer);
			this.testStarted = true;
			this.startTest();
		}

		// END message received.
		else if (event.data === "END") {
			// It may (should) been already ended because last packet was already received.
			if (this.testEnded) {
				return;
			}

			DoctoRTC.debug(CLASS, "onMessage2", "END message received, end the test");

			this.testEnded = true;
			this.close();
			this.endTest();
		}

		// Test packet received.
		else if (event.data.byteLength === this.packetSize) {
			var packet = new Int16Array(event.data);
			var receivedPacketId = packet[0];

			// Ignore pre-test packets.
			if (receivedPacketId === -1) {
				DoctoRTC.debug(CLASS, "onMessage2", "ignoring pre-test received packet");
				return;
			}

			DoctoRTC.debug(CLASS, "onMessage2", "received packet with id " + receivedPacketId);

			// Acount this packet as a new received one (regardless it is a retransmission).
			this.numPacketsReceived++;

			// Ignore malformed packets which an identificator bigger than the Array size.
			if (receivedPacketId >= this.packetsInfo.length) {
				DoctoRTC.error(CLASS, "onMessage2", "malformed packet with unknown id " + receivedPacketId);
				this.close(C.INTERNAL_ERROR);
				return;
			}

			var packetInfo = this.packetsInfo[receivedPacketId];

			// Ignore retransmissions (NOTE: it MUST NOT happen in DataChannels).
			if (packetInfo.recvTime) {
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
			packetInfo.recvTime = new Date() - this.testBeginTime;
			packetInfo.elapsedTime = packetInfo.recvTime - packetInfo.sentTime;

			// Call the user provided callback.
			if (this.onPacketReceived) {
			 	this.onPacketReceived((receivedPacketId + 1), this.numPackets);
			}

			// If this is the latest packet the end the test right now.
			if (receivedPacketId === this.numPackets - 1) {
				// It may been already ended because END arrived before last packet.
				if (this.testEnded) {
					return;
				}

				DoctoRTC.debug(CLASS, "onMessage2", "received packet is the last one, end the test");

				this.testEnded = true;
				this.close();
				this.endTest();
			}
		}

		// Unexpected packet received.
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

		// Test duration (milliseconds).
		statistics.testDuration = (new Date() - this.testBeginTime).toFixed(3);

		// Number of packets sent.
		statistics.packetsSent = this.numPackets;

		// Packet size (Bytes).
		statistics.packetSize = this.packetSize;

		// Packet size (Bytes).
		statistics.sendingInterval = this.sendingInterval;

		// Percentage of packets received out of order.
		statistics.outOfOrder = (this.outOfOrderReceivedPackets / statistics.packetsSent).toFixed(5) * 100;

		// Packet loss and RTT.
		var lostPackets = 0;
		var sumElapsedTimes = 0;

		for(var i = this.packetsInfo.length - 1; i >= 0; i--) {
			var packetInfo = this.packetsInfo[i];

			if (! packetInfo.recvTime) {
				lostPackets++;
			}
			else {
				sumElapsedTimes += ( packetInfo.recvTime - packetInfo.sentTime );
			}
		}
		statistics.packetLoss = (lostPackets / statistics.packetsSent).toFixed(5) * 100;
		statistics.RTT = (sumElapsedTimes / (statistics.packetsSent - lostPackets)).toFixed(3);

		// Bandwidth (kbit/s).
		var bandwidth_kbits = (statistics.packetSize * 8 / 1000) * (statistics.packetsSent - lostPackets);
		// TODO: divide RTT by 2 or not?
		var bandwidth_duration = (statistics.testDuration / 1000) - ((statistics.RTT / 1000) / 2);
		statistics.bandwidth = (bandwidth_kbits / bandwidth_duration).toFixed(2);

		// Optimal test duration (ms).
		statistics.optimalTestDuration = (statistics.packetsSent * statistics.sendingInterval / 1000).toFixed(3);

		// Optimal bandwidth (kbit/s).
		statistics.optimalBandwidth = (((statistics.packetSize * 8 / 1000) * statistics.packetsSent) / statistics.optimalTestDuration).toFixed(2);

		// Fire the user's success callback.
	 	this.callback(statistics, this.packetsInfo);
	};

	DoctoRTC.NetworkTester = NetworkTester;
}(DoctoRTC));

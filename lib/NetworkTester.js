/**
 * Expose the NetworkTester class.
 */
module.exports = NetworkTester;


/**
 * Dependencies.
 */
var debug = require('debug')('doctortc:NetworkTester'),
	debugerror = require('debug')('doctortc:ERROR:NetworkTester'),
	rtcninja = require('rtcninja'),

/**
 * Constants.
 */
	ERRORS = {
		CONNECTION_TIMEOUT: 'connection timeout',
		INTERNAL_ERROR: 'internal error',
		CANCELLED: 'cancelled'
	},
	C = {
		// The DataChannel.maxRetransmitTime value (milliseconds).
		DATACHANNEL_MAX_RETRANSMIT_TIME: 0,
		// DataChannel connection timeout (milliseconds).
		CONNECT_TIMEOUT: 4000,
		// Interval for retransmitting the START message (milliseconds).
		START_MESSAGE_INTERVAL: 100,
		// Interval for sending test packets (milliseconds).
		SENDING_INTERVAL: 10,
		// Interval for retransmitting the END message (milliseconds).
		END_MESSAGE_INTERVAL: 100,
		// Number of packets to sent.
		NUM_PACKETS: 800,
		// The size of each test packet (bytes).
		PACKET_SIZE: 1250,
		// Ignored initial interval for the statistics (in milliseconds).
		IGNORED_INTERVAL: 2000
	},
	SDP_CONSTRAINS = {
		// offerToReceiveAudio: 1,
		// offerToReceiveVideo: 1
	};


debugerror.log = console.warn.bind(console);


function NetworkTester(turnServer, callback, errback, options) {
	this.callback = callback;
	this.errback = errback;

	options = options || {};

	var self = this,
		optimalTestDuration,
		pcConfig,
		dcOptions;

	// Timer that limits the time while connecting to the TURN server.
	this.connectTimeout = options.connectTimeout || C.CONNECT_TIMEOUT;
	this.connectTimer = null;

	// Timer that limits the time while receiving the START message.
	this.startMessageInterval = C.START_MESSAGE_INTERVAL;
	this.startMessagePeriodicTimer = null;

	// Interval for sending packets.
	this.sendingInterval = options.sendingInterval || C.SENDING_INTERVAL;
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

	// Ignored initial interval.
	if (options.ignoredInterval === 0) {
		this.ignoredInterval = 0;
	} else {
		this.ignoredInterval = options.ignoredInterval || C.IGNORED_INTERVAL;
	}

	// Ensure that it is less than the half of optimal test duration!
	optimalTestDuration = this.numPackets * this.sendingInterval;
	if (this.ignoredInterval > optimalTestDuration / 2) {
		throw new Error('doctortc.NetworkTester() | options.ignoredInterval is too high');
	}

	// Size (in bytes) of test packets.
	this.packetSize = options.packetSize || C.PACKET_SIZE;
	// Ensure it is even.
	if (this.packetSize % 2 !== 0) {
		this.packetSize++;
	}

	// Packet to be sent during the test (first bytes will me modified while sending).
	// NOTE: This is a typed Array of Int16 elements, so divide its size by 2 in order
	// to get this.packetSize bytes.
	// TODO: Maybe we could here substract the size of SCTP and DTLS headers...
	this.packet = new Int16Array(this.packetSize / 2);

	// An array for holding information about every packet sent.
	this.packetsInfo = new Array(this.numPackets);

	// Number of test packets sent (this is: DC.send() returned).
	this.numPacketsSent = 0;

	// Number of test packets received.
	this.numPacketsReceived = 0;

	// Hold the size of the pending onging data (bytes).
	this.pendingOngoingSize = 0;

	// MAx size of the pending onging data (bytes).
	this.maxPendingOngoingSize = this.packetSize * 25;

	// Array holding information about buffered or in-transit amount of data at any moment.
	this.pendingOngoingData = [];

	// Identificator of the packet being sent.
	this.sendingPacketId = 0;

	// Highest identificator of all the received packets.
	this.highestReceivedPacketId = -1;

	// Number of packets received out of order.
	this.outOfOrderReceivedPackets = 0;

	// Test begin time.
	this.testBeginTime = null;

	// Time where the initial ignored interval ends (so statistics begin).
	this.validTestBeginTime = null;

	// Flags set to true when DataChannels get connected.
	this.dc1Open = false;
	this.dc2Open = false;

	// Flag set to true when the test has ended.
	this.testEnded = false;

	// PeerConnection config.
	pcConfig = { iceServers: [turnServer] };

	// PeerConnections.
	this.pc1 = new rtcninja.RTCPeerConnection(pcConfig);
	this.pc2 = new rtcninja.RTCPeerConnection(pcConfig);

	// PeerConnections' events.
	this.pc1.onicecandidate = function (event) {
		onIceCandidate1.call(self, event);
	};
	this.pc2.onicecandidate = function (event) {
		onIceCandidate2.call(self, event);
	};

	// DataChannel options.
	dcOptions = {
		ordered: false,
		maxRetransmits: 0,
		negotiated: true,
		id: 'doctortc'
	};

	// A DataChannel in each PeerConnection.
	this.dc1 = this.pc1.createDataChannel('channel 1', dcOptions);
	this.dc2 = this.pc2.createDataChannel('channel 2', dcOptions);

	// Set 'arraybuffer' type.
	this.dc1.binaryType = 'arraybuffer';
	this.dc2.binaryType = 'arraybuffer';

	// DataChannels' events.46
	this.dc1.onopen = function () {
		onOpen1.call(self);
	};
	this.dc2.onopen = function () {
		onOpen2.call(self);
	};
	this.dc1.onmessage = function (event) {
		onMessage1.call(self, event);
	};
	this.dc2.onmessage = function (event) {
		onMessage2.call(self, event);
	};

	// Create the SDP offer in pc1.
	this.pc1.createOffer(
		function (desc) {
			onCreateOfferSuccess1.call(self, desc);
		},
		function (error) {
			onCreateOfferError1.call(self, error);
		},
		SDP_CONSTRAINS
	);

	// Start the connection timeout.
	this.connectTimer = setTimeout(function () {
		onConnectionTimeout.call(self);
	}, this.connectTimeout);
}


/**
 * Private API.
 */


function close(errorCode) {
	debug('close() [errorCode:%s]', errorCode);

	if (this.testEnded) {
		return;
	}
	this.testEnded = true;

	try {
		this.dc1.close();
	} catch (error) {}

	try {
		this.dc2.close();
	} catch (error) {}

	try {
		this.pc1.close();
	} catch (error) {}

	try {
		this.pc2.close();
	} catch (error) {}

	this.pc1 = null;
	this.pc2 = null;

	this.packet = null;

	clearTimeout(this.connectTimer);
	clearTimeout(this.sendingTimer);
	clearInterval(this.startMessagePeriodicTimer);
	clearInterval(this.endMessagePeriodicTimer);

	// Call the user's errback if error is given.
	if (errorCode) {
		this.errback(errorCode);
	}
}


function onCreateOfferSuccess1(desc) {
	// Remove local ICE candidates automatically added by Firefox.
	// TODO: ¿Hace falta? ¿o sirve con iceTransports=relay?
	desc.sdp = desc.sdp.replace(/^a=candidate.*\r\n/gm, '');

	debug('onCreateOfferSuccess1() | [offer:%o]', desc);

	var self = this;

	this.pc1.setLocalDescription(desc);
	this.pc2.setRemoteDescription(desc);

	// Create the SDP answer in PeerConnection 2.
	this.pc2.createAnswer(
		function (desc) {
			onCreateAnswerSuccess2.call(self, desc);
		},
		function (error) {
			onCreateAnswerError2.call(self, error);
		},
		SDP_CONSTRAINS
	);
}


function onCreateOfferError1(error) {
	debugerror('onCreateOfferError1() | [error:%o]', error);

	// Close and fire the user's errback.
	close.call(this, ERRORS.INTERNAL_ERROR);
}



function onCreateAnswerSuccess2(desc) {
	// Remove local ICE candidates automatically added by Firefox.
	// TODO: ¿Hace falta? ¿o sirve con iceTransports=relay?
	desc.sdp = desc.sdp.replace(/^a=candidate.*\r\n/gm, '');

	debug('onCreateAnswerSuccess2() | [answer:%o]', desc);

	this.pc2.setLocalDescription(desc);
	this.pc1.setRemoteDescription(desc);
}


function onCreateAnswerError2(error) {
	debugerror('onCreateAnswerError2() | [error:%o]', error);

	// Close and fire the user's errback.
	close.call(this, ERRORS.INTERNAL_ERROR);
}


function onIceCandidate1(event) {
	if (event.candidate && event.candidate.candidate.match('relay')) {
		debug('onIceCandidate1() | adding TURN candidate into pc2: %s', event.candidate.candidate);
		this.pc2.addIceCandidate(event.candidate);
	}
}


function onIceCandidate2(event) {
	if (event.candidate && event.candidate.candidate.match('relay')) {
		debug('onIceCandidate2() | adding TURN candidate into pc1: %s', event.candidate.candidate);
		this.pc1.addIceCandidate(event.candidate);
	}
}


function onOpen1() {
	debug('onOpen1() | DataChannel 1 connected');

	this.dc1Open = true;

	// If both DataChannels are connected send then start the test.
	if (this.dc2Open) {
		// Cancel timer.
		clearTimeout(this.connectTimer);

		// start the test.
		startTest.call(this);
	}
}


function onOpen2() {
	debug('onOpen2() | DataChannel 2 connected');

	this.dc2Open = true;

	// If both DataChannels are connected send then start the test.
	if (this.dc1Open) {
		// Cancel timer.
		clearTimeout(this.connectTimer);

		// start the test.
		startTest.call(this);
	}
}


function onConnectionTimeout() {
	debugerror('onConnectionTimeout() | timeout connecting to the TURN server');

	close.call(this, ERRORS.CONNECTION_TIMEOUT);
}


function onMessage1() {
	// dc1 MUST NOT receive any messages from dc2.
	debugerror('onMessage1() | unexpected message received');

	close.call(this, ERRORS.INTERNAL_ERROR);
}


function startTest() {
	debug('startTest()');

	// Test begins now.
	this.testBeginTime = new Date();

	// Send all the packets.
	sendTestPackets.call(this);
}


function sendTestPackets() {
	debug('sendTestPackets()');

	var self = this;

	this.sendingTimer = setTimeout(function () {
		// Calculate how send takes to update next sending interval.
		var sendBeginTime = new Date(),
			rc = sendTestPacket.call(self),
			sendTime = new Date() - sendBeginTime;

		if (sendTime > 2) {
			debug('sendTestPackets() | DataChannel.send() took %d ms', sendTime);
		}

		// Finished?
		if (self.numPacketsSent === self.numPackets) {
			debug('sendTestPackets() | all the packets sent');

			// Send the END message.
			sendEndMessage.call(self);

		// Otherwise re-calculate next packet sending.
		} else {
			// If sendTestPacket() returned true we must re-calculate when to send next packet.
			if (rc) {
				self.sendingTimeout = self.sendingInterval - sendTime;
				if (self.sendingTimeout < 2) {
					self.sendingTimeout = 2;
				}
			// If sendTestPacket() returned false then the packet was not sent so try again now.
			} else {
				self.sendingTimeout = 2;
			}

			// Continue sending packets.
			sendTestPackets.call(self);
		}
	}, this.sendingTimeout);
}


function sendTestPacket() {
	debug('sendTestPacket() | sending packet with id %s', this.sendingPacketId);

	var now;

	// Don't attempt to send a packet if the pending ongoing data is too big.
	if (this.pendingOngoingSize > this.maxPendingOngoingSize) {
		debugerror('sendTestPacket() | pending ongoing size (%d bytes) higher than maximum allowed (%d bytes), waiting before sending a new packet', this.pendingOngoingSize, this.maxPendingOngoingSize);
		// Return false so the caller will not wait to send again.
		return false;
	}

	// Don't attempt to send a packet if the sending buffer has data yet.
	if (this.dc1.bufferedAmount !== 0) {
		debug('sendTestPacket() | sending buffer not empty, waiting before sending a new packet');
		// Return false so the caller will not wait to send again.
		return false;
	}

	// Set the sendingPacketId in the first byte of the message.
	this.packet[0] = this.sendingPacketId;

	// If we receive an error while sending then return.
	try {
		this.dc1.send(this.packet);
	} catch (error) {
		debugerror('sendTestPacket() | error sending packet with id %d: %s', this.sendingPacketId, error);
		// Return false so the caller will not wait to send again.
		return false;
	}

	now = new Date() - this.testBeginTime;

	// Message sent. Update the array with packets information.
	this.packetsInfo[this.sendingPacketId] = {
		sentTime: now,
		recvTime: null,
		elapsedTime: null
	};

	debug('sendTestPacket() | sent packet with id %d (%d/%d")', this.sendingPacketId, this.sendingPacketId + 1, this.numPackets);

	// Ignore the packet if it was sent before the initial ignored interval.
	if (now <= this.ignoredInterval) {
		this.packetsInfo[this.sendingPacketId].ignored = true;
	// Otherwise may be we must set the validTestBeginTime.
	} else if (!this.validTestBeginTime) {
		this.validTestBeginTime = new Date();
	}

	// Update sendingPacketId and numSentPackets.
	this.sendingPacketId++;
	this.numPacketsSent++;

	// Update the pendingOngoingData array.
	this.pendingOngoingSize = (this.numPacketsSent - this.numPacketsReceived) * this.packetSize;
	this.pendingOngoingData.push([now, this.pendingOngoingSize]);

	// Return true so the caller will re-calculate when to send next packet.
	return true;
}


function sendEndMessage() {
	debug('sendEndMessage()');

	var self = this;

	// Send the END message from dc1 to dc2 (repeat it as it may be lost).
	this.endMessagePeriodicTimer = setInterval(function () {
		self.dc1.send('END');
	}, C.END_MESSAGE_INTERVAL);
}


function onMessage2(event) {
	var packet,
		receivedPacketId,
		packetInfo,
		now;

	// Test packet received.
	if (event.data.byteLength === this.packetSize) {
		packet = new Int16Array(event.data);
		receivedPacketId = packet[0];

		// Ignore pre-test packets.
		if (receivedPacketId === -1) {
			debug('onMessage2() | ignoring pre-test received packet');
			return;
		}

		debug('onMessage2() | received packet with id %s', receivedPacketId);

		// Ignore malformed packets which an identificator bigger than the Array size.
		if (receivedPacketId >= this.packetsInfo.length) {
			debugerror('onMessage2() | malformed packet with unknown id %s', receivedPacketId);
			close.call(this, C.INTERNAL_ERROR);
			return;
		}

		packetInfo = this.packetsInfo[receivedPacketId];
		now = new Date() - this.testBeginTime;

		// Ignore retransmissions (NOTE: it MUST NOT happen in DataChannels).
		if (packetInfo.recvTime) {
			debug('onMessage2() | retransmission received (MUST NOT happen in DataChannels!) for packet id %s', receivedPacketId);
			return;
		}

		// Acount this packet as a new received one.
		this.numPacketsReceived++;

		// Update the pendingOngoingData array.
		this.pendingOngoingSize = (this.numPacketsSent - this.numPacketsReceived) * this.packetSize;
		this.pendingOngoingData.push([now, this.pendingOngoingSize]);

		// Check if the packet comes out of order.
		// NOTE: Just if it is not an "ignored" packet sent before the initial ignored interval.
		if (receivedPacketId > this.highestReceivedPacketId) {
			this.highestReceivedPacketId = receivedPacketId;
		}	else if (!packetInfo.ignored) {
			debug('onMessage2() | packet %s received our of order', receivedPacketId);
			this.outOfOrderReceivedPackets++;
		}

		// Update the array with packets information.
		packetInfo.recvTime = now;
		packetInfo.elapsedTime = packetInfo.recvTime - packetInfo.sentTime;

		// Call the user provided callback.
		if (this.onPacketReceived) {
			this.onPacketReceived((receivedPacketId + 1), this.numPackets);
		}

		// If this is the last pending packet the end the test right now.
		if (this.numPacketsReceived === this.numPackets) {
			// It may been already ended because END arrived before last packet.
			if (this.testEnded) {
				return;
			}

			debug('onMessage2() | received packet is the last one, end the test');

			this.testEnded = true;
			close.call(this);
			endTest.call(this);
		}

	// END message received.
	} else if (event.data === 'END') {
		// It may (should) been already ended because last packet was already received.
		if (this.testEnded) {
			return;
		}

		debug('onMessage2() | END message received, end the test');

		this.testEnded = true;
		close.call(this);
		endTest.call(this);

	// Unexpected packet received.
	} else {
		debugerror('onMessage2() | unexpected message received');
		close.call(this, ERRORS.INTERNAL_ERROR);
	}
}


function endTest() {
	debug('endTest()');

	// Fill the statistics Object.
	var statistics = {},
		i,
		numPackets,
		lostPackets,
		sumElapsedTimes,
		packetInfo,
		bandwidth_kbits,
		bandwidth_duration;

	// Test duration (milliseconds).
	// NOTE: Ignore the ignored initial interval.
	statistics.testDuration = (new Date() - this.validTestBeginTime).toFixed(3);

	// Ignored interval.
	statistics.ignoredInterval = this.ignoredInterval;

	// Number of packets sent (and not ignored).
	numPackets = 0;
	for (i = 0; i < this.numPackets; i++) {
		if (!this.packetsInfo[i].ignored) {
			numPackets++;
		}
	}
	statistics.numPackets = numPackets;

	// Packet size (Bytes).
	statistics.packetSize = this.packetSize;

	// Sending interval (ms).
	statistics.sendingInterval = this.sendingInterval;

	// Percentage of packets received out of order.
	statistics.outOfOrder = (this.outOfOrderReceivedPackets / statistics.numPackets).toFixed(5) * 100;

	// Packet loss and RTT.
	// NOTE: Don't consider the initial ignored interval.
	lostPackets = 0;
	sumElapsedTimes = 0;

	for (i = 0; i < this.numPackets; i++) {
		packetInfo = this.packetsInfo[i];

		if (packetInfo.ignored) {
			continue;
		}

		if (!packetInfo.recvTime) {
			lostPackets++;
		} else {
			sumElapsedTimes += (packetInfo.recvTime - packetInfo.sentTime);
		}
	}
	statistics.packetLoss = (lostPackets / statistics.numPackets).toFixed(2) * 100;
	statistics.RTT = (sumElapsedTimes / (statistics.numPackets - lostPackets)).toFixed(3);

	// Bandwidth (kbit/s).
	bandwidth_kbits = (statistics.packetSize * 8 / 1000) * (statistics.numPackets - lostPackets);
	bandwidth_duration = (statistics.testDuration / 1000) - ((statistics.RTT / 1000) / 2);
	statistics.bandwidth = (bandwidth_kbits / bandwidth_duration).toFixed(2);

	// Optimal test duration (ms).
	statistics.optimalTestDuration = (statistics.numPackets * statistics.sendingInterval / 1000).toFixed(3);

	// Optimal bandwidth (kbit/s).
	statistics.optimalBandwidth = (((statistics.packetSize * 8 / 1000) * statistics.numPackets) / statistics.optimalTestDuration).toFixed(2);

	// Fire the user's success callback.
	this.callback(statistics, this.packetsInfo, this.pendingOngoingData);
}

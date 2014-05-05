/**
 * @name  Adaptor
 * @augments  DoctoRTC
 */
(function(DoctoRTC) {
	var Adaptor;

	Adaptor = {};

	// getUserMedia
	if (window.navigator.getUserMedia) {
		Adaptor.getUserMedia = window.navigator.getUserMedia.bind(navigator);
	}
	else if (window.navigator.webkitGetUserMedia) {
		Adaptor.getUserMedia = window.navigator.webkitGetUserMedia.bind(navigator);
	}
	else if (window.navigator.mozGetUserMedia) {
		Adaptor.getUserMedia = window.navigator.mozGetUserMedia.bind(navigator);
	}

	// RTCPeerConnection
	if (window.RTCPeerConnection) {
		Adaptor.RTCPeerConnection = window.RTCPeerConnection;
	}
	else if (window.webkitRTCPeerConnection) {
		Adaptor.RTCPeerConnection = window.webkitRTCPeerConnection;
	}
	else if (window.mozRTCPeerConnection) {
		Adaptor.RTCPeerConnection = window.mozRTCPeerConnection;
	}

	// RTCSessionDescription
	if (window.RTCSessionDescription) {
		Adaptor.RTCSessionDescription = window.RTCSessionDescription;
	}
	else if (window.webkitRTCSessionDescription) {
		Adaptor.RTCSessionDescription = window.webkitRTCSessionDescription;
	}
	else if (window.mozRTCSessionDescription) {
		Adaptor.RTCSessionDescription = window.mozRTCSessionDescription;
	}

	// RTCIceCandidate
	if (window.RTCIceCandidate) {
		Adaptor.RTCIceCandidate = window.RTCIceCandidate;
	}
	else if (window.webkitRTCIceCandidate) {
		Adaptor.RTCIceCandidate = window.webkitRTCIceCandidate;
	}
	else if (window.mozRTCIceCandidate) {
		Adaptor.RTCIceCandidate = window.mozRTCIceCandidate;
	}

	// New syntax for getting streams in Chrome M26.
	if (Adaptor.RTCPeerConnection && Adaptor.RTCPeerConnection.prototype) {
		if (! Adaptor.RTCPeerConnection.prototype.getLocalStreams) {
			Adaptor.RTCPeerConnection.prototype.getLocalStreams = function() {
				return this.localStreams;
			};
			Adaptor.RTCPeerConnection.prototype.getRemoteStreams = function() {
				return this.remoteStreams;
			};
		}
	}

	DoctoRTC.Adaptor = Adaptor;
}(DoctoRTC));

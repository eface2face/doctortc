$(document).ready(function() {

	console.log("DoctoRTC version " + DoctoRTC.version);
	console.log("WebRTC supported?: " + DoctoRTC.hasWebRTC());

	DoctoRTC.setVerbose(true);

	DoctoRTC.testNetwork(
		// turnServer
		{
			url: "turn:turn.ef2f.com:3478?transport=udp",
			username: "turn",
			credential: "ef2f"
		},
		// callback
		function(kbps) {
			console.log("detected network speed: " + kbps + " kbps");
		},
		// errback
		function(error) {
			console.error("error: " + error);
		},
		// options
		{
			connectTimeout: 4000,
			testTimeout: 2000,
			turnServer2: {
				url: "turn:turn.ef2f.com:3478?transport=tcp",
				username: "turn",
				credential: "ef2f"
			},
			numPackets: 100
		}
	);

});

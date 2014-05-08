$(document).ready(function() {

	console.log("DoctoRTC version " + DoctoRTC.version);
	console.log("WebRTC supported?: " + DoctoRTC.hasWebRTC());

	var domResultUdpUdp = $("#resultUdpUdp");
	var domResultTcpTcp = $("#resultTcpTcp");
	var domResultUdpTcp = $("#resultUdpTcp");
	var domResultTcpUdp = $("#resultTcpUdp");

	var testUdpUdpDone = false;
	var testTcpTcpDone = false;
	var testUdpTcpDone = false;
	var testTcpUdpDone = false;

	DoctoRTC.setVerbose(true);


	var NUM_PACKETS = 100;
	var justUdpUdp = true;



	function nextTest() {
		if (justUdpUdp && testUdpUdpDone) {
			return;
		}

		if (! testUdpUdpDone)
			testUdpUdp();
		else if (! testTcpTcpDone)
			testTcpTcp();
		else if (! testUdpTcpDone)
			testUdpTcp();
		else if (! testTcpUdpDone)
			testTcpUdp();
	}


	function testUdpUdp() {
		DoctoRTC.testNetwork(
			// turnServer
			{
				url: "turn:turn.ef2f.com:3478?transport=udp",
				username: "turn",
				credential: "ef2f"
			},
			// callback
			function(bandwidth) {
				console.log("UDP->UDP CALLBACK: detected network speed: " + bandwidth + " kbps");
				domResultUdpUdp.text(bandwidth + " kbps");
				testUdpUdpDone = true;
				nextTest();
			},
			// errback
			function(error) {
				console.error("UDP->UDP ERRBACK: " + error);
				domResultUdpUdp.text(error);
				testUdpUdpDone = true;
				nextTest();
			},
			// options
			{
				connectTimeout: 3000,
				testTimeout: 6000,
				numPackets: NUM_PACKETS
			}
		);
	}


	function testTcpTcp() {
		DoctoRTC.testNetwork(
			// turnServer
			{
				url: "turn:turn.ef2f.com:3478?transport=tcp",
				username: "turn",
				credential: "ef2f"
			},
			// callback
			function(bandwidth) {
				console.log("TCP->TCP CALLBACK: detected network speed: " + bandwidth + " kbps");
				domResultTcpTcp.text(bandwidth + " kbps");
				testTcpTcpDone = true;
				nextTest();
			},
			// errback
			function(error) {
				console.error("TCP->TCP ERRBACK: " + error);
				domResultTcpTcp.text(error);
				testTcpTcpDone = true;
				nextTest();
			},
			// options
			{
				connectTimeout: 3000,
				testTimeout: 6000,
				numPackets: NUM_PACKETS
			}
		);
	}


	function testUdpTcp() {
		DoctoRTC.testNetwork(
			// turnServer
			{
				url: "turn:turn.ef2f.com:3478?transport=udp",
				username: "turn",
				credential: "ef2f"
			},
			// callback
			function(bandwidth) {
				console.log("UDP->TCP CALLBACK: detected network speed: " + bandwidth + " kbps");
				domResultUdpTcp.text(bandwidth + " kbps");
				testUdpTcpDone = true;
				nextTest();
			},
			// errback
			function(error) {
				console.error("UDP->TCP ERRBACK: " + error);
				domResultUdpTcp.text(error);
				testUdpTcpDone = true;
				nextTest();
			},
			// options
			{
				connectTimeout: 3000,
				testTimeout: 6000,
				turnServer2: {
					url: "turn:turn.ef2f.com:3478?transport=tcp",
					username: "turn",
					credential: "ef2f"
				},
				numPackets: NUM_PACKETS
			}
		);
	}


	function testTcpUdp() {
		DoctoRTC.testNetwork(
			// turnServer
			{
				url: "turn:turn.ef2f.com:3478?transport=tcp",
				username: "turn",
				credential: "ef2f"
			},
			// callback
			function(bandwidth) {
				console.log("TCP->UDP CALLBACK: detected network speed: " + bandwidth + " kbps");
				domResultTcpUdp.text(bandwidth + " kbps");
				testTcpUdpDone = true;
				nextTest();
			},
			// errback
			function(error) {
				console.error("TCP->UDP ERRBACK: " + error);
				domResultTcpUdp.text(error);
				testTcpUdpDone = true;
				nextTest();
			},
			// options
			{
				connectTimeout: 3000,
				testTimeout: 6000,
				turnServer2: {
					url: "turn:turn.ef2f.com:3478?transport=udp",
					username: "turn",
					credential: "ef2f"
				},
				numPackets: NUM_PACKETS
			}
		);
	}


	nextTest();

});

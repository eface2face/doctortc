# `doctortc` Module API

The top module exported by the library.


## Properties


### `doctortc.debug`

Reference to the [debug](https://github.com/visionmedia/debug) module.


### `doctortc.browser`

String indicating browser model and version.


### `doctortc.errors`

Object containing error constants (useful to check the `error` in the `errback`).

    {
        CONNECTION_TIMEOUT: 'connection timeout',
        TEST_TIMEOUT: 'test timeout',
        INTERNAL_ERROR: 'internal error',
        CANCELED: 'canceled'
    }



## Functions


### `doctortc.hasWebRTC()`

Returns `true` if the browser supports WebRTC.


### `doctortc.test(turnServers, callback, errback, options)`

Checks network connectivity by connecting to a TURN server(s) and performs bandwitdh calculation by sending and receiving packets via WebRTC DataChannels.

Arguments:

* `turnServers`: An Array of [`RTCIceServer`](http://www.w3.org/TR/webrtc/#idl-def-RTCIceServer) Objects.
* `callback`: User provided function that is called upon test success. The function is called with the test results as arguments (see below for more information).
* `errback`: User provided function that is called upon test failure. The function is called with a `error` argument (whose value is one of the following strings) and a `description` argument which extends the cause of the error:
    * `CONNECTION TIMEOUT`: The connection to the TURN server failed due to timeout (note that, as per current WebRTC specs, if the TURN crendentials are wrong the application cannot realize of it so timeout will raise).
    * `INTERNAL_ERROR`: Unknown or unexpected error (may be caused due to the browser's WebRTC stack, issues in the TURN server...).
    * `CANCELED`: The test was canceled while running (the user called `cancel()` on it).
* `options`: An Object with optional extra parameters. Available parameters in this Object are:
    * `connectTimeout`: An integer representing the maximum duration while connecting to the TURN server (in milliseconds). Default value is 4000.
    * `numPackets`: Number of packets to be sent during the test. Default value is 800;
    * `ignoredInterval`: Interval (in milliseconds) to ignore for statistics (starting from 0 ms). This is useful to ignore the "low SCTP start" period, so statistics become more reliable. Default value is 2000 ms.
    * `packetSize`: Size of packets to be sent during the test (in bytes). Default value is 1250 bytes.
    * `sendingInterval`: Interval of packets sending (in ms). Default value is 10 ms.
    * `onPacketReceived`: A callback function that is called for each received valid packet. The function is called with two arguments:
        * `numPacketsReceived`: The number of received packets.
        * `totalPackets`: The number of packets that should be received in total.

The function returns an instance of the [NetworkTester](docs/NetworkTester.md).

#### `callback` argument

The success callback is called with arguments `statistics`, `packetsInfo` and `pendingOngoingData`:

* `statistics`: An Object with statistics about the test:
    * `testDuration`: The duration of the test (in milliseconds).
    * `ignoredInterval`: Ignored initial interval (in milliseconds, see above).
    * `numPackets`: Number of packets sent during the test (by ignoring those sent while in the initial ignored interval).
    * `packetSize`: The size (in bytes) of each packet.
    * `sendingInterval`: Interval of packets sending (in milliseconds).
    * `outOfOrder`: Percentage of packets arriving of order.
    * `packetLoss`: Percentage of lost packets (those that were sent but have not been received).
    * `RTT`: Average elapsed time between a packet is sent and received (in milliseconds).
    * `bandwidth`: Rate of data transferred (in kbit/s).
    * `optimalTestDuration`: The optimal duration of the test (in milliseconds).
    * `optimalBandwidth`: The optimal bandwidth (in kbit/s).
* `packetsInfo`: An Array with the information each packet sent during the test. Each position in the array contains an Object with the following keys:
    * `sentTime`: The time in which this packet was sent. It is a delta time (in milliseconds) since the test started.
    * `recvTime`: The time in which this packet was received (may be `null` if the packet was lost!). It is a delta time (in milliseconds) since the test started.
    * `elapsedTime`: The elapsed time (in milliseconds) between this packet was sent and received.
* `pendingOngoingData`: An Array holding information about buffered or in-transit amount of data at any moment. Each position in the array contains an Object with the following keys:
    * `sentTime`: The time in which this packet was sent. It is a delta time (in milliseconds) since the test started.
    * `pendingData`: The amount of bytes sent minus the amount of bytes received at the time of `sentTime`.

#### Usage example

    doctortc.test(
        // turnServers
        [
            {
                urls: 'turn:turn.domain.com:1234?transport=udp',
                username: 'alice',
                credential: '1234'
            }
        ],
        // callback
        function(statistics, packetsInfo, pendingOngoingData) {
            console.log('test completed');
        },
        // errback
        function(error) {
            console.error('test failed: ' + error);
        },
        // options
        {
            connectTimeout: 5000,
            numPackets: 400,
            packetSize: 1250,
            sendingInterval: 10
        }
    );

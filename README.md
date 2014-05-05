# DoctoRTC.js

A JavaScript utility for checking browser's WebRTC support and performing bandwidth calculation among other features such as network connectivity checks (with the help of a TURN server).


## Author

Iñaki Baz Castillo at eFace2Face, inc. (inaki.baz@eface2face.com)


## License

Copyright © 2014 eFace2Face, inc. ([www.eface2face.com](http://www.eface2face.com)), All Rights Reserved.


## Building

Must have **nodejs** (which provides `npm` command) and **grunt-cli** (which provides `grunt` command) installed.

* Get the source code:
```
git clone https://ibc_aliax@bitbucket.org/ibc_aliax/doctortc.js.git
cd doctortc.js/
```

* Install dependencies:
```
npm install
```

* Build `dist/doctortc-devel.js` library:
```
grunt devel
```

* Build `dist/doctortc-X.Y.Z.js` and `dist/doctortc-X.Y.Z.min.js` libraries:
```
grunt dist
```


## Usage

Include `doctortc-X.Y.Z.min.js` (or any of the resulting files under `dist/`) into your HTML and make use of the following API.


## API


### DoctoRTC.hasWebRTC()

Checks WebRTC support in the current browser.

* @return:  *true* if WebRTC is supported, *false* otherwise.


### DoctoRTC.setVerbose(verbose)

Enables verbose logging (non intended for production sites). By default not set.

* @param `verbose`: `true` for verbose logging, `false` for non verbose logging.


### DoctoRTC.testNetwork(turnServer, callback, errback, options)

Checks network connectivity by connecting to a TURN server and performs bandwitdh calculation by sending and receiving packets via WebRTC DataChannels.

* @param `turnServer`: An Object with the TURN server information. This parameter matches the [`RTCIceServer`](http://www.w3.org/TR/webrtc/#idl-def-RTCIceServer) Object in WebRTC API.
* @param `callback`: User provided function that is called upon test success. The function is called with a single `bandwidth` argument whose value is the measured speed of the connection in kilobits per second (kbps).
* @param: `errback`: User provided function that is called upon test failure. The function is called with a single `error` argument whose value is one of the following strings:
   * `CONNECTION TIMEOUT`: The connection to the TURN server failed due to timeout (note that, as per current WebRTC specs, if the TURN crendentials are wrong the application cannot realize of it so timeout will raise).
   * `TEST_TIMEOUT`: Connection to the TURN server succeeded but the test could not complete in time.
   * `INTERNAL_ERROR`: Unknown or unexpected error (may be caused due to the browser's WebRTC stack, issues in the TURN server...).
* @param `options`: An Object with optional extra parameters. Available parameters in this Object are:
   * `connectTimeout`: An integer representing the maximum duration while connecting to the TURN server (in milliseconds). Default value is 4000.
   * `testTimeout`: An integer representing the maximum duration while sending packets over the DataChannel (in milliseconds). Default value is 8000.
   * `numPackets`: An integer representing the ammount of packets to be sent on the test. Default value is 50.
   * `turnServer2`: Separate TURN server information for the receiver DataChannel. This allows, for example, testing UDP in upstream and TCP in downstream. Default value is null (so main `turnServer` is also used).

#### Usage example

```
DoctoRTC.testNetwork(
    // turnServer
    {
        urls: "turn:turn.domain.com:1234?transport=udp",
        username: "alice",
        credential: "1234"
    },
    // callback
    function(bandwidth) {
        console.log("network bandwidth: " + bandwidth + " kbps");
    },
    // errback
    function(error) {
        console.error("error: " + error);
    },
    // options
    {
        connectTimeout: 2000,
        testTimeout: 4000,
        numPackets: 100,
        turnServer2: {
            urls: "turn:turn.domain.com:1234?transport=tcp",
            username: "alice",
            credential: "1234"
        },
        numPackets: 100
    }
);
```


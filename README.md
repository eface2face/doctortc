# doctortc.js

JavaScript utility for checking browser's WebRTC support and performing bandwidth calculation among other features such as network connectivity checks with the help of a TURN server.


## Installation

[Node.js](http://nodejs.org) must be installed.

Install `gulp-cli` 4.0 globally (which provides the `gulp` command):

    $ npm install -g gulpjs/gulp-cli#4.0

(you can also use the local `gulp` executable located in `node_modules/.bin/gulp`).

Get the source code:

    $ git clone git@git.assembla.com:ef2f-js.doctortc.git doctortc
    $ cd doctortc/

Install dependencies:

    $ npm install


## Usage in Node/browserify

Add the library to the `dependencies` field within the `package.json` file of your Node project:

    "dependencies": {
        "doctortc": "git+ssh://git@git.assembla.com:ef2f-js.doctortc.git#X.Y.Z"
    }


## Debugging

**doctortc.js** includes the Node [debug](https://github.com/visionmedia/debug) module. In order to enable debugging in the browser run `doctortc.debug.enable('doctortc*');` and reload the page. Note that the debugging settings are stored into the browser LocalStorage. To disable it run `doctortc.debug.disable('doctortc*');`.


## Documentation

Read the full [API documentation](docs/index.md) in the *docs* folder.

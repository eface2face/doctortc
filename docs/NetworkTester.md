# `NetworkTester` Class API


## Properties


### `tester.errors`

Object containing error constants (useful to check the `error` in the `errback`).

    {
        CONNECTION_TIMEOUT: 'connection timeout',
        INTERNAL_ERROR: 'internal error',
        CANCELED: 'canceled'
    }


## Methods


### `tester.cancel()`

Cancels the network test execution. If the test was running it will cause the `errback` to be called with error `CANCELED`.

#sans-server

Write code for a server, without the server.

- Make requests that are representative of HTTP requests to a function.
- Get responses that are representative of HTTP responses.
- Accepts connect middleware.
- Easier to test your server code (using direct function calls).
- Faster to test your server code (no HTTP required).
- Can be wrapped by any server.
- Easy to read logging.

## Examples

### Basic Example

This example will always return a 404 status in the response. Without middleware there is nothing to handle the response.

[Find Middleware](https://www.npmjs.com/browse/keyword/connect)

```js
const SansServer = require('sans-server');
const server = SansServer();
server.request(function(response) {
    console.log(response.statusCode); // 404
});
```

### Double-Send Error

If a request is made and for some reason a response is sent twice, the second response will produce an error that can only be detected using the [SansServer Emitter](#sansserver-emitter).

```js
const SansServer = require('sans-server');

// produce the server instance
const server = SansServer({
    middleware:  function(res, res, next) {
        res.send('Done');
        res.send('Done... again?');
    }
});

// catch errors
SansServer.emitter.on('error', function(data) {
    // ... code to report error events ...
});

// make the request (response will be sent twice, causing the error)
server.request();
```

## API

### SansServer ( configuration : Object ) : SansServer

Construct a SansServer instance.

**Parameters**

- *configuration* - The configuration to apply to the sans-server instance. Options:

    - *logs* - Control how request logs are processed. Options:

        - *duration* - Display the during of the request up to that point with each log entry. Defaults to `false`.

        - *grouped* - Group all logs for a single request together. This will prevent logs from being output until the request is fulfilled. Defaults to `true`.

        - *silent* - Silence the request logs. Defaults to `false`.

        - *timeDiff* - Show the time difference between the current log entry and the previous log entry. Defaults to `true`.

        - *timeStamp* - Show the timestamp at which the log entry was received. Defaults to `false`.

        - *verbose* - Some log entries may have detailed information that is useful for debugging but not necessary for regular loggging. You can see the detailed logs by setting this option to `true`. Defaults to `false`.

    - *middleware* - An array of connect middleware functions. Defaults to `[]`.

    - *supportedMethods* - An array of HTTP methods that the server will not return a 405 status code for. Defaults to `['GET', 'HEAD', 'POST', 'PUT', 'DELETE', 'CONNECT', 'OPTIONS', 'TRACE', 'PATCH']`.

    - *timeout* - The number of seconds before a request times out. Defaults to `30`.

**Returns** a SansServer instance.

### #request ( [ request : Object|String ] [, callback: Function ] ) : Promise < response >

**Parameters**

- *request* - An optional string or object that defines the request. If a string is provided then all default options will be assumed and the path will use the passed in string value. If an object is used then these options are available:

    - *body* - Any value to pass in as the body. This does not need to be a string.

    - *headers* - An object with keys and string values that represent the request headers. Defaults to `{}`.

    - *method* - The HTTP method to use. Defaults to `GET`.

    - *path* - The URL path for your request. Do not include protocol, domain name, or query string parameters. Defaults to `''`.

    - *query* - An object with keys and string values that represent the query string parameters. Defaults to `{}`.

- *callback* - An optional function that will be called with the [response object](#response-object).

**Returns** a Promise that is never rejected. The resolved promise will resolve to a [response object](#response-object).

```js
const server = SansServer({
    logs: {
        duration: false,
        grouped: true,
        silent: false,
        timeDiff: true,
        timeStamp: false,
        verbose: false
    },
    middleware: [],
    supportedMethods: ['GET', 'HEAD', 'POST', 'PUT', 'DELETE', 'CONNECT', 'OPTIONS', 'TRACE', 'PATCH'],
    timeout: 30
});

// make request using path only and invoking the callback paradigm
server.request('/foo/bar', function(response) {
    console.log(response);
});

// make request using path only and invoking the promise paradigm
server.request('/foo/bar')
    .then(function(response) {
        console.log(response);
    });

// make a request using an object
const req = {
    body: undefined,
    headers: {},
    method: 'GET',
    path: '/foo/bar',
    query: {}
}
server.request(req).then(function(res) {
    console.log(res);
});
```

### #use ( middleware : Function... ) : undefined

Add middleware to a SansServer instance. This function can take any number of arguments, but each argument must be a middleware function.

**Parameters**

- *middleware* - A connect middleware function.

**Returns** undefined.

**Example**

Define middleware that returns an HTML page if the route is empty.

```js
const server = SansServer();

server.use(function(req, res, next) {
    if (req.path === '/') {
        res.set('Content-Type', 'text/html');
        res.send(200, '<html><body>Hello, World!</body></html>'
    } else {
        next();
    }
});
```

### SansServer.defaults

An object that specifies the defaults to use for each SansServer instance created.

```js
SansServer.defaults = {
    logs: {
        duration: false,
        grouped: true,
        silent: false,
        timeDiff: true,
        timeStamp: false,
        verbose: false
    },
    middleware: [],
    supportedMethods: ['GET', 'HEAD', 'POST', 'PUT', 'DELETE', 'CONNECT', 'OPTIONS', 'TRACE', 'PATCH'],
    timeout: 30
};
```

### SansServer.emitter

A [NodeJS EventEmitter] instance that emits and handles events that are tied to the SansServer. See the [Double-Send Error](#double-send-error) example for one example of it's use.

### SansServer.logger ( name : String ) : Function

Build a logger function that can be used to add to request processing logs.

**Parameters**

- *name* - The name you'd like to give this logger. The name will show in the logs to distinguish the origin of the log entry.

**Returns** a logger function that takes four parameters:

- *request* - The current request object.

- *title* - A title for the event.

- *message* - The message to log.

- *details* - An optional object that provides details for the log entry. The details will only appear if logging mode is set to verbose.

**Example**

Create a middleware function that logs the request number.

```js
const SansServer = require('SansServer');
const log = SansServer.logger('request-counter');
var count = 0;

module.exports = function requestCounter (req, res, next) {
    count++;
    log(req, 'increment', 'Number or requests: ' + count, {
        count: count,
        time: Date.now()
    });
    next();
};
```

## Response Object

TODO
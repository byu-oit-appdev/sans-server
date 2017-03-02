[![npm module downloads](http://img.shields.io/npm/dt/sans-server.svg)](https://www.npmjs.org/package/sans-server)
[![Build status](https://img.shields.io/travis/byu-oit-appdev/sans-server.svg?style=flat)](https://travis-ci.org/byu-oit-appdev/sans-server)

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

**IMPORTANT** This example will always return a 404 status in the response. Without middleware there is nothing to handle the response.

- [Find Connect Middleware](https://www.npmjs.com/browse/keyword/connect)
- [Find Sans-Server Specific Middleware](https://www.npmjs.com/browse/keyword/sans-server-middleware)

```js
const SansServer = require('sans-server');

// create a server instance
const server = SansServer();

// make a request against the server
server.request({ path: '/' }, function(response) {
    console.log(response.statusCode); // 404
});
```

### Can I Get a Router?

Of course you can, but to keep this library as small as possible it has been omitted by default. Try out [sans-server-router](https://www.npmjs.com/package/sans-server-router) or if you're into using Swagger try out [sans-server-swagger](https://www.npmjs.com/package/sans-server-swagger).

### Create Middleware

There is a lot of middleware out there that may already do what you want, but if not it is easy to write your own middleware.

A connect middleware is a function that takes three parameters: 1) the [request object](#request), 2) the [response object](#response), 3) the next function.

Common uses of middleware include:

- Sending a response
- Modifying the request or response objects
- Adding to the response

Middleware is most often used to either send a response or to modify the request or response objects. If the middleware does send a request then you're done, otherwise it must call the `next` function otherwise the request will go unfulfilled and will timeout.

```js
function terminalMiddleware(req, res, next) {
    res.send('OK');     // response sent
}

function modifyingMiddleware(req, res, next) {
    req.body = req.body.toLowerCase();
    next();
}

function addToResponseMiddleware(req, res, next) {
    res.set('X-Served-By', 'Sans-Server');
    next();     // middleware done, but response not sent
}

function errorEncounteredMiddleware(req, res, next) {
    next(Error('Something went wrong');
}
```

### Use Middleware

There are two ways to specify middleware to use:

1. Include it in the configuration when you [create the SansServer instance](#sansserver--configuration--object---sansserver)

    ```js
    const SansServer = require('sans-server');
    const server = SansServer({
        middleware:  function(res, res, next) {
            // do something
            next();
        }
    });
    ```

2. [Add it to an existing SansServer instance](#use--middleware--function---undefined).

    ```js
    const server = SansServer();
    server.use(function(req, res, next) {
        // do something
        next();
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

### Request

Each middleware created receives a response object and a request object. Middleware is the only way to access the request object. The request object has the following properties:

- *body* - The body of the request. This may be a string or a plain object.

- *headers* - An object with the defined headers.

- *id* - A string that uniquely identifies this request.

- *method* - The HTTP method.

- *path* - The path without query string.

- *query* - An object with the defined query string parameters.

- *url* - A string that shows the path plus query string parameters.

```js
function echoMethodMiddleware(req, res, next) {
    res.send('Used method: ' + req.method);
}
```

### Response

Each middleware created receives a response object and a request object. Middleware is the only way to make the Sans-Server do what you want it to. These are the methods available on an instance of the core response object.

### #body ( value : * ) : Response

Set the body value.

**Parameters**

- *value* - The value to set the body to. This can be a string or an object.

**Returns** a [Response object](#response) for chaining.

### #clearCookie ( name : String [, options : Object ] ) : Response

Set a header that will tell the browser to clear the cookie specified.

**Parameters**

- *name* - The name of the cookie to clear.

- *options* - The options applied to the cookie. For example, the `path` and `domain` options for the cookie being cleared must match the existing cookie otherwise the existing cookie will not be cleared. For a full list of options, refer to the [cookie module](https://www.npmjs.com/package/cookie).

**Returns** a [Response object](#response) for chaining.

```js
function myMiddleware(req, res, next) {
    res.clearCookie('foo');
    next();
}
```

### #clearHeader ( name : String ) : Response

Remove a header value.

**Parameters**

- *name* - The name of the header to clear.

**Returns** a [Response object](#response) for chaining.

### #cookie ( name : String, value : String [, options: Object ] ) : Response

Set a header that will tell the browser to store the specified cookie and value.

**Parameters**

- *name* - The name of the cookie to set.

- *value* - The cookie value to set.

- *options* - The options to apply to the cookie. For a full list of options, refer to the [cookie module](https://www.npmjs.com/package/cookie).

**Returns** a [Response object](#response) for chaining.

```js
function myMiddleware(req, res, next) {
    res.cookie('foo', 'bar');
    next();
}
```

### #hook ( hook: Function ) : Response

Add a send hook to the response. When the response is sent, all send hooks will be called. Hooks can make any modifications to the response.

**Parameters**

- *hook* - The function to call.

**Returns** a [Response object](#response) for chaining.

### #redirect ( url: String ) : Response

Tell the browser to redirect to a different URL. Calling this function will cause the response to be sent.

**Parameters**

- *url* - The URL to redirect to.

**Returns** a [Response object](#response) for chaining.

```js
function myMiddleware(req, res, next) {
    res.redirect('http://some-url.com');
    next();
}
```

### #sent

Get whether the response has already been sent. This can be useful because a response cannot be sent twice.

### #send ( [ code : Number, ] [ body: * ] [, headers : Object ] ) : Response

Send the response. A response can only be sent once.

**Parameters**

- *code* - The status code to send with the response. If omitted then it will use the last [set status code](#status--code-number---response) or if no status code has been set will default to `200`.

- *body* - A string, an Object, or an Error to send. If an object then a header `Content-Type: application/json` will automatically be set. If an Error then all headers and cookies will be wiped, the header `Content-Type: text/plain` will be set, the body content will be 'Internal Server Error', and the `error` property will be added to the [response object](#response-object) with the Error provided. If omitted then the body will be an empty string.

- *headers* - An object setting any additional headers.

**Returns** a [Response object](#response) for chaining.

**The below example can be misleading.** You can only send once. The example below is intended to show the variations for sending.

```js
function myMiddleware(req, res, next) {
    res.send();                 // send with data as it stands and empty body
    res.send('OK');             // send with previously set status code and 'OK' in body
    res.send('OK', {});         // send with 'OK' in body, plus headers
    res.send(200, 'OK');        // send with 200 status code and 'OK' in body
    res.send(200, 'OK', {});    // set status code and body and add headers
}
```

### #sendStatus ( code: Number [, includeMessage ] ) : Response

Send a response with the specified status code and the default body message for that status code.

**Parameters**

- *code* - The status code to send.

- *includeMessage* - Whether to set the body to the status code's associated message. If set to true the content type will also be set to plain text. Defaults to `false`.

**Returns** a [Response object](#response) for chaining.

### #state ( ) : Object

Get the current state of the response.

**Returns** an object in the following format: `{ cookies: Object, headers: Object, sent: boolean, statusCode: number }`.

### #status ( code: Number ) : Response

Set the status code without sending the response.

**Parameters**

- *code* - The status code to set.

**Returns** a [Response object](#response) for chaining.

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

    - *supportedMethods* - An array of HTTP methods that the server will not return a 405 status code for. Defaults to `['GET', 'HEAD', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH']`.

    - *timeout* - The number of seconds before a request times out. Defaults to `30`.

**Returns** a SansServer instance.

### #emit ( name : String [, ...arg : * ] ) : undefined

**Parameters**

- *name* - The name of the event being emitted.
- *arg* - An argument to send with the event. Any number of arguments can be send with this function after the *name* parameter.

**Returns** undefined.

**Example**

Emit an event through middleware.

```js
const SansServer = require('sans-server');
const server = SansServer();

server.use(function(res, res, next) {
   this.emit('my-middleware', 'some data');
   next();
});
```

### #log ( title : String, message : String [, details: Object ] ) : undefined

**Parameters**

- *title* - The title of the logged event.
- *message* - A brief description of the event.
- *details* - An optional object that will only show if logging is set to verbose.

**Returns** undefined.

**Example**

Log through middleware.

```js
const SansServer = require('sans-server');
const server = SansServer();

server.use(function(res, res, next) {
   this.log('Something Happened', 'This is a message', { foo: 'bar' });
   next();
});
```

### #request ( [ request : Object|String ] [, callback: Function ] ) : Promise < response >

**Parameters**

- *request* - An optional string or object that defines the request. If a string is provided then all default options will be assumed and the path will use the passed in string value. If an object is used then these options are available:

    - *body* - A string or plain object to pass in as the body. If this is a JSON string and a header specifies `Content-Type: application/json` then the Sans-Server will automatically convert the JSON string into an object.

    - *headers* - An object with keys and string values that represent the request headers. Defaults to `{}`.

    - *method* - The HTTP method to use. Defaults to `GET`.

    - *path* - The URL path for your request. Do not include protocol or domain name. Query string parameters will be moved to the query object. Defaults to `''`.

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
    supportedMethods: ['GET', 'HEAD', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
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

##### Response Object

The response object has the follow structure:

```js
{
    body: '',
    cookies: {},
    error: Error,
    headers: {},
    rawHeaders: '',
    statusCode: 200
}
```

- *body* - A string representation of the data being sent.

- *cookies* - An object with cookie names as properties and a value object representing their data. Specifically the value object has these properties:

    - *options* - The options set for the cookie. Including domain, expiration, etc. These options are passed to the [cookie module](https://www.npmjs.com/package/cookie).

    - *serialized* - A string version of the cookie that includes the cookie value, domain, expiration, etc.

    - *value* - The value of the cookie exactly as it was provided when set.

- *error* - This property will only be set if an uncaught error occurred while fulfilling the request. If this property exists the status code will be overwritten to to `500` and the body will be overwritten to `Internal Server Error`.

- *headers* - An object with header names as properties and a value string as its value. This object does not contain any set cookie values.

- *rawHeaders* - A header string that is already curated and ready to send with an HTTP response.

- *statusCode* - The HTTP status code for the request.

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
    supportedMethods: ['GET', 'HEAD', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    timeout: 30
};
```

### SansServer.emitter

A [NodeJS EventEmitter](https://nodejs.org/api/events.html) instance that emits and handles events that are tied to the SansServer. See the [Double-Send Error](#double-send-error) example for one example of it's use.
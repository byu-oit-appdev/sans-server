# Sans-Server

## Constructor

***SansServer ( configuration : Object ) : SansServer***

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

## config

***config : Object***

Get the configuration that was specified to initialize the sans-server instance, combined with default configuration values that are not overwritten.

## emit

***emit ( name : String [, ...arg : * ] ) : undefined***

Emit an event for this sans-server instance.

**Parameters**

- *name* - The name of the event being emitted.

- *arg* - An argument to send with the event. Any number of arguments can be sent with this function after the *name* parameter.

**Returns** undefined.

**Example**

Emit an event through middleware.

```js
const SansServer = require('sans-server');
const server = SansServer();

server.use(function(res, res, next) {
   this.emit('event-name', 'some data');
   next();
});
```

## log

**log ( type: String, message: String [, details: Object ] ) : undefined**

This function does nothing until a request is being processed. Only middleware can effectively use this function.

Add to the request log. Logs may be grouped by request or having varying information, depending on how the sans-server instance was [configured in the constructor](#constructor).

**Parameters**

- *type* - The type of event.

- *message* - A brief description of the event.

- *details* - An optional object that will only show if logging is set to verbose.

**Returns** undefined.

**Example**

Log through middleware.

```js
const SansServer = require('sans-server');
const server = SansServer();

server.use(function(res, res, next) {
   const event = { foo: 'bar' };
   this.log('event-type', 'The event description.', event);
   next();
});
```

## request

***request ( [ request : Object|String ] [, callback: Function ] ) : Promise < Object > | undefined***

Make a request against the server instance.

```js
const SansServer = require('sans-server');
const server = SansServer();

server.request({ path: '/' }, function(response) {
    // handle response
});
```

**Parameters**

- *request* - An optional string or object that defines the request. If a string is provided then that string will be interpreted as the path and all other properties will use defaults. If an object is used then these options are available:

    - *body* - A string or plain object to pass in as the body. If this is a JSON string and a header specifies `Content-Type: application/json` then the Sans-Server will automatically convert the JSON string into an object. Defaults to `undefined`.

    - *headers* - An object with keys and string values that represent the request headers. Defaults to `{}`.

    - *method* - The HTTP method to use. Defaults to `GET`.

    - *path* - The URL path for your request. Do not include protocol or domain name. Query string parameters will be moved to the query object. Defaults to `''`.

    - *query* - An object with keys and string values that represent the query string parameters. Defaults to `{}`.

- *callback* - An optional function that will be called with an object that represents the [final response](#final-response-object).

**Returns** a Promise that is never rejected. The resolved promise will resolve to an object of this format:

```js
{
    body: String,
    cookies: Object[],
    error: Error,
    headers: Object,
    rawHeaders: String,
    statusCode: Number
}
```

- *body* - The string body of the response.

- *cookies* - An array of objects for each set cookie. Each item in the array has these properties:

    - *name* - The name of the cookie.

    - *options* - An object defining the cookie options.

    - *serialized* - The value and options converted into a cookie string.

    - *value* - The value of the cookie.

- *error* - This property will only be present if the *statusCode* is `500` and an error occurred. It will contain the error that was caught.

- *headers* - An object containing key value pairs for each set header.

- *rawHeaders* - A string that has all of the cookie and headers combined into a string.

- *statusCode* - The numeric status code of the response.



## use

***use ( middleware : Function... ) : undefined***

Add middleware to a SansServer instance. This function can take any number of arguments, but each argument must be a middleware function.

```js
const SansServer = require('sans-server');
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

**Parameters**

- *middleware* - A connect middleware function.

**Returns** undefined.

### SansServer.emitter

A [NodeJS EventEmitter](https://nodejs.org/api/events.html) instance that emits and handles events that are tied to the SansServer. See the [Double-Send Error](#double-send-error) example for one example of it's use.
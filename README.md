<!--
[[npm module downloads](http://img.shields.io/npm/dt/sans-server.svg)](https://www.npmjs.org/package/sans-server)
[[Build status](https://img.shields.io/travis/byu-oit/sans-server.svg?style=flat)](https://travis-ci.org/byu-oit/sans-server)
[[Coverage Status](https://coveralls.io/repos/github/byu-oit-appdev/sans-server/badge.svg?branch=master)](https://coveralls.io/github/byu-oit-appdev/sans-server?branch=master)
-->

#sans-server

Write code for a server, without the server.

- Make requests that are representative of HTTP requests to a function.
- Get responses that are representative of HTTP responses.
- Accepts connect middleware.
- Easier to test your server code (using direct function calls).
- Faster to test your server code (no HTTP required).
- Can be wrapped by any server.
- Easy to read logging.
- Patterned after the [Express](http://expressjs.com) API.

## Example

The sans-server package is a tool for building a [functional](https://en.wikipedia.org/wiki/functional_programming) web server that is independent of networking. As a [functional](https://en.wikipedia.org/wiki/functional_programming) library, requests can be made to it and responses provided by it.

```js
const SansServer = require('sans-server');

// create a server instance
const server = SansServer();

// add middleware to the server
server.use(function(req, res, next) {
    if (req.path === '/') {
        res.send('OK');
    } else {
        next();
    }
});

// make a request against the server
server.request({ path: '/' }, function(response) {
    console.log(response.statusCode);   // 200
    console.log(response.body);         // 'OK'
});

// make a request against the server
server.request({ path: '/foo' }, function(response) {
    console.log(response.body);         // 'Not Found'
    console.log(response.statusCode);   // 404
});

// make a request that returns a promise
server.request({ path: '/' })
    .then(function(response) {
        console.log(response.statusCode);   // 200
        console.log(response.body);         // 'OK'
    });
```

## Table of Contents

# API

- [SansServer Constructor](#sansserver-constructor)
- [Request](#request)
- [Response](#response)

## SansServer `constructor`

Create a Sans Server instance that follows the specified configuration.

**Signature** **<code>SansServer ([ config ]) : SansServer</code>**

**Methods**

- [hook](#sansserverhook) - Add a hook to each request
- [request](#sansserverrequest) - Make a request
- [use](#sansserveruse) - Add a middleware to each request

**Statics**

- [Middleware](#sansservermiddlewarestatic) - A constructor for generating middleware runners.

**Parameters**

| Option | Description | Type | Default |
| --- | --- | --- | --- |
| config | An optional object defining specific behavior for the instance. To see what options are accepted see [Config Options](#config-options). | `Object` | See [Config Options](#config-options) |

###### Config Options

| Option | Description | Type | Default |
| --- | --- | --- | --- |
| logs | A string or an object that specifies how the logs should be output. See [Log Options](#log-options) for details. | `Object.<string,boolean>` `string` | See [Log Options](#log-options) |
| timeout | The number of seconds to wait prior to request timeout. | `number` | `30` |
    
###### Log Options

If a string value is provided then it must either be `'silent'` or `'verbose'` and all other defaults will be used. Otherwise you can use an object to specify all of the options.

| Option | Description | Type | Default |
| --- | --- | --- | --- |
| duration | Whether to output the number of seconds since request start with each log event. | `boolean` | `false` |
| grouped | Whether to group all logs together for a request. When enabled logs will not be output until the request completes. | `boolean` | `true` |
| silent | Whether to silence all log output. | `boolean` | `false` |
| timeDiff | Whether to list the dime difference between two log events. | `boolean` | `true` |
| timestamp | Whether to output the system time with each log. | `boolean` | `false` |
| verbose | Whether to display detail information with each log. | `boolean` | `false` |

**Returns** a [Sans Server](#sansserver) instance.

**Example**

```js
const SansServer = require('sans-server');
const server = SansServer({
    logs: {
        duration: false,
        grouped: true,
        silent: false,
        timeDiff: true,
        timestamp: false,
        verbose: false
    },
    timeout: 30
});
```

## SansServer#hook

Add a hook to each request. For an explanation on hooks see [Hooks and Middleware](#hooks-and-middleware).

**Signature** **<code>SansServer#hook (type, hook [, hook... ]) : undefined</code>**

**Parameters**

| Option | Description | Type | Default |
| --- | --- | --- | --- |
| type | The type of hook to apply the hook function to. For a list of available hooks refer to the [Hook Reference](#). | `function` | |
| hook | A [hook function](#hooks-and-middleware). Naming the function will improve log readability. Any number of hook functions can be defined at once. | `function` | |

**Returns** undefined.

**Example: Single Hook**

```js
const SansServer = require('sans-server');
const server = SansServer();

server.hook('request', function myHook(req, res, next) {
    // run some logic here...
    next();
});
```

**Example: Multiple Hooks**

```js
const SansServer = require('sans-server');
const server = SansServer();

server.hook('before-send', hook1, hook2);

function hook1(req, res, next) {
    // run some logic here...
    next();
}

function hook2(req, res, next) {
    // run some logic here...
    next();
}
```

## SansServer#request

Make a request against the server and get back a [Request](#).

**Signature** **<code>SansServer#request ([ request ,] [ callback ]) : Response</code>**

**Emits** `request` : [Request](#)

**Parameters**

| Option | Description | Type | Default |
| --- | --- | --- | --- |
| request | A request configuration. If a `string` is used then the string is considered to be the path and all other request defaults will be applied. | `string` `object` | See [Request](#) |
| callback | A function to call when the request has been completed. The callback receives two parameters: 1) the error if one occurred, 2) the [response state](#). | `function` | |

**Returns** a [Request](#) instance.

**Callback Example**

```js
const SansServer = require('sans-server');
const server = SansServer();

server.request('/get/some/path', function(err, state) {
    if (err) {
        console.error(err.stack);
    } else {
        console.log(state.body);        // the response body
        console.log(state.cookies);     // an object with the set cookies
        console.log(state.headers);     // an object with the set headers
        console.log(state.rawHeaders);  // an array of all headers and cookies serialized
        console.log(state.statusCode);  // the response status code
    }
});
```

**Promise Example**

```js
const SansServer = require('sans-server');
const server = SansServer();

server.request('/get/some/path')
    .then(function(state) {
        console.log(state.body);        // the response body
        console.log(state.cookies);     // an object with the set cookies
        console.log(state.headers);     // an object with the set headers
        console.log(state.rawHeaders);  // an array of all headers and cookies serialized
        console.log(state.statusCode);  // the response status code
    })
    .catch(function(err) {
        console.error(err.stack);
    });
```

**Example with Config Object**

```js
const SansServer = require('sans-server');
const server = SansServer();

server.request({ method: 'POST', path: '/some/path', body: {}, headers: { Accept: 'application/json' } })
    .then(function(state) {
        // do something ...
    });
```

**Example of Event Listening**

```js
const SansServer = require('sans-server');
const server = SansServer();

const req = server.request('/some/path')
    .on('log', function(event) { /* ... */ })
    .on('error', function(err) { /* ... */ })
    .on('response', function(res) { /* ... */ })
    .then(function(state) {
        // all hooks and middlewares have run their course
    });
```

## SansServer#use

Add a middleware hook to each request. This works the same as connect middleware and is equivalent to calling [server.hook](#sansserverhook) with `'request'` as the type parameter. For an explanation on hooks see [Hooks and Middleware](#hooks-and-middleware).

**Signature** **<code>SansServer#use (middleware [, middleware... ]) : undefined</code>**

**Parameters**

| Option | Description | Type | Default |
| --- | --- | --- | --- |
| middleware | A [middleware function](#hooks-and-middleware). Naming the function will improve log readability. Any number of middleware functions can be defined at once. | `function` | |

**Returns** undefined.

**Example: Single Middleware**

```js
const SansServer = require('sans-server');
const server = SansServer();

server.use(function myMiddleware(req, res, next) {
    // run some logic here...
    next();
});
```

**Example: Multiple Middleware**

```js
const SansServer = require('sans-server');
const server = SansServer();

server.use(first, second);

function first(req, res, next) {
    // run some logic here...
    next();
}

function second(req, res, next) {
    // run some logic here...
    next();
}
```

## Request `constructor`

This constructor is invoked when calling [SansServer#request](#sansserverrequest) and an instance of this constructor is returned by that function.

**Extends** `EventEmitter` `Promise`

**Methods**

- [catch](#requestcatch) - Add a rejection handler to the request promise.
- [log](#requestlog) - Produce a request log event.
- [then](#requestthen) - Assign a callback for the resolved promise. 

**Properties**

- [body](#requestbody) - Get or set the request body.
- [headers](#requestheaders) - Get or set the request headers. 
- [id](#requestid) - Get the unique request ID. 
- [method](#requestmethod) - Get or set the request method. 
- [path](#requestpath) - Get or set the request path. 
- [query](#requestquery) - Get or set the request query parameters.
- [res](#requestres) - Get the [Response](#response) instance tied to this request.
- [url](#url) - Get the request URL, a combination of the path and query string parameters.

**Emits**

- [log](#) 
- [send](#)

**Hooks**

- [request](#) - Runs when the request is initialized.
- [response](#) - Runs in reverse when the request has a response ready.

## Request#catch

Add a rejection handler to the request promise.

**Signature** **<code>Request#catch ( onRejected ) : undefined</code>**

**Parameters**

| Option | Description | Type | Default |
| --- | --- | --- | --- |
| onRejected | The function to call in case of promise rejection. | `function` | |

**Returns** a Promise.

## Request#log

Produce a log event while processing a request.

**Signature** **<code>Request#log ([ type, ] message [, details ]) : undefined</code>**

**Emits** `log` : [Log Event](#)

**Parameters**

| Option | Description | Type | Default |
| --- | --- | --- | --- |
| type | A category that can be defined to help identify grouped log messages. | `string` | `'log'` |
| message | The log message. | `string` `object` | |
| details | A string or object that only displays when logging is set to verbose. | `string` `object` | `{}` |

**Returns** undefined.

**Example**

```js
const SansServer = require('sans-server');
const server = SansServer();

server.use(function myMiddleware(req, res, next) {
    const start = new Date();
    req.log('myMiddleware', 'running', { start: start.toISOString() });
    res.log('myMiddleware', 'still running');
});
```

## Request#then

Add fulfillment or rejection handlers to the request promise.

**Signature** **<code>Request#catch ( onFulfilled ) : undefined</code>**

**Parameters**

| Option | Description | Type | Default |
| --- | --- | --- | --- |
| onFulfilled | The function to call in case of promise resolution. | `function` | |
| onRejected | The function to call in case of promise rejection. | `function` | |

**Returns** a Promise.


# Explanations

## Hooks and Middleware


## Routing

Routing is not built into sans-server so you'll want to use some [routing middleware](https://github.com/byu-oit/sans-server/tree/master/docs/middleware.md#middleware-router).

## Documentation

- [Sans-Server Instance](https://github.com/byu-oit/sans-server/tree/master/docs/sans-server.md) - An instance can be generated with a configuration. Once an instance exists it's easy to specify middleware and to make requests.

- [Middleware](https://github.com/byu-oit/sans-server/tree/master/docs/middleware.md) - The server does almost nothing as is. You need middleware to add functionality.

- [Request Object](https://github.com/byu-oit/sans-server/tree/master/docs/request-object.md) - This object is passed into every middleware function and has information about the request made.

- [Response Object](https://github.com/byu-oit/sans-server/tree/master/docs/response-object.md) - This object is passed into every middleware function and is used to produce the response.
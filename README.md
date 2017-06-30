[![npm module downloads](http://img.shields.io/npm/dt/sans-server.svg)](https://www.npmjs.org/package/sans-server)
[![Build status](https://img.shields.io/travis/byu-oit/sans-server.svg?style=flat)](https://travis-ci.org/byu-oit-appdev/sans-server)
[![Coverage Status](https://coveralls.io/repos/github/byu-oit-appdev/sans-server/badge.svg?branch=master)](https://coveralls.io/github/byu-oit-appdev/sans-server?branch=master)

#sans-server

Write code for a server, without the server.

- Make requests that are representative of HTTP requests to a function.
- Get responses that are representative of HTTP responses.
- Accepts connect middleware.
- Easier to test your server code (using direct function calls).
- Faster to test your server code (no HTTP required).
- Can be wrapped by any server.
- Easy to read logging.

## Example

The sans-server package is a tool for building a [functional](https://en.wikipedia.org/wiki/Functional_programming) web server that is independent of networking. As a [functional](https://en.wikipedia.org/wiki/Functional_programming) library, requests can be made to it and responses provided by it.

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

## Routing

Routing is not built into sans-server so you'll want to use some [routing middleware](https://github.com/byu-oit/sans-server/tree/master/docs/middleware.md#middleware-router).

## Documentation

- [Sans-Server Instance](https://github.com/byu-oit/sans-server/tree/master/docs/sans-server.md) - An instance can be generated with a configuration. Once an instance exists it's easy to specify middleware and to make requests.

- [Middleware](https://github.com/byu-oit/sans-server/tree/master/docs/middleware.md) - The server does almost nothing as is. You need middleware to add functionality.

- [Request Object](https://github.com/byu-oit/sans-server/tree/master/docs/request-object.md) - This object is passed into every middleware function and has information about the request made.

- [Response Object](https://github.com/byu-oit/sans-server/tree/master/docs/response-object.md) - This object is passed into every middleware function and is used to produce the response.
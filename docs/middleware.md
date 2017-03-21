# Middleware

Without middleware the sans-server does nothing, fortunately a few core middleware functions are built in so the sans-server instance won't do nothing, just almost nothing. The core middleware cannot be removed or superseded.

Here is what the core middleware does:

1. Checks that the incoming HTTP method is valid and if not responds to the request with a 405.

2. Checks if there is a Content-Type of `application/json` is set as a request header and a body was provided and if so it attempts to parse the body into a JavaScript object. Failure to parse will respond to the request with a 400.

3. After all other middleware has run if the response has not yet been sent then it will be sent with any information that is known. If nothing is known about how to respond then the response will be a 404.

Any middleware you specify will be executed between steps 2 and 3 above.

## Middleware Execution

- Middleware functions are called in the order they are defined.

- Each middleware receives a [request object](https://github.com/byu-oit-appdev/sans-server/tree/master/docs/request-object.md), a [response-object](https://github.com/byu-oit-appdev/sans-server/tree/master/docs/response-object.md), and a next function as its parameters.

- Middleware can add, remove, or overwrite properties on the [request object](https://github.com/byu-oit-appdev/sans-server/tree/master/docs/request-object.md) and the [response-object](https://github.com/byu-oit-appdev/sans-server/tree/master/docs/response-object.md).

- Middleware can respond to requests.

- Middleware can choose not to respond to requests and instead continue on to the next middleware by calling the `next` function.

```js
const SansServer = require('sans-server');
const server = SansServer();

function myMiddleware(req, res, next) {
   if (req.path === '/') {
       res.send('OK');
   } else {
       next();
   }
}

server.use(myMiddleware);
```

## Middleware Router

The sans-server package does not route on its own, but you can use existing routing if your interested in that very often used bit of functionality.

Two routing modules built specifically for sans-server include:

- [sans-server-router](https://www.npmjs.com/package/sans-server-router) - A router the allows for path variables, running middleware based on routes, and flexibility in path definitions format.

- [sans-server-swagger](https://www.npmjs.com/package/sans-server-swagger) - A middleware that builds routes, validates and deserializes requests, executes controllers, and validates responses based on a swagger definition. Also capable of mocking responses.

## Finding Additional Middleware

- [Find additional sans-server middleware](https://www.npmjs.com/browse/keyword/sans-server).

- Many existing connect middlewares will work with sans-server, so long as it doesn't require the native [NodeJS Incoming Message object](https://nodejs.org/api/http.html#http_class_http_incomingmessage). If you require one of those middlewares then you'll need to set up a [Request Translation Layer](#).

- If you create a san-server specific middleware and publish it to [npm](https://www.npmjs.com) then be sure to give it a `sans-server` keyword so that it's easily searchable.

## Middleware Errors

If running your middleware causes an Error to be thrown then sans-server will automatically take care of the error. The request will receive a 500 response and if logging is turned on you will see details about what caused the error. There are three ways to produce this response:

1. Don't catch the error.

    ```js
    function myMiddleware(req, res, next) {
        throw Error("Don't run this middleware, it throws an error.");
    }
    ```

2. Call the next function with the error.

    ```js
    function myMiddleware(req, res, next) {
        next(Error("Don't run this middleware, it throws an error."));
    }
    ```

3. Send the response with the error.

    ```js
    function myMiddleware(req, res, next) {
        res.send(Error("Don't run this middleware, it throws an error."));
    }
    ```


## Double-Send Error

If a request is made and a response is sent after having already been sent then:

1. The first response sent will still be the only one that the response gets back.

2. The second response will generate an error log message.

3. The second response will fire an event that can be detected using the [SansServer Emitter](https://github.com/byu-oit-appdev/sans-server/tree/master/docs/sans-server-statics.md#emitter).

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

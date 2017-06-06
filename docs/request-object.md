# Request Object

A request object is produced whenever a request is made against the server. Every [middleware](https://github.com/byu-oit/sans-server/tree/master/docs/middleware.md) will receive this object as its first parameter.

```js
const SansServer = require('sans-server');
const server = SansServer();

server.use(function(req, res, next) {           // <-- req is the request object
    // do something
});

const config = { method: 'GET', path: '/' };    // <-- config is used to generate the request object
const promise = server.request(config)
```

### Request Object Structure

When the request object is created it has the following properties:

- *body* - The body of the request. This may be a string or a plain object. If an object then the `content-type` header should be used to determine if the body is [form input](./sans-server.md#form-body-format) or JSON input.

- *headers* - An object with the defined headers. Following the [NodeJS http convention](https://nodejs.org/api/http.html#http_message_headers), the header casing is automatically converted to lowercase. For example `Content-Type` is converted to `content-type`.

- *id* - A string that uniquely identifies this request.

- *method* - The HTTP method.

- *path* - The path without query string.

- *query* - An object with the defined query string parameters. Property values can be either a string or an array of strings.

- *url* - A string that shows the path plus query string parameters.

Additionally the request object inherits some properties from it's prototype:

- *promise* - A promise object that will be resolved or rejected once the response is ready.

- *reject* - A method that can be called to reject the request without a [response object](https://github.com/byu-oit/sans-server/tree/master/docs/response-object.md), bypassing the mechanisms that produce a [standard sans-server response](https://github.com/byu-oit/sans-server/tree/master/docs/sans-server.md#request).

- *resolve* - A method that can be called to resolve the request without a [response object](https://github.com/byu-oit/sans-server/tree/master/docs/response-object.md), bypassing the mechanisms that produce a [standard sans-server response](https://github.com/byu-oit/sans-server/tree/master/docs/sans-server.md#request).
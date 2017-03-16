# Request Object

A request object is produced whenever a request is made against the server. Every [./middleware.md](#) will receive this object as its first parameter.

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

- *_headers* - The headers as received.

- *body* - The body of the request. This may be a string or a plain object.

- *headers* - An object with the defined headers. The header casing is automatically converted to lowercase, for example `Content-Type` is converted to `content-type`. The headers as received can be found in the `_headers` property.

- *id* - A string that uniquely identifies this request.

- *method* - The HTTP method.

- *path* - The path without query string.

- *query* - An object with the defined query string parameters.

- *url* - A string that shows the path plus query string parameters.
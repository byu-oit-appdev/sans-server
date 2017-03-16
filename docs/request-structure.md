# Request Structure

When [making a request against a sans-server instance](https://github.com/byu-oit-appdev/sans-server/docs/sans-server.md#request) it is important to establish a standard so that all middleware built for sans-server knows what to expect.

The [sans-server request method](https://github.com/byu-oit-appdev/sans-server/docs/sans-server.md#request) takes a string or an object for its first parameter. If the parameter is an object then it can have these properties:

- *body* - A string or an object.
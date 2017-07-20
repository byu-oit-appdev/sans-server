# Response Object

A response object is produced whenever a request is made against the server. Every [middleware](https://github.com/byu-oit/sans-server/tree/master/docs/middleware.md) will receive this object as its second parameter.

```js
const SansServer = require('sans-server');
const server = SansServer();

server.use(function(req, res, next) {           // <-- res is the response object
    // do something
});

const promise = server.request({ method: 'GET', path: '/' })
```

## Page Contents

- [Set Response Body](#set-response-body)
- [Clear Cookie](#clear-cookie)
- [Clear Header](#clear-header)
- [Set Cookie](#set-cookie)
- [Send Hook](#send-hook)
- [Redirect](#redirect)
- [Get Sent Status](#get-sent-status)
- [Send a Response](#send-a-response)
- [Send Status Code with Default Message](#send-status-code-with-default-message)
- [Set a Header](#set-a-header)
- [Get Current Response State](#get-current-response-state)
- [Set Status Code](#set-status-code)

## Set Response Body

***body ( value: * ) : Response***

**Parameters:**

- *value* - The value to set the body to. This can be any value.

    ```js
    res.body('Hello');
    ```

    ```js
    res.body({ foo: 'bar' });
    ```

**Returns:** the [response object](#response-object) for method chaining.

## Clear Cookie

***clearCookie ( name: String [, option: Object ] ) : Response***

Set a header that will tell the browser to clear the cookie specified.

**Parameters:**

- *name* - The name of the cookie to clear.

- *options* - The options applied to the cookie. For example, the `path` and `domain` options for the cookie being cleared must match the existing cookie otherwise the existing cookie will not be cleared. For a full list of options, refer to the [cookie module](https://www.npmjs.com/package/cookie).

**Returns** the [response object](#response-object) for method chaining.

## Clear Header

***clearHeader ( name: String ) : Response***

Remove a header value.

**Parameters:**

- *name* - The name of the header to remove.

**Returns** the [response object](#response-object) for method chaining.

## Set Cookie

***cookie ( name: String, value: String [, options: Object ] ) : Response***

Set a header that will tell the browser to store the specified cookie and value.

**Parameters:**

- *name* - The name of the cookie to set.

- *value* - The cookie value to set.

- *options* - The options to apply to the cookie. For a full list of options, refer to the [cookie module](https://www.npmjs.com/package/cookie).

**Returns** the [response object](#response-object) for method chaining.

## Send Hook

***hook ( hook: Function ) : Response***

Add a send hook to the response. When the response is sent, all send hooks will be called. Hooks can make any modifications to the response. Hooks are executed in the reverse order that they were set. The first hook set gets the last say on the response.

**Parameters:**

- *hook* - The function to call.

**Returns** the [response object](#response-object) for method chaining.

## Redirect

***redirect ( url: String ) : Response***

Tell the browser to redirect to a different URL. Calling this function will cause the response to be sent.

**Parameters:**

- *url* - The URL to redirect to.

**Returns** the [response object](#response-object) for method chaining.

## Get Sent Status

***sent : Boolean***

Get whether the response has already been sent.

```js
res.send('OK');
console.log(res.sent);  // true
```

**Returns** a boolean.

## Send a Response

***send ( [ code: Number, ] [ body: * ] [, headers: Object ] ) : Response***

Send the response. A response can only be sent once.

**Parameters:**

- *code* - The status code to send with the response. If omitted then it will use the last set status code or if no status code has been set will default to `200`.

- *body* - A string, an Object, or an Error to send. If an object then a header `Content-Type: application/json` will automatically be set. If an Error then all headers and cookies will be wiped, the header `Content-Type: text/plain` will be set, the body content will be 'Internal Server Error', and the `error` property will be added to the [response object](#response-object) with the Error provided. If omitted then the body will be an empty string.

- *headers* - An object setting any additional headers.

**Returns** the [response object](#response-object) for method chaining.

*Examples*

```js
res.send();                 // send with data as it stands and empty body
```

```js
res.send('OK');             // send with previously set status code and 'OK' in body
```

```js
res.send('OK', {});         // send with 'OK' in body, plus headers
```

```js
res.send(200, 'OK');        // send with 200 status code and 'OK' in body
```

```js
res.send(200, 'OK', {});    // set status code and body and add headers
```

## Send Status Code with Default Message

***sendStatus ( code: Number ) : Response***

Send a response with the specified status code and the default body message for that status code.

**Parameters:**

- *code* - The status code to send.

**Returns** the [response object](#response-object) for method chaining.

## Set a Header

***set ( key: String, value: String ) : Response***

Set a header.

**Parameters:**

- *key* - The header name. Although header names are case-insensitive in most instances, the casing you use here will be preserved.

- *value* - The value to set for the header.

**Returns** the [response object](#response-object) for method chaining.

## Get Current Response State

***state : Object***

Get the current state of the response.

**Returns** an object in the following format:

- *body* - The body as currently set. If the value is not a string it will be converted to one when sent.

- *cookies* - An array of objects with these properties:

    - *name* - The name of the cookie.

    - *options* - An object showing the options set for the cookie.

    - *serialized* - The value plus options serialized into the final cookie format.

    - *value* - The value the cookie was set to.

- *headers* - An object of key value pairs for each header set.

- *sent* - A boolean specifying if the response has already been sent.

- *statusCode* - The current status code.

```js
console.log(res.state); // { body: 'Hello', cookies: [ ... ], ... }
```

## Set Status Code

***status ( code: Number [, includeMessage: Boolean ] ) : Response***

Set the status code without sending the response.

**Parameters:**

- *code* - The status code to set.

- *includeMessage* - Whether to set the body to the status code's associated message. If set to true the content type will also be set to plain text. Defaults to `false`.

**Returns** the [response object](#response-object) for method chaining.

# Statics

The Response constructor has some static properties. This constructor is accessible through a static property on the server.

```js
const Server = require('sans-server');
const Response = Server.Response;
```

## error

***Server.Response.error () : Object***

Get an object that represents an Error response object.
 
**Parameters:** none

**Returns** this object:

```js
{
    body: 'Internal Server Error',
    cookies: [],
    headers: { 'Content-Type': 'text/plain' },
    rawHeaders: 'Content-Type: text/plain',
    statusCode: 500
}
```

## status

***Server.Response.status***

An object map of status codes to status messages.
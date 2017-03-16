/**
 *  @license
 *    Copyright 2016 Brigham Young University
 *
 *    Licensed under the Apache License, Version 2.0 (the "License");
 *    you may not use this file except in compliance with the License.
 *    You may obtain a copy of the License at
 *
 *        http://www.apache.org/licenses/LICENSE-2.0
 *
 *    Unless required by applicable law or agreed to in writing, software
 *    distributed under the License is distributed on an "AS IS" BASIS,
 *    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *    See the License for the specific language governing permissions and
 *    limitations under the License.
 **/
'use strict';
const expect                = require('chai').expect;
const Request               = require('../bin/server/request');
const Response              = require('../bin/server/response');

describe('response', () => {
    let req;

    beforeEach(function() {
        req = Request({});
    });

    it('can clear a cookie', () => {
        const res = Response(req);
        res.clearCookie('foo');
        res.send();
        return req.promise.then(res => {
            expect(res.rawHeaders).to.equal('Set-Cookie: foo=; Expires=Thu, 01 Jan 1970 00:00:00 GMT');
            expect(res.cookies[0].serialized).to.equal('foo=; Expires=Thu, 01 Jan 1970 00:00:00 GMT');
        });
    });

    it('can set a cookie', () => {
        const res = Response(req);
        res.cookie('foo', 'bar');
        res.send();
        return req.promise.then(res => {
            expect(res.rawHeaders).to.equal('Set-Cookie: foo=bar');
            expect(res.cookies[0].serialized).to.equal('foo=bar');
        });
    });

    it('cookie with same name creates second entry', () => {
        const res = Response(req);
        res.cookie('foo', 'bar');
        res.cookie('foo', 'baz');
        res.send();
        return req.promise.then(res => {
            expect(res.rawHeaders).to.equal('Set-Cookie: foo=bar\nSet-Cookie: foo=baz');
        });
    });

    it('can redirect', () => {
        const res = Response(req);
        res.redirect('http://foo.com');
        return req.promise.then(res => {
            expect(res.rawHeaders).to.equal('Location: http://foo.com');
        });
    });

    it('can detect if sent', () => {
        const res = Response(req);
        expect(res.sent).to.equal(false);
        res.send();
        expect(res.sent).to.equal(true);
    });

    it('can send body only', () => {
        const res = Response(req);
        res.send('body');
        return req.promise.then(res => {
            expect(res.statusCode).to.equal(200);
            expect(res.body).to.equal('body');
        });
    });

    it('can send code and body', () => {
        const res = Response(req);
        res.send(100, 'body');
        return req.promise.then(res => {
            expect(res.statusCode).to.equal(100);
            expect(res.body).to.equal('body');
        });
    });

    it('can send body and headers', () => {
        const res = Response(req);
        res.send('body', { foo: 'bar' });
        return req.promise.then(res => {
            expect(res.statusCode).to.equal(200);
            expect(res.body).to.equal('body');
            expect(res.rawHeaders).to.equal('foo: bar');
        });
    });

    it('can send code, body, and headers', () => {
        const res = Response(req);
        res.send(100, 'body', { foo: 'bar' });
        return req.promise.then(res => {
            expect(res.statusCode).to.equal(100);
            expect(res.body).to.equal('body');
            expect(res.rawHeaders).to.equal('foo: bar');
        });
    });

    it('can send error for body', () => {
        const res = Response(req);
        res.send(Error('oops'));
        return req.promise.then(res => {
            expect(res.error).to.be.instanceOf(Error);
            expect(res.statusCode).to.equal(500);
        });
    });

    it('error for body resets headers', () => {
        const res = Response(req);
        res.set('foo', 'bar');
        res.send(Error('oops'));
        return req.promise.then(res => {
            expect(res.headers).to.not.haveOwnProperty('foo');
        });
    });

    it('can send object for body', () => {
        const res = Response(req);
        res.send({ foo: 'bar' });
        return req.promise.then(res => {
            expect(res.body).to.equal(JSON.stringify({ foo: 'bar' }));
            expect(res.headers['Content-Type']).to.equal('application/json');
        });
    });

    it('can use send status', () => {
        const res = Response(req);
        res.sendStatus(404);
        return req.promise.then(res => {
            expect(res.body).to.equal('Not Found');
            expect(res.statusCode).to.equal(404);
        });
    });

    it('can set header', () => {
        const res = Response(req);
        res.set('foo', 'bar');
        res.send();
        return req.promise.then(res => {
            expect(res.rawHeaders).to.equal('foo: bar');
        });
    });

    it('can overwrite header', () => {
        const res = Response(req);
        res.set('foo', 'bar');
        res.set('foo', 'baz');
        res.send();
        return req.promise.then(res => {
            expect(res.rawHeaders).to.equal('foo: baz');
        });
    });

    it('can clear header', () => {
        const res = Response(req);
        res.set('foo', 'bar');
        res.clearHeader('foo');
        res.send();
        return req.promise.then(res => {
            expect(res.headers).not.to.haveOwnProperty('foo');
        });
    });

    it('can set status', () => {
        const res = Response(req);
        res.status(100);
        res.send();
        return req.promise.then(res => {
            expect(res.statusCode).to.equal(100);
        });
    });

    it('can generate generic error response', () => {
        const res = Response.error();
        expect(res.body).to.equal('Internal Server Error');
        expect(res.statusCode).to.equal(500);
    });

    it('can get current state', () => {
        const res = Response(req);
        res.status(100);
        res.set('foo', 'bar');
        const state = res.state;
        expect(state.statusCode).to.equal(100);
        expect(state.headers.foo).to.equal('bar');
    });

    it('calls send hooks prior to completion', () => {
        let hooked = false;
        const res = Response(req);
        res.hook(function(state) {
            hooked = true;
            expect(this).to.equal(res);
            expect(state).to.deep.equal(res.state);
        });
        res.send();
        return req.promise.then(res => {
            expect(hooked).to.be.true;
        });
    });

    it('cannot perform send during hook', () => {
        const res = Response(req);
        res.hook(function(state) {
            res.send('ok');
        });
        res.send();
        return req.promise.then(res => {
            expect(res.error.code).to.equal('ESSENT');
        })
    });

    it('can update body during hook', () => {
        const res = Response(req);
        res.hook(function(state) {
            res.body('ok');
        });
        res.send('fail');
        return req.promise.then(res => {
            expect(res.body).to.equal('ok');
        });
    });

    it('hook can return promise', () => {
        const res = Response(req);
        res.hook(function(state) {
            return Promise.resolve()
                .then(function() {
                    res.body('ok');
                });
        });
        res.send('fail');
        return req.promise.then(res => {
            expect(res.body).to.equal('ok');
        });
    });

    it('hook can use callback', () => {
        const res = Response(req);
        res.hook(function(state, callback) {
            setTimeout(function() {
                res.body('ok');
                callback();
            }, 0);
        });
        res.send('fail');
        return req.promise.then(res => {
            expect(res.body).to.equal('ok');
        });
    });
});
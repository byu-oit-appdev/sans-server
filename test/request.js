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
const expect        = require('chai').expect;
const Request       = require('../bin/server/request');
const SansServer    = require('../bin/server/sans-server');
const util          = require('../bin/util');

process.on('unhandledRejection', err => {
    console.error('Unhandled rejection', Date.now(), err.stack);
});

describe('request', () => {
    let server;

    beforeEach(() => {
        server = util.testServer();
    });

    it('SansServer#request returns Request instance', () => {
        const server = SansServer();
        const req = server.request();
        expect(req).to.be.instanceOf(Request);
    });

    describe('body', () => {

        it('accepts string', () => {
            const server = util.testServer();
            server.use((req, res, next) => {
                expect(req.body).to.equal('abc');
                next();
            });
            return server.request({ body: 'abc' });
        });

        it('copies body object', () => {
            const o = {};
            server.use((req, res, next) => {
                expect(req.body).to.not.equal(o);
                expect(req.body).to.deep.equal(o);
                next();
            });
            return server.request({ body: o });
        });

    });

    describe('headers', () => {

        it('null header ignored', () => {
            server.use((req, res, next) => {
                expect(req.headers).to.deep.equal({});
                next();
            });
            return server.request({ headers: null });
        });

        it('non string header value converted to string', () => {
            server.use((req, res, next) => {
                expect(req.headers).to.deep.equal({ a: '1' });
                next();
            });
            return server.request({ headers: { a: 1 } });
        });

    });

    describe('query', () => {

        it('no query', () => {
            server.use((req, res, next) => {
                expect(req.query).to.deep.equal({});
                expect(req.url).to.equal('');
                res.send();
            });
            return server.request('');
        });

        it('null query', () => {
            server.use((req, res, next) => {
                expect(req.query).to.deep.equal({});
                res.send();
            });
            return server.request({ query: null });
        });

        it('from path', () => {
            server.use((req, res, next) => {
                expect(req.query).to.deep.equal({ a: '1', b: '', c: true, d: '4' });
                expect(req.url).to.equal('?a=1&b=&c&d=4');
                res.send();
            });
            return server.request('?a=1&b=&c&d=4');
        });

        it('from query string', () => {
            server.use((req, res, next) => {
                expect(req.query).to.deep.equal({ a: ['1', '2', '', true], b: '', c: true, d: '4' });
                expect(req.url).to.equal('?a=1&a=2&a=&a&b=&c&d=4');
                res.send();
            });
            return server.request({ query: 'a=1&a=2&a=&a&b=&c&d=4' });
        });

        it('from query object', () => {
            server.use((req, res, next) => {
                expect(req.query).to.deep.equal({ a: ['1', '2', '', true], b: true, c: '', d: '4' });
                expect(req.url).to.equal('?a=1&a=2&a=&a&b&c=&d=4');
                res.send();
            });
            return server.request({ query: { a: [1, '2', '', true], b: true, c: '', d: 4 }});
        });

    });

    it('path not string is ignored', () => {
        server.use((req, res, next) => {
            expect(req.path).to.equal('');
            next();
        });
        return server.request({ path: null });
    });

    describe('middleware', () => {

        it('calls middleware in order', () => {
            let s = '';
            server.use(function a(req, res, next) {
                s += 'a';
                next();
            });
            server.use(function b(req, res, next) {
                s += 'b';
                res.send();
            });
            return server.request().then(() => expect(s).to.equal('ab'));
        });

    });

    describe('hooks', () => {

        it('calls request hooks in order', () => {
            let s = '';
            server.hook('request', function a(req, res, next) {
                s += 'a';
                next();
            });
            server.hook('request', function b(req, res, next) {
                s += 'b';
                res.send();
            });
            return server.request().then(() => expect(s).to.equal('ab'));
        });

        it('calls response hooks in reverse order', () => {
            let s = '';
            server.hook('response', function a(req, res, next) {
                s += 'a';
                next();
            });
            server.hook('response', function b(req, res, next) {
                s += 'b';
                next();
            });
            return server.request().then(() => expect(s).to.equal('ba'));
        });

        it('try to run non-existent hooks produces error with next', () => {
            let err;
            server.use((req, res, next) => {
                req.hook.run('abc', function(error) {
                    err = error;
                    next();
                });
            });
            return server.request()
                .then(() => {
                    expect(err).to.be.instanceof(Error);
                });
        });

        it('try to run non-existent hooks produces error with promise', () => {
            let err;
            server.use((req, res, next) => {
                req.hook.run('abc').then(next, function(error) {
                    err = error;
                    next();
                });
            });
            return server.request()
                .then(() => {
                    expect(err).to.be.instanceof(Error);
                });
        });

        it('run empty hooks resolves', () => {
            const key = server.hook.define('abc');
            server.use((req, res, next) => {
                req.hook.run(key, next);
            });
            return server.request();
        });

    });

    describe('conflicting results', () => {

        it('can ignore error after send', () => {
            server.use((req, res, next) => {
                res.send('ok');
                throw Error('oops');
            });
            return server.request()
                .then(res => {
                    expect(res.statusCode).to.equal(200);
                });
        });

        it('can ignore res-complete after error', () => {
            server.use((req, res, next) => {
                req.emit('error', Error('oops'));
                res.send('ok');
            });
            return server.request()
                .then(res => {
                    expect(res.statusCode).to.equal(500);
                });
        });

    });

});
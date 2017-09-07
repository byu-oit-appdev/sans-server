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
const captureErrors = require('./capture-error');
const expect        = require('chai').expect;
const Request       = require('../bin/server/request');
const SansServer    = require('../bin/server/sans-server');

process.on('unhandledRejection', err => console.error(err.stack));

describe('request', () => {
    let server;

    beforeEach(() => {
        server = new SansServer();
    });

    it('SansServer#request returns Request instance', () => {
        const server = SansServer();
        const req = server.request();
        expect(req).to.be.instanceOf(Request);
    });

    describe('body', () => {

        it('accepts string', () => {
            const err = captureErrors();
            server.use((req, res, next) => {
                expect(req.body).to.equal('abc');
                next();
            });
            return server.request({ body: 'abc' })
                .on('error', err.catch)
                .then(() => err.report());
        });

        it('copies body object', () => {
            const err = captureErrors();
            const o = {};
            server.use((req, res, next) => {
                expect(req.body).to.not.equal(o);
                expect(req.body).to.deep.equal(o);
                next();
            });
            return server.request({ body: o })
                .on('error', err.catch)
                .then(() => err.report());
        });

    });

    describe('headers', () => {

        it('null header ignored', () => {
            const err = captureErrors();
            server.use((req, res, next) => {
                expect(req.headers).to.deep.equal({});
                next();
            });
            return server.request({ headers: null })
                .on('error', err.catch)
                .then(() => err.report());
        });

        it('non string header value converted to string', () => {
            const err = captureErrors();
            server.use((req, res, next) => {
                expect(req.headers).to.deep.equal({ a: '1' });
                next();
            });
            return server.request({ headers: { a: 1 } })
                .on('error', err.catch)
                .then(() => err.report());
        });

    });

    describe('query', () => {

        it('no query', () => {
            const err = captureErrors();
            server.use((req, res, next) => {
                expect(req.query).to.deep.equal({});
                expect(req.url).to.equal('');
                res.send();
            });
            return server.request('')
                .on('error', err.catch)
                .then(() => err.report());
        });

        it('null query', () => {
            const err = captureErrors();
            server.use((req, res, next) => {
                expect(req.query).to.deep.equal({});
                res.send();
            });
            return server.request({ query: null })
                .on('error', err.catch)
                .then(() => err.report());
        });

        it('from path', () => {
            const err = captureErrors();
            server.use((req, res, next) => {
                expect(req.query).to.deep.equal({ a: '1', b: '', c: true, d: '4' });
                expect(req.url).to.equal('?a=1&b=&c&d=4');
                res.send();
            });
            return server.request('?a=1&b=&c&d=4')
                .on('error', err.catch)
                .then(() => err.report());
        });

        it('from query string', () => {
            const err = captureErrors();
            server.use((req, res, next) => {
                expect(req.query).to.deep.equal({ a: ['1', '2', '', true], b: '', c: true, d: '4' });
                expect(req.url).to.equal('?a=1&a=2&a=&a&b=&c&d=4');
                res.send();
            });
            return server.request({ query: 'a=1&a=2&a=&a&b=&c&d=4' })
                .on('error', err.catch)
                .then(() => err.report());
        });

        it('from query object', () => {
            const err = captureErrors();
            server.use((req, res, next) => {
                expect(req.query).to.deep.equal({ a: ['1', '2', '', true], b: true, c: '', d: '4' });
                expect(req.url).to.equal('?a=1&a=2&a=&a&b&c=&d=4');
                res.send();
            });
            return server.request({ query: { a: [1, '2', '', true], b: true, c: '', d: 4 }})
                .on('error', err.catch)
                .then(() => err.report());
        });

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

    });

});
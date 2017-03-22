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
const expect            = require('chai').expect;
const SansServer        = require('../bin/server/sans-server');

describe('san-server', () => {

    describe('paradigms', () => {

        it('promise paradigm resolves', () => {
            const server = SansServer();  // non-silent for code coverage
            const result = server.request();
            expect(result).to.be.instanceof(Promise);
            return result;
        });

        it('promise paradigm context error', () => {
            const server = SansServer();
            return server.request.call(this, 5)
                .then(res => {
                    expect(res.error).to.be.instanceOf(Error);
                    expect(res.error.code).to.equal('ESSCTX');
                });
        });

        it('promise paradigm request error', () => {
            const server = SansServer();
            return server.request({ method: 5 })
                .then(res => {
                    expect(res.error).to.be.instanceOf(Error);
                });
        });

        it('callback paradigm resolves', (done) => {
            const server = SansServer({ logs: { silent: false, grouped: false }}); // non-silent and non-grouped for code coverage
            const result = server.request(function(response) {
                expect(response).to.not.haveOwnProperty('error');
                done();
            });
            expect(result).to.equal(undefined);
        });

        it('callback paradigm rejects', (done) => {
            const server = SansServer();
            server.request(5, function(response) {
                expect(response.error).to.be.instanceof(Error);
                done();
            });
        });

    });

    describe('logger', () => {

        it('exists', () => {
            const server = SansServer();
            server.use(function(req, res, next) {
                expect(this.log).to.be.a('function');
                next();
            });
            return server.request();
        });

        it('distinct per middleware', () => {
            const server = SansServer();
            let first;
            server.use(function(req, res, next) {
                first = this.log;
                next();
            });
            server.use(function(req, res, next) {
                expect(this.log).to.not.equal(first);
                next();
            });
            return server.request();
        });

        it('can silence logging without error', () => {
            const server = SansServer({ logs: { silent: true }});
            let first;
            server.use(function(req, res, next) {
                this.log('foo');
                next();
            });
            return server.request();
        });

        it('can call noop log function', () => {
            const server = SansServer();
            expect(() => server.log('')).not.to.throw(Error);
        });

    });

    describe('methods', () => {

        it('allows GET', () => {
            const server = SansServer();
            return server.request({ method: 'GET'}).then(res => expect(res.statusCode).to.equal(404));
        });

        it('does not allow FOO', () => {
            const server = SansServer();
            return server.request({ method: 'FOO'}).then(res => expect(res.statusCode).to.equal(405));
        });

        it('string defaults to GET', () => {
            const path = '/foo/bar';
            const mw = function(req, res, next) {
                expect(req.method).to.equal('GET');
                expect(req.url).to.equal(path);
                next();
            };
            const server = SansServer({ middleware: [ mw ]});
            return server.request(path);
        });

        it('can skip method checks', () => {
            const server = SansServer({ methodCheck: false});
            return server.request({ method: 'FOO'}).then(res => {
                expect(res.statusCode).to.equal(404)
            });
        });

    });

    describe('middleware', () => {

        it('must be a function', () => {
            const server = SansServer();
            expect(() => server.use('abc')).to.throw(Error);
        });

        it('can throw error', () => {
            const server = SansServer({ middleware: [ function fail(req, res, next) { throw Error('Fail'); } ]});
            return server.request().then(res => expect(res.statusCode).to.equal(500));
        });

        it('can next error', () => {
            const server = SansServer({ middleware: [ function fail(req, res, next) { next(Error('Fail')); } ]});
            return server.request().then(res => expect(res.statusCode).to.equal(500));
        });

        it('can be added after init', () => {
            const server = SansServer();
            server.use(function(req, res, next) {
                res.send('ok');
            });
            return server.request().then(res => expect(res.body).to.equal('ok'));
        });

        it('can throw context error', () => {
            const server = SansServer();
            expect(function() {
                server.use.call({}, function(req, res, next) {
                    res.send('ok');
                });
            }).to.throw(Error);
        });

        it('can get configuration', () => {
            const server = SansServer({ supportedMethods: ['GET'] });
            server.use(function(req, res, next) {
                expect(this.config.supportedMethods).to.deep.equal(['GET']);
                next();
            });
            return server.request();
        });

        it('can emit events to static emitter', done => {
            const server = SansServer();
            SansServer.emitter.on('foo', function() {
                done();
            });
            server.use(function(req, res, next) {
                this.emit('foo', '');
            });
            server.request();
        });

        it('will not run next middleware after send', () => {
            const server = SansServer({ supportedMethods: ['GET'] });
            let ranNext = false;
            server.use(function(req, res, next) {
                res.send('ok');
                next();
            });
            server.use(function(req, res, next) {
                ranNext = true;
                next();
            });
            return server.request()
                .then(res => {
                    expect(ranNext).to.be.false;
                });
        });

    });

    describe('requests', () => {

        it('pulls query from path', () => {
            const mw = function (req, res, next) {
                expect(req.path).to.equal('/foo');
                expect(req.query.abc).to.equal('');
                expect(req.query.def).to.equal('bar');
                next();
            };
            const server = SansServer({ middleware: [ mw ]});
            return server.request('/foo?abc&def=bar');
        });

        it('body is object', () => {
            const request = {
                body: {},
                headers: { 'content-type': 'application/json' },
                method: 'POST'
            };

            const server = SansServer({ middleware: [ function(req, res, next) {
                expect(req.body).to.equal(request.body);
                next();
            }]});
            return server.request(request);
        });

        it('processes request', () => {
            const request = {
                body: 'body',
                headers: { foo: 'bar' },
                method: 'POST',
                path: 'foo',
                query: { q1: 'q1' }
            };

            const mw = function (req, res, next) {
                expect(req).to.not.equal(request);
                expect(req.body).to.equal(request.body);
                expect(req.headers.foo).to.equal(request.headers.foo);
                expect(req.method).to.equal(request.method);
                expect(req.path).to.equal('/' + request.path);
                expect(req.query.q1).to.equal(request.query.q1);
                next();
            };

            const server = SansServer({ middleware: [ mw ]});
            return server.request(request);
        });

        it('can resolve with no data', () => {
            const request = { path: 'foo' };

            const mw = function (req, res, next) {
                req.resolve()
            };

            const server = SansServer({ middleware: [ mw ]});
            return server.request(request)
                .then(res => {
                    expect(res).to.be.undefined;
                });
        });

        it('can reject with error', () => {
            const request = { path: 'foo' };
            const e = Error('Err');

            const mw = function (req, res, next) {
                req.reject(e)
            };

            const server = SansServer({ middleware: [ mw ]});
            return server.request(request)
                .then(res => {
                    expect(res.error.message).to.equal('Err');
                });
        });

    });

    describe('response', () => {

        it('send twice emits error', () => {
            const server = SansServer({ middleware: [ function (req, res, next) { res.send('ok'); res.send('fail'); } ]});
            let hadError = false;

            SansServer.emitter.on('error', function(err) {
                expect(err.code).to.equal('ESSENT');
                hadError = true;
            });

            return server.request().then(res => {
                expect(res.statusCode).to.equal(500);
                expect(hadError).to.equal(true);
            });
        });

        it('can redirect', () => {
            const server = SansServer();
            server.use((req, res, next) => {
                res.redirect('/foo');
            });

            return server.request().then(res => {
                expect(res.statusCode).to.equal(302);
            });
        });

        it('can send unsent', () => {
            const server = SansServer();
            server.use((req, res, next) => {
                res.status(200);
                next();
            });
            return server.request().then(res => {
                expect(res.statusCode).to.equal(200);
            });
        });

    });

    describe('timeout', () => {

        it('can timeout', () => {
            const server = SansServer({
                logs: {
                    duration: true,
                    timeDiff: false,
                    timeStamp: true,
                    verbose: true
                },
                middleware: [ function timeout(req, res, next) { } ],
                timeout: .1
            });
            return server.request().then(res => expect(res.statusCode).to.equal(504));
        });

    });

});
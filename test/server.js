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

describe('server', () => {
    SansServer.defaults.logs.silent = true;

    describe('paradigms', () => {

        it('promise paradigm resolves', () => {
            const server = SansServer({ logs: { silent: false }});  // non-silent for code coverage
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

        it('returns function', () => {
            expect(SansServer.logger('foo')).to.be.a('function');
        });

    });

    describe('methods', () => {

        it('allows GET', () => {
            const server = SansServer();
            return server.request({ method: 'GET'}).then(res => expect(res.statusCode).to.equal(400));
        });

        it('does not allow FOO', () => {
            const server = SansServer();
            return server.request({ method: 'FOO'}).then(res => expect(res.statusCode).to.equal(405));
        });

        it('string defaults to GET', (done) => {
            const path = '/foo/bar';
            const mw = function(req, res, next) {
                expect(req.method).to.equal('GET');
                expect(req.url).to.equal(path);
                done();
            };
            const server = SansServer({ middleware: [ mw ]});
            server.request(path);
        });

    });

    describe('middleware', () => {

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

    });

    describe('requests', () => {

        it('processes request', (done) => {
            const request = {
                body: 'body',
                headers: { foo: 'bar' },
                method: 'GET',
                path: 'foo',
                query: { q1: 'q1' }
            };

            const mw = function (req, res, next) {
                try {
                    expect(req).to.not.equal(request);
                    expect(req.body).to.equal(request.body);
                    expect(req.headers.Foo).to.equal(request.headers.foo);
                    expect(req.method).to.equal(request.method);
                    expect(req.path).to.equal(request.path);
                    expect(req.query.q1).to.equal(request.query.q1);
                    next();
                    done();
                } catch (e) {
                    next();
                    done(e);
                }
            };

            const server = SansServer({ middleware: [ mw ]});
            server.request(request);
        });

    });

    describe('response', () => {

        it('send twice emits error', (done) => {
            const server = SansServer({ middleware: [ function (req, res, next) { res.send('ok'); res.send('fail'); } ]});
            let hadError = false;

            SansServer.emitter.on('error', function(err) {
                expect(err.code).to.equal('ESSENT');
                hadError = true;
            });

            server.request().then(res => {
                expect(res.statusCode).to.equal(200);
                expect(hadError).to.equal(true);
                done();
            });
        });

    });

    describe('timeout', () => {

        it('can timeout', () => {
            const server = SansServer({ middleware: [ function timeout(req, res, next) { } ], timeout: .5 });
            return server.request().then(res => expect(res.statusCode).to.equal(408));
        });

    });

});
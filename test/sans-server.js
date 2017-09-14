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
const Request           = require('../bin/server/request');
const SansServer        = require('../bin/server/sans-server');

describe('san-server', () => {
    let server;

    beforeEach(() => {
        server = SansServer({ rejectable: true });
    });

    describe('paradigms', () => {

        it('promise paradigm resolves', () => {
            return server.request();
        });

        it('promise paradigm invalid method', () => {
            return server.request({ method: 5 })
                .then(res => {
                    expect(res.statusCode).to.equal(404);
                });
        });

        it('callback paradigm resolves', (done) => {
            const server = SansServer({ logs: { silent: false, grouped: false }}); // non-silent and non-grouped for code coverage
            const req = server.request(function(err, res) {
                expect(res.statusCode).to.equal(404);
                done();
            });
            expect(req).to.be.instanceof(Request);
        });

        it('callback paradigm invalid method', (done) => {
            server.request({ method: 5 }, function(err, res) {
                expect(res.statusCode).to.equal(404);
                done();
            });
        });

        it('callback paradigm error', (done) => {
            const error = Error();
            server.use((req, res, next) => {
                throw error;
            });
            server.request({ method: 5 }, function(err, res) {
                expect(err).to.equal(error);
                expect(res.statusCode).to.equal(500);
                done();
            });
        });

    });

    describe('logger', () => {

        it('exists', () => {
            server.use(function(req, res, next) {
                expect(req.log).to.be.a('function');
                next();
            });
            return server.request();
        });

        it('can silence logging without error', () => {
            const server = SansServer({ logs: { silent: true }});
            server.use(function(req, res, next) {
                this.log('foo');
                next();
            });
            return server.request();
        });

        it('can silence with shortcut config', () => {
            expect(() => SansServer({ logs: 'silent'})).not.to.throw(Error);
        });

        it('can verbose with shortcut config', () => {
            expect(() => SansServer({ logs: 'verbose'})).not.to.throw(Error);
        });

        it('cannot use other shortcut config', () => {
            expect(() => SansServer({ logs: 'abc'})).to.throw(Error);
        });

    });

    describe('methods', () => {

        it('allows GET', () => {
            server.use((req, res, next) => {
                expect(req.method).to.equal('GET');
                next();
            });
            return server.request({ method: 'GET'});
        });

        it('does not allow FOO', () => {
            return server.request({ method: 'FOO'})
                .then(res => expect(res.statusCode).to.equal(405));
        });

        it('string defaults to GET', () => {
            server.use((req, res, next) => {
                expect(req.method).to.equal('GET');
                next();
            });
            return server.request();
        });

        it('converted to upper case', () => {
            server.use((req, res, next) => {
                expect(req.method).to.equal('PUT');
                next();
            });
            return server.request({ method: 'put' });
        });

    });

    describe('requests', () => {

        it('pulls query from path', () => {
            server.use(function (req, res, next) {
                expect(req.path).to.equal('/foo');
                expect(req.query.abc).to.equal(true);
                expect(req.query.def).to.equal('bar');
                next();
            });
            return server.request('/foo?abc&def=bar');
        });

        it('body is object', () => {
            const request = {
                body: {},
                headers: { 'content-type': 'application/json' },
                method: 'POST'
            };
            server.use(function(req, res, next) {
                expect(req.body).to.deep.equal(request.body);
                next();
            });
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
            server.use(function (req, res, next) {
                    expect(req).to.not.equal(request);
                    expect(req.body).to.equal(request.body);
                    expect(req.headers.foo).to.equal(request.headers.foo);
                    expect(req.method).to.equal(request.method);
                    expect(req.path).to.equal('/' + request.path);
                    expect(req.query.q1).to.equal(request.query.q1);
                    next();
                });
            return server.request(request);
        });

    });

    describe('hooks', () => {

        it('persistent hook', () => {
            let hooked = 0;
            const hook = function(req, res, next) { hooked++; next(); };
            server.hook('request', hook);
            return server.request()
                .then(res => {
                    expect(hooked).to.equal(1);
                    return server.request();
                })
                .then(res => {
                    expect(hooked).to.equal(2);
                });
        });

        it('invalid persistent hook', () => {
            const hook = null;
            expect(() => server.hook(hook)).to.throw(Error);
        });

        it('persistent hook must be a function', () => {
            expect(() => server.hook('abc', 0, null)).to.throw(Error);
        });

        it('one time hook', () => {
            let persist = 0;
            let once = 0;

            server.hook('request', 0, (req, res, next) => {
                if (persist === 0) {
                    req.hook('response', (req, res, next) => {
                        once++;
                        next();
                    });
                }
                persist++;
                res.send();
            });

            return server.request()
                .then(() => server.request())
                .then(() => {
                    expect(persist).to.equal(2);
                    expect(once).to.equal(1);
                });
        });

        it('invalid one time hook', () => {
            server.use((req, res, next) => {
                req.hook(null);
                next();
            });
            return server.request()
                .catch(err => {
                    console.log('Caught outside', Date.now(), err.message);
                })
                .then(() => {
                    console.log('Here')
                });
                //.then(() => { throw Error('Unexpected resolve') }, err => {});
        });

        it('one time hook must be a function', () => {
            server.use((req, res, next) => {
                req.hook('abc', null);
                next();
            });
            return server.request()
                .then(() => { throw Error('Should not get here'); }, err => {});
        });

        it('hook can throw error', () => {
            const error = Error('oops');
            server.hook('request', function myHook(req, res, next) {
                throw error;
            });
            return server.request()
                .then(() => { throw Error('Should not get here') }, err => {});
        });

        it('callback hook can provide error', () => {
            const error = Error('oops');
            server.hook('request', function myHook(req, res, next) {
                next(error);
            });
            return server.request()
                .then(() => { throw Error('Should not get here'); }, err => {});
        });

        it('send and still close request hook does not send 404', () => {
            server.use(function(req, res, next) {
                res.send('ok');
                next();         // avoid send and next
            });
            return server.request()
                .then(res => {
                    expect(res.statusCode).to.equal(200);
                })
        });

        it('can disable built-in hooks', () => {
            const server = SansServer({ useBuiltInHooks: false });
            server.use((req, res, next) => {
                res.send(req.method);
            });
            return server.request({ method: 'ABC' })
                .then(res => expect(res.body).to.equal('ABC'));
        });

        it('cannot define two hooks with same name', () => {
            expect(() => server.hook.define('abc')).not.to.throw(Error);
            expect(() => server.hook.define('abc')).to.throw(/already a hook/);
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
                timeout: .1
            });
            server.use((req, res, next) => {});
            return server.request()
                .catch(() => { throw Error("This is unreachable") })
                .then(res => expect(res.statusCode).to.equal(504));
        });

        it('no timeout', (done) => {
            let ended = false;
            const server = SansServer({ timeout: 0 });
            server.use((req, res, next) => {});
            server.request()
                .then(() => ended = true, () => ended = true);
            setTimeout(() => {
                if (ended) {
                    done(Error('Should not have ended.'));
                } else {
                    done();
                }
            }, 100);
        });


    });

    describe('req.log', () => {

        it('a', () => {
            const server = SansServer({
                logs: {
                    duration: true,
                    timeDiff: false,
                    timestamp: true,
                    verbose: true
                },
                timeout: .1
            });
            server.use(function timeout(req, res, next) {
                req.log('One');
                req.log('Two', 'Second');
                req.log('Three', { details: true });
                req.log('Four', 'Forth', { details: true });
                req.emit('log', {
                    action: 'A long action description that could be truncated',
                    category: 'A category',
                    details: {},
                    message: '',
                    timestamp: Date.now()
                });
                req.log('A longer action name that must be truncated', 'Message');
                res.send('OK');
            });
            return server.request().then(res => null);
        });

        it('b', () => {
            const server = SansServer({
                logs: {
                    duration: true,
                    timeDiff: false,
                    timestamp: true,
                    verbose: false
                },
                timeout: .1
            });
            server.use(function timeout(req, res, next) {
                req.log('One');
                req.log('Two', 'Second');
                req.log('Three', { details: true });
                req.log('Four', 'Forth', { details: true });
                req.emit('log', {
                    action: 'An action',
                    category: 'A long category description that could be truncated',
                    details: {},
                    message: ''
                });
                req.log('A longer action name that must be truncated', 'Message');
                res.send('OK');
            });
            return server.request().then(res => null);
        });
    });



});
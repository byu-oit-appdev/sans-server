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

    describe('paradigms', () => {

        it('promise paradigm resolves', () => {
            const server = SansServer();
            return server.request();
        });

        it('promise paradigm invalid method', () => {
            const server = SansServer();
            return server.request({ method: 5 })
                .then(res => {
                    expect(res.statusCode).to.equal(404);
                });
        });

        it('callback paradigm resolves', (done) => {
            const server = SansServer({ logs: { silent: false, grouped: false }}); // non-silent and non-grouped for code coverage
            const req = server.request(function(res) {
                expect(res.statusCode).to.equal(404);
                done();
            });
            expect(req).to.be.instanceof(Request);
        });

        it('callback paradigm invalid method', (done) => {
            const server = SansServer();
            server.request({ method: 5 }, function(res) {
                expect(res.statusCode).to.equal(404);
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
            const server = SansServer();
            const req = server.request({ method: 'GET'});
            expect(req.method).to.equal('GET');
        });

        it('does not allow FOO', () => {
            const server = SansServer();
            const req = server.request({ method: 'FOO'});
            expect(req.method).to.equal('GET');
        });

        it('string defaults to GET', () => {
            const req = SansServer().request();
            expect(req.method).to.equal('GET');
        });

        it('converted to upper case', () => {
            const req = SansServer().request({ method: 'put' });
            expect(req.method).to.equal('PUT');
        });

    });

    describe('requests', () => {

        it('pulls query from path', () => {
            const server = SansServer();
            server.use(function (req, res, next) {
                expect(req.path).to.equal('/foo');
                expect(req.query.abc).to.equal('');
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
            const server = SansServer();
            server.use(function(req, res, next) {
                expect(req.body).to.equal(request.body);
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
            const server = SansServer()
                .use(function (req, res, next) {
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

        it('can send body as string', () => {
            const server = SansServer();
            const req = server.request();
            req.res.send('body');
            return req.then(res => {
                expect(res.statusCode).to.equal(200);
                expect(res.body).to.equal('body');
            });
        });

        it('can send body as object', () => {
            const server = SansServer();
            const req = server.request();
            req.res.send({ foo: 'bar' });
            return req.then(res => {
                expect(res.body).to.equal(JSON.stringify({ foo: 'bar' }));
                expect(res.headers['content-type']).to.equal('application/json');
            });
        });

        it('can send body as Buffer', () => {
            const server = SansServer();
            const req = server.request();
            req.res.send(new Buffer('Hello'));
            return req.then(res => {
                expect(res.body.toString('utf8')).to.equal('Hello');
                expect(res.headers['content-type']).to.equal('application/octet-stream');
            });
        });

    });

    describe('response', () => {

        it('send twice emits error', () => {
            const server = SansServer({ logs: { silent: false } });
            let hadError = false;

            server.use(function badMiddleware(req, res, next) {
                //res.send(Error('Oh noes!'))
                res.send('ok');
                res.send('fail');
            });

            return server.request()
                .on('error', () => hadError = true)
                .then(res => {
                    expect(res.statusCode).to.equal(200);
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

    describe('hooks', () => {

        it('persistent hook', () => {
            let hooked = 0;
            const hook = function(state) { hooked++; };
            const server = SansServer({ hooks: [hook] });
            return server.request()
                .then(res => {
                    expect(hooked).to.equal(1);
                    return server.request();
                })
                .then(res => {
                    expect(hooked).to.equal(2);
                });
        });

        it('hook via method', () => {
            let hooked = 0;
            const hook = function(state) { hooked++; };
            const server = SansServer();
            server.hook(hook);
            return server.request()
                .then(res => {
                    expect(hooked).to.equal(1);
                });
        });

        it('invalid hook', () => {
            const hook = null;
            const server = SansServer();
            expect(() => server.hook(hook)).to.throw(Error);
        })

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

    it('req.log', () => {
        const server = SansServer({
            logs: {
                duration: true,
                timeDiff: false,
                timeStamp: true
            },
            middleware: [ function timeout(req, res, next) {
                req.log('One');
                req.log('Two', 'Second');
                req.log('Three', { details: true });
                req.log('Four', 'Forth', { details: true });
                res.send('OK');
            }],
            timeout: .1
        });
        return server.request().then(res => null);
    });

});
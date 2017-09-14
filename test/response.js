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

describe('response', () => {
    let server;

    beforeEach(function() {
        server = SansServer({ rejectable: true });
    });

    it('can redirect', () => {
        server.use((req, res, next) => {
            res.redirect('http://foo.com');
        });
        return server.request().then(res => {
            expect(res.headers.location).to.equal('http://foo.com');
        });
    });

    it('can use send status', () => {
        server.use((req, res, next) => {
            res.sendStatus(404);
        });
        return server.request().then(res => {
            expect(res.body).to.equal('Not Found');
            expect(res.statusCode).to.equal(404);
        });
    });

    it('can set status', () => {
        server.use((req, res, next) => {
            res.status(100);
            res.send();
        });
        return server.request().then(res => {
            expect(res.statusCode).to.equal(100);
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

    describe('statusCode', () => {

        it('can use getter', () => {
            const server = SansServer();
            server.use((req, res, next) => {
                res.status(200);
                next();
            });
            return server.request().then(res => {
                expect(res.statusCode).to.equal(200);
            });
        })
    });

    describe('cookie', () => {

        it('can clear a cookie', () => {
            server.use((req, res, next) => {
                res.clearCookie('foo');
                res.send();
            });
            return server.request().then(res => {
                expect(res.rawHeaders.indexOf('Set-Cookie: foo=; Expires=Thu, 01 Jan 1970 00:00:00 GMT')).to.not.equal(-1);
                expect(res.cookies[0].serialized).to.equal('foo=; Expires=Thu, 01 Jan 1970 00:00:00 GMT');
            });
        });

        it('can set a cookie', () => {
            server.use((req, res, next) => {
                res.cookie('foo', 'bar');
                res.send();
            });
            return server.request().then(res => {
                expect(res.rawHeaders.indexOf('Set-Cookie: foo=bar')).to.not.equal(-1);
                expect(res.cookies[0].serialized).to.equal('foo=bar');
            });
        });

        it('can set a cookie with number value', () => {
            server.use((req, res, next) => {
                res.cookie('foo', 123);
                res.send();
            });
            return server.request().then(res => {
                expect(res.cookies[0].serialized).to.equal('foo=123');
            });
        });

        it('cannot set cookie name with non-string', () => {
            server.use((req, res, next) => {
                res.cookie(123, '');
            });
            return server.request()
                .catch(err => {
                    expect(err.code).to.equal('ERESC');
                });
        });

        it('cannot set cookie with object', () => {
            server.use((req, res, next) => {
                res.cookie('foo', {})
            });
            return server.request()
                .catch(err => {
                    expect(err.code).to.equal('ERESC');
                });
        });

        it('cookie with same name creates second entry', () => {
            server.use((req, res, next) => {
                res.cookie('foo', 'bar');
                res.cookie('foo', 'baz');
                res.send();
            });
            return server.request()
                .then(res => {
                    const matches = res.rawHeaders.filter(h => h.indexOf('Set-Cookie: foo=') === 0);
                    expect(matches.length).to.equal(2);
                });
        });

    });

    describe('send', () => {

        it('can detect if sent', () => {
            server.use((req, res, next) => {
                expect(res.sent).to.equal(false);
                res.send();
                expect(res.sent).to.equal(true);
            });
            return server.request();
        });

        it('can send nothing', () => {
            server.use((req, res, next) => {
                res.send();
            });
            return server.request().then(res => {
                expect(res.statusCode).to.equal(200);
                expect(res.body).to.equal('');
            });
        });

    });

    describe('headers', () => {

        it('can set header', () => {
            server.use((req, res, next) => {
                res.set('foo', 'bar');
                res.send();
            });
            return server.request().then(res => {
                expect(res.rawHeaders.indexOf('foo: bar')).to.not.equal(-1);
            });
        });

        it('can overwrite header', () => {
            server.use((req, res, next) => {
                res.set('foo', 'bar');
                res.set('foo', 'baz');
                res.send();
            });
            return server.request().then(res => {
                expect(res.rawHeaders.indexOf('foo: baz')).to.not.equal(-1);
            });
        });

        it('can clear header', () => {
            server.use((req, res, next) => {
                res.set('foo', 'bar');
                res.clearHeader('foo');
                res.send();
            });
            return server.request().then(res => {
                expect(res.rawHeaders.indexOf('foo: bar')).to.equal(-1);
            });
        });

    });

    describe('state', () => {

        it('can get current state', () => {
            server.use((req, res, next) => {
                res.status(100);
                res.set('foo', 'bar');
                const state = res.state;
                expect(state.statusCode).to.equal(100);
                expect(state.headers.foo).to.equal('bar');
                next();
            });
            return server.request();
        });

        it('body can be an error', () => {
            server.use((req, res, next) => {
                const err = Error('Oops');
                res.body(err);
                const state = res.state;
                expect(state.body.message).to.equal(err.message);
                res.send();
            });
            return server.request()
                .then(res => {
                    expect(res.statusCode).to.equal(500);
                    expect(res.body).to.equal('Internal Server Error');
                });
        });

        it('body can be a buffer', () => {
            server.use((req, res, next) => {
                const str = 'Hello';
                const buffer = Buffer.from(str);
                res.body(buffer);
                expect(res.state.body.toString('utf8')).to.equal(str);
                res.send();
            });
            return server.request()
                .then(res => {
                    expect(res.body).to.equal('SGVsbG8=');
                });
        });

        it('body can be a plain object', () => {
            const value = { a: 1 };
            server.use((req, res, next) => {
                res.body(value);
                expect(res.state.body).to.equal(value);
                res.send();
            });
            return server.request()
                .then(res => {
                    expect(res.body).to.equal(JSON.stringify(value));
                });
        });

        it('body can be a non-plain object', () => {
            function A() {
                this.value = 1;
            }

            const value = new A();
            server.use((req, res, next) => {
                res.send(value);
            });
            return server.request()
                .then(res => {
                    expect(res.body).to.equal(JSON.stringify(value));
                });
        });

        it('body can be a primitive non-string', () => {
            const value = 123;
            server.use((req, res, next) => {
                res.send(value);
            });
            return server.request()
                .then(res => {
                    expect(res.body).to.equal('123');
                });
        });

    });

    describe('hooks', () => {

        it('calls response hooks after response send', () => {
            let hooked = false;
            server.use((req, res, next) => {
                res.send();
            });
            server.hook('response', function(req, res, next) {
                hooked = true;
                next();
            });
            return server.request()
                .then(res => {
                    expect(hooked).to.be.true;
                });
        });

        it('cannot perform send during response hook', () => {
            server.use((req, res, next) => {
                res.send();
            });
            server.hook('response', function(req, res, next) {
                res.send('ok');
            });
            return server.request()
                .catch(err => {
                    expect(err.code).to.equal('ERSENT');
                });
        });

    });

});


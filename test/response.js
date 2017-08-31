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

describe('response', () => {
    let req;
    let res;

    beforeEach(function() {
        req = Request(null, {});
        res = req.res;
    });

    describe('cookie', () => {

        it('can clear a cookie', () => {
            res.clearCookie('foo');
            res.send();
            return req.then(res => {
                expect(res.rawHeaders[0]).to.equal('Set-Cookie: foo=; Expires=Thu, 01 Jan 1970 00:00:00 GMT');
                expect(res.cookies[0].serialized).to.equal('foo=; Expires=Thu, 01 Jan 1970 00:00:00 GMT');
            });
        });

        it('can set a cookie', () => {
            res.cookie('foo', 'bar');
            res.send();
            return req.then(res => {
                expect(res.rawHeaders[0]).to.equal('Set-Cookie: foo=bar');
                expect(res.cookies[0].serialized).to.equal('foo=bar');
            });
        });

        it('can set a cookie with number value', () => {
            res.cookie('foo', 123);
            res.send();
            return req.then(res => {
                expect(res.cookies[0].serialized).to.equal('foo=123');
            });
        });

        it('cannot set cookie name with non-string', () => {
            expect(() => res.cookie(123, '')).to.throw(Error);
        });

        it('cannot set cookie with object', () => {
            expect(() => res.cookie('foo', {})).to.throw(Error);
        });

        it('cookie with same name creates second entry', () => {
            res.cookie('foo', 'bar');
            res.cookie('foo', 'baz');
            res.send();
            return req.then(res => {
                expect(res.rawHeaders.join('\n')).to.equal('Set-Cookie: foo=bar\nSet-Cookie: foo=baz');
            });
        });

    });

    it('can redirect', () => {
        res.redirect('http://foo.com');
        return req.then(res => {
            expect(res.headers.location).to.equal('http://foo.com');
        });
    });

    describe('send', () => {

        it('can detect if sent', () => {
            expect(res.sent).to.equal(false);
            res.send();
            expect(res.sent).to.equal(true);
        });

        it('can send nothing', () => {
            res.send();
            return req.then(res => {
                expect(res.statusCode).to.equal(200);
                expect(res.body).to.equal('');
            });
        });

    });

    it('can use send status', () => {
        res.sendStatus(404);
        return req.then(res => {
            expect(res.body).to.equal('Not Found');
            expect(res.statusCode).to.equal(404);
        });
    });

    describe('headers', () => {

        it('can set header', () => {
            res.set('foo', 'bar');
            res.send();
            return req.then(res => {
                expect(res.rawHeaders[0]).to.equal('foo: bar');
            });
        });

        it('can overwrite header', () => {
            res.set('foo', 'bar');
            res.set('foo', 'baz');
            res.send();
            return req.then(res => {
                expect(res.rawHeaders[0]).to.equal('foo: baz');
            });
        });

        it('can clear header', () => {
            res.set('foo', 'bar');
            res.clearHeader('foo');
            res.send();
            return req.then(res => {
                expect(res.rawHeaders.length).to.equal(0);
            });
        });

        it('does not clear non existing headers', () => {
            res.clearHeader('abc');
            res.send();
            return req.then(res => {
                expect(Object.keys(res.headers).length).to.equal(0);
            });
        });

    });

    it('can set status', () => {
        res.status(100);
        res.send();
        return req.then(res => {
            expect(res.statusCode).to.equal(100);
        });
    });

    describe('state', () => {

        it('can get current state', () => {
            res.status(100);
            res.set('foo', 'bar');
            const state = res.state;
            expect(state.statusCode).to.equal(100);
            expect(state.headers.foo).to.equal('bar');
        });

        it('body can be an error', () => {
            const err = Error('Oops');
            res.body(err);
            const state = res.state;
            expect(state.body.message).to.equal(err.message);
        });

        it('body can be an object', () => {
            const o = {};
            res.body(o);
            const state = res.state;
            expect(state.body).to.deep.equal(o);
        });

        it('gets cookies', () => {
            res.cookie('foo', 'bar');
            const state = res.state;
            expect(state.cookies[0].serialized).to.equal('foo=bar');
        });

    });

    describe('hooks', () => {

        it('calls response hooks after response send', () => {
            let hooked = false;
            req.hook('response', function(req, res, next) {
                hooked = true;
                next();
            });
            res.send();
            return req.then(res => {
                expect(hooked).to.be.true;
            });
        });

        it('cannot perform send during hook', () => {
            req.hook('response', function(req, res, next) {
                res.send('ok');
            });
            res.send();
            return req.catch(err => {
                expect(err.code).to.equal('ERSENT');
            });
        });

        it('can update body during hook', () => {
            req.hook('response', function(req, res, next) {
                res.body('ok');
                next();
            });
            res.send('fails');
            return req.then(res => {
                expect(res.body).to.equal('ok');
            });
        });

        it('hook type must be a string', () => {
            expect(() => req.hook(null)).to.throw(Error);
        });

        it('hook must be a function', () => {
            expect(() => req.hook('abc', 0, null)).to.throw(Error);
        });

        it('hook can throw error', () => {
            req.hook('response', function myHook(req, res, next) {
                throw Error('Oops');
            });
            res.send('fail');
            return req.catch(err => {
                expect(err.message).to.equal('Oops');
            });
        });

        it('callback hook can provide error', () => {
            req.hook('response', function myHook(req, res, next) {
                next(Error('Oops'));
            });
            res.send('fail');
            return req.catch(err => {
                expect(err.message).to.equal('Oops');
            });
        });

    });

});
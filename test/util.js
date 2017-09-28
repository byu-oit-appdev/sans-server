/**
 *  @license
 *    Copyright 2017 Brigham Young University
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
const expect    = require('chai').expect;
const util      = require('../bin/util');

describe('util', () => {

    describe('plain object', () => {

        it('null', () => {
            expect(util.isPlainObject(null)).to.be.false;
        });

        it('non function constructor', () => {
            const o = { constructor: null };
            expect(util.isPlainObject(o)).to.be.false;
        });

    });

    describe('log', () => {

        it('no args throws error', () => {
            expect(() => util.log('category', [])).to.throw(Error);
        });

        it('string only', () => {
            const event = util.log('category', ['first']);
            expect(event).to.deep.equal({
                action: 'log',
                category: 'category',
                details: {},
                message: 'first',
                timestamp: event.timestamp
            });
        });

        it('string, string', () => {
            const event = util.log('category', ['first', 'second']);
            expect(event).to.deep.equal({
                action: 'first',
                category: 'category',
                details: {},
                message: 'second',
                timestamp: event.timestamp
            });
        });

        it('string, object', () => {
            const event = util.log('category', ['first', { a: true }]);
            expect(event).to.deep.equal({
                action: 'log',
                category: 'category',
                details: { a: true },
                message: 'first',
                timestamp: event.timestamp
            });
        });

        it('string, string, object', () => {
            const event = util.log('category', ['first', 'second', { a: true }]);
            expect(event).to.deep.equal({
                action: 'first',
                category: 'category',
                details: { a: true },
                message: 'second',
                timestamp: event.timestamp
            });
        });

    });

    describe('copy', () => {

        it('primitive', () => {
            const value = util.copy('abc');
            expect(value).to.equal('abc');
        });

        it('array', () => {
            const array = [1, 2, 3];
            const value = util.copy(array);
            expect(value).to.deep.equal(array);
        });

        it('circular array', () => {
            const array = [1, 2, 3];
            array.push(array);
            const value = util.copy(array);
            expect(value).to.deep.equal(array);
        });

        it('object', () => {
            const object = { a: 1, b: 2 };
            const value = util.copy(object);
            expect(value).to.deep.equal(object);
        });

        it('circular object', () => {
            const object = { a: 1, b: 2 };
            object.c = object;
            const value = util.copy(object);
            expect(value).to.deep.equal(object);
        });

    });

    describe('seconds', () => {
        const seconds = util.seconds;

        it('0 ms', () => {
            expect(seconds(0)).to.equal('0.000');
        });

        it('1 ms', () => {
            expect(seconds(1)).to.equal('0.001');
        });

        it('10 ms', () => {
            expect(seconds(10)).to.equal('0.010');
        });

        it('100 ms', () => {
            expect(seconds(100)).to.equal('0.100');
        });

        it('1000 ms', () => {
            expect(seconds(1000)).to.equal('1.000');
        });

        it('10000 ms', () => {
            expect(seconds(10000)).to.equal('10.00');
        });

        it('100000 ms', () => {
            expect(seconds(100000)).to.equal('100.0');
        });

        it('1000000 ms', () => {
            expect(seconds(1000000)).to.equal('1000 ');
        });

        it('9999000 ms', () => {
            expect(seconds(9999000)).to.equal('9999 ');
        });

        it('10000000 ms', () => {
            expect(seconds(10000000)).to.equal('9999+');
        });

        it('11 ms', () => {
            expect(seconds(11)).to.equal('0.011');
        });

        it('123 ms', () => {
            expect(seconds(123)).to.equal('0.123');
        });

        it('1234 ms', () => {
            expect(seconds(1234)).to.equal('1.234');
        });

        it('12345 ms', () => {
            expect(seconds(12345)).to.equal('12.35');
        });

        it('123456 ms', () => {
            expect(seconds(123456)).to.equal('123.5');
        });

        it('1234567 ms', () => {
            expect(seconds(1234567)).to.equal('1235 ');
        });

        it('12345678 ms', () => {
            expect(seconds(12345678)).to.equal('9999+');
        });

    });

});
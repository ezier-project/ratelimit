import { EzRateLimiter } from 'main/index';

function testConstructorMaxPoints(): void {
    new EzRateLimiter({
        clearDelay: 1000,
        maxPoints: -1,
    });
}

function testConstructorClearDelay(): void {
    new EzRateLimiter({
        clearDelay: -1,
        maxPoints: 10,
    });
}

it('test constructor', done => {
    try {
        testConstructorMaxPoints();
    } catch (e) {
        try {
            testConstructorClearDelay();
        } catch (e) {
            done();
        }
    }
});

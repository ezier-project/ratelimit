import { EzRateLimiter } from 'main/index';

it('test states', (done) => {
    const ezLimiter = new EzRateLimiter();

    ezLimiter.start()
    .catch(() => {
        ezLimiter.stop()
        .then(() => {
            ezLimiter.stop()
            .catch(() => {
                done();
            });
        });
    });
});

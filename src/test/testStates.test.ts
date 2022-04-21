import { EzierLimiter } from 'main/index';

it('test states', done => {
    const ezierLimiter = new EzierLimiter();

    ezierLimiter.start().catch(() => {
        ezierLimiter.stop().then(() => {
            ezierLimiter.stop().catch(() => {
                done();
            });
        });
    });
});

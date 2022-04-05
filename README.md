<h1 align='center'>Ez Ratelimiter</h1>

<h2 align='center'>The ez-iest ratelimiter for nodejs.</h2>

<h2 align='center'>

![npm bundle size](https://img.shields.io/bundlephobia/min/ez-ratelimiter?style=for-the-badge) ![npm](https://img.shields.io/npm/dm/ez-ratelimiter?style=for-the-badge) ![NPM](https://img.shields.io/npm/l/ez-ratelimiter?style=for-the-badge) ![npm](https://img.shields.io/npm/v/ez-ratelimiter?style=for-the-badge)

# Why?

**This rate-limiter attempts to keep it e-z, with no additional functions.**

**All in all a basic package to rate-limit your clients.**

***Also used in the Fronvo [server](https://github.com/Fronvo/fronvo)***

# Installing

```
npm i ez-ratelimiter
```

# Examples

**Setup an instance of `EzRateLimiter`:**

```ts
import { EzRateLimiter } from 'ez-ratelimiter';

const ezLimiter = new EzRateLimiter({
    maxPoints: 10,
    clearDelay: 1000
});
```

**Consume points for a client:**
```ts
ezLimiter.consumePoints('client-uid', 5);
```

**Handle a consumption error:**

```ts
import { EzError } from 'ez-ratelimiter';

ezLimiter.consumePoints('client-uid', 11)

.catch((err: EzError) => {
    // EzError check
    if(err.currentPoints) {
        console.log(`Client requested ${err.requestedPoints} points when it has ${err.currentPoints} points and maxPoints are ${err.maxPoints}.`);
    } else {
        console.log(`[${err.name}]: ${err.message}`);
    }
});
```

**Register middleware:**
```ts
ezLimiter.$use({
    beforeConsumption: ({consumerKey, rateLimit, requestedPoints}) => {
        console.log(`Attempting to consume ${requestedPoints} points for ${consumerKey}...`)
    },

    afterConsumption: ({consumerKey, rateLimit, requestedPoints}) => {
        console.log(`Consumed ${requestedPoints} points for ${consumerKey}.`);
    }
});
```

**Stop the rate-limiter:**

```ts
ezLimiter.stop()
.then(() => {
    console.log('The Ez ratelimiter has been stopped.');
});
```

<i>Made by [Shadofer](https://github.com/shadofer) with joy.</i>

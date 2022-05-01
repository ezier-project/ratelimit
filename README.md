<h1 align='center'><img src='https://raw.githubusercontent.com/ezier-project/ratelimit/master/images/ratelimit.svg' alt='Ezier Ratelimiter logo'>

Ezier Ratelimiter</h1>

<h2 align='center'>An ezier ratelimiter for nodejs.</h2>

<h2 align='center'>

![npm bundle size](https://img.shields.io/bundlephobia/min/@ezier/ratelimit?style=for-the-badge) ![npm](https://img.shields.io/npm/dm/@ezier/ratelimit?style=for-the-badge) ![NPM](https://img.shields.io/npm/l/@ezier/ratelimit?style=for-the-badge) ![npm](https://img.shields.io/npm/v/@ezier/ratelimit?style=for-the-badge)

</h2>

# Why?

**This rate-limiter attempts to keep it e-z, with no additional functions.**

**All in all a basic package to rate-limit your clients.**

***Also used in the Fronvo [server](https://github.com/Fronvo/fronvo)***

# Installing

```
npm i @ezier/ratelimit
```

# Documentation
**Documentation for the Ezier Ratelimiter can be found at https://ezier-project.github.io/ratelimit/.**

# Examples

**Setup an instance of `EzierLimiter`:**

```ts
import { EzierLimiter } from '@ezier/ratelimit';

const ezierLimiter = new EzierLimiter({
    maxPoints: 10,
    clearDelay: 1000
});
```

**Consume points for a client:**
```ts
ezierLimiter.consumePoints('client-uid', 5);
```

**Handle a consumption error:**

```ts
import { EzierLimiterError } from '@ezier/ratelimit';

ezierLimiter.consumePoints('client-uid', 11)

.catch((err: EzierLimiterError) => {
    // EzierLimiterError check
    if(err.currentPoints) {
        console.log(`Client requested ${err.requestedPoints} points when it has ${err.currentPoints} points and maxPoints are ${err.maxPoints}.`);
    } else {
        console.log(`[${err.name}]: ${err.message}`);
    }
});
```

**Register middleware:**
```ts
ezierLimiter.$use({
    beforeConsumption: ({consumerKey, requestedPoints}) => {
        console.log(`Attempting to consume ${requestedPoints} points for ${consumerKey}...`)
    },

    afterConsumption: ({consumerKey, remainingPoints}) => {
        console.log(`[${consumerKey}]: ${remainingPoints} points remaining.`);
    }
});
```

**Stop the rate-limiter:**

```ts
ezierLimiter.stop()
.then(() => {
    console.log('The Ezier Ratelimiter has been stopped.');
});
```

<i>Made by [Shadofer](https://github.com/shadofer) with joy.</i>

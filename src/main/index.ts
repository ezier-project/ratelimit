// **************************************************************** //
//               An ezier ratelimiter for nodejs.                   //
// **************************************************************** //

// Interfaces
export enum EzierLimiterState {
    STOPPED,
    RUNNING,
}

const EzierLimiterErrors: { [key: string]: string } = {
    NOT_ENOUGH_POINTS:
        "The consumer doesn't have the required points for consumption.",
};

export interface EzierLimiterLimit {
    consumerKey: string;
    points: number;
}

export interface EzierLimiterLimits {
    [key: string]: EzierLimiterLimit;
}

export interface EzierLimiterResult {
    consumerKey: string;
    currentPoints: number;
    remainingPoints: number;
    maxPoints: number;
}

export interface EzierLimiterOptions {
    maxPoints: number;
    clearDelay: number;
}

interface EzierLimiterMiddlewareClear {
    rateLimits: EzierLimiterLimits;
}

interface EzierLimiterMiddlewareBeforeConsumption {
    consumerKey: string;
    requestedPoints: number;
    rateLimit: EzierLimiterLimit;
}

interface EzierLimiterMiddlewareAfterConsumption {
    consumerKey: string;
    remainingPoints: number;
    rateLimit: EzierLimiterLimit;
}

interface EzierLimiterMiddleware {
    beforeClear?: ({}: EzierLimiterMiddlewareClear) => void;
    afterClear?: ({}: EzierLimiterMiddlewareClear) => void;
    beforeConsumption?: ({}: EzierLimiterMiddlewareBeforeConsumption) => void;
    afterConsumption?: ({}: EzierLimiterMiddlewareAfterConsumption) => void;
}

export interface EzierLimiterError extends Error {
    currentPoints: number;
    requestedPoints: number;
    maxPoints: number;
}

// Generic functions
function generateError(
    name: string,
    currentPoints: number,
    requestedPoints: number,
    maxPoints: number
): EzierLimiterError {
    const errorData: EzierLimiterError = {
        name,
        message: EzierLimiterErrors[name],
        currentPoints,
        requestedPoints,
        maxPoints,
    };

    return errorData;
}

// Instances
export class EzierLimiter {
    readonly maxPoints: number;
    readonly clearDelay: number;

    private isStopped: boolean = true;
    private rateLimits: EzierLimiterLimits = {};
    private clearIntervalId!: number;

    // Middleware
    private beforeClear!: ({}: EzierLimiterMiddlewareClear) => void;
    private afterClear!: ({}: EzierLimiterMiddlewareClear) => void;
    private beforeConsumption!: ({}: EzierLimiterMiddlewareBeforeConsumption) => void;
    private afterConsumption!: ({}: EzierLimiterMiddlewareAfterConsumption) => void;

    constructor(options?: Partial<EzierLimiterOptions>) {
        this.clearDelay = options?.clearDelay ? options.clearDelay : 1000;
        this.maxPoints = options?.maxPoints ? options.maxPoints : 10;

        if (this.clearDelay < 1) {
            throw new Error('clearDelay should be higher than 1ms.');
        }

        if (this.maxPoints < 1) {
            throw new Error('maxPoints should be higher than 1.');
        }

        this.start();
    }

    async consumePoints(
        consumerKey: string,
        points: number
    ): Promise<EzierLimiterResult> {
        if (this.isStopped) {
            throw new Error("Can't consume while the ratelimiter is stopped.");
        }

        if (consumerKey.length == 0) {
            throw new Error("consumerKey can't be empty.");
        }

        if (points < 1) {
            throw new Error("Can't consume less than 1 point.");
        }

        if (this.maxPoints < points) {
            throw new Error(
                "Can't consume more points than maxPoints at once."
            );
        }

        const consumer = this.rateLimits[consumerKey];

        // If consumer doesnt exist, create
        if (!consumer) {
            const consumerData: EzierLimiterLimit = {
                consumerKey,
                points,
            };

            if (this.beforeConsumption)
                this.beforeConsumption({
                    consumerKey,
                    requestedPoints: points,
                    rateLimit: consumerData,
                });

            this.rateLimits[consumerKey] = consumerData;

            if (this.afterConsumption)
                this.afterConsumption({
                    consumerKey,
                    remainingPoints: this.maxPoints - consumerData.points,
                    rateLimit: consumerData,
                });

            return {
                consumerKey,
                currentPoints: points,
                maxPoints: this.maxPoints,
                remainingPoints: this.maxPoints - consumerData.points,
            };
        } else {
            // If new points will be higher than maxPoints prevent consumption
            if (consumer.points + points > this.maxPoints) {
                throw generateError(
                    'NOT_ENOUGH_POINTS',
                    consumer.points,
                    points,
                    this.maxPoints
                );
            } else {
                // Checks passed, add points and consume
                if (this.beforeConsumption)
                    this.beforeConsumption({
                        consumerKey,
                        rateLimit: consumer,
                        requestedPoints: points,
                    });

                consumer.points += points;
                this.rateLimits[consumerKey] = consumer;

                if (this.afterConsumption)
                    this.afterConsumption({
                        consumerKey,
                        remainingPoints: this.maxPoints - consumer.points,
                        rateLimit: consumer,
                    });

                return {
                    consumerKey,
                    currentPoints: consumer.points,
                    maxPoints: this.maxPoints,
                    remainingPoints: this.maxPoints - consumer.points,
                };
            }
        }
    }

    async start(): Promise<void> {
        if (!this.isStopped) {
            throw new Error('The rate-limiter has already started!');
        }

        this.clearIntervalId = setInterval(() => {
            if (this.beforeClear)
                this.beforeClear({
                    rateLimits: this.rateLimits,
                });

            for (const rateLimitId in this.rateLimits) {
                // Don't delete key
                this.rateLimits[rateLimitId].points = 0;
            }

            if (this.afterClear)
                this.afterClear({
                    rateLimits: this.rateLimits,
                });
        }, this.clearDelay);

        this.isStopped = false;
    }

    async stop(): Promise<void> {
        if (this.isStopped) {
            throw new Error('The rate-limiter is already stopped!');
        }

        clearInterval(this.clearIntervalId);

        this.isStopped = true;
    }

    async restart(): Promise<void> {
        await this.stop();

        this.rateLimits = {};

        await this.start();
    }

    $use(middleware: Partial<EzierLimiterMiddleware>): void {
        if (middleware.beforeClear) this.beforeClear = middleware.beforeClear;
        if (middleware.afterClear) this.afterClear = middleware.afterClear;
        if (middleware.beforeConsumption)
            this.beforeConsumption = middleware.beforeConsumption;
        if (middleware.afterConsumption)
            this.afterConsumption = middleware.afterConsumption;
    }

    getState(): EzierLimiterState {
        return this.isStopped
            ? EzierLimiterState.STOPPED
            : EzierLimiterState.RUNNING;
    }

    getRatelimit(consumerKey: string): EzierLimiterLimit | undefined {
        return this.rateLimits[consumerKey];
    }

    getRatelimits(): EzierLimiterLimit[] {
        const rateLimitArray: EzierLimiterLimit[] = [];

        for (const limitKey in this.rateLimits) {
            rateLimitArray.push(this.rateLimits[limitKey]);
        }

        return rateLimitArray;
    }
}

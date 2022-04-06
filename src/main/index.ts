// **************************************************************** //
//      The ez-iest rate-limiter in existance, for nodejs.         //
// **************************************************************** //

import { v4 } from 'uuid';

// Interfaces
export enum EzState {
    STOPPED,
    RUNNING,
}

const EzErrors: { [key: string]: string } = {
    NOT_ENOUGH_POINTS:
        "The consumer doesn't have the required points for consumption.",
};

export interface EzLimit {
    consumerKey: string;
    points: number;
}

export interface EzLimits {
    [key: string]: EzLimit;
}

export interface EzResult {
    consumerKey: string;
    currentPoints: number;
    remainingPoints: number;
    maxPoints: number;
}

export interface EzOptions {
    maxPoints: number;
    clearDelay: number;
}

interface EzMiddlewareClear {
    rateLimits: EzLimits;
}

interface EzMiddlewareBeforeConsumption {
    consumerKey: string;
    requestedPoints: number;
    rateLimit: EzLimit;
}

interface EzMiddlewareAfterConsumption {
    consumerKey: string;
    remainingPoints: number;
    rateLimit: EzLimit;
}

interface EzMiddleware {
    beforeClear?: ({}: EzMiddlewareClear) => void;
    afterClear?: ({}: EzMiddlewareClear) => void;
    beforeConsumption?: ({}: EzMiddlewareBeforeConsumption) => void;
    afterConsumption?: ({}: EzMiddlewareAfterConsumption) => void;
}

export interface EzError extends Error {
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
): EzError {
    const errorData: EzError = {
        name,
        message: EzErrors[name],
        currentPoints,
        requestedPoints,
        maxPoints,
    };

    return errorData;
}

// Instances
export class EzRateLimiter {
    readonly maxPoints: number;
    readonly clearDelay: number;

    private isStopped: boolean = true;
    private rateLimits: EzLimits = {};
    private clearIntervalId!: number;

    // Middleware
    private beforeClear!: ({}: EzMiddlewareClear) => void;
    private afterClear!: ({}: EzMiddlewareClear) => void;
    private beforeConsumption!: ({}: EzMiddlewareBeforeConsumption) => void;
    private afterConsumption!: ({}: EzMiddlewareAfterConsumption) => void;

    constructor(options?: Partial<EzOptions>) {
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
    ): Promise<EzResult> {
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

        const consumer = this.getRatelimit(consumerKey);

        // If consumer doesnt exist, create
        if (!consumer) {
            const consumerData: EzLimit = {
                consumerKey,
                points,
            };

            if (this.beforeConsumption)
                this.beforeConsumption({
                    consumerKey,
                    requestedPoints: points,
                    rateLimit: consumerData,
                });

            this.rateLimits[v4()] = consumerData;

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
                this.setRatelimit(consumer);

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

    $use(middleware: Partial<EzMiddleware>): void {
        if (middleware.beforeClear) this.beforeClear = middleware.beforeClear;
        if (middleware.afterClear) this.afterClear = middleware.afterClear;
        if (middleware.beforeConsumption)
            this.beforeConsumption = middleware.beforeConsumption;
        if (middleware.afterConsumption)
            this.afterConsumption = middleware.afterConsumption;
    }

    getState(): EzState {
        return this.isStopped ? EzState.STOPPED : EzState.RUNNING;
    }

    getRatelimit(consumerKey: string): EzLimit | undefined {
        for (const limitKey in this.rateLimits) {
            const limitItem = this.rateLimits[limitKey];

            if (limitItem.consumerKey == consumerKey) {
                return limitItem;
            }
        }
    }

    getRatelimits(): EzLimit[] {
        const rateLimitArray: EzLimit[] = [];

        for (const limitKey in this.rateLimits) {
            rateLimitArray.push(this.rateLimits[limitKey]);
        }

        return rateLimitArray;
    }

    private getRatelimitUUID(consumerKey: string): string | undefined {
        for (const limitIndex in this.rateLimits) {
            if (this.rateLimits[limitIndex].consumerKey == consumerKey) {
                return limitIndex;
            }
        }
    }

    private setRatelimit(ezLimit: EzLimit): void {
        const limitUUID = this.getRatelimitUUID(ezLimit.consumerKey);

        if (!limitUUID) return;

        this.rateLimits[limitUUID] = ezLimit;
    }
}

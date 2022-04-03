// **************************************************************** //
//      The ez-iest rate-limiter in existance, for nodejs.         //
// **************************************************************** //

// Interfaces
const EzErrors: { [key: string]: string } = {
    NOT_ENOUGH_POINTS:
        "The consumer doesn't have the required points for consumption.",
};

interface EzLimit {
    points: number;
}

interface EzOptions {
    maxPoints: number;
    clearDelay: number;
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
    private rateLimits: { [key: string]: EzLimit } = {};
    private clearIntervalId: number = -1;

    constructor(options: EzOptions) {
        this.maxPoints = options.maxPoints;
        this.clearDelay = options.clearDelay || 1000;

        if (this.clearDelay < 1) {
            throw new Error('clearDelay should be higher than 1ms.');
        }

        if (this.maxPoints < 1) {
            throw new Error('maxPoints should be higher than 1.');
        }

        this.start();
    }

    async consumePoints(consumerKey: string, points: number): Promise<EzLimit> {
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
            const consumerData: EzLimit = {
                points,
            };

            this.rateLimits[consumerKey] = consumerData;
            return consumerData;
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
                this.rateLimits[consumerKey].points += points;
                return this.rateLimits[consumerKey];
            }
        }
    }

    start(): void {
        if (!this.isStopped) {
            throw new Error('The rate-limiter has already started!');
        }

        this.clearIntervalId = setInterval(() => {
            Object.keys(this.rateLimits).forEach(rateLimitKey => {
                this.rateLimits[rateLimitKey].points = 0;
            });
        }, this.clearDelay);

        this.isStopped = false;
    }

    stop(): void {
        if (this.isStopped) {
            throw new Error('The rate-limiter is already stopped!');
        }

        clearInterval(this.clearIntervalId);

        this.isStopped = true;
    }
}

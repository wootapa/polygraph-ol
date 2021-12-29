import { IComparisonOpts, IEvaluatable, IJson, IJsonDump, ILikeOptions, IReport, Primitive, PrimitiveThing } from './contracts';
import { Reporter, Util } from './util';

export abstract class KeyValue {
    protected _key: string;
    protected _value: Primitive;

    get key(): string {
        return this._key;
    }

    get value(): Primitive {
        return this._value;
    }

    constructor(key: string, value: PrimitiveThing) {
        this._key = key;
        this._value = Util.resolveOperatorValue(value);
    }
}

export abstract class Comparison extends KeyValue implements IEvaluatable, IJson {
    static alias: string;
    protected _opts?: IComparisonOpts;
    protected _reporter: Reporter;

    constructor(key: string, value: PrimitiveThing, opts?: IComparisonOpts) {
        super(key, value);
        this._opts = opts;

        // opts is defined when restoring from json
        if (this._opts?.isDate && typeof (this._value == 'string')) {
            this._value = new Date(Date.parse(this._value as string));
        }
        this._opts = { isDate: this._value instanceof Date, ...opts };

        this._reporter = new Reporter(`${this.getAlias()}:${this.key}`);
    }

    get opts(): IComparisonOpts {
        return this._opts;
    }

    getAlias(): string {
        return (this.constructor as any).alias;
    }

    getReport(): IReport {
        return this._reporter.getReport();
    }

    resetReport(): void {
        this._reporter.reset();
    }

    asJson(): IJsonDump {
        return {
            type: this.getAlias(),
            ctorArgs: [this._key, this._value, this._opts]
        };
    }

    evaluate<PrimitiveThing>(obj: PrimitiveThing): boolean {
        // Get object and compare values
        const evalValue = Util.resolveObjectValue<Primitive, PrimitiveThing>(this._key, obj);
        this._reporter.start();

        let result = false;
        if (this instanceof ComparisonEquals) {
            result = evalValue === this._value;
        }
        else if (this instanceof ComparisonIsNull) {
            result = evalValue === null || evalValue === undefined;
        }
        else if (this instanceof ComparisonGreaterThan) {
            result = evalValue > this._value;
        }
        else if (this instanceof ComparisonGreaterThanEquals) {
            result = evalValue >= this._value;
        }
        else if (this instanceof ComparisonLessThan) {
            result = evalValue < this._value;
        }
        else if (this instanceof ComparisonLessThanEquals) {
            result = evalValue <= this._value;
        }
        else if (this instanceof ComparisonLike) {
            result = this._valueRe.test(evalValue?.toString());
        }
        this._reporter.stop(result);
        return result;
    }
}

// Exports to be implemented in Polygraph
export interface IComparison<T> {
    equals(key: string, value: PrimitiveThing): T;
    isNull(key: string): T;
    eq(key: string, value: PrimitiveThing): T;
    greaterThan(key: string, value: PrimitiveThing): T;
    gt(key: string, value: PrimitiveThing): T;
    greaterThanEquals(key: string, value: PrimitiveThing): T;
    gte(key: string, value: PrimitiveThing): T;
    lessThan(key: string, value: PrimitiveThing): T;
    lt(key: string, value: PrimitiveThing): T;
    lessThanEquals(key: string, value: PrimitiveThing): T;
    lte(key: string, value: PrimitiveThing): T;
    like(key: string, value: PrimitiveThing, options?: IComparisonOpts): T;
    ilike(key: string, value: PrimitiveThing, options?: IComparisonOpts): T;
    any(key: string, values: Primitive[]): T;
}

export class ComparisonEquals extends Comparison {
    static alias = 'eq';
}

export class ComparisonIsNull extends Comparison {
    static alias = 'isnull';
}

export class ComparisonGreaterThan extends Comparison {
    static alias = 'gt';
}

export class ComparisonGreaterThanEquals extends Comparison {
    static alias = 'gte';
}

export class ComparisonLessThan extends Comparison {
    static alias = 'lt';
}

export class ComparisonLessThanEquals extends Comparison {
    static alias = 'lte';
}

export class ComparisonLike extends Comparison {
    static alias = 'like';
    _valueRe: RegExp;

    constructor(key: string, value: PrimitiveThing, opts?: ILikeOptions) {
        super(key, value, { matchCase: true, wildCard: '*', ...opts });

        // Construct regex
        const v = this._value.toString()
            .replace(/[-[\]/{}()+.\\^$|]/g, '\\$&')
            .replace(new RegExp(`\\${this.opts.wildCard}`, 'g'), '.*')
            .replace(/\?/g, '.');
        const flags = !this.opts.matchCase ? 'i' : '';
        this._valueRe = new RegExp(v, flags);
    }

    get opts(): ILikeOptions {
        return this._opts as ILikeOptions;
    }
}

export class ComparisonILike extends ComparisonLike {
    static alias = 'ilike';

    constructor(key: string, value: PrimitiveThing, opts?: ILikeOptions) {
        super(key, value, { ...opts, matchCase: false });
    }
}

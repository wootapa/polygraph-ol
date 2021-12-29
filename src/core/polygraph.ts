import { ComparisonEquals, ComparisonGreaterThan, ComparisonGreaterThanEquals, ComparisonILike, ComparisonIsNull, ComparisonLessThan, ComparisonLessThanEquals, ComparisonLike, IComparison, KeyValue } from './comparison';
import { ClassDict, IPolygraphOpts, IDictionary, IJsonDump, IReportSummary, IRuntimeOperatorCallback, Operator, Primitive, PrimitiveThing } from './contracts';
import { Logical, LogicalAnd, LogicalNot, LogicalOr } from './logical';
import { RuntimeOperator, RuntimeOperatorDef } from './runtime';
import { Util } from './util';

// Dict with class constructors. Used when creating from a json dump.
let clazzDict: ClassDict = {
    [LogicalAnd.alias]: LogicalAnd,
    [LogicalOr.alias]: LogicalOr,
    [LogicalNot.alias]: LogicalNot,
    [ComparisonEquals.alias]: ComparisonEquals,
    [ComparisonIsNull.alias]: ComparisonIsNull,
    [ComparisonGreaterThan.alias]: ComparisonGreaterThan,
    [ComparisonGreaterThanEquals.alias]: ComparisonGreaterThanEquals,
    [ComparisonLessThan.alias]: ComparisonLessThan,
    [ComparisonLessThanEquals.alias]: ComparisonLessThanEquals,
    [ComparisonLike.alias]: ComparisonLike,
    [ComparisonILike.alias]: ComparisonILike
};

export interface IPolygraph { }
export abstract class PolygraphBase<T extends PolygraphBase<T>> implements IPolygraph, IComparison<T> {
    // Root logical operator.
    protected _logical: Logical;

    // The instance we return
    protected _this: T;

    // Provided by subclass so we can return the correct type
    protected abstract _getPolygraph(): T;

    // Provided by subclass so we know how to create unknown operators
    protected abstract _getClassDict(): ClassDict;

    // Provides configuration for subclass when restoring from json
    protected abstract _setConfiguration(config: IPolygraphOpts): void;

    // Gets configuration from subclass when serializing to json
    protected abstract _getConfiguration(): IPolygraphOpts;

    constructor() {
        this._this = this._getPolygraph();
        // Use AND by default. Overridden in static constructors.
        this._logical = new LogicalAnd(this._this);
        // Merge base and implementation classmaps
        clazzDict = { ...clazzDict, ...this._this._getClassDict() };
    }

    /**
     * Creates new polygraph from JSON.
     *
     * @param json - JSON (or stringified) output from an polygraph
     * @returns Polygraph
     */
    static fromJson<T extends PolygraphBase<T>>(this: { new(): T }, json: IJsonDump | string): T {
        const jsonParsed = (typeof json === 'string' ? JSON.parse(json) : json) as IJsonDump;
        const polygraph = new this();
        polygraph._setConfiguration(jsonParsed.polygraphOpts);
        polygraph._logical = Logical.fromJson(jsonParsed, clazzDict, polygraph);
        return polygraph;
    }

    /**
     * Creates a new polygraph with a root `and` operator (True when all child operators are true).
     *
     * @returns Polygraph
     */
    static and<T extends PolygraphBase<T>>(this: { new(): T }): T {
        const polygraph = new this();
        polygraph._logical = new LogicalAnd(polygraph);
        return polygraph;
    }

    /**
     * Creates a new polygraph with a root `or` operator (True when any child operator is true).
     *
     * @returns Polygraph
     */
    static or<T extends PolygraphBase<T>>(this: { new(): T }): T {
        const polygraph = new this();
        polygraph._logical = new LogicalOr(polygraph);
        return polygraph;
    }

    /**
     * Creates a new polygraph with a root `not` operator (True when all child operators are false).
     *
     * @returns Polygraph
     */
    static not<T extends PolygraphBase<T>>(this: { new(): T }): T {
        const polygraph = new this();
        polygraph._logical = new LogicalNot(polygraph);
        return polygraph;
    }

    /**
     * Defines a custom operator.
     *
     * @param alias - The name of the operator
     * @param func - The function to be called
     */
    static define<T extends PolygraphBase<T>>(alias: string, func: IRuntimeOperatorCallback): void {
        if (alias in clazzDict) {
            throw new Error(`Operator:${alias} already defined`);
        }
        clazzDict[alias] = new RuntimeOperatorDef(alias, func);
    }

    /**
     * Returns array of all operator aliases.
     *
     * @returns All operator aliases
     */
    static getOperatorAlias(): string[] {
        return Object.keys(clazzDict).sort();
    }

    /**
     * Serializes polygraph as JSON.
     *
     * @returns polygraph as JSON
     */
    asJson(): IJsonDump {
        return { ...this._logical.asJson(), polygraphOpts: this._getConfiguration() };
    }

    /**
     * Returns polygraph as a human readable tree.
     *
     * @returns polygraph as a human readable tree
     */
    asTree(): string {
        const pad = '#';
        const walk = (operator: Operator, indent = 0): string => {
            if (operator instanceof Logical) {
                return `${pad.repeat(indent)}${operator.getAlias()}↘
                    ${operator.getOperators().map(op => walk(op, indent + operator.getAlias().length)).join('\n')}`;
            }
            const kv = operator as unknown as KeyValue;
            return `${pad.repeat(indent)}${kv.key} ${operator.getAlias()} ${kv.value ?? ''}`;
        };
        return walk(this._logical)
            .split('\n')
            .map(v => v.trim().replace(new RegExp(pad, 'g'), ' '))
            .join('\n');
    }

    /**
     * Returns a report with evaluation statistics.
     *
     * @returns A report with evaluation statistics
     */
    getReport(): IReportSummary {
        const report = this._logical.getReport();

        const summary: IReportSummary = {
            duration: report.duration,
            truths: report.truths,
            falses: report.falses,
            details: [report]
        };

        this._logical.getOperatorsTree().forEach(op => {
            const report = op.getReport();
            summary.duration += report.duration;
            summary.truths += report.truths;
            summary.falses += report.falses;
            summary.details.push(report);
        });
        return summary;
    }

    /**
     * Resets report statistics.
     *
     * @returns Polygraph
     */
    resetReport(): T {
        this._logical.resetReport();
        this._logical.getOperatorsTree().forEach(op => op.resetReport());
        return this._this;
    }

    /**
     * Evaluates object.
     *
     * @param obj - The object to evaluate
     *
     * @returns True if object passed all child operators
     */
    evaluate(obj: PrimitiveThing): boolean {
        return this._logical.evaluate(obj);
    }

    /**
     * Clears all operators in current logical and below.
     *
     * @returns Polygraph
     */
    clear(): T {
        this._logical.clear();
        return this._this;
    }

    /**
     * Moves to root logical.
     *
     * @returns Polygraph
     */
    done(): T {
        while (this._logical.getParent() !== this._this) {
            this.up();
        }
        return this._this;
    }

    /**
     * Moves to parent logical (if any).
     *
     * @returns Polygraph
     */
    up(): T {
        if (this._logical.getParent() === this._this) {
            return this._this;
        }
        this._logical = this._logical.getParent() as Logical;
        return this._this;
    }

    /**
     * Moves to first child logical.
     *
     * @returns Polygraph
     */
    down(): T {
        const childLogical = this._logical.getOperators().find((op) => op instanceof Logical) as Logical;
        if (childLogical) {
            this._logical = childLogical;
        }
        return this._this;
    }

    /**
     * Moves to next logical sibling (if any).
     *
     * @returns Polygraph
     */
    next(): T {
        const parent = this._logical.getParent();
        if (parent instanceof Logical) {
            const logicals = parent.getOperators().filter(op => op instanceof Logical) as Logical[];
            const idx = logicals.indexOf(this._logical);
            if (idx < logicals.length - 1) {
                this._logical = logicals[idx + 1];
            }
        }
        return this._this;
    }

    /**
     * Moves to previous logical sibling (if any).
     *
     * @returns Polygraph
     */
    prev(): T {
        const parent = this._logical.getParent();
        if (parent instanceof Logical) {
            const logicals = parent.getOperators().filter(op => op instanceof Logical) as Logical[];
            const idx = logicals.indexOf(this._logical);
            if (idx > 0) {
                this._logical = logicals[idx - 1];
            }
        }
        return this._this;
    }

    /**
     * Returns a clone of polygraph.
     *
     * @returns A new Polygraph
     */
    clone(): T {
        return Util.classOf(this._this).fromJson(this._this.asJson());
    }

    /**
     * Adds another polygraph.
     *
     * @param polygraph - The polygraph to add
     *
     * @returns Polygraph
     */
    addPolygraph(polygraph: T): T {
        this._logical.add(polygraph._logical);
        return this._this;
    }

    /**
     * Returns keys and values for non logical operators.
     *
     * @returns Keys and values for non logical operators
     */
    getKeysAndValues(): IDictionary<Primitive> {
        const dict = {};
        const walk = (operators: Operator[]) => {
            operators.forEach((operator) => {
                if (operator instanceof Logical) {
                    return walk(operator.getOperators());
                }
                const kv = operator as unknown as KeyValue;
                // If we have the same key, make value an array
                dict[kv.key] = dict[kv.key]
                    ? Array.isArray(dict[kv.key])
                        ? dict[kv.key].concat(kv.value)
                        : [dict[kv.key], kv.value]
                    : kv.value;
            });
        };
        walk(this._logical.getOperators());
        return dict;
    }

    /**
     * Returns true when all child operators are true.
     *
     * @returns Polygraph
     */
    and(): T {
        this._logical = this._logical.add(new LogicalAnd(this._logical)) as Logical;
        return this._this;
    }

    /**
     * Returns true when at least one child operator is true.
     *
     * @returns Polygraph
     */
    or(): T {
        this._logical = this._logical.add(new LogicalOr(this._logical)) as Logical;
        return this._this;
    }

    /**
     * Returns true when all child operators are false.
     *
     * @returns Polygraph
     */
    not(): T {
        this._logical = this._logical.add(new LogicalNot(this._logical)) as Logical;
        return this._this;
    }

    /**
     * Returns true when object[key] is equal to value.
     *
     * @param key - The key/property to evaluate
     * @param value - The value to compare
     *
     * @returns Polygraph
     */
    equals(key: string, value: PrimitiveThing): T {
        this._logical.add(new ComparisonEquals(key, value));
        return this._this;
    }

    /**
     * Returns true when object[key] is equal to value.
     *
     * @param key - The key/property to evaluate
     * @param value - The value to compare
     *
     * @returns Polygraph
     */
    eq(key: string, value: PrimitiveThing): T {
        return this.equals(key, value);
    }

    /**
     * Returns true when object[key] is null or undefined.
     *
     * @param key - The key/property to evaluate
     *
     * @returns Polygraph
     */
    isNull(key: string): T {
        this._logical.add(new ComparisonIsNull(key, null));
        return this._this;
    }

    /**
     * Returns true when object[key] is greater than value.
     *
     * @param key - The key/property to evaluate
     * @param value - The value to compare
     *
     * @returns Polygraph
     */
    greaterThan(key: string, value: PrimitiveThing): T {
        this._logical.add(new ComparisonGreaterThan(key, value));
        return this._this;
    }

    /**
     * Returns true when object[key] is greater than value.
     *
     * @param key - The key/property to evaluate
     * @param value - The value to compare
     *
     * @returns Polygraph
     */
    gt(key: string, value: PrimitiveThing): T {
        return this.greaterThan(key, value);
    }

    /**
     * Returns true when object[key] is greater or equal to value.
     *
     * @param key - The key/property to evaluate
     * @param value - The value to compare
     *
     * @returns Polygraph
     */
    greaterThanEquals(key: string, value: PrimitiveThing): T {
        this._logical.add(new ComparisonGreaterThanEquals(key, value));
        return this._this;
    }

    /**
     * Returns true when object[key] is greater or equal to value.
     *
     * @param key - The key/property to evaluate
     * @param value - The value to compare
     *
     * @returns Polygraph
     */
    gte(key: string, value: PrimitiveThing): T {
        return this.greaterThanEquals(key, value);
    }

    /**
     * Returns true when object[key] is less than value.
     *
     * @param key - The key/property to evaluate
     * @param value - The value to compare
     *
     * @returns Polygraph
     */
    lessThan(key: string, value: PrimitiveThing): T {
        this._logical.add(new ComparisonLessThan(key, value));
        return this._this;
    }

    /**
     * Returns true when object[key] is less than value.
     *
     * @param key - The key/property to evaluate
     * @param value - The value to compare
     *
     * @returns Polygraph
     */
    lt(key: string, value: PrimitiveThing): T {
        return this.lessThan(key, value);
    }

    /**
     * Returns true when object[key] is less or equal to value.
     *
     * @param key - The key/property to evaluate
     * @param value - The value to compare
     *
     * @returns Polygraph
     */
    lessThanEquals(key: string, value: PrimitiveThing): T {
        this._logical.add(new ComparisonLessThanEquals(key, value));
        return this._this;
    }

    /**
     * Returns true when object[key] is less or equal to value.
     *
     * @param key - The key/property to evaluate
     * @param value - The value to compare
     *
     * @returns Polygraph
     */
    lte(key: string, value: PrimitiveThing): T {
        return this.lessThanEquals(key, value);
    }

    /**
     * Returns true when object[key] is similar to value.
     * Case sensitive.
     *
     * @param key - The key/property to evaluate
     * @param value - The value/pattern to compare
     *
     * @returns Polygraph
     */
    like(key: string, value: PrimitiveThing): T {
        this._logical.add(new ComparisonLike(key, value));
        return this._this;
    }

    /**
     * Returns true when object[key] is similar to value.
     * Case insensitive.
     *
     * @param key - The key/property to evaluate
     * @param value - The value/pattern to compare
     *
     * @returns Polygraph
     */
    ilike(key: string, value: PrimitiveThing): T {
        this._logical.add(new ComparisonILike(key, value));
        return this._this;
    }

    /**
     * Returns true when object[key] is found in values.
     *
     * @param key - The key/property to evaluate
     * @param values - The values to compare
     *
     * @returns Polygraph
     */
    any(key: string, values: Primitive[]): T {
        if (values.length) {
            const or = this._logical.add(new LogicalOr(this._logical)) as Logical;
            values.forEach(value => or.add(new ComparisonEquals(key, value)));
        }
        return this._this;
    }

    /**
     * Adds an operator by its alias
     *
     * @param alias - Alias of the operator
     * @param key - The key/property to evaluate
     * @param value - Optional value to compare
     * @param opts - Optional operator options
     *
     * @returns Polygraph
     */
    operator(alias: string, key: string, value?: PrimitiveThing, opts?: unknown): T {
        if (!(alias in clazzDict)) {
            throw new Error(`Invalid operator alias:${alias}`);
        }

        const clazz = clazzDict[alias];
        const operator = clazz instanceof RuntimeOperatorDef
            ? new RuntimeOperator(key, clazz)
            : new clazz(key, value, opts);
        this._logical.add(operator);
        return this._this;
    }

    /**
     * Adds an operator by its alias
     *
     * @param alias - Alias of the operator
     * @param key - The key/property to evaluate
     * @param value - Optional value to compare
     * @param opts - Optional operator options
     *
     * @returns Polygraph
     */
    op(alias: string, key: string, value?: PrimitiveThing, opts?: unknown): T {
        return this.operator(alias, key, value, opts);
    }
}

export class PolygraphCore extends PolygraphBase<PolygraphCore> {
    protected _setConfiguration(): void {
        /* Empty */
    }

    protected _getConfiguration(): IPolygraphOpts {
        return {};
    }

    protected _getClassDict(): ClassDict {
        return {};
    }

    protected _getPolygraph(): PolygraphCore {
        return this;
    }
}

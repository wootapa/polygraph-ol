import { KeyValue } from './comparison';
import { ClassDict, IEvaluatable, IJson, IJsonDump, IRuntimeOperatorCallback, Primitive, IReport } from './contracts';
import { Reporter, Util } from './util';

export class RuntimeOperatorDef {
    constructor(public alias: string, public func: IRuntimeOperatorCallback) { }
}

export class RuntimeOperator extends KeyValue implements IEvaluatable, IJson {
    private _def: RuntimeOperatorDef;
    private _reporter: Reporter;

    constructor(key: string, def: RuntimeOperatorDef) {
        super(key, '(custom operator)');
        this._def = def;
        this._reporter = new Reporter(`${this.getAlias()}:${this.key}`);
    }

    static fromJson(json: IJsonDump, classDict: ClassDict): RuntimeOperator {
        const [key, defFuncStr] = json.ctorArgs;

        // Construct the definition if not already
        if (!(json.type in classDict)) {
            const func = new Function(`return ${defFuncStr}`)() as IRuntimeOperatorCallback;
            classDict[json.type] = new RuntimeOperatorDef(json.type, func);
        }
        return new RuntimeOperator(key, classDict[json.type]);
    }

    getAlias(): string {
        return this._def.alias;
    }

    getReport(): IReport {
        return this._reporter.getReport();
    }

    resetReport(): void {
        this._reporter.reset();
    }

    asJson(): IJsonDump {
        return {
            isRuntime: true,
            type: this.getAlias(),
            ctorArgs: [this.key, this._def.func.toString()]
        };
    }

    evaluate<PrimitiveThing>(obj: PrimitiveThing): boolean {
        const objValue = Util.resolveObjectValue<Primitive, PrimitiveThing>(this.key, obj);
        this._reporter.start();
        const result = !!this._def.func.apply(this._def.func, [objValue]);
        this._reporter.stop(result);
        return result;
    }
}

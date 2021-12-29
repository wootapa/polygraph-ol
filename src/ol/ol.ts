
import { KeyValue } from '../core/comparison';
import { IEvaluatable, IJson, IJsonDump, IReport } from '../core/contracts';
import { Reporter } from '../core/util';
import { FeatureThing, IDistanceOpts, IOlOpts } from './contracts';
import { PolygraphOl } from './polygraph';
import { WAFeature } from './feature';

// Base class for all operators
export abstract class OlBase extends KeyValue implements IEvaluatable, IJson {
    static alias: string;
    protected _feature: WAFeature;
    protected _opts: IOlOpts;
    protected _reporter: Reporter;

    constructor(value: FeatureThing, opts: IOlOpts) {
        const feature = WAFeature.factory(value);

        // Defined when restoring from json
        if (opts.geometryName) {
            feature.setGeometryName(opts.geometryName);
        }

        super(feature.getGeometryName(), feature.asWkt());
        this._feature = feature;
        this._opts = { geometryName: feature.getGeometryName(), ...opts };
        this._reporter = new Reporter(`${this.getAlias()}:${this.key}`);
    }

    get feature(): WAFeature {
        return this._feature;
    }

    get opts(): IOlOpts {
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
            ctorArgs: [this.value, this.opts]
        };
    }

    evaluate<FeatureThing>(obj: FeatureThing): boolean {
        const evalFeature = WAFeature.factory(obj);
        this._reporter.start();

        let result = false;
        const projCode = this._opts.polygraphOpts.projCode;

        if (this instanceof OlIntersects) {
            result = this.feature.intersects(evalFeature, projCode);
        }
        else if (this instanceof OlDisjoint) {
            result = !this.feature.intersects(evalFeature, projCode);
        }
        else if (this instanceof OlContains) {
            result = evalFeature.contains(this.feature);
        }
        else if (this instanceof OlWithin) {
            result = this.feature.contains(evalFeature);
        }
        else if (this instanceof OlDistanceWithin) {
            const opts = this._opts as IDistanceOpts;
            result = this.feature.dwithin(evalFeature, opts.distance, opts.greatCircle, projCode);
        }
        else if (this instanceof OlDistanceBeyond) {
            const opts = this._opts as IDistanceOpts;
            result = !this.feature.dwithin(evalFeature, opts.distance, opts.greatCircle, projCode);
        }

        this._reporter.stop(result);
        return result;
    }
}

// To be implemented in Polygraph
export interface IOlOperators {
    intersects(value: FeatureThing): PolygraphOl,
    disjoint(value: FeatureThing): PolygraphOl,
    contains(value: FeatureThing): PolygraphOl,
    within(value: FeatureThing): PolygraphOl,
    distanceWithin(value: FeatureThing, distance: number): PolygraphOl
    distanceBeyond(value: FeatureThing, distance: number): PolygraphOl
}

export class OlIntersects extends OlBase {
    static alias = 'intersects';
}

export class OlDisjoint extends OlBase {
    static alias = 'disjoint';
}

export class OlContains extends OlBase {
    static alias = 'contains';
}

export class OlWithin extends OlBase {
    static alias = 'within';
}

export abstract class OlDistanceBase extends OlBase {
    get opts(): IDistanceOpts {
        return this._opts as IDistanceOpts;
    }
}

export class OlDistanceWithin extends OlDistanceBase {
    static alias = 'dwithin';
}
export class OlDistanceBeyond extends OlDistanceBase {
    static alias = 'beyond';
}

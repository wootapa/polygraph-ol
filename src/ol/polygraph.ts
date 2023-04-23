import { ProjectionLike } from 'ol/proj';
import Projection from 'ol/proj/Projection';
import { ClassDict } from '../core/contracts';
import { PolygraphBase } from '../core/polygraph';
import { FeatureThing, IDistanceOpts, IPolygraphOlOpts, IFilterOpts, ICqlFilterOpts } from './contracts';
import { WAFeature } from './feature';
import { WAFilter } from './filter';
import { IOlOperators, OlContains, OlDisjoint, OlDistanceBeyond, OlDistanceWithin, OlIntersects, OlWithin } from './ol';

let DEFAULT_PROJECTION = 'EPSG:3857';

// Holds anything we want operators to know about
class PolygraphOlOpts implements IPolygraphOlOpts {
    projCode = DEFAULT_PROJECTION;
}

export class PolygraphOl extends PolygraphBase<PolygraphOl> implements IOlOperators {
    private _opts = new PolygraphOlOpts();

    protected _getConfiguration(): IPolygraphOlOpts {
        return this._opts;
    }

    protected _setConfiguration(config: IPolygraphOlOpts): void {
        this._opts = config;
    }

    protected _getPolygraph(): PolygraphOl {
        return this;
    }

    protected _getClassDict(): ClassDict {
        return {
            [OlIntersects.alias]: OlIntersects,
            [OlDisjoint.alias]: OlDisjoint,
            [OlContains.alias]: OlContains,
            [OlWithin.alias]: OlWithin,
            [OlDistanceWithin.alias]: OlDistanceWithin,
            [OlDistanceBeyond.alias]: OlDistanceBeyond
        };
    }

    /**
     * Sets default projection for all Polygraphs.
     * Default `EPSG:3857` (Web Mercator)
     *
     * @remarks Projection must be known.
     *
     * @param projection - Projection instance or code
     */
    static defaultProjection(projection: ProjectionLike): void {
        DEFAULT_PROJECTION = projection instanceof Projection ? projection.getCode() : projection;
    }

    /**
     * Sets projection for all child spatial operators.
     *
     * @remarks Projection must be known.
     *
     * @param projection - Projection instance or code
     *
     * @returns Polygraph
     */
    projection(projection: ProjectionLike): PolygraphOl {
        this._opts.projCode = projection instanceof Projection ? projection.getCode() : projection;
        return this;
    }

    /**
     * Evaluates featurething.
     *
     * @param obj - The featurething to evaluate
     *
     * @returns True if object passed all child operators
     */
    evaluate(obj: FeatureThing): boolean {
        // To support all base operators, we need a dict or they can't resolve values
        const feature = WAFeature.factory(obj);
        const properties = feature.getProperties();

        // Attach helper property so spatial operators can later read the value
        properties[WAFeature.GEOMETRYNAME_HINT] = feature.getGeometryName();
        return this._logical.evaluate(properties);
    }

    /**
     * Returns true when object intersects value.
     *
     * @param value - The featurething to compare
     *
     * @returns Polygraph
     */
    intersects(value: FeatureThing): PolygraphOl {
        this._logical.add(new OlIntersects(value, { polygraphOpts: this._opts }));
        return this;
    }

    /**
     * Returns true when object do not intersects value.
     *
     * @param value - The featurething to compare
     *
     * @returns Polygraph
     */
    disjoint(value: FeatureThing): PolygraphOl {
        this._logical.add(new OlDisjoint(value, { polygraphOpts: this._opts }));
        return this;
    }

    /**
     * Returns true when object completely contains value.
     *
     * @param value - The featurething to compare
     *
     * @returns Polygraph
     */
    contains(value: FeatureThing): PolygraphOl {
        this._logical.add(new OlContains(value, { polygraphOpts: this._opts }));
        return this;
    }

    /**
     * Returns true when object is completely within value.
     *
     * @param value - The featurething to compare
     *
     * @returns Polygraph
     */
    within(value: FeatureThing): PolygraphOl {
        this._logical.add(new OlWithin(value, { polygraphOpts: this._opts }));
        return this;
    }

    /**
     * Returns true when object is no more than specified distance from value.
     *
     * @remarks Requires a correct projection.
     *
     * @param value - The featurething to compare
     * @param distance - Distance in meters
     * @param greatCircle - Optional. Calculate using great-circle distance.
     *
     * @returns Polygraph
     */
    distanceWithin(value: FeatureThing, distance: number, greatCircle?: boolean): PolygraphOl {
        this._logical.add(new OlDistanceWithin(value, { polygraphOpts: this._opts, greatCircle: greatCircle, distance: distance } as IDistanceOpts));
        return this;
    }

    /**
     * Returns true when object is more than specified distance from value.
     *
     * @remarks Requires a correct projection.
     *
     * @param value - The featurething to compare
     * @param distance - Distance in meters
     * @param greatCircle - Optional. Calculate using great-circle distance.
     *
     * @returns Polygraph
     */
    distanceBeyond(value: FeatureThing, distance: number, greatCircle?: boolean): PolygraphOl {
        this._logical.add(new OlDistanceBeyond(value, { polygraphOpts: this._opts, greatCircle: greatCircle, distance: distance } as IDistanceOpts));
        return this;
    }

    /**
     * Returns operators as an OGC CQL query.
     *
     * @param opts - Optional serializer settings.
     *
     * @returns OGC CQL query
     */
    asOgcCql(opts?: ICqlFilterOpts): string {
        return WAFilter.asOgcCql(this._logical, opts);
    }

    /**
     * Returns operators as an OGC XML query.
     *
     * @remarks
     * Wrap in encodeURI to avoid encoding issues
     *
     * @param opts - Optional serializer settings.
     *
     * @returns OGC XML query
     */
    asOgcXml(opts?: IFilterOpts): string {
        return WAFilter.asOgcXml(this._logical, opts);
    }
}
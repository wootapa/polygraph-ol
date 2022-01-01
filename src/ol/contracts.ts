import Feature from 'ol/Feature';
import Geometry from 'ol/geom/Geometry';
import { ProjectionLike } from 'ol/proj';
import { IPolygraphOpts, ThingOrThingGetter } from '../core/contracts';

export type FeatureThing = ThingOrThingGetter<Feature<Geometry> | Geometry | Object | string>;

export interface IPolygraphOlOpts extends IPolygraphOpts {
    projCode: string
}

export interface IOlOpts {
    polygraphOpts: IPolygraphOlOpts,
    geometryName?: string
}

export interface IDistanceOpts extends IOlOpts {
    distance: number,
    greatCircle: boolean
}

export interface IFilterOpts {
    geometryName?: string,
    projection?: ProjectionLike,
    decimals?: number
}

export interface ITransformOpts {
    sourceProj: ProjectionLike,
    targetProj: ProjectionLike
}

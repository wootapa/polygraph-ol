import booleanIntersects from '@turf/boolean-intersects';
import { Feature } from 'ol';
import { Coordinate } from 'ol/coordinate';
import { Extent, getCenter } from 'ol/extent';
import GeoJSON from 'ol/format/GeoJSON';
import GML3 from 'ol/format/GML3';
import WKT from 'ol/format/WKT';
import Circle from 'ol/geom/Circle';
import Geometry from 'ol/geom/Geometry';
import GeometryLayout from 'ol/geom/GeometryLayout';
import LineString from 'ol/geom/LineString';
import MultiLineString from 'ol/geom/MultiLineString';
import MultiPoint from 'ol/geom/MultiPoint';
import MultiPolygon from 'ol/geom/MultiPolygon';
import Point from 'ol/geom/Point';
import Polygon, { fromCircle, fromExtent } from 'ol/geom/Polygon';
import { ProjectionLike } from 'ol/proj';
import { getDistance } from 'ol/sphere';
import { IDictionary } from '../core/contracts';
import { FeatureThing, ITransformOpts } from './contracts';

const formatWkt = new WKT();
const formatJson = new GeoJSON();
const formatGml = new GML3();

export class WAFeature {
    constructor(private _feature: Feature<Geometry>) { }

    static readonly GEOMETRYNAME_DEFAULT = 'geometry';
    static readonly GEOMETRYNAME_HINT = 'polygraph_geometryname';
    static readonly WGS84_CODE = 'EPSG:4326';

    static factory = (obj: FeatureThing): WAFeature => {
        if (obj instanceof WAFeature) {
            return obj;
        }
        else if (obj instanceof Function) {
            return WAFeature.factory(obj.call(obj, WAFeature.GEOMETRYNAME_DEFAULT));
        }
        else if (obj instanceof Feature) {
            return new WAFeature(obj).assertValid();
        }
        else if (obj instanceof Geometry) {
            return new WAFeature(new Feature(obj)).assertValid();
        }
        else if (obj instanceof Array) {
            if (obj.length > 0 && obj.length % 2 === 0) {
                // Point?
                if (obj.length == 2) {
                    return new WAFeature(new Feature(new Point(obj, GeometryLayout.XY)));
                }
                // Extent->Polygon?
                if (obj.length == 4) {
                    return new WAFeature(new Feature(fromExtent(obj as Extent)));
                }
                // LineString?
                if (obj.length == 6) {
                    return new WAFeature(new Feature(new LineString(obj, GeometryLayout.XY)));
                }
                // Polygon or LineString?
                const [headX, headY] = obj.slice(0, 2);
                const [tailX, tailY] = obj.slice(-2);
                if (headX === tailX && headY === tailY) {
                    return new WAFeature(new Feature(new Polygon(obj, GeometryLayout.XY, [obj.length])));
                }
                return new WAFeature(new Feature(new LineString(obj, GeometryLayout.XY)));
            }
        }
        else if (obj instanceof Object) {
            // Resolving from a spatial operator?
            if (WAFeature.GEOMETRYNAME_HINT in obj) {
                const geometryKey = obj[WAFeature.GEOMETRYNAME_HINT] as string;
                return WAFeature.factory(obj[geometryKey]);
            }
            // Resolving from polygraph?
            const candidate = Object.entries(obj).find(([, v]) => v instanceof Geometry);
            if (candidate) {
                const [key, geometry] = candidate;
                const feature = new Feature(obj);
                feature.setGeometryName(key);
                feature.setGeometry(geometry);
                return new WAFeature(feature).assertValid();
            }
            // Probably parsed geojson
            return new WAFeature(formatJson.readFeature(obj)).assertValid();
        }
        else if (typeof (obj) === 'string') {
            switch (obj.trimLeft().charAt(0)) {
                case '{': return new WAFeature(formatJson.readFeature(obj)).assertValid();
                default: return new WAFeature(formatWkt.readFeature(obj)).assertValid();
            }
        }
        throw new Error('Unsupported geometry type');
    }

    static transform(geometry: Geometry, sourceProjection: ProjectionLike, targetProjection: ProjectionLike): Geometry {
        return geometry.clone().transform(sourceProjection, targetProjection);
    }

    static isSquare(poly: Geometry): boolean {
        if (!(poly instanceof Polygon)) {
            return false;
        }

        const polyExtent = fromExtent(poly.getExtent());

        if (poly.getFlatCoordinates().length !== polyExtent.getFlatCoordinates().length) {
            return false;
        }
        // Could in theory be topologically different and produce the same area
        return poly.getArea() === polyExtent.getArea();
    }

    assertValid(): WAFeature {
        const geom = this.getGeometry();
        if (!(geom instanceof Geometry)) {
            throw new Error('Not a valid geometry');
        }
        if (geom instanceof Circle) {
            this._feature.setGeometry(fromCircle(geom));
        }
        return this;
    }

    getGeometry(): Geometry {
        return this._feature.getGeometry();
    }

    getGeometryAsArray(): Geometry[] {
        const geom = this._feature.getGeometry();
        if (geom instanceof MultiPoint) {
            return geom.getPoints();
        }
        if (geom instanceof MultiLineString) {
            return geom.getLineStrings();
        }
        if (geom instanceof MultiPolygon) {
            return geom.getPolygons();
        }
        return [geom];
    }

    getGeometryTransformed(sourceProjection: ProjectionLike, targetProjection: ProjectionLike): Geometry {
        return WAFeature.transform(this.getGeometry(), sourceProjection, targetProjection);
    }

    getGeometryName(): string {
        return this._feature.getGeometryName();
    }

    setGeometryName(geometryName: string): void {
        if (geometryName !== this.getGeometryName()) {
            const olFeature = this.getOlFeature();
            olFeature.set(geometryName, olFeature.getGeometry());
            olFeature.unset(olFeature.getGeometryName());
            olFeature.setGeometryName(geometryName);
        }
    }

    getExtent(): Extent {
        return this.getGeometry().getExtent();
    }

    getProperties(): IDictionary<any> {
        return this._feature.getProperties();
    }

    getCenter(): Coordinate {
        return getCenter(this.getExtent());
    }

    getOlFeature(): Feature<Geometry> {
        return this._feature;
    }

    asWkt(decimals?: number, opts?: ITransformOpts): string {
        const geom = opts
            ? this.getGeometryTransformed(opts.sourceProj, opts.targetProj)
            : this.getGeometry();
        return formatWkt.writeGeometry(geom, { decimals: decimals });
    }

    asGeoJson(decimals?: number, opts?: ITransformOpts): string {
        const geom = opts
            ? this.getGeometryTransformed(opts.sourceProj, opts.targetProj)
            : this.getGeometry();
        return formatJson.writeGeometry(geom, { decimals: decimals });
    }

    asTurf(projCode: string): any {
        return formatJson.writeGeometryObject(this.getGeometryTransformed(projCode, WAFeature.WGS84_CODE)) as any;
    }

    asGml(decimals?: number, opts?: ITransformOpts): string {
        const geom = opts
            ? this.getGeometryTransformed(opts.sourceProj, opts.targetProj)
            : this.getGeometry();
        return formatGml.writeGeometry(geom, { decimals: decimals });
    }

    intersects(feature: WAFeature, projCode: string): boolean {
        const thisGeoms = this.getGeometryAsArray();
        const featGeoms = feature.getGeometryAsArray();

        return thisGeoms.some(thisGeom => {
            return featGeoms.some(featGeom => {
                if (thisGeom instanceof Point) {
                    return featGeom.intersectsCoordinate(thisGeom.getCoordinates());
                }
                if (featGeom instanceof Point) {
                    return thisGeom.intersectsCoordinate(featGeom.getCoordinates());
                }

                if (WAFeature.isSquare(thisGeom)) {
                    return featGeom.intersectsExtent(thisGeom.getExtent());
                }
                if (WAFeature.isSquare(featGeom)) {
                    return thisGeom.intersectsExtent(featGeom.getExtent());
                }
                // Leave it to turf if extent hits
                return thisGeom.intersectsExtent(featGeom.getExtent())
                    && booleanIntersects(WAFeature.factory(thisGeom).asTurf(projCode), WAFeature.factory(featGeom).asTurf(projCode));
            });
        });
    }

    contains(feature: WAFeature): boolean {
        const thisGeoms = this.getGeometryAsArray();
        const featGeoms = feature.getGeometryAsArray();

        return thisGeoms.some(thisGeom => {
            return featGeoms.every(featGeom => {
                if (featGeom instanceof Point) {
                    return thisGeom.intersectsCoordinate(featGeom.getCoordinates());
                }
                if (featGeom instanceof LineString) {
                    return featGeom.getCoordinates().every(coord => thisGeom.intersectsCoordinate(coord));
                }
                return (featGeom as Polygon).getLinearRing(0).getCoordinates().every(coord => thisGeom.intersectsCoordinate(coord));
            });
        });
    }

    dwithin(feature: WAFeature, distance: number, greatCircle = true, projCode: string): boolean {
        let thisGeom = this.getGeometry();
        let featGeom = feature.getGeometry();

        if (thisGeom instanceof Point && featGeom.intersectsCoordinate(thisGeom.getCoordinates())) {
            return true;
        }
        if (featGeom instanceof Point && thisGeom.intersectsCoordinate(featGeom.getCoordinates())) {
            return true;
        }

        if (!greatCircle) {
            const b = featGeom.getClosestPoint(getCenter(thisGeom.getExtent()));
            const a = thisGeom.getClosestPoint(b);
            return new LineString([a, b]).getLength() <= distance || this.intersects(feature, projCode);
        }
        thisGeom = this.getGeometryTransformed(projCode, WAFeature.WGS84_CODE);
        featGeom = feature.getGeometryTransformed(projCode, WAFeature.WGS84_CODE);
        const b = featGeom.getClosestPoint(getCenter(thisGeom.getExtent()));
        const a = thisGeom.getClosestPoint(b);
        return getDistance(a, b) <= distance || this.intersects(feature, projCode);
    }
}
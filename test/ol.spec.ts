/**
 * @jest-environment jsdom
 */

import { Feature } from 'ol';
import { Extent, getBottomRight, getCenter, getTopLeft } from 'ol/extent';
import GeoJSON from 'ol/format/GeoJSON';
import WKT from 'ol/format/WKT';
import { Circle, MultiPolygon } from 'ol/geom';
import LineString from 'ol/geom/LineString';
import Point from 'ol/geom/Point';
import Polygon, { fromExtent } from 'ol/geom/Polygon';
import { and, defaultProjection, fromJson } from '../src/polygraph.ol';

defaultProjection('EPSG:3857');

const formatWKT = new WKT();
const formatJSON = new GeoJSON();

const polyExtent: Extent = [1558356.9283, 7559163.7738, 1581670.2220, 7573457.4981];
const poly = fromExtent(polyExtent);
const polyCoords = poly.getFlatCoordinates();
const polyFunction = () => () => poly;
const polyWKT = formatWKT.writeGeometry(poly);
const polyJSON = formatJSON.writeGeometry(poly);
const polyFeature = new Feature(poly);
const polyFeatureJSON = formatJSON.writeFeature(polyFeature);
const polyFeatureJSONObject = formatJSON.writeFeatureObject(polyFeature);
const polyFeatureJSONObjectString = JSON.stringify(polyFeatureJSONObject);
const polyFeatureWKT = formatWKT.writeFeature(polyFeature);
const polyFeatureProperties = polyFeature.getProperties();
const polyTriangle = new Polygon([[getCenter(poly.getExtent()), getTopLeft(polyExtent), getBottomRight(polyExtent), getCenter(poly.getExtent())]]);
const pointCenter = new Point(getCenter(poly.getExtent()));
const pointOutside = new Point(getTopLeft(poly.getExtent()).map(c => c - 1));
const multiPoly = new MultiPolygon([poly.clone(), polyTriangle.clone()]);
const circleCenter = new Circle(getCenter(poly.getExtent()), 1);
const lineCrosses = new LineString([getTopLeft(polyExtent), getCenter(poly.getExtent()), getBottomRight(polyExtent)]);

describe('ol', () => {
    it('polys of different formats intersects', () => {
        const result = and()
            .intersects(polyExtent)
            .intersects(polyTriangle)
            .intersects(multiPoly)
            .intersects(polyFunction)
            .intersects(poly)
            .intersects(polyCoords)
            .intersects(polyWKT)
            .intersects(polyJSON)
            .intersects(polyFeature)
            .intersects(polyFeatureJSON)
            .intersects(polyFeatureJSONObject)
            .intersects(polyFeatureJSONObjectString)
            .intersects(polyFeatureWKT)
            .intersects(polyFeatureProperties)
            .done()
            .evaluate(polyFeature);

        expect(result).toBe(true);
    });

    it('turf intersection', () => {
        const result = and()
            .intersects(polyTriangle)
            .done()
            .evaluate(lineCrosses);

        expect(result).toBe(true);
    });

    it('nondefault geometryname', () => {
        const polyFeatureCustomName = new Feature({ 'the_geom': poly });
        polyFeatureCustomName.setGeometryName('the_geom');

        const result = and()
            .intersects(polyFeatureCustomName)
            .done()
            .evaluate(polyFeatureCustomName);

        expect(result).toBe(true);
    });

    it('point of poly centroid intersects', () => {
        const result = and()
            .intersects(pointCenter)
            .done()
            .evaluate(poly);

        expect(result).toBe(true);
    });

    it('point of poly outside disjoints', () => {
        const result = and()
            .disjoint(pointOutside)
            .done()
            .evaluate(poly);

        expect(result).toBe(true);
    });

    it('line crossing poly intersects', () => {
        const result = and()
            .intersects(lineCrosses)
            .done()
            .evaluate(poly);

        expect(result).toBe(true);
    });

    it('polygraph and json-polygraph evaluates same', () => {
        const polygraph1 = and()
            .intersects(lineCrosses)
            .intersects(circleCenter)
            .disjoint(lineCrosses)
            .within(poly)
            .contains(poly)
            .distanceWithin(pointCenter, 100)
            .distanceWithin(pointCenter, 500)
            .done();

        const polygraph2 = fromJson(polygraph1.asJson());

        const result1 = polygraph1.evaluate(poly);
        const result2 = polygraph2.evaluate(poly);
        expect(result1).toBe(result2);
    });

    it('point is within poly', () => {
        const polygraph = and()
            .within(poly)
            .done();

        const result = polygraph.evaluate(pointCenter);
        expect(result).toBe(true);
    });

    it('point is within circle', () => {
        const polygraph = and()
            .within(circleCenter)
            .done();

        const result = polygraph.evaluate(pointCenter);
        expect(result).toBe(true);
    });

    it('poly contains point', () => {
        const polygraph = and()
            .contains(pointCenter)
            .done();

        const result = polygraph.evaluate(poly);
        expect(result).toBe(true);
    });

    it('poly contains circle', () => {
        const polygraph = and()
            .contains(circleCenter)
            .done();

        const result = polygraph.evaluate(poly);
        expect(result).toBe(true);
    });

    it('distance approximation', () => {

        const p1 = [1559500, 7565753]; // Home
        const p2 = [1575395, 7564424]; // Work
        const distance = 10000;

        const polygraph = and()
            .distanceWithin(p1, distance)
            .distanceBeyond(p1, distance / 2)
            .done();

        const result = polygraph.evaluate(p2);
        expect(result).toBe(true);
    });

    it('serializable', () => {
        const polygraph = and()
            .intersects(lineCrosses)
            .intersects(polyTriangle)
            .disjoint(pointOutside)
            .contains(circleCenter)
            .within(multiPoly)
            .distanceWithin(pointOutside, 10)
            .done();

        const cql = polygraph.asOgcCql();
        expect(cql).toBeDefined();

        const xml = polygraph.asOgcXml();
        expect(xml).toBeDefined();
    });
});
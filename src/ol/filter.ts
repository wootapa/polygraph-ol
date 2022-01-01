import { getCenter } from 'ol/extent';
import Geometry from 'ol/geom/Geometry';
import { get, ProjectionLike } from 'ol/proj';
import Units from 'ol/proj/Units';
import { Comparison, ComparisonEquals, ComparisonGreaterThan, ComparisonGreaterThanEquals, ComparisonIsNull, ComparisonLessThan, ComparisonLessThanEquals, ComparisonLike } from '../core/comparison';
import { Operator } from '../core/contracts';
import { Logical, LogicalAnd, LogicalNot, LogicalOr } from '../core/logical';
import { IFilterOpts } from './contracts';
import { WAFeature } from './feature';
import { OlBase, OlContains, OlDisjoint, OlDistanceBase, OlDistanceBeyond, OlDistanceWithin, OlIntersects, OlWithin } from './ol';

export class WAFilter {

    private constructor() {
        /* Empty */
    }

    static metersToUnit = (geom: Geometry, sourceProj: ProjectionLike, targetProj: ProjectionLike, meters: number): number => {
        const proj = get(targetProj);
        switch (proj.getUnits()) {
            case Units.DEGREES: {
                // https://stackoverflow.com/a/25237446
                const [, lat] = getCenter(WAFeature.transform(geom, sourceProj, proj).getExtent());
                return meters / (proj.getMetersPerUnit() * Math.cos(lat * (Math.PI / 180)));
            }
            default: {
                return meters / proj.getMetersPerUnit();
            }
        }
    }

    static asOgcCql = (logical: Logical, opts?: IFilterOpts): string => {
        const walk = (operator: Operator): string => {
            // Openlayers
            if (operator instanceof OlBase) {
                const property = opts?.geometryName ?? operator.key;
                let value = opts?.projection
                    ? operator.feature.asWkt(opts?.decimals, { sourceProj: operator.opts.polygraphOpts.projCode, targetProj: opts.projection })
                    : operator.feature.asWkt(opts?.decimals);

                if (operator instanceof OlIntersects) {
                    return `INTERSECTS(${property}, ${value})`;
                }
                if (operator instanceof OlDisjoint) {
                    return `DISJOINT(${property}, ${value})`;
                }
                if (operator instanceof OlContains) {
                    return `CONTAINS(${property}, ${value})`;
                }
                if (operator instanceof OlWithin) {
                    return `WITHIN(${property}, ${value})`;
                }
                if (operator instanceof OlDistanceBase) {
                    // https://stackoverflow.com/a/67897648
                    const distance = operator.opts.distance;
                    const sourceProj = operator.opts.polygraphOpts.projCode;
                    const targetProj = opts?.projection ?? sourceProj;
                    const sphere = WAFeature.distanceSphere(operator.feature.getCenter(), sourceProj, distance);
                    value = WAFeature.factory(sphere).asWkt(opts?.decimals, { sourceProj, targetProj });

                    if (operator instanceof OlDistanceWithin) {
                        return `INTERSECTS(${property}, ${value})`;
                    }
                    if (operator instanceof OlDistanceBeyond) {
                        return `DISJOINT(${property}, ${value})`;
                    }
                }
            }
            // Comparison
            if (operator instanceof Comparison) {
                const value = operator.value instanceof Date
                    ? operator.value.toISOString()
                    : typeof (operator.value) == 'string'
                        ? `'${operator.value}'`
                        : operator.value;

                if (operator instanceof ComparisonEquals) {
                    return `${operator.key} = ${value}`;
                }
                if (operator instanceof ComparisonIsNull) {
                    return `${operator.key} IS NULL`;
                }
                if (operator instanceof ComparisonGreaterThan) {
                    return `${operator.key} > ${value}`;
                }
                if (operator instanceof ComparisonGreaterThanEquals) {
                    return `${operator.key} >= ${value}`;
                }
                if (operator instanceof ComparisonLessThan) {
                    return `${operator.key} < ${value}`;
                }
                if (operator instanceof ComparisonLessThanEquals) {
                    return `${operator.key} <= ${value}`;
                }
                if (operator instanceof ComparisonLike) {
                    const reValue = operator.value.toString().replace(new RegExp(`\\${operator.opts.wildCard}`, 'g'), '%')
                    return `${operator.key} ${operator.opts.matchCase ? 'LIKE' : 'ILIKE'} '${reValue}'`;
                }
            }
            // Logical
            if (operator instanceof Logical) {
                const operators = operator.getOperators();
                if (operators.length > 0) {
                    if (operator instanceof LogicalAnd) {
                        return `(${operators.map(walk).join(' AND ')})`
                    }
                    if (operator instanceof LogicalOr) {
                        return `(${operators.map(walk).join(' OR ')})`
                    }
                    if (operator instanceof LogicalNot) {
                        return `(NOT ${operators.map(walk).join(' AND NOT ')})`
                    }
                }
                return '(1=1)';
            }
        };
        return walk(logical);
    }

    static asOgcXml = (logical: Logical, opts?: IFilterOpts): string => {
        const walk = (operator: Operator): string => {
            // Openlayers
            if (operator instanceof OlBase) {
                const property = `<ogc:PropertyName>${opts?.geometryName ?? operator.key}</ogc:PropertyName>`;
                let value = opts?.projection
                    ? operator.feature.asGml(opts?.decimals, { sourceProj: operator.opts.polygraphOpts.projCode, targetProj: opts.projection })
                    : operator.feature.asGml(opts?.decimals);

                if (operator instanceof OlIntersects) {
                    return `<ogc:Intersects>${property}${value}</ogc:Intersects>`;
                }
                if (operator instanceof OlDisjoint) {
                    return `<ogc:Disjoint>${property}${value}</ogc:Disjoint>`;
                }
                if (operator instanceof OlContains) {
                    return `<ogc:Contains>${property}${value}</ogc:Contains>`;
                }
                if (operator instanceof OlWithin) {
                    return `<ogc:Within>${property}${value}</ogc:Within>`;
                }
                if (operator instanceof OlDistanceBase) {
                    // https://stackoverflow.com/a/67897648
                    const distance = operator.opts.distance;
                    const sourceProj = operator.opts.polygraphOpts.projCode;
                    const targetProj = opts?.projection ?? sourceProj;
                    const sphere = WAFeature.distanceSphere(operator.feature.getCenter(), sourceProj, distance);
                    value = WAFeature.factory(sphere).asGml(opts?.decimals, { sourceProj, targetProj });

                    if (operator instanceof OlDistanceWithin) {
                        return `<ogc:Intersects>${property}${value}</ogc:Intersects>`;
                    }
                    if (operator instanceof OlDistanceBeyond) {
                        return `<ogc:Disjoint>${property}${value}</ogc:Disjoint>`;
                    }
                }
            }
            // Comparison
            if (operator instanceof Comparison) {
                const property = `<ogc:PropertyName>${operator.key}</ogc:PropertyName>`;
                const value = `<ogc:Literal>${operator.value instanceof Date ? operator.value.toISOString() : operator.value}</ogc:Literal>`;

                if (operator instanceof ComparisonEquals) {
                    return `<ogc:PropertyIsEqualTo matchCase="true">${property}${value}</ogc:PropertyIsEqualTo>`;
                }
                if (operator instanceof ComparisonIsNull) {
                    return `<ogc:PropertyIsNull>${property}</ogc:PropertyIsNull>`;
                }
                if (operator instanceof ComparisonGreaterThan) {
                    return `<ogc:PropertyIsGreaterThan>${property}${value}</ogc:PropertyIsGreaterThan>`;
                }
                if (operator instanceof ComparisonGreaterThanEquals) {
                    return `<ogc:PropertyIsGreaterThanOrEqualTo>${property}${value}</ogc:PropertyIsGreaterThanOrEqualTo>`;
                }
                if (operator instanceof ComparisonLessThan) {
                    return `<ogc:PropertyIsLessThan>${property}${value}</ogc:PropertyIsLessThan>`;
                }
                if (operator instanceof ComparisonLessThanEquals) {
                    return `<ogc:PropertyIsLessThanOrEqualTo>${property}${value}</ogc:PropertyIsLessThanOrEqualTo>`;
                }
                if (operator instanceof ComparisonLike) {
                    return `<ogc:PropertyIsLike matchCase="${operator.opts.matchCase}" wildCard="${operator.opts.wildCard}" escapeChar="\\" singleChar=".">${property}${value}</ogc:PropertyIsLike>`;
                }
            }
            // Logical
            if (operator instanceof Logical) {
                const operators = operator.getOperators();
                if (operators.length > 0) {
                    if (operator instanceof LogicalAnd) {
                        return `<ogc:And>${operators.map(walk).join('')}</ogc:And>`;
                    }
                    if (operator instanceof LogicalOr) {
                        return `<ogc:Or>${operators.map(walk).join('')}</ogc:Or>`;
                    }
                    if (operator instanceof LogicalNot) {
                        return `<ogc:Not>${operators.map(walk).join('')}</ogc:Not>`;
                    }
                }
                return '';
            }
        };
        return `<ogc:Filter xmlns:gml="http://www.opengis.net/gml" xmlns:ogc="http://www.opengis.net/ogc">${walk(logical)}</ogc:Filter>`;
    }
}
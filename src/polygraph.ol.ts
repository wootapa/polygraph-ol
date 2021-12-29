import { PolygraphOl as Polygraph } from './ol/polygraph';
import { IJsonDump, IRuntimeOperatorCallback } from './core/contracts';
import { ProjectionLike } from 'ol/proj';

const and = (): Polygraph => Polygraph.and();
const or = (): Polygraph => Polygraph.or();
const not = (): Polygraph => Polygraph.not();
const fromJson = (json: IJsonDump | string): Polygraph => Polygraph.fromJson(json);
const define = (alias: string, func: IRuntimeOperatorCallback): void => Polygraph.define(alias, func);
const getOperatorAlias = (): string[] => Polygraph.getOperatorAlias();
const defaultProjection = (projection: ProjectionLike): void => Polygraph.defaultProjection(projection);

export { Polygraph, and, or, not, fromJson, define, getOperatorAlias, defaultProjection };

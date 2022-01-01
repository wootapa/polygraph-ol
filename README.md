# Polygraph - OpenLayers
This is an extension of https://github.com/wootapa/polygraph with spatial operators and is intended to be used with [Features](https://openlayers.org/en/latest/apidoc/module-ol_Feature-Feature.html) or geometrylike objects. It also supports serialization into CQL/XML to be used by an OGC compliant server, such as Geoserver.

In short, features can be filtered directly in the client, or the server, using the same instance of Polygraph.

See [demo](https://wootapa.github.io/polygraph-ol-demo/) with WFS/WMS side by side.

## Installation

Modern browsers and bundlers (es):
```shell
$ npm install --save @wootapa/polygraph-ol
```
```typescript
import { Polygraph } from '@wootapa/polygraph-ol';
// Polygraph.and()... (types included)
```

Legacy (umd):
```javascript
<script src="https://unpkg.com/@wootapa/polygraph-ol"></script>
// polygraph.and()...
```

## Methods
Below is only the spatial methods. See [Polygraph](https://github.com/wootapa/polygraph/blob/master/README.md) library for the standard operators available for comparing ordinary attributes.

### Statics
* `defaultProjection(projection)` - Sets default projection for all new Polygraphs. The projection is assumed to be known by OpenLayers and values are assumed to be transformed. Defaults to [EPSG:3857](http://epsg.io/3857).

### Spatial operators
value = geometrylike object. See below for what that is. 

* `intersects(value)` - True when object intersects value. 
* `disjoint(value)` - True when object do not intersects value.
* `contains(value)` - True when object completely contains value.
* `within(value)` - True when object is completely within value.
* `distanceWithin(value, distance, greatCircle?)` -  True when object is no more than specified distance (in meters) from value. Requires a correct projection. Uses greatCircle by default.
* `distanceBeyond(value, distance, greatCircle?)` -  True when object is more than specified distance (in meters) from value. Requires a correct projection. Uses greatCircle by default.

### Other
* `projection(projection)` - Overrides the default projection for current Polygraph.
* `asOgcCql(opts?)` - Outputs as OGC CQL.
* `asOgcXML(opts?)` - Outputs as OGC XML.

CQL/XML serializers take an optional object:
```javascript
geometryName?, // Serializes operators with a different geometryName. Ex 'the_geom'.
projection?, // Serializes operators with a different projection. Ex 'EPSG:4326'.
decimals? // Rounds geometry decimal precision on serialized operators. Ex, 5.
```

## Geometrylike objects
These types are all valid values for the spatial operators. If you need to evaluate ordinary attributes, use a type that can carry attributes.

- ol/Feature (can carry attributes and respects geometryName)
- ol/Geometry
- An object with a valid ol/Geometry (ex ```feature.getProperties()```) (can carry attributes)
- WKT
- GeoJSON (can carry attributes)
- Array(2=point, 4=extent=polygon, 6=linestring, 8+=linestring/polygon)

## An example
So maybe you have a bunch of features and you need all wells.
```javascript
const q = and().eq('type', 'well').done();
```
You figure the depth must at least 32 meters
```javascript
q.gte('depth', 32).done()
```
It also must be drilled before 1998 
```javascript
q.lte('drilled', new Date(1998,0)).done()
```
It should also intersect the area of interest
```javascript
q.intersects([13.8517, 55.9646, 14.3049, 56.1017]).done() // <- You have options what you pass here.
```
In the end, this is the result.
```javascript
const q = and()
    .eq('type', 'well')
    .gte('depth', 32)
    .lte('drilled', new Date(1998,0))
    .intersects([13.8517, 55.9646, 14.3049, 56.1017])
    .done();
```
Apply on client features...
```javascript
const features = [...];
const wells = features.filter(q.evaluate);
```
...or output as CQL/XML and pass it to your OGC compliant server.
```javascript
const opts = { geometryName: 'geom', projection: 'EPSG:3006', decimals: 0 }; // <- Optional
const cql = q.asOgcCql(opts);
const xml = q.asOgcXml(opts);
```

## Pro ol-tip!
To hide/show features based on the result you can do:
```javascript
const hiddenStyle = new Style();
source.forEachFeature(feature => {
    feature.setStyle(
        q.evaluate(feature)
            ? null        // visible (use layer style)
            : hiddenStyle // hidden (overrides layer style)
        );
});
```
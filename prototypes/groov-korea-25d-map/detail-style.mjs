/**
 * Street-level GROOV skin over the supplied OpenMapTiles geographic sources.
 * All positions, roads and building heights come from the vector tiles.
 * Nothing in this style synthesizes streets or exaggerates building heights.
 */
export function createDetailStyle(baseStyle) {
  if (!baseStyle?.sources?.openmaptiles) {
    throw new TypeError("The detail skin requires the base openmaptiles source.");
  }

  const source = "openmaptiles";
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const zoom = (...stops) => ["interpolate", ["linear"], ["zoom"], ...stops];
  const classes = (...names) => ["match", ["get", "class"], names, true, false];
  const isLine = ["==", ["geometry-type"], "LineString"];
  const notTunnel = ["!=", ["get", "brunnel"], "tunnel"];
  const name = ["coalesce", ["get", "name:ko"], ["get", "name:nonlatin"], ["get", "name"], ""];
  const layers = [];
  const add = (id, type, sourceLayer, config = {}) => {
    const layer = { id: `detail-${id}`, type, ...config };
    if (sourceLayer) Object.assign(layer, { source, "source-layer": sourceLayer });
    layers.push(layer);
    return layer;
  };
  const line = (id, sourceLayer, filter, color, width, extra = {}) => add(id, "line", sourceLayer, {
    ...(filter ? { filter } : {}),
    layout: { "line-cap": "round", "line-join": "round" },
    paint: { "line-color": color, "line-width": width, ...(extra.paint || {}) },
    ...(extra.minzoom === undefined ? {} : { minzoom: extra.minzoom }),
    ...(extra.maxzoom === undefined ? {} : { maxzoom: extra.maxzoom }),
  });
  const label = (id, sourceLayer, filter, size, color, extra = {}) => add(id, "symbol", sourceLayer, {
    ...(filter ? { filter } : {}),
    ...(extra.minzoom === undefined ? {} : { minzoom: extra.minzoom }),
    ...(extra.maxzoom === undefined ? {} : { maxzoom: extra.maxzoom }),
    layout: {
      "text-field": name,
      "text-font": ["Noto Sans Regular"],
      "text-size": size,
      "text-max-width": 10,
      "text-padding": 8,
      "text-letter-spacing": 0.02,
      "text-allow-overlap": false,
      "text-ignore-placement": false,
      ...(extra.layout || {}),
    },
    paint: {
      "text-color": color,
      "text-halo-color": "#101517",
      "text-halo-width": 1.4,
      "text-halo-blur": 0.4,
      ...(extra.paint || {}),
    },
  });

  add("background", "background", null, { paint: { "background-color": "#101517" } });
  add("residential", "fill", "landuse", {
    filter: classes("residential", "commercial", "industrial"),
    paint: { "fill-color": "#171d1f", "fill-opacity": 0.62 },
  });
  add("woodland", "fill", "landcover", {
    filter: classes("wood"),
    paint: { "fill-color": "#202923", "fill-opacity": 0.9 },
  });
  add("grass", "fill", "landcover", {
    filter: classes("grass", "farmland", "wetland"),
    paint: { "fill-color": "#242b25", "fill-opacity": 0.52 },
  });
  add("park", "fill", "park", {
    paint: { "fill-color": "#28302a", "fill-opacity": 0.67 },
  });
  line("park-edge", "park", null, "#566157", zoom(11, 0.3, 15, 0.6, 19, 1), {
    minzoom: 11, paint: { "line-opacity": 0.36 },
  });
  add("sport-ground", "fill", "landuse", {
    minzoom: 13,
    filter: classes("pitch", "track", "recreation_ground", "school", "hospital"),
    paint: { "fill-color": "#303530", "fill-opacity": 0.72, "fill-outline-color": "#444a42" },
  });
  add("water", "fill", "water", {
    paint: { "fill-color": "#1b2d34", "fill-opacity": 0.94 },
  });
  line("water-edge", "water", null, "#45575d", zoom(11, 0.35, 16, 0.6, 19, 0.9), {
    paint: { "line-opacity": 0.44 },
  });
  line("waterways", "waterway", notTunnel, "#354b52", zoom(10, 0.7, 13, 1.4, 16, 3.2, 19, 7), {
    paint: { "line-opacity": 0.9 },
  });

  add("building-footprint", "fill", "building", {
    minzoom: 13,
    paint: {
      "fill-color": "#333c3d",
      "fill-opacity": zoom(13, 0.15, 15, 0.57, 17, 0.84, 20, 0.92),
    },
  });
  line("building-footprint-edge", "building", null, "#697271", zoom(15, 0.2, 17, 0.55, 20, 0.85), {
    minzoom: 15,
    paint: { "line-opacity": zoom(15, 0.08, 17, 0.33, 20, 0.48) },
  });

  // Draw every available street class; hierarchy is conveyed with hairline width
  // and luminance, reserving orange for the user's route and selected region.
  const streetGroups = [
    { id: "service", kinds: ["service", "track"], min: 12, color: "#586162", width: zoom(11, 0.24, 13, 0.42, 15, 0.75, 17, 1.15, 20, 2.2) },
    { id: "minor", kinds: ["minor"], min: 10, color: "#687172", width: zoom(10, 0.25, 12, 0.5, 15, 1.05, 17, 1.65, 20, 3.2) },
    { id: "secondary", kinds: ["secondary", "tertiary"], min: 9, color: "#8b9291", width: zoom(9, 0.3, 12, 0.75, 15, 1.55, 17, 2.35, 20, 4.2) },
    { id: "primary", kinds: ["trunk", "primary"], min: 7, color: "#a2a7a3", width: zoom(7, 0.3, 12, 0.95, 15, 1.9, 17, 2.85, 20, 4.7) },
    { id: "motorway", kinds: ["motorway"], min: 6, color: "#b0b4ac", width: zoom(6, 0.3, 12, 1.1, 15, 2.05, 17, 3, 20, 4.8) },
  ];
  for (const group of streetGroups) {
    const filter = ["all", isLine, classes(...group.kinds)];
    line(`road-${group.id}`, "transportation", filter, group.color, group.width, {
      minzoom: group.min,
      paint: { "line-opacity": ["case", ["==", ["get", "brunnel"], "tunnel"], 0.32, 0.89] },
    });
  }
  line("road-bridge-rim", "transportation", ["all", isLine, ["==", ["get", "brunnel"], "bridge"], classes("primary", "secondary", "tertiary", "minor")],
    "#c4c6bd", zoom(12, 0.4, 15, 1.1, 17, 1.6, 20, 2.7), {
      minzoom: 12, paint: { "line-opacity": 0.62 },
    });
  line("pedestrian-path", "transportation", ["all", isLine, classes("path", "pedestrian")],
    "#87948c", zoom(12, 0.4, 14, 0.62, 17, 1.15, 20, 1.9), {
      minzoom: 12, paint: { "line-dasharray": [1.5, 2], "line-opacity": 0.79 },
    });
  line("rail", "transportation", ["all", isLine, classes("rail", "transit")],
    "#727a7c", zoom(11, 0.45, 15, 0.85, 18, 1.4, 20, 2), {
      minzoom: 11, paint: { "line-dasharray": [4, 2.2], "line-opacity": 0.5 },
    });
  line("admin-boundary", "boundary", ["all", [">=", ["get", "admin_level"], 6], ["!=", ["get", "maritime"], 1]],
    "#767f7a", zoom(10, 0.35, 14, 0.65, 18, 1), {
      minzoom: 10, paint: { "line-dasharray": [2.5, 3.5], "line-opacity": 0.24 },
    });

  add("buildings-3d", "fill-extrusion", "building", {
    minzoom: 15.2,
    paint: {
      "fill-extrusion-color": ["interpolate", ["linear"], ["to-number", ["get", "render_height"], 0], 0, "#374041", 15, "#4a5452", 55, "#69736c", 150, "#7a8277"],
      "fill-extrusion-height": ["max", 0, ["to-number", ["get", "render_height"], 0]],
      "fill-extrusion-base": ["max", 0, ["to-number", ["get", "render_min_height"], 0]],
      "fill-extrusion-opacity": zoom(15.2, 0, 15.8, 0.68, 17, 0.9),
      "fill-extrusion-vertical-gradient": true,
    },
  });

  label("water-label", "waterway", notTunnel, zoom(12, 9.5, 16, 11, 19, 12.5), "#a3b0b2", {
    minzoom: 12,
    layout: { "symbol-placement": "line", "symbol-spacing": 380, "text-letter-spacing": 0.12 },
    paint: { "text-opacity": 0.75 },
  });
  label("road-major-label", "transportation_name", classes("motorway", "trunk", "primary", "secondary", "tertiary"),
    zoom(12, 9, 15, 10.5, 17, 11.5, 20, 13), "#c3c6c1", {
      minzoom: 12.5,
      layout: { "symbol-placement": "line", "symbol-spacing": 380, "text-max-angle": 28, "text-rotation-alignment": "map" },
      paint: { "text-opacity": 0.86 },
    });
  label("road-local-label", "transportation_name", classes("minor", "service", "track", "path", "pedestrian"),
    zoom(16, 9, 17, 10, 20, 11.5), "#a7afaa", {
      minzoom: 16.2,
      layout: { "symbol-placement": "line", "symbol-spacing": 470, "text-max-angle": 25, "text-rotation-alignment": "map", "text-padding": 14 },
      paint: { "text-opacity": 0.72 },
    });
  label("park-label", "park", null, zoom(12, 10, 15, 11.5, 18, 13), "#b3c0b0", {
    minzoom: 12.5, layout: { "text-padding": 16, "text-max-width": 8 },
    paint: { "text-opacity": 0.82 },
  });
  label("transit-label", "poi", classes("rail"), zoom(12, 10.5, 15, 12, 18, 13), "#eeeee6", {
    minzoom: 12,
    layout: { "text-padding": 14, "text-font": ["Noto Sans Bold"], "text-max-width": 8 },
  });
  label("essential-label", "poi", classes("hospital", "police", "fire_station"), zoom(16, 9.5, 18, 11.5, 20, 12), "#bbc1bb", {
    minzoom: 16,
    layout: { "text-padding": 28, "text-max-width": 8 },
    paint: { "text-opacity": 0.79 },
  });
  label("neighborhood-label", "place", classes("suburb", "quarter", "neighbourhood"), zoom(11, 11, 14, 13, 17, 14.5, 20, 16), "#d4d7ce", {
    minzoom: 11,
    layout: { "text-padding": 38, "text-letter-spacing": 0.06 },
    paint: { "text-opacity": zoom(11, 0.66, 14, 0.95, 17, 0.73) },
  });
  label("city-label", "place", classes("city", "town", "village"), zoom(8, 11, 12, 14, 15, 16), "#deded4", {
    minzoom: 8, maxzoom: 14,
    layout: { "text-padding": 28, "text-font": ["Noto Sans Bold"] },
  });

  return {
    version: 8,
    name: "GROOV / Detail Cartography",
    metadata: {
      "groov:accent": "#ff5733",
      "groov:geography": "Unmodified OpenMapTiles coordinates and rendered building heights",
      "groov:label-language": "name:ko → name:nonlatin → name",
    },
    sources: clone(baseStyle.sources),
    ...(baseStyle.sprite ? { sprite: clone(baseStyle.sprite) } : {}),
    ...(baseStyle.glyphs ? { glyphs: baseStyle.glyphs } : {}),
    light: { anchor: "viewport", color: "#f7f0dd", intensity: 0.4, position: [1.5, 205, 42] },
    transition: { duration: 350, delay: 0 },
    layers,
  };
}

export interface Airport {
  airport_id: number;
  ident: string;
  name: string;
  city: string;
  state: string;
  lonx: number;
  laty: number;
}

export interface SourceRunwayEnd {
  runway_end_id: number;
  name: string; // "23"
  heading: number;
  altitude: number;
  lonx: number;
  laty: number;
}

export interface RunwayEnd extends SourceRunwayEnd {
  pos: GeoPosition;
}

export interface SourceRunway {
  runway_id: number;
  airport_id: number;
  altitude: number; // feet
  length: number; // feet
  width: number; // feet
  heading: number;
  lonx: number;
  laty: number;
  primary_lonx: number;
  primary_laty: number;
  secondary_lonx: number;
  secondary_laty: number;
  primary_end_id: number;
  secondary_end_id: number;
}

export interface Runway extends SourceRunway {
  corners: GeoPosition[];
  runwayEnd_1: RunwayEnd;
  runwayEnd_2: RunwayEnd;
}

export interface SourceTaxiPath {
  taxi_path_id: number;
  airport_id: number;
  name: string; // "A"
  width: number; // feet
  start_lonx: number;
  start_laty: number;
  end_lonx: number;
  end_laty: number;
}

export interface TaxiPath extends SourceTaxiPath {
  index: number;
  startPos: GeoPosition;
  endPos: GeoPosition;
  midpoint: GeoPosition;
}

export interface GeoPosition {
  lat: number;
  long: number;
}

export interface BoundingBox {
  topLeft: GeoPosition;
  topRight: GeoPosition;
  bottomLeft: GeoPosition;
  bottomRight: GeoPosition;
}

export interface CanvasPosition {
  x: number;
  y: number;
}

export interface Settings {
  showGraph: boolean;
  showTaxiPathLabels: boolean;
  showRunwayIntersections: boolean;
  showAngles: boolean;
  useRealisticWidths: boolean;
}

// the bare minimum needed for pathfinding
export interface Node {
  neighbors: {
    [name: string]: number; // distance
  };
}

type NodeIntersection = [string, string];

export interface NodeWithData extends Node {
  pos: GeoPosition;
  // source: any;
  intersections: NodeIntersection[];
  neighborAngles: {
    [name: string]: number; // degrees
  };
}

export type Graph = {
  [nodeName: string]: NodeWithData;
};

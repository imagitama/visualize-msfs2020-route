export interface Airport {
  airport_id: number;
  ident: string;
  name: string;
  city: string;
  state: string;
  lonx: number;
  laty: number;
}

export interface RunwayEnd {
  runway_end_id: number;
  name: string; // "23"
  heading: number;
  altitude: number;
  lonx: number;
  laty: number;
}

export interface Runway {
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
  // custom
  runwayEnd_1: RunwayEnd;
  runwayEnd_2: RunwayEnd;
}

export interface TaxiPath {
  taxi_path_id: number;
  airport_id: number;
  name: string; // "A"
  width: number; // feet
  start_lonx: number;
  start_laty: number;
  end_lonx: number;
  end_laty: number;
  // custom
  index: number;
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

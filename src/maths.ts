import { BoundingBox, GeoPosition, Runway } from "./types";

export const isLatLongEqual = (
  lat1: number,
  long1: number,
  lat2: number,
  long2: number
): boolean => lat1 === lat2 && long1 === long2;

export const getIsGeoPositionEqual = (pos1: GeoPosition, pos2: GeoPosition) =>
  pos1.lat === pos2.lat && pos1.long === pos2.long;

export function getMidpoint(
  startX: number,
  startY: number,
  endX: number,
  endY: number
): { x: number; y: number } {
  const x = (startX + endX) / 2;
  const y = (startY + endY) / 2;
  return {
    x,
    y,
  };
}

export function getGeoMidpoint(
  startPos: GeoPosition,
  endPos: GeoPosition
): GeoPosition {
  const { x, y } = getMidpoint(
    startPos.lat,
    startPos.long,
    endPos.lat,
    endPos.long
  );
  return {
    lat: x,
    long: y,
  };
}

export function getDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
) {
  const R = 6371; // Radius of the Earth in kilometers
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  const distance = R * c; // Distance in kilometers

  return distance;
}

export const getGeoDistance = (pos1: GeoPosition, pos2: GeoPosition): number =>
  getDistance(pos1.lat, pos1.long, pos2.lat, pos2.long);

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

export function getBoundingBox(
  start: GeoPosition,
  end: GeoPosition,
  width: number
): BoundingBox {
  // Calculate the angle of the line
  const angle = Math.atan2(end.lat - start.lat, end.long - start.long);

  // Calculate half of the width
  const halfWidth = width / 2;

  // Calculate the offset for the bounding box
  const xOffset = Math.sin(angle) * halfWidth;
  const yOffset = Math.cos(angle) * halfWidth;

  // Calculate the coordinates of the bounding box corners
  const topLeft: GeoPosition = {
    lat: start.lat + xOffset,
    long: start.long - yOffset,
  };

  const topRight: GeoPosition = {
    lat: end.lat + xOffset,
    long: end.long - yOffset,
  };

  const bottomLeft: GeoPosition = {
    lat: start.lat - xOffset,
    long: start.long + yOffset,
  };

  const bottomRight: GeoPosition = {
    lat: end.lat - xOffset,
    long: end.long + yOffset,
  };

  return {
    topLeft,
    topRight,
    bottomLeft,
    bottomRight,
  };
}

export function isGeoPositionInsideBoundingBox(
  position: GeoPosition,
  boundingBox: BoundingBox,
  isDebug: boolean = false
): boolean {
  const { lat, long } = position;
  const { topLeft, topRight, bottomLeft, bottomRight } = boundingBox;

  // Check if the latitude is within the bounding box's vertical range
  const isLatInside = lat >= bottomLeft.lat && lat <= topLeft.lat;

  // Check if the longitude is within the bounding box's horizontal range
  const isLongInside = long >= topLeft.long && long <= topRight.long;

  if (isDebug) {
    if (!isLatInside) {
      console.log(
        `Latitude ${lat} is outside the vertical range of the bounding box.`
      );
    }
    if (!isLongInside) {
      console.log(
        `Longitude ${long} is outside the horizontal range of the bounding box.`
      );
    }
  }

  // Return true if both latitude and longitude are inside the bounding box
  return isLatInside && isLongInside;
}

export function isGeoPositionInsideGeoPolygon(
  position: GeoPosition,
  polygon: GeoPosition[],
  throwIfNotInside = false
): boolean {
  const { lat, long } = position;

  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lat;
    const yi = polygon[i].long;
    const xj = polygon[j].lat;
    const yj = polygon[j].long;

    const intersect =
      yi > long !== yj > long &&
      lat < ((xj - xi) * (long - yi)) / (yj - yi) + xi;

    if (intersect) {
      inside = !inside;
    }
  }

  if (throwIfNotInside && !inside) {
    console.warn(`Point (${lat}, ${long}) is not inside the polygon.`);
  }

  return inside;
}

export type GeoPolygon = GeoPosition[];

const feetToDegrees = (feet: number): number => {
  const feetPerDegree = 364000 / 360;
  return feet / feetPerDegree;
};

export const getGeoPolygon = (
  start: GeoPosition,
  end: GeoPosition,
  thicknessFeet: number
): GeoPolygon => {
  // Calculate the direction vector from start to end
  const direction = {
    lat: end.lat - start.lat,
    long: end.long - start.long,
  };

  // Normalize the direction vector
  const length = Math.sqrt(direction.lat ** 2 + direction.long ** 2);
  const normalizedDirection = {
    lat: direction.lat / length,
    long: direction.long / length,
  };

  const latDegreeLength = 364000; // Approximate feet per degree of latitude
  const longDegreeLength =
    latDegreeLength * Math.cos((start.lat + end.lat) / 2);

  const thicknessDegrees = {
    lat: thicknessFeet / 20 / latDegreeLength,
    long: thicknessFeet / 20 / longDegreeLength,
  };

  // Calculate the perpendicular vector for thickness
  const perpendicular1 = {
    lat: -normalizedDirection.long * thicknessDegrees.lat,
    long: normalizedDirection.lat * thicknessDegrees.long,
  };

  const perpendicular2 = {
    lat: normalizedDirection.long * thicknessDegrees.lat,
    long: -normalizedDirection.lat * thicknessDegrees.long,
  };

  // Calculate the four corners of the rectangle
  const corner1 = {
    lat: start.lat + perpendicular1.lat,
    long: start.long + perpendicular1.long,
  };

  const corner2 = {
    lat: start.lat + perpendicular2.lat,
    long: start.long + perpendicular2.long,
  };

  const corner3 = {
    lat: end.lat + perpendicular2.lat,
    long: end.long + perpendicular2.long,
  };

  const corner4 = {
    lat: end.lat + perpendicular1.lat,
    long: end.long + perpendicular1.long,
  };

  // Return the rectangle as a GeoPolygon
  return [corner1, corner2, corner3, corner4];
};

export function getAngleBetweenLines(
  line1: [GeoPosition, GeoPosition],
  line2: [GeoPosition, GeoPosition]
): number {
  // Calculate direction vectors
  const vector1 = {
    x: line1[1].long - line1[0].long,
    y: line1[1].lat - line1[0].lat,
  };
  const vector2 = {
    x: line2[1].long - line2[0].long,
    y: line2[1].lat - line2[0].lat,
  };

  // Calculate dot product
  const dotProduct = vector1.x * vector2.x + vector1.y * vector2.y;

  // Calculate magnitudes
  const magnitude1 = Math.sqrt(vector1.x ** 2 + vector1.y ** 2);
  const magnitude2 = Math.sqrt(vector2.x ** 2 + vector2.y ** 2);

  // Calculate the cosine of the angle
  const cosAngle = dotProduct / (magnitude1 * magnitude2);

  // Calculate the angle in radians
  const angleInRadians = Math.acos(cosAngle);

  // Convert the angle to degrees
  const angleInDegrees = (angleInRadians * 180) / Math.PI;

  return angleInDegrees;
}

import {
  getAngleBetweenLines,
  getDistance,
  getGeoDistance,
  getGeoMidpoint,
  isLatLongEqual,
} from "./maths";
import { Graph, RunwayEnd, TaxiPath } from "./types";

export const getNodeName = (name: string, index: number): string =>
  `${name}.${index}.end`;

export const getIsAngleTooSharp = (
  taxiPathNameA: string,
  taxiPathNameB: string,
  angle: number
): boolean => {
  // if (angle > 90) {
  //   return false;
  // }

  if (taxiPathNameA === taxiPathNameB) {
    if (angle > 0) {
      return false;
    }
  }

  // return true;

  if (angle > 90) {
    return false;
  }

  return true;
};

export const getGraphFromTaxiwaysAndRunways = (
  taxiPaths: TaxiPath[],
  runwayEnds: RunwayEnd[]
): Graph => {
  const graph: Graph = {};

  let lastName = "";
  let nameIndex = 0;

  for (const taxiPath of taxiPaths) {
    if (!taxiPath.name) {
      continue;
    }

    if (taxiPath.name !== lastName) {
      nameIndex = 0;
      lastName = taxiPath.name;
    } else {
      nameIndex++;
    }

    const key = getNodeName(taxiPath.name, taxiPath.index);
    const neighbors: { [key: string]: number } = {};
    const neighborAngles: { [key: string]: number } = {};

    for (const taxiPathToCompare of taxiPaths) {
      if (!taxiPathToCompare.name) {
        continue;
      }

      if (
        taxiPath.name === taxiPathToCompare.name &&
        taxiPath.index === taxiPathToCompare.index
      ) {
        continue;
      }

      const neighborType = {
        startWithStart: isLatLongEqual(
          taxiPath.start_laty,
          taxiPath.start_lonx,
          taxiPathToCompare.start_laty,
          taxiPathToCompare.start_lonx
        ),
        endWithStart: isLatLongEqual(
          taxiPath.end_laty,
          taxiPath.end_lonx,
          taxiPathToCompare.start_laty,
          taxiPathToCompare.start_lonx
        ),
        startWithEnd: isLatLongEqual(
          taxiPath.start_laty,
          taxiPath.start_lonx,
          taxiPathToCompare.end_laty,
          taxiPathToCompare.end_lonx
        ),
        endWithEnd: isLatLongEqual(
          taxiPath.end_laty,
          taxiPath.end_lonx,
          taxiPathToCompare.end_laty,
          taxiPathToCompare.end_lonx
        ),
      };

      const isNeighbor = Object.values(neighborType).some((i) => i === true);

      if (isNeighbor) {
        const neighborKey = getNodeName(
          taxiPathToCompare.name,
          taxiPathToCompare.index
        );

        let distance = -1;
        let angle = 9999;

        angle = getAngleBetweenLines(
          [
            {
              lat: taxiPath.start_laty,
              long: taxiPath.start_lonx,
            },
            {
              lat: taxiPath.end_laty,
              long: taxiPath.end_lonx,
            },
          ],
          [
            {
              lat: taxiPathToCompare.start_laty,
              long: taxiPathToCompare.start_lonx,
            },
            {
              lat: taxiPathToCompare.end_laty,
              long: taxiPathToCompare.end_lonx,
            },
          ]
        );

        distance = getGeoDistance(
          taxiPath.midpoint,
          taxiPathToCompare.midpoint
        );

        // if (neighborType.startWithStart) {
        //   distance = getDistance(
        //     taxiPath.end_laty,
        //     taxiPath.end_lonx,
        //     taxiPathToCompare.start_laty,
        //     taxiPathToCompare.start_lonx
        //   );
        // } else if (neighborType.endWithStart) {
        //   distance = getDistance(
        //     taxiPath.start_laty,
        //     taxiPath.start_lonx,
        //     taxiPathToCompare.start_laty,
        //     taxiPathToCompare.start_lonx
        //   );
        // } else if (neighborType.startWithEnd) {
        //   distance = getDistance(
        //     taxiPath.start_laty,
        //     taxiPath.start_lonx,
        //     taxiPathToCompare.start_laty,
        //     taxiPathToCompare.start_lonx
        //   );
        // } else if (neighborType.endWithEnd) {
        //   distance = getDistance(
        //     taxiPath.end_laty,
        //     taxiPath.end_lonx,
        //     taxiPathToCompare.start_laty,
        //     taxiPathToCompare.start_lonx
        //   );
        // }

        if (angle < 0 || angle > 360) {
          throw new Error(`Angle is invalid: ${angle}`);
        }

        if (distance <= 0) {
          throw new Error(`Distance is invalid: ${distance}`);
        }

        neighborAngles[neighborKey] = angle;

        // if (getIsAngleTooSharp(taxiPath.name, taxiPathToCompare.name, angle)) {
        //   continue;
        // }

        // if (key === "A.1") {
        //   console.debug(
        //     `A.1`,
        //     neighborKey,
        //     distance,
        //     neighbors,
        //     Object.values(neighborType)
        //   );
        // }

        neighbors[neighborKey] = distance;
      }
    }

    // if (!Object.keys(neighbors).length) {
    //   throw new Error(`Taxi path ${taxiPath.name} does not have any neighbors`);
    // }

    for (const runwayEnd of runwayEnds) {
      const distance = getDistance(
        runwayEnd.laty,
        runwayEnd.lonx,
        taxiPath.end_laty,
        taxiPath.end_lonx
      );

      const neighborKey = getNodeName(runwayEnd.name, runwayEnd.runway_end_id);

      neighbors[neighborKey] = distance;
    }

    graph[key] = {
      neighbors,
      // extra
      pos: taxiPath.midpoint,
      source: taxiPath,
      neighborAngles,
    };
  }

  for (const runwayEnd of runwayEnds) {
    const key = `${runwayEnd.name}_${runwayEnd.laty},${runwayEnd.lonx}`;
    const neighbors: { [key: string]: number } = {};

    for (const taxiPathToCompare of taxiPaths) {
      if (!taxiPathToCompare.name) {
        continue;
      }

      const distance = getDistance(
        runwayEnd.laty,
        runwayEnd.lonx,
        taxiPathToCompare.start_laty,
        taxiPathToCompare.start_lonx
      );

      const neighborKey = getNodeName(
        taxiPathToCompare.name,
        taxiPathToCompare.index
      );
      neighbors[neighborKey] = distance;
    }

    // TODO: Check against other runways

    graph[key] = {
      pos: { lat: runwayEnd.laty, long: runwayEnd.lonx },
      source: runwayEnd,
      neighbors,
      neighborAngles: {},
    };
  }

  return graph;
};

import { query } from "./sqlite";
import {
  getDistance,
  getMidpoint,
  isLatLongEqual,
  isGeoPositionInsideGeoPolygon,
  GeoPolygon,
  getGeoPolygon,
} from "./maths";
import { Airport, GeoPosition, Runway, RunwayEnd, TaxiPath } from "./types";

export interface Data {
  airport: Airport;
  runways: Runway[];
  runwayEnds: RunwayEnd[];
  taxiPaths: TaxiPath[];
  runwayIntersections: RunwayIntersection[];
}

const getRunwayEndById = (runwayEnds: RunwayEnd[], id: number): RunwayEnd =>
  runwayEnds.find((runwayEnd) => runwayEnd.runway_end_id === id)!;

export const getData = async (airportCode: string): Promise<Data> => {
  const [airport] = await query<Airport>(
    `SELECT * FROM airport WHERE ident = '${airportCode}'`
  );

  console.debug(`airport`, airport);

  const runways = await query<Runway>(
    `SELECT * FROM runway WHERE airport_id = '${airport.airport_id}'`
  );

  console.debug(`found ${runways.length} runways`, runways);

  const runwaysWithCorners = runways.map((runway) => ({
    ...runway,
    corners: getGeoPolygon(
      { lat: runway.primary_laty, long: runway.primary_lonx },
      { lat: runway.secondary_laty, long: runway.secondary_lonx },
      runway.width
    ),
  }));

  const runwayEnds = await query<RunwayEnd>(
    `SELECT * FROM runway_end WHERE runway_end_id IN (${runways
      .reduce<number[]>(
        (ids, runway) =>
          ids.concat([runway.primary_end_id, runway.secondary_end_id]),
        []
      )
      .join(", ")})`
  );

  console.debug(`found ${runwayEnds.length} runway ends`, runwayEnds);

  const runwaysWithEnds = runwaysWithCorners.map((runway) => ({
    ...runway,
    runwayEnd_1: getRunwayEndById(runwayEnds, runway.primary_end_id),
    runwayEnd_2: getRunwayEndById(runwayEnds, runway.secondary_end_id),
  }));

  const taxiPaths = await query<TaxiPath>(
    `SELECT * FROM taxi_path WHERE airport_id = '${airport.airport_id}'`
  );

  const indexByLetter: { [letter: string]: number } = {};

  const taxiPathsWithIndexes = taxiPaths
    .filter((i) => i.name)
    .map((taxiPath) => {
      const nameToUse = taxiPath.name;

      if (!(nameToUse in indexByLetter)) {
        indexByLetter[nameToUse] = -1;
      }

      indexByLetter[nameToUse]++;

      const index = indexByLetter[nameToUse];

      return {
        ...taxiPath,
        index,
      };
    });

  console.debug(
    `found ${taxiPathsWithIndexes.length} taxi paths`,
    taxiPathsWithIndexes
  );

  const runwayIntersections = getRunwayIntersections(
    runwaysWithEnds,
    taxiPathsWithIndexes
  );

  return {
    airport,
    runways: runwaysWithEnds,
    runwayEnds,
    runwayIntersections,
    taxiPaths: taxiPathsWithIndexes,
  };
};

export interface RunwayIntersection {
  runway: Runway;
  taxiPath: TaxiPath;
  start: boolean;
}

const getDoesTaxiPathIntersectRunway = (
  taxiPath: TaxiPath,
  runwayPolygon: GeoPolygon
): { start: boolean; end: boolean } => {
  const isStart = isGeoPositionInsideGeoPolygon(
    {
      lat: taxiPath.start_laty,
      long: taxiPath.start_lonx,
    },
    runwayPolygon
  );

  if (isStart) {
    return {
      start: true,
      end: false,
    };
  }

  const isEnd = isGeoPositionInsideGeoPolygon(
    {
      lat: taxiPath.end_laty,
      long: taxiPath.end_lonx,
    },
    runwayPolygon
  );

  if (isEnd) {
    return {
      start: false,
      end: true,
    };
  }

  return {
    start: false,
    end: false,
  };
};

const getRunwayIntersections = (
  runways: Runway[],
  taxiPaths: TaxiPath[]
): RunwayIntersection[] => {
  const intersections: RunwayIntersection[] = [];

  for (const taxiPath of taxiPaths) {
    for (const runway of runways) {
      const { start, end } = getDoesTaxiPathIntersectRunway(
        taxiPath,
        runway.corners
      );

      if ((start === true || end === true) && start !== end) {
        intersections.push({
          runway,
          taxiPath,
          start: start,
          // laty: intersection.lat,
          // lonx: intersection.long,
        });
      } else {
        // console.debug(`${taxiPath.name}.${taxiPath.index} does NOT`);
      }
    }
  }

  console.debug(
    `intersections`,
    intersections.map(
      (intersection) =>
        `${intersection.taxiPath.name}.${intersection.taxiPath.index}`
    )
  );

  return intersections;
};

export interface SubTaxiPath {
  name: string;
  children: string[];
  start_lonx: number;
  start_laty: number;
  end_lonx: number;
  end_laty: number;
}

function customComparator(a: any, b: any): number {
  const [aLetter, aNumber] = a.name.split(".");
  const [bLetter, bNumber] = b.name.split(".");

  // Compare letters first
  if (aLetter < bLetter) return -1;
  if (aLetter > bLetter) return 1;

  // If letters are equal, compare numbers
  return parseInt(aNumber, 10) - parseInt(bNumber, 10);
}

const distanceToBeConnected = 0.001;

export const getSubTaxiPaths = (taxiPaths: TaxiPath[]): SubTaxiPath[] => {
  let subTaxiPaths: SubTaxiPath[] = [];

  const childrenByName: { [name: string]: string[] } = {};

  for (const taxiPath of taxiPaths) {
    // if (!taxiPath.name) {
    //   continue;
    // }

    const fullName = `${taxiPath.name}.${taxiPath.index}`;

    const isDebug = fullName === "A.21";

    let parentsWithSameName: TaxiPath[] = [];
    let children: TaxiPath[] = [];

    for (const taxiPathToCompare of taxiPaths) {
      // if (!taxiPathToCompare.name) {
      //   continue;
      // }

      if (
        taxiPath.name === taxiPathToCompare.name &&
        // taxiPath.end_laty === taxiPathToCompare.start_laty &&
        // taxiPath.end_lonx === taxiPathToCompare.start_lonx
        getDistance(
          taxiPath.end_laty,
          taxiPath.end_lonx,
          taxiPathToCompare.start_laty,
          taxiPathToCompare.start_lonx
        ) < distanceToBeConnected
      ) {
        children.push(taxiPathToCompare);
      }

      if (
        taxiPath.name === taxiPathToCompare.name &&
        // taxiPath.start_laty === taxiPathToCompare.end_laty &&
        // taxiPath.start_lonx === taxiPathToCompare.end_lonx
        getDistance(
          taxiPath.start_laty,
          taxiPath.start_lonx,
          taxiPathToCompare.end_laty,
          taxiPathToCompare.end_lonx
        ) < distanceToBeConnected
      ) {
        parentsWithSameName.push(taxiPathToCompare);
      }
    }

    if (!(fullName in childrenByName)) {
      childrenByName[fullName] = [];
    }

    for (const child of children) {
      const childName = `${child.name}.${child.index}`;

      if (!childrenByName[fullName].includes(childName)) {
        childrenByName[fullName].push(childName);
      }
    }

    for (const parent of parentsWithSameName) {
      const parentName = `${parent.name}.${parent.index}`;

      if (!(parentName in childrenByName)) {
        childrenByName[parentName] = [];
      }

      if (!childrenByName[parentName].includes(fullName)) {
        childrenByName[parentName].push(fullName);
      }
    }
  }

  const childrenByNameSorted = Object.entries(childrenByName)
    .map(([name, children]) => ({
      name,
      children,
    }))
    .sort(customComparator);

  console.debug("children", childrenByNameSorted);

  let currentSubPathNames: string[] = [];
  let lastRootName = "";

  const indexByLetter: { [letter: string]: number } = {};

  let lastChildName = "";

  for (const { name, children } of childrenByNameSorted) {
    const rootName = name.split(".")[0];

    if (!rootName) {
      continue;
    }

    console.debug(`check ${name}`, children);

    let moveNext = false;

    if (!(rootName in indexByLetter)) {
      indexByLetter[rootName] = 0;
    }

    const performMoveNext = () => {
      if (!currentSubPathNames.includes(lastChildName)) {
        currentSubPathNames.push(lastChildName);
      }

      console.debug(
        `end of subtaxipath ${lastRootName}_${indexByLetter[lastRootName]} with ${currentSubPathNames.length} children`,
        currentSubPathNames
      );

      if (currentSubPathNames.length > 1) {
        const startTaxiPathName = currentSubPathNames[0];
        const endTaxiPathName =
          currentSubPathNames[currentSubPathNames.length - 1];

        const startTaxiPath = taxiPaths.find(
          (taxiPath) =>
            `${taxiPath.name}.${taxiPath.index}` === startTaxiPathName
        )!;
        const endTaxiPath = taxiPaths.find(
          (taxiPath) => `${taxiPath.name}.${taxiPath.index}` === endTaxiPathName
        )!;

        if (!startTaxiPath.name || !endTaxiPath.name) {
          return;
        }

        const startPos = getMidpoint(
          startTaxiPath.start_laty,
          startTaxiPath.start_lonx,
          startTaxiPath.end_laty,
          startTaxiPath.end_lonx
        );
        const endPos = getMidpoint(
          endTaxiPath.start_laty,
          endTaxiPath.start_lonx,
          endTaxiPath.end_laty,
          endTaxiPath.end_lonx
        );

        subTaxiPaths.push({
          name: `${lastRootName}_${indexByLetter[lastRootName]}`,
          children: currentSubPathNames,
          start_laty: startPos.x,
          start_lonx: startPos.y,
          end_laty: endPos.x,
          end_lonx: endPos.y,
        });
      } else {
        console.warn(
          `${lastRootName}_${indexByLetter[lastRootName]} has too little chunks`
        );
      }
    };

    if (rootName !== lastRootName) {
      performMoveNext();

      indexByLetter[rootName]++;
      currentSubPathNames = [];

      lastRootName = rootName;
    }

    if (children.length === 0) {
      if (name === "A.10") {
        console.debug(`I have NO children`);
      }

      moveNext = true;
    } else if (children.length === 1) {
      if (name === "A.10") {
        console.debug(`I have 1 child`);
      }

      currentSubPathNames.push(children[0]);
    } else if (children.length > 1) {
      if (name === "A.10") {
        console.debug(`I have ${children.length} children`);
      }

      currentSubPathNames.push(children[0]);

      moveNext = true;
    }

    if (moveNext) {
      performMoveNext();

      indexByLetter[rootName]++;
      currentSubPathNames = [];
    }

    lastChildName = name;
  }

  return subTaxiPaths;
};

interface Item<TSource> {
  source: TSource;
  position: GeoPosition;
}

export const getClosestGeoPosition = <TSource>(
  position: GeoPosition,
  items: Item<TSource>[]
): Item<TSource> =>
  items.reduce((closestItem, currentItem) => {
    const closestItemDistance = getDistance(
      position.lat,
      position.long,
      closestItem.position.lat,
      closestItem.position.long
    );
    const currentItemDistance = getDistance(
      position.lat,
      position.long,
      currentItem.position.lat,
      currentItem.position.long
    );

    return currentItemDistance < closestItemDistance
      ? currentItem
      : closestItem;
  }, items[0]);

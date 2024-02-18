import { getGeoDistance, getIsGeoPositionEqual } from "./maths";
import { GeoPosition, Graph, NodeWithData, RunwayEnd, TaxiPath } from "./types";

export const getNodeName = (position: GeoPosition) =>
  `${position.lat},${position.long}`;

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

const createNode = (pos: GeoPosition): NodeWithData => ({
  neighbors: {},
  neighborAngles: {},
  intersections: [],
  pos,
});

enum ComparisonType {
  StartWithStart,
  StartWithEnd,
  EndWithEnd,
  EndWithStart,
}

const insertNodesIntoGraph = (
  graphByRef: Graph, // this must be a reference to the original graph object as manipulate it "in place"
  originalTaxiPath: TaxiPath,
  otherTaxiPath: TaxiPath,
  type: ComparisonType
) => {
  let originalPos: GeoPosition;
  let targetPos: GeoPosition;

  switch (type) {
    case ComparisonType.StartWithStart:
      originalPos = originalTaxiPath.startPos;
      targetPos = otherTaxiPath.startPos;
      break;
    case ComparisonType.StartWithEnd:
      originalPos = originalTaxiPath.startPos;
      targetPos = otherTaxiPath.endPos;
      break;
    case ComparisonType.EndWithEnd:
      originalPos = originalTaxiPath.endPos;
      targetPos = otherTaxiPath.endPos;
      break;
    case ComparisonType.EndWithStart:
      originalPos = originalTaxiPath.endPos;
      targetPos = otherTaxiPath.startPos;
      break;
  }

  if (getIsGeoPositionEqual(originalPos, targetPos)) {
    const nodePos = originalPos;

    const existingNodeResult = Object.entries(graphByRef).find(([, node]) =>
      getIsGeoPositionEqual(nodePos, node.pos)
    );

    const handleEndNode = (
      firstNodeName: string,
      firstNodePos: GeoPosition
    ): [string, number] => {
      let otherEndPos: GeoPosition;
      let otherNodeName = "";

      switch (type) {
        case ComparisonType.StartWithStart:
          otherEndPos = originalTaxiPath.endPos;
          break;
        case ComparisonType.StartWithEnd:
          otherEndPos = originalTaxiPath.endPos;
          break;
        case ComparisonType.EndWithEnd:
          otherEndPos = originalTaxiPath.startPos;
          break;
        case ComparisonType.EndWithStart:
          otherEndPos = originalTaxiPath.startPos;
          break;
      }

      const otherEndExistingNodeResult = Object.entries(graphByRef).find(
        ([, node]) => getIsGeoPositionEqual(otherEndPos, node.pos)
      );

      let distanceBetweenNodes = -1;

      if (otherEndExistingNodeResult) {
        const existingNodeName = otherEndExistingNodeResult[0];
        const existingNode = otherEndExistingNodeResult[1];

        otherNodeName = existingNodeName;
        distanceBetweenNodes = getGeoDistance(firstNodePos, existingNode.pos);

        existingNode.neighbors = {
          ...existingNode.neighbors,
          [otherNodeName]: distanceBetweenNodes,
        };
      } else {
        const otherEndCreatedNodeName = `${otherEndPos.lat},${otherEndPos.long}`;
        const otherEndCreatedNode = createNode(nodePos);

        distanceBetweenNodes = getGeoDistance(nodePos, otherEndPos);

        otherEndCreatedNode.neighbors = {
          [firstNodeName]: distanceBetweenNodes,
        };

        graphByRef[otherEndCreatedNodeName] = otherEndCreatedNode;

        otherNodeName = otherEndCreatedNodeName;
      }

      return [otherNodeName, distanceBetweenNodes];
    };

    if (existingNodeResult) {
      const existingNodeName = existingNodeResult[0];
      const existingNode = existingNodeResult[1];
      const [otherNodeName, distance] = handleEndNode(
        existingNodeName,
        nodePos
      );

      existingNode.neighbors = {
        ...existingNode.neighbors,
        [otherNodeName]: distance,
      };
    } else {
      const createdNodeName = `${nodePos.lat},${nodePos.long}`;
      const createdNode = createNode(nodePos);

      const [otherNodeName, distance] = handleEndNode(createdNodeName, nodePos);

      if (otherNodeName && distance) {
        createdNode.neighbors = {
          [otherNodeName]: distance,
        };
      }

      graphByRef[createdNodeName] = createdNode;
    }
  }
};

const getIsTaxiPathEqual = (
  taxiPathA: TaxiPath,
  taxiPathB: TaxiPath
): boolean =>
  taxiPathA.name === taxiPathB.name && taxiPathA.index === taxiPathB.index;

const getIsTaxiPathTaxiway = (taxiPath: TaxiPath): boolean => !!taxiPath.name;

export const getGraphFromTaxiwaysAndRunways = (
  taxiPaths: TaxiPath[],
  runwayEnds: RunwayEnd[]
): Graph => {
  const graph: Graph = {};

  /**
   * How this works:
   *
   * A node is generally a "join" between the ends of two taxi paths (not taxiways). Remember: nodes != taxipaths.
   * The name of each node is its long,lat
   * It assumes each join position is identical (which it appears to be).
   * When you loop over all taxi paths, some taxi paths will connect to either the start or end of another.
   * So we loop over all taxi paths,
   * Then loop over all other taxi paths twice - once for the start of the current one, one for the end.
   *
   * The dijkstra only needs the distance between two nodes. Each node must track its direct neighbors.
   * For taxipaths a direct neighbor would be the connecting taxipath or some other path (runway, parking, etc.).
   * So inside these loops we must create new nodes for the other ends of each taxi path.
   *
   * TODO:
   * - exclude node relationships if their angle is terrible/unrealistic
   * - add nodes for runways, parking, gates, etc.
   */

  for (const taxiPath of taxiPaths) {
    if (!getIsTaxiPathTaxiway(taxiPath)) {
      continue;
    }

    for (const taxiPathToCompare of taxiPaths) {
      if (!getIsTaxiPathTaxiway(taxiPathToCompare)) {
        continue;
      }

      if (getIsTaxiPathEqual(taxiPath, taxiPathToCompare)) {
        continue;
      }

      insertNodesIntoGraph(
        graph,
        taxiPath,
        taxiPathToCompare,
        ComparisonType.StartWithStart
      );
      insertNodesIntoGraph(
        graph,
        taxiPath,
        taxiPathToCompare,
        ComparisonType.StartWithEnd
      );
    }

    for (const taxiPathToCompare of taxiPaths) {
      if (!getIsTaxiPathTaxiway(taxiPathToCompare)) {
        continue;
      }

      if (getIsTaxiPathEqual(taxiPath, taxiPathToCompare)) {
        continue;
      }

      insertNodesIntoGraph(
        graph,
        taxiPath,
        taxiPathToCompare,
        ComparisonType.EndWithStart
      );
      insertNodesIntoGraph(
        graph,
        taxiPath,
        taxiPathToCompare,
        ComparisonType.EndWithEnd
      );
    }
  }

  return graph;
};

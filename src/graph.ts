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

const compareThem = (
  graphByRef: Graph,
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

    const existingNodeResult = Object.entries(graphByRef).find(
      ([nodeName, node]) => getIsGeoPositionEqual(nodePos, node.pos)
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
        ([nodeName, node]) => getIsGeoPositionEqual(otherEndPos, node.pos)
      );

      let distanceBetweenNodes = -1;

      if (otherEndExistingNodeResult) {
        const existingNodeName = otherEndExistingNodeResult[0];
        const existingNode = otherEndExistingNodeResult[1];
        // const [otherNodeName, distance] = handleEndNode(existingNodeName);

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

        console.debug(
          `created other end`,
          otherEndCreatedNodeName,
          distanceBetweenNodes
        );

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

      compareThem(
        graph,
        taxiPath,
        taxiPathToCompare,
        ComparisonType.StartWithStart
      );
      compareThem(
        graph,
        taxiPath,
        taxiPathToCompare,
        ComparisonType.StartWithEnd
      );
    }

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

      compareThem(
        graph,
        taxiPath,
        taxiPathToCompare,
        ComparisonType.EndWithStart
      );
      compareThem(
        graph,
        taxiPath,
        taxiPathToCompare,
        ComparisonType.EndWithEnd
      );
    }
  }

  return graph;
};

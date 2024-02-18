import { Graph } from "./types";

export const dijkstra = (
  graph: Graph,
  startNode: string,
  endNode: string
): { path: string[] | null; totalDistance: number } => {
  const visited: { [nodeName: string]: boolean } = {};
  const distances: { [nodeName: string]: number } = {};
  const previous: { [nodeName: string]: string | null } = {};

  Object.keys(graph).forEach((nodeName) => {
    distances[nodeName] = nodeName === startNode ? 0 : Infinity;
    previous[nodeName] = null;
  });

  const getClosestNode = (): string | null => {
    const unvisitedNodes = Object.entries(distances).filter(
      ([nodeName, distance]) => !visited[nodeName] && distance !== Infinity
    );
    if (unvisitedNodes.length === 0) {
      return null;
    }
    return unvisitedNodes.reduce(
      (minNode, node) => (node[1] < distances[minNode] ? node[0] : minNode),
      unvisitedNodes[0][0]
    );
  };

  let currentNode = startNode;

  while (currentNode) {
    const neighbors = graph[currentNode].neighbors;

    for (const neighbor in neighbors) {
      const newDistance = distances[currentNode] + neighbors[neighbor];

      if (newDistance < distances[neighbor]) {
        distances[neighbor] = newDistance;
        previous[neighbor] = currentNode;
      }
    }

    visited[currentNode] = true;
    currentNode = getClosestNode()!;
  }

  const path: string[] = [];
  let node = endNode;

  while (node) {
    path.unshift(node);
    node = previous[node]!;
  }

  const totalDistance = distances[endNode];

  return { path: path.length > 1 ? path : null, totalDistance };
};

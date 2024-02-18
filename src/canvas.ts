import {
  Data,
  RunwayIntersection,
  SubTaxiPath,
  getClosestGeoPosition,
} from "./data";
import {
  getGraphFromTaxiwaysAndRunways,
  getIsAngleTooSharp,
  getNodeName,
} from "./graph";
import { getGeoMidpoint, getMidpoint } from "./maths";
import { dijkstra } from "./pathfinding";
import {
  Airport,
  CanvasPosition,
  GeoPosition,
  Graph,
  NodeWithData,
  Runway,
  RunwayEnd,
  Settings,
  TaxiPath,
} from "./types";

export function drawDot(
  ctx: CanvasRenderingContext2D,
  pos: CanvasPosition,
  color: string,
  radius: number
) {
  ctx.beginPath();
  ctx.arc(pos.x, pos.y, radius, 0, 2 * Math.PI);
  ctx.fillStyle = color;
  ctx.fill();
}

export function drawHollowDot(
  ctx: CanvasRenderingContext2D,
  pos: CanvasPosition,
  color: string,
  thickness: number,
  radius: number
) {
  ctx.beginPath();
  ctx.lineWidth = thickness;
  ctx.arc(pos.x, pos.y, radius, 0, 2 * Math.PI);
  ctx.strokeStyle = color;
  ctx.stroke();
}

export function drawLine(
  ctx: CanvasRenderingContext2D,
  { x: startX, y: startY }: CanvasPosition,
  { x: endX, y: endY }: CanvasPosition,
  color: string | string[],
  thickness: number
) {
  if (isNaN(startX) || isNaN(startY) || isNaN(endX) || isNaN(endY)) {
    console.debug(startX, startY, endX, endY);
    throw new Error("invalid");
  }

  ctx.beginPath();
  ctx.lineWidth = thickness;
  ctx.moveTo(startX, startY);
  ctx.lineTo(endX, endY);

  if (Array.isArray(color)) {
    const gradient = ctx.createLinearGradient(startX, startY, endX, endY);

    var index = 0;
    for (const colorItem of color) {
      gradient.addColorStop(index, colorItem);
      index++;
    }
    ctx.strokeStyle = gradient;
  } else {
    ctx.strokeStyle = color;
  }

  ctx.stroke();
}

export function drawText(
  ctx: CanvasRenderingContext2D,
  text: string,
  pos: CanvasPosition,
  color: string = "white",
  size: string = "12px",
  offset: number = 0,
  rotation: number = 0
) {
  ctx.font = `${size} sans-serif`;
  ctx.fillStyle = color;
  ctx.fillText(text, pos.x, pos.y);
}

const getActualZoomLevel = (zoomLevel: number): number => {
  const baseValue = 500;

  const zoomValue = baseValue * Math.pow(2, zoomLevel - 1);

  return zoomValue;

  // switch (zoomLevel) {
  //   case 1:
  //     return 500;
  //   case 2:
  //     return 1500;
  //   case 3:
  //     return 5000;
  //   case 4:
  //     return 100000;
  //   case 5:
  //     return 200000;
  //   case 6:
  //     return 500000;
  //   default:
  //     return 0;
  // }
};

export const getPanSpeed = (zoomLevel: number): number => {
  // Base pan speed
  const baseSpeed = 0.00005;

  // Exponent to control the rate of change
  const exponent = -0.001; // You can adjust this value based on your preference

  // Calculate the adjusted pan speed
  const adjustedSpeed = baseSpeed * Math.pow(zoomLevel, exponent);

  return adjustedSpeed;

  // return 0.00005;

  // switch (zoomLevel) {
  //   case 1:
  //     return 0.1;
  //   case 2:
  //     return 0.001;
  //   case 3:
  //     return 0.001;
  //   case 4:
  //     return 0.0001;
  //   case 5:
  //   case 6:
  //     return 0.00005;
  //   default:
  //     return 0;
  // }
};

export const distanceToCanvas = (distance: number, zoomLevel: number) => {
  const actualZoomLevel = getActualZoomLevel(zoomLevel);
  return distance * actualZoomLevel * 0.00001;
};

export const widthToCanvas = (width: number, zoomLevel: number) => {
  const actualZoomLevel = getActualZoomLevel(zoomLevel);
  return width * actualZoomLevel * 0.000001;
};

export const taxiPathWidthToCanvas = (width: number, zoomLevel: number) => {
  const actualZoomLevel = getActualZoomLevel(zoomLevel);
  // TODO: Identify why this multiplier is necessary (should always be using widthToCanvas)
  return width * actualZoomLevel * 0.000005;
};

export const runwayWidthToCanvas = (width: number, zoomLevel: number) => {
  const actualZoomLevel = getActualZoomLevel(zoomLevel);
  return width * actualZoomLevel * 0.00002;
};

interface AppState {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  centerPosition: GeoPosition;
  zoomLevel: number;
  userPosition: GeoPosition | null;
  shouldGuide: boolean;
  runwayName: string | null;
  settings: Settings;
}

function convertGeoPositionToCanvasPosition(
  state: AppState,
  { lat, long }: GeoPosition
): CanvasPosition {
  const actualZoomLevel = getActualZoomLevel(state.zoomLevel);

  const x =
    (long - state.centerPosition.long) *
      (state.canvas.width / 360) *
      actualZoomLevel +
    state.canvas.width / 2;
  const y =
    (state.centerPosition.lat - lat) *
      (state.canvas.height / 180) *
      actualZoomLevel +
    state.canvas.height / 2;

  if (isNaN(x)) {
    throw new Error(`Cannot long to canvas ${long}`);
  }
  if (isNaN(y)) {
    throw new Error(`Cannot lat to canvas ${lat}`);
  }

  return { x, y };
}

function drawPolygon(
  ctx: CanvasRenderingContext2D,
  points: CanvasPosition[],
  color: string = "black"
) {
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);

  for (const position of points) {
    ctx.lineTo(position.x, position.y);
  }

  ctx.closePath();

  ctx.fillStyle = color;
  ctx.fill();
}

function drawRunway(state: AppState, runway: Runway) {
  const canvasPoints = runway.corners.map((pos) =>
    convertGeoPositionToCanvasPosition(state, pos)
  );

  console.debug(`draw runway`, { geoPoints: runway.corners }, { canvasPoints });

  // TODO: Bring this back - for some reason the polygon is skewed weirdly
  drawPolygon(state.ctx, canvasPoints, "rgb(75, 50, 50)");

  // const startPos = convertGeoPositionToCanvasPosition(state, startGeoPos);
  // const endPos = convertGeoPositionToCanvasPosition(state, endGeoPos);

  // drawLine(
  //   state.ctx,
  //   startPos,
  //   endPos,
  //   "rgb(75, 50, 50",
  //   widthToCanvas(1000, state.zoomLevel)
  // );
}

function drawRunwayEnd(state: AppState, runwayEnd: RunwayEnd) {
  const pos = convertGeoPositionToCanvasPosition(state, {
    lat: runwayEnd.laty,
    long: runwayEnd.lonx,
  });
  drawText(state.ctx, runwayEnd.name, pos, "white", "30px");
}

function drawRunwayIntersection(
  state: AppState,
  runwayIntersection: RunwayIntersection
) {
  const lat = runwayIntersection.start
    ? runwayIntersection.taxiPath.start_laty
    : runwayIntersection.taxiPath.end_laty;
  const long = runwayIntersection.start
    ? runwayIntersection.taxiPath.start_lonx
    : runwayIntersection.taxiPath.end_lonx;
  const pos = convertGeoPositionToCanvasPosition(state, { lat, long });

  drawHollowDot(
    state.ctx,
    pos,
    "rgb(150, 100, 50)",
    widthToCanvas(25, state.zoomLevel),
    widthToCanvas(100, state.zoomLevel)
  );
}

function drawTaxiPath(
  state: AppState,
  taxiPath: TaxiPath,
  isHighlighted: boolean = false
) {
  const start = convertGeoPositionToCanvasPosition(state, {
    lat: taxiPath.start_laty,
    long: taxiPath.start_lonx,
  });
  const end = convertGeoPositionToCanvasPosition(state, {
    lat: taxiPath.end_laty,
    long: taxiPath.end_lonx,
  });
  const thickness = taxiPathWidthToCanvas(
    state.settings.useRealisticWidths
      ? isHighlighted
        ? taxiPath.width + 1
        : taxiPath.width
      : 10,
    state.zoomLevel
  );

  const colorStart = "rgb(75, 75, 75)";

  drawLine(
    state.ctx,
    start,
    end,
    // always dark to light to help visualize start to end
    [colorStart, "rgb(100, 100, 100)"],
    thickness
  );

  // drawDot(state.ctx, start, colorStart, distanceToCanvas(5, state.zoomLevel));

  // if (taxiPath.name === 'A' && taxiPath.index === 4) {
  //   drawDot(state.ctx, start, 'rgb(255, 0, 0)', 10);
  //   drawDot(state.ctx, end, 'rgb(255, 100, 100)', 10);
  // }
}

function drawTaxiPathDots(
  state: AppState,
  taxiPath: TaxiPath,
  isHighlighted: boolean = false
) {
  const end = convertGeoPositionToCanvasPosition(state, {
    lat: taxiPath.end_laty,
    long: taxiPath.end_lonx,
  });

  drawDot(
    state.ctx,
    end,
    "rgb(0, 100, 0)",
    distanceToCanvas(3, state.zoomLevel)
  );
}

const getRandomHexColor = () =>
  "#" + (((1 << 24) * Math.random()) | 0).toString(16).padStart(6, "0");

const getRandomYellowColor = () => {
  var red = 255;
  var green = Math.floor(Math.random() * 256);
  var blue = 0;

  var color = "rgb(" + red + ", " + green + ", " + blue + ")";

  return color;
};

function drawSubTaxiPath(state: AppState, taxiPath: SubTaxiPath) {
  const start = convertGeoPositionToCanvasPosition(state, {
    lat: taxiPath.start_laty,
    long: taxiPath.start_lonx,
  });
  const end = convertGeoPositionToCanvasPosition(state, {
    lat: taxiPath.end_laty,
    long: taxiPath.end_lonx,
  });
  const thickness = widthToCanvas(5, state.zoomLevel);

  drawLine(state.ctx, start, end, getRandomYellowColor(), thickness);

  const midpoint = getMidpoint(start.x, start.y, end.x, end.y);

  drawText(state.ctx, taxiPath.name, midpoint);
}

function drawTaxiPathLabel(
  state: AppState,
  taxiPath: TaxiPath,
  isHighlighted: boolean = false
) {
  if (!taxiPath.name) {
    return;
  }

  const midpointPos = convertGeoPositionToCanvasPosition(
    state,
    taxiPath.midpoint
  );

  drawText(
    state.ctx,
    `${taxiPath.name}.${taxiPath.index}`,
    { x: midpointPos.x - 5, y: midpointPos.y + 5 },
    "rgb(150, 150, 150)",
    isHighlighted ? "12px" : "10px"
  );
}

function drawTaxiPathForRoute(state: AppState, taxiPath: TaxiPath, i: number) {
  const start = convertGeoPositionToCanvasPosition(state, {
    lat: taxiPath.start_laty,
    long: taxiPath.start_lonx,
  });
  const end = convertGeoPositionToCanvasPosition(state, {
    lat: taxiPath.end_laty,
    long: taxiPath.end_lonx,
  });
  const thickness = widthToCanvas(taxiPath.width, state.zoomLevel);
  const color = "rgb(100, 100, 0)";

  drawLine(state.ctx, start, end, color, thickness);
}

const drawGraphStartAndEnd = (
  state: AppState,
  graph: Graph,
  startNodeName: string,
  endNodeName: string
) => {
  console.debug(`graph`, graph, `${startNodeName} => ${endNodeName}`);

  const start = convertGeoPositionToCanvasPosition(state, {
    lat: (graph[startNodeName].source as TaxiPath).end_laty,
    long: (graph[startNodeName].source as TaxiPath).end_lonx,
  });
  drawHollowDot(
    state.ctx,
    start,
    "green",
    widthToCanvas(50, state.zoomLevel),
    distanceToCanvas(20, state.zoomLevel)
  );

  const end = convertGeoPositionToCanvasPosition(state, {
    lat: (graph[endNodeName].source as TaxiPath).end_laty,
    long: (graph[endNodeName].source as TaxiPath).end_lonx,
  });
  drawHollowDot(
    state.ctx,
    end,
    "red",
    widthToCanvas(50, state.zoomLevel),
    distanceToCanvas(20, state.zoomLevel)
  );
};

const getStartNodeName = (
  taxiPaths: TaxiPath[],
  userPosition: GeoPosition
): string => {
  const closestTaxiPath = getClosestGeoPosition<TaxiPath>(
    userPosition,
    taxiPaths.map((taxiPath) => ({
      source: taxiPath,
      position: {
        lat: taxiPath.start_laty,
        long: taxiPath.start_lonx,
      },
    }))
  );

  const key = getNodeName(
    closestTaxiPath.source.name,
    closestTaxiPath.source.index
  );

  console.debug(`closest taxipath start to user`, key);

  return key;
};

const getEndNodeName = (
  runwayEnd: RunwayEnd,
  taxiPaths: TaxiPath[]
): string => {
  const closestTaxiPath = getClosestGeoPosition<TaxiPath>(
    {
      lat: runwayEnd.laty,
      long: runwayEnd.lonx,
    },
    taxiPaths.map((taxiPath) => ({
      source: taxiPath,
      position: {
        lat: taxiPath.start_laty,
        long: taxiPath.start_lonx,
      },
    }))
  );

  const key = getNodeName(
    closestTaxiPath.source.name,
    closestTaxiPath.source.index
  );

  console.debug(`closest taxipath start to runway`, key);

  return key;
};

const drawAngleBetweenNodes = (
  state: AppState,
  angle: number,
  startTaxiPath: TaxiPath,
  endTaxiPath: TaxiPath
) => {
  const midpoint = getGeoMidpoint(startTaxiPath.midpoint, endTaxiPath.midpoint);

  const pos = convertGeoPositionToCanvasPosition(state, midpoint);

  const isTooSharp = getIsAngleTooSharp(
    startTaxiPath.name,
    endTaxiPath.name,
    angle
  );

  const start = convertGeoPositionToCanvasPosition(
    state,
    startTaxiPath.midpoint
  );
  const end = convertGeoPositionToCanvasPosition(state, endTaxiPath.midpoint);

  drawLine(
    state.ctx,
    start,
    end,
    isTooSharp ? "rgba(100, 0, 0, 0.75)" : "rgba(0, 50, 0, 0.75)",
    widthToCanvas(25, state.zoomLevel)
  );

  drawText(
    state.ctx,
    `${startTaxiPath.name}.${startTaxiPath.index} => ${endTaxiPath.name}.${endTaxiPath.index}`,
    pos,
    isTooSharp ? "red" : "white",
    "10px"
  );

  drawText(
    state.ctx,
    `${angle.toFixed(1)}°`,
    {
      x: pos.x,
      y: pos.y + 12,
    },
    isTooSharp ? "red" : "white",
    "12px"
  );
};

const drawGraphNode = (state: AppState, node: NodeWithData) => {
  const canvasPos = convertGeoPositionToCanvasPosition(state, node.pos);

  drawDot(state.ctx, canvasPos, "purple", widthToCanvas(50, state.zoomLevel));
};

export const draw = async (
  state: AppState,
  { airport, runways, runwayEnds, taxiPaths, runwayIntersections }: Data,
  isSimple: boolean = false
) => {
  state.canvas.width = window.innerWidth;
  state.canvas.height = window.innerWidth;

  const ctx = state.canvas.getContext("2d")!;

  ctx.clearRect(0, 0, state.canvas.width, state.canvas.height);

  console.debug(`drawing`, { zoom: state.zoomLevel });

  for (const runway of runways) {
    drawRunway(state, runway);
  }

  let graph: Graph | null = null;
  let startNodeName = "";
  let endNodeName = "";

  if (state.shouldGuide && state.userPosition && state.runwayName) {
    graph = getGraphFromTaxiwaysAndRunways(taxiPaths, runwayEnds);

    if (!graph) {
      throw new Error("Failed to create graph");
    }

    startNodeName = getStartNodeName(taxiPaths, state.userPosition);

    const targetRunwayEnd = runwayEnds.find(
      (runwayEnd) => runwayEnd.name === state.runwayName
    );

    if (!targetRunwayEnd) {
      throw new Error(`No runway end found for ${state.runwayName}`);
    }

    endNodeName = getEndNodeName(targetRunwayEnd, taxiPaths);

    drawGraphStartAndEnd(state, graph, startNodeName, endNodeName);
  }

  if (graph && state.settings.showGraph) {
    for (const key in graph) {
      const node = graph[key];
      drawGraphNode(state, node);
    }
  }

  if (state.settings.showRunwayIntersections) {
    for (const runwayIntersection of runwayIntersections) {
      drawRunwayIntersection(state, runwayIntersection);
    }
  }

  for (const taxiPath of taxiPaths) {
    drawTaxiPath(state, taxiPath);
  }

  // for (const taxiPath of taxiPaths) {
  //   drawTaxiPathDots(state, taxiPath);
  // }

  if (state.userPosition !== null) {
    // const subTaxiPaths = getSubTaxiPaths(taxiPaths);

    // for (const subTaxiPath of subTaxiPaths) {
    //   drawSubTaxiPath(state, subTaxiPath);
    // }

    // console.debug(
    //   `subtaxipath`,
    //   taxiPaths.filter((i) => i.name).length,
    //   subTaxiPaths,
    // );

    // for (const [key, node] of Object.entries(graph)) {
    //   const { x, y } = convertGeoPositionToCanvasPosition(
    //     state,
    //     (node.source as TaxiPath).start_laty,
    //     (node.source as TaxiPath).start_lonx,
    //   );
    //   drawDot(ctx, x, y, 'darkgreen');

    //   // console.debug(`here ${node.source.name}.${node.index}`);

    //   drawText(
    //     ctx,
    //     `N ${(node.source as TaxiPath).name}.${
    //       (node.source as TaxiPath).index
    //     }`,
    //     x + 6,
    //     y + 3,
    //     'white',
    //     '10px',
    //   );
    // }

    try {
      if (state.shouldGuide && graph !== null && startNodeName && endNodeName) {
        const result = dijkstra(graph, startNodeName, endNodeName);

        console.debug(`path`, result);

        if (result.path !== null) {
          var i = 0;
          for (const pathName of result.path) {
            // await new Promise((resolve) => setTimeout(resolve, 10));

            const taxiPath = graph[pathName].source as TaxiPath;
            drawTaxiPathForRoute(state, taxiPath, i);

            const pos = convertGeoPositionToCanvasPosition(state, {
              lat: taxiPath.start_laty,
              long: taxiPath.start_lonx,
            });
            drawDot(ctx, pos, "yellow", distanceToCanvas(5, state.zoomLevel));
            i++;

            drawText(ctx, pathName, { x: 0, y: 20 * i }, "black");
          }
        } else {
          console.warn("Could not find a path");
        }
      }
    } catch (err) {
      console.error(err);
    }
  }

  if (graph && state.settings.showAngles) {
    const drawnRelationships: [string, string][] = [];

    for (const key in graph) {
      const node = graph[key];
      const taxiPath = node.source as TaxiPath;

      for (const neighborKey in node.neighborAngles) {
        const neighbor = graph[neighborKey];
        const neighborTaxiPath = neighbor.source as TaxiPath;
        const angle = node.neighborAngles[neighborKey];

        const alreadyDrawn = drawnRelationships.find(
          (relationship) =>
            relationship.includes(key) && relationship.includes(neighborKey)
        );

        if (alreadyDrawn) {
          continue;
        }

        drawAngleBetweenNodes(state, angle, taxiPath, neighborTaxiPath);

        drawnRelationships.push([key, neighborKey]);
      }
    }
  }

  if (state.settings.showTaxiPathLabels) {
    for (const taxiPath of taxiPaths) {
      drawTaxiPathLabel(state, taxiPath);
    }
  }

  for (const runwayEnd of runwayEnds) {
    drawRunwayEnd(state, runwayEnd);
  }

  drawCenter(state);

  drawUserPosition(state);

  drawDebugInfo(state, airport);

  console.debug(`done`);
};

const drawUserPosition = (state: AppState) => {
  if (!state.userPosition) {
    return;
  }

  const pos = convertGeoPositionToCanvasPosition(state, state.userPosition);
  drawDot(state.ctx, pos, "yellow", 5);

  drawText(
    state.ctx,
    `${state.userPosition.lat}`,
    { x: pos.x + 10, y: pos.y + 5 },
    "white",
    "8px"
  );
  drawText(
    state.ctx,
    `${state.userPosition.long}`,
    { x: pos.x + 10, y: pos.y + 15 },
    "white",
    "8px"
  );
};

const drawCenter = (state: AppState) => {
  const center = convertGeoPositionToCanvasPosition(
    state,
    state.centerPosition
  );
  drawDot(state.ctx, center, "blue", 5);
};

const drawDebugInfo = (state: AppState, airport: Airport) => {
  const text = `${airport.ident} ${airport.name} ${airport.city}, ${airport.state}`;
  const textWidth = state.ctx.measureText(text).width;
  const pos = {
    x: state.canvas.width - textWidth - 200,
    y: 20,
  };

  drawText(state.ctx, text, pos, "white");

  drawText(
    state.ctx,
    `Zoom level ${state.zoomLevel}`,
    {
      x: pos.x,
      y: 40,
    },
    "white"
  );
};

export function canvasToLatLong(state: AppState, x: number, y: number) {
  const actualZoomLevel = getActualZoomLevel(state.zoomLevel);

  const long =
    (x - state.canvas.width / 2) /
      (state.canvas.width / 360) /
      actualZoomLevel +
    state.centerPosition.long;
  const lat =
    state.centerPosition.lat -
    (y - state.canvas.height / 2) /
      (state.canvas.height / 180) /
      actualZoomLevel;

  return { lat, long };
}

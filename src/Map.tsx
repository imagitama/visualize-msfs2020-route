import { useEffect, useRef, useState } from "react";
import { canvasToLatLong, draw, getPanSpeed } from "./canvas";
import { GeoPosition } from "./types";
import { Data, getData } from "./data";

const maxZoomLevel = 20;
const defaultZoomLevel = 5;
const defaultAirportCode = "KGCN";

const Panel = ({ children, name }: { children: any; name: string }) => (
  <div className={`panel panel_${name}`}>{children}</div>
);

export const Map = ({ backToMainMenu }: { backToMainMenu: () => void }) => {
  const [airportCode, setAirportCode] = useState(defaultAirportCode);
  const [runwayName, setRunwayName] = useState("03");

  const canvasRef = useRef<HTMLCanvasElement>(null);

  const lastKnownDataRef = useRef<Data | null>(null);
  const centerPositionRef = useRef<GeoPosition | null>(null);
  const userPositionRef = useRef<GeoPosition | null>(null);
  const shouldGuideRef = useRef(false);
  const zoomLevelRef = useRef<number>(defaultZoomLevel);
  const airportCodeRef = useRef<string | null>(defaultAirportCode);
  const runwayNameRef = useRef<string | null>(null);

  const reloadData = async () => {
    try {
      console.debug(`reload data`);

      if (!airportCodeRef.current) {
        return;
      }

      const data = await getData(airportCodeRef.current);
      lastKnownDataRef.current = data;

      const canvas = canvasRef.current;

      if (!canvas) {
        console.warn("no canvas");
        return;
      }

      const newCenterPosition = {
        lat: data.airport.laty,
        long: data.airport.lonx,
      };

      centerPositionRef.current = {
        ...newCenterPosition,
      };

      userPositionRef.current = {
        ...newCenterPosition,
      };

      await draw(
        {
          canvas,
          ctx: canvas.getContext("2d")!,
          zoomLevel: zoomLevelRef.current,
          centerPosition: newCenterPosition,
          userPosition: userPositionRef.current,
          shouldGuide: shouldGuideRef.current,
          runwayName: runwayNameRef.current,
        },
        data
      );
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    reloadData();
  }, []);

  useEffect(() => {
    console.debug("useEffect: add canvas events");

    const canvas = canvasRef.current;

    if (!canvas) {
      console.warn("no canvas");
      return;
    }

    let isDraggingLeft = false;
    let isDraggingRight = false;
    let mouseX: number;
    let mouseY: number;

    canvas.addEventListener("mousedown", (event) => {
      event.preventDefault();

      mouseX = event.clientX;
      mouseY = event.clientY;

      if (event.button === 0) {
        isDraggingLeft = true;
      } else if (event.button === 2) {
        isDraggingRight = true;

        const canvasMouseX =
          event.clientX - canvas.getBoundingClientRect().left;
        const canvasMouseY = event.clientY - canvas.getBoundingClientRect().top;

        console.debug(`right click canvas`, canvasMouseX, canvasMouseY);

        if (!centerPositionRef.current) {
          console.warn("no center");
          return;
        }

        const { lat, long } = canvasToLatLong(
          {
            canvas,
            ctx: canvas.getContext("2d")!,
            centerPosition: centerPositionRef.current,
            zoomLevel: zoomLevelRef.current,
            userPosition: userPositionRef.current,
            shouldGuide: shouldGuideRef.current,
            runwayName: runwayNameRef.current,
          },
          canvasMouseX,
          canvasMouseY
        );

        userPositionRef.current = {
          lat,
          long,
        };

        redraw();
      }
    });

    canvas.addEventListener("mouseup", (event) => {
      event.preventDefault();

      isDraggingLeft = false;
      isDraggingRight = false;
    });

    canvas.addEventListener("mousemove", (event) => {
      event.preventDefault();

      if (!centerPositionRef.current) {
        return;
      }

      if (isDraggingLeft) {
        const scale = getPanSpeed(zoomLevelRef.current);
        const deltaX = (event.clientX - mouseX) * scale;
        const deltaY = (event.clientY - mouseY) * scale;

        centerPositionRef.current.long -= (deltaX / canvas.width) * 360;
        centerPositionRef.current.lat += (deltaY / canvas.height) * 180;

        mouseX = event.clientX;
        mouseY = event.clientY;

        redrawSimple();
      } else if (isDraggingRight) {
        const canvasMouseX =
          event.clientX - canvas.getBoundingClientRect().left;
        const canvasMouseY = event.clientY - canvas.getBoundingClientRect().top;

        const { lat, long } = canvasToLatLong(
          {
            canvas,
            ctx: canvas.getContext("2d")!,
            centerPosition: centerPositionRef.current,
            zoomLevel: zoomLevelRef.current,
            userPosition: userPositionRef.current,
            shouldGuide: shouldGuideRef.current,
            runwayName: runwayNameRef.current,
          },
          canvasMouseX,
          canvasMouseY
        );

        userPositionRef.current = {
          lat,
          long,
        };

        redraw();
      }
    });

    canvas.addEventListener(
      "wheel",
      (event) => {
        const deltaY = event.deltaY;

        if (deltaY < 0) {
          zoomIn();
        } else if (deltaY > 0) {
          zoomOut();
        }
      },
      { passive: true }
    );
  }, []);

  const redrawSimple = () => redraw(true);

  const redraw = async (isSimple = true) => {
    try {
      if (!lastKnownDataRef.current) {
        console.warn("no data");
        return;
      }

      if (!centerPositionRef.current) {
        console.warn("no center");
        return;
      }

      if (!canvasRef.current) {
        console.warn("no canvas");
        return;
      }

      await draw(
        {
          canvas: canvasRef.current,
          ctx: canvasRef.current.getContext("2d")!,
          centerPosition: centerPositionRef.current,
          zoomLevel: zoomLevelRef.current,
          userPosition: userPositionRef.current,
          shouldGuide: shouldGuideRef.current,
          runwayName: runwayNameRef.current,
        },
        lastKnownDataRef.current,
        isSimple
      );
    } catch (err) {
      console.error(err);
    }
  };

  const zoomIn = () => {
    const currentLevel = zoomLevelRef.current;
    zoomLevelRef.current =
      currentLevel < maxZoomLevel ? currentLevel + 1 : currentLevel;
    redraw();
  };

  const zoomOut = () => {
    const currentLevel = zoomLevelRef.current;
    zoomLevelRef.current = currentLevel > 1 ? currentLevel - 1 : currentLevel;
    redraw();
  };

  const focusAirport = () => {
    const data = lastKnownDataRef.current;

    if (!data) {
      return;
    }

    const newCenterPosition = {
      lat: data.airport.laty,
      long: data.airport.lonx,
    };

    centerPositionRef.current = newCenterPosition;

    redraw();
  };

  const focusUser = () => {
    if (!userPositionRef.current) {
      return;
    }

    centerPositionRef.current = {
      ...userPositionRef.current,
    };
    redraw();
  };

  const toggleGuideUserToRunway = () => {
    runwayNameRef.current = runwayName;
    shouldGuideRef.current = !shouldGuideRef.current;
    redraw();
  };

  const visitNewAirportCode = () => {
    airportCodeRef.current = airportCode;
    reloadData();
  };

  return (
    <>
      <Panel name="tools">
        Airport ICAO (eg. KGCN):
        <input
          type="text"
          value={airportCode}
          onChange={(e) => setAirportCode(e.target.value)}
        />
        <button onClick={() => visitNewAirportCode()}>Visit</button>
        <br />
        Runway name (eg. 22 or 05L):
        <input
          type="text"
          value={runwayName}
          onChange={(e) => setRunwayName(e.target.value)}
        />
        <button onClick={() => toggleGuideUserToRunway()}>Guide</button>
        <br />
        <button onClick={() => redraw()}>Re-Draw</button>
        <button onClick={() => zoomIn()}>Zoom In</button>
        <button onClick={() => zoomOut()}>Zoom Out</button>
        <button onClick={() => focusAirport()}>Focus Airport</button>
        <button onClick={() => focusUser()}>Focus User</button>
        <br />
        Hold right click to move player marker
        <br />
      </Panel>
      <Panel name="legend">
        Blue dot = center
        <br />
        Yellow dot = you
        <br />
        Green dot = start/end of taxiway
        <br />
        Orange circle = runway intersection
        <br />
        Taxiways start dark then end light
      </Panel>
      <Panel name="menu">
        <button onClick={() => backToMainMenu()}>Back to main menu</button>
      </Panel>
      <canvas ref={canvasRef}></canvas>
    </>
  );
};

export default Map;

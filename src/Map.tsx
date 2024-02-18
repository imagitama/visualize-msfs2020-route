import { useEffect, useRef, useState } from "react";
import { canvasToLatLong, draw, getPanSpeed } from "./canvas";
import { GeoPosition, Settings } from "./types";
import { Data, getData } from "./data";

const maxZoomLevel = 20;
const overrideCenterPosition: GeoPosition | null = null;
// const overrideCenterPosition = {
//   lat: 35.96139717102051,
//   long: -112.13677597045898,
// };
const defaultZoomLevel = 5;
// const defaultZoomLevel = 10;
const defaultAirportCode = "KGCN";
const defaultRunwayName = "03";
const defaultSettings: Settings = {
  showGraph: false,
  showTaxiPathLabels: true,
  showRunwayIntersections: true,
  showAngles: true,
  useRealisticWidths: false,
};

const Panel = ({ children, name }: { children: any; name: string }) => (
  <div className={`panel panel_${name}`}>{children}</div>
);

export const Map = ({ backToMainMenu }: { backToMainMenu: () => void }) => {
  const [airportCode, setAirportCode] = useState(defaultAirportCode);
  const [runwayName, setRunwayName] = useState(defaultRunwayName);
  const [taxiPathName, setTaxiPathName] = useState("");
  const [settings, setSettings] = useState<Settings>(defaultSettings);

  const canvasRef = useRef<HTMLCanvasElement>(null);

  const lastKnownDataRef = useRef<Data | null>(null);

  // TODO: Move these all to state so works across hot reloads and can persist
  const centerPositionRef = useRef<GeoPosition | null>(null);
  const userPositionRef = useRef<GeoPosition | null>(null);
  const shouldGuideRef = useRef(false);
  const zoomLevelRef = useRef<number>(defaultZoomLevel);
  const airportCodeRef = useRef<string | null>(defaultAirportCode);
  const runwayNameRef = useRef<string | null>(null);
  const settingsRef = useRef<Settings>(defaultSettings);

  const toggleSetting = (settingName: keyof typeof settings) => {
    setSettings((currentSettings) => ({
      ...currentSettings,
      [settingName]: !currentSettings[settingName],
    }));
  };

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

      const newCenterPosition = overrideCenterPosition
        ? {
            lat: (overrideCenterPosition as GeoPosition).lat - 0.0001,
            long: (overrideCenterPosition as GeoPosition).long + 0.0001,
          }
        : {
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
          settings: settingsRef.current,
        },
        data
      );
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    settingsRef.current = settings;
    redraw();
  }, [JSON.stringify(settings)]);

  useEffect(() => {
    console.debug("map mounted");
    reloadData();
    return () => {
      console.debug("map unmounted");
    };
  }, []);

  useEffect(() => {
    console.debug("adding canvas events...");
    const canvas = canvasRef.current;

    if (!canvas) {
      console.warn("no canvas");
      return;
    }

    let isDraggingLeft = false;
    let isDraggingRight = false;
    let mouseX: number;
    let mouseY: number;

    const onMouseDown = (event: MouseEvent) => {
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
            settings: settingsRef.current,
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
    };

    const onMouseUp = (event: MouseEvent) => {
      event.preventDefault();

      isDraggingLeft = false;
      isDraggingRight = false;
    };

    const onMouseMove = (event: MouseEvent) => {
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
            settings: settingsRef.current,
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
    };

    const onWheel = (event: WheelEvent) => {
      const deltaY = event.deltaY;

      if (deltaY < 0) {
        zoomIn();
      } else if (deltaY > 0) {
        zoomOut();
      }
    };

    canvas.addEventListener("mousedown", onMouseDown);
    canvas.addEventListener("mouseup", onMouseUp);
    canvas.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("wheel", onWheel, { passive: true });

    return () => {
      canvas.removeEventListener("mousedown", onMouseDown);
      canvas.removeEventListener("mouseup", onMouseUp);
      canvas.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("wheel", onWheel);
    };
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
          settings: settingsRef.current,
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

  const copyTaxiPathPosToClipboard = () => {
    const data = lastKnownDataRef.current;

    if (!data) {
      return;
    }

    const name = taxiPathName.split(".")[0];
    const index = parseInt(taxiPathName.split(".")[1]);

    const taxiPath = data.taxiPaths.find(
      (item) => item.name === name && item.index === index
    );

    if (!taxiPath) {
      console.warn(`cannot copy taxi path ${taxiPathName} as not found`);
      return;
    }

    const pos = {
      lat: taxiPath.midpoint.lat,
      long: taxiPath.midpoint.long,
    };

    const textForClipboard = JSON.stringify(pos, null, "  ");

    navigator.clipboard.writeText(textForClipboard);

    console.debug(`copied to clipboard`, textForClipboard);
  };

  return (
    <>
      <Panel name="tools">
        Airport ICAO (eg. KGCN):
        <input
          type="text"
          value={airportCode}
          placeholder={defaultAirportCode}
          onChange={(e) => setAirportCode(e.target.value)}
        />
        <button onClick={() => visitNewAirportCode()}>Visit</button>
        <br />
        Target runway (eg. 05L):
        <input
          type="text"
          value={runwayName}
          placeholder={defaultRunwayName}
          onChange={(e) => setRunwayName(e.target.value)}
        />
        <button onClick={() => toggleGuideUserToRunway()}>Guide</button>
        <br />
        Taxi path to get pos:
        <input
          type="text"
          value={taxiPathName}
          placeholder="A.5"
          onChange={(e) => setTaxiPathName(e.target.value)}
        />
        <button onClick={() => copyTaxiPathPosToClipboard()}>Copy</button>
        <br />
        <button onClick={() => redraw()}>Re-Draw</button>
        <button onClick={() => zoomIn()}>Zoom In</button>
        <button onClick={() => zoomOut()}>Zoom Out</button>
        <button onClick={() => focusAirport()}>Focus Airport</button>
        <button onClick={() => focusUser()}>Focus User</button>
        <br />
        Hold right click to move player marker
        <br />
        <input
          type="checkbox"
          checked={settings.showGraph}
          onChange={(e) => toggleSetting("showGraph")}
        />{" "}
        Show graph
        <br />
        <input
          type="checkbox"
          checked={settings.showAngles}
          onChange={(e) => toggleSetting("showAngles")}
        />{" "}
        Show angles
        <br />
        <input
          type="checkbox"
          checked={settings.showTaxiPathLabels}
          onChange={(e) => toggleSetting("showTaxiPathLabels")}
        />{" "}
        Show taxi path labels
        <br />
        <input
          type="checkbox"
          checked={settings.useRealisticWidths}
          onChange={(e) => toggleSetting("useRealisticWidths")}
        />{" "}
        Use realistic path widths
        <br />
        <input
          type="checkbox"
          checked={settings.showRunwayIntersections}
          onChange={(e) => toggleSetting("showRunwayIntersections")}
        />{" "}
        Show intersections
      </Panel>
      <Panel name="legend">
        Blue dot = center
        <br />
        Yellow dot = you
        <br />
        Purple dot = graph node
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

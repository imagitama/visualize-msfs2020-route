import "./App.css";
import { useState } from "react";
import { readSqliteFile, killDb, readSqliteUrl } from "./sqlite";
import Map from "./Map";

export default function App() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  const loadSelectedFile = async () => {
    try {
      if (!selectedFile) {
        return;
      }

      console.debug(`loading...`);

      setIsLoading(true);

      const result = await readSqliteFile(selectedFile);

      if (result) {
        console.debug(`loaded successfully`);
        setIsLoading(false);
        setHasLoaded(true);
      } else {
        throw new Error("Resolved but no data");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const reset = () => {
    killDb();
    setSelectedFile(null);
    setHasLoaded(false);
  };

  const loadExampleFile = async () => {
    try {
      console.debug(`loading...`);

      setIsLoading(true);

      const result = await readSqliteUrl("/KGCN.sqlite");

      if (result) {
        console.debug(`loaded successfully`);
        setIsLoading(false);
        setHasLoaded(true);
      } else {
        throw new Error("Resolved but no data");
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (!hasLoaded) {
    return (
      <>
        <h1>Visualize MSFS2020 Routes</h1>
        <p>
          A web app that loads a SQLite export of a MSFS2020 scenery pack,
          renders an airport of your choice and displays as much data as
          possible.
        </p>
        <ol>
          <li>
            Use{" "}
            <a href="https://github.com/albar965/navdatareader">
              navdatareader
            </a>{" "}
            to convert MSFS2020 scenery files to SQLite
          </li>
          <li>Select the file below</li>
          <li>Map will be drawn</li>
        </ol>
        <br />
        <br />
        <input
          type="file"
          accept=".sqlite, .db"
          onChange={(e) => {
            setSelectedFile(
              e.target.files && e.target.files.length ? e.target.files[0] : null
            );
          }}
        />
        <br />
        <br />
        {selectedFile && <>You have selected "{selectedFile.name}"</>}
        <br />
        <br />
        <button onClick={() => loadSelectedFile()}>Load</button>
        <button onClick={() => loadExampleFile()}>Load Example Data</button>
        {isLoading && <>Loading (takes a few seconds)...</>}
        <br />
        <br />
        <br />
        <br />
        <a href="https://github.com/imagitama/visualize-msfs2020-route/tree/master/src">
          Sourcecode
        </a>
        <br />
        <br />
        Tested in Firefox 122 with MSFS2020 with base scenery on Feb 17 2024
        <br />
        <br />
        Issues/ideas:
        <ul>
          <li>runway rendering is not rectangular</li>
          <li>graph should exclude any neighbors whose angle is too sharp</li>
          <li>
            guide should end at the actual runway not 1 or 2 nodes near it
          </li>
          <li>scrolling is weird sometimes</li>
        </ul>
        <br />
        How it works:
        <ol>
          <li>
            load the SQLite database and retrieve airport, its runways and its
            taxiways (which come broken down into taxipaths)
          </li>
          <li>give each taxipath an index to help later</li>
          <li>
            draw the runway as a polygon, taxipaths as straight lines, user
            position as yellow dot
          </li>
          <li>
            if guide is enabled, a "graph" is created - a simple map that tracks
            the distance to each direct neighbor of each taxipath
          </li>
          <li>
            the closest taxipath to the user and to the target runway is decided
            based on distance
          </li>
          <li>
            the graph is provided to a{" "}
            <a href="https://en.wikipedia.org/wiki/Dijkstra%27s_algorithm">
              dijkstra algorithm
            </a>{" "}
            to find the shortest path from the start node to end node
          </li>
        </ol>
      </>
    );
  } else {
    return <Map backToMainMenu={() => reset()} />;
  }
}

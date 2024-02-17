import "./App.css";
import { useState } from "react";
import { readSqliteFile, killDb } from "./sqlite";
import Map from "./Map";

export default function App() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  const load = async () => {
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
        <button onClick={() => load()}>Load</button>
        {isLoading && <>Loading (takes a few seconds)...</>}
        <br />
        <br />
        <br />
        <br />
        <br />
        <br />
        Tested in Firefox 122 with MSFS2020 with base scenery on Feb 17 2024
        <br />
        <br />
        Issues/ideas:
        <ul>
          <li>scrolling sucks</li>
        </ul>
      </>
    );
  } else {
    return <Map backToMainMenu={() => reset()} />;
  }
}

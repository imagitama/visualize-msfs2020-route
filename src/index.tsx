import { createRoot } from "react-dom/client";
import App from "./App";

window.addEventListener("contextmenu", (e) => e.preventDefault());

const container = document.getElementById("root") as HTMLElement;
const root = createRoot(container);
root.render(<App />);

import { createRoot } from "react-dom/client";
import Sistema from "./Sistema";
import "./styles.css";

const root = document.getElementById("root");
if (!root) throw new Error("No se encontró el área de la aplicación.");
createRoot(root).render(<Sistema />);

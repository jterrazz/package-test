import { startServer, stopServer } from "./e2e.specification.js";

export function setup() {
  startServer();
  return () => {
    stopServer();
  };
}

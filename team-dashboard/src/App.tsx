import { useState } from "react";
import { TeamDashboard } from "./components/TeamDashboard";
import { KESTREL_GLOBAL } from "./data/kestrelGlobal";
import { browserTimeZone } from "./lib/time";

interface AppProps {
  /** Overrides the browser's own time zone. */
  viewerZone?: string;
}

function App({ viewerZone }: AppProps) {
  // Read the clock once, on load. Nothing on the page updates by itself.
  const [now] = useState(() => new Date());
  const [zone] = useState(() => viewerZone ?? browserTimeZone());
  return <TeamDashboard people={KESTREL_GLOBAL} now={now} viewerZone={zone} />;
}

export default App;

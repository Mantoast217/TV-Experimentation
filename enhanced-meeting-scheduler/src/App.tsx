import { ErrorBoundary } from "./components/ErrorBoundary";
import { MeetingScheduler } from "./components/MeetingScheduler";

function App() {
  return (
    <ErrorBoundary>
      <MeetingScheduler />
    </ErrorBoundary>
  );
}

export default App;

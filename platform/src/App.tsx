import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import Chat from "@/pages/Chat";
import DeptAsk from "@/pages/DeptAsk";
import Dashboard from "@/pages/Dashboard";
import Metrics from "@/pages/Metrics";
import Sop from "@/pages/Sop";
import Reports from "@/pages/Reports";
import Alerts from "@/pages/Alerts";
import Actions from "@/pages/Actions";
import DataSources from "@/pages/DataSources";
import Permissions from "@/pages/Permissions";
import Audit from "@/pages/Audit";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/chat" element={<Chat />} />
          <Route path="/dept-ask" element={<DeptAsk />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/metrics" element={<Metrics />} />
          <Route path="/sop" element={<Sop />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/alerts" element={<Alerts />} />
          <Route path="/actions" element={<Actions />} />
          <Route path="/sources" element={<DataSources />} />
          <Route path="/permissions" element={<Permissions />} />
          <Route path="/audit" element={<Audit />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

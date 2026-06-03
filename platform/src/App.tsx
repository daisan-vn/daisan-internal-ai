import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import Dashboard from "@/pages/Dashboard";
import Permissions from "@/pages/Permissions";
import DataSources from "@/pages/DataSources";
import Chat from "@/pages/Chat";
import Placeholder from "@/pages/Placeholder";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/chat" element={<Chat />} />
          <Route path="/permissions" element={<Permissions />} />
          <Route path="/sources" element={<DataSources />} />
          <Route path="/dept-ask" element={<Placeholder title="Hỏi theo phòng ban" />} />
          <Route path="/metrics" element={<Placeholder title="Trung tâm số liệu" />} />
          <Route path="/sop" element={<Placeholder title="Trung tâm SOP" />} />
          <Route path="/reports" element={<Placeholder title="Trung tâm báo cáo" />} />
          <Route path="/alerts" element={<Placeholder title="Trung tâm cảnh báo" />} />
          <Route path="/actions" element={<Placeholder title="Trung tâm hành động" />} />
          <Route path="/audit" element={<Placeholder title="Lịch sử truy vấn" />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

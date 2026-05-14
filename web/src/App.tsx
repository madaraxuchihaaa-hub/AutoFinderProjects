import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppMeProvider } from "./meContext";
import Layout from "./Layout";
import ListingsPage from "./pages/ListingsPage";
import ListingDetailPage from "./pages/ListingDetailPage";
import LoginPage from "./pages/LoginPage";
import ComparePage from "./pages/ComparePage";
import "./styles.css";

export default function App() {
  return (
    <BrowserRouter>
      <AppMeProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Navigate to="/listings" replace />} />
            <Route path="/listings" element={<ListingsPage />} />
            <Route path="/listings/:id" element={<ListingDetailPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/compare" element={<ComparePage />} />
          </Route>
        </Routes>
      </AppMeProvider>
    </BrowserRouter>
  );
}

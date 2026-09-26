import { NavLink, Route, Routes } from "react-router-dom";
import { useConductor } from "./state.jsx";
import Home from "./pages/Home.jsx";
import Play from "./pages/Play.jsx";
import Profile from "./pages/Profile.jsx";
import Leaderboard from "./pages/Leaderboard.jsx";
import Debrief from "./pages/Debrief.jsx";
import Lab from "./pages/Lab.jsx";
import Classes from "./pages/Classes.jsx";
import Gallery from "./pages/Gallery.jsx";

export default function App() {
  const { profile, notifications } = useConductor();
  const unread = (notifications || []).filter((n) => !n.read).length;

  return (
    <div className="app-shell">
      <div className="rail-glow" aria-hidden="true" />
      <header className="topbar">
        <NavLink to="/" className="brand">
          <span className="brand-mark">400</span>
          <span className="brand-text">
            <strong>Проводник.400</strong>
            <small>Тренажёр решений ВСМ</small>
          </span>
        </NavLink>
        <nav className="nav">
          <NavLink to="/">Сценарии</NavLink>
          <NavLink to="/classes">Классы</NavLink>
          <NavLink to="/gallery">Галерея</NavLink>
          <NavLink to="/profile">Профиль</NavLink>
          <NavLink to="/leaderboard">Рейтинг</NavLink>
          <NavLink to="/lab">Редактор</NavLink>
        </nav>
        <div className="top-user">
          {unread > 0 && <span className="badge-dot">{unread}</span>}
          <span className="user-chip" style={{ "--avatar": profile?.user?.avatarColor || "#1B4F72" }}>
            {profile?.user?.displayName || "…"}
          </span>
        </div>
      </header>
      <main className="main">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/play/:scenarioId" element={<Play />} />
          <Route path="/debrief" element={<Debrief />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/lab" element={<Lab />} />
          <Route path="/classes" element={<Classes />} />
          <Route path="/gallery" element={<Gallery />} />
        </Routes>
      </main>
    </div>
  );
}

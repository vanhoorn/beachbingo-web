import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./firebase";
import LoginScreen from "./screens/LoginScreen";
import RegisterScreen from "./screens/RegisterScreen";
import LobbyScreen from "./screens/LobbyScreen";
import GameScreen from "./screens/GameScreen";

function App() {
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);

  useEffect(() => {
    return onAuthStateChanged(auth, (user) => {
      setLoggedIn(!!user);
    });
  }, []);

  if (loggedIn === null) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh", background: "#0f172a" }}>
        <span style={{ fontSize: 48 }}>🏖️</span>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={loggedIn ? <Navigate to="/lobby" /> : <LoginScreen />} />
        <Route path="/register" element={loggedIn ? <Navigate to="/lobby" /> : <RegisterScreen />} />
        <Route path="/lobby" element={loggedIn ? <LobbyScreen /> : <Navigate to="/login" />} />
        <Route path="/game/:gameId" element={loggedIn ? <GameScreen /> : <Navigate to="/login" />} />
        <Route path="*" element={<Navigate to={loggedIn ? "/lobby" : "/login"} />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;

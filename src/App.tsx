import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "./firebase";
import { audioManager } from "./audio/AudioManager";
import LoginScreen from "./screens/LoginScreen";
import RegisterScreen from "./screens/RegisterScreen";
import HomeScreen from "./screens/HomeScreen";
import LobbyScreen from "./screens/LobbyScreen";
import GameScreen from "./screens/GameScreen";
import ProfileScreen from "./screens/ProfileScreen";
import SettingsScreen from "./screens/SettingsScreen";
import ResultsScreen from "./screens/ResultsScreen";
import PongLobbyScreen from "./screens/pong/PongLobbyScreen";
import PongGameScreen from "./screens/pong/PongGameScreen";
import PongSettingsScreen from "./screens/pong/PongSettingsScreen";
import PongResultsScreen from "./screens/pong/PongResultsScreen";
import VierLobbyScreen from "./screens/vier/VierLobbyScreen";
import VierGameScreen from "./screens/vier/VierGameScreen";
import VierSettingsScreen from "./screens/vier/VierSettingsScreen";
import VierResultsScreen from "./screens/vier/VierResultsScreen";
import PiratesLobbyScreen from "./screens/pirates/PiratesLobbyScreen";
import PiratesGameScreen from "./screens/pirates/PiratesGameScreen";
import PiratesSettingsScreen from "./screens/pirates/PiratesSettingsScreen";
import PiratesResultsScreen from "./screens/pirates/PiratesResultsScreen";
import PiratesHighscoreScreen from "./screens/pirates/PiratesHighscoreScreen";
import WormLobbyScreen from "./screens/worm/WormLobbyScreen";
import WormGameScreen from "./screens/worm/WormGameScreen";
import WormSettingsScreen from "./screens/worm/WormSettingsScreen";
import WormResultsScreen from "./screens/worm/WormResultsScreen";
import WormHighscoreScreen from "./screens/worm/WormHighscoreScreen";
import StrandturmLobbyScreen from "./screens/strandturm/StrandturmLobbyScreen";
import StrandturmGameScreen from "./screens/strandturm/StrandturmGameScreen";
import StrandturmSettingsScreen from "./screens/strandturm/StrandturmSettingsScreen";
import StrandturmResultsScreen from "./screens/strandturm/StrandturmResultsScreen";
import StrandturmHighscoreScreen from "./screens/strandturm/StrandturmHighscoreScreen";
import BrandungLobbyScreen from "./screens/brandung/BrandungLobbyScreen";
import BrandungGameScreen from "./screens/brandung/BrandungGameScreen";
import BrandungSettingsScreen from "./screens/brandung/BrandungSettingsScreen";
import BrandungResultsScreen from "./screens/brandung/BrandungResultsScreen";
import MeermauLobbyScreen from "./screens/meermau/MeermauLobbyScreen";
import MeermauGameScreen from "./screens/meermau/MeermauGameScreen";
import MeermauSettingsScreen from "./screens/meermau/MeermauSettingsScreen";
import MeermauResultsScreen from "./screens/meermau/MeermauResultsScreen";
import JoinScreen from "./screens/JoinScreen";
import CategoryScreen from "./screens/CategoryScreen";
import AllGamesScreen from "./screens/AllGamesScreen";
import CardGamesScreen from "./screens/CardGamesScreen";

function App() {
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);

  useEffect(() => {
    return onAuthStateChanged(auth, (user) => {
      setLoggedIn(!!user);
      if (user) {
        // Load audio preferences once on login
        getDoc(doc(db, "users", user.uid)).then((snap) => {
          if (snap.exists()) {
            const data = snap.data();
            audioManager.setSound(data.soundEnabled !== false);
            audioManager.setMusic(data.musicEnabled !== false);
          }
        });
      }
    });
  }, []);

  if (loggedIn === null) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh", background: "#0a1628" }}>
        <span style={{ fontSize: 48 }}>🏖️</span>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login"    element={loggedIn ? <Navigate to="/home" /> : <LoginScreen />} />
        <Route path="/register" element={loggedIn ? <Navigate to="/home" /> : <RegisterScreen />} />
        <Route path="/home"     element={loggedIn ? <HomeScreen />    : <Navigate to="/login" />} />
        <Route path="/lobby"    element={loggedIn ? <LobbyScreen />   : <Navigate to="/login" />} />
        <Route path="/game/:gameId" element={loggedIn ? <GameScreen /> : <Navigate to="/login" />} />
        <Route path="/profile"  element={loggedIn ? <ProfileScreen /> : <Navigate to="/login" />} />
        <Route path="/settings" element={loggedIn ? <SettingsScreen /> : <Navigate to="/login" />} />
        <Route path="/results"  element={loggedIn ? <ResultsScreen /> : <Navigate to="/login" />} />
        <Route path="/pong/lobby"    element={loggedIn ? <PongLobbyScreen />    : <Navigate to="/login" />} />
        <Route path="/pong/game"     element={loggedIn ? <PongGameScreen />     : <Navigate to="/login" />} />
        <Route path="/pong/settings" element={loggedIn ? <PongSettingsScreen /> : <Navigate to="/login" />} />
        <Route path="/pong/results"  element={loggedIn ? <PongResultsScreen />  : <Navigate to="/login" />} />
        <Route path="/vier/lobby"    element={loggedIn ? <VierLobbyScreen />    : <Navigate to="/login" />} />
        <Route path="/vier/game"     element={loggedIn ? <VierGameScreen />     : <Navigate to="/login" />} />
        <Route path="/vier/settings" element={loggedIn ? <VierSettingsScreen /> : <Navigate to="/login" />} />
        <Route path="/vier/results"  element={loggedIn ? <VierResultsScreen />  : <Navigate to="/login" />} />
        <Route path="/pirates/lobby"    element={loggedIn ? <PiratesLobbyScreen />    : <Navigate to="/login" />} />
        <Route path="/pirates/game"     element={loggedIn ? <PiratesGameScreen />     : <Navigate to="/login" />} />
        <Route path="/pirates/settings" element={loggedIn ? <PiratesSettingsScreen /> : <Navigate to="/login" />} />
        <Route path="/pirates/results"    element={loggedIn ? <PiratesResultsScreen />    : <Navigate to="/login" />} />
        <Route path="/pirates/highscores" element={loggedIn ? <PiratesHighscoreScreen /> : <Navigate to="/login" />} />
        <Route path="/worm/lobby"      element={loggedIn ? <WormLobbyScreen />      : <Navigate to="/login" />} />
        <Route path="/worm/game"       element={loggedIn ? <WormGameScreen />       : <Navigate to="/login" />} />
        <Route path="/worm/settings"   element={loggedIn ? <WormSettingsScreen />   : <Navigate to="/login" />} />
        <Route path="/worm/results"    element={loggedIn ? <WormResultsScreen />    : <Navigate to="/login" />} />
        <Route path="/worm/highscores" element={loggedIn ? <WormHighscoreScreen />  : <Navigate to="/login" />} />
        <Route path="/strandturm/lobby"      element={loggedIn ? <StrandturmLobbyScreen />      : <Navigate to="/login" />} />
        <Route path="/strandturm/game"       element={loggedIn ? <StrandturmGameScreen />       : <Navigate to="/login" />} />
        <Route path="/strandturm/settings"   element={loggedIn ? <StrandturmSettingsScreen />   : <Navigate to="/login" />} />
        <Route path="/strandturm/results"    element={loggedIn ? <StrandturmResultsScreen />    : <Navigate to="/login" />} />
        <Route path="/strandturm/highscores" element={loggedIn ? <StrandturmHighscoreScreen />  : <Navigate to="/login" />} />
        <Route path="/brandung/lobby"    element={loggedIn ? <BrandungLobbyScreen />    : <Navigate to="/login" />} />
        <Route path="/brandung/game"     element={loggedIn ? <BrandungGameScreen />     : <Navigate to="/login" />} />
        <Route path="/brandung/settings" element={loggedIn ? <BrandungSettingsScreen /> : <Navigate to="/login" />} />
        <Route path="/brandung/results"  element={loggedIn ? <BrandungResultsScreen />  : <Navigate to="/login" />} />
        <Route path="/meermau/lobby"    element={loggedIn ? <MeermauLobbyScreen />    : <Navigate to="/login" />} />
        <Route path="/meermau/game"     element={loggedIn ? <MeermauGameScreen />     : <Navigate to="/login" />} />
        <Route path="/meermau/settings" element={loggedIn ? <MeermauSettingsScreen /> : <Navigate to="/login" />} />
        <Route path="/meermau/results"  element={loggedIn ? <MeermauResultsScreen />  : <Navigate to="/login" />} />
        <Route path="/join"          element={loggedIn ? <JoinScreen />         : <Navigate to="/login" />} />
        <Route path="/category/:playerCount" element={loggedIn ? <CategoryScreen /> : <Navigate to="/login" />} />
        <Route path="/all-games"     element={loggedIn ? <AllGamesScreen />    : <Navigate to="/login" />} />
        <Route path="/card-games"    element={loggedIn ? <CardGamesScreen />   : <Navigate to="/login" />} />
        <Route path="*" element={<Navigate to={loggedIn ? "/home" : "/login"} />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;

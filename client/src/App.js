import React from "react";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import NavBar from "./components/NavBar";

// Import your pages here
import Home from "./pages/Home";
import PlayOnline from "./pages/PlayOnline";
import PlayComputerPage from "./pages/PlayComputerPage";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import AnalysisBoardPage from "./pages/AnalysisBoardPage";
import BoardEditorPage from "./pages/BoardEditorPage";
import GamePage from "./pages/GamePage"; // Import the GamePage component
import ProtectedRoute from "./components/ProtectedRoute";
import TestChessBoard from "./pages/TestChessBoard";

console.log(localStorage.getItem('userInfo'));

function App() {
    return ( 
        <>
            <Router>
                <NavBar/> 
                <Routes>
                    <Route path="/test" element = {<TestChessBoard/>} />
                    <Route path="/" element={<Home />} />
                    <Route path="/play-online" element={<ProtectedRoute><PlayOnline /></ProtectedRoute>} />
                    <Route path="/play-computer" element={<PlayComputerPage />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/signup" element={<Signup />} />
                    <Route path="/tools/analysis-board" element={<AnalysisBoardPage />} />
                    <Route path="/tools/board-editor" element={<BoardEditorPage />} />
                    <Route path="/game/:roomId" element={<ProtectedRoute><GamePage /></ProtectedRoute>} />
                </Routes>
            </Router>
        </>
    );
}

export default App;
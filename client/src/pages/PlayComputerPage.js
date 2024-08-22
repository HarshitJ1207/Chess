import React from "react";
import PlayComputer from "../components/chessboards/PlayComputer";
import { useLocation } from "react-router-dom";
function PlayComputerPage() {
    const location = useLocation();
    const searchParams = new URLSearchParams(location.search);
    const fen = searchParams.get("start");
    return <PlayComputer fen = {fen} />;
}

export default PlayComputerPage;
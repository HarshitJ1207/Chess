import React from "react";
import { useLocation } from "react-router-dom";
import AnalysisBoard from "../components/chessboards/AnalysisBoard";

function AnalysisBoardPage() {
    const location = useLocation();
    const searchParams = new URLSearchParams(location.search);
    const fen = searchParams.get("start");

    return <AnalysisBoard fen={fen} />;
}

export default AnalysisBoardPage;
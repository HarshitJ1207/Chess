import React from 'react';
import { Chessboard } from "react-chessboard";

const TestChessBoard = () => {
    return (
        <div>
            <Chessboard 
                arePremovesAllowed = {true}
                customDarkSquareStyle={{
                    backgroundColor: "#3a6b7a"
                }}
                customLightSquareStyle={{
                    backgroundColor: "#a5c3cc"
                }}
            />
        </div>
    );
}

export default TestChessBoard;